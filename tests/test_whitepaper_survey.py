import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class WhitepaperSurveyTests(unittest.TestCase):
    def test_search_separates_candidates_metadata_and_excluded_files(self):
        project = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'corpus'
            root.mkdir()
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', '-C', str(root), '-c', 'user.name=Test',
                            '-c', 'user.email=test@example.invalid', 'commit',
                            '--allow-empty', '-qm', 'Fixture snapshot'], check=True)
            paths = {
                'Archive/first.txt': '{"source_file":"roswell.pdf"}\n\nRoutine unrelated note.',
                'Archive/witness.txt': '{"schema":"fixture"}\n\nA witness alleges a Roswell crash retrieval.',
                'Archive/copy.txt': '{"created":"different"}\n\nA witness alleges a Roswell crash retrieval.',
                'Archive/en/translation.txt': '{"canonical":false}\n\nRemote viewing was proposed, not verified.',
                'Archive/quarantine/rejected.txt': 'Roswell and psionics',
                'scripts/utility.txt': 'Roswell and psionics',
            }
            for path, text in paths.items():
                file = root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(text)
            output = Path(directory) / 'survey'
            binaries = Path(directory) / 'bin'
            binaries.mkdir()
            (binaries / 'git').symlink_to(shutil.which('git'))
            result = subprocess.run([sys.executable, str(project / 'scripts/survey_whitepaper.py'),
                            '--corpus-root', str(root), '--output', str(output)],
                           env={**os.environ, 'PATH': str(binaries)}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            summary = json.loads((output / 'survey.json').read_text())
            ledger = json.loads(gzip.decompress((output / 'screening.json.gz').read_bytes()))
            candidates = {item['path']: item for item in ledger['candidates']}
            self.assertEqual(summary['scannedDocuments'], 4)
            self.assertEqual(summary['candidateDocuments'], 3)
            self.assertNotIn('Archive/first.txt', candidates)
            self.assertNotIn('Archive/quarantine/rejected.txt', candidates)
            self.assertEqual(candidates['Archive/witness.txt']['reviewStatus'], 'unreviewed-search-hit')
            self.assertTrue(candidates['Archive/en/translation.txt']['translationDerivative'])
            self.assertEqual(summary['exactNormalizedDuplicateGroups'], 1)
            self.assertEqual(summary['queryMatches']['roswell'], 2)
            self.assertEqual(summary['queryMatches']['consciousness'], 1)
            self.assertEqual(ledger['corpusRevision'], summary['corpusRevision'])
            self.assertEqual(ledger['querySha256'], summary['querySha256'])
