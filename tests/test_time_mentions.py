import json
import tempfile
import unittest
from pathlib import Path

from scripts.time_mentions import time_observations_for_segment
from scripts.build_clock_times import build_clock_times
from scripts.build_catalog import build


class TimeMentionTests(unittest.TestCase):
    def extract(self, text):
        return time_observations_for_segment(text, 'doc-one', 'Example', 'page-3')

    def test_periods_and_24_hour_notation(self):
        rows = self.extract('At 3:15 a.m. and 12 PM, then 2305 hours and at 24:00 UTC.')
        self.assertEqual([(r['hour24'], r['minute']) for r in rows], [(3, 15), (12, 0), (23, 5), (0, 0)])
        self.assertEqual(rows[-1]['zone'], 'UTC')

    def test_unqualified_hour_is_not_assumed_to_be_am(self):
        rows = self.extract('It happened at 4:30. At 16:30 it ended.')
        self.assertEqual(rows[0]['hour24'], None)
        self.assertEqual(rows[0]['period'], 'unspecified')
        self.assertEqual(rows[1]['period'], 'pm')
        self.assertEqual(rows[0]['minuteOfDial'], rows[1]['minuteOfDial'])

    def test_spoken_and_named_times(self):
        rows = self.extract("At noon, midnight, six o'clock, three in the morning, and quarter to twelve AM.")
        self.assertEqual([r['minuteOfDial'] for r in rows], [0, 0, 360, 180, 705])
        self.assertEqual(rows[-1]['hour24'], 23)
        self.assertEqual(rows[-1]['minute'], 45)
        self.assertEqual(self.extract('half past four PM')[0]['hour24'], 16)

    def test_rejects_durations_citations_invalid_times_and_playback_markers(self):
        for text in ['John 3:16', 'ratio 16:09', '[00:34]', '00:34 --> 00:40',
                     'at 1:30 minutes', 'at 25:00', '13 PM', 'at 12:99', 'at 24:30',
                     '3.15 volts', 'Version 3.15', '2026-10-17']:
            self.assertEqual(self.extract(text), [], text)

    def test_offsets_repeats_and_original_zone(self):
        text = 'At 10:30 PM EST. At 10:30 PM EST.'
        rows = self.extract(text)
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(rows[0]['id'], rows[1]['id'])
        for row in rows:
            self.assertEqual(text[row['start']:row['end']], row['matchedText'])
            self.assertEqual(row['segment'], 'page-3')
            self.assertEqual(row['zone'], 'EST')

    def test_compact_and_full_build_publish_the_same_times(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'input'
            collection = root / 'Example'
            collection.mkdir(parents=True)
            metadata = {'schema': 'ufo-files-archive-ocr/v1', 'source_file': 'report.pdf'}
            (collection / 'report.txt').write_text(json.dumps(metadata) + '\n\nNASA met at 4:30 PM. NASA met at noon.', encoding='utf-8')
            media = {'schema': 'ufo-files-archive-media-transcripts/v1', 'source_file': 'interview.mp4'}
            (collection / 'talk.source.json').write_text(json.dumps(media), encoding='utf-8')
            (collection / 'talk.tsv').write_text('start\tend\ttext\n33000\t38000\tNASA arrived at 5 AM.\n', encoding='utf-8')
            compact = build_clock_times(root, Path(directory) / 'compact.json', 'ufo-files/machine-data', 'revision', require_data=True)
            build(root, Path(directory) / 'full/catalog.json', 100, 100, require_data=True)
            full = json.loads((Path(directory) / 'full/clock_times.json').read_text())
            self.assertEqual(compact['observations'], full['observations'])
            self.assertEqual(compact['counts'], full['counts'])
            self.assertEqual(compact['counts']['mentions'], 3)
            self.assertEqual(len(compact['documents']), 2)
            self.assertTrue(all(r['documentId'] in {d['id'] for d in compact['documents']} for r in compact['observations']))


if __name__ == '__main__':
    unittest.main()
