import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_catalog import build, classify_phrase, comparison_key, entity_key, extract_mentions, load_registry


class ClassificationTests(unittest.TestCase):
    def test_normalizes_identity_keys(self):
        self.assertEqual(comparison_key("Dr. J. Allen Hynek"), "j allen hynek")
        self.assertEqual(entity_key("The Department of Defense", "government_agency"), "department of defense")
        self.assertEqual(entity_key("Bob Lazar's", "person"), "bob lazar")
        self.assertEqual(entity_key("Senator Harry Reid", "person"), "harry reid")
        self.assertNotEqual(entity_key("May 7, 2019", "date"), entity_key("May 17, 2019", "date"))

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

    def test_resolves_confirmed_entity_aliases(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])
        mentions = extract_mentions("John Greenwald reviewed the Department of Defence file.", registry)

        self.assertIn(("John Greenwald", "John Greenewald", "person", 0.98, True), mentions)
        self.assertTrue(any(
            raw.strip() == "Department of Defence"
            and canonical == "Department of Defense"
            and category == "government_agency"
            and confidence == 0.98
            and curated
            for raw, canonical, category, confidence, curated in mentions
        ))


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
            entity = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Kelly Johnson")
            self.assertEqual(entity["sourceMetrics"]["Example"]["mentions"], entity["mentions"])
            self.assertEqual(entity["sourceMetrics"]["Example"]["documentCount"], entity["documentCount"])
            self.assertTrue(all(edge["evidence"] for edge in catalog["edges"]))
            self.assertTrue(all(edge["sourceMetrics"]["Example"]["evidenceCount"] == edge["evidenceCount"] for edge in catalog["edges"]))
            self.assertTrue(output.exists())

    def test_merges_aliases_and_writes_a_duplicate_review_queue(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            bodies = [
                "John Greenewald met President Calvin Coolidge. President Calvin Coolidge spoke again. John Greenewald replied.",
                "John Greenwald met President Calven Coolidge. President Calven Coolidge spoke again. John Greenwald replied.",
                "President Calvin Coolidge met President Calven Coolidge. President Calvin Coolidge and President Calven Coolidge spoke.",
            ]
            for number, body in enumerate(bodies, 1):
                metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": f"source-{number}.pdf", "source_bytes": 100}
                (collection / f"source-{number}.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")
            output = Path(directory) / "catalog.json"
            report = Path(directory) / "duplicate_candidates.json"
            catalog = build(root, output, 100, 100, require_data=True, duplicate_report=report)

            greenewald = [entity for entity in catalog["entities"] if entity["canonicalName"] == "John Greenewald"]
            self.assertEqual(len(greenewald), 1)
            self.assertIn("John Greenwald", greenewald[0]["variants"])
            self.assertGreater(catalog["counts"]["possibleDuplicates"], 0)
            self.assertTrue(any(
                {candidate["left"]["name"], candidate["right"]["name"]}
                == {"President Calvin Coolidge", "President Calven Coolidge"}
                for candidate in catalog["duplicateCandidates"]
            ))
            self.assertTrue(report.exists())

    def test_flags_repeated_and_administrative_context_that_inflates_mentions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            repeated_credit = "and research of John Greenewald, Jr., creator of"
            bodies = [
                f"{repeated_credit}\nRequester: John Greenewald\nJohn Greenewald discussed the released records.",
                f"{repeated_credit}\nRequester: John Greenewald",
                f"{repeated_credit}\nRequester: John Greenewald",
            ]
            for number, body in enumerate(bodies, 1):
                metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": f"source-{number}.pdf", "source_bytes": 100}
                (collection / f"source-{number}.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, require_data=True)
            entity = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "John Greenewald")

            self.assertEqual(entity["mentions"], 7)
            self.assertEqual(entity["contextAdjustedMentions"], 2)
            self.assertEqual(entity["independentDocumentCount"], 1)
            self.assertEqual(entity["inflatedMentionCount"], 5)
            self.assertEqual(entity["inflationRisk"], "high")
            self.assertEqual(entity["inflationSignals"]["repeatedContextMentions"], 3)
            self.assertEqual(entity["inflationSignals"]["administrativeMentions"], 3)

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
