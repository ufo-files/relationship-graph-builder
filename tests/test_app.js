const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor() {
    this.attributes = {};
    this.children = [];
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
  addEventListener() {}
  getBoundingClientRect() { return { width: 900, height: 600 }; }
}

function labelCount(chart) {
  return chart.children.filter(node => node.attributes.class?.includes("node-label")).length;
}

function labelTexts(chart) {
  return chart.children.filter(node => node.attributes.class?.includes("node-label")).map(node => node.textContent);
}

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

test("default graph includes every entity category at 95% confidence", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.deepEqual(config.categories, [
    "person", "government_agency", "organization", "location", "program", "subject", "date"
  ]);
  assert.equal(config.x, "documentCount");
  assert.equal(config.y, "mentions");
  assert.equal(config.size, "documentCount");
  assert.equal(config.minConfidence, 0.95);
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
        "Collection A": { mentions: 2, documentCount: 1 },
        "Collection B": { mentions: 10, documentCount: 1 }
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
        "Collection A": { mentions: 9, documentCount: 1 },
        "Collection B": { mentions: 1, documentCount: 1 }
      }
    });
    const filteredExtent = valueExtent([entity, comparison], "mentions");
    const filteredRadius = scale(entity.mentions, filteredExtent, [5, 17]);
    const catalogRadius = scale(12, valueExtent([{ mentions: 12 }, { mentions: 10 }], "mentions"), [5, 17]);
    JSON.stringify({ entity, edge, filteredRadius, catalogRadius })
  `, context));

  assert.equal(result.entity.mentions, 2);
  assert.equal(result.entity.documentCount, 1);
  assert.equal(result.entity.sourceCount, 1);
  assert.deepEqual(result.entity.documentIds, ["doc-a"]);
  assert.equal(result.edge.evidenceCount, 1);
  assert.equal(result.edge.documentCount, 1);
  assert.deepEqual(result.edge.evidence, [{ documentId: "doc-a" }]);
  assert.ok(result.filteredRadius < result.catalogRadius);
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
    assert.equal(config.y, "mentions");
    assert.deepEqual(config.categories, [category]);
    assert.deepEqual(config.sources, []);
    assert.equal(config.title, title);
  }
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
  assert.equal(result.refinedTitle, "Mentions by Documents — People and Government Agencies — Army reports");
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
        documentIds: []
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
  assert.ok(importantLabels.length < 20, "lower-ranked entities should not all be labeled");

  vm.runInContext('state.config.labels = "all"; renderScatter();', context);
  assert.equal(labelCount(elements.chart), 20);

  vm.runInContext('state.config.labels = "none"; renderScatter();', context);
  assert.equal(labelCount(elements.chart), 0);
});
