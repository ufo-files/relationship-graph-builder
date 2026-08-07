/* UFO Files Graph Builder — dependency-free, GitHub Pages compatible. */

const NS = "http://www.w3.org/2000/svg";
const CONFIG_VERSION = 2;
const ENTITY_CATEGORIES = ["person", "government_agency", "organization", "location", "program", "subject", "book", "date"];
const LABELS = {
  person: "People", government_agency: "Government agencies", organization: "Organizations",
  location: "Locations", program: "Programs", subject: "Subjects", book: "Books", date: "Dates",
  mentions: "Raw mentions", documentCount: "Raw documents", sourceCount: "Collections",
  contextAdjustedMentions: "Mentions", independentDocumentCount: "Documents",
  inflationRate: "Mention adjustment", documentInflationRate: "Potential prominence inflation", inflationRisk: "Prominence inflation risk", inflatedMentionCount: "Adjusted mentions", inflatedDocumentCount: "Adjusted documents",
  classificationConfidence: "Classification confidence", extractionConfidence: "Extraction confidence",
  words: "Words", documents: "Documents", segments: "Segments", bytes: "Source bytes",
  createdAt: "Cataloged at", documentDate: "Document date", startDate: "Event date", confidence: "Confidence", timelineLane: "Event sequence", durationMs: "Duration", source: "Collection", format: "Format",
  entity: "Entities", document: "Transcript files", name: "Name", title: "Title",
  category: "Entity type", reviewStatus: "Review status", engine: "Engine", path: "Path",
  table: "Table", collection: "Collections", shared_entities: "Shared entities"
};
const BOOK_AUTHORS = new Map(Object.entries({
  "Scientific Study of Unidentified Flying Objects": "Edward U. Condon",
  "Disclosure": "Steven M. Greer",
  "UFOs and Nukes": "Robert Hastings",
  "The Immortality Key": "Brian C. Muraresku",
  "Extraterrestrial Contact: The Evidence and Implications": "Steven M. Greer",
  "Unveiled Mysteries": "Godfré Ray King",
  "UFO of God": "Chris Bledsoe",
  "Time Loops": "Eric Wargo",
  "They Knew Too Much About Flying Saucers": "Gray Barker",
  "They Are Already Here: UFO Culture and Why We See Saucers": "Sarah Scoles",
  "The Tools": "Phil Stutz & Barry Michels",
  "The I AM Discourses": "Godfré Ray King",
  "The Day After Roswell": "Philip J. Corso & William J. Birnes",
  "Penetration": "Ingo Swann",
  "Le Matin des Magiciens": "Louis Pauwels & Jacques Bergier",
  "Flying Saucers from Outer Space": "Donald E. Keyhoe"
}));

function bookAuthor(item) {
  const supplied = item.author || item.authors || item.creator;
  return Array.isArray(supplied) ? supplied.join(" & ") : supplied || BOOK_AUTHORS.get(item.canonicalName || item.name) || "";
}
const TABLE_FIELDS = {
  entity: ["name", "category", "contextAdjustedMentions", "mentions", "inflationRate", "documentInflationRate", "inflationRisk", "independentDocumentCount", "documentCount", "sourceCount", "classificationConfidence", "extractionConfidence", "reviewStatus"],
  document: ["title", "source", "format", "words", "segments", "bytes", "createdAt", "engine", "durationMs", "path"],
  source: ["name", "documents", "words"]
};
const TYPES = [
  { id: "network", label: "Network", scope: "All", icon: "<circle cx='6' cy='8' r='3'/><circle cx='24' cy='4' r='3'/><circle cx='22' cy='16' r='3'/><path d='M9 7l12-2M9 10l10 5M23 7l-1 6'/>" },
  { id: "map", label: "Map", scope: "Locations", icon: "<circle cx='15.5' cy='10' r='8'/><path d='M7.5 10h16M15.5 2c3 3 3 13 0 16m0-16c-3 3-3 13 0 16'/>" },
  { id: "book", label: "Bookshelf", scope: "Books", icon: "<path d='M3 3h5v14H3zM9 5h4v12H9zM14 2h6v15h-6zM21 6h7v11h-7zM2 18h27'/>" },
  { id: "document", label: "Documents", scope: "All corpus files", icon: "<path d='M7 2h12l5 5v11H7zM19 2v5h5M11 11h9M11 14h9'/><path d='M4 5H2v15h17v-2'/>" },
  { id: "scatter", label: "Scatter", scope: "All", icon: "<path d='M3 2v16h25'/><circle cx='9' cy='13' r='2'/><circle cx='15' cy='9' r='2'/><circle cx='22' cy='5' r='2'/>" },
  { id: "bars", label: "Bars", scope: "All collections", icon: "<path d='M3 2v16h26M7 15h4V8H7zm8 0h4V4h-4zm8 0h4v-9h-4z'/>" },
  { id: "timeline", label: "Timeline", scope: "Documents + events", icon: "<path d='M3 10h25M8 5v10m7-7v7m8-12v12'/><circle cx='8' cy='10' r='2'/><circle cx='15' cy='10' r='2'/><circle cx='23' cy='10' r='2'/>" },
  { id: "matrix", label: "Matrix", scope: "Collections × entity types", icon: "<path d='M4 3h22v15H4zM11 3v15m8-15v15M4 8h22m-22 5h22'/>" },
  { id: "table", label: "Table", scope: "All", icon: "<path d='M3 3h25v15H3zM3 8h25M3 13h25M12 3v15'/>" }
];
const PRESETS = [
  {
    id: "default",
    label: "Default",
    config: null
  },
  {
    id: "significant-people",
    label: "Significant People",
    config: { type: "scatter", x: "entity", y: "contextAdjustedMentions", size: "independentDocumentCount", categories: ["person"], sources: [], includeHighInflation: false }
  },
  {
    id: "significant-places",
    label: "Significant Places",
    config: { type: "scatter", x: "entity", y: "contextAdjustedMentions", size: "independentDocumentCount", categories: ["location"], sources: [], includeHighInflation: false }
  },
  {
    id: "significant-terms",
    label: "Significant Terms",
    config: { type: "scatter", x: "entity", y: "contextAdjustedMentions", size: "independentDocumentCount", categories: ["subject"], sources: [], includeHighInflation: false }
  }
];
const DEFAULT = {
  configVersion: CONFIG_VERSION,
  type: "scatter", x: "independentDocumentCount", y: "contextAdjustedMentions", size: "independentDocumentCount", color: "category",
  categories: [...ENTITY_CATEGORIES], sources: [], allSources: true, relation: "all",
  includeHighInflation: true,
  minEvidence: 2, minConfidence: 0.95, limit: 50, labels: "top", aggregation: "source",
  relationshipLayer: "always", relationshipNeighbors: 1, relationshipNodeSize: "inherit", relationshipStrength: "subtle",
  nodeRole: "entity", timelineRole: "event", matrixColumns: "category",
  tableRole: "entity", tableColumns: ["name", "category", "mentions", "documentCount", "sourceCount"],
  tableSort: "mentions", tableDirection: "desc", tableSearch: "", documentSearch: "",
  labelSize: 12, zoom: 1, moonTransitSeconds: 5, title: "Mentions by Documents", titleMode: "auto"
};
const VIEW_DEFAULTS = {
  scatter: {},
  network: { nodeRole: "entity", size: "independentDocumentCount", color: "category" },
  map: { categories: ["location"], size: "contextAdjustedMentions", color: "intensity", labels: "top", limit: 50, moonTransitSeconds: 5 },
  book: { size: "contextAdjustedMentions", color: "intensity", labels: "all", limit: 20 },
  document: { size: "words", color: "source", labels: "top", documentSearch: "" },
  bars: { aggregation: "source", y: "words", color: "intensity" },
  timeline: { timelineRole: "event", x: "startDate", y: "timelineLane", size: "documentCount", color: "eventType", categories: ["date"], labels: "all", limit: 500, relationshipLayer: "always" },
  matrix: { matrixColumns: "category", color: "intensity" },
  table: { tableRole: "entity", tableColumns: ["name", "category", "mentions", "documentCount", "sourceCount"], tableSort: "mentions", tableDirection: "desc", tableSearch: "", limit: 60 }
};
const ENTITY_PRESET_DEFAULTS = {
  network: { nodeRole: "entity" },
  bars: { aggregation: "entity" },
  timeline: { timelineRole: "entity" },
  matrix: { matrixColumns: "entity" },
  table: { tableRole: "entity" }
};
const state = { catalog: null, config: loadConfig(), selected: null, documentById: new Map() };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function adjustedEntityMetric(metric) {
  return ({ mentions: "contextAdjustedMentions", documentCount: "independentDocumentCount" })[metric] || metric;
}

function migrateEntityProminenceConfig(config) {
  if (config.type === "scatter") {
    config.x = adjustedEntityMetric(config.x);
    config.y = adjustedEntityMetric(config.y);
    config.size = adjustedEntityMetric(config.size);
  } else if (config.type === "network" && config.nodeRole !== "collection") {
    config.size = adjustedEntityMetric(config.size);
  } else if (config.type === "bars" && config.aggregation === "entity") {
    config.y = adjustedEntityMetric(config.y);
  } else if (config.type === "timeline" && config.timelineRole === "entity") {
    config.y = adjustedEntityMetric(config.y);
    config.size = adjustedEntityMetric(config.size);
  } else if (["map", "book"].includes(config.type)) {
    config.size = adjustedEntityMetric(config.size);
  }
  config.configVersion = CONFIG_VERSION;
  return config;
}

function loadConfig() {
  try {
    const param = new URLSearchParams(location.hash.slice(1)).get("config");
    if (param) {
      const saved = JSON.parse(decodeURIComponent(escape(atob(param))));
      if (saved.allSources === undefined) saved.allSources = !saved.sources?.length;
      const config = { ...DEFAULT, ...saved };
      config.moonTransitSeconds = Math.min(10, Math.max(2, Number(config.moonTransitSeconds) || DEFAULT.moonTransitSeconds));
      if ((Number(saved.configVersion) || 0) < CONFIG_VERSION) migrateEntityProminenceConfig(config);
      if (saved.matrixColumns === "entity" && config.type !== "matrix") config.matrixColumns = DEFAULT.matrixColumns;
      const legacySignificantCategory = {
        "Significant People": "person",
        "Significant Places": "location",
        "Significant Terms": "subject"
      }[saved.title];
      const isLegacySignificantView = legacySignificantCategory
        && saved.type === "scatter"
        && saved.x === "entity"
        && ["mentions", "contextAdjustedMentions"].includes(saved.y)
        && saved.categories?.length === 1
        && saved.categories[0] === legacySignificantCategory;
      if (isLegacySignificantView) {
        Object.assign(config, {
          y: "contextAdjustedMentions",
          size: "independentDocumentCount",
          includeHighInflation: false
        });
      }
      if (!saved.titleMode) {
        const formerAutomaticTitles = new Set([
          "Evidence map", "Significant People", "Significant Places", "Significant Terms",
          "Collection coverage", "People and institutions", "Collection relationships",
          "Transcription activity", "Collections × entity types", "Archive entities"
        ]);
        config.titleMode = formerAutomaticTitles.has(saved.title) ? "auto" : "custom";
      }
      if (config.titleMode === "auto") config.title = dataAwareTitle(config);
      return config;
    }
  } catch (_) {}
  const config = { ...DEFAULT };
  config.title = dataAwareTitle(config);
  return config;
}

function persistHash() {
  const saved = Object.fromEntries(Object.entries(state.config).filter(([key, value]) => {
    if (key === "configVersion") return true;
    if (key === "title" && state.config.titleMode === "auto") return false;
    return !(key in DEFAULT) || JSON.stringify(value) !== JSON.stringify(DEFAULT[key]);
  }));
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(saved))));
  history.replaceState(null, "", `#config=${encodeURIComponent(encoded)}`);
}

function el(name, attrs = {}, text = "") {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
}

function formatNumber(value) {
  if (value == null) return "—";
  if (typeof value === "string" && value.trim() !== "" && Number.isNaN(Number(value))) return value;
  if (Number.isNaN(Number(value))) return "—";
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return Number(value).toLocaleString();
}

function label(value) {
  return LABELS[value] || String(value).replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, character => character.toUpperCase());
}

