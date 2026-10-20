#!/usr/bin/env python3
"""Survey the local text corpus reproducibly; matches are candidates, not evidence."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--corpus-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[1]
    query_path = project / 'data/whitepaper-research/queries.json'
    query_bytes = query_path.read_bytes()
    protocol = json.loads(query_bytes)
    queries = [(q['id'], re.compile(q['pattern'], re.I), q.get('prefilterAny', [])) for q in protocol['queries']]
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=args.corpus_root, text=True).strip()
    if shutil.which('rg'):
        listing = subprocess.check_output(['rg', '--files', '-g', '*.txt', '-g', '*.tsv'], cwd=args.corpus_root, text=True).splitlines()
    else:
        # Minimal CI images may lack ripgrep. Keep discovery within this Git checkout.
        raw = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z',
                                       '--', '*.txt', '*.tsv'], cwd=args.corpus_root, text=True)
        listing = [path for path in raw.split('\0') if path and not any(part.startswith('.') for part in Path(path).parts)]
    collections = Counter()
    exclusions = Counter()
    matched_by_query = Counter()
    query_collections = defaultdict(Counter)
    candidates = []
    inventory = hashlib.sha256()
    duplicates = defaultdict(list)
    errors = []
    total_bytes = 0
    for rel in sorted(set(listing)):
        path = Path(rel)
        if not path.parts[0][0].isupper():
            exclusions['tooling_or_metadata'] += 1
            continue
        if any(part in {'quarantine', 'originals', 'translated-failed', 'failed'} for part in path.parts):
            exclusions['quarantined_or_noncanonical'] += 1
            continue
        try:
            content = (args.corpus_root / rel).read_bytes()
            text = content.decode('utf8')
        except (OSError, UnicodeError) as error:
            errors.append({'path': rel, 'error': str(error)})
            continue
        source = path.parts[0]
        collections[source] += 1
        total_bytes += len(content)
        digest = hashlib.sha256(content).hexdigest()
        inventory.update((rel+'\0'+digest+'\n').encode())
        body = text
        if body.startswith('{'):
            body = body.partition('\n')[2]
        # Exact normalized text only. This does not detect near-duplicates or common origins.
        normalized = re.sub(r'===== PAGE \d+ =====|\{[^\n]+\}', '', body)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        body_hash = hashlib.sha256(normalized.encode()).hexdigest()
        hits = []
        first_matches = {}
        lower = body.lower()
        for id, pattern, seeds in queries:
            if seeds and not any(seed in lower for seed in seeds):
                continue
            match = pattern.search(body)
            if not match:
                continue
            hits.append(id)
            first_matches[id] = re.sub(r'\s+', ' ', body[max(0,match.start()-160):match.end()+220]).strip()
            matched_by_query[id] += 1
            query_collections[id][source] += 1
        if hits:
            candidates.append({'id': 'screen-'+hashlib.sha256(rel.encode()).hexdigest()[:16], 'path': rel,
                               'collection': source, 'queries': hits, 'sha256': digest,
                               'normalizedTextSha256': body_hash, 'firstMatches': first_matches,
                               'reviewStatus': 'unreviewed-search-hit',
                               'translationDerivative': bool(re.search(r'translat|english|en-US', rel, re.I))})
            duplicates[body_hash].append(rel)
        if sum(collections.values()) % 5000 == 0:
            print(f'Scanned {sum(collections.values()):,} texts; {len(candidates):,} candidate documents', flush=True)
    args.output.mkdir(parents=True, exist_ok=True)
    ledger = {'schema':'ufo-files-whitepaper-screening/v1', 'corpusRevision':revision,
              'querySha256':hashlib.sha256(query_bytes).hexdigest(), 'candidates':candidates}
    (args.output/'screening.json.gz').write_bytes(gzip.compress((json.dumps(ledger,ensure_ascii=False,separators=(',',':'))+'\n').encode(), mtime=0))
    groups = [paths for paths in duplicates.values() if len(paths)>1]
    summary = {'schema':'ufo-files-whitepaper-survey/v1', 'createdAt':datetime.now(timezone.utc).isoformat(),
               'corpusRevision':revision, 'queryVersion':protocol['version'],
               'querySha256':ledger['querySha256'], 'inventorySha256':inventory.hexdigest(),
               'scannedDocuments':sum(collections.values()), 'scannedBytes':total_bytes,
               'collections':dict(collections), 'excluded':dict(exclusions), 'errors':errors,
               'candidateDocuments':len(candidates), 'queryMatches':dict(matched_by_query),
               'queryCollections':{k:dict(v) for k,v in query_collections.items()},
               'exactNormalizedDuplicateGroups':len(groups),
               'exactNormalizedDuplicateDocuments':sum(len(group) for group in groups),
               'limitations':['Search hits are unreviewed and do not establish that a claim is true or relevant.',
                             'Coverage is the locally available checkout, not all existing UFO records.',
                             'Search patterns miss OCR errors, names, synonyms, and non-English phrasing.',
                             'Exact normalized duplicate checks do not establish source independence.',
                             'Paired translations require manual lineage resolution; paths are flagged heuristically only.',
                             'No-match documents have not been substantively excluded by human review.']}
    (args.output/'survey.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    (args.output/'exact-duplicate-groups.json.gz').write_bytes(gzip.compress((json.dumps(groups,ensure_ascii=False,separators=(',',':'))+'\n').encode(), mtime=0))
    print(json.dumps({k:summary[k] for k in ['scannedDocuments','candidateDocuments','exactNormalizedDuplicateGroups','queryMatches']},indent=2))


if __name__ == '__main__':
    main()
