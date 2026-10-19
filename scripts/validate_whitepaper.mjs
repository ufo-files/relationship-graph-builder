import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const paper = JSON.parse(await readFile(resolve(projectRoot, 'data/whitepaper.json'), 'utf8'));
const rootFlag = process.argv.indexOf('--corpus-root');
const corpusRoot = rootFlag >= 0 ? process.argv[rootFlag + 1] : undefined;
assert(rootFlag < 0 || corpusRoot, '--corpus-root needs an archive directory');
assert.equal(paper.schema, 'ufo-files-whitepaper/v1');
assert.match(paper.corpusRevision, /^[a-f0-9]{40}$/);
const ids = new Set();
const usedEvidence = new Set();
const usedSources = new Set();
let sentenceCount = 0;
for (const chapter of paper.chapters) {
  assert(!ids.has(chapter.id), `Duplicate chapter ${chapter.id}`); ids.add(chapter.id);
  for (const sentence of chapter.sentences) {
    sentenceCount++;
    assert(!ids.has(sentence.id), `Duplicate sentence ${sentence.id}`); ids.add(sentence.id);
    assert(sentence.text.trim(), `Empty sentence ${sentence.id}`);
    assert(['record', 'assessment', 'claim', 'analysis'].includes(sentence.kind));
    assert(sentence.citations.length, `Uncited sentence ${sentence.id}`);
    for (const id of sentence.citations) {
      assert(paper.evidence[id], `Missing evidence ${id}`); usedEvidence.add(id);
    }
  }
}
for (const [id, evidence] of Object.entries(paper.evidence)) {
  assert.equal(id, evidence.id); assert(usedEvidence.has(id), `Unused evidence ${id}`);
  assert(evidence.passage.trim(), `Empty passage ${id}`);
  if (evidence.scan) {
    assert.match(evidence.scan.path, /^assets\/research-scans\/[a-z0-9-]+\.(?:png|jpg)$/);
    const scanBytes = await readFile(resolve(projectRoot, evidence.scan.path));
    assert.equal(createHash('sha256').update(scanBytes).digest('hex'), evidence.scan.sha256, `Scan drift: ${id}`);
  }
  assert(paper.sources[evidence.source], `Missing source ${id}`); usedSources.add(evidence.source);
}
for (const dispute of paper.disputes || []) {
  assert(dispute.sentences.every(id => ids.has(id)), `Broken dispute link: ${dispute.id}`);
}
for (const claim of paper.claimLedger || []) {
  assert(ids.has(claim.sentence), `Claim ledger points to missing sentence: ${claim.id}`);
  assert(claim.sources.every(id => paper.sources[id]), `Missing claim source: ${claim.id}`);
}
for (const [id, source] of Object.entries(paper.sources)) {
  assert.equal(source.id, id); assert(usedSources.has(id), `Unused source ${id}`);
  assert.match(source.transcriptSha256, /^[a-f0-9]{64}$/);
  const expectedUrl = `https://github.com/ufo-files/machine-data/blob/${paper.corpusRevision}/${source.path}`;
  assert.equal(source.url, expectedUrl);
  assert(!source.path.split('/').includes('..'));
  if (!corpusRoot) continue;
  const bytes = await readFile(resolve(corpusRoot, source.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.transcriptSha256, `Source drift: ${id}`);
  const raw = bytes.toString('utf8');
  for (const evidence of Object.values(paper.evidence).filter(item => item.source === id)) {
    let expected;
    if (Number.isInteger(evidence.selector)) {
      const pattern = new RegExp(`===== PAGE ${evidence.selector} =====\\n([\\s\\S]*?)(?=\\n===== PAGE |$)`);
      const match = raw.match(pattern); assert(match, `Page not found: ${evidence.id}`);
      expected = match[1].replace(/^\s*\{[^\n]+\}\n/, '').trim();
    } else if (evidence.selector.startsWith?.('ff:')) {
      expected = raw.split('\f')[Number(evidence.selector.slice(3)) - 1]?.replace(/^\{[^\n]+\}\n/, '').trim();
    } else if (evidence.selector === 'text') {
      expected = raw.slice(raw.indexOf('\n') + 1).trim();
    } else {
      const [start, end] = evidence.selector.split(':').map(Number);
      assert(Number.isFinite(start) && end > start);
      expected = raw.split(/\r?\n/).filter(line => {
        const fields = line.split('\t');
        return fields.length >= 3 && /^\d+$/.test(fields[0]) && Number(fields[0]) >= start && Number(fields[0]) < end;
      }).join('\n');
    }
    assert.equal(evidence.passage, expected, `Passage mismatch: ${evidence.id}`);
  }
}

const researchPath = resolve(projectRoot, 'data/whitepaper-research');
const survey = JSON.parse(await readFile(resolve(researchPath, 'survey.json'), 'utf8'));
const queryBytes = await readFile(resolve(researchPath, 'queries.json'));
assert.equal(createHash('sha256').update(queryBytes).digest('hex'), survey.querySha256, 'Search protocol drift');
assert.equal(survey.corpusRevision, paper.corpusRevision, 'Survey and paper snapshots differ');
const screening = JSON.parse(gunzipSync(await readFile(resolve(researchPath, 'screening.json.gz'))).toString('utf8'));
assert.equal(screening.querySha256, survey.querySha256);
assert.equal(screening.corpusRevision, paper.corpusRevision);
assert.equal(screening.candidates.length, survey.candidateDocuments);
assert.equal(new Set(screening.candidates.map(candidate => candidate.path)).size, screening.candidates.length);
const sourceReview = JSON.parse(await readFile(resolve(researchPath, 'cited-source-review.json'), 'utf8'));
assert.equal(sourceReview.corpusRevision, paper.corpusRevision);
assert.equal(sourceReview.reviewedCitedSourceFiles, usedSources.size, 'Cited-source review is stale');
assert.equal(sourceReview.reviewedCitedPassages, usedEvidence.size, 'Passage review is stale');
assert.equal(sourceReview.sources.length, usedSources.size);
for (const review of sourceReview.sources) {
  assert(paper.sources[review.source], `Review references missing source: ${review.source}`);
  const expected = Object.values(paper.evidence).filter(evidence => evidence.source === review.source).map(evidence => evidence.id).sort();
  assert.deepEqual([...review.passages].sort(), expected, `Reviewed passages are stale: ${review.source}`);
}

console.log(`Validated ${sentenceCount} cited sentences, ${usedEvidence.size} passages, ${usedSources.size} sources${corpusRoot ? ' against archive text and hashes' : ' (structure only; pass --corpus-root to audit excerpts)'}.`);
