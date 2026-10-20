# UFO documentary research paper

Choose **Whitepaper** in the graph builder’s view selector to read the narrative
and research apparatus from `data/whitepaper.json`. Citations open exact passages
inside the view; copied builder links preserve the selected passage. **Export PDF**
opens the browser’s print dialog with the complete paper, sources, and evidence
expanded. `whitepaper.html` remains a standalone reader using the same content.

The current author-reviewed synthesis contains 71 cited source files, 156
passages, and 289 individually cited sentences across 41 sections. These counts
are not counts of independent witnesses, independent works, or verified events.
Several files come from the same dossier or repeat the same author's account.
The research audit explicitly records remaining weaknesses rather than
presenting this as an exhaustive, independently reviewed reference publication.

## Research protocol

The candidate-discovery protocol covers fifteen questions in
`data/whitepaper-research/queries.json`, including early history, Roswell,
public messaging, programs, recoveries, contractors, oversight, consciousness,
signaling, materials, sensor cases, nuclear facilities, international records,
scientific methods, and economics. Literal prefilters accelerate the recorded
regular expressions; they are part of the versioned search protocol.

Run the full local text-file survey:

```sh
python3 scripts/survey_whitepaper.py \
  --corpus-root /path/to/machine-data \
  --output data/whitepaper-research
```

The completed search covered 183,454 eligible text files across 42 collections,
returning 21,186 candidate files, with no read failures. The output records the
corpus revision, query hash, input-inventory hash,
collection coverage, exclusions, read failures, query counts, and exact
normalized duplicate candidates. `screening.json.gz` contains the complete hit
ledger and first matching contexts. A search hit remains unreviewed until its
source and proposition have been substantively assessed. Non-matching files
have not thereby received human exclusion review. Counts are text files;
paired languages, derivative extractions, and repeated works require additional
lineage resolution. Pattern matching can miss spelling, OCR, and language
variants. Do not describe a regex search as reading the entire archive.

`cited-source-review.json` records each included source, its exact passages,
related narrative sentences, lineage group, and scan checks.
`review-decisions.json` records specific sampled decisions and exclusions;
it is not a completed decision log for every search hit. `advisor-review.json`
is an author self-audit with explicit acceptance criteria, not independent peer
review. Nine conflict and qualification entries preserve competing propositions and
explicit research dispositions. The claim ledger connects each major question to cited narrative
analysis and the evidence still needed. International paraphrases preserve
citations to canonical source-language text and are marked for independent
language review; failed machine translations are not used as factual support.

## Editorial requirements

Every factual sentence must have a stable ID and supporting citations. Keep
existing IDs stable when correcting text; retire an ID rather than reassigning
it to a different proposition. Check every component of compound sentences.
Citation coverage alone does not show that the source entails the assertion.

Distinguish recorded actions, attributed investigative assessments, witness and
organization claims, and editorial synthesis. Preserve scope, uncertainty,
firsthand versus reported knowledge, dates, institutional perspective, and
counterevidence. Government custody, classification markings, prepublication
clearance, a hearing submission, a research contract, or a scientific proposal
does not automatically validate the underlying recovery or performance claim.

Dates refer to source publication or the specified document when established.
Leave unknown dates unknown; never substitute OCR, upload, release, or file
modification dates. The edition date is separate from historical coverage.
A later report can concern an earlier incident; reports received in a period
can differ from incidents occurring or cases resolved in that period.

Use PDF file-order pages, explicit form-feed page indexes, timestamp ranges,
or clearly label unavailable page mapping. Machine transcripts need speaker
and audiovisual review before decisive use. Retrospective summaries must be
checked against primary records where available; disagreements remain visible.

## Evidence and original pages

Each passage stores its source key, locator, selector, and verbatim extract,
with extraction metadata removed. Sources include a revision-pinned archive
URL, text SHA-256, and original hash where archive metadata supplies one.
Lineage groups identify known relationships; they are not a certification of
independence for sources outside a group.

Eighteen decisive original PDF pages were rendered and visually inspected by
the author, including the 1947 AMC opinion, SIGN progress report, 2008 contract,
Grusch clearance letter, Roswell records findings, FBI teletype, and the
Arnold/AARO dating discrepancy. `scan-review.json` records original and rendered
image hashes and the narrow review scope. Linked scans permit reader comparison.
This does not authenticate every original, certify whole-document review, or
replace checks on the other cited passages.

Validate references, source metadata, claim links, and scan hashes:

```sh
node scripts/validate_whitepaper.mjs
```

Verify all passages and text hashes against the cited checkout:

```sh
node scripts/validate_whitepaper.mjs --corpus-root /path/to/machine-data
```

The validator detects uncited sentences, broken references, missing sources,
source drift, scan drift, and locator/excerpt mismatches. It cannot establish
truth, completeness, independence, or semantic support for an inference.
The authored paper is independent of the generated graph catalog; changing it
does not require an incidental graph-catalog rebuild.

## Publication and review

Readers can follow stable sentence and evidence anchors, inspect related
sources, compare selected scans, download the research data and candidate
ledger, and print the narrative with its evidence passages. The preview server
and Pages staging explicitly include the three research assets; CI checks
research references when the paper or its data changes.

Before a reference publication claims comprehensive coverage, complete primary
source and contradiction review, source-lineage resolution, independent factual
and language checks, and the other recorded acceptance criteria. Preserve
versioned releases and retired identifiers before assigning a durable citation.
Do not inflate research coverage by treating repeated citations, split dossiers,
translated derivatives, or bibliographies that have not been read as additional
independent evidence.
