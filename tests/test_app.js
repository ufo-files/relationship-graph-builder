const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadCatalogFixture() {
  const catalog = JSON.parse(fs.readFileSync("data/catalog.json", "utf8"));
  if (!Array.isArray(catalog.documentShards) || catalog.documentShards.length === 0) return catalog;

  catalog.documents = catalog.documentShards.flatMap(shard => {
    const payload = JSON.parse(fs.readFileSync(`data/${shard.path}`, "utf8"));
    assert.equal(payload.schema, "ufo-files-source-documents/v1");
    assert.equal(payload.source, shard.source);
    assert.ok(Array.isArray(payload.documents));
    return payload.documents;
  });
  assert.equal(catalog.documents.length, catalog.counts.documents);
  return catalog;
}

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
    this.style = { setProperty() {}, removeProperty() {} };
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

test("startup loads and validates source-specific document shards", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /catalog\.documentShards\.map/);
  assert.match(source, /shard\.version \|\| catalog\.input\?\.revision/);
  assert.match(source, /ufo-files-source-documents\/v1/);
  assert.match(source, /Document shard count mismatch/);
});

test("Galactic Entities boots from a compact astronomy payload", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const payloadText = fs.readFileSync("data/astronomy.json", "utf8");
  const payload = JSON.parse(payloadText);
  assert.equal(payload.schema, "ufo-files-astronomy-bootstrap/v1");
  assert.equal(payload.astronomy.targets.length, payload.counts.astronomyTargets);
  assert.equal(payload.sources.length, payload.counts.sources);
  const referencedDocumentIds = new Set([
    ...payload.astronomy.targets.flatMap(target => (target.evidence || []).map(evidence => evidence.documentId)),
    ...payload.astronomy.reviewCandidates.flatMap(candidate => (candidate.examples || []).map(example => example.documentId))
  ]);
  assert.deepEqual(new Set(payload.documents.map(document => document.id)), referencedDocumentIds);
  assert.ok(payload.documents.every(document => document.id && document.path && document.source));
  assert.equal(payload.astronomy.observations, undefined);
  assert.ok(Buffer.byteLength(payloadText) < 2 * 1024 * 1024);
  assert.match(source, /state\.config\.type === "solar"/);
  assert.match(source, /fetch\("data\/astronomy\.json", \{ cache: "no-store" \}\)/);
  assert.match(source, /state\.catalogMode = "astronomy"/);
  assert.match(source, /state\.catalog\.documents\.forEach\(item => state\.documentById\.set\(item\.id, item\)\)/);
  assert.match(source, /type !== "solar" && !await ensureFullCatalog\(requestId\)/);
  assert.match(source, /const requestId = \+\+state\.typeRequestId/);
  assert.match(source, /requestId !== state\.typeRequestId/);
  assert.match(source, /state\.initialCatalogPromise = init\(\)/);
  assert.match(source, /if \(state\.initialCatalogPromise\) await state\.initialCatalogPromise/);
  assert.match(source, /state\.publicDossierPayload = publicDossierPayloadFromHash\(\)/);
  assert.match(source, /state\.publicDossierPayload \|\| publicDossierPayloadFromHash\(\)/);
  assert.match(source, /requestId === null \|\| requestId === state\.typeRequestId\) showCatalogError/);
  assert.match(source, /async function openDossierDialog\(\)[\s\S]*ensureFullCatalog\(\)[\s\S]*initializeDossier\(\)/);
});

test("catalog CI exercises the French source independently", () => {
  const workflow = fs.readFileSync(".github/workflows/rebuild-graph.yml", "utf8");
  assert.match(workflow, /^\s+- France-GEIPAN$/m);
});

test("government program chronology is source-backed and preserves congressional-record provenance", () => {
  const programs = JSON.parse(fs.readFileSync("data/government_programs.json", "utf8"));
  assert.equal(programs.schema, "ufo-files-government-programs/v1");
  assert.ok(programs.programs.length >= 20);
  assert.ok(programs.programs.every(program => program.sources.length && program.sources.every(source => source.url.startsWith("https://"))));
  assert.ok(programs.programs.every(program => program.startDate && program.startPrecision));
  const blueBook = programs.programs.find(program => program.id === "project-blue-book");
  assert.deepEqual([blueBook.startDate, blueBook.startPrecision, blueBook.endDate, blueBook.endPrecision, blueBook.evidenceStatus], ["1952-03", "month", "1969-12-17", "day", "official"]);
  const grudge = programs.programs.find(program => program.id === "project-grudge");
  assert.equal(grudge.intervals.length, 2);
  assert.deepEqual(grudge.intervals.map(interval => [interval.startDate, interval.endDate]), [["1949-02-11", "1949-12-27"], ["1951-10-27", "1952-03"]]);
  const immaculate = programs.programs.find(program => program.id === "immaculate-constellation");
  assert.equal(immaculate.evidenceStatus, "congressional_record_claim");
  assert.deepEqual([immaculate.startDate, immaculate.startPrecision], ["2017-12", "month"]);
  assert.match(immaculate.summary, /not agency confirmation/i);
  const operacaoPrato = programs.programs.find(program => program.id === "operacao-prato");
  assert.equal(operacaoPrato.entityId, "ent-18f2debd3471");
  assert.equal(programs.programs.find(program => program.id === "aawsap").name, "AAWSAP / AATIP");
  assert.deepEqual(
    programs.programs.filter(program => ["gepan", "sepra", "geipan"].includes(program.id)).map(program => [program.id, program.country, program.startDate, program.endDate]),
    [["gepan", "France", "1977-05-01", "1988"], ["sepra", "France", "1988", "2005"], ["geipan", "France", "2005", null]]
  );
  for (const id of ["flying-saucer-working-party", "project-second-storey", "project-stork", "robertson-panel", "condon-committee", "sioani", "project-condign", "nasa-uap-independent-study", "sky-canada"]) {
    assert.ok(programs.programs.some(program => program.id === id), `${id} must remain in the reviewed chronology`);
  }
  const ids = new Set(programs.programs.map(program => program.id));
  assert.equal(ids.size, programs.programs.length);
  assert.ok(programs.relationships.every(link => ids.has(link.source) && ids.has(link.target)));
  assert.ok(programs.entityReviews.length >= 10);
  assert.ok(programs.entityReviews.every(review => review.rationale && review.sources.length));
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /function validateProgramCatalog/);
  assert.match(source, /function renderPrograms/);
  assert.match(source, /program-bridge-layer/);
  assert.doesNotMatch(source, /MINI-NETWORK/);
});

test("Programs requires a reviewed disposition for every corpus candidate and dates every visible row", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.reviewedFixture = JSON.parse(fs.readFileSync("data/government_programs.json", "utf8"));
  context.catalogFixture = JSON.parse(fs.readFileSync("data/catalog.json", "utf8"));
  const result = JSON.parse(vm.runInContext(`JSON.stringify(programCatalogWithCorpus(reviewedFixture, catalogFixture))`, context));
  const corpusEntities = context.catalogFixture.entities.filter(entity => entity.category === "program");
  const reviewedEntityIds = new Set([
    ...context.reviewedFixture.programs.map(program => program.entityId).filter(Boolean),
    ...context.reviewedFixture.entityReviews.map(review => review.entityId)
  ]);

  assert.equal(result.corpusProgramCount, corpusEntities.length);
  assert.equal(result.reviewedEntityCount, corpusEntities.length);
  assert.equal(result.excludedEntityCount, context.reviewedFixture.entityReviews.length);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(validateProgramCatalog(reviewedFixture))`, context)), []);
  assert.ok(corpusEntities.every(entity => reviewedEntityIds.has(entity.id)));
  assert.ok(result.programs.every(program => program.startDate && program.startPrecision));
  assert.ok(result.programs.every(program => program.sources.length && program.provenance === "reviewed_interval"));
  const aawsap = result.programs.find(program => program.id === "aawsap");
  assert.ok(aawsap.entityIds.includes("ent-1401144ab3dc"));
  assert.ok(aawsap.entityIds.includes("ent-eb70172c69f0"));
  const condon = result.programs.find(program => program.id === "condon-committee");
  assert.ok(condon.entityIds.includes("ent-6146a98f813a"));
  context.resultFixture = result;
  vm.runInContext(`state.catalog = catalogFixture`, context);
  const expectedProgramDocumentCount = program => new Set(program.entityIds.flatMap(entityId => context.catalogFixture.entities.find(entity => entity.id === entityId)?.documentIds || [])).size;
  assert.equal(vm.runInContext(`programCorpusDocumentCount(resultFixture.programs.find(program => program.id === "aawsap"))`, context), expectedProgramDocumentCount(aawsap));
  assert.equal(vm.runInContext(`programCorpusDocumentCount(resultFixture.programs.find(program => program.id === "condon-committee"))`, context), expectedProgramDocumentCount(condon));
  assert.equal(result.reviewedProgramCount, 35);
  assert.equal(result.reviewedIntervalCount, 36);
  const incompleteFixture = structuredClone(context.reviewedFixture);
  incompleteFixture.entityReviews = incompleteFixture.entityReviews.filter(review => review.entityId !== "ent-9d0b3e246063");
  context.incompleteFixture = incompleteFixture;
  assert.throws(() => vm.runInContext(`programCatalogWithCorpus(incompleteFixture, catalogFixture)`, context), /corpus entities missing review decisions: Fastwalker/);
  assert.equal(vm.runInContext(`formatProgramDate("2017-12", "month")`, context), "2017-12");
  assert.equal(vm.runInContext(`formatProgramDate("1980", "decade")`, context), "1980s");
  assert.equal(vm.runInContext(`programTimeframeLabel(reviewedFixture.programs.find(program => program.id === "project-blue-book"), reviewedFixture.reviewedAt)`, context), "1952-03–1969-12-17");
  assert.equal(vm.runInContext(`programTimeframeLabel(reviewedFixture.programs.find(program => program.id === "project-grudge"), reviewedFixture.reviewedAt)`, context), "1949-02-11–1949-12-27; 1951-10-27–1952-03");
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(programLaneTimeframeSegments(reviewedFixture.programs.find(program => program.id === "project-grudge"), reviewedFixture.reviewedAt))`, context)), ["1949-02-11–12-27", "1951-10-27–1952-03"]);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(programLaneTimeframeSegments(reviewedFixture.programs.find(program => program.id === "defense-support-program"), reviewedFixture.reviewedAt, true))`, context)), ["1970–2026 · active"]);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(programLaneTimeframeSegments(reviewedFixture.programs.find(program => program.id === "project-moon-dust"), reviewedFixture.reviewedAt, true))`, context)), ["1957–1980s"]);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(programLaneTimeframeSegments(reviewedFixture.programs.find(program => program.id === "sentry-eagle"), reviewedFixture.reviewedAt))`, context)), ["2004–2004"]);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(programLaneTimeframeSegments(reviewedFixture.programs.find(program => program.id === "kona-blue"), reviewedFixture.reviewedAt))`, context)), ["2012–2012-02-10"]);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify(programIntervals(reviewedFixture.programs.find(program => program.id === "project-grudge")).map(item => [item.startDate, item.endDate]))`, context)), [["1949-02-11", "1949-12-27"], ["1951-10-27", "1952-03"]]);

  const impossibleFixture = structuredClone(context.reviewedFixture);
  impossibleFixture.programs[0].startDate = "2026-99-99";
  impossibleFixture.programs[0].startPrecision = "day";
  context.impossibleFixture = impossibleFixture;
  assert.match(JSON.parse(vm.runInContext(`JSON.stringify(validateProgramCatalog(impossibleFixture))`, context)).join("; "), /invalid start date or precision/);
  const nonLeapFixture = structuredClone(context.reviewedFixture);
  nonLeapFixture.programs[0].startDate = "2025-02-29";
  nonLeapFixture.programs[0].startPrecision = "day";
  context.nonLeapFixture = nonLeapFixture;
  assert.match(JSON.parse(vm.runInContext(`JSON.stringify(validateProgramCatalog(nonLeapFixture))`, context)).join("; "), /invalid start date or precision/);
  const leapFixture = structuredClone(context.reviewedFixture);
  leapFixture.programs[0].startDate = "2024-02-29";
  leapFixture.programs[0].startPrecision = "day";
  context.leapFixture = leapFixture;
  assert.doesNotMatch(JSON.parse(vm.runInContext(`JSON.stringify(validateProgramCatalog(leapFixture))`, context)).join("; "), /invalid start date or precision/);
});

test("Programs PDF properties describe corpus coverage and active filters", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const properties = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.config = { ...DEFAULT, type: "programs", programStatus: "official", programKind: "project", programSearch: "AATIP" };
    state.programCatalog = { corpusProgramCount: 30, reviewedEntityCount: 30, excludedEntityCount: 11, reviewedProgramCount: 23, reviewedIntervalCount: 24 };
    return Object.fromEntries(pdfGraphProperties());
  })())`, context));

  assert.equal(properties["Corpus review coverage"], "30 / 30 candidates");
  assert.equal(properties["Excluded or merged"], "11 reviewed decisions");
  assert.equal(properties["Reviewed intervals"], "24 records");
  assert.equal(properties["Evidence status"], "Official");
  assert.equal(properties["Program type"], "Project");
  assert.equal(properties["Program search"], "AATIP");
  assert.equal(properties.Collections, undefined);
  assert.equal(properties["Maximum marks"], undefined);
  assert.equal(properties["Entity categories"], undefined);
});

