import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_catalog import Candidate, attach_event_entities, build, classify_phrase, comparison_key, curated_events, duplicate_candidates, entity_key, extract_mentions, extract_title_mentions, inflation_risk, load_registry, merge_events, normalized_date, overlay_curated_events, reviewed_event_titles, sentence_segments, stable_id, temporal_candidates


class ClassificationTests(unittest.TestCase):
    def test_normalizes_only_valid_unambiguous_dates(self):
        self.assertEqual(normalized_date("November 8, 1975"), "1975-11-08")
        self.assertEqual(normalized_date("8 November 1975"), "1975-11-08")
        self.assertEqual(normalized_date("Nov 8, 1975"), "1975-11-08")
        self.assertIsNone(normalized_date("November 1975"))
        self.assertIsNone(normalized_date("February 30, 1975"))

    def test_temporal_candidates_separate_events_documents_and_foia_dates(self):
        segments = [
            "Date: November 10, 1975 memorandum concerning regional activity.",
            "The object was observed near the base on November 8, 1975 by two witnesses.",
            "FOIA request released on March 20, 2014 after systematic review.",
            "The report also mentions January 3, 1962 without describing an occurrence.",
        ]

        document_date, events, review = temporal_candidates(segments, {}, "doc-test")

        self.assertEqual(document_date["value"], "1975-11-10")
        self.assertEqual(document_date["method"], "document-header")
        self.assertEqual([(event["startDate"], event["eventType"]) for event in events], [("1975-11-08", "sighting")])
        kinds = {candidate["value"]: candidate["kind"] for candidate in review}
        self.assertEqual(kinds["2014-03-20"], "administrative_date")
        self.assertEqual(kinds["1962-01-03"], "unknown")

    def test_temporal_candidates_reject_bibliography_and_generic_observation_dates(self):
        segments = [
            'The bibliography lists "Flying Saucers," August 11, 1952.',
            "The histogram of intercorrelations was observed on September 11, 2001.",
            "The luminous object was observed on September 12, 2001 near the base.",
        ]

        _, events, review = temporal_candidates(segments, {}, "doc-test")

        self.assertEqual([event["startDate"] for event in events], ["2001-09-12"])
        kinds = {candidate["value"]: candidate["kind"] for candidate in review}
        self.assertEqual(kinds["1952-08-11"], "unknown")
        self.assertEqual(kinds["2001-09-11"], "unknown")

    def test_temporal_candidates_exclude_access_dates_references_and_ranges(self):
        segments = [
            "The incident occurred constantly across squadrons (accessed on 24 July 2019).",
            "Subject: Objects Sighted Over Oak Ridge, report dated 13 October 1950.",
            "The military activity occurred after July 8, 1947 according to the report.",
            "The action occurred between April 6, 1917 and a later date.",
            "Unidentified radar tracks were observed 9-10 March 1958 near the coast.",
            "The original recorded radar tape of JAL flight 1628, November 17, 1986, is preserved.",
            'The Times of February 28, 2004 published the article "The Aliens have landed."',
            "The object disappeared quickly. Message taken 3 November 1999.",
            "Investigators first learned of the incident on February 28, 1981 during a lecture.",
            "TESS launched on April 18, 2018 aboard a SpaceX Falcon 9 rocket.",
            "His death occurred on January 7, 1943 after a brief illness.",
            "The sightings occurred between May 17 and July 12, 1947 according to the summary.",
            "The incident occurred on March 17, 2017 during a coalition airstrike in Mosul.",
            '"Phenomena Observed Near the Channel Islands, April 23 2007" was drafted for publication.',
            "A suspicious incident occurred on July 4, 2006 when a visitor arrived at the house.",
        ]

        _, events, review = temporal_candidates(segments, {}, "doc-test")

        self.assertEqual(events, [])
        kinds = {candidate["value"]: candidate["kind"] for candidate in review}
        self.assertEqual(kinds["2019-07-24"], "administrative_date")
        self.assertEqual(kinds["1950-10-13"], "referenced_document_date")
        self.assertEqual(kinds["1947-07-08"], "relative_date")
        self.assertEqual(kinds["1917-04-06"], "relative_date")
        self.assertNotIn("1958-03-10", kinds)
        self.assertEqual(kinds["1986-11-17"], "unknown")
        self.assertEqual(kinds["2004-02-28"], "administrative_date")
        self.assertEqual(kinds["1999-11-03"], "administrative_date")
        self.assertEqual(kinds["1981-02-28"], "unknown")
        self.assertEqual(kinds["2018-04-18"], "unknown")
        self.assertEqual(kinds["1943-01-07"], "unknown")
        self.assertEqual(kinds["1947-07-12"], "relative_date")
        self.assertEqual(kinds["2017-03-17"], "non_ufo_event")
        self.assertEqual(kinds["2007-04-23"], "administrative_date")
        self.assertEqual(kinds["2006-07-04"], "unknown")

    def test_publishes_uap_disclosure_and_official_report_milestones(self):
        segments = list(sentence_segments(
            "On Saturday, December 16, 2017, their story about the Pentagon UFO program appeared online.\n"
            "AARO Historical Record Report cleared for open publication March 6, 2024.\n"
            "An unrelated newspaper article was published on May 4, 2020."
        ))

        _, events, review = temporal_candidates(segments, {}, "doc-milestones")

        self.assertEqual(
            [(event["startDate"], event["eventType"]) for event in events],
            [("2017-12-16", "publication"), ("2024-03-06", "official_report")],
        )
        self.assertEqual(
            next(item for item in review if item["value"] == "2020-05-04")["kind"],
            "administrative_date",
        )

    def test_merges_only_similar_same_day_event_reports(self):
        events = [
            {"id": "a", "title": "Witnesses observed a bright disc over Roswell", "eventType": "sighting", "startDate": "1947-07-08", "confidence": .9, "documentIds": ["doc-a"], "evidence": [{"documentId": "doc-a", "excerpt": "A"}]},
            {"id": "b", "title": "Witnesses observed a bright disc over Roswell.", "eventType": "sighting", "startDate": "1947-07-08", "confidence": .9, "documentIds": ["doc-b"], "evidence": [{"documentId": "doc-b", "excerpt": "B"}]},
            {"id": "c", "title": "A separate object was sighted above Seattle", "eventType": "sighting", "startDate": "1947-07-08", "confidence": .9, "documentIds": ["doc-c"], "evidence": [{"documentId": "doc-c", "excerpt": "C"}]},
        ]

        merged = merge_events(events)

        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]["documentIds"], ["doc-a", "doc-b"])
        self.assertEqual(merged[0]["documentCount"], 2)
        self.assertEqual(merged[1]["documentIds"], ["doc-c"])

    def test_extracted_events_require_reviewed_public_titles(self):
        events = [
            {"id": "approved", "title": "Detroft, whi reoported", "eventType": "sighting", "startDate": "1954-07-14"},
            {"id": "rejected", "title": "Raw OCR", "eventType": "sighting", "startDate": "1954-08-16"},
            {"id": "curated", "title": "Roswell UFO Crash", "eventType": "crash", "startDate": "1947-07-08", "reviewStatus": "curated"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            reviews = Path(directory) / "reviews.json"
            reviews.write_text(json.dumps({"events": {"approved": "Detroit Flying Saucer Sighting", "rejected": None}}), encoding="utf-8")

            published = reviewed_event_titles(events, reviews)

        self.assertEqual([event["title"] for event in published], ["Detroit Flying Saucer Sighting", "Roswell UFO Crash"])
        self.assertEqual(published[0]["titleReviewStatus"], "reviewed")

    def test_curated_milestones_require_a_present_source_document(self):
        with tempfile.TemporaryDirectory() as directory:
            registry = Path(directory) / "events.json"
            registry.write_text(json.dumps({"events": [
                {"title": "AARO publishes a report", "startDate": "2024-03-06",
                 "eventType": "official_report", "sourcePath": "AARO/report.txt",
                 "evidence": "Cleared for publication March 6, 2024."},
                {"title": "Missing source", "startDate": "2024-04-01",
                 "eventType": "official_report", "sourcePath": "missing.txt"},
            ]}), encoding="utf-8")

            events = curated_events(registry, {"AARO/report.txt": "doc-report"})

            self.assertEqual(len(events), 1)
            self.assertEqual(events[0]["documentIds"], ["doc-report"])
            self.assertEqual(events[0]["reviewStatus"], "curated")

    def test_curated_milestone_aggregates_same_date_reviewed_contexts(self):
        with tempfile.TemporaryDirectory() as directory:
            registry = Path(directory) / "events.json"
            registry.write_text(json.dumps({"events": [{
                "title": "Roswell announcement", "startDate": "1947-07-08",
                "eventType": "official_announcement", "sourcePath": "Roswell/source.txt",
                "evidence": "Roswell reported recovery.", "matchTerms": ["Roswell"],
            }]}), encoding="utf-8")
            review = [
                {"documentId": "doc-support", "path": "Archive/roswell-report.txt", "candidates": [
                    {"value": "1947-07-08", "kind": "unknown", "segment": 2, "evidence": "Roswell issued a statement."}
                ]},
                {"documentId": "doc-admin", "path": "Archive/roswell-foia.txt", "candidates": [
                    {"value": "1947-07-08", "kind": "administrative_date", "evidence": "Roswell FOIA processing date."}
                ]},
            ]

            events = curated_events(registry, {"Roswell/source.txt": "doc-source"}, review)

            self.assertEqual(events[0]["documentIds"], ["doc-source", "doc-support"])
            self.assertEqual(events[0]["evidence"][1]["segment"], 2)
            self.assertEqual(events[0]["mentionCount"], 1)


    def test_curated_milestone_replaces_matching_extraction(self):
        extracted = [{"id": "auto", "title": "Raw OCR", "startDate": "2017-12-16",
                      "eventType": "publication", "documentIds": ["doc-story"],
                      "evidence": [{"documentId": "doc-story", "excerpt": "Raw"}]}]
        reviewed = [{"id": "curated", "title": "Reviewed title", "startDate": "2017-12-16",
                     "eventType": "publication", "documentIds": ["doc-story"],
                     "evidence": [{"documentId": "doc-story", "excerpt": "Reviewed"}]}]

        events = overlay_curated_events(extracted, reviewed)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["id"], "curated")
        self.assertEqual(len(events[0]["evidence"]), 2)

    def test_events_receive_specific_entities_from_their_evidence(self):
        roswell = Candidate("Roswell", "location", curated=True)
        ufo = Candidate("UFO", "subject", curated=True)
        published = {"location:roswell": roswell, "subject:ufo": ufo}
        events = [{"title": "Roswell incident", "evidence": [
            {"documentId": "doc-a", "segment": 4, "excerpt": "A UFO was observed near Roswell."}
        ]}]

        attach_event_entities(
            events,
            {"doc-a:4": ["location:roswell", "subject:ufo"]},
            {"doc-a": ["location:roswell"]},
            {},
            published,
            {"location:roswell": "ent-roswell", "subject:ufo": "ent-ufo"},
        )

        self.assertEqual(events[0]["entityIds"], ["ent-roswell"])

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

    def test_rejects_role_prefixed_non_people(self):
        for phrase in ("General Aviation", "General Electric", "General Relativity", "General Motors", "General Counsel"):
            with self.subTest(phrase=phrase):
                self.assertIsNone(classify_phrase(phrase))

    def test_extracts_only_curated_entities_from_titles(self):
        registry = {
            comparison_key("Avi Loeb"): ("Avi Loeb", "person"),
            comparison_key("Lue Elizondo"): ("Luis Elizondo", "person"),
            comparison_key("Flying Saucers"): ("Flying Saucers", "book"),
        }

        mentions = extract_title_mentions("Flying Saucers With Avi Loeb And Lue Elizondo", registry)

        self.assertEqual(
            {(canonical, category) for _, canonical, category, _, _ in mentions},
            {("Avi Loeb", "person"), ("Luis Elizondo", "person")},
        )
        self.assertTrue(all(curated for *_, curated in mentions))

    def test_preserves_acronym_duplicate_candidates_before_length_pruning(self):
        left = Candidate("Federal Bureau Investigation", "government_agency", curated=True)
        right = Candidate("FBI", "government_agency", curated=True)

        candidates, total = duplicate_candidates({"left": left, "right": right})

        self.assertEqual(total, 1)
        self.assertEqual(candidates[0]["reason"], "acronym")

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

    def test_extracts_moon_as_a_curated_location(self):
        mentions = extract_mentions(
            "Witnesses described objects on the Moon and across the lunar surface.",
            {},
        )

        moon_mentions = [mention for mention in mentions if mention[1] == "Moon"]
        self.assertEqual({mention[2] for mention in moon_mentions}, {"location"})
        self.assertTrue(all(mention[4] for mention in moon_mentions))

    def test_extracts_far_side_as_a_distinct_curated_lunar_location(self):
        mentions = extract_mentions(
            "A source described the far side of the Moon and later called it the lunar far side.",
            {},
        )

        far_side_mentions = [mention for mention in mentions if mention[1] == "Far Side of the Moon"]
        self.assertEqual({mention[2] for mention in far_side_mentions}, {"location"})
        self.assertTrue(all(mention[4] for mention in far_side_mentions))
        self.assertFalse(any(mention[1] == "Moon" for mention in mentions))

    def test_project_moon_dust_does_not_emit_nested_moon_location(self):
        mentions = extract_mentions("Project Moon Dust was active.", {})

        self.assertEqual(
            mentions,
            [("Project Moon Dust", "Project Moon Dust", "program", 0.99, True)],
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

    def test_extracts_known_roswell_location_from_document_titles(self):
        mentions = extract_title_mentions("Roswell Witness Testimony", {})

        self.assertIn(("Roswell", "location"), {(canonical, category) for _, canonical, category, _, _ in mentions})

    def test_preserves_initials_and_ignores_declassification_boilerplate(self):
        segments = list(sentence_segments(
            "Scientific Study of Unidentified Flying Objects, E.U. Condon, published in New York.\n"
            "Sheryl P. Walter Declassified/Released US Department of State EO Systematic Review 20 Mar 2014"
        ))

        self.assertEqual(segments, [
            "Scientific Study of Unidentified Flying Objects, E.U. Condon, published in New York.",
        ])


class CatalogTests(unittest.TestCase):
    def test_build_publishes_events_and_writes_date_review_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": "report.pdf", "source_bytes": 100}
            body = (
                "Date: November 10, 1975 memorandum concerning the incident.\n"
                "Two officers observed a bright object near Roswell on November 8, 1975.\n"
                "FOIA request released on March 20, 2014 after systematic review.\n"
                "Federal Bureau of Investigation reviewed the Roswell incident."
            )
            (collection / "report.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")
            review_path = Path(directory) / "date_review.json"
            title_review_path = Path(directory) / "event_title_reviews.json"
            _, extracted, _ = temporal_candidates(list(sentence_segments(body)), metadata, stable_id("doc", "Example/report.txt"))
            title_review_path.write_text(json.dumps({"events": {extracted[0]["id"]: "Roswell Bright Object Sighting"}}), encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, date_review_report=review_path, event_title_reviews=title_review_path)

            self.assertEqual(catalog["documents"][0]["documentDate"], "1975-11-10")
            self.assertEqual(catalog["events"][0]["startDate"], "1975-11-08")
            self.assertEqual(catalog["events"][0]["eventType"], "sighting")
            self.assertEqual(catalog["counts"]["datedDocuments"], 1)
            self.assertEqual(catalog["counts"]["publishedEvents"], 1)
            review = json.loads(review_path.read_text(encoding="utf-8"))
            candidates = review["records"][0]["candidates"]
            self.assertIn("administrative_date", {candidate["kind"] for candidate in candidates})

    def test_curated_title_entity_survives_the_publication_cutoff(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            metadata = {
                "schema": "ufo-files-archive-ocr/v1",
                "source_file": "An Interview With Avi Loeb.mp4",
                "source_bytes": 100,
            }
            body = "Federal Bureau of Investigation reviewed Roswell reports in New Mexico."
            (collection / "source.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 1, 100, require_data=True)

            self.assertEqual([entity["canonicalName"] for entity in catalog["entities"]], ["Avi Loeb"])
            self.assertEqual(catalog["entities"][0]["evidence"][0]["excerpt"], "Document title: An Interview With Avi Loeb")
            self.assertIn("not calibrated probabilities", catalog["publicationPolicy"]["confidenceSemantics"])

    def test_maps_far_side_to_the_anti_earth_lunar_hemisphere(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": "source.pdf", "source_bytes": 100}
            body = "Researchers compared the far side of the Moon with the lunar far side."
            (collection / "source.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, require_data=True)
            far_side = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Far Side of the Moon")

            self.assertEqual(far_side["category"], "location")
            self.assertEqual(far_side["geo"], {
                "lat": 0,
                "lon": 180,
                "body": "moon",
                "precision": "selenographic-region",
            })

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
