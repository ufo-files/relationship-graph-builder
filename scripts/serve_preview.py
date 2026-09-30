#!/usr/bin/env python3
"""Serve public graph assets without exposing the surrounding checkout."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

PUBLIC_FILES = {"index.html", "app.js", "map-globe.js", "solar-system.js", "styles.css"}
PUBLIC_DIRECTORIES = {"assets", "data", "vendor"}


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        root = Path(self.directory).resolve()
        parts = unquote(urlsplit(path).path).strip("/").split("/")
        if parts == [""]:
            parts = ["index.html"]
        if (any(part.startswith(".") or "\\" in part for part in parts)
                or not (parts[0] in PUBLIC_DIRECTORIES or (len(parts) == 1 and parts[0] in PUBLIC_FILES))):
            return None
        target = root.joinpath(*parts)
        # Even an in-root symlink can reveal a non-public checkout file.
        current = root
        for part in parts:
            current = current / part
            if current.is_symlink():
                return None
        if not target.resolve().is_relative_to(root):
            return None
        return str(target)

    def send_head(self):
        if self.translate_path(self.path) is None:
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    def handler(*handler_args, **kwargs):
        return PreviewHandler(*handler_args, directory=str(root), **kwargs)
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