test("Programs PDF uses readable paginated inventory rows", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.config = { ...DEFAULT, type: "programs" };
    state.programCatalog = {
      reviewedAt: "2026-08-24",
      reviewedProgramCount: 30, reviewedIntervalCount: 30, reviewedEntityCount: 30, corpusProgramCount: 30,
      method: "Every displayed interval is reviewed.",
      programs: Array.from({ length: 30 }, (_, index) => ({
        id: "program-" + index, entityId: "entity-" + index, name: "Program " + index,
        agency: "Reviewed agency", summary: "Reviewed program", kind: "program",
        evidenceStatus: "official", startDate: String(1940 + index), endDate: String(1940 + index), startPrecision: "year", endPrecision: "year", sources: [{ title: "Source", url: "https://example.com" }]
      }))
    };
    state.catalog = { entities: state.programCatalog.programs.map((program, index) => ({ id: program.entityId, documentCount: index + 1 })) };
    pdfExportTitle = () => "Government Programs With A Moderately Long Custom Research Title";
    pdfProvenance = () => [["CATALOG GENERATED", "2026-08-25"], ["SOURCE OF TRUTH", "ufo-files/machine-data"], ["SOURCE REVISION", "abc123"], ["EXPORTED", "2026-08-25"]];
    let pages = 0, fontSize = 0;
    const rowFontSizes = [], text = [], calls = [];
    const pdf = {
      internal: { pageSize: { getWidth: () => 612, getHeight: () => 792 } },
      addPage() { pages += 1; }, setFillColor() {}, rect() {}, setDrawColor() {}, setLineWidth() {}, line() {},
      setFont() {}, setFontSize(size) { fontSize = size; }, setTextColor() {},
      getTextWidth(value) { return String(value).length * fontSize * .6; },
      text(value, x, y) { text.push(String(value)); calls.push({ value: String(value), x, y, fontSize }); if (/^Program \\d+$/.test(String(value))) rowFontSizes.push(fontSize); }
    };
    addPDFProgramPages(pdf, new Date("2026-08-25T00:00:00Z"));
    return { pages, rowFontSizes, text, calls };
  })())`, context));

  assert.equal(result.pages, 3);
  assert.equal(result.rowFontSizes.length, 30);
  assert.ok(result.rowFontSizes.every(size => size === 9));
  assert.ok(result.text.some(value => /page 3 \/ 3/.test(value)));
  assert.ok(result.text.some(value => /is not congressional substantiation or agency confirmation/i.test(value)));
  assert.equal(result.calls.find(call => call.fontSize === 18).y, 76);
  assert.equal(result.calls.find(call => /catalog coverage/.test(call.value)).y, 94);
});

test("Programs stays scrollable on dense mobile layouts and data-only edits trigger CI", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  const workflow = fs.readFileSync(".github/workflows/rebuild-graph.yml", "utf8");

  assert.match(source, /const contentHeight = Math\.max\(height, chartTop \+ programs\.length \* rowHeight \+ 28\)/);
  assert.doesNotMatch(source, /INTERVAL NOT REVIEWED|corpus_mention/);
  assert.match(source, /chartWrap\.scrollTop = scrollTop; chartWrap\.scrollLeft = scrollLeft/);
  assert.match(source, /truncatedProgramLabel\(program\.name, labelWidth, state\.config\.labelSize\)/);
  assert.match(styles, /\.chart-wrap\.programs-mode \{ overflow: auto;/);
  assert.equal(workflow.match(/data\/government_programs\.json/g)?.length, 2);

  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  vm.runInContext(source.split("$$('.step-heading')")[0], context);
  const labels = JSON.parse(vm.runInContext(`JSON.stringify({ small: truncatedProgramLabel("Advanced Aerospace Threat Identification Program", 190, 12), large: truncatedProgramLabel("Advanced Aerospace Threat Identification Program", 190, 18) })`, context));
  assert.ok(labels.large.length < labels.small.length);
});

test("graph subtitle tracks the current source document count", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);

  assert.equal(vm.runInContext("graphDocumentCountSubtitle({ counts: { documents: 7659 } })", context), "7,659 source documents");
  assert.equal(vm.runInContext("graphDocumentCountSubtitle({ documents: [{}] })", context), "1 source document");
});

test("Bledsoe light beings use a dedicated luminous lineup asset", () => {
const source = fs.readFileSync("app.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  const asset = fs.readFileSync("assets/species/vector/species-light-beings.svg", "utf8");
  assert.match(source, /\["orb_light_beings", "species-light-beings\.svg"\]/);
  assert.ok(fs.existsSync("assets/species/source/species-light-beings.png"));
  assert.ok(fs.existsSync("assets/species/vector/species-light-beings.svg"));
  assert.ok(fs.existsSync("assets/species/silhouette/species-light-beings.svg"));
  assert.match(asset, /id="full-body-luminosity"/);
  assert.match(asset, /continuous whole-body emission outline/i);
  assert.match(asset, /Created by potrace/);
  assert.doesNotMatch(asset, /<(?:circle|ellipse)\b/);
  assert.match(source, /speciesClass\.classId === "orb_light_beings" \? " is-translucent" : ""/);
  assert.match(styles, /\.species-lineup-figure-background\.is-translucent\s*\{\s*opacity:\s*\.675;/);
});

test("lineup includes the reported Bledsoe red-eyed being and disputed Skinny Bob reference", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const taxonomy = JSON.parse(fs.readFileSync("data/species_taxonomy.json", "utf8"));
  const bledsoeAsset = fs.readFileSync("assets/species/vector/species-bledsoe-red-eyed-being-v3.svg", "utf8");
  const skinnyBobAsset = fs.readFileSync("assets/species/vector/species-skinny-bob-v5.svg", "utf8");

  assert.match(source, /\["bledsoe_red_eyed_being", "species-bledsoe-red-eyed-being-v3\.svg"\]/);
  assert.match(source, /\["skinny_bob", "species-skinny-bob-v5\.svg"\]/);
  assert.match(source, /reference profile, not a corpus observation/);
  assert.match(source, /authenticity remain unresolved/);
  assert.match(source, /representativeFeet: 3\.5, label: "reported 3′6″"/);
  assert.match(source, /SPECIES_LINEUP_NO_BACKGROUND = new Set\(\["bledsoe_red_eyed_being", "skinny_bob"\]\)/);
  assert.ok(taxonomy.classes.some(item => item.id === "bledsoe_red_eyed_being" && item.groundingType === "reference"));
  assert.ok(taxonomy.classes.some(item => item.id === "skinny_bob" && item.groundingType === "corpus"));
  assert.match(bledsoeAsset, /id="bledsoe-red-eyes"/);
  assert.match(bledsoeAsset, /fill="#c3262d"/);
  assert.match(bledsoeAsset, /lower-face covering/i);
  assert.match(skinnyBobAsset, /id="skinny-bob-figure"/);
  assert.match(skinnyBobAsset, /authenticity remains unresolved/i);
  for (const [name, version] of [["bledsoe-red-eyed-being", "v3"], ["skinny-bob", "v5"]]) {
    assert.ok(fs.existsSync(`assets/species/source/species-${name}.png`));
    assert.ok(fs.existsSync(`assets/species/vector/species-${name}-${version}.svg`));
    assert.ok(fs.existsSync(`assets/species/silhouette/species-${name}-${version}.svg`));
  }
});

test("Men in Black figure uses the reported formal black attire", () => {
  const asset = fs.readFileSync("assets/species/vector/species-men-in-black.svg", "utf8");
  const display = fs.readFileSync("assets/species/vector/display/species-men-in-black.svg", "utf8");
  for (const drawing of [asset, display]) {
    assert.match(drawing, /id="men-in-black-suit"/);
    assert.match(drawing, /fill="#242424"/);
    assert.match(drawing, /formal near-black suit, black tie, black hat, and black shoes/i);
    assert.match(drawing, /id="men-in-black-ink"/);
  }
});

test("reference-only species figures are not described as corpus-backed", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /const hasCorpusSupport = descriptors\.some/);
  assert.match(source, /const allowsReferenceFigure = Boolean\(speciesClass\.illustrationDescriptors\?\.length && SPECIES_LINEUP_ASSETS\.has\(speciesClass\.classId\)\)/);
  assert.match(source, /The bespoke lineup figure is a reference-grounded interpretation based on the reviewed profile summary, not corpus appearance evidence/);
  assert.match(source, /No qualifying physical-description excerpt was found in the audited corpus context/);
});

test("Mothman figure reflects the reported tall winged, prominent-eye profile", () => {
  const asset = fs.readFileSync("assets/species/vector/species-mothman.svg", "utf8");
  const display = fs.readFileSync("assets/species/vector/display/species-mothman.svg", "utf8");
  assert.ok(fs.existsSync("assets/species/source/species-mothman.png"));
  assert.match(asset, /small round head/i);
  assert.match(asset, /prominent red eyes/i);
  assert.match(asset, /broad articulated wings folded behind/i);
  assert.match(asset, /id="mothman-charcoal"/);
  assert.match(asset, /id="mothman-ink"/);
  assert.match(asset, /id="mothman-red-eyes"/);
  assert.match(asset, /fill="#666666"/);
  assert.match(asset, /fill="#c3262d"/);
  assert.match(asset, /Created by potrace/);
  assert.doesNotMatch(asset, /<image\b|data:image\//);
  assert.equal(display, asset);
});

test("Mantis figure traces the approved evidence-grounded raster", () => {
  const asset = fs.readFileSync("assets/species/vector/species-mantis-beings.svg", "utf8");
  const display = fs.readFileSync("assets/species/vector/display/species-mantis-beings.svg", "utf8");
  assert.ok(fs.existsSync("assets/species/source/species-mantis-beings.png"));
  assert.match(asset, /broad rounded triangular head/i);
  assert.match(asset, /id="mantis-figure"/);
  assert.match(asset, /three-pronged extremities/i);
  assert.match(asset, /Created by potrace/);
  assert.doesNotMatch(asset, /antenna/i);
  assert.equal(display, asset);
});

test("Reptilians artwork crops its lower transparent margin at the lineup baseline", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  assert.equal(vm.runInContext('SPECIES_LINEUP_INK_BOUNDS.get("rigelians").bottom', context), 1480);
});

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

test("all view legend and metadata live beside fullscreen in the stage toolbar", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const infoRule = styles.match(/(?:^|\n)\.chart-info \{([^}]+)\}/)?.[1] || "";
  const legendRule = styles.match(/\.legend \{([^}]+)\}/)?.[1] || "";

  assert.match(infoRule, /position:\s*relative/);
  assert.match(html, /id="exportButton"[\s\S]*<details class="chart-info" id="chartInfo">[\s\S]*<\/details>\s*<button class="icon-button fullscreen-button"/);
  assert.match(html, /<div class="chart-info-panel">[\s\S]*<div class="legend" id="legend"><\/div>[\s\S]*<footer class="stage-footer">[\s\S]*id="resultSummary"[\s\S]*id="policySummary"/);
  assert.match(html, /id="graphKicker">Timeline<[\s\S]*id="graphTitle"[^>]*>Event Sequence</);
  assert.doesNotMatch(html, /<\/div>\s*<div class="legend" id="legend"><\/div>\s*<footer class="stage-footer">/);
  assert.match(legendRule, /justify-content:\s*flex-start/);
});

test("chart bottom gutter matches its responsive side gutters", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.chart-wrap \{[^}]*margin: 0 20px 20px/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*\.chart-wrap \{ margin: 0 10px 10px;/);
  assert.match(styles, /body\.graph-fullscreen \.chart-wrap \{ margin: 0;/);
});

test("chart information panel anchors to fullscreen at narrow mobile widths", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.chart-info-panel \{[^}]*right: -41px;/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*\.chart-info-panel \{ right: -49px; width: min\(320px, calc\(100vw - 48px\)\);/);
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

test("scatter rings stay monochrome while coverage labels and legend keys align", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(source, /stroke: "#111"[^\n]+class: "derivative-ring"/);
  assert.match(styles, /\.legend-item i\.derivative-key \{[^}]*border: 2px solid #111/);
  assert.match(styles, /\.coverage-table tbody th \{[^}]*vertical-align: middle/);
  assert.match(styles, /\.coverage-key \{[^}]*display: inline-flex;[^}]*align-items: center;[^}]*padding-left: 19px/);
  assert.match(styles, /\.coverage-key::before \{[^}]*top: 50%;[^}]*transform: translateY\(-50%\)/);
  assert.doesNotMatch(source, /stroke: "#9b5b20"[^\n]+class: "derivative-ring"/);
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

test("chart coordinates match a narrow mobile canvas without SVG letterboxing", () => {
  const chart = new FakeElement();
  chart.getBoundingClientRect = () => ({ width: 371, height: 613.375 });
  const document = { querySelector: selector => selector === "#chart" ? chart : null, querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);

  assert.deepEqual(
    JSON.parse(vm.runInContext("JSON.stringify(dimensions())", context)),
    { width: 371, height: 613.375 }
  );

  chart.getBoundingClientRect = () => ({ width: 0, height: 0 });
  assert.deepEqual(
    JSON.parse(vm.runInContext("JSON.stringify(dimensions())", context)),
    { width: 460, height: 420 }
  );
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
  assert.match(html, /id="exportButton"[\s\S]*?<\/button>\s*<details class="chart-info" id="chartInfo">[\s\S]*?<\/details>\s*<button class="icon-button fullscreen-button" id="fullScreenButton"/);
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

test("default graph is the month-grouped event timeline while Scatter retains global prominence defaults", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));
  const scatter = JSON.parse(vm.runInContext('JSON.stringify(presetConfig("default", "scatter"))', context));

  assert.equal(config.type, "timeline");
  assert.deepEqual(config.categories, ["date"]);
  assert.equal(config.x, "startDate");
  assert.equal(config.y, "mentionRank");
  assert.equal(config.size, "eventCount");
  assert.equal(config.timelineGrouping, true);
  assert.equal(config.timelineGroupPeriod, "month");
  assert.equal(config.timelineCorrelativeMarkers, true);
  assert.equal(config.timelineHistoricalCandidates, false);
  assert.equal(config.timelineRelevanceCutoff, 250);
  assert.equal(config.timelineRecencyYear, 2000);
  assert.equal(config.limit, 500);
  assert.deepEqual(scatter.categories, [
    "person", "government_agency", "organization", "location", "program", "subject", "book", "date"
  ]);
  assert.equal(config.configVersion, 3);
  assert.equal(scatter.x, "independentDocumentCount");
  assert.equal(scatter.y, "epistemicAdjustedMentions");
  assert.equal(scatter.size, "independentDocumentCount");
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

test("app typography never renders below 10px", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  const undersizedRules = [...styles.matchAll(/font-size:\s*([\d.]+)px/g)]
    .map(match => Number(match[1]))
    .filter(size => size < 10);
  assert.deepEqual(undersizedRules, []);
  assert.match(styles, /\.stage-header p:last-child \{[^}]*font-size: 12px;/);
  assert.match(styles, /\.triage-component strong \{ margin-bottom: 0\.325rem; \}/);

  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /config\.labelSize = Math\.max\(10,/);
  assert.match(source, /const labelSize = Math\.max\(10, state\.config\.labelSize \/ zoom\);/);
  assert.match(source, /while \(labelSize >= 10\)/);
  assert.match(source, /const authorSize = Math\.max\(10, labelSize \* \.72\);/);
});

test("screenshots require the bundled IBM Plex Mono faces", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  const script = fs.readFileSync("scripts/capture_graph_screenshots.mjs", "utf8");
  assert.match(styles, /@font-face \{[\s\S]*?font-family: "IBM Plex Mono";[\s\S]*?IBMPlexMono-Regular\.ttf[\s\S]*?font-weight: 400;/);
  assert.match(styles, /@font-face \{[\s\S]*?font-family: "IBM Plex Mono";[\s\S]*?IBMPlexMono-Bold\.ttf[\s\S]*?font-weight: 700;/);
  assert.match(styles, /--font: "IBM Plex Mono", "SF Mono"/);
  assert.match(script, /document\.fonts\.load\('400 14px "IBM Plex Mono"'/);
  assert.match(script, /document\.fonts\.load\('700 14px "IBM Plex Mono"'/);
  assert.match(script, /plexFaces\.some\(face => face\.status !== "loaded"\)/);
});

test("astronomical view owns its controls, lifecycle, export metadata, and generated screenshot", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const model = fs.readFileSync("solar-system.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const screenshots = fs.readFileSync("scripts/capture_graph_screenshots.mjs", "utf8");

  assert.match(source, /type === "solar"[\s\S]*Astronomical data boundary/);
  assert.match(source, /function prepareMapView\(\) \{[\s\S]*ufo-solar-visibility/);
  assert.match(source, /function renderSolar\(\) \{[\s\S]*ufo-map-visibility[\s\S]*Gaia star/);
  assert.match(source, /config\.type === "solar"[\s\S]*11,639 high-confidence Gaia DR3 stars within 1,000 light-years/);
  assert.match(source, /setFillColor\(246, 245, 239\); pdf\.rect\(x - 2, y - 2/);
  assert.match(model, /this\.pointers = new Map\(\)/);
  assert.match(model, /pointercancel/);
  assert.match(model, /this\.pinchDistance\/next/);
  assert.match(model, /textures\.forEach\(texture=>texture\.dispose\(\)\)/);
  assert.match(model, /materials\.forEach\(material=>material\.dispose\(\)\)/);
  assert.match(model, /geometries\.forEach\(geometry=>geometry\.dispose\(\)\)/);
  assert.match(html, /event\.target\?\.id === "solarModule"[\s\S]*Astronomical model failed to load/);
  assert.match(screenshots, /id === "solar"[\s\S]*window\.ufoSolar\?\.isReady\(\)/);
  assert.doesNotMatch(screenshots, /solarStatus/);
  assert.match(model, /this\.spiralReady=true;status\.textContent="Milky Way ready"/);
  assert.match(model, /this\.skyReady=true;status\.textContent="Gaia sky ready"/);
  assert.match(model, /isReady\(\)\{if\(this\.mode==="galaxy"\)return this\.spiralReady;if\(this\.mode==="sky"\)return this\.skyReady;return this\.gaiaReady&&\(!this\.hillFishActive\(\)\|\|this\.caseReady\);\}/);
});

test("Pages deployment includes every first-class JavaScript view module", () => {
  const workflow = fs.readFileSync(".github/workflows/deploy-pages.yml", "utf8");
  assert.match(workflow, /cp index\.html app\.js map-globe\.js solar-system\.js styles\.css \.nojekyll _site\//);
});

test("stage actions do not wrap or compress the fullscreen square", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.stage-tools \{[^}]*flex: 0 0 auto;/);
  assert.match(styles, /\.stage-tools \.button \{[^}]*white-space: nowrap;/);
  assert.match(styles, /\.fullscreen-button \{[^}]*flex: 0 0 34px;[^}]*width: 34px;[^}]*height: 34px;/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.fullscreen-button \{[^}]*flex-basis: 42px;[^}]*width: 42px;/);
});

test("claim comparison is conservative about repetition, negation, qualification, time, and ambiguity", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const comparisons = JSON.parse(vm.runInContext(`
    (() => {
      const base = { id: "a", subject: "AARO", predicate: "published", object: "a report", scope: { time: "2024-03-06", location: "United States" }, modality: "asserted", polarity: "positive" };
      return JSON.stringify({
        repetition: compareClaimPropositions(base, { ...base, id: "b" }),
        negation: compareClaimPropositions(base, { ...base, id: "b", polarity: "negative" }),
        qualification: compareClaimPropositions(base, { ...base, id: "b", modality: "reported" }),
        temporal: compareClaimPropositions(base, { ...base, id: "b", polarity: "negative", scope: { ...base.scope, time: "2025-03-06" } }),
        ambiguous: compareClaimPropositions(base, { ...base, id: "b", object: "a website" }),
        candidate: candidateClaimRelationship(base, { ...base, id: "b", polarity: "negative" })
      });
    })()
  `, context));

  assert.equal(comparisons.repetition.type, "repeats");
  assert.equal(comparisons.negation.type, "contradicts");
  assert.equal(comparisons.qualification.type, "qualifies");
  assert.equal(comparisons.temporal.type, "unclear");
  assert.match(comparisons.temporal.reason, /time scope differs/);
  assert.equal(comparisons.ambiguous.type, "unclear");
  assert.equal(comparisons.candidate.review.status, "candidate");
  assert.equal(comparisons.candidate.method.type, "automated_candidate");
});

test("published claim schema requires exact evidence and extraction and review methods", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const claims = JSON.parse(fs.readFileSync("data/claims.json", "utf8"));
  const catalog = loadCatalogFixture();
  context.claimFixture = claims;
  context.documentFixture = catalog.documents.map(document => ({ id: document.id }));
  const errors = JSON.parse(vm.runInContext("JSON.stringify(validateClaimCatalog(claimFixture, documentFixture))", context));

  assert.deepEqual(errors, []);
  assert.ok(claims.claims.every(claim => claim.evidence.documentId && claim.evidence.excerpt && claim.extraction.method && claim.review.method));
  assert.ok(claims.claims.every(claim => /^[0-9a-f]{40}$/.test(claim.evidence.sourceBlobSha)));
  assert.ok(claims.claims.every(claim => Number.isFinite(claim.claimConfidence) && claim.sourceFamily.id));
  assert.ok(claims.relationships.every(relationship => relationship.rationale && relationship.review.method));
  assert.ok(claims.relationships.some(relationship => relationship.type === "contradicts"));
  assert.ok(claims.relationships.some(relationship => relationship.type === "unclear"));
  const officerClaims = claims.claims.filter(claim => claim.lineageId === "officer-craft-account");
  assert.equal(officerClaims.length, 2);
  assert.equal(new Set(officerClaims.map(claim => claim.evidence.documentId)).size, 1, "claim and document counts must remain distinct");
  const aaroClaims = claims.claims.filter(claim => claim.lineageId === "aaro-established");
  assert.equal(new Set(aaroClaims.map(claim => claim.sourceFamily.id)).size, 2, "independent report families remain explicit");
  assert.equal(Object.hasOwn(claims, "confidence"), false, "the catalog must not publish one combined confidence score");
});

test("device compromise testimony stays an anomaly until the evidence supports a stronger class", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.genericTestimony = "Every time we visit the ranch, our phones get hacked.";
  context.specificTestimony = "The phone typed a message without my input.";
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    generic: classifyDeviceCompromiseTestimony(genericTestimony, { speakerDomains: ["biology"] }),
    specific: classifyDeviceCompromiseTestimony(specificTestimony, { speakerDomains: ["biology"] }),
    forensic: classifyDeviceCompromiseTestimony(genericTestimony, {
      speakerDomains: ["digital_forensics"],
      independentlyVerifiedTechnicalEvidence: true
    })
  })`, context));

  assert.equal(result.generic.observationClass, "device_anomaly");
  assert.equal(result.generic.speakerAttribution, "device_compromise");
  assert.equal(result.generic.attributionStatus, "unverified");
  assert.equal(result.generic.domainRelevance, "domain_not_established");
  assert.equal(result.specific.observationClass, "possible_intentional_control");
  assert.equal(result.specific.attributionStatus, "specific_behavior_reported");
  assert.equal(result.forensic.observationClass, "verified_device_compromise");
  assert.equal(result.forensic.domainRelevance, "relevant_domain");
});

test("claim filters combine entity, date, collection, relationship, and review status", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const claims = JSON.parse(fs.readFileSync("data/claims.json", "utf8"));
  const catalog = loadCatalogFixture();
  const documents = catalog.documents.filter(document => claims.claims.some(claim => claim.evidence.documentId === document.id));
  context.claimFixture = claims;
  context.documentFixture = documents;
  const result = JSON.parse(vm.runInContext(`
    (() => {
      state.claimCatalog = claimFixture;
      state.catalog = { counts: { documents: documentFixture.length }, documents: documentFixture };
      documentFixture.forEach(document => state.documentById.set(document.id, document));
      Object.assign(state.config, {
        type: "claims", allSources: false, sources: ["National-Archives-UAP-Bulk"],
        claimEntity: "named-military-officer", claimDateStart: "2024-01-01", claimDateEnd: "2024-12-31",
        claimRelation: "contradicts", claimReviewStatus: "published"
      });
      const filtered = filteredClaimData();
      return JSON.stringify({ claims: filtered.claims.map(claim => claim.id), relationships: filtered.relationships.map(relationship => relationship.type) });
    })()
  `, context));

  assert.deepEqual(result.claims, ["claim-officer-denied-touching-craft", "claim-officer-touched-craft"]);
  assert.deepEqual(result.relationships, ["contradicts"]);
});

test("claim relationship review status does not hide published endpoint claims", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const claims = JSON.parse(fs.readFileSync("data/claims.json", "utf8"));
  const catalog = loadCatalogFixture();
  const endpointClaims = claims.claims.slice(0, 2);
  const claimsWithUnrelated = [...endpointClaims, claims.claims[2]];
  const documents = catalog.documents.filter(document => claimsWithUnrelated.some(claim => claim.evidence.documentId === document.id));
  context.claimFixture = { ...claims, claims: claimsWithUnrelated, relationships: [] };
  context.documentFixture = documents;
  const result = JSON.parse(vm.runInContext(`
    (() => {
      claimFixture.relationships = [candidateClaimRelationship(claimFixture.claims[0], claimFixture.claims[1])];
      state.claimCatalog = claimFixture;
      state.catalog = { documents: documentFixture };
      documentFixture.forEach(document => state.documentById.set(document.id, document));
      Object.assign(state.config, {
        type: "claims", allSources: true, sources: [], claimEntity: "all", claimDateStart: "", claimDateEnd: "",
        claimRelation: "all", claimReviewStatus: "candidate"
      });
      const filtered = filteredClaimData();
      return JSON.stringify({
        claimStatuses: filtered.claims.map(claim => claim.review.status),
        relationshipStatuses: filtered.relationships.map(relationship => relationship.review.status)
      });
    })()
  `, context));

  assert.deepEqual(result.claimStatuses, ["published", "published"]);
  assert.deepEqual(result.relationshipStatuses, ["candidate"]);
});

test("claim first-appearance markers are based on the unfiltered lineage", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.claimFixture = JSON.parse(fs.readFileSync("data/claims.json", "utf8"));
  const catalog = loadCatalogFixture();
  context.documentFixture = catalog.documents.filter(document => context.claimFixture.claims.some(claim => claim.evidence.documentId === document.id));
  const result = JSON.parse(vm.runInContext(`
    (() => {
      state.claimCatalog = claimFixture;
      documentFixture.forEach(document => state.documentById.set(document.id, document));
      Object.assign(state.config, {
        allSources: true, sources: [], claimEntity: "all", claimDateStart: "2024-01-01", claimDateEnd: "",
        claimRelation: "all", claimReviewStatus: "all"
      });
      return JSON.stringify({
        visibleAaroClaims: filteredClaimData().claims.filter(claim => claim.lineageId === "aaro-established").map(claim => claim.id),
        firstIds: Object.fromEntries(firstClaimIdsByLineage())
      });
    })()
  `, context));

  assert.deepEqual(result.visibleAaroClaims, ["claim-aaro-established-dodig-2024"]);
  assert.equal(result.firstIds["aaro-established"], "claim-aaro-established-2022-report");
  assert.notEqual(result.firstIds["aaro-established"], result.visibleAaroClaims[0]);
});

test("saved claim views and PDFs retain claim policy and active filters", () => {
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
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.claimFixture = JSON.parse(fs.readFileSync("data/claims.json", "utf8"));
  const result = JSON.parse(vm.runInContext(`
    (() => {
      state.claimCatalog = claimFixture;
      state.catalog = { generatedAt: "2026-08-08T00:00:00Z", input: {}, counts: { documents: 1 } };
      Object.assign(state.config, {
        type: "claims", claimEntity: "ent-3d2a2ae3c142", claimDateStart: "2023-01-01", claimDateEnd: "2024-12-31",
        claimRelation: "unclear", claimReviewStatus: "published", allSources: false, sources: ["National-Archives-UAP-Bulk"]
      });
      persistHash();
      const encoded = new URLSearchParams(location.hash.slice(1)).get("config");
      const saved = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      return JSON.stringify({ saved, properties: pdfGraphProperties() });
    })()
  `, context));

  assert.equal(result.saved.claimPolicyVersion, "ufo-files-claim-policy/v2");
  assert.equal(result.saved.claimEntity, "ent-3d2a2ae3c142");
  assert.equal(result.saved.claimDateStart, "2023-01-01");
  assert.equal(result.saved.claimRelation, "unclear");
  assert.ok(result.properties.some(([name, value]) => name === "Claim policy" && /ufo-files-claim-policy\/v2/.test(value)));
  assert.ok(result.properties.some(([name, value]) => name === "Appearance dates" && /2023-01-01/.test(value)));
  assert.ok(result.properties.some(([name, value]) => name === "Collections" && /National-Archives-UAP-Bulk/.test(value)));
});

test("saved Galactic Entities URLs retain the selected scale across refreshes", () => {
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  const location = { hash: "" };
  const context = vm.createContext({
    location,
    history: { replaceState(_state, _title, hash) { location.hash = hash; } },
    URLSearchParams,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary"),
    escape, unescape, encodeURIComponent, decodeURIComponent
  });
  vm.runInContext(source, context);
  vm.runInContext(`
    state.config = presetConfig("default", "solar");
    state.config.solarScale = "galaxy";
    state.config.solarCase = "hill_fish";
    persistHash();
  `, context);

  const encoded = new URLSearchParams(location.hash.slice(1)).get("config");
  const saved = JSON.parse(decodeURIComponent(escape(Buffer.from(encoded, "base64").toString("binary"))));
  assert.equal(saved.solarScale, "galaxy");
  assert.equal(saved.solarCase, "hill_fish");

  const restoredContext = vm.createContext({
    location: { hash: location.hash }, URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"),
    escape, decodeURIComponent
  });
  vm.runInContext(source, restoredContext);
  assert.equal(vm.runInContext("state.config.solarScale", restoredContext), "galaxy");
  assert.equal(vm.runInContext("state.config.solarCase", restoredContext), "hill_fish");
});

test("Galactic Entities PDF properties retain complete corpus target accounting", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.catalogFixture = loadCatalogFixture();
  const properties = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.catalog = catalogFixture;
    state.config = { ...DEFAULT, ...VIEW_DEFAULTS.solar, type: "solar", solarScale: "galaxy" };
    return Object.fromEntries(pdfGraphProperties());
  })())`, context));

  assert.equal(properties["Corpus target accounting"], `${context.catalogFixture.astronomy.targets.length} / ${context.catalogFixture.astronomy.targets.length} direct-mention targets`);
  assert.match(properties["Solar System at the Sun · 20"], /Moon [\d,]+ mentions \/ [\d,]+ documents/);
  assert.match(properties["Fixed ICRS points · 13"], /Sirius [\d,]+ mentions \/ [\d,]+ documents/);
  assert.ok(Object.hasOwn(properties, "No reviewed point position · 4"));
});

test("saved URLs and PDF properties retain the selected corroboration metric and conservative policy", () => {
  const location = { hash: "" };
  const context = vm.createContext({
    location,
    history: { replaceState(_state, _title, hash) { location.hash = hash; } },
    URLSearchParams,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary"),
    escape, unescape, encodeURIComponent, decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      state.catalog = { input: {}, generatedAt: null };
      Object.assign(state.config, { size: "independentSourceFamilyCount", corroborationMetric: "independentSourceFamilyCount", sourceFamilyPolicy: SOURCE_FAMILY_POLICY_VERSION });
      persistHash();
      const encoded = new URLSearchParams(location.hash.slice(1)).get("config");
      return JSON.stringify({ saved: JSON.parse(decodeURIComponent(escape(atob(encoded)))), properties: Object.fromEntries(pdfGraphProperties()) });
    })()
  `, context));

  assert.equal(result.saved.corroborationMetric, "independentSourceFamilyCount");
  assert.equal(result.saved.sourceFamilyPolicy, "ufo-files-source-family-policy/v1");
  assert.equal(result.properties["Size + shade"], "Independent source families");
  assert.equal(result.properties["Corroboration metric"], "Independent source families");
  assert.equal(result.properties["Source-family policy"], "ufo-files-source-family-policy/v1");
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

  assert.deepEqual(result.scatter, { type: "scatter", x: "independentDocumentCount", y: "epistemicAdjustedMentions", size: "independentDocumentCount", configVersion: 3 });
  assert.equal(result.network.size, "epistemicAdjustedMentions");
  assert.equal(result.collectionNetwork.size, "documents");
  assert.equal(result.bars.y, "epistemicAdjustedMentions");
  assert.equal(result.timeline.y, "epistemicAdjustedMentions");
  assert.equal(result.timeline.size, "independentDocumentCount");
  assert.equal(result.map.size, "epistemicAdjustedMentions");
  assert.equal(result.book.size, "epistemicAdjustedMentions");
  assert.equal(result.table.tableSort, "mentions");
});