function entityScopeTitle(categories = []) {
  const selected = ENTITY_CATEGORIES.filter(category => categories.includes(category));
  if (!selected.length) return "No Entities";
  if (selected.length === ENTITY_CATEGORIES.length) return "Entities";
  const friendlyNames = { location: "Places", subject: "Terms" };
  const names = selected.map(category => friendlyNames[category] || titleCase(label(category)));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names[0]}, ${names[1]} + ${names.length - 2} More Types`;
}

function collectionScopeTitle(config) {
  if (config.allSources) return "";
  if (!config.sources.length) return " — No Collections";
  if (config.sources.length === 1) return ` — ${config.sources[0]}`;
  return ` — ${config.sources.length} Collections`;
}

function tableEntityScopeTitle(config) {
  const selectedCategories = ENTITY_CATEGORIES.filter(category => config.categories.includes(category));
  if (!selectedCategories.length) return "No Entities";
  const allCategories = selectedCategories.length === ENTITY_CATEGORIES.length;
  if (allCategories && config.allSources) return "All Entities";
  const friendlyNames = { location: "Places", subject: "Terms" };
  const categories = allCategories
    ? ["All Entities"]
    : selectedCategories.map(category => friendlyNames[category] || titleCase(label(category)));
  const collections = config.allSources ? [] : config.sources.length ? config.sources : ["No Collections"];
  const scope = [...categories, ...collections];
  if (scope.length === 1) return scope[0];
  if (scope.length === 2) return `${scope[0]} and ${scope[1]}`;
  return `${scope[0]}, ${scope[1]}, and ${scope.length - 2} more`;
}

function dataAwareTitle(config) {
  const entities = entityScopeTitle(config.categories);
  const defaultEntityScope = entities === "Entities";
  let title;
  if (config.type === "scatter") {
    title = config.x === "entity" && ["mentions", "contextAdjustedMentions"].includes(config.y)
      ? `Significant ${entities}`
      : `${label(config.y)} by ${label(config.x)}${defaultEntityScope ? "" : ` — ${entities}`}`;
  } else if (config.type === "network") {
    title = config.nodeRole === "collection" ? "Collection Relationships" : defaultEntityScope ? "Relationships" : `${entities} Relationships`;
  } else if (config.type === "map") {
    title = `${label(config.size)} — Mapped Locations`;
  } else if (config.type === "book") {
    title = `Top ${config.limit} Books Mentioned`;
  } else if (config.type === "document") {
    title = "Document Finder";
  } else if (config.type === "bars") {
    title = config.aggregation === "entity" ? `${label(config.y)} by ${entities}` : `${label(config.y)} by ${label(config.aggregation)}`;
  } else if (config.type === "timeline") {
    title = config.timelineRole === "event" ? "Event Sequence" : config.timelineRole === "entity" ? `${entities} Over Time` : "Dated Source Documents";
  } else if (config.type === "matrix") {
    title = `Collections × ${config.matrixColumns === "entity" ? "Entities" : "Entity Types"}`;
  } else {
    title = config.tableRole === "entity" ? tableEntityScopeTitle(config) : config.tableRole === "document" ? "Transcript Files" : "Collections";
  }
  const collectionScope = config.type === "table" && config.tableRole === "entity" ? "" : collectionScopeTitle(config);
  return `${title}${collectionScope}`;
}

function prominenceInflationFor(documentCount, independentDocumentCount) {
  const inflatedDocumentCount = Math.max(0, (documentCount || 0) - (independentDocumentCount || 0));
  const documentInflationRate = inflatedDocumentCount / Math.max(1, documentCount || 0);
  const inflationRisk = inflatedDocumentCount >= 2 && documentInflationRate >= .5
    ? "high"
    : inflatedDocumentCount >= 2 && documentInflationRate >= .2 ? "elevated" : "low";
  return { inflatedDocumentCount, documentInflationRate, inflationRisk };
}

function syncAutomaticTitle(force = false) {
  if (force) state.config.titleMode = "auto";
  if (state.config.titleMode === "custom") return;
  state.config.titleMode = "auto";
  state.config.title = dataAwareTitle(state.config);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function sourceIsSelected(sourceName, selectedSources, allSources) {
  return allSources || selectedSources.includes(sourceName);
}

function sourceSelectionConfig(selectedSources, availableSources) {
  const allSources = selectedSources.length === availableSources.length;
  return { sources: allSources ? [] : selectedSources, allSources };
}

function withSignificanceDefaults(entity) {
  const normalizeMetrics = metrics => {
    const documentCount = metrics.documentCount ?? metrics.documentIds?.length ?? 0;
    const independentDocumentCount = metrics.independentDocumentCount ?? documentCount;
    return {
      ...metrics,
      documentCount,
      contextAdjustedMentions: metrics.contextAdjustedMentions ?? metrics.mentions ?? 0,
      independentDocumentCount,
      inflatedMentionCount: metrics.inflatedMentionCount ?? 0,
      inflationRate: metrics.inflationRate ?? 0,
      ...prominenceInflationFor(documentCount, independentDocumentCount),
      inflationSignals: metrics.inflationSignals || { repeatedContextMentions: 0, administrativeMentions: 0, withinDocumentDuplicates: 0 }
    };
  };
  const sourceMetrics = Object.fromEntries(Object.entries(entity.sourceMetrics || {}).map(([source, metrics]) => [source, normalizeMetrics(metrics)]));
  const normalized = { ...normalizeMetrics(entity), sourceMetrics };
  if (entity.contextAdjustedMentions != null) return normalized;

  const sources = Object.values(entity.sourceMetrics || {});
  const dominantShare = sources.length && entity.mentions
    ? Math.max(...sources.map(metrics => metrics.mentions || 0)) / entity.mentions
    : 0;
  const sparseAcrossDocuments = entity.documentCount >= 20 && entity.mentions / Math.max(1, entity.documentCount) <= 1.5;
  const concentratedLegacyCount = entity.mentions >= 20 && dominantShare >= .95 && sparseAcrossDocuments;
  if (!concentratedLegacyCount) return normalized;

  const adjusted = Math.max(1, Math.round(sources.reduce((sum, metrics) => sum + Math.log2(1 + (metrics.mentions || 0)), 0) * 3));
  const inflated = Math.max(0, entity.mentions - adjusted);
  const independentDocumentCount = Math.min(entity.documentCount, adjusted);
  return {
    ...normalized,
    contextAdjustedMentions: Math.min(entity.mentions, adjusted),
    independentDocumentCount,
    inflatedMentionCount: inflated,
    inflationRate: inflated / Math.max(1, entity.mentions),
    ...prominenceInflationFor(entity.documentCount, independentDocumentCount),
    inflationSignals: { ...normalized.inflationSignals, legacySourceConcentration: inflated }
  };
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 1800);
}

function controlSelect(key, title, options) {
  const choices = options.map(option => {
    const value = typeof option === "string" ? option : option.value;
    const text = typeof option === "string" ? label(option) : option.label;
    return `<option value="${escapeHTML(value)}" ${state.config[key] === value ? "selected" : ""}>${escapeHTML(text)}</option>`;
  }).join("");
  return `<div class="control"><label for="control-${key}">${escapeHTML(title)}</label><select id="control-${key}" data-config="${key}">${choices}</select></div>`;
}

function presetConfig(id, type = DEFAULT.type) {
  const preset = PRESETS.find(item => item.id === id);
  if (!preset) return null;
  const { type: _presetType, ...overrides } = preset.config || {};
  const viewDefaults = VIEW_DEFAULTS[type] || {};
  const presetDefaults = overrides.x === "entity" ? (ENTITY_PRESET_DEFAULTS[type] || {}) : {};
  const config = {
    ...DEFAULT,
    type,
    ...viewDefaults,
    ...presetDefaults,
    ...overrides,
    categories: [...(overrides.categories || viewDefaults.categories || DEFAULT.categories)],
    sources: [...(overrides.sources || viewDefaults.sources || DEFAULT.sources)],
    tableColumns: [...(overrides.tableColumns || viewDefaults.tableColumns || DEFAULT.tableColumns)]
  };
  config.titleMode = "auto";
  config.title = dataAwareTitle(config);
  return config;
}

function presetMatches(preset) {
  const config = presetConfig(preset.id, state.config.type);
  const presetDefaults = preset.config?.x === "entity" ? (ENTITY_PRESET_DEFAULTS[state.config.type] || {}) : {};
  const keys = (preset.config ? [...Object.keys(preset.config), ...Object.keys(presetDefaults)] : [...Object.keys(DEFAULT), ...Object.keys(VIEW_DEFAULTS[state.config.type] || {})])
    .filter(key => !["type", "title", "titleMode"].includes(key));
  return keys.every(key => Array.isArray(config[key])
    ? config[key].length === state.config[key]?.length && config[key].every((item, index) => item === state.config[key][index])
    : state.config[key] === config[key]);
}

function activePresetId() {
  return PRESETS.find(presetMatches)?.id || "";
}

function renderPresetControl() {
  const activeId = activePresetId();
  const options = PRESETS.map(preset => `<option value="${escapeHTML(preset.id)}" ${activeId === preset.id ? "selected" : ""}>${escapeHTML(preset.label)}</option>`).join("");
  $("#presetControls").innerHTML = `<div class="control"><label for="control-preset">View preset</label><select id="control-preset" data-preset-select><option value="">Custom</option>${options}</select></div>`;
}

function renderPresetStatus() {
  const select = $("[data-preset-select]");
  if (select) select.value = activePresetId();
}

function applyPreset(id) {
  const config = presetConfig(id, state.config.type);
  const preset = PRESETS.find(item => item.id === id);
  if (!config || !preset) return;
  state.config = config;
  syncAutomaticTitle(true);
  state.selected = null;
  renderControls();
  commitConfig();
  toast(`Preset applied: ${preset.label}`);
}

function renderTypeGrid() {
  $("#typeGrid").innerHTML = TYPES.map(type => `
    <button class="type-card ${state.config.type === type.id ? "active" : ""}" data-type="${type.id}">
      <svg viewBox="0 0 31 20" fill="none" stroke="currentColor" stroke-width="1.5">${type.icon}</svg><span class="type-card-copy"><strong>${type.label}</strong><small>${type.scope}</small></span>
    </button>`).join("");
}

function renderControls() {
  renderPresetControl();
  renderTypeGrid();
  const numericEntity = ["contextAdjustedMentions", "mentions", "independentDocumentCount", "documentCount", "sourceCount", "inflationRate", "documentInflationRate", "classificationConfidence", "extractionConfidence"];
  const numericDoc = ["words", "segments", "bytes", "durationMs"];
  const relationshipTypeControl = () => controlSelect("relation", "Relationship type", [{ value: "all", label: "Any published relationship" }, { value: "co_mentioned", label: "Repeated co-mention" }, { value: "affiliated_with", label: "Affiliation cue" }, { value: "investigated", label: "Investigation cue" }]);
  let roles = "";
  if (state.config.type === "network") {
    const relationshipControl = state.config.nodeRole === "collection"
      ? `<div class="control"><label for="collectionRelationship">Relationship</label><select id="collectionRelationship" disabled><option>Shared published entities</option></select></div>`
      : controlSelect("relation", "Relationship", [{ value: "all", label: "Any published relationship" }, { value: "co_mentioned", label: "Repeated co-mention" }, { value: "affiliated_with", label: "Affiliation cue" }, { value: "investigated", label: "Investigation cue" }]);
    roles = controlSelect("nodeRole", "Nodes", [{ value: "entity", label: "Entities" }, { value: "collection", label: "Collections" }]) + relationshipControl;
  } else if (state.config.type === "map") {
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Geocoded locations</option></select></div><div class="control"><div class="control-title">Position</div><select disabled><option>Reviewed coordinates</option></select></div>` + relationshipTypeControl();
  } else if (state.config.type === "book") {
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Book titles</option></select></div><div class="control"><div class="control-title">Layout</div><select disabled><option>Mention-weighted cover area</option></select></div>`;
  } else if (state.config.type === "document") {
    roles = `<div class="control"><div class="control-title">Rows</div><select disabled><option>Completed transcript files</option></select></div><div class="control"><div class="control-title">Layout</div><select disabled><option>Searchable file browser</option></select></div>`;
  } else if (state.config.type === "scatter") {
    roles = controlSelect("x", "X axis", ["entity", ...numericEntity]) + controlSelect("y", "Y axis", numericEntity)
      + relationshipTypeControl();
  } else if (state.config.type === "bars") {
    roles = controlSelect("aggregation", "Group by", [{ value: "entity", label: "Entities" }, { value: "source", label: "Collection" }, { value: "format", label: "Transcript format" }]) + controlSelect("y", "Measure", state.config.aggregation === "entity" ? numericEntity : ["words", "documents", "bytes"]);
  } else if (state.config.type === "timeline") {
    const eventFields = ["timelineLane"];
    roles = controlSelect("timelineRole", "Marks", [{ value: "event", label: "Evidence-backed events" }, { value: "document", label: "Dated source documents" }, { value: "entity", label: "Entities" }])
      + controlSelect("x", "X axis", [{ value: state.config.timelineRole === "event" ? "startDate" : "documentDate", label: state.config.timelineRole === "event" ? "Event date" : "Document date" }])
      + controlSelect("y", "Y axis", state.config.timelineRole === "event" ? eventFields : state.config.timelineRole === "entity" ? numericEntity : numericDoc);
    roles += state.config.timelineRole === "entity"
      ? relationshipTypeControl()
      : `<div class="control"><div class="control-title">Relationship</div><select disabled><option>Shared published entities</option></select></div>`;
  } else if (state.config.type === "matrix") {
    roles = `<div class="control"><div class="control-title">Rows</div><select disabled><option>Collections</option></select></div>` + controlSelect("matrixColumns", "Columns", [{ value: "entity", label: "Entities" }, { value: "category", label: "Entity categories" }]);
  } else {
    const fields = TABLE_FIELDS[state.config.tableRole];
    const columnChecks = fields.map(field => `<label class="check-chip"><input type="checkbox" data-table-column="${field}" ${state.config.tableColumns.includes(field) ? "checked" : ""}><span>${escapeHTML(label(field))}</span></label>`).join("");
    roles = controlSelect("tableRole", "Rows", [{ value: "entity", label: "Entities" }, { value: "document", label: "Transcript files" }, { value: "source", label: "Collections" }]) + `<div class="control"><div class="control-title">Columns <span>${state.config.tableColumns.length}</span></div><div class="check-grid">${columnChecks}</div></div>`;
  }
  $("#roleControls").innerHTML = roles;

  const sizeOptions = state.config.type === "timeline" && state.config.timelineRole === "event"
    ? ["documentCount", "confidence"]
    : state.config.type === "network" && state.config.nodeRole === "collection"
      ? ["documents", "words"]
      : state.config.type === "document" || state.config.type === "timeline" && state.config.timelineRole !== "entity" ? numericDoc : numericEntity;
  const labelSizeControl = `<div class="control"><label>Label size <span>${state.config.labelSize}px</span></label><input type="range" min="11" max="18" step="1" value="${state.config.labelSize}" data-range="labelSize"></div>`;
  const zoomControl = state.config.type === "network" ? `<div class="control"><label>Zoom <span>${state.config.zoom.toFixed(1)}×</span></label><input type="range" min="0.5" max="2.5" step="0.1" value="${state.config.zoom}" data-range="zoom"></div>` : "";
  const moonTransitControl = state.config.type === "map" ? `<div class="control"><label for="moonTransitSeconds">On-screen Moon transit <span>${state.config.moonTransitSeconds}s</span></label><input id="moonTransitSeconds" type="range" min="2" max="10" step="1" value="${state.config.moonTransitSeconds}" data-range="moonTransitSeconds"></div>` : "";
  const supportsRelationships = ["scatter", "map", "timeline"].includes(state.config.type);
  const eventSequenceRelationships = state.config.type === "timeline" && state.config.timelineRole === "event";
  const relationshipControls = supportsRelationships ? controlSelect("relationshipLayer", "Relationship layer", [{ value: "off", label: "Off" }, { value: "hover", label: "On hover" }, { value: "always", label: "Always" }])
    + `<div class="control"><label>Connections per node <span>${state.config.relationshipNeighbors}</span></label><input type="range" min="1" max="5" step="1" value="${state.config.relationshipNeighbors}" data-range="relationshipNeighbors"></div>`
    + (eventSequenceRelationships ? "" : controlSelect("relationshipNodeSize", "Secondary-node size", [{ value: "inherit", label: "Inherit size metric" }, { value: "fixed", label: "Fixed" }]))
    + controlSelect("relationshipStrength", "Line strength", [{ value: "subtle", label: "Subtle" }, { value: "medium", label: "Medium" }, { value: "strong", label: "Strong" }]) : "";
  if (state.config.type === "table") {
    const sortOptions = TABLE_FIELDS[state.config.tableRole];
    $("#encodeControls").innerHTML = controlSelect("tableSort", "Sort by", sortOptions) + controlSelect("tableDirection", "Direction", [{ value: "desc", label: "Descending" }, { value: "asc", label: "Ascending" }]) + labelSizeControl;
  } else if (state.config.type === "document") {
    $("#encodeControls").innerHTML = labelSizeControl;
  } else {
    $("#encodeControls").innerHTML = (["scatter", "network", "timeline", "map", "book"].includes(state.config.type)
      ? controlSelect("size", state.config.type === "book" ? "Shade" : "Size + shade", sizeOptions) + `<div class="control"><div class="control-title">Shade scale</div><select disabled><option>Monochrome value scale</option></select></div>` + controlSelect("labels", "Labels", [{ value: "top", label: "Most important" }, { value: "all", label: "All" }, { value: "none", label: "None" }])
      : `<div class="control"><div class="control-title">Shade scale</div><select disabled><option>Monochrome value scale</option></select></div>`) + relationshipControls + moonTransitControl + labelSizeControl + zoomControl;
  }

  const categories = state.config.type === "map"
    ? ["location"]
    : [...new Set(state.catalog?.entities.map(item => item.category) || ENTITY_CATEGORIES)];
  const categoryChecks = categories.map(category => {
    const fixedCategories = state.config.type === "book" || state.config.type === "document";
    const checked = state.config.type === "book" ? category === "book" : state.config.type === "document" || state.config.categories.includes(category);
    return `<label class="check-chip"><input type="checkbox" data-category="${category}" ${checked ? "checked" : ""} ${fixedCategories ? "disabled" : ""}><span>${escapeHTML(label(category))}</span></label>`;
  }).join("");
  const sources = state.catalog?.sources || [];
  const sourceNames = sources.map(source => source.name);
  const selectedSourceCount = state.config.allSources ? sourceNames.length : sourceNames.filter(name => state.config.sources.includes(name)).length;
  const sourceChecks = sources.map(source => `<label class="check-chip"><input type="checkbox" data-source="${escapeHTML(source.name)}" ${sourceIsSelected(source.name, state.config.sources, state.config.allSources) ? "checked" : ""}><span>${escapeHTML(source.name)}</span></label>`).join("");
  const duplicateCount = state.catalog?.counts?.possibleDuplicates || state.catalog?.duplicateCandidates?.length || 0;
  const usesEntities = state.config.type === "table" ? state.config.tableRole === "entity" : state.config.type !== "document" && (state.config.type === "timeline" || !["bars", "timeline"].includes(state.config.type) || state.config.aggregation === "entity" || state.config.timelineRole === "entity");
  const showsEntityCategories = usesEntities || state.config.type === "document";
  $("#filterControls").innerHTML = `
    ${state.config.type === "document" ? `<div class="control"><label for="documentSearch">Find a document</label><input id="documentSearch" class="text-input" type="search" value="${escapeHTML(state.config.documentSearch)}" placeholder="Search title, path, collection, or format" data-document-search></div>` : ""}
    ${showsEntityCategories ? `<div class="control"><div class="control-title">Entity categories</div><div class="check-grid">${categoryChecks}</div></div>` : ""}
    <div class="control"><div class="control-title">Collections <span>${selectedSourceCount} / ${sourceNames.length} selected</span></div><div class="check-grid">${sourceChecks}</div></div>
    ${state.config.type === "table" ? `<div class="control"><label for="tableSearch">Search rows</label><input id="tableSearch" class="text-input" type="search" value="${escapeHTML(state.config.tableSearch)}" placeholder="Filter this list" data-table-search></div>` : ""}
    ${usesEntities ? `<div class="control"><label>Minimum confidence <span>${Math.round(state.config.minConfidence * 100)}%</span></label><input type="range" min="0.5" max="0.95" step="0.01" value="${state.config.minConfidence}" data-range="minConfidence"></div>` : ""}
    ${state.config.type === "network" || (supportsRelationships && state.config.relationshipLayer !== "off" && !eventSequenceRelationships) ? `<div class="control"><label>${state.config.type === "network" && state.config.nodeRole === "collection" || state.config.type === "timeline" && state.config.timelineRole === "document" ? "Shared entities" : "Relationship evidence"} <span>${state.config.minEvidence}×</span></label><input type="range" min="1" max="12" step="1" value="${state.config.minEvidence}" data-range="minEvidence"></div>` : ""}
    ${state.config.type === "document"
      ? `<div class="control"><div class="control-title">Search scope <span>${state.catalog?.documents.filter(document => sourceMatches(document.source)).length || 0}</span></div><select disabled><option>Every completed file</option></select></div>`
      : state.config.type === "table"
        ? `<div class="control"><div class="control-title">Rows included</div><select disabled><option>All matching rows</option></select></div>`
      : `<div class="control"><label>Maximum ${state.config.type === "table" ? "rows" : "marks"} <span>${state.config.limit}</span></label><input type="range" min="20" max="${state.config.type === "timeline" ? 1000 : state.config.type === "network" ? 120 : 250}" step="10" value="${state.config.limit}" data-range="limit"></div>`}
    ${usesEntities ? `<div class="control method-note"><div class="control-title">Context adjustment</div><p>Counts exact repeats within one document once, counts text repeated across 3+ documents once, and excludes requester metadata. Raw mentions remain available.</p></div>` : ""}
    ${usesEntities ? `<div class="control"><div class="control-title">Inflation review</div><label class="check-chip"><input type="checkbox" data-include-high-inflation ${state.config.includeHighInflation ? "checked" : ""}><span>Include high-inflation entities</span></label></div>` : ""}
    <div class="control duplicate-review-control"><div class="control-title">Identity review <span>${duplicateCount} flagged</span></div><button class="button review-button" type="button" data-review-duplicates ${duplicateCount ? "" : "disabled"}>Review possible duplicates</button></div>`;

  $$('[data-config]').forEach(node => node.addEventListener("change", event => updateConfig(event.target.dataset.config, event.target.value)));
  $$('[data-range]').forEach(node => node.addEventListener("input", event => {
    const key = event.target.dataset.range;
    const value = Number(event.target.value);
    state.config[key] = value;
    if (key === "limit") syncAutomaticTitle();
    const output = event.target.closest(".control")?.querySelector("label span");
    if (output) output.textContent = key === "minConfidence" ? `${Math.round(value * 100)}%` : key === "minEvidence" ? `${value}×` : key === "labelSize" ? `${value}px` : key === "zoom" ? `${value.toFixed(1)}×` : key === "moonTransitSeconds" ? `${value}s` : String(value);
    persistHash();
    if (key === "moonTransitSeconds") return window.ufoGlobe?.setMoonTransitSeconds(value);
    renderGraph();
  }));
  $$('[data-category]').forEach(node => node.addEventListener("change", () => {
    state.config.categories = $$('[data-category]:checked').map(input => input.dataset.category);
    commitConfig();
  }));
  $("[data-include-high-inflation]")?.addEventListener("change", event => {
    state.config.includeHighInflation = event.target.checked;
    commitConfig();
  });
  $$('[data-source]').forEach(node => node.addEventListener("change", () => {
    const selectedSources = $$('[data-source]:checked').map(input => input.dataset.source);
    Object.assign(state.config, sourceSelectionConfig(selectedSources, sourceNames));
    renderControls();
    commitConfig();
  }));
  $$('[data-table-column]').forEach(node => node.addEventListener("change", () => {
    const columns = $$('[data-table-column]:checked').map(input => input.dataset.tableColumn);
    if (!columns.length) { node.checked = true; return toast("Keep at least one column"); }
    state.config.tableColumns = columns;
    renderControls();
    commitConfig(false);
  }));
  $("[data-review-duplicates]")?.addEventListener("click", inspectDuplicateCandidates);
  $("[data-table-search]")?.addEventListener("input", event => {
    state.config.tableSearch = event.target.value;
    persistHash();
    renderGraph();
  });
  $("[data-document-search]")?.addEventListener("input", event => {
    state.config.documentSearch = event.target.value;
    persistHash();
    renderGraph();
  });
  $$('[data-type]').forEach(node => node.addEventListener("click", () => setType(node.dataset.type)));
  $("[data-preset-select]")?.addEventListener("change", event => {
    if (event.target.value) applyPreset(event.target.value);
  });
}

function setType(type) {
  state.config = presetConfig("default", type);
  state.selected = null;
  renderControls();
  commitConfig();
}

function updateConfig(key, value, rerenderControls = false) {
  state.config[key] = value;
  if (key === "aggregation") {
    state.config.y = value === "entity" ? "contextAdjustedMentions" : "words";
    state.config.color = "intensity";
  }
  if (key === "timelineRole") {
    state.config.x = value === "event" ? "startDate" : "documentDate";
    state.config.y = value === "event" ? "timelineLane" : value === "entity" ? "contextAdjustedMentions" : "words";
    state.config.size = value === "event" ? "documentCount" : value === "entity" ? "independentDocumentCount" : "words";
    state.config.color = value === "event" ? "eventType" : value === "entity" ? "category" : "source";
    if (value === "event") state.config.relationshipLayer = "always";
  }
  if (key === "nodeRole") {
    state.config.size = value === "collection" ? "documents" : "independentDocumentCount";
  }
  if (key === "tableRole") {
    const defaults = {
      entity: { tableColumns: ["name", "category", "mentions", "documentCount", "sourceCount"], tableSort: "mentions" },
      document: { tableColumns: ["title", "source", "format", "words", "createdAt"], tableSort: "createdAt" },
      source: { tableColumns: ["name", "documents", "words"], tableSort: "documents" }
    };
    Object.assign(state.config, defaults[value]);
  }
  if (rerenderControls) renderControls();
  if (["aggregation", "timelineRole", "matrixColumns", "tableRole", "nodeRole", "relationshipLayer"].includes(key)) renderControls();
  commitConfig(false);
}

function commitConfig(updateTitle = true) {
  syncAutomaticTitle();
  if (updateTitle) $("#graphTitle").textContent = state.config.title;
  renderPresetStatus();
  persistHash();
  renderGraph();
}

function dimensions() {
  const box = $("#chart").getBoundingClientRect();
  return { width: Math.max(460, box.width), height: Math.max(420, box.height) };
}

function clearChart() {
  hideMapView();
  const svg = $("#chart");
  svg.removeAttribute("hidden");
  $("#tableView").hidden = true;
  $("#chartWrap").classList.remove("table-mode");
  svg.replaceChildren();
  svg.style.setProperty("--graph-label-size", `${state.config.labelSize}px`);
  drawIntensityLegend();
  const { width, height } = dimensions();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  return { svg, width, height };
}

function hideMapView() {
  const mapView = $("#mapView");
  if (mapView) mapView.hidden = true;
  if (typeof window !== "undefined") window.dispatchEvent?.(new CustomEvent("ufo-map-visibility", { detail: { visible: false } }));
}

function prepareMapView() {
  const svg = $("#chart");
  svg.setAttribute("hidden", "");
  svg.replaceChildren();
  $("#tableView").hidden = true;
  $("#chartWrap").classList.remove("table-mode");
  $("#mapView").hidden = false;
}

function sourceMatches(sourceName) {
  return state.config.allSources || state.config.sources.includes(sourceName);
}

function entityMatches(entity, categories = state.config.categories) {
  entity = withSignificanceDefaults(entity);
  if (!categories.includes(entity.category)) return false;
  if (entity.classificationConfidence < state.config.minConfidence) return false;
  if (!state.config.allSources && !entity.documentIds.some(id => sourceMatches(state.documentById.get(id)?.source))) return false;
  const scopedEntity = state.config.allSources ? entity : filteredEntity(entity);
  return state.config.includeHighInflation || scopedEntity.inflationRisk !== "high";
}

function filteredEntity(entity) {
  entity = withSignificanceDefaults(entity);
  if (state.config.allSources) return entity;
  const documentIds = entity.documentIds.filter(id => sourceMatches(state.documentById.get(id)?.source));
  const selectedMetrics = Object.entries(entity.sourceMetrics || {})
    .filter(([source]) => sourceMatches(source))
    .map(([, metrics]) => metrics);
  const mentions = selectedMetrics.length
    ? selectedMetrics.reduce((sum, metrics) => sum + metrics.mentions, 0)
    : Math.round(entity.mentions * documentIds.length / Math.max(1, entity.documentCount));
  const contextAdjustedMentions = selectedMetrics.length
    ? selectedMetrics.reduce((sum, metrics) => sum + (metrics.contextAdjustedMentions ?? metrics.mentions), 0)
    : Math.round((entity.contextAdjustedMentions ?? entity.mentions) * documentIds.length / Math.max(1, entity.documentCount));
  const independentDocumentCount = selectedMetrics.length
    ? selectedMetrics.reduce((sum, metrics) => sum + (metrics.independentDocumentCount ?? metrics.documentCount), 0)
    : documentIds.length;
  const inflatedMentionCount = Math.max(0, mentions - contextAdjustedMentions);
  const inflationRate = inflatedMentionCount / Math.max(1, mentions);
  const documentCount = documentIds.length;
  const inflationSignals = selectedMetrics.reduce((signals, metrics) => {
    const sourceSignals = metrics.inflationSignals || {};
    Object.keys(signals).forEach(key => { signals[key] += sourceSignals[key] || 0; });
    return signals;
  }, { repeatedContextMentions: 0, administrativeMentions: 0, withinDocumentDuplicates: 0 });
  return {
    ...entity,
    mentions,
    contextAdjustedMentions,
    independentDocumentCount,
    inflatedMentionCount,
    inflationRate,
    ...prominenceInflationFor(documentCount, independentDocumentCount),
    inflationSignals,
    documentCount,
    sourceCount: new Set(documentIds.map(id => state.documentById.get(id)?.source).filter(Boolean)).size,
    documentIds,
    evidence: entity.evidence.filter(item => documentIds.includes(item.documentId))
  };
}

function filteredEntities(categories = state.config.categories) {
  return state.catalog.entities.filter(entity => entityMatches(entity, categories)).map(filteredEntity);
}

function filteredEdge(edge, visibleDocumentIds = null) {
  if (state.config.allSources) return edge;
  const selectedMetrics = Object.entries(edge.sourceMetrics || {})
    .filter(([source]) => sourceMatches(source))
    .map(([, metrics]) => metrics);
  if (!selectedMetrics.length) return null;
  const documentIds = visibleDocumentIds || new Set(state.catalog.documents.filter(document => sourceMatches(document.source)).map(document => document.id));
  return {
    ...edge,
    evidenceCount: selectedMetrics.reduce((sum, metrics) => sum + metrics.evidenceCount, 0),
    documentCount: selectedMetrics.reduce((sum, metrics) => sum + metrics.documentCount, 0),
    evidence: edge.evidence.filter(item => documentIds.has(item.documentId))
  };
}

function scatterEgoNetworks(entities, displayedEntities, maximumNeighbors = 3) {
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const displayedIds = new Set(displayedEntities.map(entity => entity.id));
  const networks = new Map(displayedEntities.map(entity => [entity.id, []]));
  const visibleDocumentIds = state.config.allSources
    ? null
    : new Set(state.catalog.documents.filter(document => sourceMatches(document.source)).map(document => document.id));
  (state.catalog.edges || []).forEach(rawEdge => {
    const edge = filteredEdge(rawEdge, visibleDocumentIds);
    if (!edge || edge.evidenceCount < state.config.minEvidence || (state.config.relation !== "all" && edge.relationship !== state.config.relation)) return;
    [[edge.source, edge.target], [edge.target, edge.source]].forEach(([entityId, neighborId]) => {
      if (!displayedIds.has(entityId) || !entityById.has(neighborId)) return;
      networks.get(entityId).push({ entity: entityById.get(neighborId), edge });
    });
  });
  networks.forEach((neighbors, entityId) => {
    neighbors.sort((left, right) => right.edge.evidenceCount - left.edge.evidenceCount || left.entity.name.localeCompare(right.entity.name));
    networks.set(entityId, { total: neighbors.length, neighbors: neighbors.slice(0, maximumNeighbors) });
  });
  return networks;
}

function documentRelationshipNetworks(documents, displayedDocuments, maximumNeighbors = 3) {
  const documentById = new Map(documents.map(document => [document.id, document]));
  const displayedIds = new Set(displayedDocuments.map(document => document.id));
  const scores = new Map(displayedDocuments.map(document => [document.id, new Map()]));
  (state.catalog.entities || []).forEach(entity => {
    const memberIds = (entity.documentIds || []).filter(id => documentById.has(id));
    memberIds.forEach(sourceId => {
      if (!displayedIds.has(sourceId)) return;
      memberIds.forEach(targetId => {
        if (sourceId === targetId) return;
        const previous = scores.get(sourceId).get(targetId) || { count: 0, names: [] };
        previous.count += 1;
        previous.names.push(entity.name);
        scores.get(sourceId).set(targetId, previous);
      });
    });
  });
  return new Map([...scores].map(([documentId, neighbors]) => {
    const ranked = [...neighbors]
      .filter(([, shared]) => shared.count >= state.config.minEvidence)
      .map(([neighborId, shared]) => ({
        entity: documentById.get(neighborId),
        edge: { relationship: "shared_entities", evidenceCount: shared.count, sharedEntities: shared.names }
      }))
      .sort((left, right) => right.edge.evidenceCount - left.edge.evidenceCount || left.entity.title.localeCompare(right.entity.title));
    return [documentId, { total: ranked.length, neighbors: ranked.slice(0, maximumNeighbors) }];
  }));
}

function valueExtent(data, key) {
  const values = data.map(item => Number(item[key]) || 0);
  return [Math.min(...values, 0), Math.max(...values, 1)];
}

function robustValueExtent(data, key, percentile = .95) {
  const values = data.map(item => Number(item[key]) || 0).sort((a, b) => a - b);
  const extent = [Math.min(...values, 0), Math.max(...values, 1)];
  if (values.length < 20) return { extent, capped: false };
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentile) - 1));
  const cap = values[index];
  if (cap <= extent[0] || extent[1] <= cap * 1.5) return { extent, capped: false };
  return { extent: [extent[0], cap], capped: true };
}

function scale(value, extent, range) {
  const span = extent[1] - extent[0] || 1;
  return range[0] + ((Number(value) || 0) - extent[0]) / span * (range[1] - range[0]);
}

function clampedScale(value, extent, range) {
  return scale(Math.max(extent[0], Math.min(extent[1], Number(value) || 0)), extent, range);
}

function scatterRelationshipOverlay(egoNetworks, displayedEntities) {
  const displayedIds = new Set(displayedEntities.map(entity => entity.id));
  const nodes = new Map();
  const edges = new Map();
  egoNetworks.forEach((network, entityId) => network.neighbors.forEach(neighbor => {
    if (!displayedIds.has(neighbor.entity.id)) {
      nodes.set(neighbor.entity.id, neighbor.entity);
    }
    const ids = [entityId, neighbor.entity.id].sort();
    const key = ids.join("|");
    const existing = edges.get(key);
    if (!existing || neighbor.edge.evidenceCount > existing.edge.evidenceCount) {
      edges.set(key, { source: ids[0], target: ids[1], edge: neighbor.edge });
    }
  }));
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

function scatterSecondaryAnchors(egoNetworks, displayedIndex) {
  const positions = new Map();
  egoNetworks.forEach((network, entityId) => network.neighbors.forEach(neighbor => {
    if (displayedIndex.has(neighbor.entity.id)) return;
    if (!positions.has(neighbor.entity.id)) positions.set(neighbor.entity.id, []);
    positions.get(neighbor.entity.id).push(displayedIndex.get(entityId));
  }));
  return new Map([...positions].map(([id, indexes]) => [id, indexes.reduce((sum, index) => sum + index, 0) / indexes.length]));
}

function drawIntensityLegend() {
  const relationshipView = ["scatter", "map", "timeline"].includes(state.config.type);
  const egoKey = relationshipView && state.config.relationshipLayer !== "off" ? `<span class="legend-item"><i class="ego-key"></i>Strongest relationships</span>` : "";
  const outlierKey = state.config.type === "scatter" ? `<span class="legend-item"><i class="outlier-key"></i>Axis-capped outlier</span>` : "";
  const inflationKey = state.config.type === "scatter" ? `<span class="legend-item"><i class="risk-key"></i>Potential mention inflation</span>` : "";
  $("#legend").innerHTML = `<span class="legend-item"><i style="background:#111;opacity:.14"></i>Lower</span><span class="legend-item"><i style="background:#111;opacity:.48"></i>Medium</span><span class="legend-item"><i style="background:#111"></i>Higher</span>${egoKey}${outlierKey}${inflationKey}`;
}

function addTitle(node, text) {
  node.append(el("title", {}, text));
}

function drawAxes(svg, width, height, xKey, yKey, xExtent, yExtent, capped = {}) {
  const margin = { left: 58, right: 28, top: 22, bottom: 48 };
  const yIntervals = yKey === "timelineLane" ? 6 : 4;
  for (let i = 0; i <= yIntervals; i++) {
    const y = margin.top + i * (height - margin.top - margin.bottom) / yIntervals;
    svg.append(el("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "grid-line" }));
    const value = yExtent[1] - i * (yExtent[1] - yExtent[0]) / yIntervals;
    const tick = capped.y && i === 0 ? `${formatNumber(value)}+` : formatNumber(value);
    svg.append(el("text", { x: margin.left - 8, y: y + 3, "text-anchor": "end", class: "axis-label" }, tick));
  }
  if (["createdAt", "documentDate", "startDate"].includes(xKey)) {
    for (let i = 0; i <= 5; i++) {
      const value = xExtent[0] + i * (xExtent[1] - xExtent[0]) / 5;
      const x = margin.left + i * (width - margin.left - margin.right) / 5;
      svg.append(el("text", { x, y: height - margin.bottom + 18, "text-anchor": i === 0 ? "start" : i === 5 ? "end" : "middle", class: "axis-label" }, new Date(value).getUTCFullYear()));
    }
  }
  svg.append(el("text", { x: (margin.left + width - margin.right) / 2, y: height - 13, "text-anchor": "middle", class: "axis-label" }, label(xKey)));
  const yLabel = el("text", { x: 15, y: height / 2, transform: `rotate(-90 15 ${height / 2})`, "text-anchor": "middle", class: "axis-label" }, label(yKey));
  svg.append(yLabel);
  return margin;
}

function collectionNetworkData() {
  const documentsBySource = new Map();
  state.catalog.documents.forEach(document => {
    if (!documentsBySource.has(document.source)) documentsBySource.set(document.source, []);
    documentsBySource.get(document.source).push(document);
  });
  const candidates = state.catalog.sources
    .filter(source => sourceMatches(source.name))
    .map(source => {
      const documents = documentsBySource.get(source.name) || [];
      return {
        ...source,
        category: "collection",
        bytes: documents.reduce((sum, document) => sum + (document.bytes || 0), 0),
        documentIds: documents.map(document => document.id)
      };
    });
  const sourceByName = new Map(candidates.map(source => [source.name, source]));
  const pairs = new Map();
  filteredEntities().forEach(entity => {
    const names = [...new Set(entity.documentIds.map(id => state.documentById.get(id)?.source).filter(name => sourceByName.has(name)))].sort();
    for (let leftIndex = 0; leftIndex < names.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < names.length; rightIndex++) {
      const left = sourceByName.get(names[leftIndex]), right = sourceByName.get(names[rightIndex]);
      const key = `${left.id}|${right.id}`;
      if (!pairs.has(key)) pairs.set(key, { id: `shared-${key}`, source: left.id, target: right.id, relationship: "shared_entities", sharedEntities: [] });
      pairs.get(key).sharedEntities.push(entity);
    }
  });
  const edges = [...pairs.values()].map(edge => {
    const names = new Set([candidates.find(source => source.id === edge.source)?.name, candidates.find(source => source.id === edge.target)?.name]);
    const documentIds = new Set(edge.sharedEntities.flatMap(entity => entity.documentIds.filter(id => names.has(state.documentById.get(id)?.source))));
    const evidence = edge.sharedEntities.flatMap(entity => entity.evidence.filter(item => documentIds.has(item.documentId)).slice(0, 1).map(item => ({ ...item, excerpt: `${entity.name}: ${item.excerpt}` }))).slice(0, 8);
    return { ...edge, evidenceCount: edge.sharedEntities.length, documentCount: documentIds.size, confidence: edge.sharedEntities.reduce((sum, entity) => sum + entity.classificationConfidence, 0) / edge.sharedEntities.length, evidence };
  }).filter(edge => edge.evidenceCount >= state.config.minEvidence);
  return { candidates, edges };
}

function networkSeedPosition(index, nodeCount, width, height, collectionMode, phase = 0) {
  const angle = index * 2.399963 + phase;
  const progress = collectionMode ? 1 : Math.sqrt((index + 1) / nodeCount);
  const radiusX = width * (collectionMode ? .45 : .05 + progress * .4);
  const radiusY = height * (collectionMode ? .45 : .05 + progress * .4);
  return { x: width / 2 + Math.cos(angle) * radiusX, y: height / 2 + Math.sin(angle) * radiusY };
}

function fitNetworkPositions(positions, width, height, coverage = .9) {
  const points = [...positions.values()];
  const xExtent = [Math.min(...points.map(point => point.x)), Math.max(...points.map(point => point.x))];
  const yExtent = [Math.min(...points.map(point => point.y)), Math.max(...points.map(point => point.y))];
  const inset = (1 - coverage) / 2;
  points.forEach(point => {
    point.x = xExtent[0] === xExtent[1] ? width / 2 : scale(point.x, xExtent, [width * inset, width * (1 - inset)]);
    point.y = yExtent[0] === yExtent[1] ? height / 2 : scale(point.y, yExtent, [height * inset, height * (1 - inset)]);
  });
}

function renderNetwork() {
  const { svg, width, height } = clearChart();
  const zoom = Math.max(.5, Math.min(2.5, Number(state.config.zoom) || 1));
  const labelSize = state.config.labelSize / zoom;
  const collectionMode = state.config.nodeRole === "collection";
  let candidates, edges;
  if (collectionMode) {
    ({ candidates, edges } = collectionNetworkData());
  } else {
    candidates = filteredEntities();
    const candidateIds = new Set(candidates.map(item => item.id));
    const visibleDocumentIds = new Set(state.catalog.documents.filter(document => sourceMatches(document.source)).map(document => document.id));
    edges = state.catalog.edges.map(edge => filteredEdge(edge, visibleDocumentIds)).filter(edge => edge && candidateIds.has(edge.source) && candidateIds.has(edge.target) && edge.evidenceCount >= state.config.minEvidence && (state.config.relation === "all" || edge.relationship === state.config.relation));
  }
  const degree = new Map();
  edges.forEach(edge => { degree.set(edge.source, (degree.get(edge.source) || 0) + edge.evidenceCount); degree.set(edge.target, (degree.get(edge.target) || 0) + edge.evidenceCount); });
  const nodes = candidates.filter(node => degree.has(node.id)).sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, state.config.limit);
  const ids = new Set(nodes.map(node => node.id));
  edges = edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
  if (!nodes.length) return showEmpty();
  const positions = new Map();
  nodes.forEach((node, index) => {
    const phase = ((node.category || node.name).charCodeAt(0) % 5) * .25;
    positions.set(node.id, networkSeedPosition(index, nodes.length, width, height, collectionMode, phase));
  });
  for (let round = 0; round < (collectionMode ? 0 : 35); round++) {
    edges.forEach(edge => {
      const a = positions.get(edge.source), b = positions.get(edge.target);
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      const pull = (distance - 90) * .008;
      a.x += dx / distance * pull; a.y += dy / distance * pull;
      b.x -= dx / distance * pull; b.y -= dy / distance * pull;
    });
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = positions.get(nodes[i].id), b = positions.get(nodes[j].id);
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      if (distance < 42) { const push = (42 - distance) * .02; a.x -= dx / distance * push; a.y -= dy / distance * push; b.x += dx / distance * push; b.y += dy / distance * push; }
    }
  }
  fitNetworkPositions(positions, width, height);
  const sizeExtent = valueExtent(nodes, state.config.size);
  const radii = new Map(nodes.map(node => [node.id, scale(node[state.config.size], sizeExtent, [5, 17])]));
  nodes.forEach(node => {
    const point = positions.get(node.id), radius = radii.get(node.id);
    point.x = Math.max(radius + 3, Math.min(width - radius - 3, point.x));
    point.y = Math.max(radius + 3, Math.min(height - radius - 3, point.y));
  });
  const bounds = nodes.reduce((box, node) => {
    const point = positions.get(node.id), radius = radii.get(node.id);
    return {
      left: Math.min(box.left, point.x - radius), right: Math.max(box.right, point.x + radius),
      top: Math.min(box.top, point.y - radius), bottom: Math.max(box.bottom, point.y + radius)
    };
  }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const networkCenterX = (bounds.left + bounds.right) / 2;
  const networkCenterY = (bounds.top + bounds.bottom) / 2;
  svg.setAttribute("viewBox", `${networkCenterX - width / (2 * zoom)} ${networkCenterY - height / (2 * zoom)} ${width / zoom} ${height / zoom}`);
  const edgeGroup = el("g", { class: "network-relationship-layer" });
  const networkLines = new Map();
  edges.forEach(edge => {
    const a = positions.get(edge.source), b = positions.get(edge.target);
    const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "network-relationship-line mark", "stroke-width": Math.min(2, .4 + Math.sqrt(edge.evidenceCount) * .22) });
    addTitle(line, `${label(edge.relationship)} · ${edge.evidenceCount} ${collectionMode ? "entities" : "evidence segments"}`);
    line.addEventListener("click", () => collectionMode ? inspectCollectionEdge(edge, nodes) : inspectEdge(edge));
    [edge.source, edge.target].forEach(id => {
      if (!networkLines.has(id)) networkLines.set(id, []);
      networkLines.get(id).push(line);
    });
    edgeGroup.append(line);
  });
  svg.append(edgeGroup);
  nodes.forEach((node, index) => {
    const point = positions.get(node.id);
    const radius = radii.get(node.id);
    const shade = scale(node[state.config.size], sizeExtent, [.18, .96]);
    const circle = el("circle", { cx: point.x, cy: point.y, r: radius, fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": 1, class: "mark" });
    addTitle(circle, collectionMode
      ? `${node.name} · ${node.documents} documents`
      : `${node.name} · ${label(state.config.size)}: ${formatNumber(node[state.config.size])}${state.config.size === "contextAdjustedMentions" ? ` · Raw mentions: ${formatNumber(node.mentions)}` : ""}`);
    circle.addEventListener("click", () => collectionMode ? inspectGroup(node) : inspectEntity(node));
    circle.addEventListener("mouseenter", () => {
      edgeGroup.classList.add("has-focus");
      (networkLines.get(node.id) || []).forEach(line => line.classList.add("is-focused"));
    });
    circle.addEventListener("mouseleave", () => {
      edgeGroup.classList.remove("has-focus");
      (networkLines.get(node.id) || []).forEach(line => line.classList.remove("is-focused"));
    });
    svg.append(circle);
    if (state.config.labels === "all" || (state.config.labels === "top" && index < 16)) {
      const textAnchor = point.x < width * .2 ? "start" : point.x > width * .8 ? "end" : "middle";
      svg.append(el("text", {
        x: point.x,
        y: Math.min(height - 8, point.y + radius + labelSize),
        "text-anchor": textAnchor,
        class: "chart-label node-label",
        style: `font-size:${labelSize}px`,
        "vector-effect": "non-scaling-stroke",
      }, node.name.slice(0, 28)));
    }
  });
  drawIntensityLegend();
  setSummary(`${nodes.length} ${collectionMode ? "collections" : "entities"} · ${edges.length} relationships`, "network");
}

function renderScatter() {
  const { svg, width, height } = clearChart();
  const candidates = filteredEntities();
  const data = candidates.sort((a, b) => b[state.config.y] - a[state.config.y]).slice(0, state.config.limit);
  if (!data.length) return showEmpty();
  const egoNetworks = state.config.relationshipLayer === "off"
    ? new Map(data.map(entity => [entity.id, { total: 0, neighbors: [] }]))
    : scatterEgoNetworks(candidates, data, state.config.relationshipNeighbors);
  const categoricalX = state.config.x === "entity";
  const xAxis = categoricalX ? { extent: [0, Math.max(1, data.length - 1)], capped: false } : robustValueExtent(data, state.config.x);
  const yAxis = robustValueExtent(data, state.config.y);
  const xExtent = xAxis.extent, yExtent = yAxis.extent, sizeExtent = valueExtent(data, state.config.size);
  let margin;
  if (categoricalX) {
    margin = { left: 58, right: 28, top: 22, bottom: 55 };
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + i * (height - margin.top - margin.bottom) / 4;
      svg.append(el("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "grid-line" }));
      const value = yExtent[1] - i * (yExtent[1] - yExtent[0]) / 4;
      const tick = yAxis.capped && i === 0 ? `${formatNumber(value)}+` : formatNumber(value);
      svg.append(el("text", { x: margin.left - 8, y: y + 3, "text-anchor": "end", class: "axis-label" }, tick));
    }
    svg.append(el("text", { x: (margin.left + width - margin.right) / 2, y: height - 12, "text-anchor": "middle", class: "axis-label" }, label("entity")));
    svg.append(el("text", { x: 15, y: height / 2, transform: `rotate(-90 15 ${height / 2})`, "text-anchor": "middle", class: "axis-label" }, label(state.config.y)));
  } else {
    margin = drawAxes(svg, width, height, state.config.x, state.config.y, xExtent, yExtent, { x: xAxis.capped, y: yAxis.capped });
  }
  const plotWidth = width - margin.left - margin.right;
  const tickEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotWidth / 62))));
  const displayedIndex = new Map(data.map((item, index) => [item.id, index]));
  const secondaryAnchors = scatterSecondaryAnchors(egoNetworks, displayedIndex);
  const positionFor = item => ({
    x: categoricalX
      ? margin.left + ((displayedIndex.get(item.id) ?? secondaryAnchors.get(item.id) ?? 0) + .5) * plotWidth / data.length
      : clampedScale(item[state.config.x], xExtent, [margin.left, width - margin.right]),
    y: clampedScale(item[state.config.y], yExtent, [height - margin.bottom, margin.top])
  });
  let relationshipLayer = null;
  const relationshipLines = new Map();
  const relationshipNodes = new Map();
  if (state.config.relationshipLayer !== "off") {
    const overlay = scatterRelationshipOverlay(egoNetworks, data);
    const entityById = new Map([...candidates, ...overlay.nodes].map(entity => [entity.id, entity]));
    relationshipLayer = el("g", { class: `scatter-relationship-layer relationship-${state.config.relationshipLayer} strength-${state.config.relationshipStrength}` });
    overlay.edges.forEach(relationship => {
      const source = entityById.get(relationship.source), target = entityById.get(relationship.target);
      if (!source || !target) return;
      const sourcePosition = positionFor(source), targetPosition = positionFor(target);
      const line = el("line", { x1: sourcePosition.x, y1: sourcePosition.y, x2: targetPosition.x, y2: targetPosition.y, class: "scatter-relationship-line", "stroke-width": Math.min(2, .4 + Math.sqrt(relationship.edge.evidenceCount) * .22) });
      [relationship.source, relationship.target].forEach(id => {
        if (!relationshipLines.has(id)) relationshipLines.set(id, []);
        relationshipLines.get(id).push(line);
      });
      relationshipLayer.append(line);
    });
    overlay.nodes.forEach(node => {
      const position = positionFor(node);
      const secondaryRadius = state.config.relationshipNodeSize === "fixed" ? 4 : scale(node[state.config.size], sizeExtent, [2.5, 9]);
      const secondary = el("circle", { cx: position.x, cy: position.y, r: secondaryRadius, class: "scatter-secondary-node mark" });
      addTitle(secondary, `${node.name} · shared secondary entity`);
      secondary.addEventListener("click", () => inspectEntity(node));
      relationshipNodes.set(node.id, secondary);
      relationshipLayer.append(secondary);
    });
    svg.append(relationshipLayer);
  }
  data.forEach((item, index) => {
    const { x, y } = positionFor(item);
    const radius = scale(item[state.config.size], sizeExtent, [4, 15]);
    const shade = scale(item[state.config.size], sizeExtent, [.18, .96]);
    const isOutlier = (!categoricalX && xAxis.capped && item[state.config.x] > xExtent[1]) || (yAxis.capped && item[state.config.y] > yExtent[1]);
    const egoNetwork = egoNetworks.get(item.id);
    const dot = el("circle", { cx: x, cy: y, r: radius, fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": isOutlier ? 3 : 1, class: `mark${isOutlier ? " outlier-mark" : ""}` });
    const rawMentionDetail = state.config.y === "contextAdjustedMentions" ? ` · Raw mentions: ${formatNumber(item.mentions)}` : "";
    const neighborDetail = egoNetwork.neighbors.length ? ` · Strongest relationships: ${egoNetwork.neighbors.map(neighbor => neighbor.entity.name).join(", ")}` : "";
    addTitle(dot, `${item.name} · ${label(state.config.y)}: ${formatNumber(item[state.config.y])}${rawMentionDetail}${neighborDetail}${isOutlier ? " · positioned at robust axis cap" : ""}`);
    item.egoNetwork = egoNetwork;
    dot.addEventListener("click", () => inspectEntity(item));
    dot.addEventListener("mouseenter", () => {
      if (!relationshipLayer) return;
      relationshipLayer.classList.add("has-focus");
      (relationshipLines.get(item.id) || []).forEach(line => line.classList.add("is-focused"));
      egoNetwork.neighbors.forEach(neighbor => relationshipNodes.get(neighbor.entity.id)?.classList.add("is-focused"));
    });
    dot.addEventListener("mouseleave", () => {
      if (!relationshipLayer) return;
      relationshipLayer.classList.remove("has-focus");
      (relationshipLines.get(item.id) || []).forEach(line => line.classList.remove("is-focused"));
      egoNetwork.neighbors.forEach(neighbor => relationshipNodes.get(neighbor.entity.id)?.classList.remove("is-focused"));
    });
    svg.append(dot);
    if (["elevated", "high"].includes(item.inflationRisk)) {
      svg.append(el("circle", { cx: x, cy: y, r: radius + 3, fill: "none", stroke: "#111", "stroke-width": 1, "stroke-dasharray": "3 2", class: "inflation-ring", "pointer-events": "none" }));
    }
    const showLabel = state.config.labels === "all"
      || (state.config.labels === "top" && (index < 10 || index % tickEvery === 0));
    if (categoricalX && showLabel) {
      svg.append(el("text", { x, y: Math.min(height - 25, y + radius + state.config.labelSize), "text-anchor": "middle", class: "chart-label node-label" }, item.name.slice(0, 20)));
    } else if (!categoricalX && showLabel) {
      svg.append(el("text", { x, y: Math.min(height - margin.bottom + 18, y + radius + state.config.labelSize), "text-anchor": "middle", class: "chart-label node-label" }, item.name.slice(0, 26)));
    }
  });
  drawIntensityLegend();
  setSummary(`${data.length} entities`, "scatter");
}

function renderMap() {
  prepareMapView();
  const { mapped, data, unmapped } = mapLocationData();
  if (!data.length) {
    hideMapView();
    return showEmpty();
  }
  const extent = valueExtent(data, state.config.size);
  const networks = state.config.relationshipLayer === "off" ? new Map() : scatterEgoNetworks(mapped, data, state.config.relationshipNeighbors);
  const overlay = state.config.relationshipLayer === "off" ? { nodes: [], edges: [] } : scatterRelationshipOverlay(networks, data);
  const primaryIds = new Set(data.map(entity => entity.id));
  const visibleItems = [...new Map([...data, ...overlay.nodes].map(entity => [entity.id, entity])).values()];
  const payload = {
    labelSize: state.config.labelSize,
    moonTransitSeconds: state.config.moonTransitSeconds,
    relationshipLayer: state.config.relationshipLayer,
    relationshipStrength: ({ subtle: .12, medium: .24, strong: .42 })[state.config.relationshipStrength] || .12,
    relationships: overlay.edges.map(relationship => ({ source: relationship.source, target: relationship.target, evidenceCount: relationship.edge.evidenceCount })),
    items: visibleItems.map((entity, index) => ({
      id: entity.id,
      name: entity.name,
      lat: entity.geo.lat,
      lon: entity.geo.lon,
      body: entity.geo.body || "earth",
      precision: entity.geo.precision,
      intensity: Math.sqrt(Math.max(0, clampedScale(entity[state.config.size], extent, [0, 1]))),
      formattedValue: `${label(state.config.size)}: ${formatNumber(entity[state.config.size])}`,
      secondary: !primaryIds.has(entity.id),
      showLabel: primaryIds.has(entity.id) && (state.config.labels === "all" || (state.config.labels === "top" && index < 10))
    }))
  };
  window.pendingGlobeRender = payload;
  window.dispatchEvent(new CustomEvent("ufo-map-render", { detail: payload }));
  window.dispatchEvent(new CustomEvent("ufo-map-visibility", { detail: { visible: true } }));
  drawIntensityLegend();
  setSummary(`${data.length} of ${mapped.length} mapped locations${unmapped ? ` · ${unmapped} unmapped` : ""}`, "map");
}

function preferredBookTitleAspect(item) {
  const titleLength = String(item.name || "").replace(/\s+/g, " ").trim().length;
  return Math.min(2.2, Math.max(1, .75 + titleLength / 32));
}

function bookshelfLayout(items, width, height) {
  if (!items.length) return { blocks: [], occupancy: 0 };
  const inset = 14;
  const availableWidth = width - inset * 2;
  const availableHeight = height - inset * 2;
  const weighted = items
    .map((item, index) => ({ item, index, weight: Math.max(1, Number(item.mentions) || 0) }))
    .sort((left, right) => right.weight - left.weight || left.index - right.index);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const leadArea = availableWidth * availableHeight * weighted[0].weight / totalWeight;
  const naturalLeadWidth = Math.sqrt(leadArea * 2 / 3);
  const leadScale = Math.min(1, availableWidth / naturalLeadWidth, availableHeight / (naturalLeadWidth * 3 / 2));
  const leadWidth = naturalLeadWidth * leadScale;
  const leadHeight = leadWidth * 3 / 2;
  const blocks = [{
    item: weighted[0].item,
    x: inset,
    y: inset,
    width: leadWidth,
    height: leadHeight,
    mentions: weighted[0].weight
  }];

  const squarify = (entries, rectangle) => {
    if (!entries.length || rectangle.width <= 0 || rectangle.height <= 0) return;
    const entriesWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    const areaScale = rectangle.width * rectangle.height / entriesWeight;
    const remainingEntries = entries.map(entry => ({ ...entry, area: entry.weight * areaScale }));
    let remainingRectangle = { ...rectangle };

    const rowRectangles = (row, target) => {
      const rowArea = row.reduce((sum, entry) => sum + entry.area, 0);
      if (target.width >= target.height) {
        const rowWidth = rowArea / target.height;
        let y = target.y;
        return row.map(entry => {
          const height = entry.area / rowWidth;
          const result = { entry, x: target.x, y, width: rowWidth, height };
          y += height;
          return result;
        });
      }
      const rowHeight = rowArea / target.width;
      let x = target.x;
      return row.map(entry => {
        const width = entry.area / rowHeight;
        const result = { entry, x, y: target.y, width, height: rowHeight };
        x += width;
        return result;
      });
    };
    const rowScore = row => Math.max(...rowRectangles(row, remainingRectangle).map(result => {
      const aspect = result.width / result.height;
      const preferred = preferredBookTitleAspect(result.entry.item);
      return Math.max(aspect / preferred, preferred / aspect);
    }));
    const commitRow = row => {
      const results = rowRectangles(row, remainingRectangle);
      results.forEach(result => blocks.push({
        item: result.entry.item,
        mentions: result.entry.weight,
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height
      }));
      if (remainingRectangle.width >= remainingRectangle.height) {
        const usedWidth = results[0].width;
        remainingRectangle = {
          ...remainingRectangle,
          x: remainingRectangle.x + usedWidth,
          width: Math.max(0, remainingRectangle.width - usedWidth)
        };
      } else {
        const usedHeight = results[0].height;
        remainingRectangle = {
          ...remainingRectangle,
          y: remainingRectangle.y + usedHeight,
          height: Math.max(0, remainingRectangle.height - usedHeight)
        };
      }
    };

    let row = [];
    while (remainingEntries.length) {
      const candidate = remainingEntries[0];
      if (!row.length || rowScore([...row, candidate]) <= rowScore(row)) {
        row.push(remainingEntries.shift());
      } else {
        commitRow(row);
        row = [];
      }
    }
    if (row.length) commitRow(row);
  };

  const remaining = weighted.slice(1);
  if (remaining.length) {
    const rightRectangle = {
      x: inset + leadWidth,
      y: inset,
      width: availableWidth - leadWidth,
      height: availableHeight
    };
    const lowerRectangle = {
      x: inset,
      y: inset + leadHeight,
      width: leadWidth,
      height: availableHeight - leadHeight
    };
    const remainingArea = rightRectangle.width * rightRectangle.height + lowerRectangle.width * lowerRectangle.height;
    const targetLowerWeight = remaining.reduce((sum, entry) => sum + entry.weight, 0)
      * lowerRectangle.width * lowerRectangle.height / remainingArea;
    let lowerCount = 0;
    let lowerWeight = 0;
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidateWeight = lowerWeight + remaining[index].weight;
      if (lowerCount && Math.abs(targetLowerWeight - lowerWeight) <= Math.abs(targetLowerWeight - candidateWeight)) break;
      lowerWeight = candidateWeight;
      lowerCount += 1;
    }
    if (lowerRectangle.width <= 0 || lowerRectangle.height <= 0) {
      lowerCount = 0;
    } else if (remaining.length > 1) {
      lowerCount = Math.max(1, Math.min(lowerCount, remaining.length - 1));
    }
    const rightEntries = lowerCount ? remaining.slice(0, -lowerCount) : remaining;
    const lowerEntries = lowerCount ? remaining.slice(-lowerCount) : [];
    squarify(rightEntries, rightRectangle);
    squarify(lowerEntries, lowerRectangle);
  }
  const occupiedArea = blocks.reduce((sum, block) => sum + block.width * block.height, 0);
  return { blocks, occupancy: occupiedArea / (availableWidth * availableHeight) };
}

function bookLabelLines(title, maxCharacters, maxLines) {
  const lines = [];
  let remaining = title.trim();
  while (remaining && lines.length < maxLines) {
    if (remaining.length <= maxCharacters) {
      lines.push(remaining);
      remaining = "";
      break;
    }
    let splitAt = remaining.lastIndexOf(" ", maxCharacters + 1);
    if (splitAt < Math.floor(maxCharacters * .55)) {
      const nextSpace = remaining.indexOf(" ");
      splitAt = nextSpace === -1 ? remaining.length : nextSpace;
    }
    lines.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining && lines.length) lines[lines.length - 1] = `${lines.at(-1).slice(0, Math.max(1, maxCharacters - 1))}…`;
  return lines;
}

function bookTitleLayout(block, requestedSize) {
  const areaScale = Math.min(1.5, Math.max(1, Math.sqrt(block.width * block.height) / 130));
  const maximumSize = Math.max(8, Math.floor(requestedSize * areaScale));
  const spineWidth = Math.min(18, Math.max(6, block.width * .11));
  const horizontalPadding = Math.min(18, Math.max(7, block.width * .055));
  const textWidth = block.width - spineWidth - horizontalPadding * 2;
  let labelSize = maximumSize;
  let lines = [];
  let authorLine = "";
  let complete = false;
  const author = bookAuthor(block.item);
  while (labelSize >= 8) {
    const maxCharacters = Math.max(4, Math.floor(textWidth / (labelSize * .62)));
    const authorSize = Math.max(7, labelSize * .72);
    const maxLines = Math.max(1, Math.min(4, Math.floor((block.height - 14 - (author ? authorSize * 1.65 : 0)) / (labelSize * 1.15))));
    lines = bookLabelLines(block.item.name, maxCharacters, maxLines);
    authorLine = author ? bookLabelLines(author, Math.max(5, Math.floor(textWidth / (authorSize * .58))), 1)[0] : "";
    complete = Boolean(lines.length) && !lines.at(-1).endsWith("…") && lines.every(line => line.length <= maxCharacters);
    if (complete || labelSize === 8) break;
    labelSize -= 1;
  }
  const lineHeight = labelSize * 1.15;
  const authorSize = Math.max(7, labelSize * .72);
  const titleHeight = Math.max(labelSize, lines.length * lineHeight);
  const groupHeight = titleHeight + (authorLine ? authorSize * 1.65 : 0);
  const y = block.y + block.height / 2 - groupHeight / 2 + labelSize;
  return {
    labelSize,
    lines,
    authorLine,
    authorSize,
    complete,
    x: block.x + spineWidth + horizontalPadding,
    y,
    authorY: y + (lines.length - 1) * lineHeight + authorSize * 1.55
  };
}

function renderBook() {
  const { svg, width, height } = clearChart();
  const data = filteredEntities(["book"])
    .sort((left, right) => (right[state.config.size] || 0) - (left[state.config.size] || 0))
    .slice(0, state.config.limit);
  if (!data.length) return showEmpty();
  const extent = valueExtent(data, state.config.size);
  const { blocks } = bookshelfLayout(data, width, height);
  const defs = el("defs");
  const coverLight = el("linearGradient", { id: "book-cover-light", x1: "0", y1: "0", x2: "1", y2: "0" });
  coverLight.append(el("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": ".08" }));
  coverLight.append(el("stop", { offset: "1", "stop-color": "#000", "stop-opacity": ".05" }));
  const spineLight = el("linearGradient", { id: "book-spine-light", x1: "0", y1: "0", x2: "1", y2: "0" });
  spineLight.append(el("stop", { offset: "0", "stop-color": "#000", "stop-opacity": ".34" }));
  spineLight.append(el("stop", { offset: ".48", "stop-color": "#fff", "stop-opacity": ".2" }));
  spineLight.append(el("stop", { offset: "1", "stop-color": "#000", "stop-opacity": ".16" }));
  defs.append(coverLight, spineLight);
  svg.append(defs);
  blocks.forEach(block => {
    const shade = scale(block.item[state.config.size], extent, [.16, .94]);
    const gap = Math.min(3, Math.max(1, Math.min(block.width, block.height) * .025));
    const x = block.x + gap;
    const y = block.y + gap;
    const bookWidth = Math.max(1, block.width - gap * 2);
    const bookHeight = Math.max(1, block.height - gap * 2);
    const spineWidth = Math.min(18, Math.max(6, bookWidth * .11));
    const radius = Math.min(2, bookWidth * .02, bookHeight * .02);
    const group = el("g", {
      class: "mark book-volume", tabindex: "0", role: "button",
      "aria-label": `${block.item.name}${bookAuthor(block.item) ? ` by ${bookAuthor(block.item)}` : ""}. ${formatNumber(block.item.mentions)} mentions.`
    });
    const cover = el("rect", {
      x, y, width: bookWidth, height: bookHeight, rx: radius,
      fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": 1,
      class: "book-cover"
    });
    group.append(cover);
    group.append(el("rect", {
      x, y, width: bookWidth, height: bookHeight, rx: radius,
      fill: "url(#book-cover-light)", class: "book-cover-light"
    }));
    group.append(el("rect", {
      x, y, width: spineWidth, height: bookHeight, rx: radius,
      fill: "#111", "fill-opacity": shade, stroke: "none",
      class: "book-spine"
    }));
    group.append(el("rect", {
      x, y, width: spineWidth, height: bookHeight, rx: radius,
      fill: "url(#book-spine-light)", opacity: .16 + shade * .5, class: "book-spine-light"
    }));
    group.append(el("line", {
      x1: x + spineWidth, y1: y + 2, x2: x + spineWidth, y2: y + bookHeight - 2,
      "stroke-opacity": .16 + shade * .32, class: "book-spine-seam"
    }));
    addTitle(group, `${block.item.name} · Mentions: ${formatNumber(block.item.mentions)} · ${label(state.config.size)} shade: ${formatNumber(block.item[state.config.size])}`);
    group.addEventListener("click", () => inspectEntity(block.item));
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inspectEntity(block.item);
      }
    });
    svg.append(group);
    const shouldLabel = state.config.labels !== "none";
    if (!shouldLabel || block.width < 36 || block.height < 32) return;
    const titleLayout = bookTitleLayout(block, state.config.labelSize);
    if (!titleLayout.complete) return;
    const text = el("text", {
      x: titleLayout.x, y: titleLayout.y,
      fill: shade > .55 ? "#f6f5ef" : "#111", class: "book-label", "text-anchor": "start",
      style: `font-size:${titleLayout.labelSize}px;font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:.015em`
    });
    titleLayout.lines.forEach((line, lineIndex) => text.append(el("tspan", {
      x: titleLayout.x, dy: lineIndex ? "1.15em" : 0
    }, line)));
    svg.append(text);
    if (titleLayout.authorLine) {
      svg.append(el("text", {
        x: titleLayout.x, y: titleLayout.authorY,
        fill: shade > .55 ? "#f6f5ef" : "#111", class: "book-author", "text-anchor": "start",
        style: `font-size:${titleLayout.authorSize}px;font-family:var(--font);font-weight:500;letter-spacing:.01em`
      }, titleLayout.authorLine));
    }
  });
  drawIntensityLegend();
  const mentions = data.reduce((sum, item) => sum + (item.mentions || 0), 0);
  setSummary(`${data.length} books · ${formatNumber(mentions)} mentions · shade by ${label(state.config.size).toLowerCase()}`, "book");
}

function machineDataDocumentURL(document) {
  const input = state.catalog?.input || {};
  const repository = input.repository || "ufo-files/machine-data";
  const revision = input.revision || "main";
  const path = String(document.path || "").split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${repository}/blob/${encodeURIComponent(revision)}/${path}`;
}

