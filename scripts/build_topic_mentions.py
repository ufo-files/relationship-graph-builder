#!/usr/bin/env python3
"""Build Drugs and Technologies using the full catalog's corpus ingestion rules."""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.build_clock_times import iter_corpus_documents
from scripts.topic_mentions import TOPICS, topic_observations_for_segment, write_topic_catalogs


def build_topic_mentions(root, output, repository, revision, paired_language="en", require_data=False):
    documents, observations = [], {topic: [] for topic in TOPICS}
    for doc, segments, ids in iter_corpus_documents(root, paired_language):
        documents.append(doc)
        for number, text in enumerate(segments):
            rows = topic_observations_for_segment(text, doc["id"], doc["source"], ids[number] if ids else number)
            for topic in TOPICS:
                observations[topic].extend(rows[topic])
    if require_data and not documents:
        raise ValueError("No readable corpus documents")
    return write_topic_catalogs(output, observations, documents,
                               {"repository": repository, "revision": revision, "pairedLanguage": paired_language},
                               dt.datetime.now(dt.timezone.utc).isoformat())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/topic-mentions"))
    parser.add_argument("--input-repository", default="ufo-files/machine-data")
    parser.add_argument("--input-revision", required=True)
    parser.add_argument("--paired-language", default="en", choices=["en", "pt-BR", "fr-FR"])
    parser.add_argument("--require-data", action="store_true")
    args = parser.parse_args()
    result = build_topic_mentions(args.input.resolve(), args.output.resolve(), args.input_repository, args.input_revision, args.paired_language, args.require_data)
    print(json.dumps({topic: payload["counts"] for topic, payload in result.items()}, indent=2))
