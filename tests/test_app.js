const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor() {
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: name => classes.has(name) ? (classes.delete(name), false) : (classes.add(name), true)
    };
    this.style = { setProperty() {} };
  }

  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  getBoundingClientRect() { return { width: 900, height: 600 }; }
}

function labelCount(chart) {
  return chart.children.filter(node => node.attributes.class?.includes("node-label")).length;
}

function labelTexts(chart) {
  return chart.children.filter(node => node.attributes.class?.includes("node-label")).map(node => node.textContent);
}

test("bar rows use the plot height through the balanced bottom margin", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const layouts = JSON.parse(vm.runInContext(`JSON.stringify([420, 600].map(height => {
    const layout = barChartLayout(height, 8);
    const finalBarBottom = layout.barY(7) + layout.barHeight;
    return { height, top: layout.margin.top, bottom: layout.margin.bottom, row: layout.row, finalBarBottom };
  }))`, context));

  layouts.forEach(layout => {
    assert.equal(layout.top, layout.bottom);
    assert.ok(layout.finalBarBottom > layout.height - layout.bottom - 4);
    assert.ok(layout.finalBarBottom <= layout.height - layout.bottom);
  });
  assert.ok(layouts[1].row > layouts[0].row, "rows should expand with the responsive chart height");
});

test("bar layout remains safe for empty, single-item, and dense datasets", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const layouts = JSON.parse(vm.runInContext(`JSON.stringify({
    empty: { row: barChartLayout(420, 0).row },
    single: (() => { const layout = barChartLayout(420, 1); return { row: layout.row, barHeight: layout.barHeight, labelY: layout.labelY(0) }; })(),
    dense: (() => { const layout = barChartLayout(420, 250); return { row: layout.row, barHeight: layout.barHeight }; })()
  })`, context));

  assert.equal(layouts.empty.row, 0);
  assert.equal(layouts.single.row, 380);
  assert.equal(layouts.single.barHeight, 375);
  assert.ok(layouts.single.labelY > 20 && layouts.single.labelY < 400);
  assert.equal(layouts.dense.barHeight, 5);
  assert.ok(layouts.dense.row > 0);
});

test("rendered bars retain labels and clickable marks at the new bottom edge", () => {
  const elements = {
    chart: new FakeElement(), chartWrap: new FakeElement(), tableView: new FakeElement(),
    legend: new FakeElement(), resultSummary: new FakeElement(), graphKicker: new FakeElement(),
    policySummary: new FakeElement()
  };
  const document = {
    createElementNS: () => new FakeElement(),
    querySelector: selector => elements[selector.slice(1)],
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { documents: 3 },
      documents: [
        { id: "a", source: "One", words: 300 },
        { id: "b", source: "Two", words: 200 },
        { id: "c", source: "Three", words: 100 }
      ],
      sources: [{ name: "One" }, { name: "Two" }, { name: "Three" }]
    };
    Object.assign(state.config, { aggregation: "source", y: "words", allSources: true, limit: 50 });
    renderBars();
  `, context);

  const marks = elements.chart.children.filter(node => node.attributes.class === "mark");
  const categoryLabels = elements.chart.children.filter(node => node.attributes.class === "chart-label");
  const valueLabels = elements.chart.children.filter(node => node.attributes.class === "axis-label");
  const finalMark = marks.at(-1);

  assert.equal(marks.length, 3);
  assert.equal(categoryLabels.length, 3);
  assert.equal(valueLabels.length, 3);
  assert.equal(typeof finalMark.listeners.click, "function");
  assert.ok(Number(finalMark.attributes.y) + Number(finalMark.attributes.height) >= 577);
  assert.ok(Number(finalMark.attributes.y) + Number(finalMark.attributes.height) <= 580);
});

test("Significant People renders people rather than collections in Bars", () => {
  const elements = {
    chart: new FakeElement(), chartWrap: new FakeElement(), tableView: new FakeElement(),
    legend: new FakeElement(), resultSummary: new FakeElement(), graphKicker: new FakeElement(),
    policySummary: new FakeElement()
  };
  const document = {
    createElementNS: () => new FakeElement(),
    querySelector: selector => elements[selector.slice(1)],
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { documents: 0 }, documents: [], sources: [],
      entities: [
        { id: "alice", name: "Alice Example", category: "person", classificationConfidence: .99, mentions: 12, contextAdjustedMentions: 10, documentCount: 3, independentDocumentCount: 3, sourceCount: 2, documentIds: [], evidence: [] },
        { id: "nevada", name: "Nevada", category: "location", classificationConfidence: .99, mentions: 20, contextAdjustedMentions: 18, documentCount: 4, independentDocumentCount: 4, sourceCount: 2, documentIds: [], evidence: [] }
      ]
    };
    state.config = presetConfig("significant-people", "bars");
    renderBars();
  `, context);

  const labels = elements.chart.children
    .filter(node => node.attributes.class === "chart-label")
    .map(node => node.textContent);
  assert.deepEqual(labels, ["Alice Example"]);
  assert.equal(elements.resultSummary.textContent, "1 entities");
  assert.equal(vm.runInContext("state.config.aggregation", context), "entity");
});

test("legend sits below and outside the chart canvas", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const legendRule = styles.match(/\.legend \{([^}]+)\}/)?.[1] || "";

  assert.doesNotMatch(legendRule, /(?:^|;)\s*position\s*:/);
  assert.doesNotMatch(legendRule, /(?:^|;)\s*left\s*:/);
  assert.doesNotMatch(legendRule, /(?:^|;)\s*top\s*:/);
  assert.doesNotMatch(legendRule, /(?:^|;)\s*transform\s*:/);
  assert.doesNotMatch(legendRule, /(?:^|;)\s*bottom\s*:/);
  assert.match(html, /<\/div>\s*<div class="legend" id="legend"><\/div>\s*<footer class="stage-footer">/);
});

test("scatter legend distinguishes capped outliers from mention inflation", () => {
  const legend = new FakeElement();
  const document = { querySelector: selector => selector === "#legend" ? legend : null, querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);

  vm.runInContext('state.config.type = "scatter"; drawIntensityLegend();', context);
  assert.match(legend.innerHTML, /outlier-key[^>]*><\/i>Axis-capped outlier/);
  assert.match(legend.innerHTML, /risk-key[^>]*><\/i>Potential mention inflation/);
  assert.match(legend.innerHTML, /ego-key[^>]*><\/i>Strongest relationships/);

  vm.runInContext('state.config.type = "bars"; drawIntensityLegend();', context);
  assert.doesNotMatch(legend.innerHTML, /Axis-capped outlier|Potential mention inflation|Strongest relationships/);
});

test("scatter ego networks retain the strongest visible relationships", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const entities = ["a", "b", "c", "d"].map(id => ({ id, name: id.toUpperCase(), documentIds: [] }));
      state.catalog = {
        documents: [],
        edges: [
          { source: "a", target: "b", relationship: "co_mentioned", evidenceCount: 2 },
          { source: "a", target: "c", relationship: "co_mentioned", evidenceCount: 8 },
          { source: "a", target: "d", relationship: "co_mentioned", evidenceCount: 4 }
        ]
      };
      Object.assign(state.config, { allSources: true, minEvidence: 2, relation: "all" });
      const network = scatterEgoNetworks(entities, [entities[0]], 2).get("a");
      return JSON.stringify({ total: network.total, neighbors: network.neighbors.map(neighbor => neighbor.entity.id) });
    })()
  `, context));

  assert.equal(result.total, 3);
  assert.deepEqual(result.neighbors, ["c", "d"]);
});

test("scatter relationship overlay deduplicates shared secondary nodes and edges", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const shared = { id: "shared", name: "Shared" };
      const edgeA = { evidenceCount: 3 };
      const edgeB = { evidenceCount: 5 };
      const networks = new Map([
        ["a", { neighbors: [{ entity: shared, edge: edgeA }] }],
        ["b", { neighbors: [{ entity: shared, edge: edgeB }, { entity: { id: "a", name: "A" }, edge: edgeA }] }]
      ]);
      const overlay = scatterRelationshipOverlay(networks, [{ id: "a" }, { id: "b" }]);
      return JSON.stringify({ nodes: overlay.nodes.map(node => node.id), edges: overlay.edges.map(edge => edge.source + "|" + edge.target) });
    })()
  `, context));

  assert.deepEqual(result.nodes, ["shared"]);
  assert.deepEqual(result.edges.sort(), ["a|b", "a|shared", "b|shared"]);
});

test("categorical scatter anchors shared secondary nodes between their primaries", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const anchors = JSON.parse(vm.runInContext(`
    (() => {
      const shared = { id: "shared" };
      const networks = new Map([
        ["a", { neighbors: [{ entity: shared }] }],
        ["b", { neighbors: [{ entity: shared }] }],
        ["c", { neighbors: [{ entity: { id: "a" } }] }]
      ]);
      return JSON.stringify([...scatterSecondaryAnchors(networks, new Map([["a", 0], ["b", 4], ["c", 8]]))]);
    })()
  `, context));

  assert.deepEqual(anchors, [["shared", 2]]);
});

test("inspector defaults collapsed and a selected mark reopens it", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /id="builderView" class="app-shell inspector-collapsed"/);
  assert.match(html, /id="closeInspector"[^>]+aria-label="Close inspector"/);

  const elements = {
    builderView: new FakeElement(),
    inspector: new FakeElement(),
    inspectorContent: new FakeElement()
  };
  elements.builderView.classList.add("inspector-collapsed");
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);

  vm.runInContext("showInspector('person', 'Selected node', [], [])", context);
  assert.equal(elements.builderView.classList.contains("inspector-collapsed"), false);
  assert.equal(elements.inspector.classList.contains("has-selection"), true);
  assert.match(elements.inspectorContent.innerHTML, /Selected node/);

  vm.runInContext("closeInspector()", context);
  assert.equal(elements.builderView.classList.contains("inspector-collapsed"), true);
  assert.equal(elements.inspector.classList.contains("has-selection"), false);
});

test("mobile layout gives the graph the viewport and opens controls from the header", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(html, /id="controlsButton"[^>]+aria-controls="builderPanel"[^>]+aria-expanded="false"/);
  assert.match(html, /class="builder-panel" id="builderPanel"/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.app-shell \{[^}]*height: calc\(100dvh - 68px\);[^}]*grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.app-shell\.inspector-collapsed \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.builder-panel \{[^}]*display: none;[^}]*position: fixed;[^}]*inset: 68px 0 0;/);
  assert.match(styles, /\.app-shell\.controls-open \.builder-panel \{ display: block; \}/);

  const elements = { builderView: new FakeElement(), controlsButton: new FakeElement() };
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);

  vm.runInContext("setMobileControls(true)", context);
  assert.equal(elements.builderView.classList.contains("controls-open"), true);
  assert.equal(elements.controlsButton.attributes["aria-expanded"], "true");
  assert.equal(elements.controlsButton.attributes["aria-label"], "Hide graph controls");

  vm.runInContext("setMobileControls(false)", context);
  assert.equal(elements.builderView.classList.contains("controls-open"), false);
  assert.equal(elements.controlsButton.attributes["aria-expanded"], "false");
});

