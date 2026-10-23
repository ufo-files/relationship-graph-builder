#!/usr/bin/env python3
"""Record a homepage rebuild request after successful graph screenshots."""
import json
import os
from pathlib import Path
import re
import sys


def refresh(root: Path, revision: str, input_revision: str, run_url: str) -> None:
    for value in (revision, input_revision):
        if not re.fullmatch(r"[0-9a-f]{40}", value):
            raise ValueError("Snapshot revisions must be full lowercase Git SHAs")
    if not re.fullmatch(r"https://github.com/ufo-files/relationship-graph-builder/actions/runs/\d+", run_url):
        raise ValueError("Snapshot must identify a graph screenshot workflow run")
    snapshot = {"graphRevision": revision, "machineDataRevision": input_revision,
                "screenshotRun": run_url}
    # This file is committed only to the managed graph-refresh-requests branch.
    # Its push triggers the homepage's own Pages rebuild with its own token.
    (root / "data").mkdir(parents=True, exist_ok=True)
    (root / "data/graph-refresh-request.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"Requested homepage rebuild for graph snapshot {revision}")


if __name__ == "__main__":
    refresh(Path(sys.argv[1]), os.environ["GRAPH_REVISION"], os.environ["INPUT_REVISION"],
            os.environ["SNAPSHOT_RUN_URL"])
