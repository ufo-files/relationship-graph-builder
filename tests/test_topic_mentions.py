import json
import tempfile
import unittest
from pathlib import Path

from scripts.topic_mentions import TOPICS, topic_observations_for_segment, write_topic_catalogs
from scripts.build_topic_mentions import build_topic_mentions
from scripts.build_catalog import build


class TopicMentionTests(unittest.TestCase):
    def extract(self, text):
        return topic_observations_for_segment(text, "doc-one", "Example", "page-3")

    def test_requested_terms_and_spelling_variants(self):
        rows = self.extract("LSD-25, DMT, psilliciban and psilocybin; radar, psionics and EMP.")
        self.assertEqual([row["termId"] for row in rows["drugs"]], ["lsd", "dmt", "psilocybin", "psilocybin"])
        self.assertEqual([row["termId"] for row in rows["technologies"]], ["radar", "psionics", "emp"])

    def test_long_aliases_are_one_occurrence(self):
        rows = self.extract("Lysergic acid diethylamide; 5-MeO-DMT; N,N-dimethyltryptamine; electromagnetic pulse.")
        self.assertEqual([row["termId"] for row in rows["drugs"]], ["lsd", "5-meo-dmt", "dmt"])
        self.assertEqual(len(rows["technologies"]), 1)
        self.assertEqual(rows["technologies"][0]["matchedText"], "electromagnetic pulse")

    def test_ambiguous_words_and_substrings_are_excluded(self):
        rows = self.extract("acid rain, pot plants, mushrooms, AI, psi, empirical and radarology")
        self.assertEqual(rows, {topic: [] for topic in TOPICS})

    def test_original_offsets_repeats_and_stable_ids(self):
        text = "DMT at noon. DMT again; remote-viewing and anti-gravity."
        rows = self.extract(text)
        self.assertEqual(rows, self.extract(text))
        self.assertEqual(len(rows["drugs"]), 2)
        self.assertNotEqual(rows["drugs"][0]["id"], rows["drugs"][1]["id"])
        for observations in rows.values():
            for row in observations:
                self.assertEqual(text[row["start"]:row["end"]], row["matchedText"])
                self.assertEqual(row["segment"], "page-3")

    def test_shards_are_bounded_and_obsolete_files_are_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            rows = self.extract("LSD " * 10 + "radar")
            docs = [{"id": "doc-one", "source": "Example", "path": "Example/test.txt", "title": "Test"}]
            catalogs = write_topic_catalogs(directory, rows, docs, {}, "now", max_bytes=1000)
            self.assertGreater(len(catalogs["drugs"]["parts"]), 1)
            self.assertTrue(all(p.stat().st_size <= 1000 for p in directory.glob("*-*.json")))
            recovered = [row for part in catalogs["drugs"]["parts"] for row in json.loads((directory / part).read_text())]
            self.assertEqual(recovered, rows["drugs"])
            catalogs = write_topic_catalogs(directory, self.extract("radar"), docs, {}, "later", max_bytes=1000)
            self.assertEqual(catalogs["drugs"]["parts"], [])
            self.assertEqual(list(directory.glob("drugs-*.json")), [])

    def test_full_and_topic_only_builds_agree(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            root = directory / "input"
            (root / "Example").mkdir(parents=True)
            meta = {"schema": "ufo-files-archive-ocr/v1", "source_file": "report.pdf"}
            (root / "Example/report.txt").write_text(json.dumps(meta) + "\n\nNASA mentioned LSD and radar. DMT and EMP followed.")
            compact = build_topic_mentions(root, directory / "compact", "repo", "revision", require_data=True)
            build(root, directory / "full/catalog.json", 100, 100, require_data=True)
            for topic in TOPICS:
                full = json.loads((directory / f"full/topic-mentions/{topic}.json").read_text())
                self.assertEqual(full["counts"], compact[topic]["counts"])
                self.assertEqual(full["documents"], compact[topic]["documents"])
                for part in full["parts"]:
                    self.assertEqual((directory / f"full/topic-mentions/{part}").read_text(), (directory / "compact" / part).read_text())
            with self.assertRaises(ValueError):
                build_topic_mentions(directory / "empty", directory / "empty-out", "repo", "revision", require_data=True)