function documentEntityCounts() {
  const counts = new Map(state.catalog.documents.map(document => [document.id, 0]));
  state.catalog.entities.forEach(entity => {
    (entity.documentIds || []).forEach(documentId => counts.set(documentId, (counts.get(documentId) || 0) + 1));
  });
  return counts;
}

function documentCardHTML(document, wordExtent) {
  const intensity = clampedScale(document.words, wordExtent, [.14, .94]);
  return `<article class="document-card">
    <button class="document-card-main" type="button" data-document-inspect="${escapeHTML(document.id)}">
      <span class="document-file-icon" aria-hidden="true" title="${formatNumber(document.words)} words" style="--document-intensity:${intensity};--document-icon-ink:${intensity > .56 ? "#f6f5ef" : "#111"}">TXT</span>
      <span class="document-file-copy"><strong>${escapeHTML(document.title || document.path)}</strong><small>${escapeHTML(document.path)}</small></span>
    </button>
    <div class="document-card-meta"><span>${escapeHTML(document.source)}</span><span>${formatNumber(document.entityCount)} published entities · ${formatNumber(document.words)} words</span></div>
    <a class="document-source-link" href="${escapeHTML(machineDataDocumentURL(document))}" target="_blank" rel="noopener noreferrer">Open ↗</a>
  </article>`;
}