test("versioned saved views preserve an explicit raw-metric choice", () => {
  const saved = {
    configVersion: 3, type: "scatter", x: "entity", y: "mentions", size: "documentCount",
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

test("saved Solar URLs without a scale preserve the former local default", () => {
  const saved = { configVersion: 3, type: "solar", titleMode: "auto" };
  const encoded = Buffer.from(JSON.stringify(saved), "utf8").toString("base64");
  const context = vm.createContext({
    location: { hash: `#config=${encodeURIComponent(encoded)}` }, URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"), escape, decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.equal(config.solarScale, "local");
  assert.equal(config.title, "Galactic Entities");
});

test("shared Craft URLs restore the automatic Craft title when title is omitted", () => {
  const saved = { configVersion: 2, type: "craft", craftSize: "documentCount", craftColor: "confidence" };
  const encoded = Buffer.from(JSON.stringify(saved), "utf8").toString("base64");
  const context = vm.createContext({
    location: { hash: `#config=${encodeURIComponent(encoded)}` }, URLSearchParams,
    atob: value => Buffer.from(value, "base64").toString("binary"), escape, decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const config = JSON.parse(vm.runInContext("JSON.stringify(state.config)", context));

  assert.equal(config.type, "craft");
  assert.equal(config.titleMode, "auto");
  assert.equal(config.title, "Reported Craft Shapes");
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

  assert.equal(config.configVersion, 3);
  assert.equal(config.y, "epistemicAdjustedMentions");
  assert.equal(config.size, "independentDocumentCount");
});

test("Default preset restores the complete initial view", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    initial: state.config,
    preset: presetConfig("default"),
    defaults: DEFAULT,
    activeId: activePresetId()
  })`, context));

  assert.deepEqual(result.initial, result.preset);
  assert.equal(result.activeId, "default");
  assert.equal(result.initial.type, "timeline");
  assert.equal(result.initial.x, "startDate");
  assert.equal(result.initial.y, "mentionRank");
  assert.equal(result.initial.size, "eventCount");
  assert.equal(result.initial.timelineGroupPeriod, "month");
  assert.equal(result.initial.timelineCorrelativeMarkers, true);
  assert.equal(result.defaults.x, "independentDocumentCount");
  assert.equal(result.preset.y, "mentionRank");
  assert.equal(result.defaults.matrixColumns, "category");
  assert.equal(result.defaults.matrixNormalize, "raw");
  assert.equal(result.defaults.coverageRows, "collection");
  assert.equal(result.defaults.coverageColumns, "category");
});

test("Matrix defaults to within-collection cell intensity", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);

  assert.equal(vm.runInContext('presetConfig("default", "matrix").matrixNormalize', context), "rowShare");
});

test("coverage table header stays flush beneath the variable-height sticky caption", () => {
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.coverage-warning \{[^}]*position: sticky;[^}]*top: 0;[^}]*z-index: 5/);
  assert.match(styles, /\.coverage-table thead th \{[^}]*position: sticky;[^}]*top: var\(--coverage-caption-height, 0px\);[^}]*z-index: 3/);
  assert.doesNotMatch(styles, /\.coverage-table thead th \{[^}]*top: 49px/);
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
  assert.match(source, /timeline: \{[^}]*timelineGrouping: true[^}]*timelineGroupPeriod: "month"[^}]*timelineCorrelativeMarkers: true[^}]*categories: \["date"\][^}]*limit: 500/);
  assert.match(source, /state\.config\.type === "timeline" \|\|/);
  assert.match(source, /function documentRelationshipNetworks[\s\S]*\(state\.catalog\.entities \|\| \[\]\)\.forEach/);
  assert.match(source, /label: "Network", scope: "All"/);
  assert.match(source, /network: \{ nodeRole: "entity"/);
  assert.match(source, /label: "Matrix", scope: "Collections × entity types"/);
  assert.match(source, /label: "Table", scope: "All"/);
  assert.match(source, /table: \{ tableRole: "entity"/);
  assert.match(source, /matrix: \{ matrixColumns: "category", matrixNormalize: "rowShare"/);
  assert.match(source, /Within-collection share is the default/);
  assert.match(source, /rowTotal = new Map/);
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
  assert.equal(result.title, "Mentions — Places Mentioned");
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

test("Galactic Entities defaults to a corpus-fitted Gaia neighborhood and retains the Milky Way overview", () => {
  const appSource = fs.readFileSync("app.js", "utf8");
  const moduleSource = fs.readFileSync("solar-system.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(appSource, /id: "solar", label: "Galactic Entities"/);
  assert.match(appSource, /Milky Way overview/);
  assert.match(appSource, /Gaia observed sky/);
  assert.match(appSource, /Corpus neighborhood \+ Gaia DR3/);
  assert.match(appSource, /solar: \{ solarScale: "local", solarCase: "hill_fish", labels: "all" \}/);
  assert.match(appSource, /<div class="control-title">Hill–Fish Map<\/div><label class="check-chip"><input type="checkbox" data-solar-case/);
  assert.match(appSource, /state\.config\.solarCase = event\.target\.checked \? "hill_fish" : "none"/);
  assert.doesNotMatch(appSource, /controlSelect\("solarCase", "Case layer"/);
  assert.match(moduleSource, /SUN_GALACTOCENTRIC_RADIUS_LY/);
  assert.match(moduleSource, /addSpiralStructure/);
  assert.match(moduleSource, /if \(!this\.drag\|\|this\.mode==="sky"\) return/);
  assert.doesNotMatch(moduleSource, /milkyWayModelLayers|central bar|central bulge|stellar halo|ellipsoidPoint|uniform coordinate/);
  assert.match(moduleSource, /addGalacticReferenceFrame/);
  assert.match(moduleSource, /Galactic Center/);
  assert.match(moduleSource, /new THREE\.Vector3\(-59000,0,0\)/);
  assert.doesNotMatch(moduleSource, /direction of Galactic rotation/);
  assert.doesNotMatch(moduleSource, /this\.dot\("Sunward"/);
  assert.match(appSource, /Hou & Han: 1,853 H II regions/);
  assert.match(appSource, /thin curves are the paper's H II statistical fit/);
  assert.match(appSource, /Published logarithmic-arm fit/);
  assert.match(moduleSource, /gl_PointSize=\(pointSize\+2\.0\)\*pixelRatio/);
  assert.match(moduleSource, /transparent:true,depthTest:false,depthWrite:false/);
  assert.match(moduleSource, /milky-way-spiral-tracers\.csv/);
  assert.match(moduleSource, /milky-way-vlbi-masers\.csv/);
  assert.match(moduleSource, /milky-way-spiral-fit\.json/);
  assert.match(moduleSource, /spiralTracerPosition/);
  assert.match(moduleSource, /logarithmicArmPoints/);
  assert.match(moduleSource, /ringMarkerTexture/);
  assert.match(moduleSource, /CORPUS_NODE_EXPONENT = Math\.log10\(5\)/);
  assert.match(moduleSource, /corpusScreenSize\(value\)\{const mentions=Math\.max\(0,Number\(value\)\|\|0\);return Math\.min\(CORPUS_NODE_MAX_PX,Math\.max\(CORPUS_NODE_MIN_PX,20\*Math\.pow\(mentions\/100,CORPUS_NODE_EXPONENT\)\)\);\}/);
  assert.match(moduleSource, /corpusNodeSize\(value\)\{return this\.corpusScreenSize\(value\);\}/);
  assert.match(moduleSource, /marker\.width=256;marker\.height=256/);
  assert.match(moduleSource, /context\.arc\(128,128,126/);
  assert.match(moduleSource, /new THREE\.ShaderMaterial/);
  assert.match(moduleSource, /float spriteSize=pointSize\+2\.0/);
  assert.match(moduleSource, /innerRadius=\.5\*pointSize\/spriteSize/);
  assert.match(moduleSource, /borderColor:\{value:new THREE\.Color\(0xf6f5ef\)\}/);
  assert.match(moduleSource, /target\.material\.uniforms\?\.pointSize/);
  assert.match(appSource, /Background points are high-confidence Gaia DR3 sources/);
  assert.match(moduleSource, /this\.targetGroups=astronomyTargetGroups\(detail\.astronomy\?\.targets/);
  assert.match(appSource, /reviewed astronomical targets/);
  assert.match(appSource, /Solar System entities at the Sun/);
  assert.match(moduleSource, /gaia-dr3-3d-local-stars\.csv/);
  assert.match(moduleSource, /size:2\.2,map:this\.circularMarkerTexture\(\),alphaTest:\.2,sizeAttenuation:true/);
  assert.match(moduleSource, /LOCAL_DETAIL_RADIUS_LY = 1000/);
  assert.match(moduleSource, /LOCAL_CAMERA_DISTANCE_LY = 1900/);
  assert.match(moduleSource, /filter\(star=>star\.distance<=LOCAL_DETAIL_RADIUS_LY\)/);
  assert.match(moduleSource, /hillFishFrame\(points,fitPoints=points\)/);
  assert.match(moduleSource, /HILL_FISH_FRAME_FILL = \.8/);
  assert.match(moduleSource, /HILL_FISH_CORPUS_FRAME_RADIUS_LY = 100/);
  assert.match(moduleSource, /target\.userData\.targetId&&target\.userData\.distanceLightYears<=HILL_FISH_CORPUS_FRAME_RADIUS_LY/);
  assert.match(moduleSource, /this\.hillFishFrame\(localPoints,\[\.\.\.localPoints,\.\.\.nearbyCorpusPoints\]\)/);
  assert.match(moduleSource, /const hillFish=this\.hillFishActive\(\),localPoints=hillFish\?this\.caseRoutes\.flatMap\(route=>\[route\.from,route\.to\]\)/);
  assert.match(moduleSource, /this\.camera\.lookAt\(focus\)/);
  assert.match(moduleSource, /this\.distance=hillFish\?frame\?\.distance\|\|HILL_FISH_MIN_CAMERA_DISTANCE_LY:this\.mode==="local"\?LOCAL_CAMERA_DISTANCE_LY/);
  assert.match(moduleSource, /labelColumnOffset\(index,positioned\.length,155\)/);
  assert.match(moduleSource, /this\.corpusNodeSize\(target\.mentionCount\),`\$\{distanceLightYears\.toFixed\(1\)\} ly`/);
  assert.match(moduleSource, /this\.corpusScreenSize\(target\.mentionCount\),`\$\{distance\.toFixed\(1\)\} ly`/);
  assert.match(moduleSource, /gaia-edr3-source-density\.png/);
  assert.match(appSource, /state\.catalog\.astronomy/);
  assert.match(appSource, /data-review-astronomy/);
  assert.match(appSource, /function inspectAstronomyCandidates/);
  assert.ok(fs.existsSync("data/astronomy_taxonomy.json"));
  assert.equal(fs.existsSync("data/milky-way-model-source.txt"), false);
  assert.equal(fs.existsSync("data/gaia-dr3-3d-stars.csv"), false);
  assert.equal(fs.existsSync("data/gaia-dr3-3d-distant-stars.csv"), false);
  assert.ok(fs.existsSync("data/milky-way-spiral-tracers.csv"));
  assert.ok(fs.existsSync("data/milky-way-spiral-tracers-source.txt"));
  assert.ok(fs.existsSync("data/milky-way-spiral-fit.json"));
  assert.ok(fs.existsSync("scripts/build_milky_way_spiral_tracers.py"));
  assert.ok(fs.existsSync("data/milky-way-vlbi-masers.csv"));
  assert.ok(fs.existsSync("data/milky-way-vlbi-masers-source.txt"));
  assert.ok(fs.existsSync("scripts/build_milky_way_vlbi_masers.py"));
  assert.equal(fs.readFileSync("data/milky-way-spiral-tracers.csv", "utf8").includes("\r"), false);
  assert.equal(fs.readFileSync("data/milky-way-vlbi-masers.csv", "utf8").includes("\r"), false);
  const rebuildWorkflow = fs.readFileSync(".github/workflows/rebuild-graph.yml", "utf8");
  assert.equal(rebuildWorkflow.match(/- "solar-system\.js"/g)?.length, 2);
  assert.match(rebuildWorkflow, /data\/milky-way-spiral-tracers\.csv/);
  assert.match(rebuildWorkflow, /data\/milky-way-vlbi-masers\.csv/);
  const tracerRows = fs.readFileSync("data/milky-way-spiral-tracers.csv", "utf8").trim().split(/\r?\n/);
  assert.equal(tracerRows[0], "tracer_type,x_kpc,y_kpc,z_kpc,distance_basis,source_record");
  assert.equal(tracerRows.length - 1, 3_950);
  const tracerTypes = tracerRows.slice(1).reduce((counts, row) => { const type = row.split(",")[0]; counts[type] = (counts[type] || 0) + 1; return counts; }, {});
  assert.deepEqual(tracerTypes, { hii_region: 1_866, molecular_cloud: 1_344, methanol_maser: 740 });
  const vlbiRows = fs.readFileSync("data/milky-way-vlbi-masers.csv", "utf8").trim().split(/\r?\n/);
  assert.equal(vlbiRows[0], "name,x_kpc,y_kpc,z_kpc,parallax_mas,parallax_error_mas,arm,source_record");
  assert.equal(vlbiRows.length - 1, 199);
  const spiralFit = JSON.parse(fs.readFileSync("data/milky-way-spiral-fit.json", "utf8"));
  assert.equal(spiralFit.arms.length, 4);
  assert.equal(spiralFit.galactocentricRadiusOfSunKpc, 8.3);
  assert.match(html, /id="solarCanvas"/);
  assert.match(html, /id="solarAnimationButton"[^>]+aria-label="Pause model rotation"[^>]+aria-pressed="true"[^>]+hidden>Pause<\/button>/);
  assert.match(html, /model rotates automatically unless reduced motion is enabled; use Pause or Play/);
  assert.match(html, /id="solarView" class="solar-view" role="group"/);
  assert.match(html, /id="solarRoster"/);
  assert.match(html, /id="solarRoster" class="solar-roster" role="status" aria-live="polite"/);
  assert.match(appSource, /rosterNode\.querySelector\("strong"\)/);
  assert.match(appSource, /rosterNode\.querySelector\("small"\)/);
  assert.match(moduleSource, /function astronomyTargetGroups\(targets\)/);
  assert.match(moduleSource, /this\.targetGroups\.solar\.forEach/);
  assert.match(appSource, /\["local", "galaxy"\]\.includes\(config\.solarScale\)/);
  assert.match(appSource, /state\.config\.solarScale === "sky"/);
  assert.match(appSource, /solarAnimationButton/);
  assert.match(appSource, /syncSolarAnimationButton/);
  assert.match(appSource, /state\.config\.type !== "solar" \|\| state\.config\.solarScale === "sky"/);
  assert.match(moduleSource, /MODEL_ROTATION_PERIOD_MS = 30_000/);
  assert.match(moduleSource, /MODEL_ROTATION_SPEED = Math\.PI \* 2 \/ MODEL_ROTATION_PERIOD_MS/);
  assert.match(moduleSource, /MODEL_AUTO_PLAY = !window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(moduleSource, /this\.autoRotate = MODEL_AUTO_PLAY/);
  assert.match(appSource, /window\.ufoSolar\?\.autoRotate \?\? !window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(fs.readFileSync("scripts/capture_graph_screenshots.mjs", "utf8"), /reducedMotion: "reduce"/);
  assert.match(moduleSource, /syncRotationAxis\(\)[\s\S]*applyQuaternion\(this\.camera\.quaternion\)/);
  assert.match(moduleSource, /animate\(timestamp\)[\s\S]*applyAxisAngle\(this\.rotationAxis,elapsed\*MODEL_ROTATION_SPEED\)/);
  assert.match(moduleSource, /this\.yaw=Math\.atan2\(offset\.x,offset\.z\)/);
  assert.match(moduleSource, /if\(!remaining&&this\.autoRotate\)this\.syncRotationAxis\(\)/);
  assert.match(moduleSource, /if\(this\.lastFrameTime!==null&&!this\.drag\)/);
  assert.match(moduleSource, /setPlaying\(playing\)[\s\S]*CustomEvent\("ufo-solar-playback"/);
  assert.match(moduleSource, /this\.autoRotate=Boolean\(playing\)&&this\.mode!=="sky"/);
});

test("Hill–Fish is an explicit claim layer over current measured star positions", () => {
  const appSource = fs.readFileSync("app.js", "utf8");
  const moduleSource = fs.readFileSync("solar-system.js", "utf8");
  const data = JSON.parse(fs.readFileSync("data/hill-fish-stars.json", "utf8"));
  const starIds = new Set(data.stars.map(star => star.id));

  assert.equal(data.schema, "ufo-files-hill-fish-star-map/v1");
  assert.equal(data.stars.length, 15);
  assert.equal(data.routes.length, 11);
  assert.equal(starIds.size, data.stars.length);
  assert.ok(data.routes.every(route => starIds.has(route.from) && starIds.has(route.to)));
  assert.deepEqual(new Set(data.routes.map(route => route.kind)), new Set(["reported_route", "reported_expedition"]));
  const connectedStarIds = new Set(data.routes.flatMap(route => [route.from, route.to]));
  assert.deepEqual(data.stars.filter(star => !connectedStarIds.has(star.id)).map(star => star.id), ["gliese_86_1", "gliese_95", "kappa_fornacis"]);
  assert.ok(data.routes.some(route => route.from === "gliese_86" && route.to === "tau_1_eridani"));
  assert.ok(data.routes.every(route => route.from !== "kappa_fornacis" && route.to !== "kappa_fornacis"));
  assert.equal(data.stars.find(star => star.id === "zeta_1_reticuli").hip, 15330);
  const eridaniStar = data.stars.find(star => star.id === "82_eridani");
  const eridaniTarget = JSON.parse(fs.readFileSync("data/astronomy_taxonomy.json", "utf8")).targets.find(target => target.id === "82_eridani");
  assert.ok(eridaniStar);
  assert.ok(eridaniTarget.aliases.includes("82 Eridani"));
  assert.deepEqual(eridaniTarget.position, eridaniStar.position);
  assert.match(moduleSource, /82_eridani:"82_eridani"/);
  assert.ok(data.stars.find(star => star.id === "gliese_86_1").position.distanceLightYears > 190);
  assert.match(data.methodology, /not measured or verified interstellar routes/);
  assert.match(data.sources.astrometry, /simbad/);
  assert.equal(data.defaultView.foregroundStarId, "zeta_1_reticuli");
  assert.equal(data.defaultView.screenAnchorStarId, "sun");
  assert.equal(data.defaultView.occludedReference.id, "zeta_tucanae");
  assert.equal(data.defaultView.occludedReference.hip, 1599);
  assert.match(data.defaultView.methodology, /controls only the initial camera/);
  assert.match(appSource, /Hill–Fish Map/);
  assert.match(appSource, /lines are not verified travel routes/);
  assert.match(appSource, /default camera follows Fish's published Zeta Tucanae occultation constraint/);
  assert.match(appSource, /Default orientation/);
  assert.match(moduleSource, /fetch\("data\/hill-fish-stars\.json"\)/);
  assert.match(moduleSource, /route\.kind==="reported_expedition"/);
  assert.match(moduleSource, /addCaseRoute\(route,from,to,caseNames\)/);
  assert.match(moduleSource, /caseRouteAt\(event\)/);
  assert.match(moduleSource, /setHoveredRoute\(route\)/);
  assert.match(moduleSource, /updateCaseRoutes\(\)/);
  assert.match(moduleSource, /routeDegrees=new Map\(\)/);
  assert.match(moduleSource, /labelPriority=corpus\?2000000/);
  assert.match(moduleSource, /HILL_FISH_CORPUS_LABEL_LIMIT = 7/);
  assert.match(moduleSource, /HILL_FISH_REFERENCE_LABEL_LIMIT = 3/);
  assert.match(moduleSource, /HILL_FISH_VISIBLE_LABEL_IDS = new Set\(\["zeta_1_reticuli","zeta_2_reticuli"\]\)/);
  assert.match(moduleSource, /HILL_FISH_VISIBLE_TARGET_IDS = new Set\(\["aldebaran","arcturus"\]\)/);
  assert.match(moduleSource, /HILL_FISH_PINNED_LABEL_GAP_PX = 16/);
  assert.match(moduleSource, /HILL_FISH_VISIBLE_LABEL_IDS\.has\(target\.userData\.starId\)\|\|HILL_FISH_VISIBLE_TARGET_IDS\.has\(target\.userData\.targetId\)/);
  assert.match(moduleSource, /compactOffset=this\.hillFishActive\(\)&&HILL_FISH_VISIBLE_TARGET_IDS\.has\(m\.userData\.targetId\)\?\{x:x<w\/2\?HILL_FISH_PINNED_LABEL_GAP_PX:-HILL_FISH_PINNED_LABEL_GAP_PX,y:0\}:null/);
  assert.match(moduleSource, /HILL_FISH_EDGE_LABEL_IDS = new Set\(\["gliese_86_1"\]\)/);
  assert.match(moduleSource, /HILL_FISH_EDGE_TARGET_IDS = new Set\(\["polaris"\]\)/);
  assert.match(moduleSource, /HILL_FISH_EDGE_NODE_MIN_PX = 12/);
  assert.match(moduleSource, /HILL_FISH_EDGE_LABEL_IDS\.has\(target\.userData\.starId\)\|\|HILL_FISH_EDGE_TARGET_IDS\.has\(target\.userData\.targetId\)/);
  assert.match(moduleSource, /edgeLabel\?HILL_FISH_EDGE_NODE_MIN_PX:anchor\?10:7/);
  assert.match(moduleSource, /HILL_FISH_EDGE_NODE_MIN_PX,HILL_FISH_EDGE_NODE_MIN_PX,CORPUS_NODE_MAX_PX/);
  assert.match(moduleSource, /label\.dataset\.edgeArrow/);
  assert.match(moduleSource, /Displayed at the viewport edge; measured direction retained and distance compressed/);
  assert.match(moduleSource, /mesh\.userData\.edgeProxy=edgeProxy/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-label\.is-offscreen::after/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-label\.is-offscreen \{[^}]*background: transparent; border-color: transparent/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-label\.is-offscreen\.is-hovered \{[^}]*box-shadow: none/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-edge-proxy \{[^}]*border: 1px dashed currentColor/);
  assert.doesNotMatch(fs.readFileSync("styles.css", "utf8"), /\.solar-edge-proxy::after/);
  assert.match(appSource, /Off-canvas star · direction retained · distance compressed/);
  assert.match(appSource, /Dashed hollow edge nodes retain measured direction but compress off-canvas distance/);
  assert.match(moduleSource, /pinnedLabel=HILL_FISH_VISIBLE_LABEL_IDS\.has\(star\.id\)/);
  assert.match(moduleSource, /pinnedLabel\?1750000-index/);
  assert.match(moduleSource, /HILL_FISH_CORPUS_LABEL_LIMIT-pinnedCorpus\.length/);
  assert.match(moduleSource, /HILL_FISH_REFERENCE_LABEL_LIMIT-pinnedReferences\.length/);
  assert.match(moduleSource, /labelPriority:3000000\+\(target\.mentionCount\|\|0\)/);
  assert.match(moduleSource, /this\.caseTargetNodes\.get\(this\.hoveredRoute\.fromId\)/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-case-route \{[^}]*stroke-width: 1;/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-case-route\.is-route \{ stroke-width: 1; stroke-dasharray: none/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-case-route\.is-expedition \{ stroke-dasharray: 6 5/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /\.solar-case-route\.is-hovered \{ stroke-width: 2;/);
  assert.match(appSource, /Hill-reported route · solid red/);
  assert.match(appSource, /Hill-reported expedition · broken red/);
  assert.match(appSource, /Fish viewpoint · 12-star route pattern \+ 3 background points/);
  assert.match(moduleSource, /HILL_FISH_CASES = new Set\(\["hill_fish"\]\)/);
  assert.match(moduleSource, /HILL_FISH_MIN_CAMERA_DISTANCE_LY = 90/);
  assert.match(moduleSource, /required\+HILL_FISH_DEPTH_PADDING_LY/);
  assert.match(moduleSource, /this\.caseRoutes\.flatMap\(route=>\[route\.from,route\.to\]\)/);
  assert.match(moduleSource, /hillFishDefaultView\(data\)/);
  assert.match(moduleSource, /this\.camera\.up\.copy/);
  assert.doesNotMatch(moduleSource, /opacity:this\.hillFishActive\(\)\?\.13/);
  assert.match(moduleSource, /Gaia, corpus entities, and Hill–Fish layer ready/);
  assert.match(moduleSource, /size=corpus\?this\.corpusScreenSize\(corpus\.mentionCount\):edgeLabel\?HILL_FISH_EDGE_NODE_MIN_PX:anchor\?10:7/);
  const corpusSize = value => Math.min(50, Math.max(6, 20 * Math.pow((Number(value) || 0) / 100, Math.log10(5))));
  assert.equal(corpusSize(100), 20);
  assert.equal(corpusSize(1000), 50);
  assert.equal(corpusSize(2000), 50);
});

test("Galactic Entities nodes expose hover emphasis and click inspection", () => {
  const appSource = fs.readFileSync("app.js", "utf8");
  const moduleSource = fs.readFileSync("solar-system.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(moduleSource, /nodeAt\(event\)/);
  assert.match(moduleSource, /setHoveredNode\(node\)/);
  assert.match(moduleSource, /label\.addEventListener\("pointerenter",\(\)=>this\.setHoveredNode\(mesh\)\)/);
  assert.match(moduleSource, /label\.addEventListener\("pointerleave",\(\)=>this\.setHoveredNode\(null\)\)/);
  assert.match(moduleSource, /label\.addEventListener\("click",event=>\{event\.stopPropagation\(\);if\(mesh\.userData\.selectable\)this\.selectNode\(mesh\);\}\)/);
  assert.match(moduleSource, /target\.renderOrder=active\?10:\(target\.userData\.baseRenderOrder\|\|0\)/);
  assert.match(moduleSource, /visibleSolarTargets\.forEach\(\(target,index\)=>this\.dot\(target\.name,solarPosition,0x111111,this\.corpusNodeSize\(target\.mentionCount\)/);
  assert.match(moduleSource, /hoverOnly=m===this\.hoveredNode&&!defaultAllowed\.has\(m\),compactOffset=/);
  assert.match(moduleSource, /offset=hoverOnly\?null:compactOffset\|\|m\.userData\.labelOffset/);
  assert.match(moduleSource, /const labelW=Math\.max\(1,label\.offsetWidth\),labelH=Math\.max\(1,label\.offsetHeight\)/);
  assert.doesNotMatch(moduleSource, /labelW=Math\.max\(90/);
  assert.match(moduleSource, /leader\.style\.display=show&&offset&&!offscreen\?"":"none"/);
  assert.match(moduleSource, /CustomEvent\("ufo-solar-select"/);
  assert.match(moduleSource, /claimLayer:"hill_fish"/);
  assert.match(appSource, /function inspectSolarNode\(detail\)/);
  assert.match(appSource, /window\.addEventListener\("ufo-solar-select"/);
  assert.match(appSource, /disputed claim layer, not a verified travel map/);
  assert.match(styles, /\.solar-label\.is-hovered/);
  assert.match(styles, /\.solar-label \{[^}]*pointer-events: auto; cursor: pointer/);
  assert.match(styles, /#solarCanvas\.has-corpus-cluster, #solarCanvas\.has-node/);
  assert.match(html, /hover a local node to identify it/);
});

test("Milky Way accounts for every corpus astronomy target without inventing positions", () => {
  const moduleSource = fs.readFileSync("solar-system.js", "utf8");
  const context = vm.createContext({});
  const groupingSource = moduleSource.slice(moduleSource.indexOf("function astronomyTargetGroups"), moduleSource.indexOf("class SolarModel"));
  vm.runInContext(groupingSource, context);
  context.astronomyTargets = loadCatalogFixture().astronomy.targets;
  const groups = JSON.parse(vm.runInContext(`JSON.stringify(astronomyTargetGroups(astronomyTargets))`, context));
  const groupedIds = [groups.solar, groups.positioned, groups.scene, groups.unpositioned].flat().map(target => target.targetId);
  const catalogMoon = context.astronomyTargets.find(target => target.targetId === "moon");

  assert.equal(groups.sorted[0].targetId, "moon");
  assert.deepEqual(
    { mentionCount: groups.sorted[0].mentionCount, documentCount: groups.sorted[0].documentCount },
    { mentionCount: catalogMoon.mentionCount, documentCount: catalogMoon.documentCount }
  );
  assert.ok(groups.solar.some(target => target.targetId === "moon"));
  assert.ok(groups.positioned.every(target => target.position.frame === "ICRS"));
  assert.deepEqual(groups.scene.map(target => target.targetId).sort(), ["galactic_center", "milky_way"]);
  assert.equal(new Set(groupedIds).size, context.astronomyTargets.length);
  assert.equal(groupedIds.length, context.astronomyTargets.length);
  assert.match(moduleSource, /\$\{accounted\.toLocaleString\(\)\} corpus entities/);
  assert.match(moduleSource, /this\.targetGroups\.solar\.forEach\(\(target,index\)=>/);
  assert.match(moduleSource, /labelColumnOffset\(index,this\.targetGroups\.solar\.length,28\)/);
  assert.match(moduleSource, /labelColumnOffset\(index,this\.targetGroups\.positioned\.length,155\)/);
  assert.match(moduleSource, /this\.marker\(solarPosition,0x111111,8,true\)/);
  assert.match(moduleSource, /this\.dot\(target\.name,solarPosition,0x111111,0,[\s\S]*1000000-index,false\)/);
  assert.match(moduleSource, /this\.dragDistance\+=Math\.hypot\(dx,dy\);if\(this\.dragDistance>2\)this\.dragMoved=true/);
  assert.doesNotMatch(moduleSource, /solar-entity-list/);
  assert.match(moduleSource, /solar-label-leader/);
  assert.match(fs.readFileSync("index.html", "utf8"), /id="solarLeaders" class="solar-leaders"/);
  assert.match(moduleSource, /ufo-solar-drilldown/);
  assert.match(moduleSource, /corpusClusterAt\(event\)/);
  assert.match(fs.readFileSync("app.js", "utf8"), /updateConfig\("solarScale","local",true\)/);
  assert.match(fs.readFileSync("app.js", "utf8"), /No reviewed point position/);
  assert.match(fs.readFileSync("app.js", "utf8"), /mentionCount[\s\S]*mentions \/[\s\S]*documentCount[\s\S]*documents/);
  assert.doesNotMatch(moduleSource, /synthetic position|invented coordinate|random position/);
});

test("map and timeline expose relationship controls", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /\["scatter", "map", "timeline"\]\.includes\(state\.config\.type\)/);
  assert.match(source, /function documentRelationshipNetworks/);
  assert.match(source, /Shared published entities/);
  assert.match(source, /state\.config\.timelineRole === "entity"[\s\S]*documentRelationshipNetworks/);
  assert.match(source, /relationships: overlay\.edges\.map/);
});

test("timeline defaults to reviewed events and published structured reports", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(source, /timeline: \{ timelineRole: "event", timelineGrouping: true, timelineGroupPeriod: "month", timelineCorrelativeMarkers: true, timelineHistoricalCandidates: false, x: "startDate", y: "mentionRank", size: "eventCount"[^\n]+limit: 500[^\n]+relationshipLayer: "always"/);
  assert.match(source, /title = config\.timelineRole === "event" \? "Event Sequence"/);
  assert.match(source, /state\.config\.timelineRole === "event" && state\.config\.relationshipLayer !== "off"/);
  assert.match(source, /const shared = \(item\.entityIds \|\| \[\]\)\.filter/);
  assert.match(source, /state\.catalog\.events \|\| \[\]/);
  assert.match(source, /document\?\.engine !== "structured-database-extract" \|\| !document\.documentDate/);
  assert.match(source, /dateReview\.status !== "published" \|\| \(document\.source !== "UPDB-MUFON" && dateReview\.method !== "analyst-review"\)/);
  assert.match(source, /before-modern-reporting-baseline/);
  assert.match(source, /known-source-date-defect/);
  assert.match(source, /Show \$\{formatNumber\(state\.historicalTimelineCandidateCount\)\} screened unreviewed historical dates/);
  assert.match(source, /All screened pre-1947 source dates have analyst decisions/);
  assert.match(source, /historicalTimelineCandidateCount = state\.catalog\.documents\.filter\(historicalTimelineCandidate\)\.length/);
  assert.match(source, /document\.documentDateEvidence\?\.method !== "metadata:document_date"/);
  assert.match(source, /groupTimelineEvents\(rawEventCandidates, state\.config\.timelineGroupPeriod\)/);
  assert.match(source, /data-timeline-grouping/);
  assert.match(source, /data-timeline-correlative-markers[^\n]+Show correlative date markers/);
  assert.match(source, /const timelineGroupingControls = eventSequenceRelationships[\s\S]*\$\("#encodeControls"\)\.innerHTML = timelineGroupingControls/);
  assert.match(source, /item\.confidence >= \.9/);
  assert.match(source, /item\.startDate \|\| item\.documentDate/);
  assert.match(source, /graphDocumentCountSubtitle\(state\.catalog\)/);
  assert.match(source, /\["createdAt", "documentDate", "startDate"\]\.includes\(xKey\)/);
  assert.match(source, /labels: "top", limit: 500/);
  assert.match(source, /\(right\.mentionCount \|\| 0\) - \(left\.mentionCount \|\| 0\)/);
  assert.match(source, /timelineTopLabelPlacements\([\s\S]*const topLabelPlacements/);
  assert.match(source, /function assignTimelineMentionRanks/);
  assert.match(source, /item\.mentionRank = index \+ 1/);
  assert.match(source, /timeline-event-node timeline-\$\{provenance\}/);
  assert.match(source, /All published corpus events use the same solid marks/);
  assert.doesNotMatch(source, /Published database reports only|Includes reviewed events|Dashed marks contain database reports only/);
  assert.doesNotMatch(styles, /timeline-event-node\.timeline-reported[^}]*stroke-dasharray/);
  assert.match(source, /hasHistoricalCandidate[^\n]+historicalCandidateCount[^\n]+historicalCandidateDocument/);
  assert.match(source, /timeline-has-candidate/);
  assert.match(source, /radius \+ 3[^\n]+timeline-candidate-ring/);
  assert.match(styles, /timeline-candidate-ring[^}]*stroke: var\(--ink\)[^}]*stroke-dasharray: 3 2/);
  assert.match(styles, /timeline-event-node\.timeline-candidate[^}]*fill: var\(--paper\)/);
  assert.match(source, /fetch\("data\/catalog\.json", \{ cache: "no-cache" \}\)/);
  assert.match(source, /shard\.version \|\| catalog\.input\?\.revision \|\| catalog\.generatedAt/);
  assert.match(source, /fetch\(`data\/\$\{shard\.path\}\?v=\$\{shardVersion\}`\)/);
  assert.match(source, /mentionCount: "Event mentions"/);
  assert.match(source, /mentionRank: "Mention rank"/);
  assert.match(source, /yKey === "mentionRank" \? Math\.round\(rawValue\) : rawValue/);
  assert.match(source, /\[item\.mentionRank, "mention rank"\], \[item\.mentionCount, "event mentions"\]/);
  assert.match(source, /config\.type === "timeline" && config\.timelineRole === "event"\) config\.y = "mentionRank"/);
});

test("MUFON report promotion and week, month, and year grouping are deterministic", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const document = {
        id: "doc-mufon", title: "Mufon 5283000", source: "UPDB-MUFON", path: "UPDB-MUFON/000/mufon-5283000.txt",
        engine: "structured-database-extract", documentDate: "2022-01-20", documentDatePrecision: "day", documentDateConfidence: .99,
        documentDateEvidence: { excerpt: "2022-01-20 07:13:00", method: "metadata:document_date" }, sourceFamily: { id: "family-mufon" },
        sourceRecord: { externalId: "120442", databaseId: 5283000 }
      };
      const reported = reportedTimelineEvent(document);
      const reviewed = {
        id: "reviewed", title: "Reviewed event", eventType: "sighting", startDate: "2022-01-24", confidence: .95,
        mentionCount: 3, documentIds: ["doc-reviewed"], entityIds: ["entity-a"], sourceFamilyIds: ["family-reviewed"],
        sources: ["Reviewed collection"], evidence: [{ documentId: "doc-reviewed", excerpt: "Reviewed evidence" }]
      };
      const february = { ...reviewed, id: "february", startDate: "2022-02-01", documentIds: ["doc-february"] };
      const coarseYear = { ...reviewed, id: "coarse-year", startDate: "1932-01-01", datePrecision: "year", documentIds: ["doc-coarse-year"] };
      const coarseMonth = { ...reviewed, id: "coarse-month", startDate: "1933-06-01", datePrecision: "month", documentIds: ["doc-coarse-month"] };
      const historical = historicalTimelineCandidate({ ...document, documentDate: "1900-01-01" });
      const auditedDefects = {
        baass: historicalTimelineCandidate({ ...document, source: "UPDB-BAASS", documentDate: "1905-06-29", sourceRecord: { databaseId: 6053107 } }),
        nids: historicalTimelineCandidate({ ...document, source: "UPDB-NIDS", documentDate: "1905-06-12", sourceRecord: { databaseId: 6091052 } }),
        nicapBlock: historicalTimelineCandidate({ ...document, source: "UPDB-NICAP", documentDate: "1902-01-31", sourceRecord: { databaseId: 5182517 } }),
        nicapUnknown: historicalTimelineCandidate({ ...document, source: "UPDB-NICAP", documentDate: "1900-01-01", sourceRecord: { databaseId: 5176695 } }),
        nicapImprecise: historicalTimelineCandidate({ ...document, source: "UPDB-NICAP", documentDate: "1944-01-01", sourceRecord: { databaseId: 5176867 } }),
        mufonSentinel: historicalTimelineCandidate({ ...document, documentDate: "1890-01-01" })
      };
      const analystOverride = reportedEventDateReview({
        ...document,
        source: "UPDB-BAASS",
        documentDate: "1905-06-29",
        sourceRecord: { databaseId: 6053107 },
        reportedEventDateReview: { status: "published", reason: "analyst-confirmed-event-date", method: "analyst-review" }
      });
      return JSON.stringify({
        reported: { id: reported.id, title: reported.title, type: reported.eventType, date: reported.startDate, documentIds: reported.documentIds },
        rejected: reportedTimelineEvent({ ...document, source: "Another collection" }),
        heldHistoric: reportedTimelineEvent({ ...document, documentDate: "1900-01-01" }),
        heldUntrustedMetadata: reportedTimelineEvent({
          ...document,
          documentDateEvidence: { excerpt: "2022-01-20", method: "metadata:authored_at" }
        }),
        heldExplicit: reportedTimelineEvent({
          ...document,
          reportedEventDateReview: { status: "review_required", reason: "explicit-invalid-date-language" }
        }),
        historical: { id: historical.id, type: historical.eventType, date: historical.startDate, review: historical.dateReview },
        malformedHistorical: historicalTimelineCandidate({ ...document, documentDate: "0191-01-01" }),
        explicitlyInvalidHistorical: historicalTimelineCandidate({
          ...document,
          documentDate: "1900-01-01",
          reportedEventDateReview: { status: "review_required", reason: "explicit-invalid-date-language" }
        }),
        auditedDefects,
        analystOverride,
        week: groupTimelineEvents([reported, reviewed], "week").map(group => ({ startDate: group.startDate, count: group.eventCount })),
        month: groupTimelineEvents([reported, reviewed, february], "month").map(group => ({
          title: group.title, count: group.eventCount, reports: group.reportedEventCount, reviewed: group.publishedEventCount,
          documents: group.documentCount, families: group.independentSourceFamilyCount, entities: group.entityIds
        })),
        coarse: groupTimelineEvents([coarseYear, coarseMonth], "month").map(group => ({
          title: group.title, startDate: group.startDate, precision: group.datePrecision
        })),
        coarseLabels: [timelineDateLabel(coarseYear.startDate, coarseYear.datePrecision), timelineDateLabel(coarseMonth.startDate, coarseMonth.datePrecision)],
        year: groupTimelineEvents([reported, reviewed, february], "year").map(group => ({ title: group.title, count: group.eventCount }))
      });
    })()
  `, context));

  assert.deepEqual(result.reported, {
    id: "reported-doc-mufon", title: "MUFON report 120442", type: "reported_sighting", date: "2022-01-20", documentIds: ["doc-mufon"]
  });
  assert.equal(result.rejected, null);
  assert.equal(result.heldHistoric, null);
  assert.equal(result.heldUntrustedMetadata, null);
  assert.equal(result.heldExplicit, null);
  assert.deepEqual(result.historical, {
    id: "historical-candidate-doc-mufon", type: "historical_date_candidate", date: "1900-01-01",
    review: { status: "review_required", reason: "before-modern-reporting-baseline", method: "timeline-fallback" }
  });
  assert.equal(result.malformedHistorical, null);
  assert.equal(result.explicitlyInvalidHistorical, null);
  assert.deepEqual(result.auditedDefects, {
    baass: null, nids: null, nicapBlock: null, nicapUnknown: null, nicapImprecise: null, mufonSentinel: null
  });
  assert.deepEqual(result.analystOverride, {
    status: "published", reason: "analyst-confirmed-event-date", method: "analyst-review"
  });
  assert.deepEqual(result.week, [{ startDate: "2022-01-17", count: 1 }, { startDate: "2022-01-24", count: 1 }]);
  assert.deepEqual(result.month, [
    { title: "January 2022", count: 2, reports: 1, reviewed: 1, documents: 2, families: 2, entities: ["entity-a"] },
    { title: "February 2022", count: 1, reports: 0, reviewed: 1, documents: 1, families: 1, entities: ["entity-a"] }
  ]);
  assert.deepEqual(result.coarse, [
    { title: "1932", startDate: "1932-01-01", precision: "year" },
    { title: "June 1933", startDate: "1933-06-01", precision: "month" }
  ]);
  assert.deepEqual(result.coarseLabels, ["1932", "June 1933"]);
  assert.deepEqual(result.year, [{ title: "2022", count: 3 }]);
});

test("timeline mention ranks are unique so no more than the cutoff can sit above the guide", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const ranked = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const items = [
      { id: "later", mentionCount: 1, documentCount: 1, confidence: .99 },
      { id: "strong", mentionCount: 3, documentCount: 2, confidence: .99 },
      { id: "early", mentionCount: 1, documentCount: 1, confidence: .99 },
      { id: "middle", mentionCount: 2, documentCount: 1, confidence: .99 }
    ];
    assignTimelineMentionRanks(items);
    return items.map(item => ({ id: item.id, rank: item.mentionRank }));
  })())`, context));

  assert.deepEqual(ranked, [
    { id: "later", rank: 4 },
    { id: "strong", rank: 1 },
    { id: "early", rank: 3 },
    { id: "middle", rank: 2 }
  ]);
});

test("timeline selection reserves strong nodes from every visible decade", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const selected = JSON.parse(vm.runInContext(`JSON.stringify(timeBalancedTimelineEvents([
    { id: "1941", startDate: "1941-01-01", mentionCount: 1, documentCount: 1, confidence: .9 },
    { id: "1942", startDate: "1942-01-01", mentionCount: 2, documentCount: 1, confidence: .9 },
    { id: "1943", startDate: "1943-01-01", mentionCount: 3, documentCount: 1, confidence: .9 },
    { id: "1951", startDate: "1951-01-01", mentionCount: 4, documentCount: 1, confidence: .9 },
    { id: "1952", startDate: "1952-01-01", mentionCount: 5, documentCount: 1, confidence: .9 },
    { id: "1953", startDate: "1953-01-01", mentionCount: 6, documentCount: 1, confidence: .9 },
    { id: "2011", startDate: "2011-01-01", mentionCount: 100, documentCount: 1, confidence: .9 },
    { id: "2012", startDate: "2012-01-01", mentionCount: 99, documentCount: 1, confidence: .9 },
    { id: "2013", startDate: "2013-01-01", mentionCount: 98, documentCount: 1, confidence: .9 }
  ], 6, 2).map(item => item.id))`, context));

  assert.deepEqual(selected, ["2011", "2012", "2013", "1953", "1952", "1941"]);
  assert.ok(selected.includes("1941"));
  const prioritized = JSON.parse(vm.runInContext(`JSON.stringify(timeBalancedTimelineEvents([
    { id: "strong-1", startDate: "2011-01-01", mentionCount: 100 },
    { id: "strong-2", startDate: "2012-01-01", mentionCount: 99 },
    { id: "ordinary", startDate: "2013-01-01", mentionCount: 98 },
    { id: "candidate-1900", startDate: "1900-01-01", mentionCount: 1, historicalCandidateCount: 1 },
    { id: "candidate-1910", startDate: "1910-01-01", mentionCount: 1, historicalCandidateCount: 1 }
  ], 4, 2, item => Boolean(item.historicalCandidateCount)).map(item => item.id))`, context));
  assert.deepEqual(prioritized, ["strong-1", "strong-2", "candidate-1900", "candidate-1910"]);
  assert.match(source, /const TIMELINE_DECADE_FLOOR = 40/);
  assert.match(source, /state\.config\.timelineHistoricalCandidates[\s\S]*historicalCandidateCount/);
});

test("timeline date scale reserves ten percent before 1938 and half after 2007", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const extent = [Date.UTC(1860, 0, 1), Date.UTC(2020, 0, 1)];
    const range = [50, 1050];
    return {
      positions: [1860, 1938, 2007, 2020].map(year => timelineDatePosition(Date.UTC(year, 0, 1), extent, range)),
      ticks: timelineDateTicks(extent).map(value => new Date(value).getUTCFullYear()),
      recentOnly: [1980, 2007, 2020].map(year => timelineDatePosition(
        Date.UTC(year, 0, 1),
        [Date.UTC(1980, 0, 1), Date.UTC(2020, 0, 1)],
        range
      )),
      shortRecentTicks: timelineDateTicks([
        Date.UTC(1942, 0, 1),
        Date.UTC(2007, 3, 23)
      ]).map(value => new Date(value).getUTCFullYear())
    };
  })())`, context));

  assert.equal(result.positions[0], 50);
  assert.equal(result.positions[1], 150);
  assert.equal(result.positions[2], 550);
  assert.equal(result.positions[3], 1050);
  assert.deepEqual(result.ticks, [1860, 1938, 1972, 2007, 2013, 2020]);
  assert.deepEqual(result.recentOnly, [50, 550, 1050]);
  assert.deepEqual(result.shortRecentTicks, [1942, 1955, 1968, 1980, 1993, 2007]);
  assert.match(source, /const TIMELINE_EARLY_RANGE_SHARE = \.1;/);
  assert.match(source, /const TIMELINE_RECENT_RANGE_SHARE = \.5;/);
  assert.match(source, /xTicks: timelineDateTicks\(xExtent\)/);
  assert.match(source, /x: timelineXPosition\(new Date\(timelineDate\(item\)\)\.getTime\(\)\)/);
});

