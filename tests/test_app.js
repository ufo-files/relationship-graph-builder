const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor() {
    this.attributes = {};
    this.children = [];
    this.classList = { remove() {} };
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
