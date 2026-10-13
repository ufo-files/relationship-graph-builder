import json
from pathlib import Path
import tempfile
import unittest
from scripts.build_catalog import machine_data_paths, read_ocr

class MultilingualExportTests(unittest.TestCase):
    def fixture(self, root, collection='Chile-SEFAA', code='es', version=7):
        source_rel=collection+'/documents/report.pdf';sha='a'*64
        pair=root/collection/'paired/documents/report.pdf'/('a-b-v'+str(version))
        (pair/code).mkdir(parents=True);(pair/'en').mkdir()
        text='El piloto observó una luz sobre la montaña.' if code=='es' else 'Il pilota vide una luce sopra la montagna.'
        english='The pilot observed a light above the mountain.'
        schema=f'multilingual-paired/v{version}'
        def save(p, data):p.write_text(json.dumps(data))
        save(pair/'provenance.json',dict(schema=schema,version=schema,source_rel=source_rel,source_sha256=sha,ocr_sha256='b'*64,
             source=dict(relative_path='documents/report.pdf',original_language=code+'-CL',sha256=sha,bytes=100,title='Report'),
             extraction=dict(source_sha256=sha,source_file=source_rel),generated_at='2026-10-13T00:00:00Z'))
        save(pair/'qa.json',dict(status='pass',human_reviewed=False))
        save(pair/code/'canonical.json',dict(schema=schema,language=code,segments=[dict(id='s1',text=text)]))
        (pair/code/'canonical.txt').write_text(text+'\n')
        save(pair/'en/translation.json',dict(schema=schema,language='en',machine_translated=True,human_reviewed=False,segments=[dict(id='s1',text=english)]))
        (pair/'en/translation.txt').write_text(english+'\n')
        return pair/'en/translation.txt'

    def test_spanish_and_italian_exports_are_indexed_with_provenance(self):
        for collection,code in [('Chile-SEFAA','es'),('Argentina-CIAE-CEFAE','es'),('Italy-Aeronautica-Militare-OVNI','it')]:
            with tempfile.TemporaryDirectory() as d:
                root=Path(d);path=self.fixture(root,collection,code)
                self.assertEqual(machine_data_paths(root),[path])
                metadata,segments=read_ocr(path)
                self.assertEqual(metadata['source_file'],collection+'/documents/report.pdf')
                self.assertEqual(metadata['translation_review_status'],'needs-review')
                self.assertEqual(metadata['available_languages'],[code,'en'])
                self.assertEqual(segments,['The pilot observed a light above the mountain.'])

    def test_failed_qa_mismatched_source_and_modified_text_are_rejected(self):
        for mutation in ['qa','source','translation','canonical','ids']:
            with tempfile.TemporaryDirectory() as d:
                root=Path(d);path=self.fixture(root);pair=path.parent.parent
                if mutation=='qa':(pair/'qa.json').write_text('{"status":"failed"}')
                elif mutation=='source':
                    p=pair/'provenance.json';data=json.loads(p.read_text());data['source']['sha256']='c'*64;p.write_text(json.dumps(data))
                elif mutation=='translation':path.write_text('Changed text\n')
                elif mutation=='canonical':(pair/'es/canonical.txt').write_text('Changed source\n')
                else:
                    p=pair/'en/translation.json';data=json.loads(p.read_text());data['segments'][0]['id']='different';p.write_text(json.dumps(data))
                self.assertIsNone(read_ocr(path),mutation);self.assertEqual(machine_data_paths(root),[],mutation)

    def test_only_latest_valid_export_is_counted(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);old=self.fixture(root,version=6);new=self.fixture(root,version=7)
            self.assertEqual(machine_data_paths(root),[new])
            (new.parent.parent/'qa.json').write_text('{"status":"failed"}')
            self.assertEqual(machine_data_paths(root),[old])

    def test_original_ocr_is_not_double_counted(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);path=self.fixture(root);legacy=root/'Chile-SEFAA/legacy.txt';legacy.write_text('{"schema":"ufo-files-archive-ocr/v1"}\noriginal OCR')
            self.assertEqual(machine_data_paths(root),[path])
