import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_catalog import build, classify_phrase, comparison_key, entity_key, extract_mentions, inflation_risk, load_registry, sentence_segments


class ClassificationTests(unittest.TestCase):
    def test_prominence_inflation_risk_requires_lost_document_coverage(self):
        self.assertEqual(inflation_risk(0.98, 870), "high")
        self.assertEqual(inflation_risk(0.35, 1), "low")
        self.assertEqual(inflation_risk(0.08, 13), "low")

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

        expected_book_aliases = {
            "The Immortality Keys": "The Immortality Key",
            "ho/Brother of the third Degree": "The Brother of the Third Degree",
            "They Knew Too Huch About Flying Baucers": "They Knew Too Much About Flying Saucers",
            "Unvoiled Mysteries": "Unveiled Mysteries",
            "I AN DISCOURSE": "The I AM Discourses",
            "Flying Saucers From Outer": "Flying Saucers from Outer Space",
            "Ino UPO Btory": "The UFO Story",
            "Lo Matin das Magicians": "Le Matin des Magiciens",
            "Proce For A dig-sam": "Piece for a Jig-Saw",
            "nesial I ls leorees": "Special I AM Decrees",
            "Extraterrestrial Intelligence: The Evidence and Implications": "Extraterrestrial Contact: The Evidence and Implications",
            "Blank Check: The Pentagon's Black Budger": "Blank Check: The Pentagon's Black Budget",
            "They Are Aiready Here: UFO Culture and Why We See Saucers": "They Are Already Here: UFO Culture and Why We See Saucers",
            "Flying Seucers": "Flying Saucers",
            "Top Secret Slash Magic": "Top Secret/Majic",
        }
        for alias, canonical in expected_book_aliases.items():
            self.assertEqual(registry[comparison_key(alias)], (canonical, "book"))

        book_mentions = extract_mentions(
            "I read the book Unvoiled Mysteries. I read the book called The Immortality Keys.",
            registry,
        )
        resolved_books = {canonical for _, canonical, category, _, _ in book_mentions if category == "book"}
        self.assertIn("Unveiled Mysteries", resolved_books)
        self.assertIn("The Immortality Key", resolved_books)

        flying_saucers = extract_mentions(
            'Flying Saucers crossed the sky. One source cited the book "Flying Seucers" by Donald Menzel.',
            registry,
        )
        flying_saucer_books = [
            (raw, canonical) for raw, canonical, category, _, _ in flying_saucers if category == "book"
        ]
        self.assertEqual(flying_saucer_books, [("Flying Seucers", "Flying Saucers")])

    def test_extracts_explicit_book_titles_without_reclassifying_project_blue_book(self):
        mentions = extract_mentions(
            "Robert Hastings, author of the book UFOs and Nukes, discussed Project Blue Book. "
            "I bought a book by Stanton Friedman called Top Secret. "
            "A book by a guy called Dr. David Jacobs led to his book called Walking Among Us. "
            "I came across a book titled Mr. Kant is Dead.",
            {},
        )

        books = {(canonical, category) for _, canonical, category, _, _ in mentions if category == "book"}
        self.assertEqual(books, {
            ("UFOs and Nukes", "book"), ("Top Secret", "book"),
            ("Walking Among Us", "book"), ("Mr. Kant is Dead", "book"),
        })
        self.assertNotIn(("Dr. David Jacobs", "book"), books)
        self.assertIn(("Project Blue Book", "program"), {(canonical, category) for _, canonical, category, _, _ in mentions})

    def test_extracts_curated_wikileaks_ufo_entities(self):
        mentions = extract_mentions(
            "Our nonviolent ETI from the contiguous universe are helping bring zero point energy to Earth. "
            "Carol Rosin worked on the Treaty on the Prevention of the Placement of Weapons in Outer Space. "
            "War in Space reporting discussed anti-satellite weapons. "
            "The USAF DSP satellite program tracked Fastwalkers, while Sentry Eagle shared data. "
            "The First International Congress on UFO Phenomenon supported the Grenadian UFO Resolution. "
            "ICUFON asked the Outer Space Committee to study Extraterrestrial Intelligence.",
            {},
        )

        entities = {(canonical, category) for _, canonical, category, _, _ in mentions}
        self.assertTrue({
            ("Nonviolent ETI", "subject"),
            ("Contiguous Universe", "subject"),
            ("Zero-Point Energy", "subject"),
            ("Treaty on the Prevention of the Placement of Weapons in Outer Space", "subject"),
            ("War in Space", "subject"),
            ("Anti-Satellite Weapons", "subject"),
            ("Defense Support Program", "program"),
            ("Fastwalker", "program"),
            ("Sentry Eagle", "program"),
            ("First International Congress on the UFO Phenomenon", "organization"),
            ("Grenadian UFO Resolution", "subject"),
            ("Intercontinental UFO Galactic Spacecraft-Research and Analytic Network", "organization"),
            ("UN Committee on the Peaceful Uses of Outer Space", "government_agency"),
            ("Extraterrestrial Intelligence", "subject"),
        }.issubset(entities))
        self.assertNotIn(("Extraterrestrial Intelligence", "organization"), entities)

    def test_preserves_initials_and_ignores_declassification_boilerplate(self):
        segments = list(sentence_segments(
            "Scientific Study of Unidentified Flying Objects, E.U. Condon, published in New York.\n"
            "Sheryl P. Walter Declassified/Released US Department of State EO Systematic Review 20 Mar 2014"
        ))

        self.assertEqual(segments, [
            "Scientific Study of Unidentified Flying Objects, E.U. Condon, published in New York.",
        ])