test("mobile inspector covers the viewport and keeps the existing close button", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(html, /id="closeInspector"[^>]+aria-label="Close inspector"/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.inspector \{[^}]*position: fixed;[^}]*inset: 0;[^}]*z-index: 30;[^}]*width: 100%;[^}]*height: 100dvh;/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.inspector-close \{[^}]*width: 42px;[^}]*height: 42px;/);
});

test("action buttons stay vertically centered without crowding the mobile map toolbar", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.button, \.icon-button \{[^}]*display: inline-flex;[^}]*align-items: center;[^}]*justify-content: center;[^}]*height: 34px;/);
  assert.match(styles, /\.top-actions \.button \{ white-space: nowrap; \}/);
  assert.doesNotMatch(styles, /\.button, \.icon-button \{[^}]*white-space: nowrap;/);
  assert.match(styles, /\.button \{ padding: 0 13px; \}/);
  assert.match(styles, /\.review-button \{[^}]*justify-content: flex-start;[^}]*text-align: left;/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.button, \.icon-button \{ height: 42px; \}/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.controls-button \{ display: grid; width: 42px; \}/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.stage-header \{ flex-wrap: wrap; gap: 12px; \}/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.stage-tools \{ width: 100%; justify-content: flex-end; \}/);
});

test("full-screen control expands the shared graph stage and restores app chrome", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(html, /id="fullScreenButton"[^>]+aria-label="View full screen"[^>]+aria-pressed="false"/);
  assert.match(html, /id="fullScreenButton"[\s\S]*?<\/button>\s*<button class="button quiet" id="exportButton"/);
  assert.match(styles, /body\.graph-fullscreen \.app-shell \{[^}]*height: 100dvh;[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /body\.graph-fullscreen \.chart-wrap \{[^}]*margin: 0;[^}]*border: 0;/);
  assert.match(styles, /body\.graph-fullscreen #chart \{[^}]*min-height: 0;/);

  const elements = { fullScreenButton: new FakeElement() };
  const document = {
    body: new FakeElement(),
    querySelector: selector => elements[selector.slice(1)],
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);

  vm.runInContext("toggleGraphFullScreen()", context);
  assert.equal(document.body.classList.contains("graph-fullscreen"), true);
  assert.equal(elements.fullScreenButton.attributes["aria-pressed"], "true");
  assert.equal(elements.fullScreenButton.attributes["aria-label"], "Exit full screen");

  vm.runInContext("toggleGraphFullScreen()", context);
  assert.equal(document.body.classList.contains("graph-fullscreen"), false);
  assert.equal(elements.fullScreenButton.attributes["aria-pressed"], "false");
  assert.equal(elements.fullScreenButton.attributes["aria-label"], "View full screen");
});

test("default graph includes every entity category with globally adjusted prominence", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.deepEqual(config.categories, [
    "person", "government_agency", "organization", "location", "program", "subject", "book", "date"
  ]);
  assert.equal(config.configVersion, 2);
  assert.equal(config.x, "independentDocumentCount");
  assert.equal(config.y, "contextAdjustedMentions");
  assert.equal(config.size, "independentDocumentCount");
  assert.equal(config.minConfidence, 0.95);
  assert.equal(config.relationshipLayer, "always");
  assert.equal(config.relationshipNeighbors, 1);
  assert.equal(config.relationshipNodeSize, "inherit");
  assert.equal(config.relationshipStrength, "subtle");
});

test("triage scoring applies enabled weights to published-field ratios", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const scores = JSON.parse(vm.runInContext(`
    (() => {
      const catalog = {
        documents: [
          { id: "doc-1", source: "One" }, { id: "doc-2", source: "One" }, { id: "doc-3", source: "One" }
        ],
        entities: [], edges: [], duplicateCandidates: [],
        events: [{
          id: "case-1", title: "Test case", eventType: "sighting", startDate: "2000-01-01", datePrecision: "day",
          titleReviewStatus: "reviewed", documentIds: ["doc-1", "doc-2", "doc-3"], entityIds: [],
          evidence: [{ documentId: "doc-1", excerpt: "Evidence" }]
        }]
      };
      const signals = triageSignalsForProfile();
      Object.values(signals).forEach(signal => signal.enabled = false);
      signals.supportingDocuments = { enabled: true, weight: 5 };
      signals.collectionDiversity = { enabled: true, weight: 1 };
      const documentHeavy = triageCase(catalog.events[0], catalog, { ...DEFAULT, type: "triage", triageSignals: signals }).score;
      signals.supportingDocuments.weight = 1;
      signals.collectionDiversity.weight = 5;
      const diversityHeavy = triageCase(catalog.events[0], catalog, { ...DEFAULT, type: "triage", triageSignals: signals }).score;
      return JSON.stringify({ documentHeavy, diversityHeavy });
    })()
  `, context));

  assert.ok(Math.abs(scores.documentHeavy - 88.8889) < 0.001);
  assert.ok(Math.abs(scores.diversityHeavy - 44.4444) < 0.001);
});

test("triage missing values lower certainty without silently scoring as zero evidence", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const event = { id: "sparse", title: "Sparse case", eventType: "sighting", startDate: "2001-02-03", datePrecision: "day", titleReviewStatus: "reviewed" };
      const catalog = { documents: [], entities: [], edges: [], duplicateCandidates: [], events: [event] };
      const candidate = triageCase(event, catalog, { ...DEFAULT, type: "triage", triageSignals: triageSignalsForProfile("evidence-rich") });
      return JSON.stringify({ score: candidate.score, certainty: candidate.certainty, knownWeight: candidate.knownWeight, totalWeight: candidate.totalWeight, components: candidate.components });
    })()
  `, context));

  assert.equal(result.score, 100, "the one known positive signal should retain its value");
  assert.equal(result.knownWeight, 1);
  assert.equal(result.totalWeight, 12);
  assert.ok(Math.abs(result.certainty - 100 / 12) < 0.001);
  assert.equal(result.components.find(component => component.id === "supportingDocuments").known, false);
  assert.equal(result.components.find(component => component.id === "mappedLocation").known, false);
});

test("triage marks identity ambiguity unknown when the duplicate catalog is truncated", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const event = {
        id: "case-1", title: "Identity case", eventType: "sighting", startDate: "2001-02-03", datePrecision: "day",
        titleReviewStatus: "reviewed", documentIds: ["doc-1"], entityIds: ["entity-1"], evidence: [{ documentId: "doc-1", excerpt: "Evidence" }]
      };
      const catalog = {
        counts: { possibleDuplicates: 2 }, documents: [{ id: "doc-1", source: "One" }],
        entities: [{ id: "entity-1", name: "Omitted candidate", category: "person" }], edges: [],
        duplicateCandidates: [{ left: { name: "Other A" }, right: { name: "Other B" } }], events: [event]
      };
      const candidate = triageCase(event, catalog, { ...DEFAULT, type: "triage", triageSignals: triageSignalsForProfile("needs-follow-up") });
      return JSON.stringify({ certainty: candidate.certainty, component: candidate.components.find(item => item.id === "identityAmbiguity") });
    })()
  `, context));

  assert.equal(result.component.known, false);
  assert.equal(result.component.ratio, null);
  assert.match(result.component.detail, /publishes 1 of 2 possible pairs/);
  assert.equal(result.certainty, 60);
});

test("triage metadata gaps use excerpts from the selected collection scope", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const event = {
        id: "case-1", title: "Scoped case", eventType: "sighting", startDate: "2001-02-03", datePrecision: "day",
        titleReviewStatus: "reviewed", documentIds: ["selected-doc", "other-doc"], entityIds: ["entity-1"],
        evidence: [{ documentId: "other-doc", excerpt: "Excerpt outside the selected collection" }]
      };
      const catalog = {
        counts: { possibleDuplicates: 0 },
        documents: [{ id: "selected-doc", source: "Selected" }, { id: "other-doc", source: "Other" }],
        entities: [{ id: "entity-1", name: "Entity", category: "person" }], edges: [], duplicateCandidates: [], events: [event]
      };
      const config = { ...DEFAULT, type: "triage", allSources: false, sources: ["Selected"], triageSignals: triageSignalsForProfile("needs-follow-up") };
      const candidate = triageCase(event, catalog, config);
      return JSON.stringify({ evidence: candidate.evidence, component: candidate.components.find(item => item.id === "metadataGaps") });
    })()
  `, context));

  assert.deepEqual(result.evidence, []);
  assert.equal(result.component.numerator, 1);
  assert.match(result.component.detail, /1 of 5 follow-up checks flagged/);
});

test("applying a triage profile closes a stale open case inspector", () => {
  const elements = { builderView: new FakeElement(), inspector: new FakeElement() };
  elements.inspector.classList.add("has-selection");
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.config = { ...DEFAULT, type: "triage", triageCaseId: "case-1", triageSignals: triageSignalsForProfile("evidence-rich") };
    state.selected = { event: { id: "case-1" } };
    persistHash = () => {};
    renderControls = () => {};
    commitConfig = () => {};
    toast = () => {};
    applyTriageProfile("needs-follow-up");
  `, context);

  const stateSnapshot = JSON.parse(vm.runInContext("JSON.stringify({ selected: state.selected, config: state.config })", context));
  assert.equal(elements.builderView.classList.contains("inspector-collapsed"), true);
  assert.equal(elements.inspector.classList.contains("has-selection"), false);
  assert.equal(stateSnapshot.selected, null);
  assert.equal(stateSnapshot.config.triageCaseId, "");
  assert.equal(stateSnapshot.config.triageProfile, "needs-follow-up");
});

test("triage rows use the compact grid before the mobile breakpoint", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.triage-case-open \{ grid-template-columns: 28px minmax\(0, 1fr\) 64px; \}/);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.triage-case-open > span\[aria-hidden\] \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.triage-case-certainty \{ grid-column: 2 \/ -1; text-align: left; \}/);
});

test("triage ordering uses stable title and case-ID tie breakers", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const orders = JSON.parse(vm.runInContext(`
    (() => {
      const base = { eventType: "sighting", startDate: "2000-01-01", datePrecision: "day", titleReviewStatus: "reviewed", documentIds: [], entityIds: [], evidence: [] };
      const events = [
        { ...base, id: "case-b", title: "Same" },
        { ...base, id: "case-z", title: "Zulu" },
        { ...base, id: "case-a", title: "Same" },
        { ...base, id: "case-alpha", title: "Alpha" }
      ];
      const catalog = { documents: [], entities: [], edges: [], duplicateCandidates: [], events };
      const config = { ...DEFAULT, type: "triage", triageSort: "score", triageDirection: "desc", triageSignals: triageSignalsForProfile("evidence-rich") };
      const first = triageCandidates(catalog, config).map(candidate => candidate.event.id);
      catalog.events.reverse();
      const reversedInput = triageCandidates(catalog, config).map(candidate => candidate.event.id);
      return JSON.stringify({ first, reversedInput });
    })()
  `, context));

  assert.deepEqual(orders.first, ["case-alpha", "case-a", "case-b", "case-z"]);
  assert.deepEqual(orders.reversedInput, orders.first);
});

