import itertools
import gzip
import gc
import json
from pathlib import Path
import random
import re
import subprocess
import sys
import tempfile
import time
import unittest
import zlib
from unittest.mock import patch

from scripts.build_catalog import Candidate, IndexedAliasPattern, build, catalog_gc_policy, context_key, significance_metrics, write_clock_catalog
from scripts.benchmark_catalog import compare_outputs
from scripts.extraction_runtime import (
    document_key, extraction_fingerprint, extract_one, read_checkpoint,
    write_checkpoint, iter_extracted_documents,
)


def delayed_extraction(path, context):
    if path.stem == "0":
        deadline = time.monotonic() + 15
        while not (context["input_root"] / "8.done").exists():
            if time.monotonic() >= deadline:
                raise AssertionError("A slow first document prevented later work from being scheduled")
            time.sleep(.02)
    else:
        path.with_suffix(".done").touch()
    return {"name": path.name}, {}


class BenchmarkCLITests(unittest.TestCase):
    def test_standalone_modes_create_baseline_and_prime_warm_cache(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input" / "Example"
            source.mkdir(parents=True)
            transcript = source / "example.tsv"
            transcript.write_text("start\tend\ttext\n0\t4000\tNASA and Avi Loeb discussed Mars.\n")
            transcript.with_suffix(".source.json").write_text(json.dumps({
                "schema": "ufo-files-archive-media-transcripts/v1",
                "source_file": "example.mp4", "source_bytes": 128, "backend": "test",
            }))
            for mode in ("serial", "cold", "warm"):
                with self.subTest(mode=mode):
                    output = root / mode
                    subprocess.run([
                        sys.executable, str(repo / "scripts/benchmark_catalog.py"),
                        "--input", str(root / "input"), "--output", str(output),
                        "--baseline", "HEAD", "--mode", mode, "--workers", "2",
                    ], cwd=repo, check=True, capture_output=True, text=True, timeout=120)
                    result = json.loads((output / f"{mode}-result.json").read_text())
                    self.assertGreater(result["equivalentFiles"], 0)
                    self.assertTrue((output / "baseline/catalog.json").is_file())
                    if mode == "warm":
                        timings = json.loads((output / "warm-timings.json").read_text())
                        self.assertEqual(timings["cacheHits"], 1)
                        self.assertEqual(timings["cacheMisses"], 0)


class CatalogGCPolicyTests(unittest.TestCase):
    def test_restores_callers_policy_after_success_and_error(self):
        original = gc.get_threshold()
        enabled = gc.isenabled()
        for fail in (False, True):
            try:
                with catalog_gc_policy():
                    self.assertEqual(gc.isenabled(), enabled)
                    # Python 3.14 ignores threshold2; these thresholds remain
                    # effective on both the two- and three-generation GCs.
                    self.assertEqual(gc.get_threshold()[:2], (50_000, 10))
                    if fail:
                        raise RuntimeError("build failed")
            except RuntimeError:
                pass
            self.assertEqual(gc.get_threshold(), original)
            self.assertEqual(gc.isenabled(), enabled)


class AliasIndexTests(unittest.TestCase):
    def test_index_preserves_regex_boundaries_unicode_precedence_and_overlaps(self):
        aliases = ["a", "a a", "a a a", "a b", "a b a", "b a", "A B",
                   "U.S.", "NASA", "I", "İan", "Straße", "Σ", "foo", "(foo)",
                   "foo-bar", "x+y", "!!!", "_foo", "étoile", "K", "ι", "αιβ"]
        texts = [" ".join(items) for items in itertools.product(["a", "b", "A"], repeat=5)]
        texts += ["U.S.A. NASA-NASA NASA; x+y !!!", "I ı İ i İAN", "Straße STRAẞE Σ ς σ",
                  "foo\u0345 foo-bar (foo)bar _foo étoile ÉTOILE K K", "a\n b\t a",
                  "\u0345 α\u0345β ι αιβ"]
        rng = random.Random(42)
        texts += [" ".join(rng.choices(aliases + ["unrelated", "foo\u0345"], k=20)) for _ in range(100)]
        for ignore_case in (False, True):
            indexed = IndexedAliasPattern(aliases, ignore_case)
            original = re.compile(r"(?<![\w-])(" + "|".join(indexed.aliases) + r")(?![\w-])", indexed.flags)
            for text in texts:
                self.assertEqual([(m.span(), m.group()) for m in original.finditer(text)],
                                 [(m.span(), m.group()) for m in indexed.finditer(text)], text)


class ExtractionCacheTests(unittest.TestCase):
    def test_shared_context_weights_detach_without_cross_source_leakage(self):
        candidate = Candidate("NASA", "agency")
        candidate.add("NASA", "shared", "A", "s1", "Same context", .99, .8)
        key = context_key("Same context")
        self.assertIs(candidate.context_document_weights[key], candidate.source_context_document_weights["A"][key])
        candidate.add("NASA", "shared", "B", "s2", "Same context", .99, .2)
        candidate.add("NASA", "second", "A", "s3", "Same context", .99, .5)
        self.assertEqual(candidate.context_document_weights[key], {"shared": .2, "second": .5})
        self.assertEqual(candidate.source_context_document_weights["A"][key], {"shared": .8, "second": .5})
        self.assertEqual(candidate.source_context_document_weights["B"][key], {"shared": .2})
        self.assertEqual(significance_metrics(candidate, "A")["epistemicAdjustedMentions"], 1.3)
        self.assertEqual(significance_metrics(candidate, "B")["epistemicAdjustedMentions"], .2)

    def test_clock_shards_roundtrip_and_remove_stale_parts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            observations = [{"documentId": "doc", "excerpt": "é" * 700, "id": n} for n in range(12)]
            documents = [{"id": "doc", "path": "doc.txt", "title": "Document", "source": "A"}]
            payload = write_clock_catalog(root / "clock_times.json", observations, documents, {}, "now", max_bytes=4096)
            restored = {"documents": [], "observations": []}
            for part in payload["parts"]:
                rows = json.loads((root / part["path"]).read_text())
                self.assertEqual(len(rows), part["items"])
                self.assertLessEqual((root / part["path"]).stat().st_size, 4096)
                restored[part["field"]].extend(rows)
            self.assertEqual(restored["observations"], observations)
            self.assertEqual(restored["documents"], documents)
            write_clock_catalog(root / "clock_times.json", [], documents, {}, "later", max_bytes=4096)
            self.assertFalse(list((root / "clock-mentions").glob("*.json")))

    def test_malformed_envelopes_and_compression_errors_are_cache_misses(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "checkpoint.gz"
            with gzip.open(path, "wt") as stream:
                json.dump({"payload": 42, "key": "key", "schema": "invalid", "sha256": "bad"}, stream)
            self.assertEqual(read_checkpoint(path, "key"), (False, None))
            with patch("scripts.extraction_runtime.gzip.open", side_effect=zlib.error("corrupt stream")):
                self.assertEqual(read_checkpoint(path, "key"), (False, None))

    def test_slow_first_document_does_not_idle_workers_or_reorder_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [root / f"{index}.txt" for index in range(9)]
            stats = {"cacheHits": 0, "cacheMisses": 0}
            results = list(iter_extracted_documents(paths, {"input_root": root}, delayed_extraction,
                                                    "v1", None, 2, 0, stats))
            self.assertEqual([path for path, _ in results], paths)
            self.assertEqual([item["name"] for _, item in results], [p.name for p in paths])

    def test_dependency_contents_and_missing_sidecars_invalidate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "example.tsv"
            path.write_text("start\tend\ttext\n0\t1\tNASA\n")
            before = document_key(path, root, "version")
            path.with_suffix(".source.json").write_text('{"title":"one"}')
            sidecar = document_key(path, root, "version")
            self.assertNotEqual(before, sidecar)
            path.write_text("start\tend\ttext\n0\t1\tAARO\n")
            self.assertNotEqual(sidecar, document_key(path, root, "version"))
            pair = root / "paired" / "en" / "translation.txt"
            pair.parent.mkdir(parents=True)
            pair.write_text("translation")
            canonical = pair.parent.parent / "canonical.json"
            canonical.write_text("one")
            before = document_key(pair, root, "version")
            canonical.write_text("two")
            self.assertNotEqual(before, document_key(pair, root, "version"))
            (pair.parent.parent / "qa.json").write_text('{"status":"pass"}')
            self.assertNotEqual(before, document_key(pair, root, "version"))

    def test_code_rules_taxonomy_and_language_invalidate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts, data = root / "scripts", root / "data"
            scripts.mkdir()
            data.mkdir()
            rules = root / "rules.json"
            def key(language="en"):
                return extraction_fingerprint(scripts, data, rules, language)
            previous = key()
            for path in (scripts / "build_catalog.py", scripts / "topic_mentions.py",
                         data / "species_taxonomy.json", data / "book_catalog.json", rules):
                path.write_text("changed")
                self.assertNotEqual(previous, key())
                previous = key()
            self.assertNotEqual(previous, key("fr-FR"))

    def test_atomic_checkpoints_resume_and_corruption_recomputes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "document.txt"
            path.write_text("evidence")
            cache = root / "cache"
            calls = []
            def extract(path, context):
                calls.append(path)
                return {"evidence": ["NASA"]}, {"entities": .1}
            response = extract_one(path, {"input_root": root}, extract, "v1", cache)
            self.assertFalse(response[1])
            # A fresh invocation resumes from the completed document checkpoint.
            resumed = extract_one(path, {"input_root": root}, extract, "v1", cache)
            self.assertTrue(resumed[1])
            self.assertEqual(response[0], resumed[0])
            self.assertEqual(len(calls), 1)
            checkpoint = next(cache.rglob("*.json.gz"))
            checkpoint.write_bytes(b"truncated")
            self.assertFalse(extract_one(path, {"input_root": root}, extract, "v1", cache)[1])
            self.assertEqual(len(calls), 2)
            # Failure before rename preserves the last complete cache entry.
            key = document_key(path, root, "v1")
            with patch("scripts.extraction_runtime.os.replace", side_effect=OSError("interrupted")):
                with self.assertRaises(OSError):
                    write_checkpoint(checkpoint, key, {"partial": True})
            self.assertEqual(read_checkpoint(checkpoint, key), (True, response[0]))
            self.assertFalse(list(cache.rglob(".pending-*")))

    def test_input_mutation_during_extraction_does_not_publish_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "document.txt"
            path.write_text("before")
            def extract(path, context):
                path.write_text("after")
                return {}, {}
            with self.assertRaisesRegex(ValueError, "Input changed"):
                extract_one(path, {"input_root": root}, extract, "v1", root / "cache")
            self.assertFalse(list((root / "cache").rglob("*.json.gz")))

    def test_parallel_cold_and_warm_builds_preserve_all_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input" / "Example"
            source.mkdir(parents=True)
            for number, text in enumerate([
                "NASA and Avi Loeb discussed Mars at 10:30 PM. I haven't seen evidence of aliens.",
                "Avi Loeb wrote the book Extraterrestrial. The craft was triangular.",
                "NASA discussed Mars and Avi Loeb. The signal was 2.4 GHz.",
            ]):
                path = source / f"{number}.tsv"
                path.write_text("start\tend\ttext\n0\t4000\t" + text + "\n")
                path.with_suffix(".source.json").write_text(json.dumps({
                    "schema": "ufo-files-archive-media-transcripts/v1", "source_file": f"{number}.mp4",
                    "source_bytes": 128, "created_at": "2026-08-24T00:00:00Z", "backend": "test",
                }))
            for mode, workers, cache in [("serial", 1, None), ("cold", 2, root / "cache"), ("warm", 2, root / "cache")]:
                output = root / mode
                profile = root / f"{mode}-profile.json"
                build(root / "input", output / "catalog.json", 100, 100, require_data=True,
                      duplicate_report=output / "duplicates.json", date_review_report=output / "dates.json",
                      workers=workers, cache_dir=cache, profile_report=profile, progress_interval=0)
                if mode != "serial":
                    compare_outputs(root / "serial", output)
                stats = json.loads(profile.read_text())
                self.assertEqual(stats["cacheHits"], 3 if mode == "warm" else 0)


if __name__ == "__main__":
    unittest.main()
