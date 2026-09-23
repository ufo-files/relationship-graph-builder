#!/usr/bin/env python3
"""Replay published book evidence through the current extractor for triage.

This checks stored excerpts, not complete source documents. Unsupported rows
need review: excerpts can be truncated, and absence here is not proof a book
does not exist. Run the catalog builder to regenerate entities and counts.
"""

import argparse
import json
from pathlib import Path

from build_catalog import entity_key, extract_mentions, load_registry


def audit(catalog: dict, data_dir: Path) -> dict:
    registry = load_registry([
        data_dir / "curated_entities.json", data_dir / "entity_aliases.json",
        data_dir / "book_catalog.json",
    ])
    rows = []
    for entity in catalog["entities"]:
        if entity["category"] != "book":
            continue
        evidence = entity.get("evidence", [])
        matches = sorted({
            canonical for item in evidence
            for _, canonical, category, _, _ in extract_mentions(item["excerpt"], registry)
            if category == "book"
        })
        title = entity.get("canonicalName") or entity["name"]
        supported = any(entity_key(name, "book") == entity_key(title, "book") for name in matches)
        rows.append({
            "id": entity["id"], "title": title,
            "result": "supported_by_excerpt" if supported else "needs_review",
            "reviewStatus": entity.get("reviewStatus"),
            "documentCount": entity["documentCount"],
            "currentExcerptTitles": matches,
            "evidence": [{key: item[key] for key in ("documentId", "segment", "excerpt") if key in item}
                         for item in evidence],
        })
    return {
        "schema": "ufo-files-book-evidence-audit/v1",
        "catalogGeneratedAt": catalog.get("generatedAt"),
        "limitation": "Stored excerpts only; needs_review is not a verdict that a book is fictitious.",
        "counts": {"books": len(rows), "supportedByExcerpt": sum(row["result"] == "supported_by_excerpt" for row in rows),
                   "needsReview": sum(row["result"] == "needs_review" for row in rows)},
        "books": rows,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("data/catalog.json"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = audit(json.loads(args.catalog.read_text()), Path(__file__).resolve().parents[1] / "data")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result["counts"]))