test("triage priority ties prefer candidates with more known scoring data", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const order = JSON.parse(vm.runInContext(`
    (() => {
      const events = [
        { id: "sparse", title: "Alpha", eventType: "sighting", startDate: "2000-01-01", datePrecision: "day", titleReviewStatus: "reviewed" },
        { id: "complete", title: "Zulu", eventType: "sighting", startDate: "2000-01-01", datePrecision: "day", titleReviewStatus: "reviewed", documentIds: ["doc-1", "doc-2", "doc-3"], entityIds: ["person", "place", "agency", "program"], evidence: [{ documentId: "doc-1", excerpt: "One" }, { documentId: "doc-2", excerpt: "Two" }, { documentId: "doc-3", excerpt: "Three" }] }
      ];
      const catalog = {
        documents: [{ id: "doc-1", source: "One" }, { id: "doc-2", source: "Two" }, { id: "doc-3", source: "Three" }],
        entities: [
          { id: "person", name: "Person", category: "person" },
          { id: "place", name: "Place", category: "location", geo: { lat: 1, lon: 1 } },
          { id: "agency", name: "Agency", category: "government_agency" },
          { id: "program", name: "Program", category: "program" }
        ],
        edges: [{ source: "person", target: "agency", relationship: "affiliated_with" }, { source: "agency", target: "program", relationship: "investigated" }],
        duplicateCandidates: [], counts: { possibleDuplicates: 0 }, events
      };
      return JSON.stringify(triageCandidates(catalog, { ...DEFAULT, type: "triage", triageSort: "score", triageDirection: "desc", triageSignals: triageSignalsForProfile("evidence-rich") }).map(candidate => candidate.event.id));
    })()
  `, context));
  assert.deepEqual(order, ["complete", "sparse"]);
});

test("triage subtitle explains the candidate pool, active weights, and certainty", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const subtitle = vm.runInContext('triageSubtitle({ ...DEFAULT, triageSignals: triageSignalsForProfile("evidence-rich") })', context);
  assert.match(subtitle, /^Published event records ranked by Evidence rich:/);
  assert.match(subtitle, /supporting documents \(3×\)/);
  assert.match(subtitle, /source excerpts \(2×\)/);
  assert.match(subtitle, /Unknown inputs lower certainty, not priority\.$/);
});

test("paragraphs keep a readable maximum line length", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /p \{ max-width: 768px; \}/);
});

test("stage actions do not wrap or compress the fullscreen square", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.stage-tools \{[^}]*flex: 0 0 auto;/);
  assert.match(styles, /\.stage-tools \.button \{[^}]*white-space: nowrap;/);
  assert.match(styles, /\.fullscreen-button \{[^}]*flex: 0 0 34px;[^}]*width: 34px;[^}]*height: 34px;/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.fullscreen-button \{[^}]*flex-basis: 42px;[^}]*width: 42px;/);
});

test("triage configuration survives deterministic URL round trips", () => {
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  const location = { hash: "" };
  const context = vm.createContext({
    location,
    history: { replaceState(_state, _title, hash) { location.hash = hash; } },
    URLSearchParams,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary"),
    escape,
    unescape,
    encodeURIComponent,
    decodeURIComponent
  });
  vm.runInContext(source, context);
  vm.runInContext(`
    state.config = presetConfig("default", "triage");
    state.config.triageSignals.supportingDocuments = { enabled: true, weight: 4 };
    state.config.triageSignals.mappedLocation = { enabled: false, weight: 2 };
    state.config.triageProfile = "custom";
    state.config.triageSort = "certainty";
    state.config.triageDirection = "asc";
    persistHash();
  `, context);

  const restoredContext = vm.createContext({
    location: { hash: location.hash }, URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"),
    escape,
    decodeURIComponent
  });
  vm.runInContext(source, restoredContext);
  const restored = JSON.parse(vm.runInContext("JSON.stringify(state.config)", restoredContext));
  const exported = JSON.parse(vm.runInContext("JSON.stringify(triageConfigurationExport())", restoredContext));

  assert.equal(restored.type, "triage");
  assert.equal(restored.triageProfile, "custom");
  assert.deepEqual(restored.triageSignals.supportingDocuments, { enabled: true, weight: 4 });
  assert.deepEqual(restored.triageSignals.mappedLocation, { enabled: false, weight: 2 });
  assert.equal(restored.triageSort, "certainty");
  assert.equal(restored.triageDirection, "asc");
  assert.deepEqual(exported.signals.map(signal => signal.id), JSON.parse(vm.runInContext("JSON.stringify(TRIAGE_SIGNALS.map(signal => signal.id))", restoredContext)));
});

test("pre-adjustment saved views migrate prominence metrics across entity graph types", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    scatter: migrateEntityProminenceConfig({ type: "scatter", x: "documentCount", y: "mentions", size: "documentCount" }),
    network: migrateEntityProminenceConfig({ type: "network", nodeRole: "entity", size: "mentions" }),
    collectionNetwork: migrateEntityProminenceConfig({ type: "network", nodeRole: "collection", size: "documents" }),
    bars: migrateEntityProminenceConfig({ type: "bars", aggregation: "entity", y: "mentions" }),
    timeline: migrateEntityProminenceConfig({ type: "timeline", timelineRole: "entity", y: "mentions", size: "documentCount" }),
    map: migrateEntityProminenceConfig({ type: "map", size: "mentions" }),
    book: migrateEntityProminenceConfig({ type: "book", size: "mentions" }),
    table: migrateEntityProminenceConfig({ type: "table", tableSort: "mentions" })
  })`, context));

  assert.deepEqual(result.scatter, { type: "scatter", x: "independentDocumentCount", y: "contextAdjustedMentions", size: "independentDocumentCount", configVersion: 2 });
  assert.equal(result.network.size, "contextAdjustedMentions");
  assert.equal(result.collectionNetwork.size, "documents");
  assert.equal(result.bars.y, "contextAdjustedMentions");
  assert.equal(result.timeline.y, "contextAdjustedMentions");
  assert.equal(result.timeline.size, "independentDocumentCount");
  assert.equal(result.map.size, "contextAdjustedMentions");
  assert.equal(result.book.size, "contextAdjustedMentions");
  assert.equal(result.table.tableSort, "mentions");
});

test("versioned saved views preserve an explicit raw-metric choice", () => {
  const saved = {
    configVersion: 2, type: "scatter", x: "entity", y: "mentions", size: "documentCount",
    categories: ["person"], sources: [], allSources: true
  };
  const encoded = Buffer.from(JSON.stringify(saved), "utf8").toString("base64");
  const context = vm.createContext({
    location: { hash: `#config=${encodeURIComponent(encoded)}` }, URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"), escape, decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.equal(config.y, "mentions");
  assert.equal(config.size, "documentCount");
});