test("timeline quadrant guides cross the full-height mention-rank plot", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  const styles = fs.readFileSync("styles.css", "utf8");
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const active = timelineRelevanceLayout(240, 50, [22, 552]);
    const defaultGuide = timelineRelevanceLayout(500, DEFAULT_TIMELINE_RELEVANCE_CUTOFF, [20, 520]);
    const allRelevant = timelineRelevanceLayout(250, 250, [20, 520]);
    const recency = timelineRecencyGuidePlacement(
      [Date.UTC(1940, 0, 1), Date.UTC(2040, 0, 1)], [58, 972], 2000,
      { left: 58, right: 972, top: 22, bottom: active.bottom }
    );
    return {
      active: active.active,
      relevanceActive: active.relevanceActive,
      cutoff: active.cutoff,
      top: active.top,
      bottom: active.bottom,
      relevanceY: active.relevanceY,
      ticks: active.ticks,
      positions: [1, 50, 120, 180, 240].map(active.position),
      defaultGuide: {
        cutoff: defaultGuide.cutoff,
        position: defaultGuide.relevanceY,
        plotFraction: (defaultGuide.relevanceY - defaultGuide.top) / (defaultGuide.bottom - defaultGuide.top)
      },
      allRelevant: {
        relevanceActive: allRelevant.relevanceActive,
        positions: [1, 250].map(allRelevant.position)
      },
      recency: { year: recency.year, text: recency.text, x: recency.x, y: recency.y }
    };
  })())`, context));

  assert.equal(result.active, true);
  assert.equal(result.relevanceActive, true);
  assert.equal(result.cutoff, 50);
  assert.equal(result.top, 22);
  assert.equal(result.bottom, 552);
  assert.deepEqual(result.ticks, [1, 25, 50, 146, 240]);
  assert.equal(result.positions[0], 22);
  assert.ok(result.positions[1] < result.relevanceY);
  assert.equal(result.positions[4], 552);
  assert.ok(result.positions[0] < result.relevanceY);
  assert.ok(result.positions.slice(2).every(position => position > result.relevanceY));
  assert.equal(result.defaultGuide.cutoff, 250);
  assert.ok(Math.abs(result.defaultGuide.plotFraction - .75) < .002);
  assert.equal(result.allRelevant.relevanceActive, false);
  assert.deepEqual(result.allRelevant.positions, [20, 520]);
  assert.deepEqual(result.recency.year, 2000);
  assert.equal(result.recency.text, "More recent · 2000–present");
  assert.ok(result.recency.x > 58 && result.recency.x < 972);
  assert.equal(result.recency.y, 545);
  assert.match(source, /Relevance guide <span>Top \$\{state\.config\.timelineRelevanceCutoff\}/);
  assert.match(source, /Recency guide <span>\$\{state\.config\.timelineRecencyYear\}/);
  assert.doesNotMatch(source, /rankedData\.filter\(item => item\.mentionRank <= state\.config\.timelineRelevanceCutoff\)/);
  assert.doesNotMatch(source, /xAxisY: relevanceLayout\.midpoint/);
  assert.match(source, /drawTimelineDateBaseline\(svg, width, margin, height - margin\.bottom\)/);
  assert.match(source, /class: "timeline-date-baseline"/);
  assert.match(source, /class: "timeline-relevance-cutoff"/);
  assert.match(source, /class: "timeline-recency-guide"/);
  assert.match(styles, /\.timeline-relevance-cutoff \{[^}]*stroke-dasharray: 7 5;/);
  assert.match(styles, /\.timeline-relevance-cutoff-label \{[^}]*paint-order: stroke;/);
  assert.match(styles, /\.timeline-recency-guide \{[^}]*stroke-dasharray: 3 4;/);
  assert.match(styles, /\.timeline-date-baseline \{[^}]*stroke-width: 1\.5;/);
});

test("timeline top labels use non-overlapping alternate placements", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const placements = JSON.parse(vm.runInContext(`
    (() => {
      const items = [
        { id: "a", title: "January 2020" },
        { id: "b", title: "February 2020" },
        { id: "c", title: "March 1990" }
      ];
      const points = { a: { x: 100, y: 100 }, b: { x: 102, y: 101 }, c: { x: 300, y: 100 } };
      return JSON.stringify([...timelineTopLabelPlacements(
        items, item => points[item.id], () => 6,
        { left: 0, right: 400, top: 0, bottom: 200 }, 12
      ).entries()]);
    })()
  `, context));

  assert.equal(placements.length, 3);
  const boxes = placements.map(([, placement]) => placement);
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      assert.ok(boxes[left].right + 6 < boxes[right].left || boxes[left].left - 6 > boxes[right].right
        || boxes[left].bottom + 6 < boxes[right].top || boxes[left].top - 6 > boxes[right].bottom);
    }
  }
});

test("timeline axes use vertical date guides and sourced historical markers", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const extent = [Date.UTC(1930, 0, 1), Date.UTC(2020, 0, 1)];
      return JSON.stringify(timelineHistoricalMarkerPlacements(
        extent, [58, 872], { left: 58, right: 872, top: 22, bottom: 552 }
      ).map(marker => ({ date: marker.date, label: marker.label, sourceUrl: marker.sourceUrl, precision: marker.precision || "day" })));
    })()
  `, context));
  const compactLabels = JSON.parse(vm.runInContext(`JSON.stringify(timelineHistoricalMarkerPlacements(
    [Date.UTC(1930, 0, 1), Date.UTC(2020, 0, 1)], [58, 340],
    { left: 58, right: 340, top: 22, bottom: 552 }
  ).map(marker => marker.displayLabel))`, context));
  const desktopBoxes = JSON.parse(vm.runInContext(`JSON.stringify(timelineHistoricalMarkerPlacements(
    [Date.UTC(1930, 0, 1), Date.UTC(2020, 0, 1)], [58, 872],
    { left: 58, right: 872, top: 22, bottom: 552 }
  ).map(marker => marker.box))`, context));
  const groupedOverlays = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const raw = [
      { id: "early", startDate: "1930-01-15", mentionCount: 1, confidence: 1 },
      { id: "late", startDate: "2020-12-15", mentionCount: 1, confidence: 1 }
    ];
    return ["week", "month", "year"].map(period => {
      const grouped = groupTimelineEvents(raw, period);
      const extent = timelineDateExtent(grouped, raw, "event");
      return {
        period,
        extent,
        labels: timelineHistoricalMarkerPlacements(
          extent, [58, 872], { left: 58, right: 872, top: 22, bottom: 552 }
        ).map(marker => marker.label)
      };
    });
  })())`, context));
  const largeCorpusExtent = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const start = Date.UTC(1900, 0, 1);
    const events = Array.from({ length: 100000 }, (_, index) => ({ startDate: start + index * 86400000 }));
    return timelineDateExtent([], events, "event");
  })())`, context));
  const filteredReportExtent = JSON.parse(vm.runInContext(`JSON.stringify(timelineDateExtent(
    [{ startDate: "1947-01-01" }], [{ startDate: "1947-01-01" }], "event", TIMELINE_HISTORICAL_MARKERS
  ))`, context));
  const styles = fs.readFileSync("styles.css", "utf8");

  assert.deepEqual(result, [
    {
      date: "1939-09-01",
      label: "World War II begins (1939)",
      sourceUrl: "https://encyclopedia.ushmm.org/content/en/timeline-event/holocaust/1939-1941/german-invasion-of-poland",
      precision: "day"
    },
    {
      date: "1945-07-16",
      label: "Nuclear era begins - Trinity (1945)",
      sourceUrl: "https://home.nps.gov/whsa/learn/historyculture/trinity-site.htm",
      precision: "day"
    },
    {
      date: "1961-04-12",
      label: "First human in space (1961)",
      sourceUrl: "https://science.nasa.gov/resource/yuri-gagarin-first-human-in-space/",
      precision: "day"
    },
    {
      date: "1972-01-01",
      label: "SRI remote-viewing research begins (1972)",
      sourceUrl: "https://www.cia.gov/readingroom/docs/CIA-RDP96-00791R000100150002-0.pdf",
      precision: "year"
    },
    {
      date: "1993-09-10",
      label: "The X-Files premieres (1993)",
      sourceUrl: "https://interviews.televisionacademy.com/shows/x-files-the",
      precision: "day"
    },
    {
      date: "2007-06-29",
      label: "First iPhone goes on sale (2007)",
      sourceUrl: "https://www.apple.com/newsroom/2007/06/28iPhone-Premieres-This-Friday-Night-at-Apple-Retail-Stores/",
      precision: "day"
    }
  ]);
  assert.match(source, /options\.grid === "x"/);
  assert.ok(result.every(marker => marker.label.endsWith(`(${marker.date.slice(0, 4)})`)));
  assert.deepEqual(compactLabels, ["WWII begins (1939)", "Trinity (1945)", "First human in space (1961)", "SRI remote viewing (1972)", "The X-Files (1993)", "First iPhone (2007)"]);
  assert.ok(groupedOverlays.every(overlay => JSON.stringify(overlay.extent) === JSON.stringify(groupedOverlays[0].extent)));
  assert.ok(groupedOverlays.every(overlay => JSON.stringify(overlay.labels) === JSON.stringify(result.map(marker => marker.label))));
  assert.deepEqual(largeCorpusExtent, [Date.UTC(1900, 0, 1), Date.UTC(1900, 0, 1) + 99999 * 86400000 + 1]);
  assert.deepEqual(filteredReportExtent, [Date.UTC(1939, 8, 1), Date.UTC(2007, 5, 29) + 1]);
  assert.doesNotMatch(source, /Math\.(?:min|max)\(\.\.\.dates/);
  for (let left = 0; left < desktopBoxes.length; left += 1) {
    for (let right = left + 1; right < desktopBoxes.length; right += 1) {
      assert.ok(desktopBoxes[left].right + 6 < desktopBoxes[right].left || desktopBoxes[left].left - 6 > desktopBoxes[right].right
        || desktopBoxes[left].bottom < desktopBoxes[right].top || desktopBoxes[left].top > desktopBoxes[right].bottom);
    }
  }
  assert.match(source, /class: "grid-line timeline-date-grid-line"/);
  assert.match(source, /historicalMarkers\.map\(marker => marker\.box\)/);
  assert.match(source, /const historicalMarkers = state\.config\.timelineCorrelativeMarkers[\s\S]*: \[\];/);
  assert.match(source, /state\.config\.type === "timeline" && state\.config\.timelineCorrelativeMarkers/);
  assert.match(source, /const timelineNodeLabelLayer = el\("g"[\s\S]*svg\.append\(timelineNodeLabelLayer\)/);
  assert.match(styles, /\.timeline-historical-marker \{[^}]*stroke: #985f5b;[^}]*stroke-dasharray:/);
  assert.match(source, /class: "timeline-historical-marker-leader"/);
  assert.match(styles, /\.timeline-historical-marker-leader \{[^}]*stroke: #985f5b;[^}]*stroke-width: 1;/);
  assert.match(source, /type === "timeline" \? "Correlative dates are human-curated context · Codex suggested The X-Files premiere"/);
});

test("the production timeline publishes every accepted historical review and excludes rejected dates", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.catalogFixture = loadCatalogFixture();
  const result = JSON.parse(vm.runInContext(`
    (() => {
      state.catalog = catalogFixture;
      state.catalog.documents.forEach(document => state.documentById.set(document.id, document));
      Object.assign(state.config, { allSources: true, sources: [] });
      const defaultEvents = timelineEventCandidates();
      state.config.timelineHistoricalCandidates = true;
      const expandedEvents = timelineEventCandidates();
      const reports = expandedEvents.filter(event => event.reportedDocument);
      const historical = expandedEvents.filter(event => event.historicalCandidateDocument);
      const months = groupTimelineEvents(expandedEvents, "month");
      const july2015 = months.find(group => group.startDate === "2015-07-01");
      return JSON.stringify({
        defaultHistorical: defaultEvents.filter(event => event.historicalCandidateDocument).length,
        defaultReports: defaultEvents.filter(event => event.reportedDocument).length,
        defaultPublished: defaultEvents.length - defaultEvents.filter(event => event.reportedDocument).length,
        reports: reports.length,
        historical: historical.length,
        earliestHistorical: historical.map(event => event.startDate).sort()[0],
        earliestReport: reports.map(event => event.startDate).sort()[0],
        published: expandedEvents.length - reports.length - historical.length,
        groups: months.length,
        july2015: { events: july2015.eventCount, reports: july2015.reportedEventCount, documents: july2015.documentCount }
      });
    })()
  `, context));

  const expectedReports = context.catalogFixture.documents.filter(document =>
    document.engine === "structured-database-extract"
    && document.documentDate
    && document.reportedEventDateReview?.status === "published"
    && (document.source === "UPDB-MUFON" || document.reportedEventDateReview.method === "analyst-review")
  );
  const expectedHistorical = context.catalogFixture.documents.map(document =>
    vm.runInContext("historicalTimelineCandidate", context)(document)
  ).filter(Boolean);
  const analystReviews = context.catalogFixture.documents.filter(document =>
    document.reportedEventDateReview?.method === "analyst-review"
  );
  const reviewIds = Object.keys(JSON.parse(fs.readFileSync("data/reported_event_date_reviews.json", "utf8")).documents).sort();
  const timelineBucket = vm.runInContext("timelineBucket", context);
  const expectedMonths = new Set([
    ...expectedReports.map(document => [document.documentDate, document.documentDatePrecision, "published"]),
    ...expectedHistorical.map(event => [event.startDate, event.datePrecision, "candidate"]),
    ...context.catalogFixture.events.map(event => [event.startDate, event.datePrecision, "published"])
  ].map(([date, precision, provenance]) => [timelineBucket(date, "month", precision || "day"), provenance])
    .filter(([bucket]) => Boolean(bucket))
    .map(([bucket, provenance]) => `${bucket.period}:${bucket.key}:${provenance}`)).size;
  assert.equal(result.defaultHistorical, 0);
  assert.equal(result.defaultReports, expectedReports.length);
  assert.equal(result.defaultPublished, context.catalogFixture.events.length);
  assert.equal(result.reports, expectedReports.length);
  assert.equal(result.historical, expectedHistorical.length);
  assert.ok([0, 393].includes(analystReviews.length));
  if (analystReviews.length) {
    assert.equal(result.historical, 0);
    assert.equal(result.earliestReport, "1860-08-06");
    assert.equal(context.catalogFixture.documents.filter(document => document.reportedEventDateReview?.status === "excluded").length, 30);
    assert.deepEqual(analystReviews.map(document => document.id).sort(), reviewIds);
  } else {
    assert.equal(result.historical, 393);
    assert.equal(result.earliestHistorical, "1860-08-06");
    assert.deepEqual(expectedHistorical.map(event => event.historicalCandidateDocument.id).sort(), reviewIds);
  }
  assert.equal(result.published, context.catalogFixture.events.length);
  assert.equal(result.groups, expectedMonths);
  assert.deepEqual(result.july2015, { events: 1036, reports: 1036, documents: 1036 });
});

test("timeline grouping and correlative marker defaults survive saved views and PDF properties", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      state.config = presetConfig("default", "timeline");
      state.catalog = { sources: [], entities: [] };
      return JSON.stringify({ config: state.config, properties: Object.fromEntries(pdfGraphProperties()) });
    })()
  `, context));

  assert.equal(result.config.timelineGrouping, true);
  assert.equal(result.config.timelineGroupPeriod, "month");
  assert.equal(result.config.timelineCorrelativeMarkers, true);
  assert.equal(result.config.timelineHistoricalCandidates, false);
  assert.equal(result.config.timelineRelevanceCutoff, 250);
  assert.equal(result.config.timelineRecencyYear, 2000);
  assert.equal(result.config.limit, 500);
  assert.equal(result.properties["Group events"], "Yes");
  assert.equal(result.properties["Group by"], "Month");
  assert.equal(result.properties["Correlative date markers"], "Yes");
  assert.equal(result.properties["Screened unreviewed historical dates"], "No");
  assert.equal(result.properties["Relevance guide"], "Top 250");
  assert.equal(result.properties["Recency guide"], "2000–present");
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
  const renderDocumentSource = source.match(/function renderDocument\(\)[\s\S]*?\n\}/)?.[0] || "";
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
  assert.match(source, /class="document-source-link"[^>]*href="\$\{escapeHTML\(machineDataPathURL\(document\.canonicalPath \|\| document\.path\)\)\}"/);
  assert.match(source, /robustValueExtent\(matching, "words"\)/);
  assert.match(source, /const intensity = clampedScale\(document\.words, wordExtent, \[\.14, \.94\]\)/);
  assert.match(source, /documentSortKey: documentNaturalSortKey\(document\)/);
  assert.match(source, /\.sort\(compareDocumentBrowserRecords\)/);
  assert.doesNotMatch(renderDocumentSource, /localeCompare\([^\n]+numeric: true/);
  assert.match(source, /Every completed file/);
  assert.match(source, /document: renderDocument/);
});

test("document browser sorting preserves entity priority and natural title order", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify([
    { title: "File 10", entityCount: 1 },
    { title: "File 2", entityCount: 1 },
    { title: "File 20", entityCount: 3 }
  ].map(document => ({ ...document, documentSortKey: documentNaturalSortKey(document) }))
    .sort(compareDocumentBrowserRecords).map(document => document.title))`, context));

  assert.deepEqual(result, ["File 20", "File 2", "File 10"]);
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
        { id: "doc-a", source: "Collection A", sourceFamily: { id: "family-a" } },
        { id: "doc-b", source: "Collection B", sourceFamily: { id: "family-b" } }
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
      evidenceCount: 7, epistemicAdjustedEvidenceCount: 3.9, documentCount: 2, independentSourceFamilyCount: 2,
      documentIds: ["doc-a", "doc-b"],
      evidence: [{ documentId: "doc-a" }, { documentId: "doc-b" }],
      sourceMetrics: {
        "Collection A": { evidenceCount: 1, epistemicAdjustedEvidenceCount: .4, documentCount: 1, independentSourceFamilyCount: 1 },
        "Collection B": { evidenceCount: 6, epistemicAdjustedEvidenceCount: 3.5, documentCount: 1, independentSourceFamilyCount: 1 }
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
  assert.equal(result.edge.epistemicAdjustedEvidenceCount, .4);
  assert.equal(result.edge.documentCount, 1);
  assert.equal(result.edge.independentSourceFamilyCount, 1);
  assert.deepEqual(result.edge.documentIds, ["doc-a"]);
  assert.deepEqual(result.edge.evidence, [{ documentId: "doc-a" }]);
  assert.ok(result.filteredRadius < result.catalogRadius);
});