class CatalogTests(unittest.TestCase):
    def test_publishes_single_explicit_book_mentions_with_high_confidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": "source.pdf", "source_bytes": 100}
            body = "Robert Hastings is the author of the book UFOs and Nukes. Federal Bureau of Investigation reviewed it."
            (collection / "source.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 1, 100, require_data=True)
            book = next(entity for entity in catalog["entities"] if entity["category"] == "book")

            self.assertEqual(book["canonicalName"], "UFOs and Nukes")
            self.assertEqual(book["mentions"], 1)
            self.assertGreaterEqual(book["classificationConfidence"], 0.95)
            self.assertEqual(catalog["counts"]["publishedBooks"], 1)

    def test_reads_supported_sources_and_keeps_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory) / "relationship-graph-builder"
            root = workspace / "_machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            for number in (1, 2):
                metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": f"source-{number}.pdf", "source_bytes": 100}
                body = "Federal Bureau of Investigation worked with Kelly Johnson in Roswell.\nKelly Johnson discussed UFO reports from Roswell.\n"
                (collection / f"source-{number}.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")
            output = root / "catalog.json"
            catalog = build(root, output, 100, 100, "ufo-files/machine-data", "abc123", True)
            self.assertEqual(catalog["counts"]["documents"], 2)
            self.assertEqual(catalog["input"]["rootName"], "machine-data")
            self.assertEqual(catalog["input"]["repository"], "ufo-files/machine-data")
            self.assertEqual(catalog["input"]["revision"], "abc123")
            entity = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Kelly Johnson")
            location = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Roswell")
            self.assertEqual(entity["sourceMetrics"]["Example"]["mentions"], entity["mentions"])
            self.assertEqual(entity["sourceMetrics"]["Example"]["documentCount"], entity["documentCount"])
            self.assertTrue(all(edge["evidence"] for edge in catalog["edges"]))
            self.assertTrue(all(edge["sourceMetrics"]["Example"]["evidenceCount"] == edge["evidenceCount"] for edge in catalog["edges"]))
            self.assertEqual(location["geo"], {"lat": 33.3943, "lon": -104.523, "precision": "city"})
            self.assertEqual(catalog["counts"]["mappedLocations"], 1)
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
            self.assertEqual(entity["inflatedDocumentCount"], 2)
            self.assertAlmostEqual(entity["documentInflationRate"], 0.667)
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