test("saved event timelines cannot retain a stale words axis", () => {
  const saved = {
    configVersion: 2, type: "timeline", timelineRole: "event", x: "startDate", y: "words",
    categories: ["date"], sources: [], allSources: true
  };
  const encoded = Buffer.from(JSON.stringify(saved), "utf8").toString("base64");
  const context = vm.createContext({
    location: { hash: `#config=${encodeURIComponent(encoded)}` }, URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"), escape, decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.equal(config.y, "mentionRank");
});

test("saved views normalize the former Matrix default only when Matrix is inactive", () => {
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  const defaultsContext = vm.createContext({ location: { hash: "" }, URLSearchParams });
  vm.runInContext(source, defaultsContext);
  const previousDefault = JSON.parse(vm.runInContext('JSON.stringify({ ...DEFAULT, matrixColumns: "entity" })', defaultsContext));

  function loadSaved(saved) {
    const encoded = Buffer.from(JSON.stringify(saved), "utf8").toString("base64");
    const context = vm.createContext({
      location: { hash: `#config=${encodeURIComponent(encoded)}` }, URLSearchParams,
      atob: value => Buffer.from(value, "base64").toString("binary"), escape, decodeURIComponent
    });
    vm.runInContext(source, context);
    return JSON.parse(vm.runInContext('JSON.stringify({ config: state.config, activeId: activePresetId() })', context));
  }

  const inactive = loadSaved(previousDefault);
  const active = loadSaved({ ...previousDefault, type: "matrix" });

  assert.equal(inactive.config.matrixColumns, "category");
  assert.equal(inactive.activeId, "default");
  assert.equal(active.config.matrixColumns, "entity");
});

test("an existing default URL migrates away from inflated raw prominence", () => {
  const saved = {
    type: "scatter", x: "entity", y: "mentions", size: "documentCount",
    categories: ["person"], sources: [], allSources: true, titleMode: "auto"
  };
  const encoded = Buffer.from(JSON.stringify(saved), "utf8").toString("base64");
  const context = vm.createContext({
    location: { hash: `#config=${encodeURIComponent(encoded)}` }, URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"), escape, decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.equal(config.configVersion, 2);
  assert.equal(config.y, "contextAdjustedMentions");
  assert.equal(config.size, "independentDocumentCount");
});

test("Default preset restores the complete initial view", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    preset: presetConfig("default"),
    defaults: DEFAULT,
    activeId: activePresetId()
  })`, context));

  assert.deepEqual(result.preset, result.defaults);
  assert.equal(result.activeId, "default");
  assert.equal(result.defaults.x, "independentDocumentCount");
  assert.equal(result.defaults.matrixColumns, "category");
});

test("graph type stays first while quick presets remain available", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(html, /data-step="1"[\s\S]*<strong>Graph type<\/strong>/);
  assert.match(html, /data-step="2"[\s\S]*<strong>Presets<\/strong>[\s\S]*id="presetControls"/);
  assert.match(source, /function renderControls\(\) \{\s*renderPresetControl\(\)/);
  assert.match(source, /label: "Map", scope: "Locations"/);
  assert.match(source, /label: "Bookshelf", scope: "Books"/);
  assert.match(source, /label: "Documents", scope: "All corpus files"/);
  assert.match(source, /label: "Scatter", scope: "All"/);
  assert.match(source, /state\.config = presetConfig\("default", type\)/);
  assert.match(source, /label: "Bars", scope: "All collections"/);
  assert.match(source, /label: "Timeline", scope: "Documents \+ events"/);
  assert.match(source, /timeline: \{[^}]*categories: \["date"\][^}]*limit: 50/);
  assert.match(source, /state\.config\.type === "timeline" \|\|/);
  assert.match(source, /function documentRelationshipNetworks[\s\S]*\(state\.catalog\.entities \|\| \[\]\)\.forEach/);
  assert.match(source, /label: "Network", scope: "All"/);
  assert.match(source, /network: \{ nodeRole: "entity"/);
  assert.match(source, /label: "Matrix", scope: "Collections × entity types"/);
  assert.match(source, /label: "Table", scope: "All"/);
  assert.match(source, /table: \{ tableRole: "entity"/);
  assert.match(source, /matrix: \{ matrixColumns: "category"/);
  assert.match(source, /Math\.min\(state\.config\.limit, 12\)/);
  assert.match(source, /function matrixEntityInterest/);
  assert.match(source, /interest: matrixEntityInterest\(entity, sources\)/);
});

test("Map is a first-class Three.js graph type with reviewed location data", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const globe = fs.readFileSync("map-globe.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  const threeModule = fs.readFileSync("vendor/three.module.min.js", "utf8");
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.catalog = { entities: [
      { id: "mapped", name: "Roswell", category: "location", classificationConfidence: 1, mentions: 8, contextAdjustedMentions: 8, documentIds: [], geo: { lat: 33.3943, lon: -104.523 } },
      { id: "moon", name: "Moon", category: "location", classificationConfidence: 1, mentions: 18, contextAdjustedMentions: 18, documentIds: [], geo: { lat: 18, lon: -28, body: "moon", precision: "celestial-body" } },
      { id: "far-side", name: "Far Side of the Moon", category: "location", classificationConfidence: 1, mentions: 1, contextAdjustedMentions: 1, documentIds: [], geo: { lat: 0, lon: 180, body: "moon", precision: "selenographic-region" } },
      { id: "unmapped", name: "Ambiguous Base", category: "location", classificationConfidence: 1, mentions: 12, contextAdjustedMentions: 12, documentIds: [] },
      { id: "person", name: "Someone", category: "person", classificationConfidence: 1, mentions: 20, contextAdjustedMentions: 20, documentIds: [] }
    ] };
    Object.assign(state.config, { type: "map", categories: ["location"], allSources: true, minConfidence: 0, includeHighInflation: true, size: "contextAdjustedMentions", limit: 2 });
    const result = mapLocationData();
    JSON.stringify({ types: TYPES.map(type => type.id), mapped: result.mapped.map(item => item.id), data: result.data.map(item => item.id), unmapped: result.unmapped, title: dataAwareTitle(state.config) })
  `, context));

  assert.ok(result.types.includes("map"));
  assert.deepEqual(result.mapped, ["moon", "mapped", "far-side"]);
  assert.deepEqual(result.data, ["moon", "far-side"]);
  assert.equal(result.unmapped, 1);
  assert.equal(result.title, "Mentions — Mapped Locations");
  assert.match(html, /id="globeCanvas"/);
  assert.match(html, /id="mapAnimationButton"[^>]+aria-label="Play map animation"[^>]+aria-pressed="false"[^>]+hidden>Play<\/button>[\s\S]*id="exportButton"/);
  assert.match(source, /moonTransitSeconds: 5/);
  assert.match(source, /On-screen Moon transit <span>\$\{state\.config\.moonTransitSeconds\}s<\/span>[\s\S]*min="2" max="10"[^>]+data-range="moonTransitSeconds"/);
  assert.match(source, /moonTransitSeconds: state\.config\.moonTransitSeconds/);
  assert.match(source, /key === "moonTransitSeconds"[\s\S]*setMoonTransitSeconds\(value\)/);
  assert.match(html, /id="globeModule"[^>]+map-globe\.js/);
  assert.match(html, /Map module failed to load/);
  assert.match(globe, /import \* as THREE/);
  assert.match(globe, /world-countries\.svg/);
  assert.match(globe, /SVGLoader/);
  assert.match(globe, /new THREE\.LineSegments/);
  assert.match(globe, /if \(!segments\.has\(edgeKey\)\)/);
  assert.match(globe, /DEFAULT_GLOBE_COVERAGE = \.72/);
  assert.match(globe, /DEFAULT_CAMERA_TARGET_X = 0/);
  assert.match(globe, /DEFAULT_GLOBE_ROTATION = \{ x: \.01375, y: 0 \}/);
  assert.match(globe, /EARTH_NORMAL_ROTATION_PERIOD_MS = 30_000/);
  assert.match(globe, /AUTO_ROTATION_SPEED = Math\.PI \* 2 \/ EARTH_NORMAL_ROTATION_PERIOD_MS/);
  assert.match(globe, /MOON_EQUATORIAL_RADIUS_KM = 1737\.4/);
  assert.match(globe, /MOON_MEAN_ORBIT_RADIUS_KM = 384_400/);
  assert.match(globe, /MOON_RADIUS = MOON_EQUATORIAL_RADIUS_KM \/ EARTH_EQUATORIAL_RADIUS_KM/);
  assert.match(globe, /MOON_ORBIT_RADIUS = MOON_MEAN_ORBIT_RADIUS_KM \/ EARTH_EQUATORIAL_RADIUS_KM/);
  assert.match(globe, /MOON_ORBIT_DAYS = 27\.322/);
  assert.match(globe, /MOON_OFFSCREEN_HALF_ORBIT_MS = 5_000/);
  assert.match(globe, /MOON_OFFSCREEN_ORBIT_SPEED = Math\.PI \/ MOON_OFFSCREEN_HALF_ORBIT_MS/);
  assert.match(globe, /DEFAULT_MOON_ORBIT_ANGLE = 1\.545/);
  assert.match(globe, /this\.moonOrbit\.rotation\.y = DEFAULT_MOON_ORBIT_ANGLE/);
  assert.match(globe, /this\.moonOrbit\.rotation\.set\(0, DEFAULT_MOON_ORBIT_ANGLE, 0\)/);
  assert.match(globe, /moon-paper\.png/);
  assert.match(globe, /loadMoonTexture\(\) \{[\s\S]*new THREE\.TextureLoader\(\)\.load\([\s\S]*moon-paper\.png/);
  assert.match(globe, /setVisible\(visible\) \{[\s\S]*if \(visible\) \{[\s\S]*this\.loadMoonTexture\(\)/);
  assert.doesNotMatch(globe.slice(globe.indexOf("  addMoon()"), globe.indexOf("  loadMoonTexture()")), /TextureLoader/);
  assert.doesNotMatch(globe, /moon-orbit-path|new THREE\.LineLoop/);
  assert.match(globe, /moon\.rotation\.y = Math\.PI/);
  assert.match(globe, /this\.earthMoonSystem\.add\(orbitPlane\)/);
  assert.match(globe, /this\.earthMoonSystem\.rotation\.y \+= dx \* \.006/);
  assert.match(globe, /DEFAULT_CAMERA_DISTANCE = 600/);
  assert.match(globe, /MIN_CAMERA_DISTANCE = 70/);
  assert.match(globe, /MAX_CAMERA_DISTANCE = 1_200/);
  assert.match(globe, /verticalFovForCoverageAtDistance/);
  assert.match(globe, /new THREE\.PerspectiveCamera\(DEFAULT_CAMERA_FOV, 1, 10, 1_500\)/);
  assert.match(globe, /this\.camera\.position\.z \* zoomFactor/);
  assert.match(globe, /animationSpeeds\(\)[\s\S]*moonInViewport[\s\S]*visibleMoonTransitArc\(angle\)[\s\S]*return \{ moon: MOON_OFFSCREEN_ORBIT_SPEED, earth: AUTO_ROTATION_SPEED \}/);
  assert.match(globe, /moonViewportEntryAngle\(hiddenAngle, visibleAngle\)[\s\S]*if \(this\.moonVisibleAtAngle\(midpoint\)\) inside = midpoint/);
  assert.match(globe, /if \(!this\.moonWasInViewport && this\.moonVisibleAtAngle\(nextMoonAngle\)\) \{[\s\S]*nextMoonAngle = this\.moonViewportEntryAngle\(currentMoonAngle, nextMoonAngle\)/);
  assert.match(globe, /this\.moonOrbit\.rotation\.y = nextMoonAngle;[\s\S]*this\.globe\.rotation\.y \+= elapsed \* speed\.earth/);
  assert.match(globe, /earthSlowdown = MIN_MOON_TRANSIT_SECONDS \/ this\.moonTransitSeconds[\s\S]*AUTO_ROTATION_SPEED \* earthSlowdown/);
  assert.match(globe, /setMoonTransitSeconds\(seconds\)[\s\S]*THREE\.MathUtils\.clamp\(Number\(seconds\) \|\| DEFAULT_MOON_TRANSIT_SECONDS, MIN_MOON_TRANSIT_SECONDS, MAX_MOON_TRANSIT_SECONDS\)/);
  assert.match(html, /Drag or use arrow keys to rotate the Earth and Moon together/);
  assert.match(globe, /QuadraticBezierCurve3/);
  assert.match(globe, /this\.autoRotate = false/);
  assert.match(globe, /itemParent\(item\) \{[\s\S]*item\.body === "moon" \? this\.moon : this\.globe/);
  assert.match(globe, /this\.itemParent\(item\)\.add\(node\)/);
  assert.match(source, /precision: entity\.geo\.precision/);
  assert.match(globe, /updateMoonNodes\(\)[\s\S]*node\.userData\.precision === "celestial-body"[\s\S]*this\.moon\.worldToLocal\(world\)/);
  assert.match(globe, /itemVector\(item, surfaceOffset = 0\)[\s\S]*MOON_RADIUS \+ \.006 \+ surfaceOffset/);
  assert.match(globe, /intersectionAt\(event\)[\s\S]*intersections\.find\(\(\{ object \}\) => this\.moonSurfaceNodeVisible\(object\)\)[\s\S]*lunarSurface\?\.object/);
  assert.match(globe, /moonSurfaceNodeVisible\(node\)[\s\S]*precision === "celestial-body"[\s\S]*outward\.dot\(towardCamera\) > \.15[\s\S]*!this\.labelOccludedByEarth\(world\)/);
  assert.match(globe, /this\.earth = earth/);
  assert.match(globe, /labelOccludedByEarth\(world\)[\s\S]*intersectObject\(this\.earth, false\)/);
  assert.match(globe, /label\.hidden = !visible \|\| occluded \|\| projected\.z < -1 \|\| projected\.z > 1/);
  assert.match(styles, /\.globe-label \{[^}]*max-width: 180px;[^}]*overflow: hidden;[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
  assert.match(globe, /setPlaying\(playing\)/);
  assert.match(globe, /payload\.relationships/);
  assert.match(globe, /relationshipLayer === "always"/);
  assert.doesNotMatch(globe, /prefers-reduced-motion/);
  assert.match(source, /mapAnimationButton/);
  assert.match(source, /syncMapAnimationButton/);
  assert.match(globe, /render\(payload\)[\s\S]*this\.setVisible\(true\)/);
  assert.ok(fs.statSync("vendor/addons/SVGLoader.js").size > 70_000);
  assert.match(threeModule, /three\.core\.min\.js/);
  assert.ok(fs.statSync("vendor/three.core.min.js").size > 300_000);
  assert.ok(fs.statSync("assets/map/moon-lroc-color.jpg").size > 400_000);
  assert.ok(fs.statSync("assets/map/moon-paper.png").size > 20_000);
  assert.match(fs.readFileSync("assets/map/moon-texture-source.txt", "utf8"), /NASA Scientific Visualization Studio/);
});

test("map and timeline expose relationship controls", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /\["scatter", "map", "timeline"\]\.includes\(state\.config\.type\)/);
  assert.match(source, /function documentRelationshipNetworks/);
  assert.match(source, /Shared published entities/);
  assert.match(source, /state\.config\.timelineRole === "entity"[\s\S]*documentRelationshipNetworks/);
  assert.match(source, /relationships: overlay\.edges\.map/);
});

test("timeline defaults to evidence-backed event dates instead of cataloging time", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /timeline: \{ timelineRole: "event", x: "startDate", y: "mentionRank", size: "documentCount"[^\n]+relationshipLayer: "always"/);
  assert.match(source, /title = config\.timelineRole === "event" \? "Event Sequence"/);
  assert.match(source, /state\.config\.timelineRole === "event" && state\.config\.relationshipLayer !== "off"/);
  assert.match(source, /const shared = \(item\.entityIds \|\| \[\]\)\.filter/);
  assert.match(source, /state\.catalog\.events \|\| \[\]/);
  assert.match(source, /item\.confidence >= \.9/);
  assert.match(source, /item\.startDate \|\| item\.documentDate/);
  assert.match(source, /Evidence-backed events by occurrence date/);
  assert.match(source, /\["createdAt", "documentDate", "startDate"\]\.includes\(xKey\)/);
  assert.match(source, /labels: "top", limit: 50/);
  assert.match(source, /b\.mentionCount - a\.mentionCount \|\| b\.documentCount - a\.documentCount/);
  assert.match(source, /const topLabelIds = new Set\(\[\.\.\.data\]/);
  assert.match(source, /item\.mentionRank = index \+ 1/);
  assert.match(source, /mentionCount: "Event mentions"/);
  assert.match(source, /mentionRank: "Mention rank"/);
  assert.match(source, /yKey === "mentionRank" \? Math\.round\(rawValue\) : rawValue/);
  assert.match(source, /\[item\.mentionRank, "mention rank"\], \[item\.mentionCount, "event mentions"\]/);
  assert.match(source, /config\.type === "timeline" && config\.timelineRole === "event"\) config\.y = "mentionRank"/);
});

test("README screenshots capture the Far Side during its foreground transit", () => {
  const script = fs.readFileSync("scripts/capture_graph_screenshots.mjs", "utf8");
  const workflow = fs.readFileSync(".github/workflows/refresh-screenshots.yml", "utf8");
  const readme = fs.readFileSync("README.md", "utf8");

  assert.match(script, /id: "far-side-moon"[\s\S]*label: "Far Side of the Moon"/);
  assert.match(script, /alt: "Far Side of the Moon map screenshot"/);
  assert.match(script, /const galleryItems = \[[\s\S]*\.\.\.graphTypes\.map[\s\S]*\.\.\.farSideScreenshot/);
  assert.match(script, /index < galleryItems\.length/);
  assert.match(script, /precision: "selenographic-region"/);
  assert.match(script, /moonOrbit\.rotation\.y = Math\.PI \* 3 \/ 2/);
  assert.match(script, /nodes\.find\(item => item\.userData\.name === "Far Side of the Moon"\)/);
  assert.match(script, /label && !label\.hidden/);
  assert.match(script, /page\.locator\("\.stage"\)\.screenshot/);
  assert.match(workflow, /npm run screenshots/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' \|\|\s+github\.event\.workflow_run\.conclusion == 'success'/);
  assert.doesNotMatch(workflow, /github\.event_name == 'push'/);
  assert.doesNotMatch(workflow, /workflow_run\.conclusion == 'failure'/);
  assert.match(readme, /<table>[\s\S]*far-side-moon\.png[\s\S]*<\/table>/);
  assert.doesNotMatch(readme, /<p align="center">\s*<strong>Far Side of the Moon<\/strong>/);
});

test("Book is a first-class mention-weighted area view for transcript-backed titles", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const items = [
        { id: "one", name: "UFOs and Nukes", category: "book", mentions: 18, contextAdjustedMentions: 12 },
        { id: "two", name: "Contact", category: "book", mentions: 8, contextAdjustedMentions: 4 },
        { id: "three", name: "Journey of Souls", category: "book", mentions: 2, contextAdjustedMentions: 2 }
      ];
      const layout = bookshelfLayout(items, 900, 600);
      const denseItems = Array.from({ length: 132 }, (_, index) => ({ id: String(index), name: "Book " + index, mentions: (index % 9 + 1) ** 2 }));
      const denseLayout = bookshelfLayout(denseItems, 970, 732);
      return JSON.stringify({
        types: TYPES.map(type => type.id),
        bookTypeLabel: TYPES.find(type => type.id === "book").label,
        titles: [20, 40].map(limit => dataAwareTitle({ ...DEFAULT, type: "book", categories: ["book"], limit })),
        blocks: layout.blocks.map(block => ({ id: block.item.id, mentions: block.item.mentions, x: block.x, y: block.y, width: block.width, height: block.height })),
        occupancy: layout.occupancy,
        dense: {
          occupancy: denseLayout.occupancy,
          blocks: denseLayout.blocks.map(block => ({ x: block.x, y: block.y, width: block.width, height: block.height })),
          title: bookTitleLayout(denseLayout.blocks[0], 12)
        },
        titleAspects: {
          short: preferredBookTitleAspect({ name: "Contact" }),
          long: preferredBookTitleAspect({ name: "Extraterrestrial Contact: The Evidence and Implications" })
        },
        titleScale: {
          large: bookTitleLayout({ item: { name: "Contact" }, x: 0, y: 0, width: 240, height: 240 }, 12),
          small: bookTitleLayout({ item: { name: "Contact" }, x: 0, y: 0, width: 80, height: 60 }, 12),
          cramped: bookTitleLayout({ item: { name: "Extraterrestrial Contact: The Evidence and Implications" }, x: 0, y: 0, width: 40, height: 32 }, 12)
        },
        narrowLabel: bookLabelLines("Extraterrestrial Intelligence", 8, 2)
      });
    })()
  `, context));

  assert.ok(result.types.includes("book"));
  assert.equal(result.bookTypeLabel, "Bookshelf");
  assert.deepEqual(result.titles, ["Top 20 Books Mentioned", "Top 40 Books Mentioned"]);
  assert.equal(result.blocks.length, 3);
  const bookById = Object.fromEntries(result.blocks.map(block => [block.id, block]));
  assert.ok(Math.abs(bookById.one.width * 3 - bookById.one.height * 2) < .001);
  assert.ok(result.occupancy > .999);
  assert.ok(result.dense.blocks.every(block => block.x >= 0 && block.y >= 0 && block.x + block.width <= 970 && block.y + block.height <= 732));
  assert.ok(Math.abs(result.dense.blocks[0].width * 3 - result.dense.blocks[0].height * 2) < .001);
  assert.ok(new Set(result.dense.blocks.map(block => block.width.toFixed(2))).size > 1);
  assert.ok(result.dense.occupancy > .999);
  result.dense.blocks.forEach((block, index) => result.dense.blocks.slice(index + 1).forEach(other => {
    const epsilon = .000001;
    const separated = block.x + block.width <= other.x + epsilon || other.x + other.width <= block.x + epsilon
      || block.y + block.height <= other.y + epsilon || other.y + other.height <= block.y + epsilon;
    assert.equal(separated, true);
  }));
  assert.ok(result.dense.title.labelSize >= 8 && result.dense.title.labelSize <= 18);
  assert.ok(result.dense.title.lines.length >= 1);
  assert.ok(result.titleAspects.long > result.titleAspects.short);
  assert.ok(result.titleAspects.short >= 1 && result.titleAspects.long <= 2.2);
  assert.ok(result.titleScale.large.labelSize > result.titleScale.small.labelSize);
  assert.equal(result.titleScale.large.complete, true);
  assert.equal(result.titleScale.small.complete, true);
  assert.equal(result.titleScale.cramped.complete, false);
  assert.deepEqual(result.narrowLabel, ["Extraterrestrial", "Intelligence"]);
  assert.match(source, /book: \{[^}]*labels: "all"/);
  assert.match(source, /book: \{[^}]*limit: 20/);
  assert.match(source, /state\.config\[key\] = value;\s+if \(key === "limit"\) syncAutomaticTitle\(\)/);
  assert.doesNotMatch(source, /if \(type === "book"\).*categories: \["book"\]/);
  assert.match(source, /const data = filteredEntities\(\["book"\]\)/);
  assert.match(source, /Mention-weighted cover area/);
  assert.match(source, /Math\.sqrt\(leadArea \* 2 \/ 3\)/);
  assert.match(source, /function preferredBookTitleAspect/);
  assert.match(source, /const rowScore = row =>/);
  assert.match(source, /Number\(item\.mentions\)/);
  assert.match(source, /font-family:Georgia,'Times New Roman',serif/);
  assert.match(source, /"text-anchor": "start"/);
  assert.match(source, /class: "mark book-volume"/);
  assert.match(source, /class: "book-spine"/);
  assert.match(source, /class: "book-author"/);
  assert.match(source, /function bookAuthor/);
  assert.match(source, /if \(!titleLayout\.complete\) return/);
  assert.doesNotMatch(source, /class: "book-shelf"/);
  assert.match(source, /state\.config\.type === "book" \? "Shade" : "Size \+ shade"/);
  assert.match(source, /const fixedCategories = state\.config\.type === "book" \|\| state\.config\.type === "document"/);
  assert.match(source, /state\.config\.type === "book" \? category === "book"/);
  assert.match(source, /fixedCategories \? "disabled"/);
  assert.match(source, /const shouldLabel = state\.config\.labels !== "none"/);
});

test("Documents provides a searchable finder linked to immutable machine-data sources", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      state.catalog = {
        input: { repository: "ufo-files/machine-data", revision: "abc123" },
        documents: [{ id: "one", title: "A File", source: "Collection A", path: "Collection A/pdfs/a file.txt", words: 12 }]
      };
      Object.assign(state.config, { type: "document", size: "words", allSources: true });
      return JSON.stringify({
        type: TYPES.find(type => type.id === "document"),
        title: dataAwareTitle(state.config),
        url: machineDataDocumentURL(state.catalog.documents[0])
      });
    })()
  `, context));

  assert.deepEqual(result.type, {
    id: "document",
    label: "Documents",
    scope: "All corpus files",
    icon: "<path d='M7 2h12l5 5v11H7zM19 2v5h5M11 11h9M11 14h9'/><path d='M4 5H2v15h17v-2'/>"
  });
  assert.equal(result.title, "Document Finder");
  assert.equal(result.url, "https://github.com/ufo-files/machine-data/blob/abc123/Collection%20A/pdfs/a%20file.txt");
  assert.match(source, /document: \{ size: "words", color: "source", labels: "top", documentSearch: "" \}/);
  assert.match(source, /Search title, path, collection, or format/);
  assert.match(source, /const batch = matching\.slice\(shown, shown \+ 100\)/);
  assert.match(source, /browser\.scrollTop \+ browser\.clientHeight >= browser\.scrollHeight - 240/);
  assert.doesNotMatch(source, /data-document-folder/);
  assert.match(source, /query \? "Search results" : "All documents"/);
  assert.match(source, /class="document-card-main"[^>]*data-document-inspect/);
  assert.match(source, /class="document-source-link"[^>]*href="\$\{escapeHTML\(machineDataDocumentURL\(document\)\)\}"/);
  assert.match(source, /robustValueExtent\(matching, "words"\)/);
  assert.match(source, /const intensity = clampedScale\(document\.words, wordExtent, \[\.14, \.94\]\)/);
  assert.match(source, /sort\(\(left, right\) => right\.entityCount - left\.entityCount/);
  assert.match(source, /Every completed file/);
  assert.match(source, /document: renderDocument/);
});

test("Table renders all matching records in infinite-scroll batches of 100", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const tableRecordsSource = source.match(/function tableRecords\(\)[\s\S]*?\n\}/)?.[0] || "";
  const renderTableSource = source.match(/function renderTable\(\)[\s\S]*?\n\}/)?.[0] || "";

  assert.doesNotMatch(tableRecordsSource, /\.slice\(0, state\.config\.limit\)/);
  assert.match(renderTableSource, /const batch = records\.slice\(shown, shown \+ 100\)/);
  assert.match(renderTableSource, /tableView\.scrollTop \+ tableView\.clientHeight >= tableView\.scrollHeight - 240/);
  assert.match(renderTableSource, /data-table-body/);
  assert.match(source, /All matching rows/);
});

