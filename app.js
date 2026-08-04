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
  createdAt: "Cataloged at", durationMs: "Duration", source: "Collection", format: "Format",
  entity: "Entities", document: "Transcript files", name: "Name", title: "Title",
  category: "Entity type", reviewStatus: "Review status", engine: "Engine", path: "Path",
  table: "Table", collection: "Collections", shared_entities: "Shared entities"
};
const TABLE_FIELDS = {
  entity: ["name", "category", "contextAdjustedMentions", "mentions", "inflationRate", "documentInflationRate", "inflationRisk", "independentDocumentCount", "documentCount", "sourceCount", "classificationConfidence", "extractionConfidence", "reviewStatus"],
  document: ["title", "source", "format", "words", "segments", "bytes", "createdAt", "engine", "durationMs", "path"],
  source: ["name", "documents", "words"]
};
const TYPES = [
  { id: "network", label: "Network", scope: "All", icon: "<circle cx='6' cy='8' r='3'/><circle cx='24' cy='4' r='3'/><circle cx='22' cy='16' r='3'/><path d='M9 7l12-2M9 10l10 5M23 7l-1 6'/>" },
  { id: "map", label: "Map", scope: "Locations", icon: "<circle cx='15.5' cy='10' r='8'/><path d='M7.5 10h16M15.5 2c3 3 3 13 0 16m0-16c-3 3-3 13 0 16'/>" },
  { id: "book", label: "Bookshelf", scope: "Books", icon: "<path d='M3 3h5v14H3zM9 5h4v12H9zM14 2h6v15h-6zM21 6h7v11h-7zM2 18h27'/>" },
  { id: "scatter", label: "Scatter", scope: "Entities", icon: "<path d='M3 2v16h25'/><circle cx='9' cy='13' r='2'/><circle cx='15' cy='9' r='2'/><circle cx='22' cy='5' r='2'/>" },
  { id: "bars", label: "Bars", scope: "All collections", icon: "<path d='M3 2v16h26M7 15h4V8H7zm8 0h4V4h-4zm8 0h4v-9h-4z'/>" },
  { id: "timeline", label: "Timeline", scope: "Documents + events", icon: "<path d='M3 10h25M8 5v10m7-7v7m8-12v12'/><circle cx='8' cy='10' r='2'/><circle cx='15' cy='10' r='2'/><circle cx='23' cy='10' r='2'/>" },
  { id: "matrix", label: "Matrix", scope: "Collections × top entities", icon: "<path d='M4 3h22v15H4zM11 3v15m8-15v15M4 8h22m-22 5h22'/>" },
  { id: "table", label: "Table", scope: "All records", icon: "<path d='M3 3h25v15H3zM3 8h25M3 13h25M12 3v15'/>" }
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
  nodeRole: "entity", timelineRole: "document", matrixColumns: "entity",
  tableRole: "entity", tableColumns: ["name", "category", "mentions", "documentCount", "sourceCount"],
  tableSort: "mentions", tableDirection: "desc", tableSearch: "",
  labelSize: 12, zoom: 1, title: "Mentions by Documents — Entities", titleMode: "auto"
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
      if ((Number(saved.configVersion) || 0) < CONFIG_VERSION) migrateEntityProminenceConfig(config);
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
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state.config))));
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

