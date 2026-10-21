'use strict';
window.renderWhitepaper = async function(root = document, options = {}) {
  const find = id => root.getElementById(id);
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
  function revealTarget() {
    let id;
    try { id = options.anchor ? options.anchor() : decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = find(id);
    if (!target) return;
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    target.scrollIntoView({block: 'start'});
    target.setAttribute('tabindex', '-1'); target.focus({preventScroll: true});
  }
  async function render() {
    const response = await fetch('data/whitepaper.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('Research data could not be loaded.');
    const paper = await response.json();
    const sentences = paper.chapters.flatMap(chapter => chapter.sentences);
    const contextReferences = paper.contextReferences || {};
    const citationIds = [...new Set(sentences.flatMap(sentence => [...sentence.citations, ...(sentence.contextCitations || [])]))];
    const evidenceNumbers = new Map(citationIds.map((id, i) => [id, i + 1]));
    const sourceNumbers = new Map(Object.keys(paper.sources).map((id, i) => [id, i + 1]));
    find('footer-version').textContent = `${paper.id} · v${paper.version}`;
    for (const chapter of paper.chapters) {
      if (chapter.caseStudy?.order === 1) find('contents').append(link('Case studies', '#case-studies', 'eyebrow'));
      find('contents').append(link(chapter.title, `#${chapter.id}`));
      const section = el('section'); section.id = chapter.id;
      section.append(el('p', chapter.deck, 'eyebrow'), el('h2', chapter.title));
      const sentencesById = new Map(chapter.sentences.map(sentence => [sentence.id, sentence]));
      const paragraphs = chapter.paragraphs || chapter.sentences.map(sentence => [sentence.id]);
      for (const ids of paragraphs) {
        const paragraph = el('p', undefined, 'narrative-paragraph');
        for (const [index, id] of ids.entries()) {
          const sentence = sentencesById.get(id);
          const span = el('span', sentence.text, 'sentence'); span.id = sentence.id;
          if (index) paragraph.append(document.createTextNode(' '));
          for (const evidenceId of sentence.citations) {
            const evidence = paper.evidence[evidenceId];
            const citation = link(`[${evidenceNumbers.get(evidenceId)}]`, `#evidence-${evidenceId}`, 'citation');
            citation.setAttribute('aria-label', `Evidence ${evidenceNumbers.get(evidenceId)}: ${paper.sources[evidence.source].title}, ${evidence.locator}`);
            citation.title = `${paper.sources[evidence.source].title} · ${evidence.locator}`;
            span.append(citation);
          }
          for (const referenceId of sentence.contextCitations || []) {
            const reference = contextReferences[referenceId];
            const citation = link(`[${evidenceNumbers.get(referenceId)}]`, `#context-${referenceId}`, 'citation');
            citation.title = `${reference.author} · ${reference.title}`;
            citation.setAttribute('aria-label', `Reference ${evidenceNumbers.get(referenceId)}: ${reference.title}`);
            span.append(citation);
          }
          paragraph.append(span);
        }
        section.append(paragraph);
      }
      (chapter.closing ? find('closing') : chapter.caseStudy ? find('caseStudies') : find('chapters')).append(section);
    }
    for (const dispute of paper.disputes || []) {
      const card = el('div', undefined, 'claim-card'); card.id = `dispute-${dispute.id}`;
      card.append(el('h3', dispute.title));
      const links = el('p', undefined, 'backlinks');
      for (const id of dispute.sentences) links.append(link(`§ ${id}`, `#${id}`));
      card.append(links, el('p', `Research disposition: ${dispute.disposition}`));
      find('dispute-list').append(card);
    }
    for (const claim of paper.claimLedger || []) {
      const card = el('div', undefined, 'claim-card'); card.id = `claim-${claim.id}`;
      card.append(el('h3', claim.question), link('Read the cited analysis →', `#${claim.sentence}`), el('p', claim.nextEvidence), el('p', claim.status, 'editorial'));
      find('claims').append(card);
    }
    for (const gap of paper.gaps) {
      const block = el('div', undefined, 'gap'); block.append(el('h3', gap.topic), el('p', gap.needed));
      find('gaps').append(block);
    }
    const provenance = el('p', `Corpus snapshot: ufo-files/machine-data @ ${paper.corpusRevision}`, 'editorial');
    find('sources').append(provenance);
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
      find('sources').append(block);
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
      details.append(backlinks); find('passages').append(details);
    }
    for (const [id, reference] of Object.entries(contextReferences)) {
      const block = el('div', undefined, 'source'); block.id = `context-${id}`;
      block.append(el('h3', `[${evidenceNumbers.get(id)}] ${reference.title}`), el('p', reference.author, 'source-meta'), link('Open historical reference ↗', reference.url));
      find('sources').append(block);
    }
    find('loading').hidden = true;
    find('publication').hidden = false;
    renderAudit().catch(() => {
      find('advisor').append(el('p', 'The research audit is unavailable. Its source files remain linked below.', 'editorial'));
    });
    if (!options.navigate) window.addEventListener('hashchange', revealTarget);
    revealTarget();
  }

  async function renderAudit() {
    const results = await Promise.allSettled(['survey.json', 'advisor-review.json'].map(async file => {
      const response = await fetch(`data/whitepaper-research/${file}`);
      if (!response.ok) throw new Error(file);
      return response.json();
    }));
    const [surveyResult, advisorResult] = results;
    const surveyNode = find('survey');
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
    const advisorNode = find('advisor');
    if (advisorResult.status !== 'fulfilled') throw new Error('Advisor audit missing');
    const advisor = advisorResult.value;
    advisorNode.append(el('h3', 'Author’s research review'), el('p', advisor.status));
    for (const issue of advisor.unresolvedRequirements) {
      const details = el('details', undefined, 'audit-issue');
      details.append(el('summary', issue.finding), el('p', `Required work: ${issue.acceptance}`));
      advisorNode.append(details);
    }
  }

  await render().catch(error => {
    console.error('Research paper failed to load:', error);
    const status = find('loading');
    status.textContent = 'The research paper could not be loaded. Reload this page to try again, or open the research data directly.';
    status.append(document.createTextNode(' '), link('Research data', 'data/whitepaper.json'));
    status.className = 'error';
    throw error;
  });
  find('print')?.addEventListener('click', () => window.print());
  let previouslyOpen = [];
  window.addEventListener('beforeprint', () => {
    previouslyOpen = [...root.querySelectorAll('details[open]')];
    root.querySelectorAll('.evidence-card').forEach(node => { node.open = true; });
  });
  window.addEventListener('afterprint', () => {
    root.querySelectorAll('details').forEach(node => { node.open = previouslyOpen.includes(node); });
  });
  if (options.navigate) root.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[data-paper-anchor], a[href^="#"]');
    if (!anchor) return;
    event.preventDefault(); options.navigate(anchor.dataset.paperAnchor || anchor.getAttribute('href').slice(1));
  });
  if (options.url) root.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.dataset.paperAnchor = anchor.getAttribute('href').slice(1);
    anchor.href = options.url(anchor.dataset.paperAnchor);
  });
  return { revealTarget };
};
if (document.getElementById('paper')) window.renderWhitepaper().catch(() => {});