test("duplicate review opens the proactive identity queue", () => {
  const elements = {
    builderView: new FakeElement(),
    inspector: new FakeElement(),
    inspectorContent: new FakeElement()
  };
  elements.builderView.classList.add("inspector-collapsed");
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams, requestAnimationFrame() {} });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`state.catalog = {
    counts: { possibleDuplicates: 1 },
    duplicateCandidates: [{
      category: "person", similarity: .966, reason: "similar person name",
      left: { name: "John Greenewald", mentions: 20 },
      right: { name: "John Greenwald", mentions: 4 }
    }]
  }; inspectDuplicateCandidates();`, context);

  assert.equal(elements.builderView.classList.contains("inspector-collapsed"), false);
  assert.match(elements.inspectorContent.innerHTML, /Possible duplicates/);
  assert.match(elements.inspectorContent.innerHTML, /John Greenewald/);
  assert.match(elements.inspectorContent.innerHTML, /John Greenwald/);
  assert.match(elements.inspectorContent.innerHTML, /entity_aliases\.json/);
});

test("collection selection distinguishes all collections from no collections", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    allSelected: sourceIsSelected("Collection A", [], true),
    noneSelected: sourceIsSelected("Collection A", [], false),
    explicitSelected: sourceIsSelected("Collection A", ["Collection A"], false),
    explicitUnselected: sourceIsSelected("Collection B", ["Collection A"], false),
    normalizedAll: sourceSelectionConfig(["Collection A", "Collection B"], ["Collection A", "Collection B"]),
    normalizedNone: sourceSelectionConfig([], ["Collection A", "Collection B"]),
    normalizedSubset: sourceSelectionConfig(["Collection A"], ["Collection A", "Collection B"])
  })`, context));

  assert.equal(result.allSelected, true);
  assert.equal(result.noneSelected, false);
  assert.equal(result.explicitSelected, true);
  assert.equal(result.explicitUnselected, false);
  assert.deepEqual(result.normalizedAll, { sources: [], allSources: true });
  assert.deepEqual(result.normalizedNone, { sources: [], allSources: false });
  assert.deepEqual(result.normalizedSubset, { sources: ["Collection A"], allSources: false });
});

test("no selected collections produces no matching records", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.documentById.set("doc-1", { source: "Collection A" });
    Object.assign(state.config, { categories: ["person"], minConfidence: 0, sources: [], allSources: false });
    JSON.stringify({
      sourceMatches: sourceMatches("Collection A"),
      entityMatches: entityMatches({ category: "person", classificationConfidence: 1, documentIds: ["doc-1"] })
    })
  `, context));

  assert.equal(result.sourceMatches, false);
  assert.equal(result.entityMatches, false);
});

