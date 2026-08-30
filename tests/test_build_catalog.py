import json
import re
import tempfile
import unittest
from pathlib import Path

from scripts.build_catalog import Candidate, astronomy_observations_for_segment, astronomy_target_summaries, attach_event_entities, build, case_records, classify_phrase, comparison_key, compile_astronomy_taxonomy, coverage_aggregate, craft_class_summaries, craft_measurements, craft_observations_for_segment, curated_discussion_matches, curated_events, duplicate_candidates, entity_key, epistemic_qualifiers_for_segment, extract_mentions, extract_title_mentions, git_blob_sha, inflation_risk, load_epistemic_qualifier_rules, load_registry, machine_data_paths, merge_events, normalized_date, overlay_curated_events, read_language_pair, read_portuguese_pair, reported_event_date_review, reviewed_event_titles, sentence_segments, significance_metrics, signal_frequency_summaries, signal_observations_for_segment, source_lineage_assignments, source_title_from_path, species_class_summaries, species_observations_for_segment, stable_id, temporal_candidates, validate_claim_source_blobs, write_document_shards


class ClassificationTests(unittest.TestCase):
    def craft_taxonomy(self):
        path = Path(__file__).resolve().parents[1] / "data" / "craft_taxonomy.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def species_taxonomy(self):
        path = Path(__file__).resolve().parents[1] / "data" / "species_taxonomy.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def astronomy_taxonomy(self):
        path = Path(__file__).resolve().parents[1] / "data" / "astronomy_taxonomy.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def test_astronomy_taxonomy_counts_direct_references_and_gates_ambiguous_names(self):
        taxonomy = self.astronomy_taxonomy()
        self.assertEqual(len(taxonomy["targets"]), 41)
        compiled = compile_astronomy_taxonomy(taxonomy)
        self.assertIn("io", compiled["triggerTokens"])
        self.assertNotIn("the", compiled["triggerTokens"])
        self.assertNotIn("of", compiled["triggerTokens"])
        clear, clear_review = astronomy_observations_for_segment(
            "The account names Alpha Centauri, the Moon, and planet Mars.",
            "doc-clear", "Example", 1, taxonomy, compiled,
        )
        ambiguous, ambiguous_review = astronomy_observations_for_segment(
            "Project Mars reviewed the Vega procurement record.",
            "doc-ambiguous", "Example", 2, taxonomy, compiled,
        )

        self.assertEqual({item["name"] for item in clear}, {"Alpha Centauri", "Moon", "Mars"})
        self.assertFalse(clear_review)
        self.assertFalse(ambiguous)
        self.assertEqual({item["name"] for item in ambiguous_review}, {"Mars", "Vega"})
        self.assertEqual(
            {item["reason"] for item in ambiguous_review},
            {"reviewed-non-astronomical-context", "missing-reviewed-astronomical-context"},
        )

        contextual, contextual_review = astronomy_observations_for_segment(
            "The astronomer who discovered Neptune compared distant galaxies with Andromeda.",
            "doc-context", "Example", 3, taxonomy, compiled,
        )
        self.assertEqual({item["name"] for item in contextual}, {"Neptune", "Andromeda Galaxy"})
        self.assertFalse(contextual_review)

        io_match, io_review = astronomy_observations_for_segment(
            "Jupiter's moon Io has an active surface.", "doc-io", "Example", 4, taxonomy, compiled,
        )
        io_ambiguous, io_ambiguous_review = astronomy_observations_for_segment(
            "The IO module completed its operation.", "doc-io-module", "Example", 5, taxonomy, compiled,
        )
        self.assertIn("Io", {item["name"] for item in io_match})
        self.assertNotIn("Moon", {item["name"] for item in io_match})
        self.assertEqual([(item["name"], item["reason"]) for item in io_review], [
            ("Moon", "missing-reviewed-astronomical-context"),
        ])
        self.assertFalse(io_ambiguous)
        self.assertEqual([item["name"] for item in io_ambiguous_review], ["Io"])

        isolated_io, isolated_io_review = astronomy_observations_for_segment(
            "Scientists measured the orbit of Io.", "doc-isolated-io", "Example", 6, taxonomy, compiled,
        )
        self.assertEqual([item["name"] for item in isolated_io], ["Io"])
        self.assertFalse(isolated_io_review)

        possessive, possessive_review = astronomy_observations_for_segment(
            "Earth's orbit is elliptical and Mercury's orbit is eccentric.",
            "doc-possessive-planets", "Example", 7, taxonomy, compiled,
        )
        self.assertEqual({item["name"] for item in possessive}, {"Earth", "Mercury"})
        self.assertFalse(possessive_review)

    def test_astronomy_recovers_82_eridani_and_catalog_identifiers(self):
        taxonomy = self.astronomy_taxonomy()
        compiled = compile_astronomy_taxonomy(taxonomy)

        observations = []
        for index, text in enumerate(("82 Eridani.", "The star catalog identifies HD 20794."), 1):
            matches, review = astronomy_observations_for_segment(
                text, f"doc-{index}", "Area52-Investigations", index, taxonomy, compiled,
            )
            self.assertFalse(review)
            observations.extend(matches)

        self.assertEqual([item["targetId"] for item in observations], ["82_eridani", "82_eridani"])
        summary = astronomy_target_summaries(taxonomy, observations)[0]
        self.assertEqual(summary["name"], "82 Eridani")
        self.assertEqual(summary["mentionCount"], 2)
        self.assertEqual(summary["documentCount"], 2)
        self.assertEqual(summary["position"], {
            "frame": "ICRS",
            "raDegrees": 49.981879,
            "decDegrees": -43.069782,
            "distanceLightYears": 19.7044,
        })

    def test_astronomy_context_and_exclusions_are_scoped_to_the_matched_occurrence(self):
        taxonomy = self.astronomy_taxonomy()
        compiled = compile_astronomy_taxonomy(taxonomy)
        saturn, saturn_review = astronomy_observations_for_segment(
            "The planet Saturn has rings.", "doc-saturn", "Example", 0, taxonomy, compiled,
            context_segments=["The planet Saturn has rings.", "The Saturn V rocket launched."],
            context_segment_index=0,
        )
        self.assertEqual([item["name"] for item in saturn], ["Saturn"])
        self.assertFalse(saturn_review)

        mixed, mixed_review = astronomy_observations_for_segment(
            "Planet Saturn has rings, while the Saturn V rocket launched.",
            "doc-mixed-saturn", "Example", 0, taxonomy, compiled,
        )
        self.assertEqual([item["name"] for item in mixed], ["Saturn"])
        self.assertEqual([(item["name"], item["reason"]) for item in mixed_review], [
            ("Saturn", "reviewed-non-astronomical-context"),
        ])

        neighboring = ["Vega reviewed procurement.", "The star Vega is bright."]
        ordinary, ordinary_review = astronomy_observations_for_segment(
            neighboring[0], "doc-vega-ordinary", "Example", 0, taxonomy, compiled,
            context_segments=neighboring, context_segment_index=0,
        )
        astronomical, astronomical_review = astronomy_observations_for_segment(
            neighboring[1], "doc-vega-star", "Example", 1, taxonomy, compiled,
            context_segments=neighboring, context_segment_index=1,
        )
        self.assertFalse(ordinary)
        self.assertEqual([(item["name"], item["reason"]) for item in ordinary_review], [
            ("Vega", "missing-reviewed-astronomical-context"),
        ])
        self.assertEqual([item["name"] for item in astronomical], ["Vega"])
        self.assertFalse(astronomical_review)

        mixed_clause, mixed_clause_review = astronomy_observations_for_segment(
            "Vega reviewed procurement while the orbit of Mars was discussed.",
            "doc-vega-mars-clauses", "Example", 2, taxonomy, compiled,
        )
        self.assertEqual([item["name"] for item in mixed_clause], ["Mars"])
        self.assertEqual([(item["name"], item["reason"]) for item in mixed_clause_review], [
            ("Vega", "missing-reviewed-astronomical-context"),
        ])

        coordinated, coordinated_review = astronomy_observations_for_segment(
            "Vega reviewed procurement and Jupiter is the largest planet.",
            "doc-vega-jupiter-coordinated", "Example", 3, taxonomy, compiled,
        )
        self.assertEqual([item["name"] for item in coordinated], ["Jupiter"])
        self.assertEqual([(item["name"], item["reason"]) for item in coordinated_review], [
            ("Vega", "missing-reviewed-astronomical-context"),
        ])

        coordinated_orbit, coordinated_orbit_review = astronomy_observations_for_segment(
            "Vega reviewed procurement and the orbit of Mars was discussed.",
            "doc-vega-mars-coordinated-orbit", "Example", 4, taxonomy, compiled,
        )
        self.assertEqual([item["name"] for item in coordinated_orbit], ["Mars"])
        self.assertEqual([(item["name"], item["reason"]) for item in coordinated_orbit_review], [
            ("Vega", "missing-reviewed-astronomical-context"),
        ])

        for document_id, text, target_name in (
            ("doc-jupiter-postpositive", "Jupiter is the largest planet.", "Jupiter"),
            ("doc-saturn-postpositive", "Saturn has rings.", "Saturn"),
            ("doc-sirius-postpositive", "Sirius is the brightest star.", "Sirius"),
        ):
            matches, review = astronomy_observations_for_segment(text, document_id, "Example", 3, taxonomy, compiled)
            self.assertIn(target_name, {item["name"] for item in matches})
            self.assertFalse(review)

    def test_astronomy_matches_reviewed_french_and_portuguese_language_terms(self):
        taxonomy = self.astronomy_taxonomy()
        compiled = compile_astronomy_taxonomy(taxonomy)
        self.assertIn("soleil", compiled["triggerTokens"])
        self.assertIn("lactée", compiled["triggerTokens"])

        for document_id, text, expected_names in (
            ("doc-fr", "Le Soleil éclaire la Lune et la Voie lactée. Jupiter est la plus grande planète.", {"Sun", "Moon", "Milky Way", "Jupiter"}),
            (
                "doc-pt",
                "O Sol ilumina a Lua e a Via Láctea. Saturno é um planeta; Netuno, Urano e Plutão também são planetas. Sírio é uma estrela e Andrômeda é uma galáxia.",
                {"Sun", "Moon", "Milky Way", "Saturn", "Neptune", "Uranus", "Pluto", "Sirius", "Andromeda Galaxy"},
            ),
        ):
            matches, review = astronomy_observations_for_segment(text, document_id, "Example", 0, taxonomy, compiled)
            self.assertTrue(expected_names.issubset({item["name"] for item in matches}))
            self.assertFalse([item for item in review if item["name"] in expected_names])

    def test_astronomy_rejects_program_names_and_lexically_ambiguous_global_context(self):
        taxonomy = self.astronomy_taxonomy()
        compiled = compile_astronomy_taxonomy(taxonomy)
        moon, moon_review = astronomy_observations_for_segment(
            "Project Moon Dust was active.", "doc-moon-dust", "Example", 0, taxonomy, compiled,
        )
        self.assertFalse(moon)
        self.assertEqual([(item["name"], item["reason"]) for item in moon_review], [
            ("Moon", "reviewed-non-astronomical-context"),
        ])

        for document_id, text, target_name in (
            ("doc-star-witness-vega", "The star witness reviewed the Vega procurement record.", "Vega"),
            ("doc-star-witness-titan", "Titan won an award while the star witness testified.", "Titan"),
        ):
            matches, review = astronomy_observations_for_segment(
                text, document_id, "Example", 0, taxonomy, compiled,
            )
            self.assertFalse(matches)
            self.assertEqual([(item["name"], item["reason"]) for item in review], [
                (target_name, "missing-reviewed-astronomical-context"),
            ])

        for document_id, text, target_name in (
            ("doc-down-to-earth", "Bring the discussion down to earth.", "Earth"),
            ("doc-earth-wire", "The earth wire was connected.", "Earth"),
            ("doc-sun-microsystems", "Sun Microsystems released the workstation.", "Sun"),
            ("doc-sun-records", "Sun Records issued the recording.", "Sun"),
            ("doc-baltimore-sun", "The Baltimore Sun published the report.", "Sun"),
            ("doc-the-sun-newspaper", "The Sun newspaper published the story.", "Sun"),
        ):
            matches, review = astronomy_observations_for_segment(text, document_id, "Example", 0, taxonomy, compiled)
            self.assertNotIn(target_name, {item["name"] for item in matches})
            self.assertIn((target_name, "missing-reviewed-astronomical-context"), {
                (item["name"], item["reason"]) for item in review
            })

        explicit, explicit_review = astronomy_observations_for_segment(
            "The planet Earth orbits the Sun.", "doc-earth-sun", "Example", 0, taxonomy, compiled,
        )
        self.assertEqual({item["name"] for item in explicit}, {"Earth", "Sun"})
        self.assertFalse(explicit_review)

    def test_astronomy_gates_generic_moon_and_seven_sisters_aliases(self):
        taxonomy = self.astronomy_taxonomy()
        compiled = compile_astronomy_taxonomy(taxonomy)
        for document_id, text, target_name in (
            ("doc-generic-moon", "Jupiter's moon Io is volcanic.", "Moon"),
            ("doc-oil-sisters", "The Seven Sisters oil companies dominated the industry.", "Pleiades"),
            ("doc-family-sisters", "The seven sisters met for dinner.", "Pleiades"),
        ):
            matches, review = astronomy_observations_for_segment(text, document_id, "Example", 0, taxonomy, compiled)
            self.assertNotIn(target_name, {item["name"] for item in matches})
            self.assertIn((target_name, "missing-reviewed-astronomical-context"), {
                (item["name"], item["reason"]) for item in review
            })

        explicit, explicit_review = astronomy_observations_for_segment(
            "The Moon and the Pleiades were visible beside the Seven Sisters star cluster.",
            "doc-explicit-sky", "Example", 0, taxonomy, compiled,
        )
        self.assertEqual({item["name"] for item in explicit}, {"Moon", "Pleiades"})
        self.assertFalse(explicit_review)

        for document_id, text in (
            ("doc-jupiter-satellite", "Io is the moon of Jupiter."),
            ("doc-mars-satellite", "The moon of Mars is Phobos."),
        ):
            matches, review = astronomy_observations_for_segment(text, document_id, "Example", 1, taxonomy, compiled)
            self.assertNotIn("Moon", {item["name"] for item in matches})
            self.assertIn(("Moon", "reviewed-non-astronomical-context"), {
                (item["name"], item["reason"]) for item in review
            })

    def test_astronomy_excludes_milky_way_candy_brand_uses(self):
        taxonomy = self.astronomy_taxonomy()
        compiled = compile_astronomy_taxonomy(taxonomy)
        for document_id, text in (
            ("doc-milky-way-bar", "She ate a Milky Way bar."),
            ("doc-milky-way-candy", "Milky Way candy sales increased."),
        ):
            matches, review = astronomy_observations_for_segment(text, document_id, "Example", 0, taxonomy, compiled)
            self.assertNotIn("Milky Way", {item["name"] for item in matches})
            self.assertIn(("Milky Way", "reviewed-non-astronomical-context"), {
                (item["name"], item["reason"]) for item in review
            })

        explicit, explicit_review = astronomy_observations_for_segment(
            "The Milky Way Galaxy contains the Solar System.",
            "doc-milky-way-galaxy", "Example", 1, taxonomy, compiled,
        )
        self.assertIn("Milky Way", {item["name"] for item in explicit})
        self.assertFalse([item for item in explicit_review if item["name"] == "Milky Way"])

    def test_astronomy_summaries_publish_reviewed_positions_and_document_counts(self):
        taxonomy = self.astronomy_taxonomy()
        compiled = compile_astronomy_taxonomy(taxonomy)
        observations = []
        for document_id, text in (("a", "Zeta Reticuli and the Moon"), ("b", "Zeta Reticuli")):
            matches, review = astronomy_observations_for_segment(text, document_id, "Example", 1, taxonomy, compiled)
            self.assertFalse(review)
            observations.extend(matches)

        summaries = astronomy_target_summaries(taxonomy, observations)
        zeta = next(item for item in summaries if item["targetId"] == "zeta_reticuli")
        self.assertEqual(zeta["documentCount"], 2)
        self.assertEqual(zeta["mentionCount"], 2)
        self.assertEqual(zeta["observationIds"], [item["id"] for item in observations if item["targetId"] == "zeta_reticuli"])
        self.assertEqual(zeta["position"]["frame"], "ICRS")
        self.assertEqual(next(item for item in summaries if item["targetId"] == "moon")["documentCount"], 1)

    def test_epistemic_qualifiers_are_additive_and_do_not_change_graph_counts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            transcript = collection / "interview-with-avi-loeb.tsv"
            transcript.write_text(
                "start\tend\ttext\n0\t4000\tI haven't seen any evidence that Avi Loeb endorsed the claim.\n",
                encoding="utf-8",
            )
            transcript.with_suffix(".source.json").write_text(json.dumps({
                "schema": "ufo-files-archive-media-transcripts/v1",
                "source_file": "interview-with-avi-loeb.mp4",
                "source_bytes": 128,
                "created_at": "2026-08-24T00:00:00Z",
                "backend": "test",
            }), encoding="utf-8")
            baseline = build(root, Path(directory) / "baseline.json", 100, 100, require_data=True)
            config = root / "config"
            config.mkdir()
            config.joinpath("epistemic_qualifiers.json").write_text(json.dumps({
                "schema": "ufo-files-epistemic-qualifier-rules/v1",
                "policy": "Additive only.",
                "rules": [{"category": "evidence_not_reviewed", "confidence": .98, "evidenceWeight": .25, "pattern": r"\b(i haven't seen any evidence)\b"}],
                "nonClaimFollowupPattern": r"^to pronounce\b",
            }), encoding="utf-8")
            annotated = build(root, Path(directory) / "annotated.json", 100, 100, require_data=True)

            self.assertEqual(annotated["counts"]["documents"], baseline["counts"]["documents"])
            self.assertEqual(annotated["counts"]["candidateEntities"], baseline["counts"]["candidateEntities"])
            self.assertEqual(annotated["entities"][0]["mentions"], baseline["entities"][0]["mentions"])
            self.assertLess(annotated["entities"][0]["epistemicAdjustedMentions"], baseline["entities"][0]["epistemicAdjustedMentions"])
            self.assertFalse(annotated["epistemicQualifiers"]["changesRawCounts"])
            qualifier = annotated["documents"][0]["epistemicQualifiers"][0]
            self.assertEqual(qualifier["category"], "evidence_not_reviewed")
            self.assertEqual(qualifier["reviewStatus"], "candidate")
            self.assertLess(qualifier["evidenceWeight"], 1)
            annotated_evidence = next(item for item in annotated["entities"][0]["evidence"] if item["epistemicQualifiers"])
            self.assertEqual(annotated_evidence["epistemicQualifiers"][0]["qualifier"], "I haven't seen any evidence")

    def test_epistemic_clause_final_qualifier_scopes_the_preceding_claim(self):
        rules = {
            "rules": [{"category": "speaker_inference", "confidence": .72, "evidenceWeight": .75, "compiled": re.compile(r"\b(i believe)\b", re.I)}],
            "nonClaimFollowup": re.compile(r"^to pronounce\b", re.I),
        }
        rows = epistemic_qualifiers_for_segment("So this is footage from Utah, I believe.", 4, rules, "And it was recorded in 4K.")
        self.assertEqual(rows[0]["scope"], "preceding_clause")
        self.assertEqual(rows[0]["claimText"], "So this is footage from Utah")
        self.assertEqual(rows[0]["claimSegment"], 4)

    def test_epistemic_qualifier_weights_only_entities_in_its_clause(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            (collection / "claims.txt").write_text(
                json.dumps({"schema": "ufo-files-archive-ocr/v1", "source_file": "claims.pdf", "source_bytes": 100})
                + "\n\nI believe Avi Loeb guessed; NASA officially confirmed the result.\n"
                + "Avi Loeb and NASA appeared together in the record.",
                encoding="utf-8",
            )
            config = root / "config"
            config.mkdir()
            config.joinpath("epistemic_qualifiers.json").write_text(json.dumps({
                "schema": "ufo-files-epistemic-qualifier-rules/v1",
                "rules": [{"category": "speaker_inference", "confidence": .8, "evidenceWeight": .25, "pattern": r"\b(i believe)\b"}],
                "nonClaimFollowupPattern": r"^to pronounce\b",
            }), encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, require_data=True)

        avi = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Avi Loeb")
        nasa = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "NASA")
        self.assertLess(avi["epistemicAdjustedMentions"], avi["contextAdjustedMentions"])
        self.assertEqual(nasa["epistemicAdjustedMentions"], nasa["contextAdjustedMentions"])
        self.assertFalse(any(edge["epistemicAdjustedEvidenceCount"] < edge["evidenceCount"] for edge in catalog["edges"]))

    def test_epistemic_qualifier_carries_into_its_next_segment_claim(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            transcript = collection / "next-segment-claim.tsv"
            transcript.write_text(
                "start\tend\ttext\n"
                "0\t1000\tI believe.\n"
                "1000\t2000\tAvi Loeb works for NASA near a silent triangular object at 1.6 GHz.\n",
                encoding="utf-8",
            )
            transcript.with_suffix(".source.json").write_text(json.dumps({
                "schema": "ufo-files-archive-media-transcripts/v1",
                "source_file": "next-segment-claim.mp4",
                "source_bytes": 128,
            }), encoding="utf-8")
            config = root / "config"
            config.mkdir()
            config.joinpath("epistemic_qualifiers.json").write_text(json.dumps({
                "schema": "ufo-files-epistemic-qualifier-rules/v1",
                "rules": [{
                    "category": "speaker_inference", "confidence": .8,
                    "evidenceWeight": .25, "pattern": r"\b(i believe)\b",
                }],
                "nonClaimFollowupPattern": r"^to pronounce\b",
            }), encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, require_data=True)

        avi = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Avi Loeb")
        evidence = next(item for item in avi["evidence"] if item["segment"] == "1")
        self.assertLess(avi["epistemicAdjustedMentions"], avi["contextAdjustedMentions"])
        self.assertEqual(evidence["epistemicQualifiers"][0]["scope"], "next_segment_candidate")
        edge = next(item for item in catalog["edges"] if item["relationship"] == "affiliated_with")
        self.assertLess(edge["epistemicAdjustedEvidenceCount"], edge["evidenceCount"])
        self.assertTrue(catalog["craft"]["observations"][0]["epistemicQualifiers"])
        self.assertTrue(catalog["signals"]["observations"][0]["epistemicQualifiers"])

    def test_epistemic_weights_apply_to_retained_contexts_not_raw_mentions(self):
        candidate = Candidate("Example", "subject")
        for index in range(3):
            candidate.add("Example", f"doc-{index}", "Archive", f"doc-{index}:0", "Repeated context", .9, 1.0)
        candidate.add("Example", "doc-distinct", "Archive", "doc-distinct:0", "Distinct qualified context", .9, .2)

        metrics = significance_metrics(candidate)

        self.assertEqual(metrics["contextAdjustedMentions"], 2)
        self.assertEqual(metrics["epistemicAdjustedMentions"], 1.2)

    def test_signal_frequencies_normalize_units_and_retain_literal_evidence(self):
        text = "The team monitored 1.6 GHz, 1600 MHz, 1420 kilohertz, 1000000 Hz, and 1420000000 Hz."

        observations = signal_observations_for_segment(text, "doc-skinwalker", "UPDB-Skinwalker", "paired-segment-7")

        self.assertEqual([item["frequencyHz"] for item in observations], [1_600_000_000, 1_600_000_000, 1_420_000, 1_000_000, 1_420_000_000])
        self.assertEqual(observations[0]["frequencyLabel"], "1.6 GHz")
        self.assertEqual(observations[1]["originalPhrase"], "1600 MHz")
        self.assertEqual(observations[0]["segment"], "paired-segment-7")
        self.assertIn("monitored 1.6 GHz", observations[0]["excerpt"])

    def test_signal_frequencies_recover_unit_elided_microwave_values(self):
        texts = (
            (
                "frequency microwave range and there's a specific signal that you guys "
                "keep receiving in the 1.6"
            ),
            "The microwave signal appeared at 1.6.",
        )

        for text in texts:
            with self.subTest(text=text):
                observations = signal_observations_for_segment(text, "doc-skinwalker", "American-Alchemy", 311)

                self.assertEqual(len(observations), 1)
                self.assertEqual(observations[0]["frequencyHz"], 1_600_000_000)
                self.assertEqual(observations[0]["frequencyLabel"], "1.6 GHz")
                self.assertEqual(observations[0]["originalPhrase"], "1.6")
                self.assertEqual(observations[0]["unitProvenance"], "contextual-microwave-band")

    def test_signal_frequencies_do_not_infer_ghz_from_unrelated_decimal_measurements(self):
        texts = (
            "The microwave signal was measured at 1.6 W/kg.",
            "The microwave carrier produced a beam 1.6 km wide.",
            "High frequency 1.6 to 30 MHz.",
            "The microwave signal appeared in the 1.6.1 section.",
            "The microwave signal was turned off. Playback speed was set at 1.6, according to the player.",
        )

        for text in texts:
            with self.subTest(text=text):
                observations = signal_observations_for_segment(text, "doc-example", "Example", 1)
                self.assertNotIn(1_600_000_000, [item["frequencyHz"] for item in observations])

    def test_signal_frequencies_do_not_infer_ghz_from_explicit_ranges(self):
        for separator in ("-", " - ", "–", "—"):
            text = f"The microwave signal was measured at 1.6{separator}1.7 MHz."
            with self.subTest(separator=separator):
                observations = signal_observations_for_segment(text, "doc-example", "Example", 1)
                self.assertEqual([item["frequencyHz"] for item in observations], [1_700_000])

    def test_signal_summaries_group_equivalent_units_and_count_source_families(self):
        first = signal_observations_for_segment("A signal appeared at 1.6 GHz.", "doc-a", "Skinwalker", 1)
        second = signal_observations_for_segment("The receiver was tuned to 1600 MHz.", "doc-b", "Skinwalker", 2)
        third = signal_observations_for_segment("A separate mention says 1.6 gigahertz.", "doc-c", "Other", 3)

        summaries = signal_frequency_summaries(first + second + third, {"doc-a": "family-a", "doc-b": "family-a", "doc-c": "family-c"})

        self.assertEqual(len(summaries), 1)
        self.assertEqual(summaries[0]["mentionCount"], 3)
        self.assertEqual(summaries[0]["documentCount"], 3)
        self.assertEqual(summaries[0]["sourceCount"], 2)
        self.assertEqual(summaries[0]["independentSourceFamilyCount"], 2)

    def test_signal_summary_ids_preserve_close_frequency_precision(self):
        lower = signal_observations_for_segment("At 1600.000 MHz.", "doc-a", "Example", 1)
        upper = signal_observations_for_segment("At 1600.001 MHz.", "doc-b", "Example", 2)

        summaries = signal_frequency_summaries(lower + upper, {})

        self.assertEqual([item["frequencyHz"] for item in summaries], [1_600_000_000, 1_600_001_000])
        self.assertEqual(len({item["id"] for item in summaries}), 2)

    def test_species_taxonomy_has_grounded_and_corpus_specific_profiles(self):
        taxonomy = self.species_taxonomy()

        self.assertEqual(taxonomy["schema"], "ufo-files-species-taxonomy/v1")
        self.assertEqual(len(taxonomy["classes"]), 86)
        self.assertEqual(len({item["id"] for item in taxonomy["classes"]}), 86)
        self.assertEqual(len(taxonomy["categories"]), 6)
        self.assertEqual(taxonomy["groundingSource"]["role"], "Local taxonomy grounding only; not corpus evidence")
        self.assertEqual(taxonomy["normalizationNotes"][0]["canonical"], "Mothman")
        rigelians = next(item for item in taxonomy["classes"] if item["id"] == "rigelians")
        self.assertEqual(rigelians["label"], "Reptilians")
        self.assertIn("Rigelian", rigelians["aliases"])
        self.assertIn("Reptilians", rigelians["aliases"])
        bledsoe = next(item for item in taxonomy["classes"] if item["id"] == "bledsoe_red_eyed_being")
        skinny_bob = next(item for item in taxonomy["classes"] if item["id"] == "skinny_bob")
        self.assertEqual(bledsoe["groundingType"], "reference")
        self.assertEqual(bledsoe["physicalHeight"]["label"], "4′–5′")
        self.assertEqual(skinny_bob["groundingType"], "corpus")
        self.assertIn("authenticity remain unresolved", skinny_bob["identityNote"])
        self.assertEqual(skinny_bob["physicalHeight"]["label"], "reported 3′6″")
        self.assertEqual(skinny_bob["physicalHeight"]["confidence"], "reported")

    def test_bledsoe_profiles_require_reviewed_source_and_local_context(self):
        taxonomy = self.species_taxonomy()
        lady_text = "An entity that he and the government refers to as the Lady."
        orb_context = ["Those are the orbs that I interact with.", "They're the angelic beings."]

        lady, lady_review = species_observations_for_segment(
            lady_text, "doc-bledsoe", "Area52-Investigations", 1, taxonomy,
        )
        orb_beings, orb_review = species_observations_for_segment(
            orb_context[1], "doc-bledsoe", "Area52-Investigations", 1, taxonomy,
            context_segments=orb_context,
        )
        wrong_source, _ = species_observations_for_segment(
            lady_text, "doc-other", "Example", 1, taxonomy,
        )
        contextless, contextless_review = species_observations_for_segment(
            "The Lady entered the room.", "doc-bledsoe", "Area52-Investigations", 3, taxonomy,
        )

        self.assertEqual(lady_review, [])
        self.assertEqual([item["classId"] for item in lady], ["bledsoe_lady"])
        self.assertEqual([item["classId"] for item in orb_beings], ["orb_light_beings"])
        self.assertEqual(
            next(item for item in taxonomy["classes"] if item["id"] == "orb_light_beings")["label"],
            "Light Beings (Bledsoe account)",
        )
        self.assertEqual(orb_review, [])
        self.assertEqual(wrong_source, [])
        self.assertEqual(contextless, [])
        self.assertEqual(contextless_review[0]["reason"], "missing-reviewed-local-context")

    def test_skinny_bob_mentions_are_area52_scoped_and_publish_reported_height(self):
        taxonomy = self.species_taxonomy()
        context = [
            "Those were four little Skinny Bobs, exactly like the footage.",
            "Three and a half feet tall.",
        ]

        observations, review = species_observations_for_segment(
            context[0], "doc-skinny-bob", "Area52-Investigations", 1, taxonomy,
            context_segments=context,
        )
        paired_observations, _ = species_observations_for_segment(
            context[0], "doc-skinny-bob", "Area52-Investigations", "paired-1", taxonomy,
            context_segments=context, context_segment_index=0,
        )
        outside_source, _ = species_observations_for_segment(
            context[0], "doc-other", "Example", 1, taxonomy,
            context_segments=context,
        )

        self.assertEqual([item["classId"] for item in observations], ["skinny_bob"])
        self.assertEqual(outside_source, [])
        self.assertEqual(review, [])
        self.assertEqual(observations[0]["appearanceEvidence"][0]["descriptors"], ["reported 3′6″ tall"])
        self.assertEqual(paired_observations[0]["segment"], "paired-1")
        self.assertEqual(paired_observations[0]["appearanceEvidence"][0]["contextStartSegment"], 0)
    def test_bledsoe_lady_remains_distinct_from_lady_of_light(self):
        taxonomy = self.species_taxonomy()
        bledsoe, _ = species_observations_for_segment(
            "The entity was called the Lady.",
            "doc-bledsoe", "Area52-Investigations", 1, taxonomy,
        )
        almanac, _ = species_observations_for_segment(
            "The extraterrestrial was called the Lady of Light.",
            "doc-almanac", "Example", 1, taxonomy,
        )

        self.assertEqual([item["classId"] for item in bledsoe], ["bledsoe_lady"])
        self.assertEqual([item["classId"] for item in almanac], ["lady_of_light"])

    def test_bledsoe_lady_publishes_only_reviewed_appearance_language(self):
        taxonomy = self.species_taxonomy()
        context = [
            "It was a lady there and she's glowing a bluish-white color.",
            "She was floating three feet off the ground.",
            "It was this long, white dress, white and sparkly.",
            "She was barefoot.",
            "This whole beautiful lady was as human as me and you.",
        ]
        first, _ = species_observations_for_segment(
            context[0], "doc-bledsoe", "Area52-Investigations", 0, taxonomy,
            context_segments=context,
        )
        second, _ = species_observations_for_segment(
            context[4], "doc-bledsoe", "Area52-Investigations", 4, taxonomy,
            context_segments=context,
        )

        summary = species_class_summaries(taxonomy, first + second)[0]
        evidence = summary["appearanceEvidence"]
        self.assertEqual({item["ruleId"] for item in evidence}, {"glowing_humanoid", "floating_white_dress", "humanlike"})
        self.assertIn("bluish-white color", evidence[0]["excerpt"])

    def test_species_classification_prefers_longest_alias_and_retains_provenance(self):
        taxonomy = self.species_taxonomy()
        observations, review = species_observations_for_segment(
            "The contactee described Renegade Pleiadians as an extraterrestrial race.",
            "doc-species", "Example", 3, taxonomy,
        )
        repeated, _ = species_observations_for_segment(
            "The contactee described Renegade Pleiadians as an extraterrestrial race.",
            "doc-species", "Example", 3, taxonomy,
        )

        self.assertEqual(review, [])
        self.assertEqual([item["classId"] for item in observations], ["renegade_pleiadians"])
        self.assertEqual(observations[0]["originalPhrase"], "Renegade Pleiadians")
        self.assertEqual(observations[0]["id"], repeated[0]["id"])

    def test_species_appearance_evidence_requires_a_reviewed_descriptor_rule(self):
        taxonomy = self.species_taxonomy()
        context = [
            "Earlier discussion.",
            "A witness reported an encounter.",
            "He says he was abducted by Pleiadian type",
            "So tall, sort of like blondish characters.",
            "The account then moves on.",
        ]
        observations, _ = species_observations_for_segment(
            context[2], "doc-appearance", "Example", 2, taxonomy, context_segments=context,
        )

        self.assertEqual(len(observations), 1)
        appearance = observations[0]["appearanceEvidence"]
        self.assertEqual(appearance[0]["descriptors"], ["tall", "blondish"])
        self.assertIn("Pleiadian type", appearance[0]["excerpt"])
        self.assertIn("tall, sort of like blondish characters", appearance[0]["excerpt"])

        name_only, _ = species_observations_for_segment(
            "Celestial beings are extraterrestrial.", "doc-name-only", "Example", 0, taxonomy,
        )
        self.assertNotIn("appearanceEvidence", name_only[0])

    def test_species_appearance_excerpt_preserves_normalized_support_phrases(self):
        taxonomy = self.species_taxonomy()
        context = [
            "Unrelated preface. " * 100,
            "The Venusian aliens were discussed.",
            "Witnesses called them human looking aliens.",
        ]
        observations, _ = species_observations_for_segment(
            context[1], "doc-normalized-appearance", "Example", 1, taxonomy, context_segments=context,
        )

        appearance = observations[0]["appearanceEvidence"]
        humanlike = next(item for item in appearance if item["ruleId"] == "human_looking")
        self.assertIn("Venusian aliens", humanlike["excerpt"])
        self.assertIn("human looking aliens", humanlike["excerpt"])
        self.assertLessEqual(len(humanlike["excerpt"]), 900)

    def test_species_appearance_evidence_rejects_support_that_cannot_fit_one_excerpt(self):
        taxonomy = self.species_taxonomy()
        context = [
            "The Venusian aliens were discussed.",
            "Unrelated material. " * 100,
            "Witnesses called them human looking aliens.",
        ]
        observations, _ = species_observations_for_segment(
            context[0], "doc-distant-appearance", "Example", 0, taxonomy, context_segments=context,
        )

        self.assertEqual(observations[0]["appearanceEvidence"], [])

    def test_species_common_names_require_extraterrestrial_context(self):
        taxonomy = self.species_taxonomy()
        ordinary, review = species_observations_for_segment(
            "The Men in Black film premiered downtown.", "doc-ordinary", "Example", 1, taxonomy,
        )
        contextual, contextual_review = species_observations_for_segment(
            "The alien Men in Black were described as an extraterrestrial race.", "doc-context", "Example", 2, taxonomy,
        )

        self.assertEqual(ordinary, [])
        self.assertEqual(review[0]["reason"], "missing-extraterrestrial-context")
        self.assertEqual(contextual_review, [])
        self.assertEqual(contextual[0]["classId"], "men_in_black")

        adjective, adjective_review = species_observations_for_segment(
            "The policy was draconian and unpopular.", "doc-adjective", "Example", 3, taxonomy,
        )
        self.assertEqual(adjective, [])
        self.assertEqual(adjective_review[0]["classId"], "draconians")

        distant, distant_review = species_observations_for_segment(
            "alien " + ("unrelated discussion " * 20) + "draconian policy",
            "doc-distant", "Example", 4, taxonomy,
        )
        self.assertEqual(distant, [])
        self.assertEqual(distant_review[0]["reason"], "missing-extraterrestrial-context")

    def test_species_summaries_publish_only_corpus_backed_profiles(self):
        taxonomy = self.species_taxonomy()
        observations, _ = species_observations_for_segment(
            "Pleiadians and Arcturians were named as extraterrestrial beings.", "doc-one", "Example", 1, taxonomy,
        )
        summaries = species_class_summaries(taxonomy, observations)

        self.assertEqual({item["classId"] for item in summaries}, {"pleiadians", "arcturians"})
        self.assertTrue(all(item["documentCount"] == 1 for item in summaries))
        by_class = {item["classId"]: item for item in summaries}
        self.assertEqual(by_class["pleiadians"]["physicalHeight"]["label"], "5′9″–8′")
        self.assertEqual(by_class["arcturians"]["physicalHeight"]["label"], "10′–12′")
        self.assertEqual(by_class["arcturians"]["physicalHeight"]["representativeFeet"], 11.0)

    def test_species_summaries_publish_reviewed_appearance_evidence_and_grounding_separately(self):
        taxonomy = self.species_taxonomy()
        context = [
            "He says he was abducted by Pleiadian type",
            "So tall, sort of like blondish characters.",
        ]
        observations, _ = species_observations_for_segment(
            context[0], "doc-appearance", "Example", 0, taxonomy, context_segments=context,
        )
        summary = species_class_summaries(taxonomy, observations)[0]

        self.assertEqual(summary["appearanceEvidenceCount"], 1)
        self.assertEqual(summary["appearanceEvidence"][0]["reviewStatus"], "reviewed")
        self.assertIn("Nordic-appearing", summary["groundingAppearance"])

    def test_species_summaries_collapse_overlapping_appearance_passages(self):
        taxonomy = self.species_taxonomy()
        context = [
            "He says he was abducted by Pleiadian type.",
            "So tall, sort of like blondish characters.",
            "The Pleiadians were mentioned again.",
        ]
        first, _ = species_observations_for_segment(
            context[0], "doc-overlap", "Example", 0, taxonomy, context_segments=context,
        )
        second, _ = species_observations_for_segment(
            context[2], "doc-overlap", "Example", 2, taxonomy, context_segments=context,
        )
        summary = species_class_summaries(taxonomy, first + second)[0]

        self.assertEqual(summary["appearanceEvidenceCount"], 1)
        self.assertEqual(len(summary["appearanceEvidence"]), 1)

    def test_grey_height_represents_all_three_grounded_subtypes(self):
        taxonomy = self.species_taxonomy()
        greys = next(item for item in taxonomy["classes"] if item["id"] == "greys")

        self.assertEqual(greys["physicalHeight"]["label"], "4′–12′")
        self.assertAlmostEqual(greys["physicalHeight"]["representativeFeet"], 7.4167)

    def test_researched_species_heights_preserve_scope_and_citations(self):
        taxonomy = self.species_taxonomy()
        by_id = {item["id"]: item for item in taxonomy["classes"]}

        self.assertEqual(by_id["anunnaki"]["physicalHeight"]["label"], "8′–12′")
        self.assertEqual(by_id["anunnaki"]["physicalHeight"]["representativeFeet"], 10.0)
        self.assertEqual(by_id["lyrans"]["physicalHeight"]["label"], "6′–9′")
        self.assertEqual(by_id["rigelians"]["physicalHeight"]["label"], "6′–8′")
        for class_id in ("anunnaki", "lyrans", "rigelians"):
            height = by_id[class_id]["physicalHeight"]
            self.assertEqual(height["evidenceScope"], "modern-ufo-literature")
            self.assertTrue(height["sources"])
            self.assertTrue(all(source["url"].startswith("https://") for source in height["sources"]))

    def test_source_lineage_groups_an_explicit_direct_citation(self):
        families, assignments = source_lineage_assignments([
            {"id": "origin", "title": "Alpha Source Report", "segments": ["The original witness account describes a bright object above the field."], "metadata": {}, "documentDate": "1990-01-01"},
            {"id": "coverage", "title": "Later Coverage", "segments": ["According to Alpha Source Report, the witness described a bright object above the field."], "metadata": {}, "documentDate": "1995-01-01"},
        ])

        self.assertEqual(assignments["origin"]["id"], assignments["coverage"]["id"])
        self.assertEqual(assignments["coverage"]["method"], "direct_citation")
        self.assertEqual(families[0]["status"], "inferred")
        self.assertEqual(assignments["coverage"]["evidence"][0]["signal"], "direct_citation")

    def test_source_lineage_groups_near_duplicate_evidence_without_altering_text(self):
        original = "The pilot observed a silent triangular object above the western ridge before it accelerated vertically and disappeared from sight."
        derivative = "The pilot observed a silent triangular object above the western ridge before it accelerated rapidly and disappeared from sight."
        families, assignments = source_lineage_assignments([
            {"id": "one", "title": "First Account", "segments": [original], "metadata": {}, "documentDate": "2001-01-01"},
            {"id": "two", "title": "Second Account", "segments": [derivative], "metadata": {}, "documentDate": "2002-01-01"},
        ])

        self.assertEqual(len(families), 1)
        self.assertEqual(assignments["two"]["method"], "near_duplicate")
        self.assertIn(original, {assignments["one"]["evidence"][0]["excerpt"], assignments["one"]["evidence"][0].get("relatedExcerpt")})
        self.assertIn(derivative, {assignments["two"]["evidence"][0]["excerpt"], assignments["two"]["evidence"][0].get("relatedExcerpt")})

    def test_source_lineage_groups_a_shared_named_origin(self):
        families, assignments = source_lineage_assignments([
            {"id": "one", "title": "Morning Edition", "segments": ["Originally published by Associated Press Newsroom. A witness reported a light."], "metadata": {}},
            {"id": "two", "title": "Evening Edition", "segments": ["Source: Associated Press Newsroom. The account was carried later that day."], "metadata": {}},
        ])

        self.assertEqual(len(families), 1)
        self.assertEqual(assignments["one"]["id"], assignments["two"]["id"])
        self.assertEqual(assignments["two"]["method"], "shared_origin")

    def test_source_lineage_requires_an_origin_cue_for_shared_urls(self):
        families, assignments = source_lineage_assignments([
            {"id": "privacy-one", "title": "First Archive Item", "segments": ["Privacy policy https://example.test/legal/privacy. First unrelated note."], "metadata": {}},
            {"id": "privacy-two", "title": "Second Archive Item", "segments": ["Visit https://example.test/legal/privacy for site terms. Second unrelated note."], "metadata": {}},
            {"id": "source-one", "title": "Source Copy One", "segments": ["Source: https://example.test/reports/original-account. First source copy."], "metadata": {}},
            {"id": "source-two", "title": "Source Copy Two", "segments": ["Origin URL: https://example.test/reports/original-account. Second source copy."], "metadata": {}},
        ])

        self.assertNotEqual(assignments["privacy-one"]["id"], assignments["privacy-two"]["id"])
        self.assertEqual(assignments["source-one"]["id"], assignments["source-two"]["id"])
        self.assertEqual(assignments["source-two"]["method"], "shared_origin")
        self.assertEqual(len(families), 3)

    def test_source_lineage_prefers_a_reviewed_label_over_an_unreviewed_anchor(self):
        families, assignments = source_lineage_assignments([
            {
                "id": "early", "title": "Early Coverage", "documentDate": "1990-01-01",
                "segments": ["Source: Associated Press Newsroom. Early coverage."], "metadata": {},
            },
            {
                "id": "reviewed", "title": "Reviewed Coverage", "documentDate": "1995-01-01",
                "segments": ["Source: Associated Press Newsroom. Reviewed coverage."],
                "metadata": {"source_family_id": "family-reviewed", "source_family_label": "Reviewed AP origin"},
            },
        ])

        self.assertEqual(len(families), 1)
        self.assertEqual(families[0]["anchorDocumentId"], "early")
        self.assertEqual(families[0]["label"], "Reviewed AP origin")
        self.assertEqual(assignments["early"]["label"], "Reviewed AP origin")
        self.assertEqual(assignments["reviewed"]["label"], "Reviewed AP origin")

    def test_source_lineage_publishes_reviewed_single_document_assignments(self):
        families, assignments = source_lineage_assignments([{
            "id": "reviewed", "title": "Reviewed Account", "segments": ["A reviewed source account."],
            "metadata": {"source_family_id": "family-reviewed", "source_family_label": "Reviewed origin"},
        }])

        self.assertEqual(families[0]["status"], "reviewed")
        self.assertEqual(assignments["reviewed"]["status"], "reviewed")
        self.assertEqual(assignments["reviewed"]["method"], "reviewed_metadata")
        self.assertEqual(assignments["reviewed"]["confidence"], 1.0)
        self.assertEqual(assignments["reviewed"]["evidence"][0]["signal"], "reviewed_metadata")

    def test_source_lineage_keeps_ambiguous_citations_independent_and_unknown(self):
        families, assignments = source_lineage_assignments([
            {"id": "one", "title": "Regional Incident Report", "segments": ["One witness described a light above the hills."], "metadata": {}},
            {"id": "two", "title": "Regional Incident Report", "segments": ["A separate archive record discusses another event."], "metadata": {}},
            {"id": "coverage", "title": "Later Coverage", "segments": ["According to Regional Incident Report, witnesses gathered beside the runway."], "metadata": {}},
        ])

        self.assertEqual(len(families), 3)
        self.assertNotEqual(assignments["one"]["id"], assignments["two"]["id"])
        self.assertEqual(assignments["coverage"]["status"], "unknown")
        self.assertEqual(assignments["coverage"]["method"], "unclassified")
        self.assertTrue(any(item["signal"] == "ambiguous_citation" for item in assignments["coverage"]["evidence"]))

    def test_craft_classification_retains_phrase_provenance_and_stable_ids(self):
        text = "The pilot observed a black triangle, about 30 feet wide and 10 feet high."
        first, candidates = craft_observations_for_segment(text, "doc-report", "Example", 4, self.craft_taxonomy())
        second, _ = craft_observations_for_segment(text, "doc-report", "Example", 4, self.craft_taxonomy())

        self.assertEqual(candidates, [])
        self.assertEqual(first[0]["classId"], "triangle")
        self.assertEqual(first[0]["originalPhrase"], "black triangle")
        self.assertEqual(first[0]["matchType"], "explicit")
        self.assertEqual(first[0]["witnessType"], "pilot")
        self.assertEqual(first[0]["id"], second[0]["id"])
        self.assertEqual({item["axis"] for item in first[0]["measurements"]}, {"width", "height"})

    def test_craft_false_positives_and_unmapped_shapes_are_explicit(self):
        excluded, review = craft_observations_for_segment(
            "The cigar-shaped object was a tobacco ashtray design.", "doc-false", "Example", 1, self.craft_taxonomy()
        )
        unknown, candidates = craft_observations_for_segment(
            "A witness saw a teardrop-shaped object hover nearby.", "doc-unknown", "Example", 2, self.craft_taxonomy()
        )

        self.assertEqual(excluded, [])
        self.assertEqual(review[0]["decision"], "excluded")
        self.assertEqual(review[0]["reason"], "ordinary-cigar")
        self.assertEqual(unknown[0]["classId"], "unknown")
        self.assertEqual(unknown[0]["matchType"], "unmapped_candidate")
        self.assertEqual(candidates[0]["decision"], "unmapped")

    def test_craft_orbital_context_does_not_exclude_an_explicit_shape(self):
        observations, review = craft_observations_for_segment(
            "A witness reported that a metallic sphere entered orbit.",
            "doc-orbit", "Example", 3, self.craft_taxonomy(),
        )

        self.assertEqual(review, [])
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0]["classId"], "orb")
        self.assertEqual(observations[0]["originalPhrase"], "metallic sphere")

    def test_skywatcher_class_language_is_classified_for_all_nine_craft(self):
        cases = {
            "The Class I often spins.": "skywatcher_tetra",
            "The Class II is the class of tic-tac.": "tic_tac",
            "The class three, the blob.": "skywatcher_blob",
            "The class four is your orb.": "skywatcher_beam",
            "The class 5 we call the manta ray.": "skywatcher_manta_ray",
            "Class 6 is bright star.": "skywatcher_bright_star",
            "The class 7 is the jellyfish.": "skywatcher_jellyfish",
            "The Class 8 we call the hornet.": "skywatcher_hornet",
            "And then the Class 9 is the egg.": "egg",
        }

        for text, expected_class in cases.items():
            with self.subTest(text=text):
                observations, review = craft_observations_for_segment(
                    text, f"doc-{expected_class}", "Skywatcher-HQ", 1, self.craft_taxonomy(),
                )
                self.assertEqual(review, [])
                self.assertEqual([item["classId"] for item in observations], [expected_class])

    def test_skywatcher_class_language_is_source_scoped_and_ordinary_animals_do_not_match(self):
        source_scoped, source_review = craft_observations_for_segment(
            "The Class I often spins.", "doc-unrelated-class", "Example", 1, self.craft_taxonomy(),
        )
        unrelated, unrelated_review = craft_observations_for_segment(
            "A jellyfish was seen on TV in an ocean documentary.",
            "doc-ocean", "Example", 2, self.craft_taxonomy(),
        )

        self.assertEqual(source_scoped, [])
        self.assertEqual(source_review, [])
        self.assertEqual(unrelated, [])
        self.assertEqual(unrelated_review, [])

    def test_craft_measurements_normalize_ranges_without_treating_altitude_as_height(self):
        measurements = craft_measurements(
            "The spherical object was 3.6m-4.5m in diameter at a height of 600 meters in the sky.",
            "doc-measure", 7,
        )

        self.assertEqual(len(measurements), 1)
        self.assertEqual(measurements[0]["kind"], "diameter")
        self.assertEqual(measurements[0]["originalRange"], [3.6, 4.5])
        self.assertAlmostEqual(measurements[0]["normalizedMeters"], 4.05)
        self.assertTrue(measurements[0]["axisMethod"].endswith("used-for-width"))

    def test_craft_means_report_sample_sizes_and_leave_missing_dimensions_null(self):
        observations = [
            {"id": "one", "classId": "orb", "documentId": "a", "source": "One", "confidence": .98,
             "measurements": craft_measurements("A spherical object was 10 meters in diameter.", "a", 0), "excerpt": "A"},
            {"id": "two", "classId": "orb", "documentId": "b", "source": "Two", "confidence": .98,
             "measurements": craft_measurements("A spherical object was 20 meters in diameter.", "b", 0), "excerpt": "B"},
        ]
        summaries = craft_class_summaries(self.craft_taxonomy(), observations)
        orb = next(item for item in summaries if item["classId"] == "orb")

        self.assertEqual(orb["id"], "craft-class-orb")
        self.assertEqual(orb["dimensions"]["width"]["meanMeters"], 15)
        self.assertEqual(orb["dimensions"]["width"]["n"], 2)
        self.assertIsNone(orb["dimensions"]["height"])

    def test_craft_visual_motifs_and_all_skywatcher_reference_classes_are_published(self):
        text = "A witness saw a black triangle with a light on each point and a central light cluster."
        observations, _ = craft_observations_for_segment(text, "triangle-report", "Example", 1, self.craft_taxonomy())
        summaries = craft_class_summaries(self.craft_taxonomy(), observations)
        triangle = next(item for item in summaries if item["classId"] == "triangle")
        motifs = {item["feature"]: item for item in triangle["visualEvidence"]}

        self.assertEqual(motifs["dark_body"]["documentCount"], 1)
        self.assertEqual(motifs["corner_lights"]["observationCount"], 1)
        self.assertEqual(motifs["central_light"]["observationCount"], 1)
        self.assertEqual(
            {item["authority"]["class"] for item in summaries if item.get("authority")},
            {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"},
        )
        authority_profiles = [item for item in summaries if item.get("authority")]
        self.assertTrue(all(item["drawingProfile"]["aspectRatio"] > 0 for item in authority_profiles))
        self.assertTrue(all("Skywatcher" not in item["name"] for item in authority_profiles))
        bright_star = next(item for item in summaries if item["classId"] == "skywatcher_bright_star")
        self.assertEqual(bright_star["drawingProfile"]["geometry"], "single radiant eight-point star")
        self.assertIn("tetrahedron", bright_star["drawingProfile"]["forbiddenDetails"])
        jellyfish = next(item for item in summaries if item["classId"] == "skywatcher_jellyfish")
        self.assertEqual(jellyfish["drawingProfile"]["componentMeters"], {"head": 2, "tailMaximum": 5})

    def test_normalizes_only_valid_unambiguous_dates(self):
        self.assertEqual(normalized_date("November 8, 1975"), "1975-11-08")
        self.assertEqual(normalized_date("8 November 1975"), "1975-11-08")
        self.assertEqual(normalized_date("Nov 8, 1975"), "1975-11-08")
        self.assertEqual(normalized_date("1890-03-29"), "1890-03-29")
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

    def test_temporal_candidates_retain_paired_segment_ids_for_event_evidence(self):
        segments = ["The object was observed near the base on November 8, 1975 by two witnesses."]

        _, events, review = temporal_candidates(segments, {}, "doc-paired", ["segment-shared-7"])

        self.assertEqual(events[0]["evidence"][0]["segment"], "segment-shared-7")
        self.assertEqual(review[0]["segment"], "segment-shared-7")
        self.assertEqual(events[0]["id"], stable_id("event", "doc-paired|segment-shared-7|1975-11-08|sighting"))

    def test_temporal_candidates_hold_an_ocr_header_that_conflicts_with_a_filename_date(self):
        segments = [
            "DATE OF INFORMATION: 24 August 1909",
            "The object was observed near the base on August 22, 1969 by the pilot.",
        ]
        metadata = {
            "source_file": (
                "DPIArchive/documents/116740-unidentified-object-thought-to-be-helicopter-"
                "observed-near-nakhon-phanom-rtafb-9-6-1969.pdf"
            ),
        }

        document_date, events, review = temporal_candidates(segments, metadata, "doc-dpi")

        self.assertIsNone(document_date)
        self.assertEqual([event["startDate"] for event in events], ["1969-08-22"])
        conflict = next(candidate for candidate in review if candidate["value"] == "1909-08-24")
        self.assertEqual(conflict["kind"], "date_conflict")
        self.assertEqual(conflict["method"], "filename-date-conflict")
        self.assertEqual(conflict["confidence"], 0.2)
        self.assertIn("9-6-1969.pdf", conflict["evidence"])

    def test_temporal_candidates_keep_a_header_date_when_a_filename_dates_a_different_event(self):
        segments = ["Date: Wednesday, May 17, 2023"]
        metadata = {"source_file": "case-captured-10-20-2022.pdf"}

        document_date, _, _ = temporal_candidates(segments, metadata, "doc-1264c19b10bf")

        self.assertEqual(document_date["value"], "2023-05-17")
        self.assertEqual(document_date["method"], "document-header")

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

            discussion_support = {"Roswell announcement": [
                {"documentId": "doc-discussion", "mentionCount": 3, "excerpt": "The event reshaped public discussion."}
            ]}
            events = curated_events(registry, {"Roswell/source.txt": "doc-source"}, review, discussion_support)

            self.assertEqual(events[0]["documentIds"], ["doc-discussion", "doc-source", "doc-support"])
            self.assertEqual(events[0]["evidence"][1]["segment"], 2)
            self.assertEqual(events[0]["mentionCount"], 4)

    def test_curated_discussion_signatures_count_contextual_article_mentions(self):
        items = [{"title": "2017 article", "discussionMatchAny": [
            ["new york times", "aatip"], ["new york times", "elizondo", "2017"]
        ]}]

        matched = curated_discussion_matches([
            "The December 2017 New York Times article revealed AATIP to a broad audience.",
            "A generic New York Times bestseller is unrelated.",
        ], items)

        self.assertEqual(matched["2017 article"]["mentionCount"], 1)


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

    def test_rejects_show_titles_as_people(self):
        self.assertIsNone(classify_phrase("Joe Pyne Show"))
        self.assertIsNone(classify_phrase("Joe Pyne TV Show"))

    def test_rejects_placeholders_and_role_prefixed_ocr_gibberish_as_people(self):
        self.assertIsNone(classify_phrase("John Doe III"))
        self.assertIsNone(classify_phrase("General Rgrmrmy The Lesser"))

    def test_rejects_generic_roles_headings_and_location_fragments_as_entities(self):
        for phrase in (
            "Public Affairs Officer",
            "FOIA Office",
            "Defense Intelligence Reference Documents",
            "House Committees",
            "Surface Areas",
            "Chart Showing Balloon Launching Sites",
            "Base Commander",
            "District Intelligence Officer",
            "Army Officers",
            "Aviation Administration Has",
            "Force Base",
            "Naval Base",
            "Warning Area",
            "Air Base",
            "International Airport",
            "Area Code",
            "Returned To Base",
            "Air Base Group",
            "Base Operations",
            "City Hall",
        ):
            with self.subTest(phrase=phrase):
                self.assertIsNone(classify_phrase(phrase))

    def test_location_keywords_match_words_not_person_or_title_substrings(self):
        self.assertIsNone(classify_phrase("Beatrice Villareal"))
        self.assertIsNone(classify_phrase("Stranger Things"))

    def test_reviewed_location_gazetteer_covers_prominent_unambiguous_places(self):
        path = Path(__file__).resolve().parents[1] / "data" / "location_coordinates.json"
        coordinates = json.loads(path.read_text(encoding="utf-8"))

        for place in (
            "Varginha, Brazil",
            "China",
            "Russia",
            "Australia",
            "Canada",
            "Brazil",
            "Socorro, New Mexico",
            "RAF Bentwaters",
            "Rendlesham Forest",
        ):
            with self.subTest(place=place):
                self.assertIn(place, coordinates)
                self.assertGreaterEqual(coordinates[place]["lat"], -90)
                self.assertLessEqual(coordinates[place]["lat"], 90)
                self.assertGreaterEqual(coordinates[place]["lon"], -180)
                self.assertLessEqual(coordinates[place]["lon"], 180)
                self.assertIn(coordinates[place]["precision"], {"city", "country", "region", "site", "historical-region"})

        self.assertEqual(coordinates["Varginha, Brazil"], {"lat": -21.551, "lon": -45.43, "precision": "city"})
        for ambiguous in (
            "Cambridge",
            "Kansas City",
            "Mountain Home",
            "Mountain View",
            "Indian Head",
            "Orange County",
            "Saint Petersburg",
            "Metropolitan Airport",
            "White Mountains",
        ):
            self.assertNotIn(ambiguous, coordinates)
        self.assertNotIn("Milky Way", coordinates)

    def test_location_aliases_normalize_abbreviated_places_before_mapping(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        self.assertEqual(registry[comparison_key("Pax River")], ("Patuxent River", "location"))
        self.assertEqual(registry[comparison_key("MacDill AFB")], ("MacDill Air Force Base", "location"))
        self.assertEqual(registry[comparison_key("District Columbia")], ("District of Columbia", "location"))

    def test_classifies_intelligence_topics_as_subjects_not_organizations(self):
        self.assertEqual(classify_phrase("Signals Intelligence"), ("subject", 0.95))
        self.assertEqual(classify_phrase("Non-Human Intelligence"), ("subject", 0.95))

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

    def test_title_extraction_preserves_source_case_policy(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        source_title = source_title_from_path(Path("foreign_technology.pdf"))
        lowercase_mentions = extract_title_mentions(source_title, registry)
        exact_mentions = extract_title_mentions("Foreign Technology", registry)

        self.assertEqual(source_title, "foreign technology")
        self.assertNotIn(
            ("Foreign Technology", "government_agency"),
            {(canonical, category) for _, canonical, category, _, _ in lowercase_mentions},
        )
        self.assertIn(
            ("Foreign Technology", "government_agency"),
            {(canonical, category) for _, canonical, category, _, _ in exact_mentions},
        )

    def test_preserves_acronym_duplicate_candidates_before_length_pruning(self):
        left = Candidate("Federal Bureau Investigation", "government_agency", curated=True)
        right = Candidate("FBI", "government_agency", curated=True)

        candidates, total = duplicate_candidates({"left": left, "right": right})

        self.assertEqual(total, 1)
        self.assertEqual(candidates[0]["reason"], "acronym")

    def test_duplicate_review_report_can_return_the_complete_queue(self):
        candidates = {
            name: Candidate(name, "organization")
            for name in (
                "National Investigation Committee",
                "National Investigations Committee",
                "National Investigation Committees",
            )
        }
        for name, candidate in candidates.items():
            candidate.mentions = 3
            candidate.variants[name] = 3
            candidate.documents.update({"one", "two"})

        limited, total = duplicate_candidates(candidates, limit=1)
        complete, complete_total = duplicate_candidates(candidates, limit=None)

        self.assertEqual(len(limited), 1)
        self.assertGreater(len(complete), len(limited))
        self.assertEqual(complete_total, total)

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

    def test_known_person_does_not_emit_a_nested_fallback_identity(self):
        mentions = extract_mentions("J. Allen Hynek directed Project Blue Book.", {})

        people = [mention for mention in mentions if mention[2] == "person"]
        self.assertEqual(people, [("J. Allen Hynek", "J. Allen Hynek", "person", 0.99, True)])

    def test_known_entity_suppresses_an_overlapping_fallback_fragment(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions("The United States Navy F- reviewed the report.", registry)

        self.assertNotIn(
            "United States Navy F-",
            {canonical for _, canonical, _, _, _ in mentions},
        )

    def test_merges_reviewed_hynek_name_and_ocr_variants(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions(
            "J. Allen Hynek reviewed notes by Allen Hynek and the OCR rendered Alan Hynek.",
            registry,
        )

        people = {(canonical, curated) for _, canonical, category, _, curated in mentions if category == "person"}
        self.assertEqual(people, {("J. Allen Hynek", True)})

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

    def test_matches_reviewed_entities_case_insensitively_and_as_acronyms(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions(
            "the armed forces compared USSR records with the UK, NARA, NSF, and the state dept.",
            registry,
        )

        self.assertEqual(
            {(canonical, category) for _, canonical, category, _, _ in mentions},
            {
                ("Armed Forces", "government_agency"),
                ("Soviet Union", "location"),
                ("United Kingdom", "location"),
                ("National Archives", "government_agency"),
                ("National Science Foundation", "government_agency"),
                ("Department of State", "government_agency"),
            },
        )

    def test_hardcoded_canonical_identity_wins_over_a_legacy_registry_record(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions("FBI and DIA shared the report with NSA.", registry)

        self.assertEqual(
            {(canonical, category) for _, canonical, category, _, _ in mentions},
            {
                ("Federal Bureau of Investigation", "government_agency"),
                ("Defense Intelligence Agency", "government_agency"),
                ("National Security Agency", "government_agency"),
            },
        )
        title_mentions = extract_title_mentions("FBI DIA NSA", registry)
        self.assertEqual(
            {(canonical, category) for _, canonical, category, _, _ in title_mentions},
            {
                ("Federal Bureau of Investigation", "government_agency"),
                ("Defense Intelligence Agency", "government_agency"),
                ("National Security Agency", "government_agency"),
            },
        )

    def test_merges_grusch_spelling_variants_into_the_correct_identity(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions("David Grush cited Grusch in a later interview.", registry)

        people = [mention for mention in mentions if mention[2] == "person"]
        self.assertEqual(len(people), 1)
        self.assertEqual(people[0][1], "David Grusch")
        self.assertTrue(people[0][4])

    def test_curates_chris_bledsoe_full_name_variants_without_merging_family_members(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        identity_mentions = extract_mentions(
            "chris bledsoe discussed Christopher Bledsoe's account.",
            registry,
        )
        family_mentions = extract_mentions("Ryan Bledsoe discussed the Bledsoe family.", registry)

        people = {
            (canonical, curated)
            for _, canonical, category, _, curated in identity_mentions
            if category == "person"
        }
        self.assertIn(("Chris Bledsoe", True), people)
        self.assertNotIn(("Chris Bledsoe", False), people)
        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in family_mentions if category == "person"},
        )

    def test_person_alias_does_not_match_a_distinct_generational_suffix(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions("Chris Bledsoe Jr. discussed his father's account.", registry)
        title_mentions = extract_title_mentions("Interview with Christopher Bledsoe Jr.", registry)

        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in mentions if category == "person"},
        )
        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in title_mentions if category == "person"},
        )

        punctuated_mentions = extract_mentions(
            "Chris Bledsoe, Jr. spoke after Christopher Bledsoe (Jr.).",
            registry,
        )
        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in punctuated_mentions if category == "person"},
        )

        possessive_mentions = extract_mentions("Chris Bledsoe Jr.'s account was discussed.", registry)
        possessive_title_mentions = extract_title_mentions("Christopher Bledsoe Jr.’s Account", registry)
        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in possessive_mentions if category == "person"},
        )
        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in possessive_title_mentions if category == "person"},
        )

        typographic_mentions = extract_mentions("Chris Bledsoe Jr.—his son spoke.", registry)
        typographic_title_mentions = extract_title_mentions("Christopher Bledsoe Jr.—His Account", registry)
        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in typographic_mentions if category == "person"},
        )
        self.assertNotIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in typographic_title_mentions if category == "person"},
        )

    def test_curates_chris_bledsoe_possessive_in_titles(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_title_mentions("Chris Bledsoe's UFO of God", registry)

        self.assertIn(
            "Chris Bledsoe",
            {canonical for _, canonical, category, _, _ in mentions if category == "person"},
        )

    def test_reviewed_aliases_keep_boundaries_and_do_not_merge_broad_terms(self):
        self.assertIsNone(classify_phrase("Program Manager"))

        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions(
            "A UKIP member described foreign technology and security administration policy "
            "with the House Armed Services Committee.",
            registry,
        )

        identities = {(canonical, category) for _, canonical, category, _, _ in mentions}
        self.assertNotIn(("United Kingdom", "location"), identities)
        self.assertNotIn(("Armed Forces", "government_agency"), identities)
        self.assertNotIn(("Foreign Technology", "government_agency"), identities)
        self.assertNotIn(("Security Administration", "government_agency"), identities)

    def test_unflagged_aliases_retain_case_sensitive_boundary_matching(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        exact_mentions = extract_mentions(
            "U.S. Army personnel met Dwight D. Eisenhower at Bentwaters.",
            registry,
        )
        lowercase_mentions = extract_mentions(
            "u.s. army personnel met dwight d. eisenhower at bentwaters.",
            registry,
        )

        self.assertEqual(
            {(canonical, category) for _, canonical, category, _, _ in exact_mentions},
            {
                ("United States Army", "government_agency"),
                ("Dwight D. Eisenhower", "person"),
                ("RAF Bentwaters", "location"),
            },
        )
        self.assertFalse(lowercase_mentions)

    def test_longer_exact_registry_matches_suppress_nested_insensitive_aliases(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions(
            "The Armed Forces Committee inspected Groom Lake Road.",
            registry,
        )
        identities = {(canonical, category) for _, canonical, category, _, _ in mentions}

        self.assertIn(("Armed Forces Committee", "government_agency"), identities)
        self.assertIn(("Groom Lake Road", "location"), identities)
        self.assertNotIn(("Armed Forces", "government_agency"), identities)
        self.assertNotIn(("Groom Lake", "location"), identities)

        uppercase_mentions = extract_mentions(
            "ARMED FORCES COMMITTEE inspected GROOM LAKE ROAD.",
            registry,
        )
        uppercase_identities = {
            (canonical, category)
            for _, canonical, category, _, _ in uppercase_mentions
        }
        self.assertNotIn(("Armed Forces", "government_agency"), uppercase_identities)
        self.assertNotIn(("Groom Lake", "location"), uppercase_identities)

    def test_capitalized_phrase_fallback_respects_case_insensitive_allowlist(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        mentions = extract_mentions(
            "FOREIGN TECHNOLOGY. SECURITY ADMINISTRATION. COMMAND HEADQUARTERS.",
            registry,
        )

        generic_names = {"Foreign Technology", "Security Administration", "Command Headquarters"}
        self.assertFalse(any(
            canonical.title() in generic_names
            for _, canonical, _, _, _ in mentions
        ))

    def test_book_aliases_still_require_an_explicit_title_cue(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])

        without_cue = extract_mentions("Flying Seucers crossed the sky.", registry)
        with_cue = extract_mentions('The book "Flying Seucers" was cited.', registry)

        self.assertFalse(any(category == "book" for _, _, category, _, _ in without_cue))
        self.assertIn(("Flying Saucers", "book"), {(canonical, category) for _, canonical, category, _, _ in with_cue})

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

    def test_extracts_common_spoken_book_cues_and_reviewed_titles(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([
            data_dir / "curated_entities.json",
            data_dir / "entity_aliases.json",
            data_dir / "book_catalog.json",
        ])
        mentions = extract_mentions(
            "The book is Need to Know. I read a book Passport to the Cosmos. "
            "In your latest book, Them, you come full circle. Communion occurred at the house. "
            "I read the book and gave them copies.",
            registry,
        )
        books = {canonical for _, canonical, category, _, _ in mentions if category == "book"}

        self.assertEqual(books, {"Need to Know", "Passport to the Cosmos", "Them"})
        self.assertNotIn("Communion", books, "reviewed titles still require nearby book context")

    def test_book_catalog_supplies_reviewed_authors_and_aliases(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        registry = load_registry([data_dir / "book_catalog.json"])

        self.assertEqual(registry[comparison_key("Believer")], ("The Believer", "book"))
        self.assertEqual(
            registry.metadata[(entity_key("Skinwalkers at the Pentagon", "book"), "book")]["authors"],
            ["James T. Lacatski", "Colm A. Kelleher", "George Knapp"],
        )

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
    def test_historical_date_review_registry_records_every_screened_decision(self):
        payload = json.loads(
            (Path(__file__).resolve().parents[1] / "data" / "reported_event_date_reviews.json").read_text(encoding="utf-8")
        )
        decisions = payload["documents"]
        self.assertEqual(payload["audit"]["machineDataRevision"], "b4211b026f3c9fc4e871ff83c87d68650b8ae2fc")
        self.assertIn("Git blob SHA", payload["audit"]["sourceBinding"])
        self.assertEqual(len(decisions), 393)
        self.assertEqual(sum(item["status"] == "published" for item in decisions.values()), 363)
        self.assertEqual(sum(item["status"] == "excluded" for item in decisions.values()), 30)
        self.assertTrue(all(item["method"] == "analyst-review" for item in decisions.values()))
        self.assertTrue(all(item.get("sourceDate") for item in decisions.values()))
        self.assertTrue(all(item.get("date") and item.get("precision") for item in decisions.values() if item["status"] == "published"))
        self.assertTrue(all(item.get("sourcePath") for item in decisions.values()))
        self.assertTrue(all(re.fullmatch(r"[0-9a-f]{40}", item.get("sourceBlobSha", "")) for item in decisions.values()))

    def test_document_shards_are_source_specific_and_remove_stale_files(self):
        documents = [
            {"id": "a", "source": "UPDB-MUFON", "title": "One"},
            {"id": "b", "source": "UPDB-MUFON", "title": "Two"},
            {"id": "c", "source": "Black Vault", "title": "Three"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            shard_dir = data_dir / "source-documents"
            shard_dir.mkdir()
            (shard_dir / "stale.json").write_text("{}")
            manifest = write_document_shards(shard_dir, documents, data_dir)

            self.assertEqual([item["source"] for item in manifest], ["Black Vault", "UPDB-MUFON"])
            self.assertFalse((shard_dir / "stale.json").exists())
            mufon = json.loads((data_dir / next(item["path"] for item in manifest if item["source"] == "UPDB-MUFON")).read_text())
            self.assertEqual(mufon["schema"], "ufo-files-source-documents/v1")
            self.assertEqual([item["id"] for item in mufon["documents"]], ["a", "b"])

    def test_claim_evidence_is_bound_to_the_reviewed_source_blob(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            source = root / "Example" / "source.txt"
            source.parent.mkdir(parents=True)
            source.write_text("Reviewed source language.\n", encoding="utf-8")
            document_id = stable_id("doc", "Example/source.txt")
            claims_path = Path(directory) / "claims.json"
            claims_path.write_text(json.dumps({"claims": [{
                "id": "claim-reviewed",
                "evidence": {
                    "documentId": document_id,
                    "sourceBlobSha": git_blob_sha(source),
                    "excerpt": "Reviewed source language.",
                },
            }]}), encoding="utf-8")
            documents = [{"id": document_id, "path": "Example/source.txt"}]

            validate_claim_source_blobs(root, claims_path, documents)
            source.write_text("Corrected source language.\n", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "source content changed"):
                validate_claim_source_blobs(root, claims_path, documents)

    def test_claim_evidence_excerpt_must_match_the_bound_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            source = root / "Example" / "source.txt"
            source.parent.mkdir(parents=True)
            source.write_text("Reviewed\nsource language continues here.\n", encoding="utf-8")
            document_id = stable_id("doc", "Example/source.txt")
            claims_path = Path(directory) / "claims.json"
            claims_path.write_text(json.dumps({"claims": [{
                "id": "claim-misquoted",
                "evidence": {
                    "documentId": document_id,
                    "sourceBlobSha": git_blob_sha(source),
                    "excerpt": "Reviewed source language.",
                },
            }]}), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "evidence excerpt is not exact source language"):
                validate_claim_source_blobs(root, claims_path, [{"id": document_id, "path": "Example/source.txt"}])

    def test_historical_coverage_review_includes_phoenix_and_tracks_gaps(self):
        data_dir = Path(__file__).resolve().parents[1] / "data"
        curated = json.loads((data_dir / "curated_events.json").read_text(encoding="utf-8"))["events"]
        coverage = json.loads((data_dir / "event_coverage_review.json").read_text(encoding="utf-8"))

        phoenix = next(event for event in curated if event["title"] == "Phoenix Lights")
        self.assertEqual(phoenix["startDate"], "1997-03-13")
        self.assertIn("Phoenix Lights", coverage["added"])
        self.assertIn("Chicago O'Hare UFO Sighting", coverage["notFoundByNameInCorpus"])

    def test_build_publishes_events_and_writes_date_review_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "Example"
            collection.mkdir(parents=True)
            metadata = {"schema": "ufo-files-archive-ocr/v1", "source_file": "report.pdf", "source_bytes": 100}
            body = (
                "Date: November 10, 1975 memorandum concerning the incident.\n"
                "Two officers observed a bright object near Roswell on November 8, 1975.\n"
                "The witness reported a recurring signal at 1.6 GHz near the site.\n"
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
            self.assertEqual(catalog["counts"]["signalObservations"], 1)
            self.assertEqual(catalog["counts"]["signalFrequencies"], 1)
            self.assertEqual(catalog["signals"]["schema"], "ufo-files-signal-frequency-observations/v1")
            self.assertEqual(catalog["signals"]["frequencies"][0]["frequencyHz"], 1_600_000_000)
            self.assertEqual(catalog["signals"]["frequencies"][0]["documentCount"], 1)
            self.assertIn("1.6 GHz", catalog["signals"]["observations"][0]["excerpt"])
            self.assertEqual(catalog["coverage"]["schema"], "ufo-files-corpus-coverage/v1")
            self.assertIn(catalog["documents"][0]["id"], next(
                bucket["documentIds"]
                for dimension in catalog["coverage"]["dimensions"] if dimension["id"] == "time"
                for bucket in dimension["buckets"] if bucket["label"] == "1970s"
            ))
            review = json.loads(review_path.read_text(encoding="utf-8"))
            candidates = review["records"][0]["candidates"]
            self.assertIn("administrative_date", {candidate["kind"] for candidate in candidates})

    def test_database_reports_publish_source_record_identifiers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "UPDB-MUFON"
            collection.mkdir(parents=True)
            metadata = {
                "schema": "ufo-files-archive-ocr/v1",
                "source_file": "UPDB-MUFON/extracted/documents/000/mufon-5283000.json",
                "source_bytes": 100,
                "engine": "structured-database-extract",
                "engine_mode": "database-report",
                "document_date": "2022-01-20 07:13:00",
                "mufon_id": "120442",
                "updb_database_id": 5283000,
            }
            (collection / "mufon-5283000.txt").write_text(
                json.dumps(metadata) + "\n\nFederal Bureau of Investigation reviewed the report. "
                "Federal Bureau of Investigation retained the account.", encoding="utf-8"
            )

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, require_data=True)

            self.assertEqual(catalog["documents"][0]["sourceRecord"], {
                "externalId": "120442",
                "databaseId": 5283000,
            })
            self.assertEqual(catalog["documents"][0]["reportedEventDateReview"]["status"], "published")
            self.assertEqual(catalog["counts"]["publishedReportedEventDates"], 1)
            self.assertEqual(catalog["counts"]["reviewRequiredReportedEventDates"], 0)

    def test_database_report_date_review_registry_publishes_an_exact_held_date(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "UPDB-MUFON"
            collection.mkdir(parents=True)
            relative = "UPDB-MUFON/mufon-historical.txt"
            metadata = {
                "schema": "ufo-files-archive-ocr/v1",
                "source_file": "UPDB-MUFON/extracted/documents/mufon-historical.json",
                "source_bytes": 100,
                "engine": "structured-database-extract",
                "engine_mode": "database-report",
                "document_date": "1900-01-01 00:00:00",
                "mufon_id": "historical",
            }
            source_path = collection / "mufon-historical.txt"
            source_path.write_text(
                json.dumps(metadata) + "\n\nThe original case record confirms this event date. "
                "Federal Bureau of Investigation reviewed the report. "
                "Federal Bureau of Investigation retained the account.",
                encoding="utf-8",
            )
            document_id = stable_id("doc", relative)
            reviews_path = Path(directory) / "reported_event_date_reviews.json"
            reviews_path.write_text(json.dumps({
                "schema": "ufo-files-reported-event-date-reviews/v1",
                "documents": {document_id: {
                    "status": "published",
                    "sourcePath": relative,
                    "sourceBlobSha": git_blob_sha(source_path),
                    "date": "1900-01-01",
                    "reason": "analyst-confirmed-event-date",
                }},
            }), encoding="utf-8")

            catalog = build(
                root,
                Path(directory) / "catalog.json",
                100,
                100,
                require_data=True,
                reported_event_date_reviews=reviews_path,
            )

            self.assertEqual(catalog["documents"][0]["reportedEventDateReview"], {
                "status": "published",
                "reason": "analyst-confirmed-event-date",
                "method": "analyst-review",
                "sourceDate": "1900-01-01",
                "date": "1900-01-01",
                "precision": "day",
            })
            self.assertEqual(catalog["counts"]["publishedReportedEventDates"], 1)

    def test_database_report_date_gate_holds_historical_and_explicit_placeholder_dates(self):
        trusted = {
            "value": "2022-01-20",
            "precision": "day",
            "confidence": 0.99,
            "method": "metadata:document_date",
        }
        historical = {**trusted, "value": "1900-01-01"}
        source_path = "UPDB-NICAP/000/nicap-test.txt"
        source_blob_sha = "a" * 40
        binding = {"sourcePath": source_path, "sourceBlobSha": source_blob_sha}

        self.assertEqual(reported_event_date_review([], trusted), {
            "status": "published",
            "reason": "trusted-structured-date",
            "method": "automatic-date-gate",
        })
        self.assertEqual(
            reported_event_date_review([], historical)["reason"],
            "before-modern-reporting-baseline",
        )
        placeholder = reported_event_date_review(
            ["The form required me to enter a date, but it is not the actual date."],
            trusted,
        )
        self.assertEqual(placeholder["status"], "review_required")
        self.assertEqual(placeholder["reason"], "explicit-invalid-date-language")
        self.assertEqual(placeholder["segment"], 0)
        for uncertain_context in (
            "I don't know the date of the sighting, so the form value is approximate.",
            "I am not sure of the date.",
            "I cannot remember the exact date of the encounter.",
        ):
            with self.subTest(uncertain_context=uncertain_context):
                self.assertEqual(
                    reported_event_date_review([uncertain_context], trusted)["reason"],
                    "explicit-invalid-date-language",
                )
        self.assertEqual(
            reported_event_date_review(
                ["I took photos of the object. The date is wrong because the form forced me to choose one."],
                trusted,
            )["reason"],
            "explicit-invalid-date-language",
        )
        for non_event_context in (
            "The date is wrong on YouTube, not December 18; the event was December 22.",
            "I think the person who filed the other similar report got the date wrong.",
            "The date was incorrect on my watch.",
            "The camera date is wrong in the photos.",
        ):
            with self.subTest(non_event_context=non_event_context):
                self.assertEqual(
                    reported_event_date_review([non_event_context], trusted)["status"],
                    "published",
                )

        self.assertEqual(
            reported_event_date_review([], {**trusted, "method": "metadata:authored_at"})["reason"],
            "untrusted-date-method",
        )
        audited_defects = (
            ({"collection": "UPDB-BAASS", "updb_database_id": 6053107}, "1905-06-29"),
            ({"collection": "UPDB-NIDS", "updb_database_id": 6091052}, "1905-06-12"),
            ({"collection": "UPDB-NICAP", "updb_database_id": 5182517}, "1902-01-31"),
            ({"collection": "UPDB-NICAP", "updb_database_id": 5176695}, "1900-01-01"),
            ({"collection": "UPDB-NICAP", "updb_database_id": 5178685}, "1957-01-01"),
            ({"collection": "UPDB-MUFON", "updb_database_id": 5462194}, "1890-01-01"),
            ({"collection": "UPDB-NICAP", "updb_database_id": 5179845}, "0191-01-01"),
        )
        for metadata, value in audited_defects:
            with self.subTest(metadata=metadata, value=value):
                defect = reported_event_date_review(
                    [], {**trusted, "value": value}, metadata=metadata,
                )
                self.assertEqual(defect["status"], "review_required")
                self.assertEqual(defect["reason"], "known-source-date-defect")
                self.assertEqual(defect["method"], "source-date-audit")
        reviewed = reported_event_date_review(
            [],
            historical,
            "doc-historical",
            {"doc-historical": {
                **binding,
                "status": "published",
                "date": "1900-01-01",
                "reason": "analyst-confirmed-event-date",
                "note": "Verified against the original case record.",
            }},
            source_path=source_path,
            source_blob_sha=source_blob_sha,
        )
        self.assertEqual(reviewed, {
            "status": "published",
            "reason": "analyst-confirmed-event-date",
            "method": "analyst-review",
            "sourceDate": "1900-01-01",
            "date": "1900-01-01",
            "precision": "day",
            "note": "Verified against the original case record.",
        })
        audited_override = reported_event_date_review(
            [],
            {**trusted, "value": "1905-06-29"},
            "doc-baass",
            {"doc-baass": {
                **binding,
                "status": "published",
                "date": "1905-06-29",
                "reason": "analyst-confirmed-event-date",
            }},
            {"collection": "UPDB-BAASS", "updb_database_id": 6053107},
            source_path,
            source_blob_sha,
        )
        self.assertEqual(audited_override["status"], "published")
        self.assertEqual(audited_override["method"], "analyst-review")
        self.assertEqual(
            reported_event_date_review(
                [], historical, "doc-historical",
                {"doc-historical": {**binding, "status": "published", "date": "1901-01-01"}},
                source_path=source_path,
                source_blob_sha=source_blob_sha,
            )["reason"],
            "before-modern-reporting-baseline",
        )
        corrected = reported_event_date_review(
            [], historical, "doc-corrected",
            {"doc-corrected": {
                **binding,
                "status": "published",
                "sourceDate": "1900-01-01",
                "date": "1900-05-01",
                "precision": "month",
                "reason": "analyst-corrected-historical-date",
            }},
            source_path=source_path,
            source_blob_sha=source_blob_sha,
        )
        self.assertEqual(corrected["date"], "1900-05-01")
        self.assertEqual(corrected["precision"], "month")
        excluded = reported_event_date_review(
            [], historical, "doc-excluded",
            {"doc-excluded": {
                **binding,
                "status": "excluded",
                "sourceDate": "1900-01-01",
                "reason": "analyst-rejected-historical-date",
            }},
            source_path=source_path,
            source_blob_sha=source_blob_sha,
        )
        self.assertEqual(excluded["status"], "excluded")
        self.assertEqual(excluded["method"], "analyst-review")
        changed = reported_event_date_review(
            [], historical, "doc-historical",
            {"doc-historical": {**binding, "status": "published", "date": "1900-01-01"}},
            source_path=source_path,
            source_blob_sha="b" * 40,
        )
        self.assertEqual(changed["status"], "review_required")
        self.assertEqual(changed["reason"], "analyst-review-source-changed")
        self.assertEqual(changed["method"], "source-content-binding")

    def test_database_report_build_marks_an_audited_source_date_defect(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            collection = root / "UPDB-BAASS"
            collection.mkdir(parents=True)
            metadata = {
                "schema": "ufo-files-archive-ocr/v1",
                "source_file": "UPDB-BAASS/database/reports.tsv.gz",
                "source_bytes": 100,
                "engine": "structured-database-extract",
                "engine_mode": "database-report",
                "document_date": "1905-06-29 12:00:00",
                "updb_database_id": 6053107,
            }
            (collection / "baass-6053107.txt").write_text(
                json.dumps(metadata) + "\n\nThe most recent activity was on 2-28-10, Sunday. "
                "Federal Bureau of Investigation reviewed the report. "
                "Federal Bureau of Investigation retained the account.",
                encoding="utf-8",
            )

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, require_data=True)

            review = catalog["documents"][0]["reportedEventDateReview"]
            self.assertEqual(review["status"], "review_required")
            self.assertEqual(review["reason"], "known-source-date-defect")
            self.assertEqual(review["method"], "source-date-audit")
            self.assertIn("1905 century-corruption block", review["evidence"])

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
            self.assertEqual(book["authors"], ["Robert Hastings"])
            self.assertEqual(book["authorReviewStatus"], "reviewed")
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
                body = (
                    "Federal Bureau of Investigation worked with Kelly Johnson in Roswell.\n"
                    "Kelly Johnson discussed UFO reports from Roswell.\n"
                    "The archived witness account describes a silent bright object crossing the western horizon before accelerating vertically beyond ordinary aircraft performance.\n"
                )
                (collection / f"source-{number}.txt").write_text(json.dumps(metadata) + "\n\n" + body, encoding="utf-8")
            output = root / "catalog.json"
            catalog = build(root, output, 100, 100, "ufo-files/machine-data", "abc123", True)
            self.assertEqual(catalog["counts"]["documents"], 2)
            self.assertEqual(catalog["input"]["rootName"], "machine-data")
            self.assertEqual(catalog["input"]["repository"], "ufo-files/machine-data")
            self.assertEqual(catalog["input"]["revision"], "abc123")
            self.assertEqual(catalog["publicationPolicy"]["sourceLineage"]["policy"], "ufo-files-source-family-policy/v1")
            self.assertEqual(len(catalog["sourceFamilies"]), 1)
            self.assertEqual(catalog["sourceFamilies"][0]["status"], "inferred")
            self.assertEqual(catalog["sourceFamilies"][0]["documentIds"], sorted(document["id"] for document in catalog["documents"]))
            for document in catalog["documents"]:
                self.assertEqual(document["sourceFamily"]["id"], catalog["sourceFamilies"][0]["id"])
                self.assertEqual(document["sourceFamily"]["method"], "near_duplicate")
                self.assertGreater(document["sourceFamily"]["confidence"], .9)
                self.assertTrue(document["sourceFamily"]["evidence"])
            entity = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Kelly Johnson")
            location = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "Roswell")
            self.assertEqual(entity["sourceMetrics"]["Example"]["mentions"], entity["mentions"])
            self.assertEqual(entity["sourceMetrics"]["Example"]["documentCount"], entity["documentCount"])
            self.assertEqual(entity["documentCount"], 2)
            self.assertEqual(entity["independentSourceFamilyCount"], 1)
            self.assertTrue(all(edge["evidence"] for edge in catalog["edges"]))
            self.assertTrue(all(edge["sourceMetrics"]["Example"]["evidenceCount"] == edge["evidenceCount"] for edge in catalog["edges"]))
            self.assertEqual(location["geo"], {"lat": 33.3943, "lon": -104.523, "precision": "city"})
            self.assertEqual(catalog["counts"]["mappedLocations"], 1)
            self.assertTrue(output.exists())
            published = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(published["documents"], [])
            self.assertEqual(published["documentShards"][0]["source"], "Example")
            shard = json.loads((output.parent / published["documentShards"][0]["path"]).read_text(encoding="utf-8"))
            self.assertEqual(len(shard["documents"]), 2)

    def test_paired_collection_uses_only_english_translation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            brazil = root / "Brazil-Government-UAP"
            pair = brazil / "paired" / "Camara" / "RIC-679" / "document-one"
            (pair / "en").mkdir(parents=True)
            (pair / "pt-BR").mkdir()
            (brazil / "legacy-portuguese.txt").write_text(
                json.dumps({"schema": "ufo-files-archive-ocr/v1", "source_file": "legacy.pdf"})
                + "\n\nSomente o documento português deve ser excluído.", encoding="utf-8"
            )
            (pair / "pt-BR" / "canonical.txt").write_text(
                json.dumps({"schema": "ufo-files-portuguese-search-text/v1", "canonical": True, "language": "pt-BR"})
                + "\n\nO piloto relatou um objeto triangular silencioso.", encoding="utf-8"
            )
            (pair / "pt-BR" / "canonical.json").write_text(json.dumps({
                "schema": "ufo-files-portuguese-canonical/v1",
                "document_id": "paired-document-one",
                "canonical_language": "pt-BR",
                "pages": [],
                "segments": [
                    {"segment_id": "accepted-segment", "text": "O piloto relatou um objeto triangular silencioso."},
                    {"segment_id": "failed-segment", "text": "Uma abreviação protegida foi alterada."},
                ],
            }), encoding="utf-8")
            (pair / "en" / "translation.txt").write_text(
                json.dumps({
                    "schema": "ufo-files-portuguese-search-text/v1", "canonical": False,
                    "language": "en", "document_id": "paired-document-one",
                }) + "\n\nThe pilot reported a silent triangular object above Brasilia before it accelerated vertically.\n\n"
                "A protected abbreviation was incorrectly changed to UFO.",
                encoding="utf-8",
            )
            (pair / "en" / "translation.json").write_text(json.dumps({
                "schema": "ufo-files-portuguese-translation/v1",
                "document_id": "paired-document-one",
                "pages": [],
                "segments": [
                    {
                        "segment_id": "accepted-segment", "source_segment_id": "accepted-segment",
                        "status": "machine-unreviewed",
                        "text": "The pilot reported a silent triangular object above Brasilia before it accelerated vertically.",
                    },
                    {
                        "segment_id": "failed-segment", "source_segment_id": "failed-segment",
                        "status": "failed-protected-token-check",
                        "text": "A protected abbreviation was incorrectly changed to UFO.",
                    },
                ],
            }), encoding="utf-8")
            (pair / "document.json").write_text(json.dumps({
                "schema": "ufo-files-portuguese-document/v1",
                "document_id": "paired-document-one",
                "canonical_language": "pt-BR",
                "canonical_path": "pt-BR/canonical.json",
                "translation_path": "en/translation.json",
                "translation_available": True,
                "translation_review_status": "needs-review",
                "source": {
                    "relative_path": "Camara/RIC-679/document-one.pdf", "bytes": 1234,
                    "original_language": "pt-BR",
                },
            }), encoding="utf-8")
            legacy = root / "Example"
            legacy.mkdir()
            (legacy / "english-source.txt").write_text(
                json.dumps({"schema": "ufo-files-archive-ocr/v1", "source_file": "english-source.pdf"})
                + "\n\nA second witness described a bright object crossing the western horizon before accelerating vertically.",
                encoding="utf-8",
            )

            catalog = build(root, Path(directory) / "catalog.json", 100, 100)
            paths = {document["path"] for document in catalog["documents"]}

            self.assertEqual(paths, {
                "Brazil-Government-UAP/paired/Camara/RIC-679/document-one/en/translation.txt",
                "Example/english-source.txt",
            })
            self.assertEqual(catalog["input"]["pairedLanguage"], "en")
            paired_document = next(document for document in catalog["documents"] if document["source"] == "Brazil-Government-UAP")
            self.assertEqual(paired_document["id"], "paired-document-one")
            self.assertEqual(paired_document["title"], "Document One")
            self.assertEqual(paired_document["bytes"], 1234)
            self.assertEqual(paired_document["originalLanguage"], "pt-BR")
            self.assertEqual(paired_document["availableLanguages"], ["pt-BR", "en"])
            self.assertTrue(paired_document["translationAvailable"])
            self.assertEqual(paired_document["translationReviewStatus"], "needs-review")
            self.assertEqual(paired_document["translationPath"], "Brazil-Government-UAP/paired/Camara/RIC-679/document-one/en/translation.json")
            self.assertEqual(paired_document["segments"], 1)
            self.assertFalse(any(entity["canonicalName"] == "UFO" for entity in catalog["entities"]))

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

    def test_coverage_aggregate_publishes_sparse_metadata_without_source_text(self):
        documents = [
            {"id": "dated", "source": "Alpha", "format": "ocr", "words": 120, "documentDate": "1952-07-14"},
            {"id": "missing", "source": "Beta", "format": "transcript", "words": 80},
        ]
        entities = [
            {"category": "location", "canonicalName": "Roswell", "geo": {"lat": 33.4, "lon": -104.5}, "documentIds": ["dated"]},
            {"category": "location", "canonicalName": "Unmapped place", "documentIds": ["missing"]},
            {"category": "subject", "canonicalName": "Radar", "documentIds": ["dated"]},
        ]
        events = [{"eventType": "incident", "documentIds": ["dated"], "evidence": [{"excerpt": "source text must not copy"}]}]

        coverage = coverage_aggregate(documents, entities, events)
        dimensions = {dimension["id"]: dimension for dimension in coverage["dimensions"]}

        self.assertEqual(coverage["schema"], "ufo-files-corpus-coverage/v1")
        self.assertEqual(next(bucket for bucket in dimensions["time"]["buckets"] if bucket["label"] == "1950s")["documentIds"], ["dated"])
        self.assertEqual(next(bucket for bucket in dimensions["time"]["buckets"] if bucket["unknown"])["documentIds"], ["missing"])
        self.assertEqual(next(bucket for bucket in dimensions["geography"]["buckets"] if bucket["unknown"])["documentIds"], ["missing"])
        self.assertEqual(next(bucket for bucket in dimensions["modality"]["buckets"] if bucket["label"] == "incident")["datedDocumentCount"], 1)
        self.assertNotIn("source text must not copy", json.dumps(coverage))

    def test_cases_separate_reports_from_attributed_assessments(self):
        events = [{
            "id": "event-one", "title": "Test observation", "eventType": "sighting",
            "startDate": "2024-01-02", "documentIds": ["doc-one"], "entityIds": ["place-one"],
            "evidence": [{"documentId": "doc-one", "excerpt": "A witness reported an object."}],
        }]
        documents = [{"id": "doc-one", "source": "Official archive"}]
        entities = [{"id": "place-one", "category": "location", "name": "Test Range"}]
        with tempfile.TemporaryDirectory() as directory:
            reviews = Path(directory) / "case_reviews.json"
            reviews.write_text(json.dumps({"events": {"event-one": {
                "resolutionStatus": "resolved", "assessmentAuthority": "Review office",
                "sensorModalities": ["infrared"], "witnessTypes": ["pilot"],
                "reportedCharacteristics": {"behavior": "apparently rapid"},
                "assessedCharacteristics": {"explanation": "parallax"},
            }}}), encoding="utf-8")
            cases = case_records(events, documents, entities, {"doc-one": "family-one"}, reviews)

        case = cases[0]
        self.assertEqual(case["caseKind"], "observation")
        self.assertEqual(case["resolutionStatus"], "resolved")
        self.assertEqual(case["assessmentAuthority"], "Review office")
        self.assertEqual(case["reportedCharacteristics"]["behavior"], "apparently rapid")
        self.assertEqual(case["assessedCharacteristics"]["explanation"], "parallax")
        self.assertEqual(case["independentSourceFamilyCount"], 1)
        self.assertTrue(case["dataCompleteness"]["publishedAssessment"])
        self.assertNotEqual(case["reportedCharacteristics"], case["assessedCharacteristics"])


class PortuguesePairTests(unittest.TestCase):
    def write_pair(self, root):
        pair = root / "Brazil-Government-UAP" / "paired" / "example"
        (pair / "pt-BR").mkdir(parents=True)
        (pair / "en").mkdir()
        document = {
            "schema": "ufo-files-portuguese-document/v1",
            "document_id": "doc-portuguese-stable",
            "canonical_language": "pt-BR",
            "available_languages": ["pt-BR", "en"],
            "translation_available": True,
            "translation_review_status": "needs-review",
            "canonical_path": "pt-BR/canonical.json",
            "translation_path": "en/translation.json",
            "source": {"media_type": "application/pdf"},
        }
        canonical = {
            "schema": "ufo-files-portuguese-canonical/v1",
            "document_id": document["document_id"],
            "canonical_language": "pt-BR",
            "source": {
                "relative_path": "Brasil/exemplo.pdf", "bytes": 100, "sha256": "a" * 64,
                "original_language": "pt-BR", "document_date": "1986-05-19",
            },
            "extraction": {"generated_at": "2026-08-09T00:00:00Z", "engine": "tesseract-por"},
            "pages": [{"page_id": "page-one", "segments": [{
                "segment_id": "seg-shared", "text": "Em 19 de maio de 1986, observou um OVNI.",
            }]}],
            "segments": [],
        }
        translation = {
            "schema": "ufo-files-portuguese-translation/v1",
            "document_id": document["document_id"],
            "translation": {"review_status": "needs-review"},
            "pages": [{"page_id": "page-one", "segments": [{
                "segment_id": "seg-shared", "source_segment_id": "seg-shared",
                "text": "On May 19, 1986, they observed a UFO.",
                "status": "needs-review",
            }]}],
            "segments": [],
        }
        (pair / "document.json").write_text(json.dumps(document), encoding="utf-8")
        (pair / "pt-BR" / "canonical.json").write_text(json.dumps(canonical), encoding="utf-8")
        (pair / "en" / "translation.json").write_text(json.dumps(translation), encoding="utf-8")
        return pair

    def test_reads_shared_ids_and_canonical_text_only(self):
        with tempfile.TemporaryDirectory() as directory:
            pair = self.write_pair(Path(directory))
            parsed = read_portuguese_pair(pair / "document.json")
        self.assertEqual(parsed["segment_ids"], ["seg-shared"])
        self.assertEqual(parsed["segments"], ["Em 19 de maio de 1986, observou um OVNI."])

    def test_catalog_exposes_language_and_does_not_count_translation_twice(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            pair = self.write_pair(root)
            canonical_path = pair / "pt-BR" / "canonical.json"
            canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
            canonical["pages"][0]["segments"][0]["text"] += " Saturno é um planeta com anéis."
            canonical_path.write_text(json.dumps(canonical), encoding="utf-8")
            catalog = build(root, Path(directory) / "catalog.json", 100, 100, paired_language="pt-BR")
        self.assertEqual(len(catalog["documents"]), 1)
        document = catalog["documents"][0]
        self.assertEqual(document["id"], "doc-portuguese-stable")
        self.assertEqual(document["originalLanguage"], "pt-BR")
        self.assertEqual(document["availableLanguages"], ["pt-BR", "en"])
        self.assertTrue(document["translationAvailable"])
        self.assertEqual(document["translationReviewStatus"], "needs-review")
        self.assertTrue(document["canonicalPath"].endswith("pt-BR/canonical.json"))
        self.assertTrue(document["translationPath"].endswith("en/translation.json"))
        self.assertEqual(catalog["input"]["pairedLanguage"], "pt-BR")
        ufo = next(entity for entity in catalog["entities"] if entity["name"] == "UFO")
        self.assertEqual(ufo["mentions"], 1)
        self.assertEqual(ufo["documentCount"], 1)
        saturn_observations = [item for item in catalog["astronomy"]["observations"] if item["targetId"] == "saturn"]
        self.assertEqual([item["originalPhrase"] for item in saturn_observations], ["Saturno"])
        saturn = next(item for item in catalog["astronomy"]["targets"] if item["targetId"] == "saturn")
        self.assertEqual(saturn["observationIds"], [saturn_observations[0]["id"]])

    def test_paired_observations_use_stable_segment_ids_for_qualifier_lookup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            pair = self.write_pair(root)
            canonical_path = pair / "pt-BR" / "canonical.json"
            canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
            canonical["pages"][0]["segments"][0]["text"] = "I believe the pilot reported a silent triangular object."
            canonical_path.write_text(json.dumps(canonical), encoding="utf-8")
            config = root / "config"
            config.mkdir()
            config.joinpath("epistemic_qualifiers.json").write_text(json.dumps({
                "schema": "ufo-files-epistemic-qualifier-rules/v1",
                "rules": [{"category": "speaker_inference", "confidence": .8, "evidenceWeight": .5, "pattern": r"\b(i believe)\b"}],
                "nonClaimFollowupPattern": r"^to pronounce\b",
            }), encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, paired_language="pt-BR")

        observation = catalog["craft"]["observations"][0]
        self.assertEqual(observation["segment"], "seg-shared")
        self.assertEqual(observation["epistemicQualifiers"][0]["qualifier"], "I believe")


class FrenchPairTests(unittest.TestCase):
    def write_pair(self, root):
        pair = root / "France-GEIPAN" / "paired" / "cases" / "2024-01-12345"
        (pair / "fr-FR").mkdir(parents=True)
        (pair / "en").mkdir()
        document = {
            "schema": "ufo-files-french-document/v1",
            "document_id": "doc-french-stable",
            "canonical_language": "fr-FR",
            "available_languages": ["fr-FR", "en"],
            "translation_available": True,
            "translation_review_status": "machine-unreviewed",
            "canonical_path": "fr-FR/canonical.json",
            "translation_path": "en/translation.json",
            "medium": "web-page",
            "source": {"country": "FR", "jurisdiction": "France"},
        }
        canonical = {
            "schema": "ufo-files-french-canonical/v1",
            "document_id": document["document_id"],
            "canonical_language": "fr-FR",
            "source": {"relative_path": "cases/2024-01-12345/case.html", "original_title": "TOULOUSE (31) 12.03.2024", "bytes": 101, "sha256": "b" * 64, "original_language": "fr-FR", "document_date": "12/03/2024"},
            "extraction": {"generated_at": "2026-08-24T00:00:00Z", "engine": "python-html-parser"},
            "pages": [{"page_id": "page-fr", "segments": [{"segment_id": "seg-fr", "text": "Le témoin observe un OVNI."}]}],
            "segments": [],
        }
        translation = {
            "schema": "ufo-files-french-translation/v1",
            "document_id": document["document_id"],
            "translation": {"review_status": "machine-unreviewed"},
            "pages": [{"page_id": "page-fr", "segments": [{"segment_id": "seg-fr", "source_segment_id": "seg-fr", "text": "The witness observes a UFO.", "status": "machine-unreviewed"}]}],
            "segments": [],
        }
        (pair / "document.json").write_text(json.dumps(document), encoding="utf-8")
        (pair / "fr-FR" / "canonical.json").write_text(json.dumps(canonical), encoding="utf-8")
        (pair / "en" / "translation.json").write_text(json.dumps(translation), encoding="utf-8")
        search_metadata = {"schema": "ufo-files-french-search-text/v1", "document_id": document["document_id"], "language": "en", "canonical": False}
        (pair / "en" / "translation.txt").write_text(json.dumps(search_metadata) + "\n\nThe witness observes a UFO.\n", encoding="utf-8")
        return pair

    def test_reads_french_pair_with_shared_segment_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            pair = self.write_pair(Path(directory))
            parsed = read_language_pair(pair / "document.json")
        self.assertEqual(parsed["segment_ids"], ["seg-fr"])
        self.assertEqual(parsed["metadata"]["original_language"], "fr-FR")
        self.assertEqual(parsed["metadata"]["jurisdiction"], "France")

    def test_selects_only_requested_canonical_language(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pair = self.write_pair(root)
            selected = machine_data_paths(root, "fr-FR")
        self.assertEqual(selected, [pair / "document.json"])

    def test_catalog_builds_from_french_canonical_pair(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            self.write_pair(root)
            catalog = build(root, Path(directory) / "catalog.json", 100, 100, paired_language="fr-FR")
        self.assertEqual(len(catalog["documents"]), 1)
        document = catalog["documents"][0]
        self.assertEqual(document["id"], "doc-french-stable")
        self.assertEqual(document["title"], "TOULOUSE (31) 12.03.2024")
        self.assertEqual(document["documentDate"], "2024-03-12")
        self.assertEqual(document["originalLanguage"], "fr-FR")
        self.assertEqual(document["jurisdiction"], "France")
        self.assertEqual(document["countryCode"], "FR")
        self.assertTrue(document["canonicalPath"].endswith("fr-FR/canonical.json"))
        france = next(entity for entity in catalog["entities"] if entity["canonicalName"] == "France")
        self.assertEqual(france["category"], "location")
        self.assertEqual(france["documentIds"], ["doc-french-stable"])
        self.assertEqual(france["geo"]["precision"], "country")

    def test_default_catalog_builds_from_french_english_derivative(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            self.write_pair(root)
            catalog = build(root, Path(directory) / "catalog.json", 100, 100)
        self.assertEqual(len(catalog["documents"]), 1)
        document = catalog["documents"][0]
        self.assertEqual(document["id"], "doc-french-stable")
        self.assertEqual(document["title"], "TOULOUSE (31) 12.03.2024")
        self.assertEqual(document["documentDate"], "2024-03-12")
        self.assertEqual(document["originalLanguage"], "fr-FR")
        self.assertEqual(document["jurisdiction"], "France")
        self.assertTrue(document["translationPath"].endswith("en/translation.json"))

    def test_default_catalog_rejects_mismatched_canonical_provenance(self):
        mutations = {
            "schema": "ufo-files-portuguese-canonical/v1",
            "document_id": "different-document",
            "canonical_language": "pt-BR",
        }
        for field, value in mutations.items():
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "machine-data"
                pair = self.write_pair(root)
                canonical_path = pair / "fr-FR" / "canonical.json"
                canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
                canonical[field] = value
                canonical_path.write_text(json.dumps(canonical), encoding="utf-8")

                catalog = build(root, Path(directory) / "catalog.json", 100, 100)

            self.assertEqual(catalog["documents"], [])

    def test_default_catalog_rejects_an_unreadable_canonical_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            pair = self.write_pair(root)
            (pair / "fr-FR" / "canonical.json").write_text("{malformed", encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100)

        self.assertEqual(catalog["documents"], [])

    def test_default_catalog_requires_canonical_json_inside_the_pair(self):
        for condition in ("missing", "outside-pair"):
            with self.subTest(condition=condition), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "machine-data"
                pair = self.write_pair(root)
                document_path = pair / "document.json"
                document = json.loads(document_path.read_text(encoding="utf-8"))
                if condition == "missing":
                    document.pop("canonical_path")
                else:
                    document["canonical_path"] = "../../../../../outside-canonical.json"
                document_path.write_text(json.dumps(document), encoding="utf-8")

                catalog = build(root, Path(directory) / "catalog.json", 100, 100)

            self.assertEqual(catalog["documents"], [])

    def test_default_catalog_rejects_malformed_canonical_containers(self):
        mutations = (
            {"pages": None},
            {"pages": [None]},
            {"pages": [{"segments": None}]},
            {"pages": [{"segments": [None]}]},
        )
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "machine-data"
                pair = self.write_pair(root)
                canonical_path = pair / "fr-FR" / "canonical.json"
                canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
                canonical.update(mutation)
                canonical_path.write_text(json.dumps(canonical), encoding="utf-8")

                catalog = build(root, Path(directory) / "catalog.json", 100, 100)

            self.assertEqual(catalog["documents"], [])

    def test_default_catalog_requires_exact_french_document_manifest(self):
        mutations = ({"schema": None}, {"canonical_language": None}, {"canonical_language": "pt-BR"})
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "machine-data"
                pair = self.write_pair(root)
                document_path = pair / "document.json"
                document = json.loads(document_path.read_text(encoding="utf-8"))
                document.update(mutation)
                document_path.write_text(json.dumps(document), encoding="utf-8")

                catalog = build(root, Path(directory) / "catalog.json", 100, 100)

            self.assertEqual(catalog["documents"], [])

    def test_canonical_catalog_allows_explicitly_unavailable_translation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            pair = self.write_pair(root)
            document_path = pair / "document.json"
            document = json.loads(document_path.read_text(encoding="utf-8"))
            document["translation_available"] = False
            document.pop("translation_path")
            document["available_languages"] = ["fr-FR"]
            document_path.write_text(json.dumps(document), encoding="utf-8")
            (pair / "en" / "translation.json").unlink()

            catalog = build(
                root, Path(directory) / "catalog.json", 100, 100, paired_language="fr-FR"
            )

        self.assertEqual(len(catalog["documents"]), 1)
        self.assertFalse(catalog["documents"][0]["translationAvailable"])
        self.assertIsNone(catalog["documents"][0]["translationPath"])

    def test_french_event_verbs_preserve_specific_event_types(self):
        examples = {
            "landing": "Le 12 mars 2024, un OVNI a atterri.",
            "crash": "Le 12 mars 2024, un OVNI s'est écrasé.",
            "encounter": "Le 12 mars 2024, le témoin a rencontré un OVNI.",
        }
        for expected, text in examples.items():
            with self.subTest(expected=expected):
                _, events, _ = temporal_candidates([text], {}, f"doc-{expected}")
                self.assertEqual(events[0]["eventType"], expected)

    def test_french_present_tense_sighting_verbs_publish_events(self):
        for verb in ("observe", "voit", "aperçoit"):
            with self.subTest(verb=verb):
                _, events, _ = temporal_candidates(
                    [f"Le 12 mars 2024, le témoin {verb} un OVNI."], {}, f"doc-{verb}"
                )
                self.assertEqual(events[0]["eventType"], "sighting")

    def test_french_relationship_cues_publish_typed_single_segment_edges(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "machine-data"
            pair = self.write_pair(root)
            canonical_path = pair / "fr-FR" / "canonical.json"
            canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
            canonical["pages"][0]["segments"][0]["text"] = "Avi Loeb travaille pour NASA."
            canonical_path.write_text(json.dumps(canonical), encoding="utf-8")

            catalog = build(root, Path(directory) / "catalog.json", 100, 100, paired_language="fr-FR")

        self.assertTrue(any(edge["relationship"] == "affiliated_with" for edge in catalog["edges"]))

    def test_default_catalog_requires_translation_json_inside_the_pair(self):
        for condition in ("missing", "outside-pair"):
            with self.subTest(condition=condition), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "machine-data"
                pair = self.write_pair(root)
                if condition == "missing":
                    (pair / "en" / "translation.json").unlink()
                else:
                    document_path = pair / "document.json"
                    document = json.loads(document_path.read_text(encoding="utf-8"))
                    document["translation_path"] = "../../../outside-translation.json"
                    document_path.write_text(json.dumps(document), encoding="utf-8")

                catalog = build(root, Path(directory) / "catalog.json", 100, 100)

            self.assertEqual(catalog["documents"], [])

    def test_default_catalog_rejects_empty_or_misaligned_translations(self):
        for condition in ("all-failed", "stale-id", "duplicate-id", "source-id-mismatch"):
            with self.subTest(condition=condition), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "machine-data"
                pair = self.write_pair(root)
                translation_path = pair / "en" / "translation.json"
                translation = json.loads(translation_path.read_text(encoding="utf-8"))
                segment = translation["pages"][0]["segments"][0]
                if condition == "all-failed":
                    segment["status"] = "failed-protected-token-check"
                elif condition == "stale-id":
                    segment["segment_id"] = segment["source_segment_id"] = "seg-stale"
                elif condition == "duplicate-id":
                    translation["pages"][0]["segments"].append(dict(segment))
                else:
                    segment["source_segment_id"] = "seg-other"
                translation_path.write_text(json.dumps(translation), encoding="utf-8")

                catalog = build(root, Path(directory) / "catalog.json", 100, 100)

            self.assertEqual(catalog["documents"], [])

    def test_extracts_people_with_french_diacritics(self):
        mentions = extract_mentions("Colonel Benoît Dupont a témoigné.", {})

        self.assertTrue(
            any(
                raw == "Colonel Benoît Dupont" and canonical == "Benoît Dupont" and category == "person"
                for raw, canonical, category, _, _ in mentions
            )
        )
        for name in ("Benoît Dupont", "Étienne Dupont", "Jacques Dupont"):
            with self.subTest(name=name):
                mentions = extract_mentions(f"{name} a témoigné.", {})
                self.assertTrue(
                    any(canonical == name and category == "person" for _, canonical, category, _, _ in mentions)
                )

    def test_extracts_people_with_compound_french_given_names(self):
        for name in ("Jean-Pierre Dupont", "Marie-Claire Dupont"):
            with self.subTest(name=name):
                mentions = extract_mentions(f"{name} observe un OVNI.", {})
                self.assertTrue(
                    any(canonical == name and category == "person" for _, canonical, category, _, _ in mentions)
                )

    def test_extracts_french_sighting_dates_and_events(self):
        segments = ["Le 12 mars 2024, le témoin a observé un OVNI."]

        document_date, events, review = temporal_candidates(
            segments, {}, "doc-french-event", ["seg-french-event"]
        )

        self.assertIsNone(document_date)
        self.assertEqual(events[0]["startDate"], "2024-03-12")
        self.assertEqual(events[0]["eventType"], "sighting")
        self.assertEqual(events[0]["evidence"][0]["segment"], "seg-french-event")
        self.assertEqual(review[0]["kind"], "event_date")


if __name__ == "__main__":
    unittest.main()
