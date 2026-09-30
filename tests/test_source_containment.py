import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.build_catalog import build, machine_data_paths


class SourceContainmentTests(unittest.TestCase):
    def test_rejects_links_before_any_source_or_configuration_read(self):
        for relative in ('Example/leak.tsv', 'Example/leak.pdf.txt', 'Example/leak.source.json',
                         'Example/paired/case/document.json', 'Example/paired/case/en/translation.json',
                         'config/epistemic_qualifiers.json', 'Example/linked-directory'):
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp)
                root = base / 'input'
                link = root / relative
                link.parent.mkdir(parents=True)
                target = base / 'private.txt'
                target.write_text('FAKE_PRIVATE_CONTENT')
                link.symlink_to(target)
                output = base / 'output/catalog.json'
                with patch.object(Path, 'read_text', side_effect=AssertionError('Read before containment check')):
                    with self.assertRaisesRegex(ValueError, 'Unsafe source input entry'):
                        build(root, output, 100, 100, require_data=True)
                self.assertFalse(output.exists())

    def test_rejects_directory_in_root_broken_and_root_symlinks(self):
        for kind in ('directory', 'in-root', 'broken', 'root'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp)
                root = base / 'input'
                root.mkdir()
                target = base / 'target'
                target.mkdir()
                if kind == 'root':
                    root = base / 'input-link'
                    root.symlink_to(target, target_is_directory=True)
                else:
                    destination = {'directory': target, 'in-root': root / 'valid.txt', 'broken': base / 'missing'}[kind]
                    if kind == 'in-root':
                        destination.write_text('normal source')
                    (root / 'link.txt').symlink_to(destination, target_is_directory=kind == 'directory')
                with self.assertRaises(ValueError):
                    machine_data_paths(root)

    def test_rejects_special_files_without_opening_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            os.mkfifo(root / 'source.txt')
            with self.assertRaisesRegex(ValueError, 'Unsafe source input entry'):
                machine_data_paths(root)

    def test_regular_transcript_still_builds(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            root = base / 'input'
            source = root / 'Example/report.tsv'
            source.parent.mkdir(parents=True)
            source.write_text('start\tend\ttext\n0\t1000\tThe Federal Bureau of Investigation reviewed the archived account.\n')
            source.with_suffix('.source.json').write_text(json.dumps({'schema': 'ufo-files-archive-media-transcripts/v1'}))
            output = base / 'output/catalog.json'
            catalog = build(root, output, 100, 100, require_data=True)
            self.assertEqual(catalog['counts']['documents'], 1)
            self.assertTrue(output.exists())