test("independent source-family counts stay distinct from raw documents and drive the minimum-family filter", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.catalog = {
      documents: [
        { id: "a", source: "One", sourceFamily: { id: "family-origin", status: "inferred" } },
        { id: "b", source: "Two", sourceFamily: { id: "family-origin", status: "inferred" } },
        { id: "c", source: "Two", sourceFamily: { id: "family-unknown-c", status: "unknown" } }
      ],
      entities: []
    };
    state.catalog.documents.forEach(document => state.documentById.set(document.id, document));
    Object.assign(state.config, { allSources: false, sources: ["One", "Two"], minIndependentSourceFamilies: 3, minConfidence: 0 });
    const raw = {
      id: "entity", name: "Example", category: "subject", classificationConfidence: 1,
      mentions: 5, documentCount: 3, documentIds: ["a", "b", "c"], evidence: [], sourceMetrics: {}
    };
    const filtered = filteredEntity(raw);
    JSON.stringify({ families: filtered.independentSourceFamilyCount, documents: filtered.documentCount, matches: entityMatches(raw) });
  `, context));

  assert.equal(result.families, 2);
  assert.equal(result.documents, 3);
  assert.equal(result.matches, false);
  assert.match(source, /numericEntity = \["independentSourceFamilyCount"/);
  assert.match(source, /Minimum independent source families/);
  assert.ok(JSON.parse(vm.runInContext("JSON.stringify(TABLE_FIELDS.entity)", context)).includes("independentSourceFamilyCount"));
});

test("minimum source-family filters are limited to entity-backed render paths", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    collectionNetwork: usesIndependentSourceFamilyFilter({ type: "network", nodeRole: "collection" }),
    entityNetwork: usesIndependentSourceFamilyFilter({ type: "network", nodeRole: "entity" }),
    eventTimeline: usesIndependentSourceFamilyFilter({ type: "timeline", timelineRole: "event" }),
    documentTimeline: usesIndependentSourceFamilyFilter({ type: "timeline", timelineRole: "document" }),
    entityTimeline: usesIndependentSourceFamilyFilter({ type: "timeline", timelineRole: "entity" }),
    categoryMatrix: usesIndependentSourceFamilyFilter({ type: "matrix", matrixColumns: "category" }),
    entityMatrix: usesIndependentSourceFamilyFilter({ type: "matrix", matrixColumns: "entity" }),
    entityTable: usesIndependentSourceFamilyFilter({ type: "table", tableRole: "entity" }),
    documentTable: usesIndependentSourceFamilyFilter({ type: "table", tableRole: "document" }),
    scatter: usesIndependentSourceFamilyFilter({ type: "scatter" })
  })`, context));

  assert.deepEqual(result, {
    collectionNetwork: false,
    entityNetwork: true,
    eventTimeline: false,
    documentTimeline: false,
    entityTimeline: true,
    categoryMatrix: false,
    entityMatrix: true,
    entityTable: true,
    documentTable: false,
    scatter: true
  });
  assert.match(source, /filtersByIndependentSourceFamilies \? `<div class="control"><label>Minimum independent source families/);
  assert.match(source, /if \(usesIndependentSourceFamilyFilter\(config\)\) addText\("Minimum source families"/);
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
    ["significant-books", "book", "Significant Books"],
    ["significant-terms", "subject", "Significant Terms"]
  ];

  for (const [id, category, title] of presets) {
    const config = JSON.parse(vm.runInContext(`JSON.stringify(presetConfig("${id}", "scatter"))`, context));
    assert.equal(config.type, "scatter");
    assert.equal(config.x, "entity");
    assert.equal(config.y, "epistemicAdjustedMentions");
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
  assert.equal(result.bars.y, "epistemicAdjustedMentions");
  assert.deepEqual(result.bars.categories, ["person"]);
  assert.equal(result.bars.title, "Evidence-weighted mentions by People");
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

  assert.equal(config.y, "epistemicAdjustedMentions");
  assert.equal(config.size, "independentDocumentCount");
  assert.equal(config.includeHighInflation, false);
});

test("automatic titles follow active entity categories, axes, and collections", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.config = presetConfig("significant-people", "scatter");
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
  assert.equal(result.refinedTitle, "Evidence-weighted mentions by Raw documents — People and Government Agencies — Army reports");
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
    scatter: "Evidence-weighted mentions by Documents",
    network: "Relationships",
    table: "All Entities",
    scopedScatter: "Evidence-weighted mentions by Documents — People",
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
  assert.equal(entity.epistemicAdjustedMentions, 42);
  assert.equal(entity.independentDocumentCount, 9);
  assert.equal(entity.inflationRate, 0);
  assert.equal(entity.documentInflationRate, 0);
  assert.equal(entity.inflationRisk, "low");
  assert.equal(entity.sourceMetrics.Archive.contextAdjustedMentions, 40);
  assert.equal(entity.sourceMetrics.Archive.epistemicAdjustedMentions, 40);
  assert.equal(entity.sourceMetrics.Archive.independentDocumentCount, 8);
});

test("legacy source concentration cannot restore a high-inflation entity to Significant People", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    state.config = presetConfig("significant-people", "scatter");
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
      epistemicAdjusted: entity.epistemicAdjustedMentions,
      rate: entity.inflationRate,
      documentRate: entity.documentInflationRate,
      risk: entity.inflationRisk,
      visible: entityMatches(entity)
    })
  `, context));

  assert.equal(result.adjusted, 34);
  assert.equal(result.epistemicAdjusted, 34);
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

test("entity inspection groups supporting documents by lineage and warns about derivative prominence", () => {
  const elements = {
    builderView: new FakeElement(), inspector: new FakeElement(), inspectorContent: new FakeElement()
  };
  elements.builderView.classList.add("inspector-collapsed");
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams, requestAnimationFrame() {} });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = { input: { repository: "ufo-files/machine-data", revision: "abc123" }, entities: [], documents: [] };
    ["a", "b", "c", "d"].forEach((id, index) => {
      const item = {
        id, title: "Coverage " + id.toUpperCase(), path: "Archive/" + id + ".txt", source: "Archive",
        sourceFamily: index < 3
          ? { id: "family-one", label: "Original interview", familyStatus: "inferred", status: "inferred", method: index ? "near_duplicate" : "chronological_precedence", confidence: .93, evidence: [{ signal: "near_duplicate_excerpt", detail: "Evidence excerpts are 94% text-similar", excerpt: "The same attributed account." }] }
          : { id: "family-four", label: "Coverage D", familyStatus: "unknown", status: "unknown", method: "unclassified", confidence: 0, evidence: [{ signal: "unclassified", detail: "No sufficiently strong lineage signal" }] }
      };
      state.catalog.documents.push(item); state.documentById.set(id, item);
    });
    inspectEntity({
      id: "entity", name: "Example account", category: "subject", classificationConfidence: 1,
      mentions: 8, contextAdjustedMentions: 8, independentDocumentCount: 4, independentSourceFamilyCount: 2,
      documentCount: 4, sourceCount: 1, inflationRate: 0, documentInflationRate: 0, inflationRisk: "low",
      reviewStatus: "evidence_backed", variants: ["Example account"], documentIds: ["a", "b", "c", "d"], evidence: []
    });
  `, context);

  assert.match(elements.inspectorContent.innerHTML, /Prominence warning:/);
  assert.match(elements.inspectorContent.innerHTML, /Supporting documents by likely lineage · 2 families/);
  assert.match(elements.inspectorContent.innerHTML, /Original interview/);
  assert.match(elements.inspectorContent.innerHTML, /Inferred/);
  assert.match(elements.inspectorContent.innerHTML, /Unknown/);
  assert.match(elements.inspectorContent.innerHTML, /Inspect source document ↗/);
  assert.match(elements.inspectorContent.innerHTML, /Evidence excerpts are 94% text-similar/);
  const sampledLineage = vm.runInContext(`lineageGroupsHTML(["a", "missing-document"])`, context);
  assert.match(sampledLineage, /Stored evidence sample by likely lineage · 1 of 2 documents/);
  assert.match(sampledLineage, /sample is not complete lineage accounting/);
});

test("book inspection places the author beneath the title", () => {
  const elements = { builderView: new FakeElement(), inspector: new FakeElement(), inspectorContent: new FakeElement() };
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams, requestAnimationFrame() {} });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`inspectEntity({
    name: "UFOs and Nukes", category: "book", authors: ["Robert Hastings"], contextAdjustedMentions: 7, mentions: 8,
    independentDocumentCount: 4, documentCount: 4, sourceCount: 2, inflationRate: 0, documentInflationRate: 0,
    inflationRisk: "low", reviewStatus: "curated", variants: ["UFOs and Nukes"], evidence: [], inflationSignals: {}
  })`, context);
  assert.match(elements.inspectorContent.innerHTML, /<h3>UFOs and Nukes<\/h3><p class="inspect-subtitle">Robert Hastings<\/p>/);
  assert.doesNotMatch(source, /BOOK_AUTHORS/);
});

test("an explicitly edited title remains custom until a preset is applied", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    Object.assign(state.config, { title: "My research view", titleMode: "custom", categories: ["person"] });
    syncAutomaticTitle();
    const preservedTitle = state.config.title;
    state.config = presetConfig("significant-places", "scatter");
    syncAutomaticTitle(true);
    JSON.stringify({ preservedTitle, presetTitle: state.config.title, titleMode: state.config.titleMode })
  `, context));

  assert.equal(result.preservedTitle, "My research view");
  assert.equal(result.presetTitle, "Significant Places");
  assert.equal(result.titleMode, "auto");
});

test("network layout preserves geometry while fitting within 90% of the canvas", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`
    (() => {
      const points = new Map(Array.from({ length: 60 }, (_, index) => [index, networkSeedPosition(index, 60, 900, 600, false)]));
      const before = [...points.values()].map(point => ({ ...point }));
      fitNetworkPositions(points, 900, 600);
      return JSON.stringify({ before, after: [...points.values()] });
    })()
  `, context));
  const positions = result.after;
  const xs = positions.map(point => point.x);
  const ys = positions.map(point => point.y);

  assert.ok(Math.min(...xs) >= 900 * .05 - .001);
  assert.ok(Math.max(...xs) <= 900 * .95 + .001);
  assert.ok(Math.min(...ys) >= 600 * .05 - .001);
  assert.ok(Math.max(...ys) <= 600 * .95 + .001);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 900 * .9) < .001 || Math.abs(Math.max(...ys) - Math.min(...ys) - 600 * .9) < .001);
  const originalRatio = (Math.max(...result.before.map(point => point.x)) - Math.min(...result.before.map(point => point.x))) /
    (Math.max(...result.before.map(point => point.y)) - Math.min(...result.before.map(point => point.y)));
  assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys)) - originalRatio) < .001);
});

test("network relationship evidence gives stronger edges shorter target lengths", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const targets = JSON.parse(vm.runInContext(`JSON.stringify([
    networkEdgeTargetLength({ evidenceCount: 25, epistemicAdjustedEvidenceCount: 1 }, [Math.log1p(1), Math.log1p(25)]),
    networkEdgeTargetLength({ evidenceCount: 1, epistemicAdjustedEvidenceCount: 25 }, [Math.log1p(1), Math.log1p(25)])
  ])`, context));
  assert.ok(targets[0] > targets[1]);
  assert.match(source, /closer links have more evidence · position is approximate/);
});

