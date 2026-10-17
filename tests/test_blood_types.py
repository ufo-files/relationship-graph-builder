import unittest
import json
import tempfile
from pathlib import Path

from scripts.build_catalog import blood_type_observations_for_segment, build


class BloodTypeTests(unittest.TestCase):
    def extract(self, text):
        return blood_type_observations_for_segment(text, 'doc-1', 'Collection', 'page-7')

    def test_abo_rh_and_unspecified_remain_separate(self):
        rows = self.extract('Blood type O negative; blood group AB+; Rh-negative; blood types; blood type A.')
        self.assertEqual([r['bloodType'] for r in rows], ['O-', 'AB+', 'Rh negative', 'Unspecified', 'A'])
        self.assertEqual(rows[2]['abo'], 'unspecified')
        self.assertEqual(rows[-1]['rh'], 'unspecified')

    def test_false_positives_and_context(self):
        self.assertEqual(self.extract('A positive outcome, B negative feedback. A+ rating. O- ring.'), [])
        self.assertEqual([r['bloodType'] for r in self.extract('Her blood was tested: she is O-negative.')], ['O-'])

    def test_original_offsets_repeats_negation_and_segment(self):
        text = 'She is not Rh negative. She is not Rh negative.'
        rows = self.extract(text)
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(rows[0]['id'], rows[1]['id'])
        for row in rows:
            self.assertEqual(text[row['start']:row['end']], row['matchedText'])
            self.assertEqual(row['segment'], 'page-7')
            self.assertIn('not Rh negative', row['excerpt'])

    def test_ocr_spacing_and_case(self):
        self.assertEqual([r['bloodType'] for r in self.extract('BLOOD\nTYPE: ab positive. Rhesus factor negative.')], ['AB+', 'Rh negative'])

    def test_type_before_blood_and_common_articles(self):
        self.assertEqual([r['bloodType'] for r in self.extract('ALL SHARE THE A+ BLOOD TYPES. O-negative blood.')], ['A+', 'O-'])
        self.assertEqual(self.extract('a blood test and the blood type a person has'), [])
        self.assertEqual(self.extract('A blood-red rain. A blood transfusion. A Blood Covenant.'), [])
        self.assertEqual(self.extract('A photographic negative image but a positive image. The blood on the shroud.'), [])
        self.assertEqual(self.extract('A towel gave a positive phenolphthalein test for blood.'), [])
        self.assertEqual(self.extract('The baby has a + blood type.'), [])

    def test_catalog_publishes_mentions_with_resolvable_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'machine-data'
            collection = root / 'Example'
            collection.mkdir(parents=True)
            metadata = {'schema': 'ufo-files-archive-ocr/v1', 'source_file': 'interview.pdf'}
            (collection / 'interview.txt').write_text(json.dumps(metadata) + '\n\nNASA discussed blood type O negative. NASA discussed Rh negative.', encoding='utf-8')
            catalog = build(root, Path(directory) / 'catalog.json', 100, 100, require_data=True)
            rows = catalog['bloodTypes']['observations']
            self.assertEqual([r['bloodType'] for r in rows], ['O-', 'Rh negative'])
            self.assertTrue(all(r['documentId'] == catalog['documents'][0]['id'] for r in rows))
            self.assertTrue(all(r['source'] == 'Example' for r in rows))


if __name__ == '__main__':
    unittest.main()