function renderDocument() {
  hideMapView();
  const svg = $("#chart"), browser = $("#tableView");
  svg.setAttribute("hidden", "");
  svg.replaceChildren();
  browser.hidden = false;
  $("#chartWrap").classList.add("table-mode");
  $("#legend").innerHTML = "";
  const query = state.config.documentSearch.trim().toLocaleLowerCase();
  const entityCounts = documentEntityCounts();
  const scoped = state.catalog.documents.filter(document => sourceMatches(document.source)).map(document => ({ ...document, entityCount: entityCounts.get(document.id) || 0 }));
  const matching = scoped
    .filter(document => !query || [document.title, document.path, document.source, document.format, document.engine]
      .some(value => String(value || "").toLocaleLowerCase().includes(query)))
    .sort((left, right) => right.entityCount - left.entityCount || String(left.title || left.path).localeCompare(String(right.title || right.path), undefined, { numeric: true }));
  if (!matching.length) {
    browser.replaceChildren();
    return showEmpty();
  }
  browser.style.setProperty("--table-font-size", `${state.config.labelSize}px`);
  const { extent: wordExtent } = robustValueExtent(matching, "words");
  browser.innerHTML = `<div class="document-browser-status"><strong>${query ? "Search results" : "All documents"}</strong><span data-document-count></span></div><div class="document-browser" data-document-grid></div>`;
  const grid = $("[data-document-grid]");
  const count = $("[data-document-count]");
  let shown = 0;
  const appendBatch = () => {
    const batch = matching.slice(shown, shown + 100);
    if (!batch.length) return;
    grid.insertAdjacentHTML("beforeend", batch.map(document => documentCardHTML(document, wordExtent)).join(""));
    shown += batch.length;
    batch.forEach(document => $(`[data-document-inspect="${document.id}"]`)?.addEventListener("click", () => inspectDocument(state.documentById.get(document.id))));
    count.textContent = `${formatNumber(matching.length)} files · showing ${formatNumber(shown)}`;
    setSummary(`${formatNumber(matching.length)} documents · sorted by published entities · showing ${formatNumber(shown)}`, "document");
  };
  appendBatch();
  browser.onscroll = () => {
    if (shown < matching.length && browser.scrollTop + browser.clientHeight >= browser.scrollHeight - 240) appendBatch();
  };
  drawIntensityLegend();
}