test("network edges use the same restrained rendering as relationship overlays", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(source, /class: "network-relationship-line mark"/);
  assert.match(source, /const strength = collectionMode \? edge\.evidenceCount : relationshipEvidenceCount\(edge\)/);
  assert.match(source, /Math\.min\(2, \.4 \+ Math\.sqrt\(strength\) \* \.22\)/);
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
  assert.deepEqual(savedConfig, {
    configVersion: 3,
    type: "timeline",
    x: "startDate",
    y: "mentionRank",
    size: "eventCount",
    color: "eventType",
    categories: ["date"],
    timelineGroupPeriod: "month",
    limit: 500,
    corroborationMetric: "independentDocumentCount",
    sourceFamilyPolicy: "ufo-files-source-family-policy/v1"
  });
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
  assert.equal(properties["Corroboration metric"], "Documents");
  assert.equal(properties["Source-family policy"], "ufo-files-source-family-policy/v1");
  assert.equal(properties["Minimum source families"], "1");
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
  assert.match(source, /width: 96, height: 96[\s\S]*qrBottom = qrBounds\.y \+ qrBounds\.height[\s\S]*propertiesY = Math\.max\(414, summaryY \+ 190, qrBottom \+ 16\)/);
  assert.match(source, /function addPDFCoverContinuationPage\(pdf\)[\s\S]*addPage\("letter", "portrait"\)[\s\S]*GRAPH PROPERTIES — CONTINUED/);
  assert.match(source, /rowY \+ rowHeight > 724[\s\S]*addPDFCoverFooter\(pdf\)[\s\S]*addPDFCoverContinuationPage\(pdf\)/);
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
  const overflowingCoverPages = vm.runInContext(`(() => {
    pdfExportTitle = () => "Overflow test";
    pdfProvenance = () => [];
    pdfGraphProperties = () => Array.from({ length: 48 }, (_, index) => ["Property " + index, "Value " + index]);
    const pdf = {
      pages: 1, addPage() { this.pages += 1; }, setFillColor() {}, rect() {}, setDrawColor() {},
      setLineWidth() {}, path() {}, fillStroke() {}, setFont() {}, setFontSize() {}, setTextColor() {},
      text() {}, textWithLink() {}, line() {}, splitTextToSize(value) { return [String(value)]; }
    };
    addPDFCover(pdf, new Date("2026-08-14T00:00:00Z"), "https://example.com", null, "M0 0 L1 0 L1 1 Z");
    return pdf.pages;
  })()`, context);
  assert.equal(overflowingCoverPages, 2, "overflowing cover properties continue onto a second cover page");
  const claimPDF = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const textNode = textContent => ({ textContent });
    const side = {
      querySelector(selector) { return textNode(selector === "strong" ? "Claim statement" : "Exact source excerpt"); }
    };
    const comparison = {
      querySelector(selector) {
        return textNode({ "header span": "Agreement", "header strong": "Repeats", "header small": "Published", ":scope > p": "Same proposition." }[selector] || "");
      },
      querySelectorAll() { return [side, side]; }
    };
    const record = {
      querySelector(selector) { return textNode(selector === "time" ? "2024-01-01" : selector === ".claim-statement" ? "Claim statement" : "Exact source excerpt"); }
    };
    document = {
      querySelectorAll(selector) {
        if (selector === "#tableView .claim-comparison") return Array.from({ length: 4 }, () => comparison);
        if (selector === "#tableView .claim-record") return Array.from({ length: 8 }, () => record);
        return [];
      }
    };
    state.config = { ...DEFAULT, type: "claims" };
    state.claimCatalog = { policy: { summary: "Exact evidence." }, entities: [] };
    let pages = 2, selectedPage = 2;
    const blockHeights = [];
    const pdf = {
      internal: { pageSize: { getWidth: () => 612, getHeight: () => 792 }, getCurrentPageInfo: () => ({ pageNumber: 2 }) },
      addPage() { pages += 1; }, getNumberOfPages: () => pages, setPage(page) { selectedPage = page; },
      setFillColor() {}, setDrawColor() {}, setLineWidth() {}, setFont() {}, setFontSize() {}, setTextColor() {}, text() {}, line() {},
      rect(_x, _y, _width, height) { if (height === 54 || height === 56) blockHeights.push(height); },
      splitTextToSize(value) { return [String(value)]; }, getTextWidth(value) { return String(value).length; }
    };
    drawPDFTableView(pdf, { x: 45, y: 112, width: 522, height: 180 });
    return { pages, selectedPage, comparisons: blockHeights.filter(height => height === 54).length, claims: blockHeights.filter(height => height === 56).length };
  })())`, context));
  assert.ok(claimPDF.pages > 2, "overflowing claim content adds continuation pages");
  assert.equal(claimPDF.selectedPage, 2, "graph-page footer rendering resumes on the original page");
  assert.equal(claimPDF.comparisons, 4, "every visible comparison is rendered");
  assert.equal(claimPDF.claims, 8, "every visible claim is rendered");
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
  assert.match(source, /pdfVectorChart\(\)[\s\S]*getComputedStyle\(node\)[\s\S]*styleProperties\.forEach[\s\S]*font-family", PDF_FONT_FAMILY[\s\S]*font-weight", Number\.parseInt[\s\S]*>= 600 \? "bold" : "normal"[\s\S]*node-label[\s\S]*timeline-historical-marker-label[\s\S]*stroke", "none"[\s\S]*paint-order", "normal"/);
  assert.match(source, /await pdf\.svg\(pdfVectorChart\(\), \{[\s\S]*width: chartBounds\.width - inset \* 2/);
  assert.match(source, /else if \(!\$\("#mapView"\)\.hidden\)[\s\S]*pdf\.addImage\(canvas\.toDataURL\("image\/png"\)/);
  assert.match(source, /querySelectorAll\("#solarLeaders \.solar-label-leader"\)[\s\S]*leader\.getAttribute\(attribute\)[\s\S]*pdf\.line\(/);
  assert.match(source, /else drawPDFTableView\(pdf/);
  assert.match(source, /querySelectorAll\("#tableView \.claim-comparison"\)/);
  assert.match(source, /Rationale: \$\{rationale\}/);
  assert.match(source, /function addPDFClaimContinuationPage\(pdf, section\)[\s\S]*pdf\.addPage\("letter"[\s\S]*CONTINUED/);
  assert.match(source, /const ensureSpace = \(height, section\)[\s\S]*addPDFClaimContinuationPage\(pdf, section\)[\s\S]*ensureSpace\(60, "Claim comparisons"\)[\s\S]*ensureSpace\(62, "Claim evidence"\)/);
  assert.match(source, /const originalPage = pdf\.internal\.getCurrentPageInfo[\s\S]*pdf\.setPage\(originalPage\)/);
  assert.match(source, /stage\.classList\.remove\("pdf-exporting"\)/);
  assert.match(source, /Catalog \$\{metadata\.get\("CATALOG GENERATED"\)\}/);
  assert.match(source, /Source \$\{metadata\.get\("SOURCE OF TRUTH"\)\}@\$\{metadata\.get\("SOURCE REVISION"\)\}/);
  assert.match(source, /const metadataCenterY = \(metadataTop \+ metadataBottom\) \/ 2[\s\S]*metadataCenterY - 8[\s\S]*metadataCenterY \+ 12/);
  assert.match(source, /chartWrap[\s\S]*chartRect\.width \/ chartRect\.height > 1\.25[\s\S]*landscape \? "landscape" : "portrait"/);
  assert.match(source, /const chartBounds = \{ x: 45, y: 112, width: pageWidth - 90, height: provenanceY - 190 \}/);
  assert.match(source, /const inset = 2/);
  assert.doesNotMatch(source, /window\.print\(\)|afterprint|pdf-printing/);
  assert.match(styles, /\.stage\.pdf-exporting \{ --paper: #fff; background: #fff; \}/);
  assert.match(styles, /\.stage\.pdf-exporting \.stage-tools \{ visibility: hidden; \}/);
  assert.doesNotMatch(styles, /\.stage\.pdf-exporting \.chart-wrap/);
  assert.match(styles, /\.stage\.pdf-exporting \.scatter-relationship-line \{ opacity: \.07 !important; \}/);
  assert.doesNotMatch(styles, /pdf-cover-render|pdf-stage-provenance|@media print|@page/);
});

test("shared public dossiers resolve embedded Craft classes with labels and immutable source links", async () => {
  const location = { hash: "" };
  const context = vm.createContext({
    location, URL, URLSearchParams,
    btoa: value => Buffer.from(value, "binary").toString("base64"), atob: value => Buffer.from(value, "base64").toString("binary"),
    escape, unescape, encodeURIComponent, decodeURIComponent
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.catalogFixture = loadCatalogFixture();
  const result = JSON.parse(await vm.runInContext(`(async () => {
    state.catalog = catalogFixture;
    catalogFixture.documents.forEach(document => state.documentById.set(document.id, document));
    const payload = {
      schema: PUBLIC_DOSSIER_SCHEMA,
      catalogRevision: catalogFixture.input.revision,
      graphConfiguration: { type: "network" },
      records: { documents: [], events: [], entities: [], relationships: [], crafts: [{ id: "craft-class-egg" }] }
    };
    location.hash = "#dossier=" + encodeURIComponent(encodePublicPayload(payload));
    const dossier = await publicDossierFromHash(catalogFixture, "2026-08-08T00:00:00Z");
    return JSON.stringify({ graphType: dossier.graphConfiguration.type, record: dossier.records.crafts[0] });
  })()`, context));

  assert.equal(result.graphType, "network");
  assert.equal(result.record.id, "craft-class-egg");
  assert.equal(result.record.label, "Egg");
  assert.ok(result.record.sourceLinks.length > 0);
  assert.ok(result.record.sourceLinks.every(link => /^https:\/\/github\.com\/ufo-files\/machine-data\/blob\//.test(link.url)));
});

test("Craft dossier records retain their displayed class label", () => {
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify(dossierRecord("crafts", {
    id: "craft-class-egg", name: "Egg", observations: [{ documentId: "doc-egg" }]
  }))`, context));

  assert.equal(result.id, "craft-class-egg");
  assert.equal(result.label, "Egg");
});

test("Species dossier records retain their displayed profile label", () => {
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify(dossierRecord("species", {
    id: "species-class-pleiadians", name: "Pleiadians", observations: [{ documentId: "doc-pleiadians" }]
  }))`, context));

  assert.equal(result.id, "species-class-pleiadians");
  assert.equal(result.label, "Pleiadians");
});

test("Reptilians presentation is applied consistently without rewriting catalog provenance", () => {
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    catalog: applySpeciesPresentation({
      species: {
        taxonomyVersion: "1.1.0",
        classes: [{ id: "species-class-rigelians", classId: "rigelians", name: "Rigelians" }]
      }
    }),
    dossier: dossierRecord("species", {
      id: "species-class-rigelians", classId: "rigelians", name: "Rigelians", observations: []
    })
  })`, context));

  assert.equal(result.catalog.species.classes[0].name, "Reptilians");
  assert.equal(result.catalog.species.taxonomyVersion, "1.1.0");
  assert.equal(result.dossier.label, "Reptilians");
});

test("Craft classification review remains reachable when confidence filters remove observations", () => {
  const elements = {
    builderView: new FakeElement(), inspector: new FakeElement(), inspectorContent: new FakeElement()
  };
  const document = {
    querySelector: selector => elements[selector.slice(1)] || null,
    querySelectorAll: () => []
  };
  const context = vm.createContext({
    document, location: { hash: "" }, URLSearchParams,
    requestAnimationFrame: () => {}
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.config.minConfidence = .95;
    state.catalog = {
      counts: { craftReviewCandidates: 1 },
      craft: { reviewCandidates: [{
        phrase: "round object", decision: "ambiguous", reason: "review-required", count: 1, examples: []
      }] }
    };
    inspectCraftCandidates();
  `, context);

  assert.match(elements.inspectorContent.innerHTML, /Ambiguous and excluded phrases/);
  assert.match(elements.inspectorContent.innerHTML, /round object/);
  assert.match(elements.inspectorContent.innerHTML, /review-required/);
  assert.equal(elements.inspector.classList.contains("has-selection"), true);
});

test("Astronomy classification review remains reachable from the Milky Way view", () => {
  const elements = {
    builderView: new FakeElement(), inspector: new FakeElement(), inspectorContent: new FakeElement()
  };
  const document = {
    querySelector: selector => elements[selector.slice(1)] || null,
    querySelectorAll: () => []
  };
  const context = vm.createContext({
    document, location: { hash: "" }, URLSearchParams,
    requestAnimationFrame: () => {}
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { astronomyReviewCandidates: 2 },
      astronomy: { reviewCandidates: [{
        name: "Vega", decision: "ambiguous", reason: "missing-reviewed-astronomical-context", count: 2,
        examples: [{ documentId: "missing", excerpt: "Vega reviewed procurement." }]
      }] }
    };
    inspectAstronomyCandidates();
  `, context);

  assert.match(elements.inspectorContent.innerHTML, /Ambiguous and excluded name matches/);
  assert.match(elements.inspectorContent.innerHTML, /Vega/);
  assert.match(elements.inspectorContent.innerHTML, /missing-reviewed-astronomical-context/);
  assert.match(elements.inspectorContent.innerHTML, /excluded from the published astronomy totals/);
  assert.equal(elements.inspector.classList.contains("has-selection"), true);
});

test("case dossiers persist locally with versioned schema and timestamps", () => {
  const stored = new Map();
  const storage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.storage = storage;
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const dossier = emptyDossier({ schema: "catalog/v1", generatedAt: "2026-01-01T00:00:00Z", input: { repository: "ufo-files/machine-data", revision: "abc123" } }, { type: "scatter" }, "2026-01-02T00:00:00Z");
    dossier.scope = "Local scope";
    persistDossier(dossier, storage, "2026-01-03T00:00:00Z");
    const loaded = loadDossier(storage);
    return { schema: loaded.schema, scope: loaded.scope, createdAt: loaded.createdAt, updatedAt: loaded.updatedAt, revision: loaded.catalog.revision };
  })())`, context));

  assert.deepEqual(result, {
    schema: "ufo-files-case-dossier/v1", scope: "Local scope",
    createdAt: "2026-01-02T00:00:00Z", updatedAt: "2026-01-03T00:00:00Z", revision: "abc123"
  });
});

test("inspector dossier toggles retain graph state and cover every public record type", () => {
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.catalog = { schema: "catalog/v1", generatedAt: "2026-01-01T00:00:00Z", input: { revision: "current-revision" }, documents: [], events: [], entities: [], edges: [], sources: [] };
    state.config = { type: "map", zoom: 2, categories: ["location"] };
    state.dossier = emptyDossier(state.catalog, state.config, "2026-01-02T00:00:00Z");
    const graphBefore = JSON.stringify(state.config);
    const selection = { type: "entities", records: [{ id: "entity-1", label: "Entity", stance: "supporting", addedAt: "", sourceLinks: [] }] };
    toggleDossierSelection(selection, "contrary", "2026-01-03T00:00:00Z");
    const afterAdd = { graph: JSON.stringify(state.config), record: state.dossier.records.entities[0], snapshot: state.dossier.graphConfiguration };
    toggleDossierSelection(selection, "supporting", "2026-01-04T00:00:00Z");
    return { graphBefore, afterAdd, remaining: state.dossier.records.entities.length };
  })())`, context));

  assert.equal(result.afterAdd.graph, result.graphBefore);
  assert.equal(result.afterAdd.record.stance, "contrary");
  assert.equal(result.afterAdd.record.addedAt, "2026-01-03T00:00:00Z");
  assert.equal(result.afterAdd.snapshot.type, "map");
  assert.equal(result.afterAdd.snapshot.zoom, 2);
  assert.deepEqual(result.afterAdd.snapshot.categories, ["location"]);
  assert.deepEqual(result.afterAdd.snapshot.sources, []);
  assert.equal(result.remaining, 0);
  assert.match(source, /inspectEntity[\s\S]*dossierSelection\("entities"/);
  assert.match(source, /inspectEdge[\s\S]*dossierSelection\("relationships"/);
  assert.match(source, /inspectDocument[\s\S]*dossierSelection\("documents"/);
  assert.match(source, /inspectEvent[\s\S]*dossierSelection\("events"/);
});

test("public dossier links include only catalog identifiers and graph configuration", () => {
  const context = vm.createContext({
    location: { hash: "" }, URL, URLSearchParams,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary")
  });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const dossier = emptyDossier({ input: { revision: "rev-1" } }, { type: "network", relation: "investigated" }, "2026-01-02T00:00:00Z");
    dossier.scope = "SECRET SCOPE";
    dossier.researchQuestion = "SECRET QUESTION";
    dossier.annotations.unresolvedQuestions = ["SECRET NOTE"];
    dossier.review.rationale = "SECRET RATIONALE";
    dossier.records.entities.push({ id: "entity-1", label: "Public entity", stance: "contrary", addedAt: "2026-01-02T00:00:00Z", sourceLinks: [{ documentId: "doc-1", url: "https://example.test/doc-1" }] });
    const url = publicDossierURL(dossier);
    const encoded = decodeURIComponent(new URL(url).hash.split("dossier=")[1]);
    const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    return { url, payload };
  })())`, context));

  assert.equal(result.payload.schema, "ufo-files-public-dossier/v1");
  assert.deepEqual(result.payload.records.entities, [{ id: "entity-1" }]);
  assert.equal(result.payload.graphConfiguration.type, "network");
  assert.equal(result.payload.graphConfiguration.relation, "investigated");
  assert.deepEqual(result.payload.graphConfiguration.sources, []);
  assert.doesNotMatch(result.url, /SECRET|scope|researchQuestion|annotations|rationale|contrary|example\.test/i);
  assert.doesNotMatch(fs.readFileSync("app.js", "utf8").match(/async function exportCurrent\(\)[\s\S]*?\n\}/)?.[0] || "", /dossier|annotation|researchQuestion/);
});

test("dossier import validation rejects versions and reports stale stable IDs", () => {
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const dossier = emptyDossier({ input: { revision: "old" } }, {}, "2026-01-02T00:00:00Z");
    dossier.records.documents.push({ id: "present", label: "Present", stance: "supporting", addedAt: "2026-01-02T00:00:00Z", sourceLinks: [{ documentId: "present", url: "https://github.com/ufo-files/machine-data/blob/old/present.txt" }] });
    dossier.records.entities.push({ id: "removed", label: "Removed", stance: "context", addedAt: "2026-01-02T00:00:00Z", sourceLinks: [] });
    const catalog = { documents: [{ id: "present" }], events: [], entities: [], edges: [], sources: [] };
    const wrongVersion = { ...dossier, schema: "ufo-files-case-dossier/v2" };
    return {
      valid: validateDossierImport(dossier),
      wrong: validateDossierImport(wrongVersion),
      missing: missingDossierRecords(dossier, catalog),
      exported: JSON.parse(dossierJSON(dossier))
    };
  })())`, context));

  assert.equal(result.valid.valid, true);
  assert.equal(result.wrong.valid, false);
  assert.match(result.wrong.errors.join(" "), /Unsupported schema\/version/);
  assert.deepEqual(result.missing, [{ type: "entities", id: "removed", label: "Removed" }]);
  assert.equal(result.exported.catalog.revision, "old");
  assert.equal(result.exported.records.documents[0].id, "present");
  assert.equal(result.exported.records.documents[0].sourceLinks[0].url, "https://github.com/ufo-files/machine-data/blob/old/present.txt");
});

test("loaded dossier graph configurations are normalized before rendering", () => {
  const stored = new Map();
  const storage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  context.storage = storage;
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const dossier = emptyDossier(undefined, {}, "2026-01-02T00:00:00Z");
    dossier.graphConfiguration = {};
    storage.setItem(DOSSIER_STORAGE_KEY, JSON.stringify(dossier));
    const loaded = loadDossier(storage);
    return {
      type: loaded.graphConfiguration.type,
      categories: loaded.graphConfiguration.categories,
      sources: loaded.graphConfiguration.sources,
      title: dataAwareTitle(loaded.graphConfiguration)
    };
  })())`, context));

  assert.equal(result.type, "scatter");
  assert.deepEqual(result.categories, [
    "person", "government_agency", "organization", "location", "program", "subject", "book", "date"
  ]);
  assert.deepEqual(result.sources, []);
  assert.equal(typeof result.title, "string");
  assert.ok(result.title.length > 0);
});

test("dossier imports reject untrusted source-link schemes and hosts", () => {
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const dossier = emptyDossier(undefined, {}, "2026-01-02T00:00:00Z");
    const record = { id: "doc-1", label: "Source", stance: "supporting", addedAt: "2026-01-02T00:00:00Z", sourceLinks: [] };
    dossier.records.documents.push(record);
    const validateWith = url => {
      record.sourceLinks = [{ documentId: "doc-1", url }];
      return validateDossierImport(dossier);
    };
    return {
      javascript: validateWith("javascript:alert(1)"),
      lookalike: validateWith("https://github.com.evil.test/ufo-files/machine-data/blob/rev/doc.txt"),
      trusted: validateWith("https://github.com/ufo-files/machine-data/blob/rev/doc.txt")
    };
  })())`, context));

  assert.equal(result.javascript.valid, false);
  assert.equal(result.lookalike.valid, false);
  assert.match(result.javascript.errors.join(" "), /trusted HTTPS machine-data source links/);
  assert.equal(result.trusted.valid, true);
});

test("adding records retains the dossier's captured revision and graph configuration", () => {
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    state.catalog = { schema: "catalog/v1", generatedAt: "2026-02-01T00:00:00Z", input: { revision: "current" }, documents: [], events: [], entities: [], edges: [], sources: [] };
    state.config = { ...DEFAULT, type: "map" };
    state.dossier = emptyDossier({ input: { revision: "original" } }, { ...DEFAULT, type: "timeline" }, "2026-01-02T00:00:00Z");
    toggleDossierSelection({ type: "entities", records: [{ id: "entity-1", label: "Entity", stance: "supporting", addedAt: "", sourceLinks: [] }] }, "context", "2026-02-02T00:00:00Z");
    return { revision: state.dossier.catalog.revision, type: state.dossier.graphConfiguration.type };
  })())`, context));

  assert.deepEqual(result, { revision: "original", type: "timeline" });
});

test("collection relationships keep stable endpoint IDs and display-name labels", () => {
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const edge = { source: "src-left", target: "src-right", relationship: "shared_entities", evidence: [] };
    return dossierRecord("relationships", edge, "Left collection ↔ Right collection");
  })())`, context));

  assert.equal(result.id, "src-left|shared_entities|src-right");
  assert.equal(result.source, "src-left");
  assert.equal(result.target, "src-right");
  assert.equal(result.label, "Left collection ↔ Right collection");
  assert.doesNotMatch(source.match(/function inspectCollectionEdge[\s\S]*?\n\}/)?.[0] || "", /source: left\?\.name|target: right\?\.name/);
});

test("temporary public dossiers cannot overwrite the saved local draft", () => {
  const stored = new Map();
  const localStorage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const context = vm.createContext({ localStorage, location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const local = emptyDossier(undefined, {}, "2026-01-01T00:00:00Z");
    local.scope = "Saved local work";
    persistDossier(local, localStorage, "2026-01-02T00:00:00Z");
    state.dossier = emptyDossier(undefined, {}, "2026-02-01T00:00:00Z");
    state.dossier.scope = "Shared reference edit";
    state.dossierIsPublicReference = true;
    persistDossier(state.dossier, localStorage, "2026-02-02T00:00:00Z");
    return JSON.parse(localStorage.getItem(DOSSIER_STORAGE_KEY));
  })())`, context));

  assert.equal(result.scope, "Saved local work");
  assert.equal(result.updatedAt, "2026-01-02T00:00:00Z");
});

test("dossier reports are deterministic, neutral, source-linked, and revision-specific", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const reports = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const dossier = emptyDossier({ schema: "catalog/v1", generatedAt: "2026-01-01T00:00:00Z", input: { repository: "ufo-files/machine-data", revision: "fixed-revision" } }, { type: "timeline", limit: 12 }, "2026-01-02T00:00:00Z");
    dossier.researchQuestion = "What does the selected record establish?";
    dossier.records.events.push({ id: "event-b", label: "Selected event", stance: "supporting", addedAt: "2026-01-02T00:00:00Z", sourceLinks: [{ documentId: "doc-a", url: "https://github.com/ufo-files/machine-data/blob/fixed-revision/doc-a.txt" }] });
    dossier.records.entities.push({ id: "entity-a", label: "Selected entity", stance: "context", addedAt: "2026-01-02T00:00:00Z", sourceLinks: [] });
    dossier.annotations.followUpTasks = ["Compare independent source records."];
    return [dossierReport(dossier), dossierReport(dossier)];
  })())`, context));

  assert.equal(reports[0], reports[1]);
  assert.match(reports[0], /neutrally lists public catalog records selected by an analyst/i);
  assert.match(reports[0], /Selection and classification do not establish the accuracy/i);
  assert.match(reports[0], /\[Selected event\]\(https:\/\/github\.com\/ufo-files\/machine-data\/blob\/fixed-revision\/doc-a\.txt\)/);
  assert.match(reports[0], /Source revision: `fixed-revision`/);
  assert.match(reports[0], /Selected entity — Entity; stable ID/);
  assert.doesNotMatch(reports[0], /— Entitie;/);
  assert.match(reports[0], /"type": "timeline"/);
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

