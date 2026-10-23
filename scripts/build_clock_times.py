#!/usr/bin/env python3
"""Build the compact clock dataset using the catalog's ingestion and language rules."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.build_catalog import (PAIRED_SEARCH_SCHEMAS, machine_data_paths, read_language_pair,
                                  read_ocr, read_tsv, stable_id, write_clock_catalog, clean_space, title_from_path)
from scripts.time_mentions import time_observations_for_segment


def iter_corpus_documents(root: Path, paired_language: str = "en"):
    for path in machine_data_paths(root, paired_language):
        relative = path.relative_to(root).as_posix()
        ids = None
        pair = read_language_pair(path) if path.name == "document.json" else None
        if pair:
            metadata, segments = pair["metadata"], pair["segments"]
            relative = pair["canonical_path"].relative_to(root).as_posix()
            ids = pair["segment_ids"]
            document_id = pair["document"].get("document_id") or stable_id("doc", relative)
        else:
            parsed = read_ocr(path) if path.suffix.lower() == ".txt" else read_tsv(path)
            if not parsed:
                continue
            metadata, segments = parsed[:2]
            ids = metadata.get("segment_ids") if metadata.get("schema") in PAIRED_SEARCH_SCHEMAS else None
            document_id = metadata.get("document_id") if metadata.get("schema") in PAIRED_SEARCH_SCHEMAS else None
            document_id = document_id or stable_id("doc", relative)
        source = relative.split("/", 1)[0]
        document = {"id": document_id, "path": relative, "source": source,
                          "title": clean_space(str(metadata["source_title"])) if metadata.get("source_title") else title_from_path(Path(str(metadata.get("source_file") or path.name)))}
        yield document, segments, ids


def build_clock_times(root: Path, output: Path, repository: str, revision: str, paired_language: str = "en", require_data: bool = False) -> dict:
    documents, observations = [], []
    for document, segments, ids in iter_corpus_documents(root, paired_language):
        documents.append(document)
        for number, text in enumerate(segments):
            observations.extend(time_observations_for_segment(
                text, document["id"], document["source"], ids[number] if ids else number,
                context_segments=segments, context_segment_index=number,
            ))
    if require_data and not documents:
        raise ValueError("No readable corpus documents")
    return write_clock_catalog(output, observations, documents,
                               {"repository": repository, "revision": revision, "pairedLanguage": paired_language},
                               dt.datetime.now(dt.timezone.utc).isoformat())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data/clock_times.json")
    parser.add_argument("--input-repository", default="ufo-files/machine-data")
    parser.add_argument("--input-revision", required=True)
    parser.add_argument("--paired-language", default="en", choices=["en", "pt-BR", "fr-FR"])
    parser.add_argument("--require-data", action="store_true")
    args = parser.parse_args()
    payload = build_clock_times(args.input.resolve(), args.output.resolve(), args.input_repository, args.input_revision, args.paired_language, args.require_data)
    print(json.dumps(payload["counts"], indent=2))


if __name__ == "__main__":
    main()
