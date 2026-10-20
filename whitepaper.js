'use strict';
(() => {
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const link = (text, href, className) => {
    const node = el('a', text, className);
    node.href = href;
    return node;
  };
  const labels = { record: 'Record', assessment: 'Assessment', claim: 'Attributed claim', analysis: 'Synthesis' };
  function revealTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    target.scrollIntoView();
  }
  async function render() {
    const response = await fetch('data/whitepaper.json');
    if (!response.ok) throw new Error('Research data could not be loaded.');
    const paper = await response.json();
    const sentences = paper.chapters.flatMap(chapter => chapter.sentences);
    const evidenceNumbers = new Map(Object.keys(paper.evidence).map((id, i) => [id, i + 1]));
    const sourceNumbers = new Map(Object.keys(paper.sources).map((id, i) => [id, i + 1]));
    document.getElementById('title').textContent = paper.title;
    document.getElementById('subtitle').textContent = paper.subtitle;
    document.getElementById('edition').textContent = `v${paper.version} / ${paper.editionDate}`;
    document.getElementById('status').textContent = paper.status;
    document.getElementById('scope').textContent = paper.scope;
    document.getElementById('footer-version').textContent = `${paper.id} · v${paper.version}`;
    for (const [count, label] of [[paper.chapters.length, 'sections'], [sentences.length, 'cited sentences'], [Object.keys(paper.sources).length, 'cited source files'], [Object.keys(paper.evidence).length, 'evidence passages']]) {
      const metric = el('span'); metric.append(el('strong', count), document.createTextNode(label));
      document.getElementById('metrics').append(metric);
    }
    for (const method of paper.methodology) document.getElementById('method-list').append(el('li', method));
    for (const chapter of paper.chapters) {
      document.getElementById('contents').append(link(chapter.title, `#${chapter.id}`));
      const section = el('section'); section.id = chapter.id;
      section.append(el('p', chapter.deck, 'eyebrow'), el('h2', chapter.title));
      for (const sentence of chapter.sentences) {
        const p = el('p', undefined, 'sentence'); p.id = sentence.id;
        p.append(el('span', labels[sentence.kind], `kind ${sentence.kind}`), document.createTextNode(sentence.text));
        for (const id of sentence.citations) {
          const evidence = paper.evidence[id];
          const citation = link(`[${evidenceNumbers.get(id)}]`, `#evidence-${id}`, 'citation');
          citation.setAttribute('aria-label', `Evidence ${evidenceNumbers.get(id)}: ${paper.sources[evidence.source].title}, ${evidence.locator}`);
          citation.title = `${paper.sources[evidence.source].title} · ${evidence.locator}`;
          p.append(citation);
        }
        const permalink = link(`§ ${sentence.id}`, `#${sentence.id}`, 'sentence-id');
        permalink.setAttribute('aria-label', `Permanent reference to sentence ${sentence.id}`);
        p.append(permalink); section.append(p);
      }
      document.getElementById('chapters').append(section);
    }
    for (const dispute of paper.disputes || []) {
      const card = el('div', undefined, 'claim-card'); card.id = `dispute-${dispute.id}`;
      card.append(el('h3', dispute.title));
      const links = el('p', undefined, 'backlinks');
      for (const id of dispute.sentences) links.append(link(`§ ${id}`, `#${id}`));
      card.append(links, el('p', `Research disposition: ${dispute.disposition}`));
      document.getElementById('dispute-list').append(card);
    }
    for (const claim of paper.claimLedger || []) {
      const card = el('div', undefined, 'claim-card'); card.id = `claim-${claim.id}`;
      card.append(el('h3', claim.question), link('Read the cited analysis →', `#${claim.sentence}`), el('p', claim.nextEvidence), el('p', claim.status, 'editorial'));
      document.getElementById('claims').append(card);
    }
    for (const gap of paper.gaps) {
      const block = el('div', undefined, 'gap'); block.append(el('h3', gap.topic), el('p', gap.needed));
      document.getElementById('gaps').append(block);
    }
    const provenance = el('p', `Corpus snapshot: ufo-files/machine-data @ ${paper.corpusRevision}`, 'editorial');
    document.getElementById('sources').append(provenance);
    for (const source of Object.values(paper.sources)) {
      const block = el('div', undefined, 'source'); block.id = `source-${source.id}`;
      block.append(el('h3', `${sourceNumbers.get(source.id)}. ${source.title}`), el('p', `${source.author} · ${source.date || source.dateNote} · ${source.kind}`, 'source-meta'));
      block.append(link('Open pinned archive text ↗', source.url));
      block.append(el('p', `Publication lineage: ${source.lineageGroup}`, 'source-meta'));
      if (source.translationNote) block.append(el('p', `${source.language}: ${source.translationNote}`, 'source-meta'));
      if (source.reviewScope) block.append(el('p', source.reviewScope, 'source-meta'));
      for (const related of source.relatedSources || []) block.append(link(`Related source: ${paper.sources[related].title}`, `#source-${related}`), el('br'));
      const hash = el('p'); hash.append(document.createTextNode('Text SHA-256: '), el('code', source.transcriptSha256)); block.append(hash);
      if (source.originalSha256) {
        const originalHash = el('p'); originalHash.append(document.createTextNode('Original SHA-256 from archive metadata: '), el('code', source.originalSha256)); block.append(originalHash);
      }
      document.getElementById('sources').append(block);
    }
    for (const evidence of Object.values(paper.evidence)) {
      const source = paper.sources[evidence.source];
      const details = el('details', undefined, 'evidence-card'); details.id = `evidence-${evidence.id}`;
      details.append(el('summary', `[${evidenceNumbers.get(evidence.id)}] ${source.title} — ${evidence.locator}`));
      details.append(el('p', `${source.author} · ${source.kind}`), el('pre', evidence.passage));
      const tools = el('p'); tools.append(link('Source metadata', `#source-${source.id}`), document.createTextNode(' · '), link('Pinned archive text ↗', source.url));
      if (evidence.scan) {
        tools.append(document.createTextNode(' · '), link('View original page ↗', evidence.scan.path));
        details.append(el('p', evidence.scan.review, 'editorial'));
      }
      details.append(tools);
      const backlinks = el('p', undefined, 'backlinks'); backlinks.append(document.createTextNode('Cited by: '));
      for (const sentence of sentences.filter(sentence => sentence.citations.includes(evidence.id))) backlinks.append(link(sentence.id, `#${sentence.id}`));
      details.append(backlinks); document.getElementById('passages').append(details);
    }
    document.getElementById('loading').hidden = true;
    document.getElementById('publication').hidden = false;
    renderAudit().catch(() => {
      document.getElementById('advisor').append(el('p', 'The research audit is unavailable. Its source files remain linked below.', 'editorial'));
    });
    window.addEventListener('hashchange', revealTarget);
    revealTarget();
  }

  async function renderAudit() {
    const results = await Promise.allSettled(['survey.json', 'advisor-review.json'].map(async file => {
      const response = await fetch(`data/whitepaper-research/${file}`);
      if (!response.ok) throw new Error(file);
      return response.json();
    }));
    const [surveyResult, advisorResult] = results;
    const surveyNode = document.getElementById('survey');
    if (surveyResult.status === 'fulfilled') {
      const survey = surveyResult.value;
      surveyNode.append(el('h3', 'Corpus search'), el('p', `${survey.scannedDocuments.toLocaleString()} text files searched across ${Object.keys(survey.collections).length} archive collections; ${survey.candidateDocuments.toLocaleString()} files matched at least one research query. These are search candidates, not reviewed or corroborated findings.`));
      surveyNode.append(el('p', `Snapshot ${survey.corpusRevision} · ${survey.createdAt.slice(0, 10)}`, 'editorial'));
      const table = el('table'); table.append(el('caption', 'Candidate discovery by research question'));
      const head = el('tr'); head.append(el('th', 'Research area'), el('th', 'Matching text files')); table.append(head);
      for (const [id, count] of Object.entries(survey.queryMatches)) {
        const row = el('tr'); row.append(el('td', id.replaceAll('-', ' ')), el('td', count.toLocaleString())); table.append(row);
      }
      surveyNode.append(table, link('Download full candidate ledger (.json.gz)', 'data/whitepaper-research/screening.json.gz'));
      for (const limitation of survey.limitations) surveyNode.append(el('p', limitation, 'editorial'));
    } else {
      surveyNode.append(el('p', 'Corpus screening is still in progress; no completed coverage count is claimed here.', 'editorial'));
    }
    const advisorNode = document.getElementById('advisor');
    if (advisorResult.status !== 'fulfilled') throw new Error('Advisor audit missing');
    const advisor = advisorResult.value;
    advisorNode.append(el('h3', 'Author’s research review'), el('p', advisor.status));
    for (const issue of advisor.unresolvedRequirements) {
      const details = el('details', undefined, 'audit-issue');
      details.append(el('summary', issue.finding), el('p', `Required work: ${issue.acceptance}`));
      advisorNode.append(details);
    }
  }

  document.getElementById('print').addEventListener('click', () => window.print());
  let previouslyOpen = [];
  window.addEventListener('beforeprint', () => {
    previouslyOpen = [...document.querySelectorAll('details[open]')];
    document.querySelectorAll('details').forEach(node => { node.open = true; });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('details').forEach(node => { node.open = previouslyOpen.includes(node); });
  });
  render().catch(error => {
    console.error('Research paper failed to load:', error);
    const status = document.getElementById('loading');
    status.textContent = 'The research paper could not be loaded. Reload this page to try again, or open the research data directly.';
    status.append(document.createTextNode(' '), link('Research data', 'data/whitepaper.json'));
    status.className = 'error';
  });
})();