function dataAwareTitle(config) {
  const entities = entityScopeTitle(config.categories);
  let title;
  if (config.type === "scatter") {
    title = config.x === "entity" && ["mentions", "contextAdjustedMentions"].includes(config.y)
      ? `Significant ${entities}`
      : `${label(config.y)} by ${label(config.x)} — ${entities}`;
  } else if (config.type === "network") {
    title = config.nodeRole === "collection" ? "Collection Relationships" : `${entities} Relationships`;
  } else if (config.type === "map") {
    title = `${label(config.size)} — Mapped Locations`;
  } else if (config.type === "book") {
    title = `Bookshelf — ${entities}`;
  } else if (config.type === "bars") {
    title = config.aggregation === "entity" ? `${label(config.y)} by ${entities}` : `${label(config.y)} by ${label(config.aggregation)}`;
  } else if (config.type === "timeline") {
    title = config.timelineRole === "entity" ? `${entities} Over Time` : "Transcription Activity";
  } else if (config.type === "matrix") {
    title = `Collections × ${config.matrixColumns === "entity" ? "Entities" : "Entity Types"}`;
  } else {
    title = config.tableRole === "entity" ? `${entities} Table` : config.tableRole === "document" ? "Transcript Files" : "Collections";
  }
  return `${title}${collectionScopeTitle(config)}`;
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

function presetConfig(id) {
  const preset = PRESETS.find(item => item.id === id);
  if (!preset) return null;
  const overrides = preset.config || {};
  const config = {
    ...DEFAULT,
    ...overrides,
    categories: [...(overrides.categories || DEFAULT.categories)],
    sources: [...(overrides.sources || DEFAULT.sources)],
    tableColumns: [...(overrides.tableColumns || DEFAULT.tableColumns)]
  };
  config.titleMode = "auto";
  config.title = dataAwareTitle(config);
  return config;
}

function presetMatches(preset) {
  const config = presetConfig(preset.id);
  const keys = (preset.config ? Object.keys(preset.config) : Object.keys(DEFAULT)).filter(key => !["title", "titleMode"].includes(key));
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
  const config = presetConfig(id);
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
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Book titles</option></select></div><div class="control"><div class="control-title">Layout</div><select disabled><option>Area-proportional shelves</option></select></div>`;
  } else if (state.config.type === "scatter") {
    roles = controlSelect("x", "X axis", ["entity", ...numericEntity]) + controlSelect("y", "Y axis", numericEntity)
      + relationshipTypeControl();
  } else if (state.config.type === "bars") {
    roles = controlSelect("aggregation", "Group by", [{ value: "entity", label: "Entities" }, { value: "source", label: "Collection" }, { value: "format", label: "Transcript format" }]) + controlSelect("y", "Measure", state.config.aggregation === "entity" ? numericEntity : ["words", "documents", "bytes"]);
  } else if (state.config.type === "timeline") {
    roles = controlSelect("timelineRole", "Marks", [{ value: "entity", label: "Entities" }, { value: "document", label: "Completed transcript files" }]) + controlSelect("x", "X axis", [{ value: "createdAt", label: "Transcription date" }]) + controlSelect("y", "Y axis", state.config.timelineRole === "entity" ? numericEntity : numericDoc);
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

  const sizeOptions = state.config.type === "network" && state.config.nodeRole === "collection"
    ? ["documents", "words"]
    : state.config.type === "timeline" && state.config.timelineRole !== "entity" ? numericDoc : numericEntity;
  const labelSizeControl = `<div class="control"><label>Label size <span>${state.config.labelSize}px</span></label><input type="range" min="11" max="18" step="1" value="${state.config.labelSize}" data-range="labelSize"></div>`;
  const zoomControl = state.config.type === "network" ? `<div class="control"><label>Zoom <span>${state.config.zoom.toFixed(1)}×</span></label><input type="range" min="0.5" max="2.5" step="0.1" value="${state.config.zoom}" data-range="zoom"></div>` : "";
  const supportsRelationships = ["scatter", "map", "timeline"].includes(state.config.type);
  const relationshipControls = supportsRelationships ? controlSelect("relationshipLayer", "Relationship layer", [{ value: "off", label: "Off" }, { value: "hover", label: "On hover" }, { value: "always", label: "Always" }])
    + `<div class="control"><label>Connections per node <span>${state.config.relationshipNeighbors}</span></label><input type="range" min="1" max="5" step="1" value="${state.config.relationshipNeighbors}" data-range="relationshipNeighbors"></div>`
    + controlSelect("relationshipNodeSize", "Secondary-node size", [{ value: "inherit", label: "Inherit size metric" }, { value: "fixed", label: "Fixed" }])
    + controlSelect("relationshipStrength", "Line strength", [{ value: "subtle", label: "Subtle" }, { value: "medium", label: "Medium" }, { value: "strong", label: "Strong" }]) : "";
  if (state.config.type === "table") {
    const sortOptions = TABLE_FIELDS[state.config.tableRole];
    $("#encodeControls").innerHTML = controlSelect("tableSort", "Sort by", sortOptions) + controlSelect("tableDirection", "Direction", [{ value: "desc", label: "Descending" }, { value: "asc", label: "Ascending" }]) + labelSizeControl;
  } else {
    $("#encodeControls").innerHTML = (["scatter", "network", "timeline", "map", "book"].includes(state.config.type)
      ? controlSelect("size", "Size + shade", sizeOptions) + `<div class="control"><div class="control-title">Shade scale</div><select disabled><option>Monochrome value scale</option></select></div>` + controlSelect("labels", "Labels", [{ value: "top", label: "Most important" }, { value: "all", label: "All" }, { value: "none", label: "None" }])
      : `<div class="control"><div class="control-title">Shade scale</div><select disabled><option>Monochrome value scale</option></select></div>`) + relationshipControls + labelSizeControl + zoomControl;
  }

  const categories = state.config.type === "map"
    ? ["location"]
    : [...new Set(state.catalog?.entities.map(item => item.category) || ENTITY_CATEGORIES)];
  const categoryChecks = categories.map(category => `<label class="check-chip"><input type="checkbox" data-category="${category}" ${state.config.categories.includes(category) ? "checked" : ""}><span>${escapeHTML(label(category))}</span></label>`).join("");
  const sources = state.catalog?.sources || [];
  const sourceNames = sources.map(source => source.name);
  const selectedSourceCount = state.config.allSources ? sourceNames.length : sourceNames.filter(name => state.config.sources.includes(name)).length;
  const sourceChecks = sources.map(source => `<label class="check-chip"><input type="checkbox" data-source="${escapeHTML(source.name)}" ${sourceIsSelected(source.name, state.config.sources, state.config.allSources) ? "checked" : ""}><span>${escapeHTML(source.name)}</span></label>`).join("");
  const duplicateCount = state.catalog?.counts?.possibleDuplicates || state.catalog?.duplicateCandidates?.length || 0;
  const usesEntities = state.config.type === "table" ? state.config.tableRole === "entity" : !["bars", "timeline"].includes(state.config.type) || state.config.aggregation === "entity" || state.config.timelineRole === "entity";
  $("#filterControls").innerHTML = `
    ${usesEntities ? `<div class="control"><div class="control-title">Entity categories</div><div class="check-grid">${categoryChecks}</div></div>` : ""}
    <div class="control"><div class="control-title">Collections <span>${selectedSourceCount} / ${sourceNames.length} selected</span></div><div class="check-grid">${sourceChecks}</div></div>
    ${state.config.type === "table" ? `<div class="control"><label for="tableSearch">Search rows</label><input id="tableSearch" class="text-input" type="search" value="${escapeHTML(state.config.tableSearch)}" placeholder="Filter this list" data-table-search></div>` : ""}
    ${usesEntities ? `<div class="control"><label>Minimum confidence <span>${Math.round(state.config.minConfidence * 100)}%</span></label><input type="range" min="0.5" max="0.95" step="0.01" value="${state.config.minConfidence}" data-range="minConfidence"></div>` : ""}
    ${state.config.type === "network" || (supportsRelationships && state.config.relationshipLayer !== "off") ? `<div class="control"><label>${state.config.type === "network" && state.config.nodeRole === "collection" || state.config.type === "timeline" && state.config.timelineRole === "document" ? "Shared entities" : "Relationship evidence"} <span>${state.config.minEvidence}×</span></label><input type="range" min="1" max="12" step="1" value="${state.config.minEvidence}" data-range="minEvidence"></div>` : ""}
    <div class="control"><label>Maximum ${state.config.type === "table" ? "rows" : "marks"} <span>${state.config.limit}</span></label><input type="range" min="20" max="${state.config.type === "network" ? 120 : 250}" step="10" value="${state.config.limit}" data-range="limit"></div>
    ${usesEntities ? `<div class="control method-note"><div class="control-title">Context adjustment</div><p>Counts exact repeats within one document once, counts text repeated across 3+ documents once, and excludes requester metadata. Raw mentions remain available.</p></div>` : ""}
    ${usesEntities ? `<div class="control"><div class="control-title">Inflation review</div><label class="check-chip"><input type="checkbox" data-include-high-inflation ${state.config.includeHighInflation ? "checked" : ""}><span>Include high-inflation entities</span></label></div>` : ""}
    <div class="control duplicate-review-control"><div class="control-title">Identity review <span>${duplicateCount} flagged</span></div><button class="button review-button" type="button" data-review-duplicates ${duplicateCount ? "" : "disabled"}>Review possible duplicates</button></div>`;

  $$('[data-config]').forEach(node => node.addEventListener("change", event => updateConfig(event.target.dataset.config, event.target.value)));
  $$('[data-range]').forEach(node => node.addEventListener("input", event => {
    const key = event.target.dataset.range;
    const value = Number(event.target.value);
    state.config[key] = value;
    const output = event.target.closest(".control")?.querySelector("label span");
    if (output) output.textContent = key === "minConfidence" ? `${Math.round(value * 100)}%` : key === "minEvidence" ? `${value}×` : key === "labelSize" ? `${value}px` : key === "zoom" ? `${value.toFixed(1)}×` : String(value);
    persistHash();
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
  $$('[data-type]').forEach(node => node.addEventListener("click", () => setType(node.dataset.type)));
  $("[data-preset-select]")?.addEventListener("change", event => {
    if (event.target.value) applyPreset(event.target.value);
  });
}

function setType(type) {
  state.config.type = type;
  if (type === "bars") Object.assign(state.config, { aggregation: "source", y: "words", color: "intensity" });
  if (type === "scatter") Object.assign(state.config, { x: "entity", y: "contextAdjustedMentions", size: "independentDocumentCount", color: "category", limit: 50 });
  if (type === "network") Object.assign(state.config, { nodeRole: "entity", size: "independentDocumentCount", color: "category" });
  if (type === "map") Object.assign(state.config, { categories: ["location"], size: "contextAdjustedMentions", color: "intensity", labels: "top", limit: 50 });
  if (type === "book") Object.assign(state.config, { size: "contextAdjustedMentions", color: "intensity", labels: "all", includeHighInflation: true, limit: 250 });
  if (type === "timeline") Object.assign(state.config, { timelineRole: "document", x: "createdAt", y: "words", size: "words", color: "source" });
  if (type === "matrix") Object.assign(state.config, { matrixColumns: "entity", color: "intensity" });
  if (type === "table") Object.assign(state.config, { tableRole: "entity", tableColumns: ["name", "category", "mentions", "documentCount", "sourceCount"], tableSort: "mentions", tableDirection: "desc", tableSearch: "", limit: 60 });
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
    state.config.y = value === "entity" ? "contextAdjustedMentions" : "words";
    state.config.size = value === "entity" ? "independentDocumentCount" : "words";
    state.config.color = value === "entity" ? "category" : "source";
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

function entityMatches(entity) {
  entity = withSignificanceDefaults(entity);
  if (!state.config.categories.includes(entity.category)) return false;
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

function filteredEntities() {
  return state.catalog.entities.filter(entityMatches).map(filteredEntity);
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
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + i * (height - margin.top - margin.bottom) / 4;
    svg.append(el("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "grid-line" }));
    const value = yExtent[1] - i * (yExtent[1] - yExtent[0]) / 4;
    const tick = capped.y && i === 0 ? `${formatNumber(value)}+` : formatNumber(value);
    svg.append(el("text", { x: margin.left - 8, y: y + 3, "text-anchor": "end", class: "axis-label" }, tick));
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
  const edgeGroup = el("g");
  edges.forEach(edge => {
    const a = positions.get(edge.source), b = positions.get(edge.target);
    const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "edge mark", "stroke-width": Math.min(4, .5 + Math.sqrt(edge.evidenceCount) * .35) });
    addTitle(line, `${label(edge.relationship)} · ${edge.evidenceCount} ${collectionMode ? "entities" : "evidence segments"}`);
    line.addEventListener("click", () => collectionMode ? inspectCollectionEdge(edge, nodes) : inspectEdge(edge));
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
    relationshipLayer: state.config.relationshipLayer,
    relationshipStrength: ({ subtle: .12, medium: .24, strong: .42 })[state.config.relationshipStrength] || .12,
    relationships: overlay.edges.map(relationship => ({ source: relationship.source, target: relationship.target, evidenceCount: relationship.edge.evidenceCount })),
    items: visibleItems.map((entity, index) => ({
      id: entity.id,
      name: entity.name,
      lat: entity.geo.lat,
      lon: entity.geo.lon,
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

function bookshelfLayout(items, width, height, valueKey) {
  if (!items.length) return { blocks: [], shelfYs: [] };
  const inset = 14;
  const shelfGap = 10;
  const blockGap = 3;
  const weighted = items.map(item => ({ item, weight: Math.max(1, Number(item[valueKey]) || 0) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const targetRows = Math.max(1, Math.min(items.length, Math.round(Math.sqrt(items.length * height / width))));
  const targetWeight = total / targetRows;
  const rows = [];
  let row = [];
  let rowWeight = 0;
  weighted.forEach(entry => {
    if (row.length && rowWeight >= targetWeight && rows.length < targetRows - 1) {
      rows.push({ entries: row, weight: rowWeight });
      row = [];
      rowWeight = 0;
    }
    row.push(entry);
    rowWeight += entry.weight;
  });
  if (row.length) rows.push({ entries: row, weight: rowWeight });

  const usableWidth = width - inset * 2;
  const usableHeight = height - inset * 2 - shelfGap * (rows.length - 1);
  const blocks = [];
  const shelfYs = [];
  let y = inset;
  rows.forEach((shelf, shelfIndex) => {
    const shelfHeight = shelfIndex === rows.length - 1
      ? height - inset - y
      : usableHeight * shelf.weight / total;
    const rowWidth = usableWidth - blockGap * (shelf.entries.length - 1);
    let x = inset;
    shelf.entries.forEach((entry, entryIndex) => {
      const blockWidth = entryIndex === shelf.entries.length - 1
        ? width - inset - x
        : rowWidth * entry.weight / shelf.weight;
      blocks.push({ item: entry.item, x, y, width: blockWidth, height: shelfHeight, shelf: shelfIndex });
      x += blockWidth + blockGap;
    });
    shelfYs.push(y + shelfHeight + shelfGap / 2);
    y += shelfHeight + shelfGap;
  });
  return { blocks, shelfYs };
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
    if (splitAt < Math.floor(maxCharacters * .55)) splitAt = maxCharacters;
    lines.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining && lines.length) lines[lines.length - 1] = `${lines.at(-1).slice(0, Math.max(1, maxCharacters - 1))}…`;
  return lines;
}

function renderBook() {
  const { svg, width, height } = clearChart();
  const data = filteredEntities()
    .sort((left, right) => (right[state.config.size] || 0) - (left[state.config.size] || 0))
    .slice(0, state.config.limit);
  if (!data.length) return showEmpty();
  const extent = valueExtent(data, state.config.size);
  const { blocks, shelfYs } = bookshelfLayout(data, width, height, state.config.size);
  shelfYs.forEach(y => svg.append(el("line", { x1: 8, y1: y, x2: width - 8, y2: y, stroke: "#111", "stroke-opacity": .55, "stroke-width": 2, class: "book-shelf" })));
  blocks.forEach(block => {
    const shade = scale(block.item[state.config.size], extent, [.16, .94]);
    const rect = el("rect", {
      x: block.x, y: block.y, width: Math.max(1, block.width), height: Math.max(1, block.height),
      fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": 1, class: "mark book-spine"
    });
    addTitle(rect, `${block.item.name} · ${label(state.config.size)}: ${formatNumber(block.item[state.config.size])}`);
    rect.addEventListener("click", () => inspectEntity(block.item));
    svg.append(rect);
    const shouldLabel = state.config.labels !== "none";
    if (!shouldLabel || block.width < 42 || block.height < state.config.labelSize + 10) return;
    const maxCharacters = Math.max(4, Math.floor((block.width - 12) / (state.config.labelSize * .62)));
    const maxLines = Math.max(1, Math.min(3, Math.floor((block.height - 12) / (state.config.labelSize * 1.15))));
    const text = el("text", {
      x: block.x + 6, y: block.y + state.config.labelSize + 3,
      fill: shade > .55 ? "#f6f5ef" : "#111", class: "book-label", style: `font-size:${state.config.labelSize}px`
    });
    bookLabelLines(block.item.name, maxCharacters, maxLines).forEach((line, lineIndex) => text.append(el("tspan", {
      x: block.x + 6, dy: lineIndex ? "1.15em" : 0
    }, line)));
    svg.append(text);
  });
  drawIntensityLegend();
  const mentions = data.reduce((sum, item) => sum + (item[state.config.size] || 0), 0);
  setSummary(`${data.length} entities · ${formatNumber(mentions)} ${label(state.config.size).toLowerCase()}`, "book");
}

function mapLocationData() {
  const locations = filteredEntities().filter(entity => entity.category === "location");
  const mapped = locations.filter(entity => Number.isFinite(entity.geo?.lat) && Number.isFinite(entity.geo?.lon))
    .sort((left, right) => (right[state.config.size] || 0) - (left[state.config.size] || 0));
  return { mapped, data: mapped.slice(0, state.config.limit), unmapped: locations.length - mapped.length };
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
  const candidates = (state.config.timelineRole === "entity"
    ? filteredEntities().map(entity => {
        const documents = entity.documentIds.map(id => state.documentById.get(id)).filter(document => document?.createdAt && sourceMatches(document.source)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return documents.length ? { ...entity, title: entity.name, createdAt: documents[0].createdAt, source: documents[0].source, format: documents[0].format, entityRecord: entity } : null;
      }).filter(Boolean)
    : state.catalog.documents.filter(item => item.createdAt && sourceMatches(item.source)));
  const data = candidates.sort((a, b) => (b[state.config.y] || 0) - (a[state.config.y] || 0)).slice(0, state.config.limit);
  if (!data.length) return showEmpty();
  const dates = data.map(item => new Date(item.createdAt).getTime());
  const xExtent = [Math.min(...dates), Math.max(...dates) + 1], yExtent = valueExtent(data, state.config.y), sizeExtent = valueExtent(data, state.config.size);
  const margin = drawAxes(svg, width, height, "createdAt", state.config.y, xExtent, yExtent);
  const positionFor = item => ({
    x: clampedScale(new Date(item.createdAt).getTime(), xExtent, [margin.left, width - margin.right]),
    y: clampedScale(item[state.config.y], yExtent, [height - margin.bottom, margin.top])
  });
  let relationshipLayer = null;
  const relationshipLines = new Map();
  const relationshipNodes = new Map();
  let egoNetworks = new Map();
  if (state.config.relationshipLayer !== "off") {
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
    addTitle(dot, `${item.title} · ${new Date(item.createdAt).toLocaleDateString()}`);
    dot.addEventListener("click", () => item.entityRecord ? inspectEntity(item.entityRecord) : inspectDocument(item));
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
      svg.append(el("text", { x, y: Math.min(height - margin.bottom + 18, y + radius + state.config.labelSize), "text-anchor": "middle", class: "chart-label node-label" }, item.title.slice(0, 22)));
    }
  });
  drawIntensityLegend();
  setSummary(`${data.length} ${state.config.timelineRole === "entity" ? "entities" : "completed transcripts"}`, "timeline");
}

function renderMatrix() {
  const { svg, width, height } = clearChart();
  const sources = state.catalog.sources.filter(item => sourceMatches(item.name));
  const columns = state.config.matrixColumns === "entity"
    ? filteredEntities().sort((a, b) => b.contextAdjustedMentions - a.contextAdjustedMentions).slice(0, Math.min(state.config.limit, 18)).map(entity => ({ id: entity.id, label: entity.name, category: entity.category, entity }))
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
  }).slice(0, state.config.limit);
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
  tableView.innerHTML = `<table class="builder-table"><thead><tr>${fields.map(field => `<th scope="col">${escapeHTML(label(field))}</th>`).join("")}</tr></thead><tbody>${records.map((item, index) => `<tr tabindex="0" data-table-row="${index}">${fields.map(field => `<td>${escapeHTML(tableDisplayValue(item, field))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  $$('[data-table-row]').forEach(row => {
    const inspect = () => {
      const item = records[Number(row.dataset.tableRow)];
      if (state.config.tableRole === "entity") inspectEntity(item);
      else if (state.config.tableRole === "document") inspectDocument(item);
      else inspectGroup(item);
    };
    row.addEventListener("click", inspect);
    row.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); inspect(); } });
  });
  const rowLabel = state.config.tableRole === "entity" ? "entities" : state.config.tableRole === "document" ? "transcript files" : "collections";
  setSummary(`${records.length} ${rowLabel} · ${fields.length} columns`, "table");
}

