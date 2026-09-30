import os
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


class CatalogPublishingTests(unittest.TestCase):
    def test_publish_accepts_original_base_and_rejects_advanced_main(self):
        workflow = Path(__file__).resolve().parents[1] / '.github/workflows/rebuild-graph.yml'
        publish = workflow.read_text().split('      - name: Commit refreshed catalog\n', 1)[1]
        # Exercise the actual workflow push/retry block, not a modeled algorithm.
        tail = publish[publish.index('          for attempt in 1 2 3; do'):]
        script = textwrap.dedent(tail)
        for advanced in (False, True):
            with self.subTest(advanced=advanced), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                environment = dict(os.environ, GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
                                   GIT_AUTHOR_NAME='Test', GIT_AUTHOR_EMAIL='test@example.invalid',
                                   GIT_COMMITTER_NAME='Test', GIT_COMMITTER_EMAIL='test@example.invalid')

                def git(*args, cwd=root):
                    return subprocess.run(['git', *args], cwd=cwd, env=environment,
                                          check=True, capture_output=True, text=True).stdout.strip()

                remote = root / 'remote.git'
                git('init', '--bare', '--initial-branch=main', str(remote))
                git('clone', str(remote), 'builder')
                builder = root / 'builder'
                (builder / 'builder.txt').write_text('version one')
                (builder / 'catalog.json').write_text('original catalog')
                git('add', '.', cwd=builder)
                git('commit', '-m', 'base', cwd=builder)
                git('push', 'origin', 'HEAD:main', cwd=builder)
                base = git('rev-parse', 'HEAD', cwd=builder)
                git('clone', str(remote), 'writer')
                writer = root / 'writer'
                (builder / 'catalog.json').write_text('generated for version one')
                git('commit', '-am', 'generated catalog', cwd=builder)
                generated = git('rev-parse', 'HEAD', cwd=builder)
                if advanced:
                    (writer / 'builder.txt').write_text('version two')
                    git('commit', '-am', 'new builder', cwd=writer)
                    git('push', 'origin', 'HEAD:main', cwd=writer)
                before = git('rev-parse', 'main', cwd=remote)
                result = subprocess.run(['bash', '-e', '-c', script], cwd=builder, env=environment,
                                        capture_output=True, text=True, timeout=20)
                after = git('rev-parse', 'main', cwd=remote)
                if advanced:
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertIn('refusing to publish stale catalog', result.stderr)
                    self.assertEqual(after, before)
                    self.assertEqual(git('show', 'main:catalog.json', cwd=remote), 'original catalog')
                else:
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertEqual(after, generated)
                    self.assertEqual(git('rev-parse', 'main^', cwd=remote), base)
                    self.assertEqual(git('show', 'main:catalog.json', cwd=remote), 'generated for version one')
                self.assertEqual(git('rev-parse', 'HEAD', cwd=builder), generated)