test("Signals renders a corpus-only logarithmic spectrum with evidence-backed peaks", () => {
  const elements = {
    chart: new FakeElement(), chartWrap: new FakeElement(), tableView: new FakeElement(),
    legend: new FakeElement(), resultSummary: new FakeElement(), graphKicker: new FakeElement(),
    policySummary: new FakeElement(), emptyState: new FakeElement()
  };
  const document = {
    createElementNS: () => new FakeElement(),
    querySelector: selector => elements[selector.slice(1)] || null,
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { documents: 3 }, entities: [], events: [], sources: [{ name: "Skinwalker" }, { name: "Other" }],
      signals: { observations: [
        { id: "signal-a", frequencyHz: 1600000000, frequencyLabel: "1.6 GHz", originalPhrase: "1.6 GHz", documentId: "a", source: "Skinwalker", excerpt: "A 1.6 GHz signal was discussed.", entityIds: [], eventIds: [] },
        { id: "signal-b", frequencyHz: 1600000000, frequencyLabel: "1.6 GHz", originalPhrase: "1.6", unitProvenance: "contextual-microwave-band", documentId: "b", source: "Skinwalker", excerpt: "A microwave signal appeared in the 1.6.", entityIds: [], eventIds: [] },
        { id: "signal-c", frequencyHz: 1420000000, frequencyLabel: "1.42 GHz", originalPhrase: "1420 MHz", documentId: "c", source: "Other", excerpt: "The text names 1420 MHz.", entityIds: [], eventIds: [] }
      ] }
    };
    Object.assign(state.config, VIEW_DEFAULTS.signals, { type: "signals", allSources: true, sources: [] });
    renderSignals();
  `, context);

  const peakLayer = elements.chart.children.find(node => node.attributes.class === "signal-peaks");
  assert.equal(vm.runInContext('TYPES.filter(type => type.id === "signals").length', context), 1);
  assert.equal(peakLayer.children.length, 2);
  assert.ok(peakLayer.children.every(node => node.children.some(child => child.attributes.class === "signal-peak-line")));
  const peakNodes = peakLayer.children.map(node => node.children.find(child => child.attributes.class === "signal-peak-node"));
  assert.deepEqual(peakNodes.map(node => node.attributes["data-mentions"]), ["1", "2"]);
  assert.ok(Number(peakNodes[0].attributes["fill-opacity"]) < Number(peakNodes[1].attributes["fill-opacity"]));
  assert.ok(Number(peakNodes[0].attributes.r) < Number(peakNodes[1].attributes.r));
  assert.match(elements.resultSummary.textContent, /2 normalized frequencies · 3 mentions · 3 documents/);
  assert.match(elements.legend.innerHTML, /Node size \+ shade: mentions/);
  assert.match(elements.legend.innerHTML, /Peak height: mentions/);
  assert.match(vm.runInContext('dataAwareTitle({ ...DEFAULT, ...VIEW_DEFAULTS.signals, type: "signals" })', context), /Radio Frequencies in the Corpus/);
  assert.doesNotMatch(source, /Math\.sqrt\(value \/ maximum\)/);
  assert.match(source, /labelPlacements = new Map\(\), labelsByTier/);
  assert.match(source, /item\.frequencyLabel\.length \* labelSize \* \.3/);
  assert.match(source, /Math\.sqrt\(item\.mentionCount\)/);
  assert.doesNotMatch(source, /Math\.sqrt\(item\.documentCount\)/);
  assert.match(source, /const maximum = Math\.max\(\.\.\.items\.map\(item => item\.mentionCount\), 1\)/);
  assert.match(source, /py = y\(item\.mentionCount\)/);
  assert.match(source, />Corpus frequency mentions</);
  assert.match(source, /GHz from microwave-band context/);
  assert.match(source, /"species", "signals", "coverage"/);
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.signal-peak-line \{[^}]*stroke-width: 1;/);
  assert.match(styles, /\.signal-peak-node \{[^}]*stroke-width: 2;/);
  assert.match(styles, /\.signal-peak-node \{[^}]*fill: var\(--ink\);/);
});

test("Craft is always available and renders relatively sized nodes without illustrations", () => {
  const elements = {
    chart: new FakeElement(), chartWrap: new FakeElement(), tableView: new FakeElement(),
    legend: new FakeElement(), resultSummary: new FakeElement(), graphKicker: new FakeElement(),
    policySummary: new FakeElement(), emptyState: new FakeElement()
  };
  const document = {
    createElementNS: () => new FakeElement(),
    querySelector: selector => elements[selector.slice(1)] || null,
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { documents: 2 }, input: { revision: "rev" }, entities: [], events: [], sources: [{ name: "Example" }],
      craft: {
        taxonomyVersion: "1.1.0",
        classes: [
          { id: "craft-class-orb", classId: "orb", name: "Orb / sphere", description: "Sphere", observationCount: 1 },
          { id: "craft-class-triangle", classId: "triangle", name: "Triangle", description: "Triangle", observationCount: 1, visualEvidence: [{ feature: "corner_lights", observationIds: ["obs-b"] }] }
        ],
        observations: [
          { id: "obs-a", classId: "orb", originalPhrase: "spherical object", matchType: "explicit", confidence: .98, documentId: "a", source: "Example", segment: 1, witnessType: "pilot", excerpt: "A spherical object 10 meters in diameter.", entityIds: [], eventIds: [], measurements: [{ id: "m-a", kind: "diameter", axis: "width", originalText: "10 meters in diameter", normalizedMeters: 10, conversionFactor: 1, conversionApplied: false, reportedAs: "direct", axisMethod: "reported-diameter-used-for-width" }] },
          { id: "obs-c", classId: "orb", originalPhrase: "glowing orb", matchType: "reviewed_synonym", confidence: .9, documentId: "a", source: "Example", segment: 3, witnessType: "civilian", excerpt: "A glowing orb.", entityIds: [], eventIds: [], measurements: [] },
          { id: "obs-b", classId: "triangle", originalPhrase: "black triangle", matchType: "explicit", confidence: .98, documentId: "a", source: "Example", segment: 2, witnessType: "civilian", excerpt: "A black triangle.", entityIds: [], eventIds: [], measurements: [] }
        ]
      }
    };
    Object.assign(state.config, VIEW_DEFAULTS.craft, { type: "craft", craftSize: "observationCount", allSources: true, sources: [] });
    renderCraft();
  `, context);

  const nodes = elements.chart.children.filter(node => node.attributes.class === "craft-node mark");
  const text = nodes.flatMap(node => node.children).map(child => child.textContent).filter(Boolean).join(" ");
  assert.equal(vm.runInContext("DEFAULT.type", context), "scatter");
  assert.equal(vm.runInContext('TYPES.some(type => type.id === "craft")', context), true);
  assert.equal(vm.runInContext('TYPES.filter(type => type.id === "craft").length', context), 1);
  assert.equal(nodes.length, 2);
  assert.match(text, /ORB \/ SPHERE 1 docs · 2 obs/);
  assert.doesNotMatch(text, /W 10 m|H —/);
  assert.ok(nodes.every(node => node.children.some(child => child.attributes.class === "craft-node-circle")));
  assert.ok(nodes.every(node => !node.children.some(child => child.tagName === "image" || child.attributes.class === "craft-icon")));
  assert.ok(Number(nodes[0].attributes["data-node-radius"]) > Number(nodes[1].attributes["data-node-radius"]));
  assert.equal(nodes[0].children.find(child => child.attributes.class === "craft-node-circle").attributes.fill, "#111");
  assert.ok(Number(nodes[0].children.find(child => child.attributes.class === "craft-node-circle").attributes["fill-opacity"]) > Number(nodes[1].children.find(child => child.attributes.class === "craft-node-circle").attributes["fill-opacity"]));
  assert.equal(nodes[0].children.find(child => child.attributes.class === "craft-class-label").attributes.fill, "#111");
  assert.equal(nodes[1].children.find(child => child.attributes.class === "craft-metric-label").attributes.fill, "#111");
  const relationshipLayer = elements.chart.children.find(node => node.attributes.class === "craft-relationship-layer");
  assert.equal(relationshipLayer.children.length, 1);
  assert.equal(relationshipLayer.children[0].attributes["data-shared-documents"], "1");
  assert.match(elements.legend.innerHTML, /Shared source documents/);
  assert.match(elements.legend.innerHTML, /Node size \+ shade: Classified observations/);
  assert.doesNotMatch(elements.legend.innerHTML, /illustration|Orthographic|Lower|Middle|Higher/i);
});

test("Species keeps the corpus-backed organic network as an alternate layout", () => {
  const elements = {
    chart: new FakeElement(), chartWrap: new FakeElement(), tableView: new FakeElement(),
    legend: new FakeElement(), resultSummary: new FakeElement(), graphKicker: new FakeElement(),
    policySummary: new FakeElement(), emptyState: new FakeElement()
  };
  const document = {
    createElementNS: () => new FakeElement(),
    querySelector: selector => elements[selector.slice(1)] || null,
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { documents: 2 }, input: { revision: "rev" }, entities: [], events: [], sources: [{ name: "Example" }],
      species: {
        taxonomyVersion: "1.0.0",
        categories: [{ id: "human", label: "Human extraterrestrial races" }, { id: "reptilian", label: "Reptilian races" }],
        classes: [
          { id: "species-class-pleiadians", classId: "pleiadians", name: "Pleiadians", category: "human", categoryLabel: "Human extraterrestrial races" },
          { id: "species-class-draconians", classId: "draconians", name: "Draconians (Dracs)", category: "reptilian", categoryLabel: "Reptilian races" }
        ],
        observations: [
          { id: "species-a", classId: "pleiadians", originalPhrase: "Pleiadians", matchType: "reviewed_name", confidence: .98, documentId: "a", source: "Example", segment: 1, excerpt: "Pleiadians and Draconians were named.", entityIds: [], eventIds: [] },
          { id: "species-b", classId: "pleiadians", originalPhrase: "Pleiadian", matchType: "reviewed_name", confidence: .98, documentId: "b", source: "Example", segment: 1, excerpt: "A Pleiadian account.", entityIds: [], eventIds: [] },
          { id: "species-c", classId: "draconians", originalPhrase: "Draconians", matchType: "reviewed_name", confidence: .98, documentId: "a", source: "Example", segment: 1, excerpt: "Pleiadians and Draconians were named.", entityIds: [], eventIds: [] }
        ]
      }
    };
    Object.assign(state.config, VIEW_DEFAULTS.species, { type: "species", speciesLayout: "organic", speciesSize: "observationCount", allSources: true, sources: [] });
    renderSpecies();
  `, context);

  const nodes = elements.chart.children.filter(node => node.attributes.class === "species-node mark");
  const text = nodes.flatMap(node => node.children).map(child => child.textContent).filter(Boolean).join(" ");
  assert.equal(vm.runInContext('TYPES.filter(type => type.id === "species").length', context), 1);
  assert.equal(nodes.length, 2);
  assert.match(text, /PLEIADIANS 2 docs · 2 obs/);
  assert.ok(Number(nodes[0].attributes["data-node-radius"]) > Number(nodes[1].attributes["data-node-radius"]));
  assert.deepEqual(nodes.map(node => node.attributes["data-category"]).sort(), ["human", "reptilian"]);
  const relationshipLayer = elements.chart.children.find(node => node.attributes.class === "species-relationship-layer");
  assert.equal(relationshipLayer.children.length, 1);
  assert.equal(relationshipLayer.children[0].attributes["data-shared-documents"], "1");
  assert.equal(elements.chart.children.some(node => ["species-group-label", "species-group-rule"].includes(node.attributes.class)), false);
  assert.match(elements.legend.innerHTML, /Shared source documents/);
  assert.match(elements.resultSummary.textContent, /2 corpus-mentioned profiles/);
});

test("Species defaults to a mention-ordered vector lineup with explicit height provenance", () => {
  const elements = {
    chart: new FakeElement(), chartWrap: new FakeElement(), tableView: new FakeElement(),
    legend: new FakeElement(), resultSummary: new FakeElement(), graphKicker: new FakeElement(),
    policySummary: new FakeElement(), emptyState: new FakeElement()
  };
  const document = {
    createElementNS: () => new FakeElement(),
    querySelector: selector => elements[selector.slice(1)] || null,
    querySelectorAll: () => []
  };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      counts: { documents: 2 }, input: { revision: "rev" }, entities: [], events: [], sources: [{ name: "Example" }],
      species: {
        taxonomyVersion: "1.0.0",
        categories: [{ id: "human", label: "Human extraterrestrial races" }, { id: "zeta_grey", label: "Zeta / Grey races" }],
        classes: [
          { id: "species-class-pleiadians", classId: "pleiadians", name: "Pleiadians", category: "human", categoryLabel: "Human extraterrestrial races", physicalHeight: { minFeet: 5.75, maxFeet: 8, representativeFeet: 6.875, label: "5′9″–8′", basis: "Combined range" }, appearanceEvidence: [{ id: "appearance-a", source: "Example", observationId: "species-a", documentId: "a", excerpt: "Tall Pleiadian.", descriptors: ["tall"] }] },
          { id: "species-class-greys", classId: "greys", name: "The Grey Races", category: "zeta_grey", categoryLabel: "Zeta / Grey races", physicalHeight: { minFeet: 3.5, maxFeet: 4.5, representativeFeet: 4, label: "3′6″–4′6″", basis: "Combined range" } }
        ],
        observations: [
          { id: "species-a", classId: "pleiadians", originalPhrase: "Pleiadians", matchType: "reviewed_name", confidence: .98, documentId: "a", source: "Example", segment: 1, excerpt: "Pleiadians and Greys were named.", entityIds: [], eventIds: [] },
          { id: "species-b", classId: "pleiadians", originalPhrase: "Pleiadian", matchType: "reviewed_name", confidence: .98, documentId: "b", source: "Example", segment: 1, excerpt: "A Pleiadian account.", entityIds: [], eventIds: [] },
          { id: "species-c", classId: "greys", originalPhrase: "Greys", matchType: "reviewed_name", confidence: .98, documentId: "a", source: "Example", segment: 1, excerpt: "Pleiadians and Greys were named.", entityIds: [], eventIds: [] },
          { id: "species-d", classId: "greys", originalPhrase: "Grey", matchType: "reviewed_name", confidence: .98, documentId: "b", source: "Example", segment: 2, excerpt: "A Grey account.", entityIds: [], eventIds: [] },
          { id: "species-e", classId: "greys", originalPhrase: "Greys", matchType: "reviewed_name", confidence: .98, documentId: "b", source: "Example", segment: 3, excerpt: "More Greys.", entityIds: [], eventIds: [] }
        ]
      }
    };
    Object.assign(state.config, VIEW_DEFAULTS.species, { type: "species", allSources: true, sources: [] });
    renderSpecies();
  `, context);

  const characters = elements.chart.children.filter(node => node.attributes.class?.startsWith("species-lineup-character mark"));
  const pleiadian = characters.find(node => node.attributes["data-class-id"] === "pleiadians");
  const grey = characters.find(node => node.attributes["data-class-id"] === "greys");
  const mentionOrder = [...characters].sort((left, right) => Number(left.attributes["data-mention-rank"]) - Number(right.attributes["data-mention-rank"]));
  assert.equal(vm.runInContext("DEFAULT.speciesLayout", context), "lineup");
  assert.equal(characters.length, 4);
  assert.deepEqual(mentionOrder.map(node => node.attributes["data-class-id"]), ["greys", "pleiadians", "bledsoe_red_eyed_being", "skinny_bob"]);
  assert.deepEqual(mentionOrder.map(node => node.attributes["data-observation-count"]), ["3", "2", "0", "0"]);
  assert.deepEqual(characters.filter(node => Number(node.attributes["data-observation-count"])).map(node => node.attributes["data-class-id"]), ["pleiadians", "greys"]);
  assert.ok(characters.every((node, index) => !index
    || Number(characters[index - 1].attributes["data-display-height"]) >= Number(node.attributes["data-display-height"])));
  assert.equal(pleiadian.attributes["data-scaled"], "true");
  assert.equal(grey.attributes["data-scaled"], "true");
  assert.ok(Number(pleiadian.attributes["data-display-height"]) > Number(grey.attributes["data-display-height"]));
  assert.equal(grey.children.find(child => child.attributes.class === "species-lineup-height-label").textContent, "3′6″–4′6″");
  assert.equal(pleiadian.children.find(child => child.attributes.class === "species-lineup-height-label").textContent, "5′9″–8′");
  assert.equal(grey.children.find(child => child.attributes.class === "species-lineup-metric").textContent, "3 MENTIONS");
  assert.equal(pleiadian.children.find(child => child.attributes.class === "species-lineup-metric").textContent, "2 MENTIONS");
  assert.equal(characters.some(node => node.children.some(child => child.attributes.class === "species-lineup-index")), false);
  const pleiadianFigure = pleiadian.children.find(child => child.attributes.class === "species-lineup-figure");
  const greyFigure = grey.children.find(child => child.attributes.class === "species-lineup-figure");
  const pleiadianBackground = pleiadian.children.find(child => child.attributes.class === "species-lineup-figure-background");
  const pleiadianFocus = pleiadian.children.find(child => child.attributes.class === "species-lineup-focus");
  assert.match(pleiadianFigure.attributes.href, /assets\/species\/vector\/species-pleiadians\.svg$/);
  assert.match(greyFigure.attributes.href, /species-generic-figure\.svg$/);
  assert.equal(vm.runInContext(`speciesSupportsBespokeFigure({ appearanceEvidence: [{ descriptors: ["reptilian"] }] })`, context), false);
  assert.equal(vm.runInContext(`speciesSupportsBespokeFigure({ appearanceEvidence: [{ descriptors: ["reptilian", "slit pupils"] }] })`, context), true);
  assert.equal(vm.runInContext(`speciesSupportsBespokeFigure({ classId: "rigelians", appearanceEvidence: [{ descriptors: ["reptilian"] }], illustrationDescriptors: ["bipedal", "forward-facing eyes", "multiple fingers"] })`, context), true);
  assert.equal(vm.runInContext(`speciesSupportsBespokeFigure({ classId: "unknown", illustrationDescriptors: ["prominent eyes"] })`, context), false);
  assert.equal(pleiadian.attributes["data-figure-kind"], "reference-grounded");
  assert.equal(grey.attributes["data-figure-kind"], "generic-figure");
  assert.equal(pleiadian.attributes["data-appearance-evidence-count"], "1");
  assert.equal(grey.attributes["data-appearance-evidence-count"], "0");
  assert.match(pleiadianBackground.attributes.href, /assets\/species\/silhouette\/species-pleiadians\.svg$/);
  assert.equal(pleiadianBackground.attributes.x, pleiadianFigure.attributes.x);
  assert.equal(pleiadianBackground.attributes.y, pleiadianFigure.attributes.y);
  assert.equal(pleiadianBackground.attributes.width, pleiadianFigure.attributes.width);
  assert.equal(pleiadianBackground.attributes.height, pleiadianFigure.attributes.height);
  assert.equal(pleiadianBackground.attributes.filter, "url(#species-lineup-character-background)");
  assert.ok(pleiadian.children.indexOf(pleiadianBackground) < pleiadian.children.indexOf(pleiadianFocus));
  assert.ok(pleiadian.children.indexOf(pleiadianFocus) < pleiadian.children.indexOf(pleiadianFigure));
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.species-lineup-background-color\s*\{\s*flood-color:\s*var\(--paper\)/);
  assert.doesNotMatch(styles, /\.species-lineup-character\.is-unscaled[^}]*opacity/);
  assert.doesNotMatch(fs.readFileSync("app.js", "utf8"), /el\("feMorphology"/);
  assert.ok(elements.chart.children.some(node => node.attributes.class === "species-lineup-wall"));
  assert.match(elements.legend.innerHTML, /most-mentioned first/);
  assert.match(elements.legend.innerHTML, /reviewed representative height/);
  assert.match(elements.legend.innerHTML, /Height unstated: neutral 6′ placeholder/);
  assert.match(elements.legend.innerHTML, /1 faceless generic figures/);
  assert.equal(elements.chartWrap.classList.contains("species-lineup-mode"), true);
});

test("Species lineup uses a scrollable canvas and square-root mention scaling", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const layout = JSON.parse(vm.runInContext(`JSON.stringify(speciesLineupLayout(
    Array.from({ length: 15 }, (_, index) => ({ classId: "species-" + index, observationCount: (index + 1) ** 2 })),
    390,
    440,
    "observationCount"
  ), (_key, value) => value instanceof Map ? [...value] : value)`, context));

  assert.ok(layout.canvasWidth > 390);
  assert.equal(layout.height, 440);
  assert.equal(layout.positions.length, 15);
  assert.ok(layout.positions.every(([, position]) => position.displayHeight >= 76 && position.displayHeight <= layout.plotHeight));
  assert.ok(layout.positions.at(-1)[1].displayHeight > layout.positions[0][1].displayHeight);
});

test("Species physical-height lineup uses a fixed twelve-foot ceiling", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    ceiling: SPECIES_LINEUP_HEIGHT_CEILING_FEET,
    layout: speciesLineupLayout([
      { classId: "six-feet", physicalHeight: { representativeFeet: 6 } },
      { classId: "twelve-feet", physicalHeight: { representativeFeet: 12 } },
      { classId: "over-ceiling", physicalHeight: { representativeFeet: 14 } },
      { classId: "height-unstated" }
    ], 800, 520, "physicalHeight")
  }, (_key, value) => value instanceof Map ? [...value] : value)`, context));

  assert.equal(result.ceiling, 12);
  const positions = new Map(result.layout.positions);
  assert.equal(positions.get("six-feet").displayHeight, result.layout.plotHeight / 2);
  assert.equal(positions.get("twelve-feet").displayHeight, result.layout.plotHeight);
  assert.equal(positions.get("over-ceiling").displayHeight, result.layout.plotHeight);
  assert.equal(positions.get("height-unstated").displayHeight, result.layout.plotHeight / 2);
  assert.equal(positions.get("height-unstated").isScaled, false);
});

test("Species lineup supports signed spacing between figures", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const classes = Array.from({ length: 15 }, (_, index) => ({ classId: "species-" + index, observationCount: 1 }));
    return {
      defaultSpacing: DEFAULT.speciesSpacing,
      compact: speciesLineupLayout(classes, 390, 440, "observationCount", -40),
      normal: speciesLineupLayout(classes, 390, 440, "observationCount", 0),
      open: speciesLineupLayout(classes, 390, 440, "observationCount", 40)
    };
  })(), (_key, value) => value instanceof Map ? [...value] : value)`, context));

  assert.equal(result.defaultSpacing, 0);
  assert.equal(result.compact.itemWidth, 52);
  assert.equal(result.normal.itemWidth, 92);
  assert.equal(result.open.itemWidth, 132);
  assert.ok(result.compact.canvasWidth < result.normal.canvasWidth);
  assert.ok(result.open.canvasWidth > result.normal.canvasWidth);
  assert.match(source, /Spacing between species[\s\S]*min="-80" max="160"/);
});