test("entity and relationship metrics are recomputed for selected collections", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.catalog = {
      documents: [
        { id: "doc-a", source: "Collection A" },
        { id: "doc-b", source: "Collection B" }
      ],
      entities: []
    };
    state.documentById.set("doc-a", state.catalog.documents[0]);
    state.documentById.set("doc-b", state.catalog.documents[1]);
    Object.assign(state.config, { sources: ["Collection A"], allSources: false });
    const entity = filteredEntity({
      id: "entity-1", mentions: 12, documentCount: 2, sourceCount: 2,
      documentIds: ["doc-a", "doc-b"], evidence: [{ documentId: "doc-a" }, { documentId: "doc-b" }],
      sourceMetrics: {
        "Collection A": { mentions: 2, contextAdjustedMentions: 1, independentDocumentCount: 1, documentCount: 1, inflationSignals: { repeatedContextMentions: 2 } },
        "Collection B": { mentions: 10, contextAdjustedMentions: 8, independentDocumentCount: 1, documentCount: 1, inflationSignals: { withinDocumentDuplicates: 2 } }
      }
    });
    const edge = filteredEdge({
      evidenceCount: 7, documentCount: 2,
      evidence: [{ documentId: "doc-a" }, { documentId: "doc-b" }],
      sourceMetrics: {
        "Collection A": { evidenceCount: 1, documentCount: 1 },
        "Collection B": { evidenceCount: 6, documentCount: 1 }
      }
    });
    const comparison = filteredEntity({
      id: "entity-2", mentions: 10, documentCount: 2, sourceCount: 2,
      documentIds: ["doc-a", "doc-b"], evidence: [],
      sourceMetrics: {
        "Collection A": { mentions: 9, contextAdjustedMentions: 9, independentDocumentCount: 1, documentCount: 1 },
        "Collection B": { mentions: 1, contextAdjustedMentions: 1, independentDocumentCount: 1, documentCount: 1 }
      }
    });
    const filteredExtent = valueExtent([entity, comparison], "mentions");
    const filteredRadius = scale(entity.mentions, filteredExtent, [5, 17]);
    const catalogRadius = scale(12, valueExtent([{ mentions: 12 }, { mentions: 10 }], "mentions"), [5, 17]);
    JSON.stringify({ entity, edge, filteredRadius, catalogRadius })
  `, context));

  assert.equal(result.entity.mentions, 2);
  assert.equal(result.entity.contextAdjustedMentions, 1);
  assert.equal(result.entity.independentDocumentCount, 1);
  assert.equal(result.entity.inflationRate, 0.5);
  assert.equal(result.entity.documentInflationRate, 0);
  assert.equal(result.entity.inflationRisk, "low");
  assert.equal(result.entity.documentCount, 1);
  assert.equal(result.entity.sourceCount, 1);
  assert.deepEqual(result.entity.documentIds, ["doc-a"]);
  assert.equal(result.edge.evidenceCount, 1);
  assert.equal(result.edge.documentCount, 1);
  assert.deepEqual(result.edge.evidence, [{ documentId: "doc-a" }]);
  assert.ok(result.filteredRadius < result.catalogRadius);
});

test("prominence inflation filtering follows the selected collection scope", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    const documents = [{ id: "clean", source: "Clean" }, ...Array.from({ length: 100 }, (_, index) => ({ id: "boilerplate-" + index, source: "Boilerplate" }))];
    state.catalog = { documents, entities: [] };
    state.catalog.documents.forEach(document => state.documentById.set(document.id, document));
    const entity = {
      category: "person", classificationConfidence: 1, mentions: 101, contextAdjustedMentions: 2,
      documentCount: 101, independentDocumentCount: 2, documentIds: documents.map(document => document.id), evidence: [],
      sourceMetrics: {
        Clean: { mentions: 1, contextAdjustedMentions: 1, documentCount: 1, independentDocumentCount: 1 },
        Boilerplate: { mentions: 100, contextAdjustedMentions: 1, documentCount: 100, independentDocumentCount: 1 }
      }
    };
    Object.assign(state.config, { categories: ["person"], minConfidence: 0, includeHighInflation: false, sources: ["Clean"], allSources: false });
    const cleanVisible = entityMatches(entity);
    Object.assign(state.config, { sources: ["Boilerplate"] });
    const boilerplateVisible = entityMatches(entity);
    JSON.stringify({ cleanVisible, boilerplateVisible })
  `, context));

  assert.equal(result.cleanVisible, true);
  assert.equal(result.boilerplateVisible, false);
});

test("significant entity presets configure scatters across all collections", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const presets = [
    ["significant-people", "person", "Significant People"],
    ["significant-places", "location", "Significant Places"],
    ["significant-terms", "subject", "Significant Terms"]
  ];

  for (const [id, category, title] of presets) {
    const config = JSON.parse(vm.runInContext(`JSON.stringify(presetConfig("${id}"))`, context));
    assert.equal(config.type, "scatter");
    assert.equal(config.x, "entity");
    assert.equal(config.y, "contextAdjustedMentions");
    assert.equal(config.size, "independentDocumentCount");
    assert.equal(config.includeHighInflation, false);
    assert.deepEqual(config.categories, [category]);
    assert.deepEqual(config.sources, []);
    assert.equal(config.title, title);
  }
});

test("presets refine the selected graph type instead of replacing it", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    network: presetConfig("significant-people", "network"),
    map: presetConfig("significant-people", "map"),
    bars: presetConfig("significant-people", "bars"),
    defaultMap: presetConfig("default", "map"),
    activeNetwork: (() => {
      state.config = presetConfig("significant-people", "network");
      return activePresetId();
    })(),
    activeMap: (() => {
      state.config = presetConfig("significant-people", "map");
      return activePresetId();
    })(),
    activeBars: (() => {
      state.config = presetConfig("significant-people", "bars");
      return activePresetId();
    })()
  })`, context));

  assert.equal(result.network.type, "network");
  assert.equal(result.network.nodeRole, "entity");
  assert.deepEqual(result.network.categories, ["person"]);
  assert.equal(result.network.includeHighInflation, false);
  assert.equal(result.network.title, "People Relationships");
  assert.equal(result.map.type, "map");
  assert.deepEqual(result.map.categories, ["person"]);
  assert.equal(result.map.includeHighInflation, false);
  assert.equal(result.bars.type, "bars");
  assert.equal(result.bars.aggregation, "entity");
  assert.equal(result.bars.y, "contextAdjustedMentions");
  assert.deepEqual(result.bars.categories, ["person"]);
  assert.equal(result.bars.title, "Mentions by People");
  assert.equal(result.defaultMap.type, "map");
  assert.deepEqual(result.defaultMap.categories, ["location"]);
  assert.equal(result.activeNetwork, "significant-people");
  assert.equal(result.activeMap, "significant-people");
  assert.equal(result.activeBars, "significant-people");
});

test("an existing Significant People URL migrates away from raw mentions", () => {
  const saved = {
    type: "scatter", x: "entity", y: "mentions", size: "documentCount",
    categories: ["person"], sources: [], allSources: true, title: "Significant People"
  };
  const encoded = Buffer.from(JSON.stringify(saved), "utf8").toString("base64");
  const context = vm.createContext({
    location: { hash: `#config=${encodeURIComponent(encoded)}` },
    URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"),
    escape,
    decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.equal(config.y, "contextAdjustedMentions");
  assert.equal(config.size, "independentDocumentCount");
  assert.equal(config.includeHighInflation, false);
});