function mapLocationData() {
  const locations = filteredEntities().filter(entity => entity.category === "location");
  const mapped = locations.filter(entity => Number.isFinite(entity.geo?.lat) && Number.isFinite(entity.geo?.lon))
    .sort((left, right) => (right[state.config.size] || 0) - (left[state.config.size] || 0));
  const lunar = mapped.filter(entity => entity.geo.body === "moon");
  const terrestrial = mapped.filter(entity => entity.geo.body !== "moon");
  const data = [...lunar, ...terrestrial.slice(0, Math.max(0, state.config.limit - lunar.length))]
    .slice(0, state.config.limit);
  return { mapped, data, unmapped: locations.length - mapped.length };
}

function aggregateDocuments() {
  const docs = state.catalog.documents.filter(doc => sourceMatches(doc.source));
  if (state.config.aggregation === "entity") {
    return filteredEntities().map(entity => ({ ...entity, source: entity.category }));
  }
  if (state.config.aggregation === "format") {
    return [...new Set(docs.map(doc => doc.format))].map(format => {
      const items = docs.filter(doc => doc.format === format);
      return { name: label(format), source: format, documents: items.length, words: items.reduce((sum, item) => sum + item.words, 0), bytes: items.reduce((sum, item) => sum + item.bytes, 0), documentIds: items.map(item => item.id) };
    });
  }
  return state.catalog.sources.filter(source => sourceMatches(source.name)).map(source => {
    const items = docs.filter(doc => doc.source === source.name);
    return { name: source.name, source: source.name, documents: items.length, words: items.reduce((sum, item) => sum + item.words, 0), bytes: items.reduce((sum, item) => sum + item.bytes, 0), documentIds: items.map(item => item.id) };
  });
}

function barChartLayout(height, itemCount) {
  const margin = { top: 20, bottom: 20 };
  const row = itemCount ? (height - margin.top - margin.bottom) / itemCount : 0;
  return {
    margin,
    row,
    barY: index => margin.top + index * row + 2,
    barHeight: Math.max(5, row - 5),
    labelY: index => margin.top + (index + .62) * row
  };
}