test("Species lineup selects chart-height-specific vector drawings without bypassing evidence gating", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    anunnaki: speciesLineupAsset("anunnaki", false, "physicalHeight"),
    greyBespoke: speciesLineupAsset("greys", false, "physicalHeight"),
    greyGeneric: speciesLineupAsset("greys", true, "physicalHeight"),
    lyran: speciesLineupAsset("lyrans", false, "physicalHeight"),
    mantis: speciesLineupAsset("mantis_beings", false, "physicalHeight"),
    menInBlack: speciesLineupAsset("men_in_black", false, "physicalHeight"),
    mothman: speciesLineupAsset("mothman", false, "physicalHeight"),
    arcturianGeneric: speciesLineupAsset("arcturians", true, "physicalHeight"),
    tallGeneric: speciesLineupAsset("renegade_pleiadians", true, "physicalHeight"),
    mentionGeneric: speciesLineupAsset("renegade_pleiadians", true, "observationCount"),
    reptilian: speciesLineupAsset("rigelians", false, "physicalHeight")
  })`, context));

  assert.match(result.anunnaki, /display\/species-anunnaki\.svg$/);
  assert.match(result.greyBespoke, /display\/species-grey-races\.svg$/);
  assert.match(result.greyGeneric, /species-generic-figure\.svg$/);
  assert.match(result.lyran, /display\/species-lyrans\.svg$/);
  assert.match(result.mantis, /display\/species-mantis-beings\.svg$/);
  assert.match(result.menInBlack, /display\/species-men-in-black\.svg$/);
  assert.match(result.mothman, /display\/species-mothman\.svg$/);
  assert.match(result.arcturianGeneric, /display\/species-generic-figure-tall\.svg$/);
  assert.match(result.tallGeneric, /display\/species-generic-figure-tall\.svg$/);
  assert.match(result.mentionGeneric, /vector\/species-generic-figure\.svg$/);
  assert.match(result.reptilian, /display\/species-reptilians\.svg$/);
});

test("Species lineup aligns every illustration's visible ink to one baseline", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify([...SPECIES_LINEUP_INK_BOUNDS].map(([classId, bounds]) => {
    const displayHeight = 240;
    const baseline = 500;
    const frame = speciesLineupImageFrame({ x: 300, displayHeight }, classId, baseline);
    return {
      classId,
      visibleTop: frame.y + bounds.top / SPECIES_LINEUP_CANVAS_HEIGHT * frame.height,
      visibleBottom: frame.y + bounds.bottom / SPECIES_LINEUP_CANVAS_HEIGHT * frame.height,
      visibleHeight: (bounds.bottom - bounds.top) / SPECIES_LINEUP_CANVAS_HEIGHT * frame.height
    };
  }))`, context));

  assert.equal(result.length, 19);
  result.forEach(item => {
    assert.ok(Math.abs(item.visibleBottom - 500) < 1e-9, `${item.classId} reaches the baseline`);
    assert.ok(Math.abs(item.visibleTop - 260) < 1e-9, `${item.classId} retains its graphed height`);
    assert.ok(Math.abs(item.visibleHeight - 240) < 1e-9, `${item.classId} uses its ink bounds`);
  });
});

test("Species organic layout is deterministic and bounded at the mobile breakpoint", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const expression = `JSON.stringify(speciesOrganicLayout(
    Array.from({ length: 15 }, (_, index) => ({ classId: "species-" + index })),
    [{ source: "species-0", target: "species-1", documentCount: 3 }],
    390,
    440
  ), (_key, value) => value instanceof Map ? [...value] : value)`;
  const layout = JSON.parse(vm.runInContext(expression, context));
  const repeated = JSON.parse(vm.runInContext(expression, context));

  assert.deepEqual(layout, repeated);
  assert.equal(layout.height, 440);
  assert.ok(layout.positions.every(([, position]) => position.x >= 70 && position.x <= 320 && position.y >= 25 && position.y <= 380));
  assert.ok(new Set(layout.positions.map(([, position]) => Math.round(position.y))).size > 10);
});

test("Species organic desktop layout uses the canvas and centers visual weight", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const classes = Array.from({ length: 15 }, (_, index) => ({ classId: "species-" + index }));
    const weights = new Map(classes.map((item, index) => [item.classId, index < 3 ? 625 - index * 100 : 64]));
    const layout = speciesOrganicLayout(classes, [
      { source: "species-0", target: "species-1", documentCount: 3 },
      { source: "species-1", target: "species-2", documentCount: 2 }
    ], 1200, 620, weights);
    const positions = [...layout.positions.values()];
    const total = classes.reduce((sum, item) => sum + weights.get(item.classId), 0);
    return {
      spanX: Math.max(...positions.map(item => item.x)) - Math.min(...positions.map(item => item.x)),
      spanY: Math.max(...positions.map(item => item.y)) - Math.min(...positions.map(item => item.y)),
      centerX: positions.reduce((sum, item, index) => sum + item.x * weights.get(classes[index].classId), 0) / total,
      centerY: positions.reduce((sum, item, index) => sum + item.y * weights.get(classes[index].classId), 0) / total
    };
  })())`, context));

  assert.ok(result.spanX >= 880);
  assert.ok(result.spanY >= 430);
  assert.ok(Math.abs(result.centerX - 600) < 1);
  assert.ok(Math.abs(result.centerY - 310) < 1);
});

test("Craft mobile layout fits all nodes inside the available graph window", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const layout = JSON.parse(vm.runInContext("JSON.stringify(craftRadialLayout(19, 390, 440))", context));
  assert.equal(layout.positions.length, 19);
  assert.equal(layout.height, 440);
  assert.ok(layout.positions.every(position => position.x > 0 && position.x < 390 && position.y > 0 && position.y < 440));
});

test("Craft node and label footprint is centered in the graph window", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const positions = JSON.parse(vm.runInContext(`JSON.stringify(centerCraftPositions(
    craftRadialLayout(10, 1000, 600).positions,
    [30, 25, 20, 18, 16, 14, 12, 10, 9, 7],
    1000,
    600
  ))`, context));
  const radii = [30, 25, 20, 18, 16, 14, 12, 10, 9, 7];
  const left = Math.min(...positions.map((position, index) => position.x - Math.max(radii[index], 72)));
  const right = Math.max(...positions.map((position, index) => position.x + Math.max(radii[index], 72)));
  const top = Math.min(...positions.map((position, index) => position.y - radii[index]));
  const bottom = Math.max(...positions.map((position, index) => position.y + radii[index] + 48));
  assert.ok(Math.abs((left + right) / 2 - 500) < .001);
  assert.ok(Math.abs((top + bottom) / 2 - 300) < .001);
});

test("Craft icon briefs cover the active native SVG drawing set", () => {
  const briefs = JSON.parse(fs.readFileSync("data/craft_icon_briefs.json", "utf8"));
  const icons = fs.readdirSync("assets/craft-icons/high").filter(name => name.endsWith(".svg"));
  assert.equal(briefs.profiles.length, 19);
  assert.equal(new Set(briefs.profiles.map(profile => profile.classId)).size, 19);
  assert.equal(icons.length, 19);
  assert.ok(briefs.profiles.every(profile => Array.isArray(profile.required) && Array.isArray(profile.forbidden)));
  const brightStar = briefs.profiles.find(profile => profile.classId === "skywatcher_bright_star");
  assert.ok(brightStar.required.includes("one unmistakable radiant star"));
  assert.ok(brightStar.forbidden.includes("tetrahedron"));
  assert.ok(icons.every(name => {
    const source = fs.readFileSync(`assets/craft-icons/high/${name}`, "utf8");
    return /<svg [^>]*viewBox="0 0 [0-9]+ [0-9]+"/.test(source) && !/<image\b/.test(source);
  }));
});

test("Species lineup assets are traced SVG paths rather than embedded rasters", () => {
  const assets = fs.readdirSync("assets/species/vector").filter(name => name.endsWith(".svg"));
  const displayAssets = fs.readdirSync("assets/species/vector/display").filter(name => name.endsWith(".svg"));
  const silhouettes = fs.readdirSync("assets/species/silhouette").filter(name => name.endsWith(".svg"));
  assert.equal(assets.length, 19);
  assert.equal(displayAssets.length, 11);
  assert.deepEqual(silhouettes, assets);
  const paths = [
    ...assets.flatMap(name => [`assets/species/vector/${name}`, `assets/species/silhouette/${name}`]),
    ...displayAssets.map(name => `assets/species/vector/display/${name}`)
  ];
  paths.forEach(path => {
    const source = fs.readFileSync(path, "utf8");
    assert.match(source, /<svg\b[^>]*viewBox="0 0 1024\.000000 1536\.000000"/);
    assert.match(source, /<path\b/);
    assert.doesNotMatch(source, /<image\b|data:image\//);
  });
});

test("Craft filters preserve measurement availability and dossier-stable class identifiers", () => {
  const context = vm.createContext({ location: { hash: "" }, URL, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`(() => {
    state.catalog = {
      input: { repository: "ufo-files/machine-data", revision: "rev" }, entities: [], events: [],
      craft: { classes: [{ id: "craft-class-disc", classId: "disc", name: "Disc", description: "Disc" }], observations: [
        { id: "obs", classId: "disc", confidence: .98, source: "Example", documentId: "doc", witnessType: "pilot", date: "2004-11-14", entityIds: [], eventIds: [], excerpt: "disc-shaped object", measurements: [
          { id: "w", axis: "width", normalizedMeters: 12 }, { id: "h", axis: "height", normalizedMeters: 3 }
        ] }
      ] }
    };
    state.documentById.set("doc", { id: "doc", path: "Example/report.txt" });
    Object.assign(state.config, VIEW_DEFAULTS.craft, { type: "craft", allSources: true, sources: [], craftDimensions: "both", craftWitnessType: "pilot", craftDateFrom: "2004-01-01", craftDateTo: "2004-12-31" });
    const item = filteredCraftClasses()[0];
    const record = dossierSelection("crafts", item).records[0];
    return JSON.stringify({ count: item.observationCount, widthN: item.dimensions.width.n, heightN: item.dimensions.height.n, record });
  })()`, context));

  assert.equal(result.count, 1);
  assert.equal(result.widthN, 1);
  assert.equal(result.heightN, 1);
  assert.equal(result.record.id, "craft-class-disc");
  assert.match(result.record.sourceLinks[0].url, /ufo-files\/machine-data\/blob\/rev\/Example\/report\.txt/);
});

test("coverage cells distinguish sparse, unknown, zero, and filtered denominators", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const catalog = {
      documents: [
        { id: "d1", source: "Alpha", format: "ocr", words: 100, documentDate: "1952-07-14" },
        { id: "d2", source: "Alpha", format: "ocr", words: 300 },
        { id: "d3", source: "Beta", format: "transcript", words: 600, documentDate: "1965-03-01" }
      ],
      entities: [
        { category: "location", name: "Roswell", geo: { lat: 33.4, lon: -104.5 }, documentIds: ["d1"] },
        { category: "location", name: "Unmapped", documentIds: ["d2"] },
        { category: "subject", name: "Radar", documentIds: ["d1", "d2"] }
      ],
      events: [{ eventType: "incident", documentIds: ["d1"] }, { eventType: "hearing", documentIds: ["d3"] }]
    };
    const base = { ...DEFAULT, type: "coverage", coverageRows: "time", coverageColumns: "geography", allSources: true, sources: [] };
    const cell = (matrix, row, column) => matrix.cells.find(item => item.row.label === row && item.column.label === column).scopes[0];
    const documents = coverageMatrixData(catalog, { ...base, coverageMetric: "documentCount" });
    const words = coverageMatrixData(catalog, { ...base, coverageMetric: "wordCount" });
    const dated = coverageMatrixData(catalog, { ...base, coverageMetric: "datedDocumentCount" });
    const filtered = coverageMatrixData(catalog, { ...base, coverageMetric: "documentCount", allSources: false, sources: ["Alpha"] });
    return {
      covered: cell(documents, "1950s", "Roswell"),
      unknown: cell(documents, "Unknown date", "Unknown geography"),
      insufficient: cell(documents, "1960s", "Roswell"),
      word: cell(words, "1950s", "Roswell"),
      dated: cell(dated, "1950s", "Roswell"),
      filtered: cell(filtered, "1950s", "Roswell")
    };
  })())`, context));

  assert.equal(result.covered.status, "covered");
  assert.deepEqual(result.covered.contributingIds, ["d1"]);
  assert.equal(result.covered.denominator, 1);
  assert.equal(result.covered.ratio, 1);
  assert.equal(result.unknown.status, "unknown");
  assert.equal(result.insufficient.status, "insufficient");
  assert.deepEqual([result.word.numerator, result.word.denominator], [100, 100]);
  assert.deepEqual([result.dated.numerator, result.dated.denominator], [1, 1]);
  assert.equal(result.filtered.denominator, 1);
});

test("topical completeness distinguishes corpus metadata from case assessments", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const catalog = {
      documents: [
        { id: "d1", source: "Alpha", format: "ocr", documentDate: "1952-07-14" },
        { id: "d2", source: "Beta", format: "transcript" }
      ],
      entities: [{ category: "location", geo: { lat: 1, lon: 2 }, documentIds: ["d1"] }],
      events: [{ eventType: "incident", documentIds: ["d1"] }],
      cases: [
        { caseKind: "observation", resolutionStatus: "unassessed", dataCompleteness: { sensorModality: true } },
        { caseKind: "institutional_record", resolutionStatus: "resolved", dataCompleteness: {} }
      ],
      craftObservations: [
        { measurements: [{ axis: "width" }] },
        { measurements: [] }
      ]
    };
    const items = topicalCompleteness(catalog, { claims: [
      { review: { status: "published" } }, { review: { status: "candidate" } }
    ] });
    return { items, html: topicalCompletenessHTML(items) };
  })())`, context));

  const byId = Object.fromEntries(result.items.map(item => [item.id, item]));
  assert.deepEqual([byId.dated.numerator, byId.dated.denominator], [1, 2]);
  assert.deepEqual([byId["case-sensors"].numerator, byId["case-sensors"].denominator], [1, 1]);
  assert.deepEqual([byId.assessments.numerator, byId.assessments.denominator], [1, 2]);
  assert.deepEqual([byId.claims.numerator, byId.claims.denominator], [1, 2]);
  assert.match(result.html, /Measures this corpus and its structured metadata/);
  assert.match(result.html, /Attributed assessment recorded separately from the report/);
});

test("default collection by category coverage normalizes within each collection row", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const catalog = {
      documents: [
        { id: "a-person", source: "Alpha", format: "ocr", words: 10 },
        { id: "a-subject", source: "Alpha", format: "ocr", words: 10 },
        { id: "b-subject", source: "Beta", format: "ocr", words: 10 }
      ],
      entities: [
        { category: "person", documentIds: ["a-person"] },
        { category: "subject", documentIds: ["a-subject", "b-subject"] }
      ], events: []
    };
    const matrix = coverageMatrixData(catalog, { ...DEFAULT, type: "coverage" });
    const cell = (row, column) => matrix.cells.find(item => item.row.label === row && item.column.label === column).scopes[0];
    return { alphaPerson: cell("Alpha", "person"), betaSubject: cell("Beta", "subject") };
  })())`, context));

  assert.deepEqual([result.alphaPerson.numerator, result.alphaPerson.denominator, result.alphaPerson.ratio], [1, 2, 0.5]);
  assert.deepEqual([result.betaSubject.numerator, result.betaSubject.denominator, result.betaSubject.ratio], [1, 1, 1]);
  assert.deepEqual(result.alphaPerson.denominatorDocumentIds, ["a-person", "a-subject"]);
});

test("coverage comparison and gap report preserve cohort-specific denominators and stable IDs", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const catalog = {
      documents: [
        { id: "alpha-dated", source: "Alpha", format: "ocr", words: 10, documentDate: "1952-01-01" },
        { id: "alpha-undated", source: "Alpha", format: "ocr", words: 20 },
        { id: "beta-dated", source: "Beta", format: "transcript", words: 30, documentDate: "1961-01-01" }
      ], entities: [], events: []
    };
    const config = { ...DEFAULT, type: "coverage", coverageRows: "time", coverageColumns: "format", coverageMetric: "documentCount", coverageCompare: true,
      coverageACollection: "Alpha", coverageAFrom: "", coverageATo: "", coverageBCollection: "Beta", coverageBFrom: "", coverageBTo: "", allSources: true, sources: [] };
    const matrix = coverageMatrixData(catalog, config);
    const cell = matrix.cells.find(item => item.row.label === "1950s" && item.column.label === "ocr");
    const report = coverageGapReportRows(catalog, config);
    return { denominators: cell.scopes.map(scope => scope.denominator), ids: cell.scopes[0].contributingIds, firstStatus: report[0].status, reportHasIds: report.some(row => row.contributingDocumentIds.includes("alpha-dated")) };
  })())`, context));

  assert.deepEqual(result.denominators, [1, 0]);
  assert.deepEqual(result.ids, ["alpha-dated"]);
  assert.match(result.firstStatus, /Not enough|No records/);
  assert.equal(result.reportHasIds, true);
});

test("coverage gap reports include scoped buckets omitted from the visual matrix", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const documents = Array.from({ length: 12 }, (_, index) => ({
      id: \`d-\${index}\`, source: "Alpha", format: "ocr", words: 10, documentDate: "1952-01-01"
    }));
    const entities = documents.map((document, index) => ({
      category: "location", name: \`Place \${index}\`, geo: { lat: index, lon: index }, documentIds: [document.id]
    }));
    const catalog = { documents, entities, events: [] };
    const config = { ...DEFAULT, type: "coverage", coverageRows: "time", coverageColumns: "geography", coverageMetric: "documentCount", allSources: true, sources: [] };
    const matrix = coverageMatrixData(catalog, config);
    const report = coverageGapReportRows(catalog, config);
    return { visualColumns: matrix.columns.length, exportedColumns: new Set(report.map(row => row.column)).size };
  })())`, context));

  assert.equal(result.visualColumns, 10);
  assert.equal(result.exportedColumns, 12);
});

test("coverage axes reject single-valued self-crosses while retaining multi-valued co-occurrence", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const single = normalizeCoverageAxes({ ...DEFAULT, coverageRows: "collection", coverageColumns: "collection" });
    const multi = normalizeCoverageAxes({ ...DEFAULT, coverageRows: "geography", coverageColumns: "geography" });
    state.config = { ...DEFAULT, type: "coverage", coverageRows: "time", coverageColumns: "collection" };
    renderControls = () => {};
    commitConfig = () => {};
    updateConfig("coverageRows", "collection");
    return {
      single,
      multi,
      swapped: { rows: state.config.coverageRows, columns: state.config.coverageColumns },
      timeColumns: coverageColumnDimensions("time"),
      geographyColumns: coverageColumnDimensions("geography")
    };
  })())`, context));

  assert.equal(result.single.coverageRows, "collection");
  assert.equal(result.single.coverageColumns, "category");
  assert.equal(result.multi.coverageColumns, "geography");
  assert.deepEqual(result.swapped, { rows: "collection", columns: "time" });
  assert.equal(result.timeColumns.includes("time"), false);
  assert.equal(result.geographyColumns.includes("geography"), true);
});

test("coverage comparison cells keep deltas and statuses in a dedicated metadata stack", () => {
  const elements = {
    chart: new FakeElement(), chartWrap: new FakeElement(), tableView: new FakeElement(), legend: new FakeElement(),
    resultSummary: new FakeElement(), graphKicker: new FakeElement(), policySummary: new FakeElement()
  };
  const document = { querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext(`
    state.catalog = {
      documents: [{ id: "a", source: "Alpha", format: "ocr", words: 10, documentDate: "1952-01-01" }],
      entities: [{ category: "location", name: "Place", geo: { lat: 1, lon: 1 }, documentIds: ["a"] }],
      events: [], sources: [{ name: "Alpha" }]
    };
    Object.assign(state.config, VIEW_DEFAULTS.coverage, { type: "coverage", coverageCompare: true });
    renderCoverage();
  `, context);

  assert.match(elements.tableView.innerHTML, /coverage-cell[^\"]*is-comparison/);
  assert.match(elements.tableView.innerHTML, /<span class="coverage-cell-meta"><em>Δ [^<]+<\/em><i>[^<]+<\/i><\/span>/);
  const styles = fs.readFileSync("styles.css", "utf8");
  assert.match(styles, /\.coverage-cell\.is-comparison \{[^}]*min-height:\s*96px/);
  assert.doesNotMatch(styles.match(/\.coverage-cell-meta i \{([^}]+)\}/)?.[1] || "", /position:\s*absolute/);
});

test("single-cohort coverage cells omit redundant corpus and status copy", () => {
  const context = vm.createContext({ location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  const html = vm.runInContext('coverageScopeHTML({ ratio: 0, numerator: 0, denominator: 12, status: "zero" }, "")', context);

  assert.equal(html, '<span class="coverage-value coverage-value-zero"><strong>0%</strong><small>0 / 12</small></span>');
  assert.doesNotMatch(source, /coverageScopeHTML\(scope, matrix\.scopes\[index\]\.label\)/);
});

test("PDF legends include coverage keys with distinct status swatches", () => {
  const statuses = ["covered", "zero", "insufficient", "unknown"];
  const labels = ["Covered", "No matching records", "Not enough coverage", "Unknown metadata"];
  const nodes = statuses.map((status, index) => ({
    textContent: labels[index], classList: { contains: value => value === "coverage-key" || value === status }
  }));
  let selector = "";
  const document = { querySelectorAll: value => (selector = value, nodes) };
  const operations = [];
  const pdf = {
    setFont() {}, setFontSize() {}, setTextColor() {}, setFillColor(value) { operations.push(["fill", value]); },
    setDrawColor() {}, setLineDashPattern(pattern) { operations.push(["dash", ...pattern]); },
    getTextWidth(value) { return String(value).length * 4; }, rect(...args) { operations.push(["rect", ...args]); },
    text(value) { operations.push(["text", value]); }
  };
  const context = vm.createContext({ document, pdf, location: { hash: "" }, URLSearchParams });
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  vm.runInContext(source, context);
  vm.runInContext("drawPDFLegend(pdf, 50, 564)", context);

  assert.equal(selector, "#legend .legend-item, #legend .coverage-key");
  assert.deepEqual(operations.filter(operation => operation[0] === "text").map(operation => operation[1]), labels);
  assert.ok(operations.filter(operation => operation[0] === "rect").length > labels.length);
  assert.ok(operations.some(operation => operation[0] === "dash" && operation[1] === 2));
});

test("coverage dimensions, normalization, and comparison windows survive saved URL and PDF properties", () => {
  const source = fs.readFileSync("app.js", "utf8").split("$$('.step-heading')")[0];
  const location = { hash: "" };
  const context = vm.createContext({
    location, history: { replaceState(_state, _title, hash) { location.hash = hash; } }, URLSearchParams,
    btoa: value => Buffer.from(value, "binary").toString("base64"), atob: value => Buffer.from(value, "base64").toString("binary"),
    escape, unescape, encodeURIComponent, decodeURIComponent
  });
  vm.runInContext(source, context);
  vm.runInContext(`
    state.config = { ...DEFAULT, ...VIEW_DEFAULTS.coverage, type: "coverage", coverageRows: "geography", coverageColumns: "modality", coverageMetric: "datedDocumentCount", coverageCompare: true,
      coverageACollection: "Alpha", coverageAFrom: "1950-01-01", coverageATo: "1959-12-31", coverageBCollection: "Beta", coverageBFrom: "1960-01-01", coverageBTo: "1969-12-31" };
    persistHash();
  `, context);
  const restored = vm.createContext({ location: { hash: location.hash }, URLSearchParams, atob: value => Buffer.from(value, "base64").toString("binary"), escape, decodeURIComponent });
  vm.runInContext(source, restored);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({ config: state.config, properties: Object.fromEntries((state.catalog = { input: {} }, pdfGraphProperties())) })`, restored));

  assert.equal(result.config.type, "coverage");
  assert.equal(result.config.coverageRows, "geography");
  assert.equal(result.config.coverageColumns, "modality");
  assert.equal(result.config.coverageMetric, "datedDocumentCount");
  assert.equal(result.config.coverageCompare, true);
  assert.equal(result.config.coverageBTo, "1969-12-31");
  assert.equal(result.properties.Rows, "Geography");
  assert.match(result.properties["Cohort A"], /Alpha.*1950-01-01.*1959-12-31/);
  assert.match(result.properties.Interpretation, /not evidence/i);
});

test("Portuguese documents expose canonical and reviewed English links separately", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /document\.originalLanguage/);
  assert.match(source, /document\.translationReviewStatus/);
  assert.match(source, /machineDataPathURL\(document\.translationPath\)/);
  assert.match(source, /canonical.*English translation/);
  assert.match(fs.readFileSync("styles.css", "utf8"), /document-source-link \+ \.document-source-link/);
});
test("epistemic qualifier candidates are visible without changing graph semantics", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /function epistemicQualifierHTML/);
  assert.match(source, /Evidence weight adjusted/);
  assert.match(source, /do not remove text, suppress claims, or change raw graph counts/);
  assert.match(source, /qualifier candidate/);
  assert.match(source, /epistemicAdjustedMentions/);
  assert.match(source, /relationshipEvidenceCount/);
  assert.match(source, /\[\.\.\.dateEvidence, \.\.\.qualifierEvidence\]/);
  assert.match(source, /epistemicAdjustedEvidenceCount/);
});