test("automatic titles follow active entity categories, axes, and collections", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.config = presetConfig("significant-people");
    const presetTitle = state.config.title;
    state.config.categories.push("government_agency");
    syncAutomaticTitle();
    const expandedTitle = state.config.title;
    Object.assign(state.config, { x: "documentCount", sources: ["Army reports"], allSources: false });
    syncAutomaticTitle();
    const refinedTitle = state.config.title;
    JSON.stringify({ presetTitle, expandedTitle, refinedTitle })
  `, context));

  assert.equal(result.presetTitle, "Significant People");
  assert.equal(result.expandedTitle, "Significant People and Government Agencies");
  assert.equal(result.refinedTitle, "Mentions by Raw documents — People and Government Agencies — Army reports");
});

test("default chart titles avoid repeating the graph type", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const titles = JSON.parse(vm.runInContext(`JSON.stringify({
    scatter: dataAwareTitle(presetConfig("default", "scatter")),
    network: dataAwareTitle(presetConfig("default", "network")),
    table: dataAwareTitle(presetConfig("default", "table")),
    scopedScatter: dataAwareTitle({ ...presetConfig("default", "scatter"), categories: ["person"] }),
    scopedNetwork: dataAwareTitle({ ...presetConfig("default", "network"), categories: ["person"] }),
    scopedTable: dataAwareTitle({ ...presetConfig("default", "table"), categories: ["person"] })
  })`, context));

  assert.deepEqual(titles, {
    scatter: "Mentions by Documents",
    network: "Relationships",
    table: "All Entities",
    scopedScatter: "Mentions by Documents — People",
    scopedNetwork: "People Relationships",
    scopedTable: "People"
  });
});

test("automatic entity table titles summarize category and collection refinements", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const titles = JSON.parse(vm.runInContext(`JSON.stringify({
    oneOfEach: dataAwareTitle({
      ...presetConfig("default", "table"), categories: ["person"],
      sources: ["Collection 1"], allSources: false
    }),
    condensed: dataAwareTitle({
      ...presetConfig("default", "table"), categories: ["person"],
      sources: Array.from({ length: 11 }, (_, index) => "Collection " + (index + 1)), allSources: false
    }),
    allCategoriesInOneCollection: dataAwareTitle({
      ...presetConfig("default", "table"), sources: ["Collection 1"], allSources: false
    }),
    noCollections: dataAwareTitle({
      ...presetConfig("default", "table"), categories: ["person"], sources: [], allSources: false
    })
  })`, context));

  assert.deepEqual(titles, {
    oneOfEach: "People and Collection 1",
    condensed: "People, Collection 1, and 10 more",
    allCategoriesInOneCollection: "All Entities and Collection 1",
    noCollections: "People and No Collections"
  });
});

test("adjusted significance falls back safely for an older catalog", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const entity = JSON.parse(vm.runInContext(`JSON.stringify(withSignificanceDefaults({
    name: "Legacy entity", mentions: 42, documentCount: 9,
    sourceMetrics: { Archive: { mentions: 40, documentCount: 8 } }
  }))`, context));

  assert.equal(entity.contextAdjustedMentions, 42);
  assert.equal(entity.independentDocumentCount, 9);
  assert.equal(entity.inflationRate, 0);
  assert.equal(entity.documentInflationRate, 0);
  assert.equal(entity.inflationRisk, "low");
  assert.equal(entity.sourceMetrics.Archive.contextAdjustedMentions, 40);
  assert.equal(entity.sourceMetrics.Archive.independentDocumentCount, 8);
});

test("legacy source concentration cannot restore a high-inflation entity to Significant People", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.config = presetConfig("significant-people");
    const entity = withSignificanceDefaults({
      name: "John Greenewald", category: "person", classificationConfidence: .99,
      mentions: 934, documentCount: 874, documentIds: [],
      sourceMetrics: {
        "Black-Vault-UFO": { mentions: 932, documentCount: 872 },
        "American-Alchemy": { mentions: 2, documentCount: 2 }
      }
    });
    JSON.stringify({
      adjusted: entity.contextAdjustedMentions,
      rate: entity.inflationRate,
      documentRate: entity.documentInflationRate,
      risk: entity.inflationRisk,
      visible: entityMatches(entity)
    })
  `, context));

  assert.equal(result.adjusted, 34);
  assert.ok(result.rate > .95);
  assert.ok(result.documentRate > .95);
  assert.equal(result.risk, "high");
  assert.equal(result.visible, false);
});

test("prominence risk distinguishes boilerplate identity inflation from common entities", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify(Object.fromEntries([
    ["Greenewald", { mentions: 939, contextAdjustedMentions: 23, documentCount: 879, independentDocumentCount: 9, inflationRisk: "high" }],
    ["Greer", { mentions: 17, contextAdjustedMentions: 17, documentCount: 11, independentDocumentCount: 11, inflationRisk: "low" }],
    ["NASA", { mentions: 4186, contextAdjustedMentions: 2734, documentCount: 182, independentDocumentCount: 178, inflationRisk: "elevated" }],
    ["UAP", { mentions: 3052, contextAdjustedMentions: 2051, documentCount: 142, independentDocumentCount: 135, inflationRisk: "elevated" }],
    ["FBI", { mentions: 2385, contextAdjustedMentions: 1461, documentCount: 155, independentDocumentCount: 142, inflationRisk: "elevated" }]
  ].map(([name, metrics]) => [name, withSignificanceDefaults(metrics).inflationRisk])))`, context));

  assert.equal(result.Greenewald, "high");
  assert.equal(result.Greer, "low");
  assert.equal(result.NASA, "low");
  assert.equal(result.UAP, "low");
  assert.equal(result.FBI, "low");
});

test("entity inspection explains potential mention inflation", () => {
  const elements = {
    builderView: new FakeElement(),
    inspector: new FakeElement(),
    inspectorContent: new FakeElement()
  };
  elements.builderView.classList.add("inspector-collapsed");
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams, requestAnimationFrame() {} });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`inspectEntity({
    name: "John Greenewald", category: "person", contextAdjustedMentions: 29, mentions: 934,
    independentDocumentCount: 3, documentCount: 874, sourceCount: 2, inflationRate: .969, documentInflationRate: .997,
    inflationRisk: "high", classificationConfidence: .99, reviewStatus: "curated",
    variants: ["John Greenewald"], evidence: [],
    inflationSignals: { repeatedContextMentions: 871, administrativeMentions: 34, withinDocumentDuplicates: 20 }
  })`, context);

  assert.match(elements.inspectorContent.innerHTML, /adjusted mentions/);
  assert.match(elements.inspectorContent.innerHTML, /raw mentions/);
  assert.match(elements.inspectorContent.innerHTML, /High prominence inflation risk/);
  assert.match(elements.inspectorContent.innerHTML, /repeated-text mentions/);
  assert.match(elements.inspectorContent.innerHTML, /requester-metadata mentions/);
});

test("book inspection places the author beneath the title", () => {
  const elements = { builderView: new FakeElement(), inspector: new FakeElement(), inspectorContent: new FakeElement() };
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams, requestAnimationFrame() {} });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`inspectEntity({
    name: "UFOs and Nukes", category: "book", contextAdjustedMentions: 7, mentions: 8,
    independentDocumentCount: 4, documentCount: 4, sourceCount: 2, inflationRate: 0, documentInflationRate: 0,
    inflationRisk: "low", reviewStatus: "curated", variants: ["UFOs and Nukes"], evidence: [], inflationSignals: {}
  })`, context);
  assert.match(elements.inspectorContent.innerHTML, /<h3>UFOs and Nukes<\/h3><p class="inspect-subtitle">Robert Hastings<\/p>/);
});

test("an explicitly edited title remains custom until a preset is applied", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    Object.assign(state.config, { title: "My research view", titleMode: "custom", categories: ["person"] });
    syncAutomaticTitle();
    const preservedTitle = state.config.title;
    state.config = presetConfig("significant-places");
    syncAutomaticTitle(true);
    JSON.stringify({ preservedTitle, presetTitle: state.config.title, titleMode: state.config.titleMode })
  `, context));

  assert.equal(result.preservedTitle, "My research view");
  assert.equal(result.presetTitle, "Significant Places");
  assert.equal(result.titleMode, "auto");
});

test("network layout fits node positions to 90% of the canvas", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const positions = JSON.parse(vm.runInContext(`
    (() => {
      const points = new Map(Array.from({ length: 60 }, (_, index) => [index, networkSeedPosition(index, 60, 900, 600, false)]));
      fitNetworkPositions(points, 900, 600);
      return JSON.stringify([...points.values()]);
    })()
  `, context));
  const xs = positions.map(point => point.x);
  const ys = positions.map(point => point.y);

  assert.ok(Math.abs(Math.min(...xs) - 900 * .05) < .001);
  assert.ok(Math.abs(Math.max(...xs) - 900 * .95) < .001);
  assert.ok(Math.abs(Math.min(...ys) - 600 * .05) < .001);
  assert.ok(Math.abs(Math.max(...ys) - 600 * .95) < .001);
});

test("network edges use the same restrained rendering as relationship overlays", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(source, /class: "network-relationship-line mark"/);
  assert.match(source, /Math\.min\(2, \.4 \+ Math\.sqrt\(edge\.evidenceCount\) \* \.22\)/);
  assert.match(source, /networkLines\.get\(node\.id\)[\s\S]*line\.classList\.add\("is-focused"\)/);
  assert.match(styles, /\.network-relationship-line \{[^}]*opacity: \.07/);
  assert.match(styles, /\.network-relationship-layer\.has-focus \.network-relationship-line\.is-focused \{ opacity: \.8/);
});

