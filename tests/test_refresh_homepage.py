import json
from pathlib import Path
import tempfile
import unittest

from scripts.refresh_homepage import refresh


class HomepageRefreshTests(unittest.TestCase):
    def test_completed_snapshot_records_provenance_without_changing_homepage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'index.html').write_text('original homepage')
            refresh(root, 'a' * 40, 'c' * 40, 'https://github.com/ufo-files/relationship-graph-builder/actions/runs/123')
            snapshot = (root / 'data/graph-refresh-request.json').read_text()
            self.assertEqual(json.loads(snapshot), {
                'graphRevision': 'a' * 40, 'machineDataRevision': 'c' * 40,
                'screenshotRun': 'https://github.com/ufo-files/relationship-graph-builder/actions/runs/123'})
            self.assertEqual((root / 'index.html').read_text(), 'original homepage')
            refresh(root, 'a' * 40, 'c' * 40, 'https://github.com/ufo-files/relationship-graph-builder/actions/runs/123')
            self.assertEqual((root / 'data/graph-refresh-request.json').read_text(), snapshot)

    def test_invalid_snapshot_does_not_write_a_request(self):
        for revision, url in [('main', 'https://github.com/ufo-files/relationship-graph-builder/actions/runs/123'),
                              ('a' * 40, 'https://example.com/untrusted')]:
            with self.subTest(revision=revision), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                with self.assertRaises(ValueError):
                    refresh(root, revision, 'c' * 40, url)
                self.assertFalse((root / 'data').exists())