function renderBars() {
  const { svg, width, height } = clearChart();
  const data = aggregateDocuments().sort((a, b) => b[state.config.y] - a[state.config.y]).slice(0, state.config.limit);
  if (!data.length) return showEmpty();
  const layout = barChartLayout(height, data.length);
  const margin = { left: Math.min(190, width * .28), right: 45, ...layout.margin };
  const max = Math.max(...data.map(item => item[state.config.y]), 1);
  data.forEach((item, index) => {
    const barWidth = (width - margin.left - margin.right) * item[state.config.y] / max;
    svg.append(el("text", { x: margin.left - 8, y: layout.labelY(index), "text-anchor": "end", class: "chart-label" }, item.name.slice(0, 27)));
    const opacity = .14 + item[state.config.y] / max * .86;
    const rect = el("rect", { x: margin.left, y: layout.barY(index), width: Math.max(2, barWidth), height: layout.barHeight, rx: 1, fill: "#111", "fill-opacity": opacity, stroke: "#111", "stroke-width": 1, class: "mark" });
    addTitle(rect, `${item.name} · ${formatNumber(item[state.config.y])} ${label(state.config.y)}`);
    rect.addEventListener("click", () => state.config.aggregation === "entity" ? inspectEntity(item) : inspectGroup(item)); svg.append(rect);
    svg.append(el("text", { x: Math.min(width - 5, margin.left + barWidth + 6), y: layout.labelY(index), class: "axis-label" }, formatNumber(item[state.config.y])));
  });
  drawIntensityLegend();
  setSummary(`${data.length} ${state.config.aggregation === "entity" ? "entities" : state.config.aggregation === "source" ? "collections" : "formats"}`, "bars");
}

