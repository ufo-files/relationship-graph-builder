import functools
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

from scripts.serve_preview import PreviewHandler


class PreviewSecurityTests(unittest.TestCase):
    def test_only_public_files_are_served(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.git').mkdir()
            (root / '.git/config').write_text('FAKE_CHECKOUT_CREDENTIAL')
            (root / 'index.html').write_text('public page')
            (root / 'data').mkdir()
            (root / 'data/catalog.json').write_text('{}')
            (root / 'data/.secret').write_text('FAKE_SECRET')
            (root / 'data/leak.json').symlink_to(root / '.git/config')
            (root / 'data/link').symlink_to(root / '.git', target_is_directory=True)
            (root / 'package.json').write_text('private checkout metadata')
            handler = functools.partial(PreviewHandler, directory=directory)
            with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
                worker = threading.Thread(target=server.serve_forever)
                worker.start()
                try:
                    for method in ('GET', 'HEAD'):
                        for path in ('/.git/config', '/%2egit/config', '/data/../.git/config',
                                     '/data/%2e%2e/%2egit/config', '/data/.secret', '/data/leak.json',
                                     '/data/link/config', '/data/', '/package.json', '/scripts/build_catalog.py'):
                            with self.subTest(method=method, path=path):
                                connection = HTTPConnection(*server.server_address, timeout=5)
                                connection.request(method, path)
                                response = connection.getresponse()
                                self.assertEqual(response.status, 404)
                                self.assertNotIn(b'FAKE_', response.read())
                                connection.close()
                    for path, expected in (('/', b'public page'), ('/index.html?test=1', b'public page'),
                                           ('/data/catalog.json', b'{}')):
                        connection = HTTPConnection(*server.server_address, timeout=5)
                        connection.request('GET', path)
                        response = connection.getresponse()
                        self.assertEqual(response.status, 200)
                        self.assertEqual(response.read(), expected)
                        connection.close()
                finally:
                    server.shutdown()
                    worker.join()
