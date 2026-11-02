#!/usr/bin/env python3
"""Benchmark complete catalog output against a git revision on a fixed input tree.

Example: python3 scripts/benchmark_catalog.py --input /tmp/sample \
    --output /tmp/benchmark --baseline HEAD --workers 2
Writes all artifacts outside the repository and compares every generated JSON
file, excluding only generatedAt timestamps. Use a representative corpus sample
for iteration, then repeat on the full corpus before publication.
"""
from __future__ import annotations

import argparse
import cProfile
import json
from pathlib import Path
import pstats
import subprocess
import sys
import time
import types

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import build_catalog


def normalized(value):
    if isinstance(value, dict):
        return {key: normalized(item) for key, item in value.items() if key != "generatedAt"}
    if isinstance(value, list):
        return [normalized(item) for item in value]
    return value


def compare_outputs(expected: Path, actual: Path):
    files = {p.relative_to(expected) for p in expected.rglob("*.json")}
    actual_files = {p.relative_to(actual) for p in actual.rglob("*.json")}
    if files != actual_files:
        raise AssertionError(f"Output file sets differ: {files ^ actual_files}")
    for relative in sorted(files):
        left = normalized(json.loads((expected / relative).read_text()))
        right = normalized(json.loads((actual / relative).read_text()))
        if left != right:
            raise AssertionError(f"Catalog output differs: {relative}")
    return len(files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline", default="HEAD")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--profile", action="store_true", help="Profile serial modes; use separate unprofiled runs for speed comparisons.")
    parser.add_argument("--mode", choices=["all", "baseline", "serial", "cold", "warm"], default="all")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    args.output.mkdir(parents=True, exist_ok=True)
    claims = args.output / "empty-claims.json"
    claims.write_text('{"schema":"ufo-files-claims/v1","claims":[]}\n')
    # Every measured mode needs a baseline, and warm needs a priming build.
    modes = {
        "all": ["baseline", "serial", "cold", "warm"],
        "baseline": ["baseline"],
        "serial": ["baseline", "serial"],
        "cold": ["baseline", "cold"],
        "warm": ["baseline", "cold", "warm"],
    }[args.mode]
    summary = {}
    for mode in modes:
        output = args.output / mode
        if output.exists():
            raise SystemExit(f"Use a fresh output directory; already exists: {output}")
        module = build_catalog
        kwargs = {}
        if mode == "baseline":
            source = subprocess.check_output(["git", "show", f"{args.baseline}:scripts/build_catalog.py"], cwd=root, text=True)
            module = types.ModuleType("scripts.baseline_catalog")
            module.__file__ = str(root / "scripts" / "build_catalog.py")
            module.__package__ = "scripts"
            sys.modules[module.__name__] = module
            exec(compile(source, module.__file__, "exec"), module.__dict__)
        else:
            kwargs = dict(workers=1 if mode == "serial" else args.workers,
                          cache_dir=None if mode == "serial" else args.output / "cache",
                          profile_report=args.output / f"{mode}-timings.json")
        profile = cProfile.Profile() if args.profile and mode in {"baseline", "serial"} else None
        started = time.perf_counter()
        if profile:
            profile.enable()
        catalog = module.build(args.input.resolve(), output / "catalog.json", 1200, 4000,
                               input_repository="ufo-files/machine-data", input_revision="benchmark",
                               require_data=True, duplicate_report=output / "duplicate_candidates.json",
                               date_review_report=output / "date_review.json", claims_path=claims,
                               paired_language="en", **kwargs)
        if profile:
            profile.disable()
            profile.dump_stats(str(args.output / f"{mode}.prof"))
            with (args.output / f"{mode}-profile.txt").open("w") as stream:
                pstats.Stats(profile, stream=stream).sort_stats("cumulative").print_stats(60)
        summary[mode] = {"seconds": time.perf_counter() - started, "counts": catalog["counts"]}
        if mode != "baseline":
            summary[mode]["equivalentFiles"] = compare_outputs(args.output / "baseline", output)
        (args.output / f"{mode}-result.json").write_text(json.dumps(summary[mode], indent=2) + "\n")
        print(json.dumps({mode: summary[mode]}), flush=True)


if __name__ == "__main__":
    main()