test("all graph types export a presentation PDF with UFO Files provenance", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  const html = fs.readFileSync("index.html", "utf8");
  vm.runInContext(source, context);

  assert.equal(vm.runInContext('pdfFilename("Significant People")', context), "significant-people.pdf");
  assert.equal(vm.runInContext('pdfFilename(pdfExportTitle({ ...DEFAULT, type: "network", nodeRole: "entity", categories: ["person"], title: "Untitled graph" }))', context), "people-relationships.pdf");
  context.URL = URL;
  context.btoa = value => Buffer.from(value, "binary").toString("base64");
  context.history = { replaceState(_state, _title, value) { context.location.hash = value; } };
  const deepLink = vm.runInContext("currentGraphURL()", context);
  assert.match(deepLink, /^https:\/\/ufo-files\.github\.io\/relationship-graph-builder\/#config=/);
  const encodedConfig = decodeURIComponent(new URL(deepLink).hash.split("config=")[1]);
  const savedConfig = JSON.parse(Buffer.from(encodedConfig, "base64").toString("utf8"));
  assert.deepEqual(savedConfig, { configVersion: 2 });
  const qrcode = require("../vendor/qrcode-generator.js");
  const generatedCode = qrcode(0, "M");
  generatedCode.addData(deepLink, "Byte");
  generatedCode.make();
  assert.ok(generatedCode.getModuleCount() < 100);
  context.window = { qrcode };
  const longSearch = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.config = { ...DEFAULT, type: "table", tableSearch: "x".repeat(1_000) };
    const url = currentGraphURL();
    return { url, hasCode: Boolean(graphQRCode(url)) };
  })())`, context));
  assert.ok(longSearch.url.length < 2_000);
  assert.equal(longSearch.hasCode, true);
  const naming = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.catalog = { input: {}, generatedAt: null };
    Object.assign(state.config, { type: "network", nodeRole: "entity", categories: ["person"], title: "My Custom Investigation", titleMode: "custom" });
    const provenance = Object.fromEntries(pdfProvenance(new Date("2026-01-01T00:00:00Z")));
    return { view: provenance.VIEW, graphType: provenance["GRAPH TYPE"], title: state.config.title };
  })())`, context));
  assert.deepEqual(naming, { view: "People Relationships", title: "My Custom Investigation" });
  const properties = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.config = { ...DEFAULT, sources: ["Disclosure Team"], allSources: false, minConfidence: .91 };
    return Object.fromEntries(pdfGraphProperties());
  })())`, context));
  assert.equal(properties["Graph type"], "Scatter");
  assert.equal(properties["X axis"], "Documents");
  assert.equal(properties.Collections, "Disclosure Team");
  assert.equal(properties["Minimum confidence"], "91%");
  assert.equal(properties["Relationship layer"], "Always");
  assert.equal(properties["Maximum marks"], "50");
  assert.equal(properties["Include high-inflation"], "Yes");
  assert.equal(properties.Zoom, undefined, "inactive graph properties stay off the cover");
  assert.equal(properties["Label size"], undefined, "presentation mechanics stay off the cover");
  assert.equal(properties["Moon transit"], undefined, "animation timing stays off the cover");
  assert.equal(Object.keys(properties).at(-1), "Entity categories");
  assert.match(html, /id="exportButton">Export PDF<\/button>/);
  assert.match(html, /vendor\/jspdf\.umd\.min\.js[\s\S]*vendor\/svg2pdf\.umd\.min\.js[\s\S]*vendor\/qrcode-generator\.js[\s\S]*app\.js/);
  assert.doesNotMatch(html, /html2canvas/i);
  assert.match(source, /const UFO_FILES_URL = "https:\/\/ufo-files\.app"/);
  assert.match(source, /const UFO_FILES_GITHUB_URL = "https:\/\/github\.com\/ufo-files"/);
  assert.match(source, /const GRAPH_BUILDER_URL = "https:\/\/ufo-files\.github\.io\/relationship-graph-builder\/"/);
  assert.match(source, /\["CATALOG GENERATED", generatedAt\]/);
  assert.match(source, /\["SOURCE REVISION", revision\]/);
  assert.match(source, /function currentGraphURL\(\) \{[\s\S]*persistHash\(\)[\s\S]*new URL\(location\.hash, GRAPH_BUILDER_URL\)/);
  assert.match(source, /for \(const level of \["M", "L"\]\)[\s\S]*code\.addData\(url, "Byte"\)[\s\S]*code\.make\(\)[\s\S]*return null/);
  assert.match(source, /function drawPDFQRCode\(pdf, code, bounds\)[\s\S]*code\.isDark\(row, col\)[\s\S]*pdf\.rect/);
  assert.match(source, /function addPDFCover\(pdf, exportedAt, deepLink, code, logoPath\)[\s\S]*width: 42, height: 40[\s\S]*RELATIONSHIP GRAPH EXPORT[\s\S]*pdf\.textWithLink\("ufo-files\.app", 99, 94[\s\S]*pdfGraphProperties\(\)/);
  assert.match(source, /const PDF_FONT_FAMILY = "IBM Plex Mono"/);
  assert.match(source, /assets\/fonts\/\$\{font\.file\}[\s\S]*pdf\.addFileToVFS\(font\.file, font\.data\)[\s\S]*pdf\.addFont\(font\.file, PDF_FONT_FAMILY, font\.style\)/);
  assert.match(source, /pdfExportTitle\(\)[\s\S]*currentGraphURL\(\)[\s\S]*graphQRCode\(deepLink\)[\s\S]*new window\.jspdf\.jsPDF[\s\S]*loadPDFFonts\(pdf\)[\s\S]*addPDFCover\([\s\S]*addPDFGraphPage\([\s\S]*pdf\.save\(pdfFilename\(exportTitle\)\)/);
  assert.doesNotMatch(source, /html2canvas|window\.print\(|toDataURL\("image\/jpeg"/i);
  assert.doesNotMatch(source, /function export(?:SVG|CSV|DocumentCSV)/);
  assert.equal(fs.existsSync("vendor/html2canvas.min.js"), false);
  assert.ok(fs.statSync("vendor/jspdf.umd.min.js").size > 300_000);
  assert.ok(fs.statSync("vendor/svg2pdf.umd.min.js").size > 50_000);
  assert.ok(fs.statSync("vendor/JSPDF-LICENSE.txt").size > 1_000);
  assert.ok(fs.statSync("vendor/SVG2PDF-LICENSE.txt").size > 1_000);
  assert.ok(fs.statSync("vendor/qrcode-generator.js").size > 50_000);
  assert.ok(fs.statSync("vendor/QRCODE-GENERATOR-LICENSE.txt").size > 1_000);
  assert.ok(fs.statSync("assets/logo.svg").size > 8_000);
  assert.ok(fs.statSync("assets/fonts/IBMPlexMono-Regular.ttf").size > 150_000);
  assert.ok(fs.statSync("assets/fonts/IBMPlexMono-Bold.ttf").size > 150_000);
  assert.ok(fs.statSync("assets/fonts/IBM-PLEX-LICENSE.txt").size > 4_000);
  const logo = JSON.parse(vm.runInContext('JSON.stringify(svgPathOperations("M0 0 L460 0 V433 H0 Z", { x: 10, y: 20, width: 92, height: 86.6 }))', context));
  const roundedOperations = logo.operations.map(operation => operation.c
    ? { ...operation, c: operation.c.map(value => Math.round(value * 1_000) / 1_000) }
    : operation);
  assert.deepEqual(roundedOperations, [
    { op: "m", c: [10, 20] },
    { op: "l", c: [102, 20] },
    { op: "l", c: [102, 106.6] },
    { op: "l", c: [10, 106.6] },
    { op: "h" }
  ]);
  assert.equal(logo.strokeWidth, 1.2);
  const qrRects = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const rectangles = [];
    const pdf = { setFillColor() {}, rect(...args) { rectangles.push(args); } };
    const code = { getModuleCount: () => 2, isDark: row => row === 0 };
    drawPDFQRCode(pdf, code, { x: 0, y: 0, width: 20, height: 20 });
    return rectangles;
  })())`, context));
  assert.deepEqual(qrRects, [
    [0, 0, 20, 20, "F"],
    [0, 0, 20, 10, "F"]
  ]);
});

test("vector PDF includes the complete stage and only rasterizes the WebGL map", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  const globe = fs.readFileSync("map-globe.js", "utf8");
  const exportBody = globe.match(/prepareExport\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";

  assert.match(exportBody, /relationshipOpacities = this\.relationships\.map\(line => line\.material\.opacity\)/);
  assert.match(exportBody, /line\.material\.opacity = line\.userData\.baseOpacity/);
  assert.match(exportBody, /line\.material\.opacity = relationshipOpacities\[index\]/);
  assert.match(source, /stage\.classList\.add\("pdf-exporting"\)[\s\S]*requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/);
  assert.match(source, /state\.config\.type === "map" \? window\.ufoGlobe : null/);
  assert.match(source, /pdfVectorChart\(\)[\s\S]*getComputedStyle\(node\)[\s\S]*styleProperties\.forEach[\s\S]*font-family", PDF_FONT_FAMILY[\s\S]*font-weight", Number\.parseInt[\s\S]*>= 600 \? "bold" : "normal"[\s\S]*node-label[\s\S]*stroke", "none"/);
  assert.match(source, /await pdf\.svg\(pdfVectorChart\(\), \{[\s\S]*width: chartBounds\.width - inset \* 2/);
  assert.match(source, /else if \(!\$\("#mapView"\)\.hidden\)[\s\S]*pdf\.addImage\(canvas\.toDataURL\("image\/png"\)/);
  assert.match(source, /else drawPDFTableView\(pdf/);
  assert.match(source, /stage\.classList\.remove\("pdf-exporting"\)/);
  assert.match(source, /Catalog \$\{metadata\.get\("CATALOG GENERATED"\)\}/);
  assert.match(source, /Source \$\{metadata\.get\("SOURCE OF TRUTH"\)\}@\$\{metadata\.get\("SOURCE REVISION"\)\}/);
  assert.match(source, /const metadataCenterY = \(metadataTop \+ metadataBottom\) \/ 2[\s\S]*metadataCenterY - 8[\s\S]*metadataCenterY \+ 12/);
  assert.match(source, /stageRect\.width \/ stageRect\.height > 1\.25[\s\S]*landscape \? "landscape" : "portrait"/);
  assert.match(source, /const chartBounds = \{ x: 45, y: 112, width: pageWidth - 90, height: provenanceY - 190 \}/);
  assert.match(source, /const inset = 2/);
  assert.doesNotMatch(source, /window\.print\(\)|afterprint|pdf-printing/);
  assert.match(styles, /\.stage\.pdf-exporting \{ --paper: #fff; background: #fff; \}/);
  assert.match(styles, /\.stage\.pdf-exporting \.stage-tools \{ visibility: hidden; \}/);
  assert.doesNotMatch(styles, /\.stage\.pdf-exporting \.chart-wrap/);
  assert.match(styles, /\.stage\.pdf-exporting \.scatter-relationship-line \{ opacity: \.07 !important; \}/);
  assert.doesNotMatch(styles, /pdf-cover-render|pdf-stage-provenance|@media print|@page/);
});

test("robust scatter extents cap material outliers without changing ordinary ranges", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const ordinary = Array.from({ length: 20 }, (_, index) => ({ value: index + 1 }));
      const skewed = [...ordinary.slice(0, 19), { value: 1000 }];
      return JSON.stringify({
        ordinary: robustValueExtent(ordinary, "value"),
        skewed: robustValueExtent(skewed, "value"),
        outlierPosition: clampedScale(1000, robustValueExtent(skewed, "value").extent, [0, 100])
      });
    })()
  `, context));

  assert.deepEqual(result.ordinary, { extent: [0, 20], capped: false });
  assert.deepEqual(result.skewed, { extent: [0, 19], capped: true });
  assert.equal(result.outlierPosition, 100);
});

test("scatter label modes render the expected ranked entities", () => {
  const elements = {
    chart: new FakeElement(),
    chartWrap: new FakeElement(),
    tableView: new FakeElement(),
    legend: new FakeElement(),
    resultSummary: new FakeElement(),
    graphKicker: new FakeElement(),
    policySummary: new FakeElement()
  };
  const document = {
    createElementNS: () => new FakeElement(),
    querySelector: selector => elements[selector.slice(1)],
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { documents: 0 },
      entities: Array.from({ length: 20 }, (_, index) => ({
        id: String(index), name: "Entity " + index, category: "person",
        classificationConfidence: 1, mentions: 20 - index, sourceCount: 1,
        documentCount: 10, independentDocumentCount: index === 0 ? 1 : 10,
        inflationRisk: index === 0 ? "high" : "low", documentIds: []
      }))
    };
    Object.assign(state.config, {
      type: "scatter", x: "entity", y: "mentions", size: "sourceCount",
      categories: ["person"], sources: [], minConfidence: 0, limit: 20
    });
  `, context);

  vm.runInContext('state.config.labels = "top"; renderScatter();', context);
  const importantLabels = labelTexts(elements.chart);
  assert.deepEqual(importantLabels.slice(0, 10), Array.from({ length: 10 }, (_, index) => `Entity ${index}`));
  assert.ok(importantLabels.length > 10, "lower-ranked entities should be sampled");
  assert.equal(elements.chart.children.filter(node => node.attributes.class === "inflation-ring").length, 1);
  assert.ok(importantLabels.length < 20, "lower-ranked entities should not all be labeled");

  vm.runInContext('state.config.labels = "all"; renderScatter();', context);
  assert.equal(labelCount(elements.chart), 20);

  vm.runInContext('state.config.labels = "none"; renderScatter();', context);
  assert.equal(labelCount(elements.chart), 0);
});
