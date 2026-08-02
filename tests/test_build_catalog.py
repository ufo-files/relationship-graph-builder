import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_catalog import build, classify_phrase, comparison_key, extract_mentions


class ClassificationTests(unittest.TestCase):
    def test_normalizes_identity_keys(self):
        self.assertEqual(comparison_key("Dr. J. Allen Hynek"), "j allen hynek")

    def test_rejects_document_heading_as_person(self):
        self.assertIsNone(classify_phrase("CONGRESSIONAL TRAVEL REQUEST"))
        self.assertIsNone(classify_phrase("Additional Details"))

    def test_classifies_strong_shapes(self):
        self.assertEqual(classify_phrase("Holloman Air Force Base")[0], "location")
        self.assertEqual(classify_phrase("University of Colorado")[0], "organization")
        self.assertEqual(classify_phrase("Kelly Johnson")[0], "person")

    def test_normalizes_unicode_ocr_variants_of_known_entities(self):
        mentions = extract_mentions("The FBİ reviewed the report.", {})

        self.assertEqual(
            mentions,
            [("FBİ", "Federal Bureau of Investigation", "government_agency", 0.99, True)],
        )


class CatalogTests(unittest.TestCase):
    def test_reads_supported_sources_and_keeps_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory) / "relationship-graph-builder"
            root = workspace / "_machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            for number in (1, 2):
                metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": f"source-{number}.pdf", "source_bytes": 100}
                body = "Federal Bureau of Investigation worked with Kelly Johnson.\nKelly Johnson discussed UFO reports.\n"
                (collection / f"source-{number}.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")
            output = root / "catalog.json"
            catalog = build(root, output, 100, 100, "ufo-files/machine-data", "abc123", True)
            self.assertEqual(catalog["counts"]["documents"], 2)
            self.assertEqual(catalog["input"]["rootName"], "machine-data")
            self.assertEqual(catalog["input"]["repository"], "ufo-files/machine-data")
            self.assertEqual(catalog["input"]["revision"], "abc123")
            self.assertTrue(any(entity["canonicalName"] == "Kelly Johnson" for entity in catalog["entities"]))
            self.assertTrue(all(edge["evidence"] for edge in catalog["edges"]))
            self.assertTrue(output.exists())

    def test_refuses_to_write_an_empty_required_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            root.mkdir()
            output = Path(directory) / "catalog.json"

            with self.assertRaisesRegex(ValueError, "Refusing to publish an empty catalog"):
                build(root, output, 100, 100, require_data=True)

            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