function renderTimeline() {
  const { svg, width, height } = clearChart();
  const candidates = (state.config.timelineRole === "event"
    ? (state.catalog.events || []).filter(item => item.startDate && item.confidence >= .9 && item.documentIds.some(id => sourceMatches(state.documentById.get(id)?.source)))
    : state.config.timelineRole === "entity"
    ? filteredEntities().map(entity => {
        const documents = entity.documentIds.map(id => state.documentById.get(id)).filter(document => document?.documentDate && sourceMatches(document.source)).sort((a, b) => new Date(a.documentDate) - new Date(b.documentDate));
        return documents.length ? { ...entity, title: entity.name, documentDate: documents[0].documentDate, source: documents[0].source, format: documents[0].format, entityRecord: entity } : null;
      }).filter(Boolean)
    : state.catalog.documents.filter(item => item.documentDate && sourceMatches(item.source)));
  const data = candidates.sort((a, b) => state.config.timelineRole === "event"
    ? new Date(a.startDate) - new Date(b.startDate) || a.title.localeCompare(b.title)
    : (b[state.config.y] || 0) - (a[state.config.y] || 0)).slice(0, state.config.limit);
  if (state.config.timelineRole === "event") data.forEach((item, index) => { item.timelineLane = index % 7 + 1; });
  if (!data.length) return showEmpty();
  const timelineDate = item => item.startDate || item.documentDate;
  const dates = data.map(item => new Date(timelineDate(item)).getTime());
  const xExtent = [Math.min(...dates), Math.max(...dates) + 1];
  const yExtent = state.config.timelineRole === "event" ? [1, 7] : valueExtent(data, state.config.y);
  const sizeExtent = valueExtent(data, state.config.size);
  const margin = drawAxes(svg, width, height, state.config.timelineRole === "event" ? "startDate" : "documentDate", state.config.y, xExtent, yExtent);
  const positionFor = item => ({
    x: clampedScale(new Date(timelineDate(item)).getTime(), xExtent, [margin.left, width - margin.right]),
    y: clampedScale(item[state.config.y], yExtent, [height - margin.bottom, margin.top])
  });
  const eventEntityNames = new Map((state.catalog.entities || []).map(entity => [entity.id, entity.name]));
  const eventLabel = item => {
    const entities = (item.entityIds || []).map(id => eventEntityNames.get(id)).filter(Boolean);
    const entity = entities.find(name => item.title.toLowerCase().includes(name.toLowerCase())) || entities[0];
    return entity ? `${entity} · ${label(item.eventType)}` : item.title.slice(0, 18);
  };
  let relationshipLayer = null;
  const relationshipLines = new Map();
  const relationshipNodes = new Map();
  let egoNetworks = new Map();
  if (state.config.timelineRole === "event" && state.config.relationshipLayer !== "off") {
    relationshipLayer = el("g", { class: `scatter-relationship-layer relationship-${state.config.relationshipLayer} strength-${state.config.relationshipStrength}` });
    const links = new Map();
    data.forEach(item => {
      const related = data.filter(candidate => candidate.id !== item.id).map(candidate => {
        const shared = (item.entityIds || []).filter(id => (candidate.entityIds || []).includes(id));
        return { candidate, shared };
      }).filter(link => link.shared.length).sort((a, b) => b.shared.length - a.shared.length).slice(0, state.config.relationshipNeighbors);
      related.forEach(({ candidate, shared }) => {
        const ids = [item.id, candidate.id].sort();
        const key = ids.join("|");
        if (!links.has(key) || shared.length > links.get(key).shared.length) links.set(key, { source: item, target: candidate, shared });
      });
    });
    links.forEach(({ source, target, shared }) => {
        const a = positionFor(source), b = positionFor(target);
        const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "scatter-relationship-line", "stroke-width": Math.min(2, .7 + shared.length * .25) });
        addTitle(line, `Shared: ${shared.map(id => eventEntityNames.get(id)).filter(Boolean).join(", ")}`);
        [source.id, target.id].forEach(id => {
          if (!relationshipLines.has(id)) relationshipLines.set(id, []);
          relationshipLines.get(id).push(line);
        });
        relationshipLayer.append(line);
    });
    svg.append(relationshipLayer);
  } else if (state.config.timelineRole !== "event" && state.config.relationshipLayer !== "off") {
    egoNetworks = state.config.timelineRole === "entity"
      ? scatterEgoNetworks(candidates, data, state.config.relationshipNeighbors)
      : documentRelationshipNetworks(candidates, data, state.config.relationshipNeighbors);
    const overlay = scatterRelationshipOverlay(egoNetworks, data);
    const entityById = new Map([...candidates, ...overlay.nodes].map(entity => [entity.id, entity]));
    relationshipLayer = el("g", { class: `scatter-relationship-layer relationship-${state.config.relationshipLayer} strength-${state.config.relationshipStrength}` });
    overlay.edges.forEach(relationship => {
      const source = entityById.get(relationship.source), target = entityById.get(relationship.target);
      if (!source || !target) return;
      const a = positionFor(source), b = positionFor(target);
      const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "scatter-relationship-line", "stroke-width": Math.min(2, .4 + Math.sqrt(relationship.edge.evidenceCount) * .22) });
      [relationship.source, relationship.target].forEach(id => {
        if (!relationshipLines.has(id)) relationshipLines.set(id, []);
        relationshipLines.get(id).push(line);
      });
      relationshipLayer.append(line);
    });
    overlay.nodes.forEach(node => {
      const point = positionFor(node);
      const radius = state.config.relationshipNodeSize === "fixed" ? 4 : scale(node[state.config.size], sizeExtent, [2.5, 8]);
      const secondary = el("circle", { cx: point.x, cy: point.y, r: radius, class: "scatter-secondary-node mark" });
      secondary.addEventListener("click", () => state.config.timelineRole === "entity" ? inspectEntity(node.entityRecord || node) : inspectDocument(node));
      relationshipNodes.set(node.id, secondary);
      relationshipLayer.append(secondary);
    });
    svg.append(relationshipLayer);
  }
  data.forEach((item, index) => {
    const { x, y } = positionFor(item);
    const radius = scale(item[state.config.size], sizeExtent, [3, 12]);
    const shade = scale(item[state.config.size], sizeExtent, [.18, .96]);
    const dot = el("circle", { cx: x, cy: y, r: radius, fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": 1, class: "mark" });
    addTitle(dot, `${item.title} · ${new Date(timelineDate(item)).toLocaleDateString()}`);
    dot.addEventListener("click", () => state.config.timelineRole === "event" ? inspectEvent(item) : item.entityRecord ? inspectEntity(item.entityRecord) : inspectDocument(item));
    dot.addEventListener("mouseenter", () => {
      if (!relationshipLayer) return;
      relationshipLayer.classList.add("has-focus");
      (relationshipLines.get(item.id) || []).forEach(line => line.classList.add("is-focused"));
      (egoNetworks.get(item.id)?.neighbors || []).forEach(neighbor => relationshipNodes.get(neighbor.entity.id)?.classList.add("is-focused"));
    });
    dot.addEventListener("mouseleave", () => {
      if (!relationshipLayer) return;
      relationshipLayer.classList.remove("has-focus");
      (relationshipLines.get(item.id) || []).forEach(line => line.classList.remove("is-focused"));
      (egoNetworks.get(item.id)?.neighbors || []).forEach(neighbor => relationshipNodes.get(neighbor.entity.id)?.classList.remove("is-focused"));
    });
    svg.append(dot);
    if (state.config.labels === "all" || (state.config.labels === "top" && index < 12)) {
      const right = index % 2 === 0;
      const labelY = index % 4 < 2 ? Math.max(margin.top + 10, y - radius - 5) : Math.min(height - margin.bottom - 4, y + radius + state.config.labelSize);
      svg.append(el("text", { x: x + (right ? radius + 4 : -radius - 4), y: labelY, "text-anchor": right ? "start" : "end", "font-size": 10, class: "chart-label node-label" }, eventLabel(item).slice(0, 18)));
    }
  });
  drawIntensityLegend();
  setSummary(`${data.length} ${state.config.timelineRole === "event" ? "evidence-backed events" : state.config.timelineRole === "entity" ? "entities" : "dated source documents"}`, "timeline");
}

function matrixEntityInterest(entity, sources) {
  const counts = sources.map(source => entity.documentIds.filter(id => state.documentById.get(id)?.source === source.name).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return 0;
  const strongestCollection = Math.max(...counts);
  const activeCollections = counts.filter(Boolean).length;
  const concentration = strongestCollection / total;
  const distinctiveness = 1 + (sources.length - activeCollections) / Math.max(1, sources.length);
  return Math.log1p(total) * concentration * distinctiveness;
}

function renderMatrix() {
  const { svg, width, height } = clearChart();
  const sources = state.catalog.sources.filter(item => sourceMatches(item.name));
  const columns = state.config.matrixColumns === "entity"
    ? filteredEntities().map(entity => ({ entity, interest: matrixEntityInterest(entity, sources) })).sort((a, b) => b.interest - a.interest || b.entity.contextAdjustedMentions - a.entity.contextAdjustedMentions).slice(0, Math.min(state.config.limit, 12)).map(({ entity }) => ({ id: entity.id, label: entity.name, category: entity.category, entity }))
    : state.config.categories.map(category => ({ id: category, label: label(category), category }));
  if (!sources.length || !columns.length) return showEmpty();
  const counts = [];
  sources.forEach(source => columns.forEach(column => {
    const value = column.entity
      ? column.entity.documentIds.filter(id => state.documentById.get(id)?.source === source.name).length
      : state.catalog.entities.filter(entity => entity.category === column.category && entity.classificationConfidence >= state.config.minConfidence && entity.documentIds.some(id => state.documentById.get(id)?.source === source.name)).length;
    counts.push({ source: source.name, category: column.category, columnId: column.id, columnLabel: column.label, entityId: column.entity?.id, value });
  }));
  const margin = { left: Math.min(175, width * .3), right: 25, top: 70, bottom: 25 };
  const cellW = (width - margin.left - margin.right) / columns.length, cellH = (height - margin.top - margin.bottom) / sources.length;
  const max = Math.max(...counts.map(item => item.value), 1);
  columns.forEach((column, index) => svg.append(el("text", { x: margin.left + (index + .5) * cellW, y: margin.top - 12, "text-anchor": "middle", class: "chart-label" }, column.label.slice(0, state.config.matrixColumns === "entity" ? 12 : 15))));
  sources.forEach((source, index) => svg.append(el("text", { x: margin.left - 8, y: margin.top + (index + .55) * cellH, "text-anchor": "end", class: "chart-label" }, source.name.slice(0, 24))));
  counts.forEach(item => {
    const row = sources.findIndex(source => source.name === item.source), column = columns.findIndex(candidate => candidate.id === item.columnId);
    const opacity = .08 + item.value / max * .92;
    const rect = el("rect", { x: margin.left + column * cellW + 1, y: margin.top + row * cellH + 1, width: Math.max(2, cellW - 2), height: Math.max(2, cellH - 2), fill: "#111", "fill-opacity": opacity, stroke: "none", class: "mark" });
    addTitle(rect, `${item.source} · ${item.columnLabel}: ${item.value}`); rect.addEventListener("click", () => inspectMatrix(item)); svg.append(rect);
  });
  drawIntensityLegend();
  setSummary(`${sources.length} collections × ${columns.length} ${state.config.matrixColumns === "entity" ? "entities" : "entity types"}`, "matrix");
}

function tableRecords() {
  let records;
  if (state.config.tableRole === "document") {
    records = state.catalog.documents.filter(item => sourceMatches(item.source));
  } else if (state.config.tableRole === "source") {
    records = state.catalog.sources
      .filter(item => sourceMatches(item.name))
      .map(item => ({ ...item, documentIds: state.catalog.documents.filter(document => document.source === item.name).map(document => document.id) }));
  } else {
    records = filteredEntities();
  }
  const query = state.config.tableSearch.trim().toLocaleLowerCase();
  if (query) records = records.filter(item => TABLE_FIELDS[state.config.tableRole].some(field => String(item[field] ?? "").toLocaleLowerCase().includes(query)));
  const sortField = TABLE_FIELDS[state.config.tableRole].includes(state.config.tableSort) ? state.config.tableSort : TABLE_FIELDS[state.config.tableRole][0];
  const direction = state.config.tableDirection === "asc" ? 1 : -1;
  return records.sort((a, b) => {
    const left = a[sortField] ?? "", right = b[sortField] ?? "";
    if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
}

function tableDisplayValue(item, field) {
  const value = item[field];
  if (value == null || value === "") return "—";
  if (["classificationConfidence", "extractionConfidence", "inflationRate", "documentInflationRate"].includes(field)) return `${Math.round(value * 100)}%`;
  if (field === "createdAt") return new Date(value).toLocaleString();
  if (field === "durationMs") return `${Number(value).toLocaleString()} ms`;
  if (["category", "reviewStatus", "inflationRisk", "format"].includes(field)) return label(value);
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function renderTable() {
  hideMapView();
  const svg = $("#chart"), tableView = $("#tableView");
  svg.setAttribute("hidden", "");
  svg.replaceChildren();
  tableView.hidden = false;
  $("#chartWrap").classList.add("table-mode");
  $("#legend").innerHTML = "";
  const fields = state.config.tableColumns.filter(field => TABLE_FIELDS[state.config.tableRole].includes(field));
  const records = tableRecords();
  if (!fields.length || !records.length) {
    tableView.replaceChildren();
    return showEmpty();
  }
  tableView.style.setProperty("--table-font-size", `${state.config.labelSize}px`);
  const rowLabel = state.config.tableRole === "entity" ? "entities" : state.config.tableRole === "document" ? "transcript files" : "collections";
  tableView.innerHTML = `<table class="builder-table"><thead><tr>${fields.map(field => `<th scope="col">${escapeHTML(label(field))}</th>`).join("")}</tr></thead><tbody data-table-body></tbody></table>`;
  const body = $("[data-table-body]");
  let shown = 0;
  const inspectRow = row => {
    const item = records[Number(row.dataset.tableRow)];
    if (state.config.tableRole === "entity") inspectEntity(item);
    else if (state.config.tableRole === "document") inspectDocument(item);
    else inspectGroup(item);
  };
  body.addEventListener("click", event => {
    const row = event.target.closest("[data-table-row]");
    if (row) inspectRow(row);
  });
  body.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    const row = event.target.closest("[data-table-row]");
    if (!row) return;
    event.preventDefault();
    inspectRow(row);
  });
  const appendBatch = () => {
    const batch = records.slice(shown, shown + 100);
    if (!batch.length) return;
    body.insertAdjacentHTML("beforeend", batch.map((item, index) => `<tr tabindex="0" data-table-row="${shown + index}">${fields.map(field => `<td>${escapeHTML(tableDisplayValue(item, field))}</td>`).join("")}</tr>`).join(""));
    shown += batch.length;
    setSummary(`${records.length} ${rowLabel} · showing ${shown} · ${fields.length} columns`, "table");
  };
  appendBatch();
  tableView.onscroll = () => {
    if (shown < records.length && tableView.scrollTop + tableView.clientHeight >= tableView.scrollHeight - 240) appendBatch();
  };
}

function showEmpty() {
  $("#emptyState").hidden = false;
  setSummary("No matching records", state.config.type);
}

function setSummary(text, type) {
  $("#resultSummary").textContent = text;
  $("#graphKicker").textContent = type === "document" ? "Documents" : label(type === "bars" ? "bar chart" : type);
  $("#policySummary").textContent = type === "network"
    ? state.config.nodeRole === "collection" ? `Links require ${state.config.minEvidence} shared published entities` : `Co-mentions require ${state.config.minEvidence} evidence segments · dense OCR sections excluded`
    : type === "map" ? "Coordinates come from the reviewed local gazetteer · ambiguous names omitted"
    : type === "book" ? "Titles require an explicit book, novel, or memoir cue in transcript text"
    : type === "document" ? "Sorted by published-entity count · TXT shade represents document length · source links open the exact machine-data file"
    : `${formatNumber(state.catalog.counts.documents)} source files · transcript text unchanged`;
}

function syncMapAnimationButton(playing = window.ufoGlobe?.autoRotate || false) {
  const button = $("#mapAnimationButton");
  const action = playing ? "Pause" : "Play";
  button.textContent = action;
  button.setAttribute("aria-label", `${action} map animation`);
  button.setAttribute("aria-pressed", String(playing));
}

function renderGraph() {
  if (!state.catalog) return;
  $("#emptyState").hidden = true;
  $("#graphTitle").textContent = state.config.title;
  $("#resetZoom").hidden = !["network", "map"].includes(state.config.type);
  $("#mapAnimationButton").hidden = state.config.type !== "map";
  if (state.config.type === "map") syncMapAnimationButton();
  $("#exportButton").textContent = "Export PDF";
  const descriptions = {
    network: state.config.nodeRole === "collection" ? "Collections connected by shared published entities." : "Evidence-backed connections across the local archive.", scatter: `${label(state.config.x)} compared with ${label(state.config.y)}.`,
    map: `Geocoded location entities sized by ${label(state.config.size)}.`,
    book: `Transcript-mentioned books with area weighted by Mentions; shade represents ${label(state.config.size)}.`,
    document: "Find completed OCR and transcript files across the selected collections.",
    bars: `${label(state.config.y)} grouped by ${label(state.config.aggregation)}.`,
    timeline: state.config.timelineRole === "event" ? "Evidence-backed events by occurrence date." : `${state.config.timelineRole === "entity" ? "Entities" : "Documents"} by document date.`,
    matrix: `${state.config.matrixColumns === "entity" ? "Entity" : "Entity-type"} coverage across completed collections.`,
    table: `A custom list of ${state.config.tableRole === "entity" ? "entities" : state.config.tableRole === "document" ? "transcript files" : "collections"}.`
  };
  $("#graphSubtitle").textContent = descriptions[state.config.type];
  ({ network: renderNetwork, map: renderMap, book: renderBook, document: renderDocument, scatter: renderScatter, bars: renderBars, timeline: renderTimeline, matrix: renderMatrix, table: renderTable })[state.config.type]();
}

function evidenceHTML(evidence = []) {
  if (!evidence.length) return "<p>No excerpt stored for this derived summary.</p>";
  return evidence.map(item => {
    const doc = state.documentById.get(item.documentId);
    return `<div class="evidence-card"><p>“${escapeHTML(item.excerpt)}”</p><small>${escapeHTML(doc?.path || item.documentId)}</small></div>`;
  }).join("");
}

function refreshGraphAfterInspectorResize() {
  if (state.catalog) requestAnimationFrame(renderGraph);
}

function setGraphFullScreen(enabled) {
  const button = $("#fullScreenButton");
  const label = enabled ? "Exit full screen" : "View full screen";
  document.body.classList[enabled ? "add" : "remove"]("graph-fullscreen");
  button.setAttribute("aria-pressed", String(enabled));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  if (state.catalog) requestAnimationFrame(renderGraph);
}

function toggleGraphFullScreen() {
  setGraphFullScreen(!document.body.classList.contains("graph-fullscreen"));
}

function setMobileControls(open) {
  const button = $("#controlsButton");
  $("#builderView").classList[open ? "add" : "remove"]("controls-open");
  if (!button) return;
  const label = open ? "Hide graph controls" : "Show graph controls";
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

function closeInspector() {
  $("#builderView").classList.add("inspector-collapsed");
  $("#inspector").classList.remove("has-selection");
  refreshGraphAfterInspectorResize();
}

function showInspector(category, title, metrics, evidence, note = "", subtitle = "") {
  const inspector = $("#inspector");
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">${escapeHTML(label(category))}</p><h3>${escapeHTML(title)}</h3>${subtitle ? `<p class="inspect-subtitle">${escapeHTML(subtitle)}</p>` : ""}${note ? `<p>${escapeHTML(note)}</p>` : ""}<div class="metric-row">${metrics.map(([value, name]) => `<div class="metric"><strong>${escapeHTML(formatNumber(value))}</strong><small>${escapeHTML(name)}</small></div>`).join("")}</div><div class="evidence-list"><h4>Evidence</h4>${evidenceHTML(evidence)}</div>`;
  refreshGraphAfterInspectorResize();
}

function inspectDuplicateCandidates() {
  const candidates = state.catalog?.duplicateCandidates || [];
  const total = state.catalog?.counts?.possibleDuplicates || candidates.length;
  const inspector = $("#inspector");
  state.selected = null;
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const cards = candidates.map(item => `<div class="duplicate-card"><small>${escapeHTML(label(item.category))} · ${Math.round(item.similarity * 100)}% similar · ${escapeHTML(item.reason)}</small><strong>${escapeHTML(item.left.name)}</strong><span>↕</span><strong>${escapeHTML(item.right.name)}</strong><p>${formatNumber(item.left.mentions)} + ${formatNumber(item.right.mentions)} mentions</p></div>`).join("");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Identity review</p><h3>Possible duplicates</h3><p>${formatNumber(total)} likely pair${total === 1 ? "" : "s"} flagged during the latest rebuild. Similarity never merges entities automatically; confirmed matches belong in <code>data/entity_aliases.json</code>.</p><div class="evidence-list"><h4>Review queue</h4>${cards || "<p>No unresolved duplicate candidates.</p>"}</div>`;
  refreshGraphAfterInspectorResize();
}

function inspectEntity(item) {
  state.selected = item;
  const mentionRate = item.inflationRate || 0;
  const prominenceRate = item.documentInflationRate || 0;
  const signals = item.inflationSignals || {};
  const signalDetails = [
    signals.repeatedContextMentions ? `${formatNumber(signals.repeatedContextMentions)} repeated-text mentions` : "",
    signals.administrativeMentions ? `${formatNumber(signals.administrativeMentions)} requester-metadata mentions` : "",
    signals.withinDocumentDuplicates ? `${formatNumber(signals.withinDocumentDuplicates)} within-document repeats` : "",
    signals.legacySourceConcentration ? `${formatNumber(signals.legacySourceConcentration)} mentions concentrated in one legacy-catalog source` : ""
  ].filter(Boolean).join("; ");
  const inflationNote = item.inflationRisk === "low"
    ? `Low prominence-inflation risk. ${Math.round(mentionRate * 100)}% of raw mentions are context-adjusted without materially reducing document coverage${signalDetails ? ` (${signalDetails})` : ""}.`
    : `${label(item.inflationRisk)} prominence inflation risk: ${Math.round(prominenceRate * 100)}% of raw document appearances and ${Math.round(mentionRate * 100)}% of raw mentions are discounted by the context heuristic${signalDetails ? ` (${signalDetails})` : ""}.`;
  const geographyNote = item.geo ? ` Mapped at ${item.geo.lat.toFixed(3)}, ${item.geo.lon.toFixed(3)} (${label(item.geo.precision)}).` : "";
  const egoStats = item.egoNetwork ? [[item.egoNetwork.total, "connected entities"]] : [];
  const egoNote = item.egoNetwork?.neighbors.length
    ? ` Strongest visible relationships: ${item.egoNetwork.neighbors.map(neighbor => `${neighbor.entity.name} (${neighbor.edge.evidenceCount})`).join(", ")}.`
    : "";
  showInspector(item.category, item.name, [...egoStats, [item.contextAdjustedMentions ?? item.mentions, "adjusted mentions"], [item.mentions, "raw mentions"], [item.independentDocumentCount ?? item.documentCount, "independent documents"], [item.sourceCount, "collections"]], item.evidence, `${inflationNote}${geographyNote}${egoNote} ${label(item.reviewStatus)} · ${item.variants.length} observed name variant${item.variants.length === 1 ? "" : "s"}`, item.category === "book" ? bookAuthor(item) : "");
}

function inspectEdge(edge) {
  const left = state.catalog.entities.find(item => item.id === edge.source), right = state.catalog.entities.find(item => item.id === edge.target);
  showInspector(edge.relationship, `${left?.name || "Entity"} ↔ ${right?.name || "Entity"}`, [[edge.evidenceCount, "segments"], [edge.documentCount, "documents"], [`${Math.round(edge.confidence * 100)}%`, "confidence"]], edge.evidence, "A typed edge requires same-segment relation language; a co-mention requires repeat evidence.");
}

function inspectCollectionEdge(edge, nodes) {
  const left = nodes.find(item => item.id === edge.source), right = nodes.find(item => item.id === edge.target);
  const names = edge.sharedEntities.slice(0, 8).map(entity => entity.name).join(", ");
  const remainder = Math.max(0, edge.sharedEntities.length - 8);
  showInspector("shared_entities", `${left?.name || "Collection"} ↔ ${right?.name || "Collection"}`, [[edge.evidenceCount, "shared entities"], [edge.documentCount, "documents"], [`${Math.round(edge.confidence * 100)}%`, "avg. classification"]], edge.evidence, `${names}${remainder ? `, and ${remainder} more` : ""}`);
}

function inspectGroup(item) {
  const docs = item.documentIds.map(id => state.documentById.get(id)).filter(Boolean);
  showInspector("collection", item.name, [[item.documents, "documents"], [item.words, "words"], [item.bytes, "source bytes"]], docs.slice(0, 4).map(doc => ({ documentId: doc.id, excerpt: doc.title })), "An aggregate of completed transcript files; it does not alter source content.");
}

function inspectDocument(item) {
  const dateEvidence = item.documentDateEvidence
    ? [{ documentId: item.id, excerpt: `${item.documentDate}: ${item.documentDateEvidence.excerpt}` }]
    : [{ documentId: item.id, excerpt: `Completed ${new Date(item.createdAt).toLocaleString()}` }];
  showInspector(item.format, item.title, [[item.words, "words"], [item.segments, "segments"], [item.bytes, "source bytes"]], dateEvidence, item.documentDate ? `${item.source} · document date via ${item.documentDateEvidence.method}` : item.source);
}

function inspectEvent(item) {
  showInspector(item.eventType, item.title, [[new Date(item.startDate).toLocaleDateString(), "event date"], [`${Math.round(item.confidence * 100)}%`, "confidence"], [item.documentIds.length, "documents"]], item.evidence, "Includes explicit incident dates and source-backed disclosure, hearing, program, and official-report milestones. FOIA processing and cataloging dates remain excluded.");
}

function inspectMatrix(item) {
  if (item.entityId) {
    const entity = state.catalog.entities.find(candidate => candidate.id === item.entityId);
    const documentIds = entity.documentIds.filter(id => state.documentById.get(id)?.source === item.source);
    showInspector(entity.category, `${item.source} × ${entity.name}`, [[item.value, "documents"], [entity.mentions, "total mentions"], [entity.sourceCount, "collections"]], entity.evidence.filter(evidence => documentIds.includes(evidence.documentId)), "This cell measures documents containing the entity in this collection.");
    return;
  }
  const entities = state.catalog.entities.filter(entity => entity.category === item.category && entity.documentIds.some(id => state.documentById.get(id)?.source === item.source));
  showInspector(item.category, `${item.source} × ${label(item.category)}`, [[item.value, "entities"], [new Set(entities.flatMap(entity => entity.documentIds)).size, "documents"]], entities.slice(0, 4).flatMap(entity => entity.evidence.slice(0, 1)), "Distinct published entities with evidence in this collection.");
}

const UFO_FILES_URL = "https://ufo-files.app";
const UFO_FILES_GITHUB_URL = "https://github.com/ufo-files";
const GRAPH_BUILDER_URL = "https://ufo-files.github.io/relationship-graph-builder/";

function pdfExportTitle(config = state.config) {
  const title = String(config.title || "").trim();
  return !title || /^untitled(?: graph)?$/i.test(title) ? dataAwareTitle(config) : title;
}

function pdfFilename(title) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ufo-files-graph"}.pdf`;
}

function pdfProvenance(exportedAt) {
  const input = state.catalog.input || {};
  const revision = input.revision || "Not recorded";
  const repository = input.repository || "ufo-files/machine-data";
  const generatedAt = state.catalog.generatedAt ? new Date(state.catalog.generatedAt).toISOString() : "Not recorded";
  return [
    ["VIEW", dataAwareTitle(state.config)],
    ["EXPORTED", exportedAt.toISOString()],
    ["CATALOG GENERATED", generatedAt],
    ["SOURCE OF TRUTH", repository],
    ["SOURCE REVISION", revision]
  ];
}

function currentGraphURL() {
  persistHash();
  return new URL(location.hash, GRAPH_BUILDER_URL).href;
}

function graphQRCode(url) {
  if (typeof window.qrcode !== "function") throw new Error("QR code generator unavailable");
  for (const level of ["M", "L"]) {
    try {
      const code = window.qrcode(0, level);
      code.addData(url, "Byte");
      code.make();
      return code;
    } catch (error) {
      if (!String(error?.message || error).includes("code length overflow")) throw error;
    }
  }
  return null;
}

function pdfGraphPropertyValue(key, value) {
  if (key === "sources" && state.config.allSources) return "All";
  if (Array.isArray(value)) return value.length ? value.map(item => label(item)).join(", ") : "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === "") return "None";
  if (key === "minConfidence") return `${Math.round(value * 100)}%`;
  if (key === "labelSize") return `${value}px`;
  if (key === "zoom") return `${Number(value).toFixed(1)}×`;
  if (key === "moonTransitSeconds") return `${value}s`;
  if (typeof value === "string" && !["title", "tableSearch", "documentSearch"].includes(key)) return label(value);
  return String(value);
}

function pdfGraphProperties() {
  const config = state.config;
  const properties = [];
  const add = (name, key, value = config[key]) => properties.push([name, pdfGraphPropertyValue(key, value)]);
  const addText = (name, value) => properties.push([name, value]);
  const usesRelationships = ["scatter", "map", "timeline"].includes(config.type);
  const usesEntities = config.type === "table"
    ? config.tableRole === "entity"
    : config.type !== "document" && (config.type === "timeline" || !["bars", "timeline"].includes(config.type) || config.aggregation === "entity" || config.timelineRole === "entity");

  add("Graph type", "type");
  if (config.type === "network") {
    add("Nodes", "nodeRole"); add("Relationship", "relation");
  } else if (config.type === "map") {
    addText("Marks", "Geocoded locations"); addText("Position", "Reviewed coordinates"); add("Relationship", "relation");
  } else if (config.type === "book") {
    addText("Marks", "Book titles"); addText("Layout", "Mention-weighted cover area");
  } else if (config.type === "document") {
    addText("Rows", "Completed transcript files"); addText("Layout", "Searchable file browser");
  } else if (config.type === "scatter") {
    add("X axis", "x"); add("Y axis", "y"); add("Relationship", "relation");
  } else if (config.type === "bars") {
    add("Group by", "aggregation"); add("Measure", "y");
  } else if (config.type === "timeline") {
    add("Marks", "timelineRole"); add("X axis", "x"); add("Y axis", "y");
    config.timelineRole === "entity" ? add("Relationship", "relation") : addText("Relationship", "Shared published entities");
  } else if (config.type === "matrix") {
    addText("Rows", "Collections"); add("Columns", "matrixColumns");
  } else {
    add("Rows", "tableRole"); add("Columns", "tableColumns");
  }

  if (["scatter", "network", "timeline", "map", "book"].includes(config.type)) {
    add(config.type === "book" ? "Shade" : "Size + shade", "size");
    addText("Shade scale", "Monochrome value scale");
    add("Labels", "labels");
  } else if (["bars", "matrix"].includes(config.type)) {
    addText("Shade scale", "Monochrome value scale");
  }
  if (usesRelationships) {
    add("Relationship layer", "relationshipLayer");
    add("Connections per node", "relationshipNeighbors");
    add("Secondary-node size", "relationshipNodeSize");
    add("Line strength", "relationshipStrength");
  }
  if (config.type === "table") { add("Sort by", "tableSort"); add("Direction", "tableDirection"); }

  if (config.type === "document") add("Document search", "documentSearch");
  if (config.type === "table") add("Table search", "tableSearch");
  addText("Collections", config.allSources ? "All collections" : pdfGraphPropertyValue("sources", config.sources));
  if (usesEntities) add("Minimum confidence", "minConfidence");
  if (config.type === "network" || usesRelationships && config.relationshipLayer !== "off") add("Minimum evidence", "minEvidence");
  if (!["document", "table"].includes(config.type)) add("Maximum marks", "limit");
  if (usesEntities) add("Include high-inflation", "includeHighInflation");
  if (usesEntities || config.type === "document") add("Entity categories", "categories");
  return properties;
}

let pdfLogoPath;
const PDF_FONT_FAMILY = "IBM Plex Mono";
const PDF_FONTS = [
  { file: "IBMPlexMono-Regular.ttf", style: "normal" },
  { file: "IBMPlexMono-Bold.ttf", style: "bold" }
];

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function loadPDFFonts(pdf) {
  const fonts = await Promise.all(PDF_FONTS.map(async font => {
    const response = await fetch(`assets/fonts/${font.file}`);
    if (!response.ok) throw new Error(`PDF font unavailable: ${response.status} ${response.statusText}`);
    return { ...font, data: arrayBufferToBase64(await response.arrayBuffer()) };
  }));
  fonts.forEach(font => {
    pdf.addFileToVFS(font.file, font.data);
    pdf.addFont(font.file, PDF_FONT_FAMILY, font.style);
  });
}

async function loadPDFLogoPath() {
  if (pdfLogoPath) return pdfLogoPath;
  const response = await fetch("assets/logo.svg");
  if (!response.ok) throw new Error(`Logo unavailable: ${response.status} ${response.statusText}`);
  const source = await response.text();
  pdfLogoPath = source.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1];
  if (!pdfLogoPath) throw new Error("Logo path unavailable");
  return pdfLogoPath;
}

function svgPathOperations(pathData, bounds) {
  const tokens = pathData.match(/[MCLHVZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || [];
  const scale = Math.min(bounds.width / 460, bounds.height / 433);
  const offsetX = bounds.x + (bounds.width - 460 * scale) / 2;
  const offsetY = bounds.y + (bounds.height - 433 * scale) / 2;
  const point = (x, y) => [offsetX + x * scale, offsetY + y * scale];
  const operations = [];
  let index = 0;
  let command = "";
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  const number = () => Number(tokens[index++]);
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++].toUpperCase();
    if (command === "M") {
      currentX = number(); currentY = number(); startX = currentX; startY = currentY;
      operations.push({ op: "m", c: point(currentX, currentY) }); command = "L";
    } else if (command === "L") {
      currentX = number(); currentY = number(); operations.push({ op: "l", c: point(currentX, currentY) });
    } else if (command === "H") {
      currentX = number(); operations.push({ op: "l", c: point(currentX, currentY) });
    } else if (command === "V") {
      currentY = number(); operations.push({ op: "l", c: point(currentX, currentY) });
    } else if (command === "C") {
      const x1 = number(), y1 = number(), x2 = number(), y2 = number(); currentX = number(); currentY = number();
      operations.push({ op: "c", c: [...point(x1, y1), ...point(x2, y2), ...point(currentX, currentY)] });
    } else if (command === "Z") {
      operations.push({ op: "h" }); currentX = startX; currentY = startY; command = "";
    } else throw new Error(`Unsupported logo path command: ${command || tokens[index]}`);
  }
  return { operations, strokeWidth: 6 * scale };
}

function setPDFFont(pdf, size, bold = false, color = 17) {
  pdf.setFont(PDF_FONT_FAMILY, bold ? "bold" : "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(color);
}

function pdfVectorChart() {
  const source = $("#chart");
  const chart = source.cloneNode(true);
  const sourceNodes = [source, ...source.querySelectorAll("*")];
  const chartNodes = [chart, ...chart.querySelectorAll("*")];
  const styleProperties = [
    "color", "fill", "fill-opacity", "opacity", "stroke", "stroke-dasharray",
    "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
    "stroke-opacity", "stroke-width", "font-size", "font-style", "font-weight",
    "letter-spacing", "paint-order", "text-anchor", "visibility"
  ];
  sourceNodes.forEach((node, index) => {
    const style = getComputedStyle(node);
    styleProperties.forEach(property => chartNodes[index].style.setProperty(property, style.getPropertyValue(property)));
  });
  chart.querySelectorAll("text").forEach(node => {
    node.style.setProperty("font-family", PDF_FONT_FAMILY);
    node.style.setProperty("font-weight", Number.parseInt(node.style.fontWeight, 10) >= 600 ? "bold" : "normal");
    if (node.classList.contains("node-label")) node.style.setProperty("stroke", "none");
  });
  return chart;
}

function truncatePDFText(pdf, value, width) {
  const text = String(value ?? "");
  if (pdf.getTextWidth(text) <= width) return text;
  let shortened = text;
  while (shortened.length && pdf.getTextWidth(`${shortened}…`) > width) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function drawPDFQRCode(pdf, code, bounds) {
  const modules = code.getModuleCount();
  const cell = Math.min(bounds.width, bounds.height) / modules;
  pdf.setFillColor(255); pdf.rect(bounds.x, bounds.y, bounds.width, bounds.height, "F"); pdf.setFillColor(0);
  for (let row = 0; row < modules; row += 1) {
    let start = -1;
    for (let col = 0; col <= modules; col += 1) {
      const dark = col < modules && code.isDark(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) { pdf.rect(bounds.x + start * cell, bounds.y + row * cell, (col - start) * cell, cell, "F"); start = -1; }
    }
  }
}

function addPDFCover(pdf, exportedAt, deepLink, code, logoPath) {
  pdf.setFillColor(255); pdf.rect(0, 0, 612, 792, "F"); pdf.setDrawColor(17); pdf.setLineWidth(.75); pdf.rect(22.5, 22.5, 567, 747);
  const logo = svgPathOperations(logoPath, { x: 48, y: 49, width: 42, height: 40 });
  pdf.setFillColor(0); pdf.setLineWidth(logo.strokeWidth); pdf.path(logo.operations); pdf.fillStroke();
  setPDFFont(pdf, 13, true); pdf.text("UFO FILES", 99, 62);
  setPDFFont(pdf, 9); pdf.text("RELATIONSHIP GRAPH EXPORT", 99, 77);
  setPDFFont(pdf, 7.5, true); pdf.textWithLink("ufo-files.app", 99, 94, { url: UFO_FILES_URL }); pdf.textWithLink("github.com/ufo-files", 171, 94, { url: UFO_FILES_GITHUB_URL });
  pdf.setLineWidth(1.5); pdf.line(48, 116, 564, 116);
  setPDFFont(pdf, 25.5); const titleLines = pdf.splitTextToSize(pdfExportTitle().toUpperCase(), 516).slice(0, 2); pdf.text(titleLines, 48, 157, { lineHeightFactor: 1.15 });
  const summaryY = 199 + Math.max(0, titleLines.length - 1) * 27;
  const metadata = pdfProvenance(exportedAt);
  metadata.forEach(([name, value], index) => {
    const y = summaryY + index * 22;
    setPDFFont(pdf, 8.25, true); pdf.text(name, 48, y);
    setPDFFont(pdf, 8.25); pdf.text(pdf.splitTextToSize(String(value), 168).slice(0, 2), 153, y, { lineHeightFactor: 1.25 });
  });
  const urlX = 339;
  setPDFFont(pdf, 8.25, true); pdf.text("GRAPH URL", urlX, summaryY);
  setPDFFont(pdf, 8.25, true); const urlLines = pdf.splitTextToSize(deepLink, 225); pdf.textWithLink(urlLines[0], urlX, summaryY + 20, { url: deepLink });
  urlLines.slice(1).forEach((line, index) => { pdf.textWithLink(line, urlX, summaryY + 20 + (index + 1) * 10, { url: deepLink }); });
  const qrY = summaryY + 42 + Math.max(0, urlLines.length - 1) * 10;
  if (code) { const qrBounds = { x: urlX, y: qrY, width: 132, height: 132 }; drawPDFQRCode(pdf, code, qrBounds); pdf.link(qrBounds.x, qrBounds.y, qrBounds.width, qrBounds.height, { url: deepLink }); }
  else { setPDFFont(pdf, 8.25, false, 85); pdf.text("QR unavailable for this URL", urlX, qrY + 16); }

  const propertiesY = Math.max(414, summaryY + 190);
  pdf.setDrawColor(160); pdf.setLineWidth(.5); pdf.line(48, propertiesY, 564, propertiesY);
  setPDFFont(pdf, 8.25, true); pdf.text("GRAPH PROPERTIES", 48, propertiesY + 23);
  const properties = pdfGraphProperties();
  const columns = [48, 226, 404];
  let rowY = propertiesY + 44;
  for (let index = 0; index < properties.length; index += 3) {
    const row = properties.slice(index, index + 3);
    const lineCounts = row.map(([, value]) => pdf.splitTextToSize(String(value), 154).length);
    row.forEach(([name, value], column) => {
      setPDFFont(pdf, 6.75, true, 85); pdf.text(name.toUpperCase(), columns[column], rowY);
      setPDFFont(pdf, 8.25); pdf.text(pdf.splitTextToSize(String(value), 154), columns[column], rowY + 12, { lineHeightFactor: 1.2 });
    });
    rowY += 27 + Math.max(...lineCounts) * 9;
  }
  setPDFFont(pdf, 7.5); pdf.text("Exported by UFO Files", 48, 742);
}

function drawPDFLegend(pdf, y, maxX = 564) {
  const items = [...document.querySelectorAll("#legend .legend-item")].map(item => item.textContent.trim()).filter(Boolean);
  if (!items.length) return y;
  let x = 48, lineY = y;
  items.forEach((item, index) => {
    setPDFFont(pdf, 7.5); const width = Math.min(150, pdf.getTextWidth(item) + 18);
    if (x + width > maxX) { x = 48; lineY += 16; }
    const shade = 225 - index * 26; pdf.setFillColor(Math.max(17, shade)); pdf.setDrawColor(17); pdf.rect(x, lineY - 7, 8, 8, "FD");
    pdf.text(truncatePDFText(pdf, item, width - 14), x + 13, lineY); x += width;
  });
  return lineY;
}

function drawPDFTableView(pdf, bounds) {
  const table = document.querySelector("#tableView table");
  setPDFFont(pdf, 7.5);
  if (table) {
    const headers = [...table.querySelectorAll("thead th")].map(cell => cell.textContent.trim());
    const rows = [...table.querySelectorAll("tbody tr")];
    const columnWidth = bounds.width / Math.max(1, headers.length);
    const rowHeight = 22;
    pdf.setFillColor(236); pdf.rect(bounds.x, bounds.y, bounds.width, rowHeight, "F");
    headers.forEach((header, index) => { setPDFFont(pdf, 7, true, 85); pdf.text(truncatePDFText(pdf, header.toUpperCase(), columnWidth - 10), bounds.x + index * columnWidth + 5, bounds.y + 14); });
    rows.slice(0, Math.floor((bounds.height - rowHeight) / rowHeight)).forEach((row, rowIndex) => {
      const y = bounds.y + (rowIndex + 1) * rowHeight; pdf.setDrawColor(210); pdf.line(bounds.x, y, bounds.x + bounds.width, y);
      [...row.cells].forEach((cell, index) => { setPDFFont(pdf, 7.5); pdf.text(truncatePDFText(pdf, cell.textContent.trim(), columnWidth - 10), bounds.x + index * columnWidth + 5, y + 14); });
    });
    return;
  }
  const cards = [...document.querySelectorAll("#tableView .document-card")];
  const columns = 2, gap = 8, cardWidth = (bounds.width - gap) / columns, cardHeight = 76;
  cards.slice(0, columns * Math.floor(bounds.height / (cardHeight + gap))).forEach((card, index) => {
    const x = bounds.x + (index % columns) * (cardWidth + gap), y = bounds.y + Math.floor(index / columns) * (cardHeight + gap);
    pdf.setDrawColor(160); pdf.rect(x, y, cardWidth, cardHeight);
    setPDFFont(pdf, 8, true); pdf.text(pdf.splitTextToSize(card.querySelector("strong")?.textContent || "Document", cardWidth - 12).slice(0, 2), x + 6, y + 14, { lineHeightFactor: 1.15 });
    setPDFFont(pdf, 6.75, false, 85); pdf.text(truncatePDFText(pdf, card.querySelector("small")?.textContent || "", cardWidth - 12), x + 6, y + 38);
    pdf.text(truncatePDFText(pdf, card.querySelector(".document-card-meta")?.textContent || "", cardWidth - 12), x + 6, y + 56);
  });
}

async function addPDFGraphPage(pdf, exportedAt) {
  const stage = document.querySelector(".stage");
  const globe = state.config.type === "map" ? window.ufoGlobe : null;
  const wasPlaying = Boolean(globe?.autoRotate);
  if (wasPlaying) globe.setPlaying(false);
  const restoreRelationships = globe?.prepareExport?.() || (() => {});
  const metadata = new Map(pdfProvenance(exportedAt));
  stage.classList.add("pdf-exporting");
  try {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const stageRect = stage.getBoundingClientRect();
    const landscape = stageRect.width / stageRect.height > 1.25;
    pdf.addPage("letter", landscape ? "landscape" : "portrait");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(255); pdf.rect(0, 0, pageWidth, pageHeight, "F"); pdf.setDrawColor(17); pdf.setLineWidth(.75); pdf.rect(24, 24, pageWidth - 48, pageHeight - 48);
    setPDFFont(pdf, 8.25, true); pdf.text($("#graphKicker").textContent.toUpperCase(), 45, 52);
    setPDFFont(pdf, 18); pdf.text(truncatePDFText(pdf, pdfExportTitle().toUpperCase(), pageWidth - 90), 45, 76);
    setPDFFont(pdf, 8.25, false, 85); pdf.text(truncatePDFText(pdf, $("#graphSubtitle").textContent, pageWidth - 90), 45, 95);
    const provenanceY = pageHeight - 66;
    const chartBounds = { x: 45, y: 112, width: pageWidth - 90, height: provenanceY - 190 };
    pdf.setDrawColor(17); pdf.setLineWidth(.75); pdf.roundedRect(chartBounds.x, chartBounds.y, chartBounds.width, chartBounds.height, 6, 6);
    const inset = 2;
    if (!$("#chart").hasAttribute("hidden") && $("#chart").children.length) {
      await pdf.svg(pdfVectorChart(), { x: chartBounds.x + inset, y: chartBounds.y + inset, width: chartBounds.width - inset * 2, height: chartBounds.height - inset * 2 });
    } else if (!$("#mapView").hidden) {
      const canvas = $("#globeCanvas");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", chartBounds.x + 1, chartBounds.y + 1, chartBounds.width - 2, chartBounds.height - 2, undefined, "FAST");
      const mapRect = $("#mapView").getBoundingClientRect();
      [...document.querySelectorAll("#globeLabels .globe-label")].forEach(labelNode => {
        const rect = labelNode.getBoundingClientRect();
        const x = chartBounds.x + (rect.left - mapRect.left) / mapRect.width * chartBounds.width;
        const y = chartBounds.y + (rect.top - mapRect.top) / mapRect.height * chartBounds.height;
        setPDFFont(pdf, 7, true); pdf.text(truncatePDFText(pdf, labelNode.textContent, 100), x, y + 7);
      });
    } else drawPDFTableView(pdf, { x: chartBounds.x + 1, y: chartBounds.y + 1, width: chartBounds.width - 2, height: chartBounds.height - 2 });
    const legendY = drawPDFLegend(pdf, chartBounds.y + chartBounds.height + 24, pageWidth - 48);
    pdf.setDrawColor(160); pdf.line(40, legendY + 16, pageWidth - 40, legendY + 16);
    const summaryWidth = (pageWidth - 110) / 2;
    setPDFFont(pdf, 7.5, false, 85); pdf.text(truncatePDFText(pdf, $("#resultSummary").textContent, summaryWidth), 45, legendY + 34); pdf.text(truncatePDFText(pdf, $("#policySummary").textContent, summaryWidth), pageWidth - 45, legendY + 34, { align: "right" });
    const metadataTop = provenanceY - 10;
    const metadataBottom = pageHeight - 24;
    const metadataCenterY = (metadataTop + metadataBottom) / 2;
    pdf.setDrawColor(160); pdf.line(24, metadataTop, pageWidth - 24, metadataTop);
    setPDFFont(pdf, 7.25, true); pdf.text(`UFO Files · ${UFO_FILES_URL}`, 45, metadataCenterY + 2);
    setPDFFont(pdf, 6.75, false, 85); pdf.text(`Catalog ${metadata.get("CATALOG GENERATED")}`, 225, metadataCenterY - 8); pdf.text(`Source ${metadata.get("SOURCE OF TRUTH")}@${metadata.get("SOURCE REVISION")}`, 225, metadataCenterY + 2); pdf.text(`Exported ${metadata.get("EXPORTED")}`, 225, metadataCenterY + 12);
  } finally {
    stage.classList.remove("pdf-exporting");
    restoreRelationships();
    if (wasPlaying) globe.setPlaying(true);
  }
}

async function exportCurrent() {
  const button = $("#exportButton");
  if (!window.jspdf?.jsPDF || !window.svg2pdf) return toast("PDF export tools unavailable");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Building PDF…";
  try {
    const exportedAt = new Date();
    const exportTitle = pdfExportTitle();
    const deepLink = currentGraphURL();
    const code = graphQRCode(deepLink);
    const logoPath = await loadPDFLogoPath();
    const pdf = new window.jspdf.jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
    await loadPDFFonts(pdf);
    pdf.setProperties({ title: exportTitle, subject: "UFO Files relationship graph export", author: "UFO Files", creator: "UFO Files Relationship Graph Builder", keywords: "UFO Files, relationship graph, machine data" });
    pdf.setCreationDate(exportedAt);
    addPDFCover(pdf, exportedAt, deepLink, code, logoPath);
    await addPDFGraphPage(pdf, exportedAt);
    pdf.save(pdfFilename(exportTitle));
    toast("Presentation PDF saved");
  } catch (error) {
    console.error("PDF export failed", error);
    toast("PDF export failed");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = "Export PDF";
  }
}

async function init() {
  try {
    const response = await fetch("data/catalog.json");
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.catalog = await response.json();
    state.catalog.entities = state.catalog.entities.map(withSignificanceDefaults);
    state.catalog.documents.forEach(item => state.documentById.set(item.id, item));
    $("#loadingState").remove();
    syncAutomaticTitle();
    renderControls(); renderGraph();
  } catch (error) {
    $("#loadingState").innerHTML = `<strong>Catalog unavailable</strong><br><small>${escapeHTML(error.message)}. Serve this folder over HTTP.</small>`;
  }
}

$$('.step-heading').forEach(button => button.addEventListener("click", () => {
  const step = button.closest(".step"); step.classList.toggle("open"); button.setAttribute("aria-expanded", String(step.classList.contains("open")));
}));
$("#graphTitle").addEventListener("blur", event => {
  state.config.title = event.target.textContent.trim() || "Untitled graph";
  state.config.titleMode = "custom";
  renderPresetStatus();
  persistHash();
});
$("#saveButton").addEventListener("click", () => { localStorage.setItem("ufo-files-graph-view", JSON.stringify(state.config)); toast("View saved in this browser"); });
$("#shareButton").addEventListener("click", async () => { persistHash(); try { await navigator.clipboard.writeText(location.href); toast("Builder link copied"); } catch (_) { toast("Copy the URL from your browser"); } });
$("#controlsButton").addEventListener("click", event => setMobileControls(event.currentTarget.getAttribute("aria-expanded") !== "true"));
$("#fullScreenButton").addEventListener("click", toggleGraphFullScreen);
$("#mapAnimationButton").addEventListener("click", () => {
  const playing = window.ufoGlobe?.setPlaying(!window.ufoGlobe.autoRotate) || false;
  syncMapAnimationButton(playing);
});
window.addEventListener("ufo-map-playback", event => syncMapAnimationButton(event.detail.playing));
$("#exportButton").addEventListener("click", exportCurrent);
$("#closeInspector").addEventListener("click", closeInspector);
$("#resetZoom").addEventListener("click", () => {
  if (state.config.type === "map") return window.ufoGlobe?.reset();
  state.config.zoom = 1;
  renderControls();
  commitConfig(false);
});
window.addEventListener("ufo-map-select", event => {
  const entity = state.catalog?.entities.find(item => item.id === event.detail.entityId);
  if (entity) inspectEntity(filteredEntity(entity));
});
window.addEventListener("resize", () => { clearTimeout(window.resizeTimer); window.resizeTimer = setTimeout(renderGraph, 120); });

init();