function showEmpty() {
  $("#emptyState").hidden = false;
  setSummary("No matching records", state.config.type);
}

function setSummary(text, type) {
  $("#resultSummary").textContent = text;
  $("#graphKicker").textContent = label(type === "bars" ? "bar chart" : type);
  $("#policySummary").textContent = type === "network"
    ? state.config.nodeRole === "collection" ? `Links require ${state.config.minEvidence} shared published entities` : `Co-mentions require ${state.config.minEvidence} evidence segments · dense OCR sections excluded`
    : type === "map" ? "Coordinates come from the reviewed local gazetteer · ambiguous names omitted"
    : type === "book" ? "Titles require an explicit book, novel, or memoir cue in transcript text"
    : `${formatNumber(state.catalog.counts.documents)} source files · transcript text unchanged`;
}

function renderGraph() {
  if (!state.catalog) return;
  $("#emptyState").hidden = true;
  $("#graphTitle").textContent = state.config.title;
  $("#resetZoom").hidden = !["network", "map"].includes(state.config.type);
  $("#exportButton").textContent = state.config.type === "table" ? "Export CSV" : state.config.type === "map" ? "Export PNG" : "Export SVG";
  const descriptions = {
    network: state.config.nodeRole === "collection" ? "Collections connected by shared published entities." : "Evidence-backed connections across the local archive.", scatter: `${label(state.config.x)} compared with ${label(state.config.y)}.`,
    map: `Geocoded location entities sized by ${label(state.config.size)}.`,
    book: `Transcript-mentioned books arranged as an area-proportional shelf, sized by ${label(state.config.size)}.`,
    bars: `${label(state.config.y)} grouped by ${label(state.config.aggregation)}.`,
    timeline: `${state.config.timelineRole === "entity" ? "Entities" : "Completed transcript files"} by cataloging time.`,
    matrix: `${state.config.matrixColumns === "entity" ? "Entity" : "Entity-type"} coverage across completed collections.`,
    table: `A custom list of ${state.config.tableRole === "entity" ? "entities" : state.config.tableRole === "document" ? "transcript files" : "collections"}.`
  };
  $("#graphSubtitle").textContent = descriptions[state.config.type];
  ({ network: renderNetwork, map: renderMap, book: renderBook, scatter: renderScatter, bars: renderBars, timeline: renderTimeline, matrix: renderMatrix, table: renderTable })[state.config.type]();
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

function closeInspector() {
  $("#builderView").classList.add("inspector-collapsed");
  $("#inspector").classList.remove("has-selection");
  refreshGraphAfterInspectorResize();
}

function showInspector(category, title, metrics, evidence, note = "") {
  const inspector = $("#inspector");
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">${escapeHTML(label(category))}</p><h3>${escapeHTML(title)}</h3>${note ? `<p>${escapeHTML(note)}</p>` : ""}<div class="metric-row">${metrics.map(([value, name]) => `<div class="metric"><strong>${escapeHTML(formatNumber(value))}</strong><small>${escapeHTML(name)}</small></div>`).join("")}</div><div class="evidence-list"><h4>Evidence</h4>${evidenceHTML(evidence)}</div>`;
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
  showInspector(item.category, item.name, [...egoStats, [item.contextAdjustedMentions ?? item.mentions, "adjusted mentions"], [item.mentions, "raw mentions"], [item.independentDocumentCount ?? item.documentCount, "independent documents"], [item.sourceCount, "collections"]], item.evidence, `${inflationNote}${geographyNote}${egoNote} ${label(item.reviewStatus)} · ${item.variants.length} observed name variant${item.variants.length === 1 ? "" : "s"}`);
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
  showInspector(item.format, item.title, [[item.words, "words"], [item.segments, "segments"], [item.bytes, "source bytes"]], [{ documentId: item.id, excerpt: `Completed ${new Date(item.createdAt).toLocaleString()}` }], item.source);
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

function exportSVG() {
  const svg = $("#chart").cloneNode(true);
  svg.setAttribute("xmlns", NS);
  svg.insertAdjacentHTML("afterbegin", `<style>.chart-label{fill:#111;font-family:"SF Mono","IBM Plex Mono",ui-monospace,monospace;font-size:var(--graph-label-size,12px);font-weight:650;paint-order:stroke;stroke:#f6f5ef;stroke-width:3px;stroke-linejoin:round}.axis-label{fill:#555;font:11px "SF Mono",ui-monospace,monospace}.grid-line{stroke:#111;stroke-opacity:.12}.edge{stroke:#111;stroke-opacity:.28}</style>`);
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${state.config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`; link.click(); URL.revokeObjectURL(link.href);
}

function exportCSV() {
  const fields = state.config.tableColumns.filter(field => TABLE_FIELDS[state.config.tableRole].includes(field));
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [fields.map(field => quote(label(field))).join(","), ...tableRecords().map(item => fields.map(field => quote(tableDisplayValue(item, field))).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${state.config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`; link.click(); URL.revokeObjectURL(link.href);
}

function exportCurrent() {
  if (state.config.type === "table") exportCSV();
  else if (state.config.type === "map") window.ufoGlobe?.exportPNG(state.config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  else exportSVG();
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
