/* UFO Files Graph Builder — dependency-free, GitHub Pages compatible. */

const NS = "http://www.w3.org/2000/svg";
const AXIS_MARGIN = Object.freeze({ left: 58, right: 28, top: 22, bottom: 48 });
const CONFIG_VERSION = 3;
const DOSSIER_SCHEMA = "ufo-files-case-dossier/v1";
const PUBLIC_DOSSIER_SCHEMA = "ufo-files-public-dossier/v1";
const ASTRONOMY_BOOTSTRAP_SCHEMA = "ufo-files-astronomy-bootstrap/v1";
const CLAIM_POLICY_VERSION = "ufo-files-claim-policy/v2";
const SOURCE_FAMILY_POLICY_VERSION = "ufo-files-source-family-policy/v1";
const CORROBORATION_METRICS = ["independentSourceFamilyCount", "independentDocumentCount", "documentCount", "epistemicAdjustedMentions", "contextAdjustedMentions", "mentions"];
const CLAIM_RELATIONSHIPS = ["supports", "contradicts", "qualifies", "repeats", "supersedes", "unclear"];
const CLAIM_REVIEW_STATUSES = ["candidate", "published", "rejected"];
const DOSSIER_STORAGE_KEY = "ufo-files-case-dossier";
const DOSSIER_RECORD_TYPES = ["documents", "events", "entities", "relationships", "crafts", "species"];
const DOSSIER_LEGACY_RECORD_TYPES = ["documents", "events", "entities", "relationships"];
const DOSSIER_RECORD_SINGULAR = { documents: "document", events: "event", entities: "entity", relationships: "relationship", crafts: "craft", species: "species" };
const DOSSIER_RECORD_LABEL = { documents: "Document", events: "Event", entities: "Entity", relationships: "Relationship", crafts: "Craft class", species: "Species profile" };
const DOSSIER_STANCES = ["supporting", "contrary", "context"];
const REPORTED_EVENT_AUTOMATIC_START_DATE = "1947-01-01";
const DEFAULT_TIMELINE_RELEVANCE_CUTOFF = 250;
const TIMELINE_RELEVANCE_GUIDE_FRACTION = .75;
const DEFAULT_TIMELINE_RECENCY_YEAR = 2000;
// Audited against the preserved UPDB source rows on 2026-08-16. Keep scripts/build_catalog.py aligned.
const NICAP_IMPRECISE_DATE_DATABASE_IDS = new Set([
  5176761, 5176770, 5176790, 5176793, 5176826, 5176867, 5176876, 5176956, 5176975, 5176984,
  5178685, 5179533, 5180213, 5180214, 5180586, 5180630, 5181077, 5181078, 5181079, 5181319,
  5181349, 5181494, 5182083
]);
const TIMELINE_DECADE_FLOOR = 40;
const TIMELINE_HISTORICAL_MARKERS = [
  {
    date: "1939-09-01",
    label: "World War II begins (1939)",
    shortLabel: "WWII begins (1939)",
    detail: "Germany invaded Poland on September 1, 1939, initiating World War II in Europe (United States Holocaust Memorial Museum).",
    sourceUrl: "https://encyclopedia.ushmm.org/content/en/timeline-event/holocaust/1939-1941/german-invasion-of-poland"
  },
  {
    date: "1945-07-16",
    label: "Nuclear era begins - Trinity (1945)",
    shortLabel: "Trinity (1945)",
    detail: "The United States detonated the world's first nuclear device at the Trinity site in New Mexico on July 16, 1945 (U.S. National Park Service).",
    sourceUrl: "https://home.nps.gov/whsa/learn/historyculture/trinity-site.htm"
  },
  {
    date: "1961-04-12",
    label: "First human in space (1961)",
    shortLabel: "First human in space (1961)",
    detail: "Soviet cosmonaut Yuri Gagarin became the first human in space and the first to orbit Earth aboard Vostok 1 on April 12, 1961 (NASA).",
    sourceUrl: "https://science.nasa.gov/resource/yuri-gagarin-first-human-in-space/"
  },
  {
    date: "1972-01-01",
    precision: "year",
    label: "SRI remote-viewing research begins (1972)",
    shortLabel: "SRI remote viewing (1972)",
    detail: "A CIA review states that its parapsychology program began in 1972; the early remote-viewing research was conducted at Stanford Research Institute. This marker is year-precision and does not assert an exact start day.",
    sourceUrl: "https://www.cia.gov/readingroom/docs/CIA-RDP96-00791R000100150002-0.pdf"
  },
  {
    date: "1993-09-10",
    label: "The X-Files premieres (1993)",
    shortLabel: "The X-Files (1993)",
    detail: "The X-Files premiered on Fox on September 10, 1993 (Television Academy).",
    sourceUrl: "https://interviews.televisionacademy.com/shows/x-files-the"
  },
  {
    date: "2007-06-29",
    label: "First iPhone goes on sale (2007)",
    shortLabel: "First iPhone (2007)",
    detail: "The first iPhone went on sale in the United States on June 29, 2007 (Apple).",
    sourceUrl: "https://www.apple.com/newsroom/2007/06/28iPhone-Premieres-This-Friday-Night-at-Apple-Retail-Stores/"
  }
];
const SPECIES_LINEUP_ASSETS = new Map([
  ["andromedans", "species-andromedans.svg"],
  ["anunnaki", "species-anunnaki.svg"],
  ["bledsoe_red_eyed_being", "species-bledsoe-red-eyed-being-v3.svg"],
  ["celestials", "species-celestials.svg"],
  ["ebes", "species-ebes.svg"],
  ["greys", "species-grey-races.svg"],
  ["lyrans", "species-lyrans.svg"],
  ["mantis_beings", "species-mantis-beings.svg"],
  ["men_in_black", "species-men-in-black.svg"],
  ["mothman", "species-mothman.svg"],
  ["orb_light_beings", "species-light-beings.svg"],
  ["pleiadians", "species-pleiadians.svg"],
  ["renegade_pleiadians", "species-renegade-pleiadians.svg"],
  ["rigelians", "species-reptilians.svg"],
  ["skinny_bob", "species-skinny-bob-v5.svg"],
  ["synthetics", "species-synthetics.svg"],
  ["venusians", "species-venusians.svg"],
  ["zeta_reticulans", "species-zeta-reticulans.svg"]
].map(([classId, file]) => [classId, `assets/species/vector/${file}`]));
const SPECIES_LINEUP_SILHOUETTES = new Map([...SPECIES_LINEUP_ASSETS].map(([classId, asset]) => [
  classId,
  asset.replace("/vector/", "/silhouette/")
]));
const SPECIES_LINEUP_NO_BACKGROUND = new Set(["bledsoe_red_eyed_being", "skinny_bob"]);
const SPECIES_LINEUP_GENERIC_ASSET = "assets/species/vector/species-generic-figure.svg";
const SPECIES_LINEUP_GENERIC_SILHOUETTE = "assets/species/silhouette/species-generic-figure.svg";
const SPECIES_LINEUP_DISPLAY_ASSETS = new Map([
  ["anunnaki", "assets/species/vector/display/species-anunnaki.svg"],
  ["greys", "assets/species/vector/display/species-grey-races.svg"],
  ["lyrans", "assets/species/vector/display/species-lyrans.svg"],
  ["mantis_beings", "assets/species/vector/display/species-mantis-beings.svg"],
  ["men_in_black", "assets/species/vector/display/species-men-in-black.svg"],
  ["mothman", "assets/species/vector/display/species-mothman.svg"],
  ["rigelians", "assets/species/vector/display/species-reptilians.svg"],
  ["synthetics", "assets/species/vector/display/species-synthetics.svg"]
]);
const SPECIES_LINEUP_GENERIC_DISPLAY_ASSETS = new Map([
  ["arcturians", "assets/species/vector/display/species-generic-figure-tall.svg"],
  ["renegade_pleiadians", "assets/species/vector/display/species-generic-figure-tall.svg"],
  ["zeta_reticulans", "assets/species/vector/display/species-generic-figure-small.svg"]
]);
const SPECIES_PRESENTATION_OVERRIDES = new Map([
  ["mothman", {
    illustrationDescriptors: ["dark gray-to-black", "small round head", "prominent red eyes", "broad folded pterosaur-like wings"]
  }],
  ["rigelians", {
    name: "Reptilians",
    groundingAppearance: "The chart consolidates reviewed reptilian labels under the familiar umbrella name Reptilians. Narrower source wording remains visible only in the literal corpus excerpts.",
    illustrationDescriptors: ["bipedal", "forward-facing eyes", "multiple fingers", "reptilian"]
  }]
]);
const SPECIES_LINEUP_REFERENCE_PROFILES = [
  {
    id: "species-class-bledsoe_red_eyed_being",
    classId: "bledsoe_red_eyed_being",
    name: "Cape Fear red-eyed being",
    category: "other",
    categoryLabel: "Other reported beings",
    groundingType: "reference",
    groundingAppearance: "A small humanoid reported with a glassy glow around its body, little or no visible neck, red goggle-like eyes, a mask-like lower-face covering, and a dark plate-like object on its chest.",
    identityNote: "Reference profile for the figure described in the Bledsoe Cape Fear account and published in MUFON Journal (June 2008). It is kept distinct from Bledsoe's later Lady account and does not assert a biological species.",
    physicalHeight: { minFeet: 4, maxFeet: 5, representativeFeet: 4.5, label: "4′–5′", basis: "Range reported in MUFON Journal, June 2008" },
    illustrationDescriptors: ["glassy-looking humanoid", "little or no neck", "red goggle-like eyes", "lower-face covering", "dark chest plate"]
  },
  {
    id: "species-class-skinny_bob",
    classId: "skinny_bob",
    name: "Skinny Bob",
    category: "zeta_grey",
    categoryLabel: "Zeta / Grey",
    groundingType: "reference",
    groundingAppearance: "A very slender humanoid with an oversized bald head, large dark almond-shaped eyes, reduced facial features, long thin limbs, and a dark close-fitting garment.",
    identityNote: "Visual-reference profile based on anonymously uploaded 2011 footage. The footage's provenance and authenticity remain unresolved; inclusion in the lineup is not authentication. The displayed height is Nanstiel's reported height for beings he identified with the footage, not a measurement of the filmed figure.",
    physicalHeight: { minFeet: 3.5, maxFeet: 3.5, representativeFeet: 3.5, label: "reported 3′6″", basis: "Erik Nanstiel's reported height for beings he identified as matching Skinny Bob in Area 52 DEBRIEFED ep. 85" },
    illustrationDescriptors: ["very slender humanoid", "oversized bald head", "large dark almond-shaped eyes", "long thin limbs", "dark close-fitting garment"]
  }
].map(profile => ({
  ...profile,
  observationCount: 0,
  documentCount: 0,
  sourceCount: 0,
  confidence: 0,
  documentIds: [],
  evidence: [],
  appearanceEvidence: [],
  appearanceEvidenceCount: 0,
  observations: []
}));

function speciesPresentation(speciesClass) {
  return {
    ...speciesClass,
    ...(SPECIES_PRESENTATION_OVERRIDES.get(speciesClass.classId) || {})
  };
}

function applySpeciesPresentation(catalog) {
  if (!catalog?.species?.classes) return catalog;
  return {
    ...catalog,
    species: {
      ...catalog.species,
      classes: catalog.species.classes.map(speciesPresentation)
    }
  };
}
const SPECIES_LINEUP_CANVAS_HEIGHT = 1536;
const SPECIES_LINEUP_HEIGHT_CEILING_FEET = 12;
const SPECIES_LINEUP_UNSTATED_HEIGHT_FEET = 6;
const SPECIES_LINEUP_INK_BOUNDS = new Map([
  ["generic_figure", { top: 50, bottom: 1458 }],
  ["andromedans", { top: 54, bottom: 1494 }],
  ["anunnaki", { top: 34, bottom: 1518 }],
  ["bledsoe_red_eyed_being", { top: 47, bottom: 1491 }],
  ["celestials", { top: 38, bottom: 1524 }],
  ["ebes", { top: 50, bottom: 1500 }],
  ["greys", { top: 38, bottom: 1505 }],
  ["lyrans", { top: 68, bottom: 1509 }],
  ["mantis_beings", { top: 157, bottom: 1496 }],
  ["men_in_black", { top: 47, bottom: 1499 }],
  ["mothman", { top: 184, bottom: 1397 }],
  ["orb_light_beings", { top: 24, bottom: 1462 }],
  ["pleiadians", { top: 36, bottom: 1490 }],
  ["renegade_pleiadians", { top: 58, bottom: 1478 }],
  ["rigelians", { top: 45, bottom: 1480 }],
  ["skinny_bob", { top: 60, bottom: 1477 }],
  ["synthetics", { top: 52, bottom: 1504 }],
  ["venusians", { top: 36, bottom: 1500 }],
  ["zeta_reticulans", { top: 32, bottom: 1510 }]
]);
const ENTITY_CATEGORIES = ["person", "government_agency", "organization", "location", "program", "subject", "book", "date"];
const COVERAGE_DIMENSIONS = ["time", "geography", "collection", "format", "category", "modality"];
const COVERAGE_MULTI_VALUE_DIMENSIONS = new Set(["geography", "category", "modality"]);
const COVERAGE_DIMENSION_LABELS = {
  time: "Time period", geography: "Geography", collection: "Collection", format: "Document format",
  category: "Entity / subject category", modality: "Event / evidence modality"
};
const LABELS = {
  person: "People", government_agency: "Government agencies", organization: "Organizations",
  location: "Locations", program: "Programs", subject: "Subjects", book: "Books", date: "Dates",
  mentions: "Raw mentions", documentCount: "Raw documents", sourceCount: "Collections", independentSourceFamilyCount: "Independent source families",
  contextAdjustedMentions: "Mentions", independentDocumentCount: "Documents",
  inflationRate: "Mention adjustment", documentInflationRate: "Potential prominence inflation", inflationRisk: "Prominence inflation risk", inflatedMentionCount: "Adjusted mentions", inflatedDocumentCount: "Adjusted documents", epistemicAdjustedMentions: "Evidence-weighted mentions",
  classificationConfidence: "Classification confidence", extractionConfidence: "Extraction confidence",
  words: "Words", documents: "Documents", segments: "Segments", bytes: "Source bytes",
  createdAt: "Cataloged at", documentDate: "Document date", startDate: "Event date", confidence: "Confidence", mentionCount: "Event mentions", mentionRank: "Mention rank", eventCount: "Events", durationMs: "Duration", source: "Collection", format: "Format",
  entity: "Entities", document: "Transcript files", name: "Name", title: "Title",
  category: "Entity type", reviewStatus: "Review status", engine: "Engine", path: "Path",
  table: "Table", collection: "Collections", shared_entities: "Shared entities", craft: "Craft", species: "Species", signals: "Signals",
  human: "Human", zeta_grey: "Zeta / Grey", animal_insect: "Animal / insect", hybrid: "Hybrid", reptilian: "Reptilian", other: "Other",
  case: "Cases", caseKind: "Case kind", resolutionStatus: "Resolution status", reportStatus: "Report status",
  assessmentAuthority: "Assessment authority", sensorModalities: "Sensor modalities", witnessTypes: "Witness types",
  dataCompletenessScore: "Scientific metadata completeness", collectionCount: "Collections",
  observationCount: "Observations", evidenceStrength: "Evidence strength", dominantCollection: "Dominant collection", craftConfidence: "Classification confidence",
  claims: "Claims", supports: "Supports", contradicts: "Contradicts", qualifies: "Qualifies",
  repeats: "Repeats", supersedes: "Supersedes", unclear: "Unclear relationship", coverage: "Coverage",
  time: "Time period", geography: "Geography", modality: "Event / evidence modality", datedDocumentCount: "Dated documents",
  reported_sighting: "Reported sighting", event_group: "Event group"
};
function bookAuthor(item) {
  const supplied = item.author || item.authors || item.creator;
  return Array.isArray(supplied) ? supplied.join(" & ") : supplied || "";
}
const TABLE_FIELDS = {
  entity: ["name", "category", "independentSourceFamilyCount", "epistemicAdjustedMentions", "contextAdjustedMentions", "mentions", "inflationRate", "documentInflationRate", "inflationRisk", "independentDocumentCount", "documentCount", "sourceCount", "classificationConfidence", "extractionConfidence", "reviewStatus"],
  document: ["title", "source", "format", "words", "segments", "bytes", "createdAt", "engine", "durationMs", "path"],
  source: ["name", "documents", "words"],
  case: ["title", "startDate", "eventType", "caseKind", "resolutionStatus", "assessmentAuthority", "sensorModalities", "witnessTypes", "dataCompletenessScore", "independentSourceFamilyCount", "collectionCount", "reviewStatus"]
};
const TRIAGE_SIGNALS = [
  { id: "supportingDocuments", label: "Supporting documents", fields: "events[].documentIds", denominator: 3 },
  { id: "collectionDiversity", label: "Collection diversity", fields: "documents[].source", denominator: 3 },
  { id: "dateSpecificity", label: "Unambiguous event date", fields: "events[].startDate + datePrecision", denominator: 1 },
  { id: "mappedLocation", label: "Mapped location", fields: "events[].entityIds → entities[].geo", denominator: 1 },
  { id: "associatedEntities", label: "Associated entities", fields: "events[].entityIds + entities[].category", denominator: 1 },
  { id: "typedRelationships", label: "Typed relationships", fields: "events[].entityIds → edges[].relationship", denominator: 2 },
  { id: "evidenceExcerpts", label: "Source excerpts", fields: "events[].evidence", denominator: 3 },
  { id: "identityAmbiguity", label: "Identity ambiguity", fields: "events[].entityIds → duplicateCandidates[]", denominator: 1 },
  { id: "metadataGaps", label: "Metadata follow-up", fields: "events[].startDate,datePrecision,documentIds,evidence,entityIds,eventType,titleReviewStatus", denominator: 5 }
];
const TRIAGE_PROFILES = {
  "evidence-rich": {
    label: "Evidence rich",
    weights: { supportingDocuments: 3, collectionDiversity: 2, dateSpecificity: 1, mappedLocation: 1, associatedEntities: 2, typedRelationships: 1, evidenceExcerpts: 2 }
  },
  "needs-follow-up": {
    label: "Needs follow-up",
    weights: { identityAmbiguity: 4, metadataGaps: 5, collectionDiversity: 1 }
  },
  "metadata-incomplete": {
    label: "Metadata incomplete",
    weights: { metadataGaps: 5, identityAmbiguity: 1 }
  }
};

function triageSignalsForProfile(profileId = "evidence-rich") {
  const weights = TRIAGE_PROFILES[profileId]?.weights || TRIAGE_PROFILES["evidence-rich"].weights;
  return Object.fromEntries(TRIAGE_SIGNALS.map(signal => [signal.id, {
    enabled: Object.hasOwn(weights, signal.id),
    weight: Math.min(5, Math.max(1, Number(weights[signal.id]) || 1))
  }]));
}

function normalizeTriageSignals(signals) {
  const defaults = triageSignalsForProfile();
  return Object.fromEntries(TRIAGE_SIGNALS.map(signal => {
    const configured = signals?.[signal.id];
    return [signal.id, {
      enabled: configured?.enabled === undefined ? defaults[signal.id].enabled : Boolean(configured.enabled),
      weight: Math.min(5, Math.max(1, Number(configured?.weight) || defaults[signal.id].weight))
    }];
  }));
}
const TYPES = [
  { id: "network", label: "Network", scope: "All", icon: "<circle cx='6' cy='8' r='3'/><circle cx='24' cy='4' r='3'/><circle cx='22' cy='16' r='3'/><path d='M9 7l12-2M9 10l10 5M23 7l-1 6'/>" },
  { id: "map", label: "Map", scope: "Locations", icon: "<circle cx='15.5' cy='10' r='8'/><path d='M7.5 10h16M15.5 2c3 3 3 13 0 16m0-16c-3 3-3 13 0 16'/>" },
  { id: "solar", label: "Galactic Entities", scope: "Reviewed astronomy", icon: "<path d='M4 13c5-9 17-9 23-4M4 7c7 9 18 9 23 3'/><circle cx='16' cy='10' r='2'/><circle cx='24' cy='6' r='1'/>" },
  { id: "book", label: "Bookshelf", scope: "Books", icon: "<path d='M3 3h5v14H3zM9 5h4v12H9zM14 2h6v15h-6zM21 6h7v11h-7zM2 18h27'/>" },
  { id: "document", label: "Documents", scope: "All corpus files", icon: "<path d='M7 2h12l5 5v11H7zM19 2v5h5M11 11h9M11 14h9'/><path d='M4 5H2v15h17v-2'/>" },
  { id: "craft", label: "Craft", scope: "Reported shapes", icon: "<path d='M3 15h25M6 15l5-8h9l5 8M11 7l4 8 5-8M4 4h23M4 2v4m23-4v4'/>" },
  { id: "species", label: "Species", scope: "ET names in corpus", icon: "<circle cx='15.5' cy='8' r='5'/><path d='M8 18c1-5 4-7 7.5-7s6.5 2 7.5 7M13 7h1m3 0h1M4 4h4m15 0h4M3 15h4m17 0h4'/>" },
  { id: "signals", label: "Signals", scope: "Frequencies in corpus", icon: "<path d='M2 17h27M4 17V13l2-1 2 5 2-9 2 9 3-3 2 3 2-13 2 13 2-6 2 6h3'/><path d='M4 3v3m23-3v3'/>" },
  { id: "scatter", label: "Scatter", scope: "All", icon: "<path d='M3 2v16h25'/><circle cx='9' cy='13' r='2'/><circle cx='15' cy='9' r='2'/><circle cx='22' cy='5' r='2'/>" },
  { id: "bars", label: "Bars", scope: "All collections", icon: "<path d='M3 2v16h26M7 15h4V8H7zm8 0h4V4h-4zm8 0h4v-9h-4z'/>" },
  { id: "timeline", label: "Timeline", scope: "Documents + events", icon: "<path d='M3 10h25M8 5v10m7-7v7m8-12v12'/><circle cx='8' cy='10' r='2'/><circle cx='15' cy='10' r='2'/><circle cx='23' cy='10' r='2'/>" },
  { id: "programs", label: "Programs", scope: "Government operations", icon: "<path d='M3 4h25M3 10h25M3 16h25M8 2v4m7 2v4m9-4v4M11 14v4m11-4v4'/>" },
  { id: "matrix", label: "Matrix", scope: "Collections × entity types", icon: "<path d='M4 3h22v15H4zM11 3v15m8-15v15M4 8h22m-22 5h22'/>" },
  { id: "coverage", label: "Coverage", scope: "Corpus gaps + completeness", icon: "<path d='M4 3h22v15H4zM4 8h22M11 3v15m8-15v15'/><path d='M12 9h6v4h-6z' fill='currentColor' stroke='none'/>" },
  { id: "table", label: "Table", scope: "All", icon: "<path d='M3 3h25v15H3zM3 8h25M3 13h25M12 3v15'/>" },
  { id: "triage", label: "Triage", scope: "Candidate cases", icon: "<path d='M4 3h23v15H4zM8 7h3M14 7h9M8 11h3M14 11h9M8 15h3M14 15h9'/>" },
  { id: "claims", label: "Claims", scope: "Reviewed propositions", icon: "<path d='M3 3h9v6H3zM19 11h9v6h-9zM12 6h5v8h2M8 9v5h11'/><circle cx='8' cy='15' r='2'/>" }
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
    config: { type: "scatter", x: "entity", y: "epistemicAdjustedMentions", size: "independentDocumentCount", categories: ["person"], sources: [], includeHighInflation: false }
  },
  {
    id: "significant-places",
    label: "Significant Places",
    config: { type: "scatter", x: "entity", y: "epistemicAdjustedMentions", size: "independentDocumentCount", categories: ["location"], sources: [], includeHighInflation: false }
  },
  {
    id: "significant-books",
    label: "Significant Books",
    config: { type: "scatter", x: "entity", y: "epistemicAdjustedMentions", size: "independentDocumentCount", categories: ["book"], sources: [], includeHighInflation: false }
  },
  {
    id: "significant-terms",
    label: "Significant Terms",
    config: { type: "scatter", x: "entity", y: "epistemicAdjustedMentions", size: "independentDocumentCount", categories: ["subject"], sources: [], includeHighInflation: false }
  }
];
const DEFAULT = {
  configVersion: CONFIG_VERSION,
  type: "scatter", x: "independentDocumentCount", y: "epistemicAdjustedMentions", size: "independentDocumentCount", color: "category",
  categories: [...ENTITY_CATEGORIES], sources: [], allSources: true, relation: "all",
  includeHighInflation: true,
  minEvidence: 2, minConfidence: 0.95, minIndependentSourceFamilies: 1, limit: 50, labels: "top", aggregation: "source",
  corroborationMetric: "independentDocumentCount", sourceFamilyPolicy: SOURCE_FAMILY_POLICY_VERSION,
  relationshipLayer: "always", relationshipNeighbors: 1, relationshipNodeSize: "inherit", relationshipStrength: "subtle",
  nodeRole: "entity", timelineRole: "event", timelineGrouping: true, timelineGroupPeriod: "year", timelineCorrelativeMarkers: true, timelineHistoricalCandidates: false, timelineRelevanceCutoff: DEFAULT_TIMELINE_RELEVANCE_CUTOFF, timelineRecencyYear: DEFAULT_TIMELINE_RECENCY_YEAR, matrixColumns: "category", matrixNormalize: "raw",
  tableRole: "entity", tableColumns: ["name", "category", "mentions", "documentCount", "sourceCount"],
  tableSort: "mentions", tableDirection: "desc", tableSearch: "", documentSearch: "",
  triageProfile: "evidence-rich", triageSignals: triageSignalsForProfile(), triageSort: "score", triageDirection: "desc", triageSearch: "", triageCaseId: "",
  claimPolicyVersion: CLAIM_POLICY_VERSION, claimEntity: "all", claimDateStart: "", claimDateEnd: "", claimRelation: "all", claimReviewStatus: "published",
  craftSize: "documentCount", craftColor: "confidence", craftWitnessType: "all", craftDimensions: "all", craftDateFrom: "", craftDateTo: "", craftLocation: "",
  speciesLayout: "lineup", speciesY: "physicalHeight", speciesSize: "documentCount", speciesSpacing: 0, speciesCategory: "all", speciesSearch: "",
  coverageRows: "collection", coverageColumns: "category", coverageMetric: "documentCount", coverageCompare: false,
  coverageACollection: "all", coverageAFrom: "", coverageATo: "", coverageBCollection: "all", coverageBFrom: "", coverageBTo: "",
  programStatus: "all", programKind: "all", programSearch: "",
  labelSize: 12, zoom: 1, moonTransitSeconds: 5, solarScale: "local", solarCase: "hill_fish", title: "Mentions by Documents", titleMode: "auto"
};
const DEFAULT_VIEW_TYPE = "timeline";
const VIEW_DEFAULTS = {
  scatter: { y: "epistemicAdjustedMentions" },
  network: { nodeRole: "entity", size: "independentDocumentCount", color: "category" },
  map: { categories: ["location"], size: "epistemicAdjustedMentions", color: "intensity", labels: "top", limit: 50, moonTransitSeconds: 5 },
  solar: { solarScale: "local", solarCase: "hill_fish", labels: "all" },
  book: { size: "epistemicAdjustedMentions", color: "intensity", labels: "all", limit: 20 },
  document: { size: "words", color: "source", labels: "top", documentSearch: "" },
  craft: { craftSize: "documentCount", craftColor: "confidence", craftWitnessType: "all", craftDimensions: "all", craftDateFrom: "", craftDateTo: "", craftLocation: "", minConfidence: 0.5, labelSize: 12 },
  species: { speciesLayout: "lineup", speciesY: "physicalHeight", speciesSize: "documentCount", speciesSpacing: 0, speciesCategory: "all", speciesSearch: "", minConfidence: 0.5, labelSize: 12 },
  signals: { allSources: true, sources: [], labels: "top", labelSize: 12 },
  bars: { aggregation: "source", y: "words", color: "intensity" },
  timeline: { timelineRole: "event", timelineGrouping: true, timelineGroupPeriod: "month", timelineCorrelativeMarkers: true, timelineHistoricalCandidates: false, x: "startDate", y: "mentionRank", size: "eventCount", color: "eventType", categories: ["date"], labels: "top", limit: 500, relationshipLayer: "always", timelineRelevanceCutoff: DEFAULT_TIMELINE_RELEVANCE_CUTOFF, timelineRecencyYear: DEFAULT_TIMELINE_RECENCY_YEAR },
  programs: { programStatus: "all", programKind: "all", programSearch: "", labelSize: 12 },
  matrix: { matrixColumns: "category", matrixNormalize: "rowShare", color: "intensity" },
  coverage: { coverageRows: "collection", coverageColumns: "category", coverageMetric: "documentCount", coverageCompare: false, coverageACollection: "all", coverageAFrom: "", coverageATo: "", coverageBCollection: "all", coverageBFrom: "", coverageBTo: "", allSources: true, sources: [] },
  table: { tableRole: "entity", tableColumns: ["name", "category", "mentions", "documentCount", "sourceCount"], tableSort: "mentions", tableDirection: "desc", tableSearch: "", limit: 60 },
  triage: { triageProfile: "evidence-rich", triageSignals: triageSignalsForProfile(), triageSort: "score", triageDirection: "desc", triageSearch: "", triageCaseId: "" },
  claims: { claimPolicyVersion: CLAIM_POLICY_VERSION, claimEntity: "all", claimDateStart: "", claimDateEnd: "", claimRelation: "all", claimReviewStatus: "published", allSources: true, sources: [] },
};
const ENTITY_PRESET_DEFAULTS = {
  network: { nodeRole: "entity" },
  bars: { aggregation: "entity" },
  timeline: { timelineRole: "entity" },
  matrix: { matrixColumns: "entity" },
  table: { tableRole: "entity" }
};
const state = { catalog: null, catalogMode: null, fullCatalogPromise: null, claimCatalog: null, programCatalog: null, config: loadConfig(), selected: null, documentById: new Map(), historicalTimelineCandidateCount: 0, dossier: null, dossierIsPublicReference: false, inspectorDossierSelection: null, dossierImportMessage: "" };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function adjustedEntityMetric(metric) {
  return ({ mentions: "epistemicAdjustedMentions", contextAdjustedMentions: "epistemicAdjustedMentions", documentCount: "independentDocumentCount" })[metric] || metric;
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

function normalizeCoverageAxes(config) {
  if (!COVERAGE_DIMENSIONS.includes(config.coverageRows)) config.coverageRows = DEFAULT.coverageRows;
  if (!COVERAGE_DIMENSIONS.includes(config.coverageColumns)) config.coverageColumns = DEFAULT.coverageColumns;
  if (config.coverageRows === config.coverageColumns && !COVERAGE_MULTI_VALUE_DIMENSIONS.has(config.coverageRows)) {
    config.coverageColumns = DEFAULT.coverageColumns === config.coverageRows
      ? COVERAGE_DIMENSIONS.find(dimension => dimension !== config.coverageRows)
      : DEFAULT.coverageColumns;
  }
  return config;
}

function coverageColumnDimensions(rowDimension) {
  return COVERAGE_DIMENSIONS.filter(dimension => dimension !== rowDimension || COVERAGE_MULTI_VALUE_DIMENSIONS.has(rowDimension));
}

function loadConfig() {
  try {
    const param = new URLSearchParams(location.hash.slice(1)).get("config");
    if (param) {
      const saved = JSON.parse(decodeURIComponent(escape(atob(param))));
      if (saved.allSources === undefined) saved.allSources = !saved.sources?.length;
      const config = { ...DEFAULT, ...saved };
      if (saved.type === "solar" && !Object.hasOwn(saved, "solarScale")) config.solarScale = "local";
      if (!["none", "hill_fish"].includes(config.solarCase)) config.solarCase = DEFAULT.solarCase;
      config.sourceFamilyPolicy = SOURCE_FAMILY_POLICY_VERSION;
      if (!CORROBORATION_METRICS.includes(config.corroborationMetric)) config.corroborationMetric = DEFAULT.corroborationMetric;
      config.labelSize = Math.max(10, Number(config.labelSize) || DEFAULT.labelSize);
      config.timelineRelevanceCutoff = Math.min(250, Math.max(10, Math.round(Number(config.timelineRelevanceCutoff) || DEFAULT.timelineRelevanceCutoff)));
      config.timelineRecencyYear = Math.min(2100, Math.max(1900, Math.round(Number(config.timelineRecencyYear) || DEFAULT.timelineRecencyYear)));
      config.speciesSpacing = Math.min(160, Math.max(-80, Number(config.speciesSpacing) || 0));
      config.triageSignals = normalizeTriageSignals(saved.triageSignals);
      if (!TRIAGE_PROFILES[config.triageProfile] && config.triageProfile !== "custom") config.triageProfile = "custom";
      if (config.type === "timeline" && config.timelineRole === "event") config.y = "mentionRank";
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
        && ["mentions", "contextAdjustedMentions", "epistemicAdjustedMentions"].includes(saved.y)
        && saved.categories?.length === 1
        && saved.categories[0] === legacySignificantCategory;
      if (isLegacySignificantView) {
        Object.assign(config, {
          y: "epistemicAdjustedMentions",
          size: "independentDocumentCount",
          includeHighInflation: false
        });
      }
      if (!saved.titleMode && saved.title) {
        const formerAutomaticTitles = new Set([
          "Evidence map", "Significant People", "Significant Places", "Significant Terms",
          "Collection coverage", "People and institutions", "Collection relationships",
          "Transcription activity", "Collections × entity types", "Archive entities"
        ]);
        const currentAutomaticLink = Number(saved.configVersion) >= CONFIG_VERSION && !Object.hasOwn(saved, "title");
        config.titleMode = currentAutomaticLink || formerAutomaticTitles.has(saved.title) ? "auto" : "custom";
      }
      normalizeCoverageAxes(config);
      if (config.titleMode === "auto") config.title = dataAwareTitle(config);
      return config;
    }
  } catch (_) {}
  return presetConfig("default");
}

function persistHash() {
  const saved = Object.fromEntries(Object.entries(state.config).filter(([key, value]) => {
    if (key === "configVersion") return true;
    if (key === "solarScale" && state.config.type === "solar") return true;
    if (key === "solarCase" && state.config.type === "solar") return true;
    if (key === "claimPolicyVersion" && state.config.type === "claims") return true;
    if (["corroborationMetric", "sourceFamilyPolicy"].includes(key)) return true;
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

function graphDocumentCountSubtitle(catalog) {
  const count = Number(catalog?.counts?.documents ?? catalog?.documents?.length ?? 0);
  return `${count.toLocaleString()} source document${count === 1 ? "" : "s"}`;
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
    title = config.x === "entity" && ["mentions", "contextAdjustedMentions", "epistemicAdjustedMentions"].includes(config.y)
      ? `Significant ${entities}`
      : `${label(config.y)} by ${label(config.x)}${defaultEntityScope ? "" : ` — ${entities}`}`;
  } else if (config.type === "network") {
    title = config.nodeRole === "collection" ? "Collection Relationships" : defaultEntityScope ? "Relationships" : `${entities} Relationships`;
  } else if (config.type === "map") {
    title = `${label(config.size)} — Places Mentioned`;
  } else if (config.type === "solar") {
    title = "Galactic Entities";
  } else if (config.type === "book") {
    title = `Top ${config.limit} Books Mentioned`;
  } else if (config.type === "document") {
    title = "Document Finder";
  } else if (config.type === "craft") {
    title = "Reported Craft Shapes";
  } else if (config.type === "species") {
    title = "ET Species in the Corpus";
  } else if (config.type === "signals") {
    title = "Radio Frequencies in the Corpus";
  } else if (config.type === "programs") {
    title = "Government Programs & Operations";
  } else if (config.type === "bars") {
    title = config.aggregation === "entity" ? `${label(config.y)} by ${entities}` : `${label(config.y)} by ${label(config.aggregation)}`;
  } else if (config.type === "timeline") {
    title = config.timelineRole === "event" ? "Event Sequence" : config.timelineRole === "entity" ? `${entities} Over Time` : "Dated Source Documents";
  } else if (config.type === "matrix") {
    title = `Collections × ${config.matrixColumns === "entity" ? "Entities" : "Entity Types"}`;
  } else if (config.type === "coverage") {
    title = "Corpus Coverage & Gaps";
  } else if (config.type === "triage") {
    title = "Investigation Triage";
  } else if (config.type === "claims") {
    title = "Claim Lineage";
  } else {
    title = config.tableRole === "entity" ? tableEntityScopeTitle(config) : config.tableRole === "document" ? "Transcript Files" : config.tableRole === "case" ? "UAP Cases" : "Collections";
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

function normalizedClaimValue(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function claimScopeValue(claim, key) {
  return normalizedClaimValue(claim.scope?.[key]);
}

function compareClaimPropositions(left, right) {
  const sameCore = ["subject", "predicate", "object"].every(key => normalizedClaimValue(left[key]) === normalizedClaimValue(right[key]));
  if (!sameCore) return { type: "unclear", reason: "The subject, predicate, or object differs; wording alone is not enough to infer conflict." };

  const scopeKeys = ["time", "location"];
  const differingScope = scopeKeys.find(key => {
    const leftValue = claimScopeValue(left, key), rightValue = claimScopeValue(right, key);
    return leftValue && rightValue && leftValue !== rightValue;
  });
  if (differingScope) return { type: "unclear", reason: `The ${differingScope} scope differs, so the claims are not treated as contradictory.` };

  const leftModality = normalizedClaimValue(left.modality || "asserted");
  const rightModality = normalizedClaimValue(right.modality || "asserted");
  const leftPolarity = normalizedClaimValue(left.polarity || "positive");
  const rightPolarity = normalizedClaimValue(right.polarity || "positive");
  const sameScope = scopeKeys.every(key => claimScopeValue(left, key) === claimScopeValue(right, key));
  if (leftPolarity !== rightPolarity) {
    if (sameScope && leftModality === rightModality) return { type: "contradicts", reason: "Opposite polarity applies to the same proposition, scope, and modality." };
    return { type: "unclear", reason: "Polarity differs, but scope or modality also differs; human review is required." };
  }
  if (!sameScope || leftModality !== rightModality) return { type: "qualifies", reason: "The same proposition carries a narrower scope or different modality." };
  return { type: "repeats", reason: "The same proposition, scope, modality, and polarity appears again." };
}

function candidateClaimRelationship(left, right) {
  const comparison = compareClaimPropositions(left, right);
  return {
    id: `candidate-${left.id}-${right.id}`,
    from: left.id,
    to: right.id,
    type: comparison.type,
    rationale: comparison.reason,
    method: { type: "automated_candidate", name: "structured proposition comparison" },
    review: { status: "candidate", method: "not_reviewed" }
  };
}

function classifyDeviceCompromiseTestimony(text, options = {}) {
  const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  const compromiseAttribution = /\b(hack(?:ed|ing)?|compromis(?:e|ed|ing)|remote(?:ly)? control(?:led)?)\b/.test(normalized);
  const specificIntentionalBehavior = [
    /\b(?:it|device|phone|computer) (?:typed|composed|wrote) (?:a |the )?(?:message|text|email)\b/,
    /\b(?:it|device|phone|computer) (?:sent|posted|called|dialed|opened|deleted|installed|purchased)\b/,
    /\b(?:message|text|email|post|call|account action) (?:was |were )?(?:sent|posted|made|performed) without (?:my|our|the user's) (?:input|permission|authorization)\b/,
    /\b(?:remote-control|remote control) session\b/
  ].some(pattern => pattern.test(normalized));
  const independentlyVerifiedTechnicalEvidence = options.independentlyVerifiedTechnicalEvidence === true;
  const speakerDomains = new Set((options.speakerDomains || []).map(domain => String(domain).toLowerCase()));

  let classification = "device_anomaly";
  let attributionStatus = compromiseAttribution ? "unverified" : "not_attributed";
  if (specificIntentionalBehavior) {
    classification = "possible_intentional_control";
    attributionStatus = "specific_behavior_reported";
  }
  if (independentlyVerifiedTechnicalEvidence) {
    classification = "verified_device_compromise";
    attributionStatus = "independently_verified";
  }

  return {
    observationClass: classification,
    speakerAttribution: compromiseAttribution ? "device_compromise" : null,
    attributionStatus,
    domainRelevance: speakerDomains.has("cybersecurity") || speakerDomains.has("digital_forensics") || speakerDomains.has("software_engineering")
      ? "relevant_domain"
      : "domain_not_established",
    specificIntentionalBehavior,
    independentlyVerifiedTechnicalEvidence
  };
}

function validateClaimCatalog(catalog, documents = []) {
  const errors = [];
  if (catalog?.schema !== "ufo-files-claims/v1") errors.push("Claim schema must be ufo-files-claims/v1.");
  if (catalog?.policy?.version !== CLAIM_POLICY_VERSION) errors.push(`Claim policy must be ${CLAIM_POLICY_VERSION}.`);
  if (!String(catalog?.policy?.confidenceSemantics || "").trim()) errors.push("Claim confidence semantics are required.");
  if (!String(catalog?.policy?.evidenceBinding || "").trim()) errors.push("Claim evidence binding semantics are required.");
  if (!String(catalog?.policy?.domainExpertiseSemantics || "").trim()) errors.push("Claim domain-expertise semantics are required.");
  if (catalog?.policy?.deviceCompromise?.defaultObservationClass !== "device_anomaly") errors.push("Device-compromise policy must default unsupported causal claims to device_anomaly.");
  if (catalog?.policy?.deviceCompromise?.specificBehaviorClass !== "possible_intentional_control") errors.push("Device-compromise policy must distinguish specific intentional behavior from verified compromise.");
  if (catalog?.policy?.deviceCompromise?.verifiedClass !== "verified_device_compromise") errors.push("Device-compromise policy must reserve verification for reviewed technical evidence.");
  const documentIds = new Set(documents.map(document => document.id));
  const claims = Array.isArray(catalog?.claims) ? catalog.claims : [];
  const claimById = new Map(claims.map(claim => [claim.id, claim]));
  claims.forEach(claim => {
    const prefix = claim.id || "Unnamed claim";
    if (![claim.subject, claim.predicate, claim.object].every(value => typeof value === "string" && value.trim())) errors.push(`${prefix}: subject, predicate, and object are required.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.appearanceDate || "")) errors.push(`${prefix}: an exact appearanceDate is required.`);
    if (!Number.isFinite(claim.claimConfidence) || claim.claimConfidence < 0 || claim.claimConfidence > 1) errors.push(`${prefix}: claimConfidence must be between 0 and 1.`);
    if (!claim.sourceFamily?.id || !claim.sourceFamily?.label) errors.push(`${prefix}: source family is required.`);
    if (!documentIds.has(claim.evidence?.documentId) || !String(claim.evidence?.excerpt || "").trim()) errors.push(`${prefix}: exact document evidence is required.`);
    if (!/^[0-9a-f]{40}$/.test(claim.evidence?.sourceBlobSha || "")) errors.push(`${prefix}: a verified machine-data Git blob SHA is required.`);
    if (claim.review?.status === "published" && (!claim.extraction?.method || !claim.review?.method)) errors.push(`${prefix}: published claims require extraction and review methods.`);
  });
  (Array.isArray(catalog?.relationships) ? catalog.relationships : []).forEach(relationship => {
    const prefix = relationship.id || "Unnamed claim relationship";
    if (!CLAIM_RELATIONSHIPS.includes(relationship.type)) errors.push(`${prefix}: relationship type is invalid.`);
    if (!claimById.has(relationship.from) || !claimById.has(relationship.to)) errors.push(`${prefix}: both compared claims are required.`);
    if (relationship.review?.status === "published" && (!relationship.method?.type || !relationship.review?.method || !String(relationship.rationale || "").trim())) errors.push(`${prefix}: published relationships require comparison and review methods plus a rationale.`);
  });
  return errors;
}

function withSignificanceDefaults(entity) {
  const normalizeMetrics = metrics => {
    const documentCount = metrics.documentCount ?? metrics.documentIds?.length ?? 0;
    const independentDocumentCount = metrics.independentDocumentCount ?? documentCount;
    return {
      ...metrics,
      documentCount,
      contextAdjustedMentions: metrics.contextAdjustedMentions ?? metrics.mentions ?? 0,
      epistemicAdjustedMentions: metrics.epistemicAdjustedMentions ?? metrics.contextAdjustedMentions ?? metrics.mentions ?? 0,
      independentDocumentCount,
      independentSourceFamilyCount: metrics.independentSourceFamilyCount ?? documentCount,
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
    epistemicAdjustedMentions: entity.epistemicAdjustedMentions ?? Math.min(entity.mentions, adjusted),
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

function dossierClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dossierCatalogSnapshot(catalog = state.catalog) {
  return {
    schema: catalog?.schema || "Not recorded",
    generatedAt: catalog?.generatedAt || "Not recorded",
    repository: catalog?.input?.repository || "ufo-files/machine-data",
    revision: catalog?.input?.revision || "Not recorded"
  };
}

function normalizeDossierGraphConfiguration(value) {
  const supplied = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const config = dossierClone(DEFAULT);
  Object.keys(DEFAULT).forEach(key => {
    if (Object.hasOwn(supplied, key)) config[key] = dossierClone(supplied[key]);
  });
  if (!TYPES.some(type => type.id === config.type)) config.type = DEFAULT.type;
  ["categories", "sources", "tableColumns"].forEach(key => {
    if (!Array.isArray(config[key])) config[key] = dossierClone(DEFAULT[key]);
  });
  config.triageSignals = normalizeTriageSignals(config.triageSignals);
  return config;
}

function emptyDossier(catalog = state.catalog, config = state.config, timestamp = new Date().toISOString()) {
  return {
    schema: DOSSIER_SCHEMA,
    id: `dossier-${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    catalog: dossierCatalogSnapshot(catalog),
    graphConfiguration: normalizeDossierGraphConfiguration(config),
    scope: "",
    researchQuestion: "",
    records: { documents: [], events: [], entities: [], relationships: [], crafts: [], species: [] },
    annotations: { unresolvedQuestions: [], metadataGaps: [], followUpTasks: [] },
    review: { status: "unreviewed", rationale: "" }
  };
}

function trustedDossierSourceURL(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://github.com" && /^\/ufo-files\/machine-data\/blob\/[^/]+\/.+/.test(url.pathname);
  } catch (_) {
    return false;
  }
}

function validateDossierImport(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, errors: ["The imported file must contain a JSON object."] };
  if (value.schema !== DOSSIER_SCHEMA) errors.push(`Unsupported schema/version: expected ${DOSSIER_SCHEMA}.`);
  if (typeof value.id !== "string" || !value.id) errors.push("A dossier ID is required.");
  ["createdAt", "updatedAt"].forEach(field => {
    if (typeof value[field] !== "string" || Number.isNaN(Date.parse(value[field]))) errors.push(`${field} must be an ISO timestamp.`);
  });
  if (!value.catalog || typeof value.catalog !== "object" || typeof value.catalog.revision !== "string") errors.push("Catalog revision metadata is required.");
  if (!value.graphConfiguration || typeof value.graphConfiguration !== "object" || Array.isArray(value.graphConfiguration)) errors.push("Graph configuration must be an object.");
  if (!value.records || typeof value.records !== "object") errors.push("Records must be grouped by type.");
  DOSSIER_RECORD_TYPES.forEach(type => {
    const records = value.records?.[type];
    if (["crafts", "species"].includes(type) && records === undefined) return;
    if (!Array.isArray(records)) return errors.push(`records.${type} must be an array.`);
    records.forEach((record, index) => {
      if (!record || typeof record !== "object" || typeof record.id !== "string" || !record.id) errors.push(`records.${type}[${index}] requires a stable ID.`);
      if (!DOSSIER_STANCES.includes(record?.stance)) errors.push(`records.${type}[${index}] has an invalid evidence classification.`);
      if (typeof record?.addedAt !== "string" || Number.isNaN(Date.parse(record.addedAt))) errors.push(`records.${type}[${index}] requires an addedAt timestamp.`);
      if (!Array.isArray(record?.sourceLinks) || record.sourceLinks.some(link => !link || typeof link.documentId !== "string" || !trustedDossierSourceURL(link.url))) errors.push(`records.${type}[${index}] requires trusted HTTPS machine-data source links.`);
    });
  });
  if (!value.annotations || typeof value.annotations !== "object" || ["unresolvedQuestions", "metadataGaps", "followUpTasks"].some(key => !Array.isArray(value.annotations[key]))) errors.push("Annotation lists are invalid.");
  if (!value.review || !["unreviewed", "in_review", "needs_follow_up", "reviewed"].includes(value.review.status) || typeof value.review.rationale !== "string") errors.push("Review status or rationale is invalid.");
  if (typeof value.scope !== "string" || typeof value.researchQuestion !== "string") errors.push("Scope and research question must be strings.");
  return { valid: errors.length === 0, errors };
}

function loadDossier(storage = typeof localStorage === "undefined" ? null : localStorage) {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(DOSSIER_STORAGE_KEY));
    if (parsed?.records && !Array.isArray(parsed.records.crafts)) parsed.records.crafts = [];
    if (parsed?.records && !Array.isArray(parsed.records.species)) parsed.records.species = [];
    if (!validateDossierImport(parsed).valid) return null;
    parsed.graphConfiguration = normalizeDossierGraphConfiguration(parsed.graphConfiguration);
    parsed.records.crafts ||= [];
    parsed.records.species ||= [];
    return parsed;
  } catch (_) {
    return null;
  }
}

function persistDossier(dossier, storage = typeof localStorage === "undefined" ? null : localStorage, timestamp = new Date().toISOString()) {
  dossier.updatedAt = timestamp;
  const publicReference = dossier === state.dossier && state.dossierIsPublicReference;
  if (storage && !publicReference) storage.setItem(DOSSIER_STORAGE_KEY, JSON.stringify(dossier));
  return dossier;
}

function relationshipStableId(edge) {
  return `${edge.source}|${edge.relationship || "related"}|${edge.target}`;
}

function uniqueSourceLinks(documentIds = []) {
  return [...new Set(documentIds)].sort().map(documentId => {
    const document = state.documentById.get(documentId);
    return { documentId, url: document ? machineDataDocumentURL(document) : "" };
  }).filter(link => link.url);
}

function dossierRecord(type, item, labelText = "") {
  const singular = DOSSIER_RECORD_SINGULAR[type];
  if (singular === "species") item = speciesPresentation(item);
  const evidenceDocumentIds = (item.evidence || []).map(evidence => evidence.documentId);
  const documentIds = singular === "document"
    ? [item.id]
    : singular === "craft" || singular === "species"
      ? (item.observations || []).map(observation => observation.documentId)
    : singular === "entity" || singular === "event"
      ? (evidenceDocumentIds.length ? evidenceDocumentIds : (item.documentIds || []).slice(0, 1))
      : evidenceDocumentIds;
  return {
    id: singular === "relationship" ? relationshipStableId(item) : item.id,
    label: labelText || item.title || item.name || item.label || item.id,
    stance: "supporting",
    addedAt: "",
    sourceLinks: uniqueSourceLinks(documentIds),
    ...(singular === "relationship" ? { source: item.source, target: item.target, relationship: item.relationship || "related" } : {})
  };
}

function dossierSelection(type, items, labelFor) {
  const records = (Array.isArray(items) ? items : [items]).filter(Boolean).map(item => dossierRecord(type, item, labelFor?.(item) || ""));
  return { type, records };
}

function dossierRecordCount(dossier = state.dossier) {
  return DOSSIER_RECORD_TYPES.reduce((sum, type) => sum + (dossier?.records?.[type]?.length || 0), 0);
}

function dossierHasSelection(selection, dossier = state.dossier) {
  const ids = new Set(dossier?.records?.[selection?.type]?.map(record => record.id) || []);
  return Boolean(selection?.records?.length) && selection.records.every(record => ids.has(record.id));
}

function toggleDossierSelection(selection, stance = "supporting", timestamp = new Date().toISOString()) {
  if (!state.dossier || !selection?.records?.length) return;
  const records = state.dossier.records[selection.type] ||= [];
  if (dossierHasSelection(selection)) {
    const removeIds = new Set(selection.records.map(record => record.id));
    state.dossier.records[selection.type] = records.filter(record => !removeIds.has(record.id));
  } else {
    const existing = new Set(records.map(record => record.id));
    selection.records.forEach(record => {
      if (!existing.has(record.id)) records.push({ ...record, stance, addedAt: timestamp });
    });
  }
  persistDossier(state.dossier, undefined, timestamp);
  updateDossierCount();
  renderDossierCollector(selection);
  if ($("#dossierDialog")?.open) renderDossier();
}

function missingDossierRecords(dossier = state.dossier, catalog = state.catalog) {
  if (!dossier || !catalog) return [];
  const identifiers = {
    documents: new Set((catalog.documents || []).map(record => record.id)),
    events: new Set((catalog.events || []).map(record => record.id)),
    entities: new Set((catalog.entities || []).map(record => record.id)),
    crafts: new Set((catalog.craft?.classes || []).map(record => record.id)),
    species: new Set((catalog.species?.classes || []).map(record => record.id)),
    relationships: new Set((catalog.edges || []).map(relationshipStableId))
  };
  const sources = new Set((catalog.sources || []).map(source => source.id));
  return DOSSIER_RECORD_TYPES.flatMap(type => (dossier.records[type] || [])
    .filter(record => type === "relationships" && record.relationship === "shared_entities"
      ? !sources.has(record.source) || !sources.has(record.target)
      : identifiers[type] ? !identifiers[type].has(record.id) : false)
    .map(record => ({ type, id: record.id, label: record.label })));
}

function sortedDossier(dossier = state.dossier) {
  const exported = dossierClone(dossier);
  DOSSIER_RECORD_TYPES.forEach(type => {
    exported.records[type] ||= [];
    exported.records[type].sort((left, right) => left.id.localeCompare(right.id));
  });
  return exported;
}

function dossierJSON(dossier = state.dossier) {
  return `${JSON.stringify(sortedDossier(dossier), null, 2)}\n`;
}

function encodePublicPayload(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function publicDossierPayload(dossier = state.dossier) {
  const records = {};
  DOSSIER_RECORD_TYPES.forEach(type => {
    records[type] = [...(dossier.records[type] || [])].sort((left, right) => left.id.localeCompare(right.id)).map(record => ({
      id: record.id,
      ...(type === "relationships" ? { source: record.source, target: record.target, relationship: record.relationship } : {})
    }));
  });
  return {
    schema: PUBLIC_DOSSIER_SCHEMA,
    catalogRevision: dossier.catalog.revision,
    graphConfiguration: dossierClone(dossier.graphConfiguration),
    records
  };
}

function publicDossierURL(dossier = state.dossier) {
  const config = encodePublicPayload(dossier.graphConfiguration);
  const identifiers = encodePublicPayload(publicDossierPayload(dossier));
  return `${GRAPH_BUILDER_URL}#config=${encodeURIComponent(config)}&dossier=${encodeURIComponent(identifiers)}`;
}

function markdownText(value) {
  return String(value || "").replace(/([\\`*_[\]<>])/g, "\\$1");
}

function dossierReport(dossier = state.dossier) {
  const exported = sortedDossier(dossier);
  const lines = [
    "# UFO Files case dossier", "",
    `Dossier ID: ${markdownText(exported.id)}  `,
    `Review status: ${markdownText(label(exported.review.status))}  `,
    `Last updated: ${markdownText(exported.updatedAt)}`, "",
    "> This report neutrally lists public catalog records selected by an analyst. Selection and classification do not establish the accuracy of a claim or the credibility of a source.", "",
    "## Case frame", "",
    `**Scope:** ${markdownText(exported.scope) || "Not recorded."}`, "",
    `**Research question:** ${markdownText(exported.researchQuestion) || "Not recorded."}`, ""
  ];
  const stanceLabels = { supporting: "Evidence selected in support", contrary: "Evidence selected against", context: "Contextual records" };
  DOSSIER_STANCES.forEach(stance => {
    lines.push(`## ${stanceLabels[stance]}`, "");
    const records = DOSSIER_RECORD_TYPES.flatMap(type => exported.records[type].filter(record => record.stance === stance).map(record => ({ ...record, type })));
    if (!records.length) lines.push("No records selected.", "");
    records.forEach(record => {
      const target = record.sourceLinks[0]?.url;
      const title = target ? `[${markdownText(record.label)}](${target})` : markdownText(record.label);
      lines.push(`- ${title} — ${DOSSIER_RECORD_LABEL[record.type]}; stable ID \`${record.id.replaceAll("`", "")}\``);
    });
    if (records.length) lines.push("");
  });
  [["Unresolved questions", exported.annotations.unresolvedQuestions], ["Metadata gaps", exported.annotations.metadataGaps], ["Follow-up tasks", exported.annotations.followUpTasks]].forEach(([heading, entries]) => {
    lines.push(`## ${heading}`, "");
    if (entries.length) entries.forEach(entry => lines.push(`- ${markdownText(entry)}`));
    else lines.push("None recorded.");
    lines.push("");
  });
  lines.push("## Review rationale", "", markdownText(exported.review.rationale) || "No rationale recorded.", "", "## Provenance", "",
    `- Catalog schema: ${markdownText(exported.catalog.schema)}`,
    `- Catalog generated: ${markdownText(exported.catalog.generatedAt)}`,
    `- Source repository: ${markdownText(exported.catalog.repository)}`,
    `- Source revision: \`${exported.catalog.revision.replaceAll("`", "")}\``, "",
    "### Graph configuration", "", "```json", JSON.stringify(exported.graphConfiguration, null, 2), "```", "");
  return lines.join("\n");
}

function controlSelect(key, title, options) {
  const choices = options.map(option => {
    const value = typeof option === "string" ? option : option.value;
    const text = typeof option === "string" ? label(option) : option.label;
    return `<option value="${escapeHTML(value)}" ${state.config[key] === value ? "selected" : ""}>${escapeHTML(text)}</option>`;
  }).join("");
  return `<div class="control"><label for="control-${key}">${escapeHTML(title)}</label><select id="control-${key}" data-config="${key}">${choices}</select></div>`;
}

function presetConfig(id, type = DEFAULT_VIEW_TYPE) {
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
    tableColumns: [...(overrides.tableColumns || viewDefaults.tableColumns || DEFAULT.tableColumns)],
    triageSignals: normalizeTriageSignals(overrides.triageSignals || viewDefaults.triageSignals || DEFAULT.triageSignals)
  };
  const activeMetric = type === "table" ? config.tableSort : type === "bars" ? config.y : config.size;
  if (CORROBORATION_METRICS.includes(activeMetric)) config.corroborationMetric = activeMetric;
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
    : config[key] && typeof config[key] === "object"
      ? JSON.stringify(config[key]) === JSON.stringify(state.config[key])
    : state.config[key] === config[key]);
}

function activePresetId() {
  return PRESETS.find(presetMatches)?.id || "";
}

function activeTriageProfileId(config = state.config) {
  return Object.keys(TRIAGE_PROFILES).find(id => {
    const expected = triageSignalsForProfile(id);
    return TRIAGE_SIGNALS.every(signal => JSON.stringify(expected[signal.id]) === JSON.stringify(config.triageSignals?.[signal.id]));
  }) || "custom";
}

function triageSubtitle(config = state.config) {
  const profile = TRIAGE_PROFILES[activeTriageProfileId(config)];
  const signals = TRIAGE_SIGNALS
    .filter(signal => config.triageSignals?.[signal.id]?.enabled)
    .map(signal => `${signal.label.toLowerCase()} (${config.triageSignals[signal.id].weight}×)`);
  return `Published event records ranked by ${profile?.label || "custom"}${signals.length ? `: ${signals.join(", ")}` : ""}. Unknown inputs lower certainty, not priority.`;
}

function renderPresetControl() {
  if (state.config.type === "programs") {
    $("#presetControls").innerHTML = `<div class="control method-note"><div class="control-title">Reviewed chronology · v1</div><p>Officially documented programs and claims entered into the congressional record remain separate. Congressional provenance does not by itself confirm a program's existence or reported purpose.</p></div>`;
    return;
  }
  if (state.config.type === "claims") {
    $("#presetControls").innerHTML = `<div class="control method-note"><div class="control-title">Claim policy</div><p>${escapeHTML(state.claimCatalog?.policy?.short || "Published links require exact evidence and explicit review.")}</p></div>`;
    return;
  }
  if (state.config.type === "craft") {
    const version = state.catalog?.craft?.taxonomyVersion || "Loading…";
    $("#presetControls").innerHTML = `<div class="control method-note"><div class="control-title">Reviewed taxonomy · v${escapeHTML(version)}</div><p>Craft names stay source-neutral; detailed records retain their evidence and provenance.</p></div>`;
    return;
  }
  if (state.config.type === "species") {
    const version = state.catalog?.species?.taxonomyVersion || "Loading…";
    $("#presetControls").innerHTML = `<div class="control method-note"><div class="control-title">Reviewed taxonomy · v${escapeHTML(version)}</div><p>Reference names seed matching; only literal corpus mentions contribute nodes and counts.</p></div>`;
    return;
  }
  if (state.config.type === "triage") {
    const activeId = activeTriageProfileId();
    const options = Object.entries(TRIAGE_PROFILES).map(([id, profile]) => `<option value="${id}" ${activeId === id ? "selected" : ""}>${escapeHTML(profile.label)}</option>`).join("");
    $("#presetControls").innerHTML = `<div class="control"><label for="control-triage-preset">Scoring preset</label><select id="control-triage-preset" data-triage-preset-select>${options}<option value="custom" ${activeId === "custom" ? "selected" : ""} disabled>Custom</option></select></div>`;
    return;
  }
  const activeId = activePresetId();
  const options = PRESETS.map(preset => `<option value="${escapeHTML(preset.id)}" ${activeId === preset.id ? "selected" : ""}>${escapeHTML(preset.label)}</option>`).join("");
  $("#presetControls").innerHTML = `<div class="control"><label for="control-preset">View preset</label><select id="control-preset" data-preset-select><option value="">Custom</option>${options}</select></div>`;
}

function renderPresetStatus() {
  if (state.config.type === "triage") {
    const select = $("[data-triage-preset-select]");
    if (select) select.value = activeTriageProfileId();
    return;
  }
  const select = $("[data-preset-select]");
  if (select) select.value = activePresetId();
}

function applyTriageProfile(id) {
  const profile = TRIAGE_PROFILES[id];
  if (!profile) return;
  state.config.triageProfile = id;
  state.config.triageSignals = triageSignalsForProfile(id);
  state.config.triageCaseId = "";
  closeInspector();
  renderControls();
  commitConfig();
  toast(`Scoring preset applied: ${profile.label}`);
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
  const numericEntity = ["independentSourceFamilyCount", "epistemicAdjustedMentions", "contextAdjustedMentions", "mentions", "independentDocumentCount", "documentCount", "sourceCount", "inflationRate", "documentInflationRate", "classificationConfidence", "extractionConfidence"];
  const numericDoc = ["words", "segments", "bytes", "durationMs"];
  const relationshipTypeControl = () => controlSelect("relation", "Relationship type", [{ value: "all", label: "Any published relationship" }, { value: "co_mentioned", label: "Repeated co-mention" }, { value: "affiliated_with", label: "Affiliation cue" }, { value: "investigated", label: "Investigation cue" }]);
  let roles = "";
  if (state.config.type === "claims") {
    roles = controlSelect("claimRelation", "Relationship", [{ value: "all", label: "All relationships" }, ...CLAIM_RELATIONSHIPS.map(value => ({ value, label: label(value) }))])
      + `<div class="control"><div class="control-title">Grouping</div><select disabled><option>Independent source family</option></select></div>`;
  } else if (state.config.type === "triage") {
    roles = `<div class="control"><div class="control-title">Candidates</div><select disabled><option>Published evidence-backed events</option></select></div>
      <div class="control method-note triage-disclaimer"><div class="control-title">Review-priority heuristic</div><p>Priority is not a judgment of truth, credibility, or threat. Scores only order review using the enabled catalog signals.</p></div>`;
  } else if (state.config.type === "network") {
    const relationshipControl = state.config.nodeRole === "collection"
      ? `<div class="control"><label for="collectionRelationship">Relationship</label><select id="collectionRelationship" disabled><option>Shared published entities</option></select></div>`
      : controlSelect("relation", "Relationship", [{ value: "all", label: "Any published relationship" }, { value: "co_mentioned", label: "Repeated co-mention" }, { value: "affiliated_with", label: "Affiliation cue" }, { value: "investigated", label: "Investigation cue" }]);
    roles = controlSelect("nodeRole", "Nodes", [{ value: "entity", label: "Entities" }, { value: "collection", label: "Collections" }]) + relationshipControl;
  } else if (state.config.type === "map") {
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Geocoded locations</option></select></div><div class="control"><div class="control-title">Position</div><select disabled><option>Reviewed coordinates</option></select></div>` + relationshipTypeControl();
  } else if (state.config.type === "solar") {
    roles = controlSelect("solarScale", "View", [{ value: "local", label: "Corpus neighborhood + Gaia DR3" }, { value: "galaxy", label: "Milky Way overview" }, { value: "sky", label: "Gaia observed sky" }])
      + (state.config.solarScale === "local" ? `<div class="control"><div class="control-title">Hill–Fish Map</div><label class="check-chip"><input type="checkbox" data-solar-case ${state.config.solarCase === "hill_fish" ? "checked" : ""}><span>Show map</span></label></div>` : "")
      + `<div class="control method-note"><div class="control-title">Scale integrity</div><p>Positions and distances are linear within each view. Dashed hollow edge nodes retain measured direction but compress off-canvas distance. Body markers are enlarged for visibility and never encode diameter.</p></div>`;
  } else if (state.config.type === "book") {
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Book titles</option></select></div><div class="control"><div class="control-title">Layout</div><select disabled><option>Mention-weighted cover area</option></select></div>`;
  } else if (state.config.type === "document") {
    roles = `<div class="control"><div class="control-title">Rows</div><select disabled><option>Completed transcript files</option></select></div><div class="control"><div class="control-title">Layout</div><select disabled><option>Searchable file browser</option></select></div>`;
  } else if (state.config.type === "craft") {
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Reviewed craft classes</option></select></div><div class="control"><div class="control-title">Node size</div><select disabled><option>Relative prominence</option></select></div>`;
  } else if (state.config.type === "species") {
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Corpus-mentioned species profiles</option></select></div>`
      + controlSelect("speciesLayout", "Layout", [{ value: "lineup", label: "Lineup" }, { value: "organic", label: "Organic network" }]);
  } else if (state.config.type === "signals") {
    roles = `<div class="control"><div class="control-title">Marks</div><select disabled><option>Explicit numeric frequency mentions</option></select></div><div class="control"><div class="control-title">X axis</div><select disabled><option>Logarithmic radio frequency</option></select></div>`;
  } else if (state.config.type === "programs") {
    roles = `<div class="control"><div class="control-title">Rows</div><select disabled><option>Reviewed projects, operations, and offices</option></select></div><div class="control"><div class="control-title">Layout</div><select disabled><option>Active intervals + relationship bridges</option></select></div>`;
  } else if (state.config.type === "scatter") {
    roles = controlSelect("x", "X axis", ["entity", ...numericEntity]) + controlSelect("y", "Y axis", numericEntity)
      + relationshipTypeControl();
  } else if (state.config.type === "bars") {
    roles = controlSelect("aggregation", "Group by", [{ value: "entity", label: "Entities" }, { value: "source", label: "Collection" }, { value: "format", label: "Transcript format" }]) + controlSelect("y", "Measure", state.config.aggregation === "entity" ? numericEntity : ["words", "documents", "bytes"]);
  } else if (state.config.type === "timeline") {
    const eventFields = ["mentionRank"];
    roles = controlSelect("timelineRole", "Marks", [{ value: "event", label: "Events + reported sightings" }, { value: "document", label: "Dated source documents" }, { value: "entity", label: "Entities" }])
      + controlSelect("x", "X axis", [{ value: state.config.timelineRole === "event" ? "startDate" : "documentDate", label: state.config.timelineRole === "event" ? "Event date" : "Document date" }])
      + controlSelect("y", "Y axis", state.config.timelineRole === "event" ? eventFields : state.config.timelineRole === "entity" ? numericEntity : numericDoc);
    if (state.config.timelineRole === "event") {
      roles += `<div class="control"><div class="control-title">Relationship</div><select disabled><option>Shared published entities</option></select></div>`;
    } else {
      roles += state.config.timelineRole === "entity"
        ? relationshipTypeControl()
        : `<div class="control"><div class="control-title">Relationship</div><select disabled><option>Shared published entities</option></select></div>`;
    }
  } else if (state.config.type === "coverage") {
    normalizeCoverageAxes(state.config);
    const dimensions = COVERAGE_DIMENSIONS.map(value => ({ value, label: COVERAGE_DIMENSION_LABELS[value] }));
    const allowedColumns = new Set(coverageColumnDimensions(state.config.coverageRows));
    const columnDimensions = dimensions.filter(dimension => allowedColumns.has(dimension.value));
    roles = controlSelect("coverageRows", "Rows", dimensions) + controlSelect("coverageColumns", "Columns", columnDimensions);
  } else if (state.config.type === "matrix") {
    roles = `<div class="control"><div class="control-title">Rows</div><select disabled><option>Collections</option></select></div>` + controlSelect("matrixColumns", "Columns", [{ value: "entity", label: "Entities" }, { value: "category", label: "Entity categories" }]);
  } else {
    const fields = TABLE_FIELDS[state.config.tableRole];
    const columnChecks = fields.map(field => `<label class="check-chip"><input type="checkbox" data-table-column="${field}" ${state.config.tableColumns.includes(field) ? "checked" : ""}><span>${escapeHTML(label(field))}</span></label>`).join("");
    roles = controlSelect("tableRole", "Rows", [{ value: "entity", label: "Entities" }, { value: "document", label: "Transcript files" }, { value: "case", label: "UAP cases" }, { value: "source", label: "Collections" }]) + `<div class="control"><div class="control-title">Columns <span>${state.config.tableColumns.length}</span></div><div class="check-grid">${columnChecks}</div></div>`;
  }
  $("#roleControls").innerHTML = roles;

  const sizeOptions = state.config.type === "timeline" && state.config.timelineRole === "event"
    ? [...(state.config.timelineGrouping ? ["eventCount"] : []), "independentSourceFamilyCount", "documentCount", "confidence"]
    : state.config.type === "network" && state.config.nodeRole === "collection"
      ? ["documents", "words"]
      : state.config.type === "document" || state.config.type === "timeline" && state.config.timelineRole !== "entity" ? numericDoc : numericEntity;
  const labelSizeControl = `<div class="control"><label>Label size <span>${state.config.labelSize}px</span></label><input type="range" min="10" max="18" step="1" value="${state.config.labelSize}" data-range="labelSize"></div>`;
  const speciesSpacingControl = `<div class="control"><label>Spacing between species <span>${state.config.speciesSpacing}px</span></label><input type="range" min="-80" max="160" step="4" value="${state.config.speciesSpacing}" data-range="speciesSpacing"></div>`;
  const zoomControl = state.config.type === "network" ? `<div class="control"><label>Zoom <span>${state.config.zoom.toFixed(1)}×</span></label><input type="range" min="0.5" max="2.5" step="0.1" value="${state.config.zoom}" data-range="zoom"></div>` : "";
  const moonTransitControl = state.config.type === "map" ? `<div class="control"><label for="moonTransitSeconds">On-screen Moon transit <span>${state.config.moonTransitSeconds}s</span></label><input id="moonTransitSeconds" type="range" min="2" max="10" step="1" value="${state.config.moonTransitSeconds}" data-range="moonTransitSeconds"></div>` : "";
  const supportsRelationships = ["scatter", "map", "timeline"].includes(state.config.type);
  const eventSequenceRelationships = state.config.type === "timeline" && state.config.timelineRole === "event";
  const timelineGroupingControls = eventSequenceRelationships
    ? `<div class="control"><label class="check-chip"><input type="checkbox" data-timeline-grouping ${state.config.timelineGrouping ? "checked" : ""}><span>Group events</span></label></div>`
      + (state.config.timelineGrouping ? controlSelect("timelineGroupPeriod", "Group by", [
        { value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }
      ]) : "")
      + `<div class="control method-note"><div class="control-title">Report-date quality</div><p>Unreviewed dates stay out of the default timeline. Audited corrupt, sentinel, malformed, and explicitly invalid source dates remain excluded even when historical candidates are enabled. All published corpus events use the same solid marks; hollow dashed marks are historical dates awaiting review.</p></div>`
    : "";
  const timelineMarkerControl = state.config.type === "timeline"
    ? `<div class="control"><label class="check-chip"><input type="checkbox" data-timeline-correlative-markers ${state.config.timelineCorrelativeMarkers ? "checked" : ""}><span>Show correlative date markers</span></label></div>`
    : "";
  const timelineHistoricalControl = eventSequenceRelationships
    ? state.historicalTimelineCandidateCount
      ? `<div class="control"><label class="check-chip"><input type="checkbox" data-timeline-historical-candidates ${state.config.timelineHistoricalCandidates ? "checked" : ""}><span>Show ${formatNumber(state.historicalTimelineCandidateCount)} screened unreviewed historical dates</span></label><small>Off by default. Adds pre-1947 structured dates that pass known-corruption gates as hollow candidates, not verified events.</small></div>`
      : `<div class="control method-note"><div class="control-title">Historical date review</div><p>All screened pre-1947 source dates have analyst decisions. No unreviewed historical candidates remain.</p></div>`
    : "";
  const timelineRelevanceControl = eventSequenceRelationships
    ? `<div class="control"><label>Relevance guide <span>Top ${state.config.timelineRelevanceCutoff}</span></label><input type="range" min="10" max="250" step="5" value="${state.config.timelineRelevanceCutoff}" data-range="timelineRelevanceCutoff"><small>At most 250 top-ranked nodes appear above the guide. Lower-ranked dates remain below it to preserve historical breadth.</small></div>`
    : "";
  const timelineRecencyControl = eventSequenceRelationships
    ? `<div class="control"><label>Recency guide <span>${state.config.timelineRecencyYear}</span></label><input type="range" min="1940" max="${Math.max(2030, new Date().getUTCFullYear())}" step="5" value="${state.config.timelineRecencyYear}" data-range="timelineRecencyYear"><small>Dates to the right of this vertical guide are more recent. The guide does not filter dates.</small></div>`
    : "";
  const relationshipControls = supportsRelationships ? controlSelect("relationshipLayer", "Relationship layer", [{ value: "off", label: "Off" }, { value: "hover", label: "On hover" }, { value: "always", label: "Always" }])
    + `<div class="control"><label>Connections per node <span>${state.config.relationshipNeighbors}</span></label><input type="range" min="1" max="5" step="1" value="${state.config.relationshipNeighbors}" data-range="relationshipNeighbors"></div>`
    + (eventSequenceRelationships ? "" : controlSelect("relationshipNodeSize", "Secondary-node size", [{ value: "inherit", label: "Inherit size metric" }, { value: "fixed", label: "Fixed" }]))
    + controlSelect("relationshipStrength", "Line strength", [{ value: "subtle", label: "Subtle" }, { value: "medium", label: "Medium" }, { value: "strong", label: "Strong" }]) : "";
  if (state.config.type === "claims") {
    $("#encodeControls").innerHTML = `<div class="control"><div class="control-title">Order</div><select disabled><option>First appearance</option></select></div>
      <div class="control method-note"><div class="control-title">No combined score</div><p>Claim confidence, independent source families, and document count remain separate.</p></div>`;
  } else if (state.config.type === "coverage") {
    const collectionOptions = [{ value: "all", label: "All selected collections" }, ...(state.catalog?.sources || []).map(source => ({ value: source.name, label: source.name }))];
    const cohort = (prefix, heading) => `<div class="coverage-cohort"><div class="control-title">${heading}</div>${controlSelect(`coverage${prefix}Collection`, "Collection", collectionOptions)}<div class="control"><div class="control-title">Document date</div><div class="date-range-controls"><label>From<input type="date" value="${escapeHTML(state.config[`coverage${prefix}From`])}" data-coverage-date="coverage${prefix}From"></label><label>To<input type="date" value="${escapeHTML(state.config[`coverage${prefix}To`])}" data-coverage-date="coverage${prefix}To"></label></div></div></div>`;
    $("#encodeControls").innerHTML = controlSelect("coverageMetric", "Normalize by", [
      { value: "documentCount", label: "Document count" }, { value: "wordCount", label: "Word count" }, { value: "datedDocumentCount", label: "Dated-document count" }
    ]) + `<div class="control"><label class="check-chip"><input type="checkbox" data-coverage-compare ${state.config.coverageCompare ? "checked" : ""}><span>Compare two cohorts</span></label></div>`
      + (state.config.coverageCompare ? cohort("A", "Cohort A") + cohort("B", "Cohort B") : "")
      + `<div class="control"><button class="button review-button" type="button" data-export-gap>Export ranked gap report</button></div>`;
  } else if (state.config.type === "triage") {
    const signalControls = TRIAGE_SIGNALS.map(signal => {
      const config = state.config.triageSignals[signal.id];
      return `<div class="triage-signal-control">
        <label class="check-chip"><input type="checkbox" data-triage-enabled="${signal.id}" ${config.enabled ? "checked" : ""}><span>${escapeHTML(signal.label)}</span></label>
        <label>Weight <span>${config.weight}</span></label><input type="range" min="1" max="5" step="1" value="${config.weight}" data-triage-weight="${signal.id}" ${config.enabled ? "" : "disabled"}>
        <small>${escapeHTML(signal.fields)}</small>
      </div>`;
    }).join("");
    $("#encodeControls").innerHTML = controlSelect("triageSort", "Sort by", [
      { value: "score", label: "Priority score" }, { value: "certainty", label: "Certainty" }, { value: "date", label: "Event date" }, { value: "title", label: "Case title" }
    ]) + controlSelect("triageDirection", "Direction", [{ value: "desc", label: "Descending" }, { value: "asc", label: "Ascending" }])
      + `<div class="control"><div class="control-title">Signals</div><div class="triage-signal-controls">${signalControls}</div></div>
        <div class="control"><button class="button review-button" type="button" data-export-triage-config>Export scoring configuration</button></div>`;
  } else if (state.config.type === "table") {
    const sortOptions = TABLE_FIELDS[state.config.tableRole];
    $("#encodeControls").innerHTML = controlSelect("tableSort", "Sort by", sortOptions) + controlSelect("tableDirection", "Direction", [{ value: "desc", label: "Descending" }, { value: "asc", label: "Ascending" }]) + labelSizeControl;
  } else if (state.config.type === "craft") {
    $("#encodeControls").innerHTML = controlSelect("craftSize", "Illustration size", [
      { value: "documentCount", label: "Independent documents" }, { value: "observationCount", label: "Classified observations" }, { value: "sourceCount", label: "Collections" }
    ]) + `<div class="control method-note"><div class="control-title">Prominence encoding</div><p>Illustration area uses the selected measure. Every craft retains the same black logo-style treatment.</p></div>` + labelSizeControl;
  } else if (state.config.type === "species") {
    $("#encodeControls").innerHTML = state.config.speciesLayout === "lineup"
      ? controlSelect("speciesY", "Character height", [
        { value: "physicalHeight", label: "Reported physical height" }, { value: "observationCount", label: "Name observations" }
      ]) + speciesSpacingControl + `<div class="control method-note"><div class="control-title">Lineup scale</div><p>Physical-height mode scales each figure to the midpoint of its reviewed source range while preserving the full range in the label. Mention mode uses a square-root scale so one frequent name does not flatten the rest. Unstated heights use an explicitly unscaled, neutral six-foot placeholder.</p></div>` + labelSizeControl
      : controlSelect("speciesSize", "Node size + shade", [
        { value: "documentCount", label: "Independent documents" }, { value: "observationCount", label: "Name observations" }, { value: "sourceCount", label: "Collections" }
      ]) + `<div class="control method-note"><div class="control-title">Mention graph</div><p>Size and shade encode prominence. Line patterns identify the reviewed reference grouping; links represent shared corpus documents.</p></div>` + labelSizeControl;
  } else if (state.config.type === "signals") {
    $("#encodeControls").innerHTML = `<div class="control"><div class="control-title">Peak height</div><select disabled><option>Corpus frequency mentions</option></select></div><div class="control method-note"><div class="control-title">Spectrum semantics</div><p>Peaks are normalized numeric frequency references in corpus text. Unit-elided values require explicit microwave-band context. They are not RF logger measurements and do not establish that a transmission occurred.</p></div>` + labelSizeControl;
  } else if (state.config.type === "programs") {
    $("#encodeControls").innerHTML = `<div class="control method-note"><div class="control-title">Interval semantics</div><p>Solid bars are officially documented. Dashed bars are claims entered into the congressional record but not officially confirmed. Curved bridges connect reviewed succession or transfer nodes on the relevant lanes. An arrow means active at the review date, not indefinitely active.</p></div>` + labelSizeControl;
  } else if (state.config.type === "document") {
    $("#encodeControls").innerHTML = labelSizeControl;
  } else if (state.config.type === "matrix") {
    $("#encodeControls").innerHTML = controlSelect("matrixNormalize", "Cell intensity", [
      { value: "raw", label: "Raw count" }, { value: "rowShare", label: "Within-collection share" }
    ]) + `<div class="control method-note"><div class="control-title">Cell normalization</div><p>Within-collection share is the default and divides each cell by its collection's visible row total. Raw count remains available. Inspect cells for raw counts.</p></div>`;
  } else {
    $("#encodeControls").innerHTML = timelineGroupingControls + timelineHistoricalControl + timelineRelevanceControl + timelineRecencyControl + timelineMarkerControl + (["scatter", "network", "timeline", "map", "book"].includes(state.config.type)
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
  const usesEntities = state.config.type === "table" ? state.config.tableRole === "entity" : !["document", "triage", "claims", "craft", "species", "signals", "coverage", "solar", "programs"].includes(state.config.type) && (state.config.type === "timeline" || !["bars", "timeline"].includes(state.config.type) || state.config.aggregation === "entity" || state.config.timelineRole === "entity");
  const filtersByIndependentSourceFamilies = usesIndependentSourceFamilyFilter();
  const showsEntityCategories = usesEntities || state.config.type === "document";
  const claimEntityOptions = [{ value: "all", label: "All claim entities" }, ...(state.claimCatalog?.entities || []).map(entity => ({ value: entity.id, label: entity.label }))];
  const speciesCategoryOptions = [{ value: "all", label: "All reviewed groups" }, ...(state.catalog?.species?.categories || []).map(category => ({ value: category.id, label: category.label }))];
  $("#filterControls").innerHTML = `
    ${state.config.type === "programs" ? `<div class="control"><label for="programSearch">Find a program</label><input id="programSearch" class="text-input" type="search" value="${escapeHTML(state.config.programSearch)}" placeholder="Search name or agency" data-program-search></div>
      ${controlSelect("programStatus", "Evidence status", [{ value: "all", label: "All provenance levels" }, { value: "official", label: "Officially documented" }, { value: "congressional_record_claim", label: "Entered into congressional record" }])}
      ${controlSelect("programKind", "Type", [{ value: "all", label: "All types" }, { value: "project", label: "Projects" }, { value: "operation", label: "Operations" }, { value: "mission", label: "Missions" }, { value: "task_force", label: "Task forces" }, { value: "office", label: "Offices" }, { value: "proposed_program", label: "Proposed programs" }, { value: "alleged_program", label: "Alleged programs" }, { value: "program", label: "Other programs" }])}` : ""}
    ${state.config.type === "document" ? `<div class="control"><label for="documentSearch">Find a document</label><input id="documentSearch" class="text-input" type="search" value="${escapeHTML(state.config.documentSearch)}" placeholder="Search title, path, collection, or format" data-document-search></div>` : ""}
    ${state.config.type === "triage" ? `<div class="control"><label for="triageSearch">Find a case</label><input id="triageSearch" class="text-input" type="search" value="${escapeHTML(state.config.triageSearch)}" placeholder="Search title, type, date, or source" data-triage-search></div>` : ""}
    ${state.config.type === "claims" ? `${controlSelect("claimEntity", "Entity", claimEntityOptions)}
      <div class="control claim-date-filter"><label for="claimDateStart">Appearance date</label><div><input id="claimDateStart" type="date" value="${escapeHTML(state.config.claimDateStart)}" data-claim-filter="claimDateStart"><span>to</span><input type="date" value="${escapeHTML(state.config.claimDateEnd)}" aria-label="Claim appearance end date" data-claim-filter="claimDateEnd"></div></div>
      ${controlSelect("claimReviewStatus", "Relationship review", [{ value: "all", label: "All statuses" }, ...CLAIM_REVIEW_STATUSES.map(value => ({ value, label: label(value) }))])}` : ""}
    ${state.config.type === "craft" ? `<div class="control"><label for="craftLocation">Associated location</label><input id="craftLocation" class="text-input" type="search" value="${escapeHTML(state.config.craftLocation)}" placeholder="Filter same-segment locations" data-craft-location></div>
      <div class="control"><div class="control-title">Reported date</div><div class="date-range-controls"><label>From<input type="date" value="${escapeHTML(state.config.craftDateFrom)}" data-craft-date="craftDateFrom"></label><label>To<input type="date" value="${escapeHTML(state.config.craftDateTo)}" data-craft-date="craftDateTo"></label></div></div>
      ${controlSelect("craftWitnessType", "Witness/source type", [{ value: "all", label: "All / unspecified" }, { value: "pilot", label: "Pilot / aircrew" }, { value: "military", label: "Military" }, { value: "law_enforcement", label: "Law enforcement" }, { value: "civilian", label: "Civilian witness" }, { value: "unspecified", label: "Unspecified" }])}
      ${controlSelect("craftDimensions", "Reported dimensions", [{ value: "all", label: "All classes" }, { value: "any", label: "Any usable dimension" }, { value: "both", label: "Width and height" }, { value: "none", label: "No usable dimensions" }])}
      <div class="control method-note"><div class="control-title">Classification review</div><p>Literal mappings are reviewed; ambiguous and excluded phrases remain unpublished observations.</p><button class="button review-button" type="button" data-review-craft>Review ${formatNumber(state.catalog?.counts?.craftReviewCandidates || 0)} candidates</button></div>` : ""}
    ${state.config.type === "species" ? `<div class="control"><label for="speciesSearch">Find a species</label><input id="speciesSearch" class="text-input" type="search" value="${escapeHTML(state.config.speciesSearch)}" placeholder="Search reviewed names" data-species-search></div>
      ${controlSelect("speciesCategory", "Reference group", speciesCategoryOptions)}
      <div class="control method-note"><div class="control-title">Classification boundary</div><p>Counts are literal corpus mentions, not biological verification. Ambiguous names require explicit extraterrestrial context.</p><button class="button review-button" type="button" data-review-species>Review ${formatNumber(state.catalog?.counts?.speciesReviewCandidates || 0)} ambiguous matches</button></div>` : ""}
    ${state.config.type === "solar" ? `<div class="control method-note"><div class="control-title">Astronomy classification review</div><p>Published totals include reviewed literal name matches only. Ambiguous and excluded occurrences remain outside the totals and available for inspection.</p><button class="button review-button" type="button" data-review-astronomy>Review ${formatNumber(state.catalog?.counts?.astronomyReviewCandidates || 0)} candidates</button></div>` : ""}
    ${showsEntityCategories ? `<div class="control"><div class="control-title">Entity categories</div><div class="check-grid">${categoryChecks}</div></div>` : ""}
    ${state.config.type === "programs" ? "" : `<div class="control"><div class="control-title">Collections <span>${selectedSourceCount} / ${sourceNames.length} selected</span></div><div class="check-grid">${sourceChecks}</div></div>`}
    ${state.config.type === "table" ? `<div class="control"><label for="tableSearch">Search rows</label><input id="tableSearch" class="text-input" type="search" value="${escapeHTML(state.config.tableSearch)}" placeholder="Filter this list" data-table-search></div>` : ""}
    ${usesEntities || ["craft", "species"].includes(state.config.type) ? `<div class="control"><label>Minimum confidence <span>${Math.round(state.config.minConfidence * 100)}%</span></label><input type="range" min="0.5" max="0.95" step="0.01" value="${state.config.minConfidence}" data-range="minConfidence"></div>` : ""}
    ${filtersByIndependentSourceFamilies ? `<div class="control"><label>Minimum independent source families <span>${state.config.minIndependentSourceFamilies}</span></label><input type="range" min="1" max="20" step="1" value="${state.config.minIndependentSourceFamilies}" data-range="minIndependentSourceFamilies"></div>` : ""}
    ${state.config.type === "network" || (supportsRelationships && state.config.relationshipLayer !== "off" && !eventSequenceRelationships) ? `<div class="control"><label>${state.config.type === "network" && state.config.nodeRole === "collection" || state.config.type === "timeline" && state.config.timelineRole === "document" ? "Shared entities" : "Relationship evidence"} <span>${state.config.minEvidence}×</span></label><input type="range" min="1" max="12" step="1" value="${state.config.minEvidence}" data-range="minEvidence"></div>` : ""}
    ${state.config.type === "document"
      ? `<div class="control"><div class="control-title">Search scope <span>${state.catalog?.documents.filter(document => sourceMatches(document.source)).length || 0}</span></div><select disabled><option>Every completed file</option></select></div>`
      : state.config.type === "table" || state.config.type === "triage" || state.config.type === "claims" || state.config.type === "craft" || state.config.type === "species" || state.config.type === "signals" || state.config.type === "coverage" || state.config.type === "programs"
        ? `<div class="control"><div class="control-title">Rows included</div><select disabled><option>All matching rows</option></select></div>`
      : `<div class="control"><label>Maximum ${state.config.type === "table" ? "rows" : "marks"} <span>${state.config.limit}</span></label><input type="range" min="20" max="${state.config.type === "timeline" ? 1000 : state.config.type === "network" ? 120 : 250}" step="10" value="${state.config.limit}" data-range="limit"></div>`}
    ${usesEntities ? `<div class="control method-note"><div class="control-title">Corroboration policy · v1</div><p>Independent source families group only reviewed metadata or strong citation, shared-origin, and near-duplicate signals. Unclassified documents remain separate unknown families; source text and raw counts are unchanged.</p></div>` : ""}
    ${usesEntities ? `<div class="control method-note"><div class="control-title">Context adjustment</div><p>Counts exact repeats within one document once, counts text repeated across 3+ documents once, and excludes requester metadata. Raw mentions remain available.</p></div>` : ""}
    ${usesEntities ? `<div class="control"><div class="control-title">Inflation review</div><label class="check-chip"><input type="checkbox" data-include-high-inflation ${state.config.includeHighInflation ? "checked" : ""}><span>Include high-inflation entities</span></label></div>` : ""}
    ${["triage", "claims", "craft", "species", "signals", "coverage", "programs"].includes(state.config.type) ? "" : `<div class="control duplicate-review-control"><div class="control-title">Identity review <span>${duplicateCount} flagged</span></div><button class="button review-button" type="button" data-review-duplicates ${duplicateCount ? "" : "disabled"}>Review possible duplicates</button></div>`}`;

  if (state.config.type === "solar") {
    $("#filterControls").innerHTML = `<div class="control method-note"><div class="control-title">Astronomical data boundary</div><p>The Gaia samples and reviewed corpus targets are fixed for this view. Corpus activity changes node area only; it never changes measured position.</p></div>`;
  }

  $$('[data-config]').forEach(node => node.addEventListener("change", event => updateConfig(event.target.dataset.config, event.target.value)));
  $("[data-solar-case]")?.addEventListener("change", event => {
    state.config.solarCase = event.target.checked ? "hill_fish" : "none";
    commitConfig(false);
  });
  $("[data-timeline-grouping]")?.addEventListener("change", event => {
    state.config.timelineGrouping = event.target.checked;
    if (!state.config.timelineGrouping && state.config.size === "eventCount") state.config.size = "documentCount";
    renderControls(); commitConfig(false);
  });
  $("[data-timeline-correlative-markers]")?.addEventListener("change", event => {
    state.config.timelineCorrelativeMarkers = event.target.checked;
    commitConfig(false);
  });
  $("[data-timeline-historical-candidates]")?.addEventListener("change", event => {
    state.config.timelineHistoricalCandidates = event.target.checked;
    commitConfig(false);
  });
  $("[data-coverage-compare]")?.addEventListener("change", event => {
    state.config.coverageCompare = event.target.checked;
    renderControls(); commitConfig(false);
  });
  $$('[data-coverage-date]').forEach(node => node.addEventListener("change", event => {
    state.config[event.target.dataset.coverageDate] = event.target.value;
    commitConfig(false);
  }));
  $("[data-export-gap]")?.addEventListener("click", exportCoverageGapReport);
  $$('[data-range]').forEach(node => node.addEventListener("input", event => {
    const key = event.target.dataset.range;
    const value = Number(event.target.value);
    state.config[key] = value;
    if (key === "limit") syncAutomaticTitle();
    const output = event.target.closest(".control")?.querySelector("label span");
    if (output) output.textContent = key === "minConfidence" ? `${Math.round(value * 100)}%` : key === "minEvidence" ? `${value}×` : ["labelSize", "speciesSpacing"].includes(key) ? `${value}px` : key === "zoom" ? `${value.toFixed(1)}×` : key === "moonTransitSeconds" ? `${value}s` : key === "timelineRelevanceCutoff" ? `Rank ${value}` : String(value);
    persistHash();
    if (key === "moonTransitSeconds") return window.ufoGlobe?.setMoonTransitSeconds(value);
    renderGraph();
  }));
  $$('[data-triage-enabled]').forEach(node => node.addEventListener("change", event => {
    const id = event.target.dataset.triageEnabled;
    state.config.triageSignals[id].enabled = event.target.checked;
    state.config.triageProfile = "custom";
    state.config.triageCaseId = "";
    renderControls();
    commitConfig(false);
  }));
  $$('[data-triage-weight]').forEach(node => node.addEventListener("input", event => {
    const id = event.target.dataset.triageWeight;
    state.config.triageSignals[id].weight = Number(event.target.value);
    state.config.triageProfile = "custom";
    state.config.triageCaseId = "";
    const output = event.target.closest(".triage-signal-control")?.querySelector("label:not(.check-chip) span");
    if (output) output.textContent = event.target.value;
    persistHash();
    renderPresetStatus();
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
    if (state.config.type === "triage") state.config.triageCaseId = "";
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
  $("[data-review-craft]")?.addEventListener("click", inspectCraftCandidates);
  $("[data-review-species]")?.addEventListener("click", inspectSpeciesCandidates);
  $("[data-review-astronomy]")?.addEventListener("click", inspectAstronomyCandidates);
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
  $("[data-triage-search]")?.addEventListener("input", event => {
    state.config.triageSearch = event.target.value;
    state.config.triageCaseId = "";
    persistHash();
    renderGraph();
  });
  $$('[data-claim-filter]').forEach(node => node.addEventListener("change", event => {
    state.config[event.target.dataset.claimFilter] = event.target.value;
    persistHash();
    renderGraph();
  }));
  $("[data-craft-location]")?.addEventListener("input", event => {
    state.config.craftLocation = event.target.value;
    persistHash();
    renderGraph();
  });
  $("[data-species-search]")?.addEventListener("input", event => {
    state.config.speciesSearch = event.target.value;
    persistHash();
    renderGraph();
  });
  $("[data-program-search]")?.addEventListener("input", event => {
    state.config.programSearch = event.target.value;
    persistHash();
    renderGraph();
  });
  $$('[data-craft-date]').forEach(node => node.addEventListener("change", event => {
    state.config[event.target.dataset.craftDate] = event.target.value;
    persistHash();
    renderGraph();
  }));
  $$('[data-type]').forEach(node => node.addEventListener("click", () => setType(node.dataset.type)));
  $("[data-preset-select]")?.addEventListener("change", event => {
    if (event.target.value) applyPreset(event.target.value);
  });
  $("[data-triage-preset-select]")?.addEventListener("change", event => applyTriageProfile(event.target.value));
  $("[data-export-triage-config]")?.addEventListener("click", exportTriageConfiguration);
}

async function setType(type) {
  if (type !== "solar" && !await ensureFullCatalog()) return;
  state.config = presetConfig("default", type);
  state.selected = null;
  renderControls();
  commitConfig();
}

function updateConfig(key, value, rerenderControls = false) {
  const previousValue = state.config[key];
  state.config[key] = value;
  if (["x", "size", "y", "tableSort"].includes(key) && CORROBORATION_METRICS.includes(value)) state.config.corroborationMetric = value;
  if (["triageSort", "triageDirection"].includes(key)) state.config.triageCaseId = "";
  if (key === "aggregation") {
    state.config.y = value === "entity" ? "epistemicAdjustedMentions" : "words";
    state.config.color = "intensity";
  }
  if (key === "timelineRole") {
    state.config.x = value === "event" ? "startDate" : "documentDate";
    state.config.y = value === "event" ? "mentionRank" : value === "entity" ? "epistemicAdjustedMentions" : "words";
    state.config.size = value === "event" ? state.config.timelineGrouping ? "eventCount" : "documentCount" : value === "entity" ? "independentDocumentCount" : "words";
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
      case: { tableColumns: ["title", "startDate", "eventType", "resolutionStatus", "sensorModalities", "dataCompletenessScore"], tableSort: "startDate" },
      source: { tableColumns: ["name", "documents", "words"], tableSort: "documents" }
    };
    Object.assign(state.config, defaults[value]);
  }
  if (key === "coverageRows" && value === state.config.coverageColumns && !COVERAGE_MULTI_VALUE_DIMENSIONS.has(value)) {
    state.config.coverageColumns = previousValue;
    normalizeCoverageAxes(state.config);
  }
  if (rerenderControls) renderControls();
  if (["aggregation", "timelineRole", "matrixColumns", "tableRole", "nodeRole", "relationshipLayer", "coverageRows", "speciesLayout"].includes(key)) renderControls();
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
  return {
    width: Number.isFinite(box.width) && box.width > 0 ? box.width : 460,
    height: Number.isFinite(box.height) && box.height > 0 ? box.height : 420
  };
}

function clearChart() {
  hideMapView();
  const svg = $("#chart");
  svg.removeAttribute("hidden");
  $("#tableView").hidden = true;
  $("#chartWrap").classList.remove("table-mode", "triage-mode", "claims-mode", "craft-mode", "species-mode", "species-lineup-mode", "coverage-mode", "programs-mode");
  svg.replaceChildren();
  svg.style.removeProperty("height");
  svg.style.removeProperty("width");
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
  const solarView = $("#solarView");
  if (solarView) solarView.hidden = true;
  if (typeof window !== "undefined") window.dispatchEvent?.(new CustomEvent("ufo-solar-visibility", { detail: { visible: false } }));
}

function prepareMapView() {
  const solarView = $("#solarView");
  if (solarView) solarView.hidden = true;
  window.dispatchEvent?.(new CustomEvent("ufo-solar-visibility", { detail: { visible: false } }));
  const svg = $("#chart");
  svg.style.removeProperty?.("height");
  svg.setAttribute("hidden", "");
  svg.replaceChildren();
  $("#tableView").hidden = true;
  $("#chartWrap").classList.remove("table-mode", "triage-mode", "claims-mode", "craft-mode", "species-mode", "species-lineup-mode", "coverage-mode", "programs-mode");
  $("#mapView").hidden = false;
}

function astronomyTargetAccounting(targets = state.catalog?.astronomy?.targets || []) {
  const sorted = [...targets].sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0) || a.name.localeCompare(b.name));
  const assigned = new Set();
  const take = predicate => sorted.filter(target => !assigned.has(target.targetId) && predicate(target) && assigned.add(target.targetId));
  const solar = take(target => target.system === "Solar System" || target.targetId === "solar_system");
  const positioned = take(target => target.position?.frame === "ICRS");
  const scene = take(target => ["milky_way", "galactic_center"].includes(target.targetId));
  const unpositioned = take(() => true);
  return { sorted, solar, positioned, scene, unpositioned };
}

function astronomyTargetPlainList(targets) {
  return targets.map(target => `${target.name} ${Number(target.mentionCount || 0).toLocaleString()} mentions / ${Number(target.documentCount || 0).toLocaleString()} documents`).join(" · ");
}

function renderSolar() {
  const svg = $("#chart");
  svg.setAttribute("hidden", "");
  svg.replaceChildren();
  $("#mapView").hidden = true;
  window.dispatchEvent?.(new CustomEvent("ufo-map-visibility", { detail: { visible: false } }));
  $("#tableView").hidden = true;
  $("#chartWrap").classList.remove("table-mode", "triage-mode", "claims-mode", "craft-mode", "species-mode", "species-lineup-mode", "coverage-mode", "programs-mode");
  $("#solarView").hidden = false;
  const detail = { scale: state.config.solarScale, caseLayer: state.config.solarCase, astronomy: state.catalog.astronomy || { targets: [] } };
  window.pendingSolarRender = detail;
  window.dispatchEvent(new CustomEvent("ufo-solar-render", { detail }));
  window.dispatchEvent(new CustomEvent("ufo-solar-visibility", { detail: { visible: true } }));
  const { sorted: astronomyTargets, solar: solarTargets, positioned: positionedTargets, scene: sceneTargets, unpositioned: unpositionedTargets } = astronomyTargetAccounting();
  const astronomyTargetList = targets => targets.map(target => `${escapeHTML(target.name)} ${Number(target.mentionCount || 0).toLocaleString()} mentions / ${Number(target.documentCount || 0).toLocaleString()} documents`).join(" · ");
  const accounting = `<div class="solar-info-copy"><strong>Corpus target accounting · ${astronomyTargets.length.toLocaleString()} / ${astronomyTargets.length.toLocaleString()} · direct mentions</strong><span><b>Solar System entities at the Sun · ${solarTargets.length}</b>${astronomyTargetList(solarTargets)}</span><span><b>Fixed ICRS points · ${positionedTargets.length}</b>${astronomyTargetList(positionedTargets)}</span><span><b>Represented by the scene · ${sceneTargets.length}</b>${astronomyTargetList(sceneTargets)}</span><span><b>No reviewed point position · ${unpositionedTargets.length}</b>${astronomyTargetList(unpositionedTargets)}</span></div>`;
  const hillFishActive = state.config.solarScale === "local" && state.config.solarCase !== "none";
  $("#legend").innerHTML = (state.config.solarScale === "local"
    ? hillFishActive
      ? `<span class="legend-item"><i style="background:#111;opacity:.15"></i>Gaia star</span><span class="legend-item"><i style="background:#111"></i>Fish-identified star · measured position · 100 mentions = 20 px · 1,000+ = 50 px</span><span class="legend-item"><i style="background:transparent;border:1px dashed #111"></i>Off-canvas star · direction retained · distance compressed</span><span class="legend-item"><i style="height:1px;border-top:2px solid #b42318"></i>Hill-reported route · solid red</span><span class="legend-item"><i style="height:1px;border-top:2px dashed #b42318"></i>Hill-reported expedition · broken red</span>`
      : `<span class="legend-item"><i style="background:#111;opacity:.22"></i>Gaia star</span><span class="legend-item"><i style="background:#333"></i>Fixed-position corpus target · 100 mentions = 20 px · 1,000+ = 50 px</span><span class="legend-item"><i style="background:#111"></i>Solar System entities · shared-location marker</span>`
    : state.config.solarScale === "sky"
      ? `<span class="legend-item"><i style="background:#111;opacity:.55"></i>Gaia observed-source density</span>`
      : `<span class="legend-item"><i style="background:#222;opacity:.62"></i>Hou–Han H II region</span><span class="legend-item"><i style="background:#777;opacity:.5"></i>Hou–Han molecular cloud</span><span class="legend-item"><i style="background:#000"></i>Hou–Han methanol maser</span><span class="legend-item"><i style="background:transparent;border:1.5px solid #111"></i>Reid VLBI parallax anchor</span><span class="legend-item"><i style="height:1px;background:#111;opacity:.48"></i>Published logarithmic-arm fit</span><span class="legend-item"><i style="background:#333"></i>Fixed-position corpus target · 100 mentions = 20 px · 1,000+ = 50 px</span><span class="legend-item"><i style="background:#111"></i>Solar System entities · shared Sun-location marker</span>`) + accounting;
  const targetCount = state.catalog.astronomy?.targets?.length || 0;
  setSummary(hillFishActive ? `Fish viewpoint · 12-star route pattern + 3 background points · current measured 3D positions` : state.config.solarScale === "local" ? `${targetCount.toLocaleString()} reviewed astronomical targets · ${positionedTargets.length.toLocaleString()} fixed ICRS points · ${solarTargets.length.toLocaleString()} Solar System entities at the Sun` : state.config.solarScale === "sky" ? `${targetCount.toLocaleString()} reviewed astronomical targets inventoried beside the Gaia EDR3 density map` : `${targetCount.toLocaleString()} reviewed astronomical targets · ${positionedTargets.length.toLocaleString()} fixed ICRS points · ${solarTargets.length.toLocaleString()} Solar System entities at the Sun · ${(sceneTargets.length + unpositionedTargets.length).toLocaleString()} scene or non-point targets`, "solar");
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
  if (scopedEntity.documentCount > 0 && (scopedEntity.independentSourceFamilyCount || 0) < state.config.minIndependentSourceFamilies) return false;
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
  const epistemicAdjustedMentions = selectedMetrics.length
    ? selectedMetrics.reduce((sum, metrics) => sum + (metrics.epistemicAdjustedMentions ?? metrics.contextAdjustedMentions ?? metrics.mentions), 0)
    : (entity.epistemicAdjustedMentions ?? contextAdjustedMentions) * documentIds.length / Math.max(1, entity.documentCount);
  const independentDocumentCount = selectedMetrics.length
    ? selectedMetrics.reduce((sum, metrics) => sum + (metrics.independentDocumentCount ?? metrics.documentCount), 0)
    : documentIds.length;
  const independentSourceFamilyCount = new Set(documentIds.map(documentId => {
    const document = state.documentById.get(documentId);
    return document?.sourceFamily?.id || `unknown:${documentId}`;
  })).size;
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
    epistemicAdjustedMentions,
    independentDocumentCount,
    independentSourceFamilyCount,
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

function usesIndependentSourceFamilyFilter(config = state.config) {
  if (config.type === "table") return config.tableRole === "entity";
  if (config.type === "network") return config.nodeRole !== "collection";
  if (config.type === "bars") return config.aggregation === "entity";
  if (config.type === "timeline") return config.timelineRole === "entity";
  if (config.type === "matrix") return config.matrixColumns === "entity";
  return ["scatter", "map", "book"].includes(config.type);
}

function filteredEdge(edge, visibleDocumentIds = null) {
  if (state.config.allSources) return edge;
  const selectedMetrics = Object.entries(edge.sourceMetrics || {})
    .filter(([source]) => sourceMatches(source))
    .map(([, metrics]) => metrics);
  if (!selectedMetrics.length) return null;
  const documentIds = visibleDocumentIds || new Set(state.catalog.documents.filter(document => sourceMatches(document.source)).map(document => document.id));
  const scopedEdgeDocumentIds = (edge.documentIds || []).filter(documentId => documentIds.has(documentId));
  const independentSourceFamilyCount = scopedEdgeDocumentIds.length
    ? new Set(scopedEdgeDocumentIds.map(documentId => state.documentById.get(documentId)?.sourceFamily?.id || `unknown:${documentId}`)).size
    : selectedMetrics.reduce((sum, metrics) => sum + (metrics.independentSourceFamilyCount ?? metrics.documentCount), 0);
  return {
    ...edge,
    evidenceCount: selectedMetrics.reduce((sum, metrics) => sum + metrics.evidenceCount, 0),
    epistemicAdjustedEvidenceCount: selectedMetrics.reduce((sum, metrics) => sum + (metrics.epistemicAdjustedEvidenceCount ?? metrics.evidenceCount), 0),
    documentCount: selectedMetrics.reduce((sum, metrics) => sum + metrics.documentCount, 0),
    documentIds: scopedEdgeDocumentIds,
    independentSourceFamilyCount,
    evidence: edge.evidence.filter(item => documentIds.has(item.documentId))
  };
}

function relationshipEvidenceCount(edge) {
  return edge.epistemicAdjustedEvidenceCount ?? edge.evidenceCount ?? 0;
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
    if (!edge || relationshipEvidenceCount(edge) < state.config.minEvidence || (state.config.relation !== "all" && edge.relationship !== state.config.relation)) return;
    [[edge.source, edge.target], [edge.target, edge.source]].forEach(([entityId, neighborId]) => {
      if (!displayedIds.has(entityId) || !entityById.has(neighborId)) return;
      networks.get(entityId).push({ entity: entityById.get(neighborId), edge });
    });
  });
  networks.forEach((neighbors, entityId) => {
    neighbors.sort((left, right) => relationshipEvidenceCount(right.edge) - relationshipEvidenceCount(left.edge) || left.entity.name.localeCompare(right.entity.name));
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
    if (!existing || relationshipEvidenceCount(neighbor.edge) > relationshipEvidenceCount(existing.edge)) {
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

function drawIntensityLegend(timelineRelevanceActive = false, timelineRecencyActive = false) {
  const relationshipView = ["scatter", "map", "timeline"].includes(state.config.type);
  const egoLabel = state.config.type === "timeline" && state.config.timelineRole === "event" ? "Shared published entities" : "Strongest relationships";
  const egoKey = relationshipView && state.config.relationshipLayer !== "off" ? `<span class="legend-item"><i class="ego-key"></i>${egoLabel}</span>` : "";
  const outlierKey = state.config.type === "scatter" ? `<span class="legend-item"><i class="outlier-key"></i>Axis-capped outlier</span>` : "";
  const inflationKey = state.config.type === "scatter" ? `<span class="legend-item"><i class="risk-key"></i>Potential mention inflation</span>` : "";
  const derivativeKey = state.config.type === "scatter" ? `<span class="legend-item"><i class="derivative-key"></i>Mostly repeated / derivative coverage</span>` : "";
  const historicalKey = state.config.type === "timeline" && state.config.timelineCorrelativeMarkers ? `<span class="legend-item"><i class="historical-marker-key"></i>Correlative dates</span>` : "";
  const relevanceKey = state.config.type === "timeline" && state.config.timelineRole === "event" && timelineRelevanceActive ? `<span class="legend-item"><i class="timeline-relevance-key"></i>Relevance guide · top ${state.config.timelineRelevanceCutoff}</span>` : "";
  const recencyKey = state.config.type === "timeline" && state.config.timelineRole === "event" && timelineRecencyActive ? `<span class="legend-item"><i class="timeline-recency-key"></i>Recency guide · ${state.config.timelineRecencyYear}–present</span>` : "";
  const timelineProvenanceKey = state.config.type === "timeline" && state.config.timelineRole === "event"
    ? `<span class="legend-item"><i class="timeline-candidate-key"></i>Historical date · review required</span>`
    : "";
  $("#legend").innerHTML = `<span class="legend-item"><i style="background:#111;opacity:.14"></i>Lower</span><span class="legend-item"><i style="background:#111;opacity:.48"></i>Medium</span><span class="legend-item"><i style="background:#111"></i>Higher</span>${timelineProvenanceKey}${egoKey}${relevanceKey}${recencyKey}${historicalKey}${outlierKey}${inflationKey}${derivativeKey}`;
}

function timelineDateExtent(data, rawEventCandidates, timelineRole, contextualMarkers = []) {
  const domainItems = timelineRole === "event" && rawEventCandidates.length
    ? [...rawEventCandidates, ...contextualMarkers]
    : data;
  let minimum = Infinity;
  let maximum = -Infinity;
  domainItems.forEach(item => {
    const date = new Date(item.startDate || item.documentDate || item.date).getTime();
    if (!Number.isFinite(date)) return;
    minimum = Math.min(minimum, date);
    maximum = Math.max(maximum, date);
  });
  return [minimum, maximum + 1];
}

const TIMELINE_EARLY_DATE_END = Date.UTC(1938, 0, 1);
const TIMELINE_EARLY_RANGE_SHARE = .1;
const TIMELINE_RECENT_DATE_START = Date.UTC(2007, 0, 1);
const TIMELINE_RECENT_RANGE_SHARE = .5;

function timelineDatePosition(value, extent, range) {
  const timestamp = Math.max(extent[0], Math.min(extent[1], Number(value)));
  const spansEarlyDates = extent[0] < TIMELINE_EARLY_DATE_END && extent[1] > TIMELINE_EARLY_DATE_END;
  const spansRecentDates = extent[0] < TIMELINE_RECENT_DATE_START && extent[1] > TIMELINE_RECENT_DATE_START;
  if (spansEarlyDates && spansRecentDates) {
    const earlyBreakpoint = range[0] + (range[1] - range[0]) * TIMELINE_EARLY_RANGE_SHARE;
    const recentBreakpoint = range[1] - (range[1] - range[0]) * TIMELINE_RECENT_RANGE_SHARE;
    if (timestamp < TIMELINE_EARLY_DATE_END) {
      return scale(timestamp, [extent[0], TIMELINE_EARLY_DATE_END], [range[0], earlyBreakpoint]);
    }
    return timestamp < TIMELINE_RECENT_DATE_START
      ? scale(timestamp, [TIMELINE_EARLY_DATE_END, TIMELINE_RECENT_DATE_START], [earlyBreakpoint, recentBreakpoint])
      : scale(timestamp, [TIMELINE_RECENT_DATE_START, extent[1]], [recentBreakpoint, range[1]]);
  }
  if (spansRecentDates) {
    const breakpoint = range[1] - (range[1] - range[0]) * TIMELINE_RECENT_RANGE_SHARE;
    return timestamp < TIMELINE_RECENT_DATE_START
      ? scale(timestamp, [extent[0], TIMELINE_RECENT_DATE_START], [range[0], breakpoint])
      : scale(timestamp, [TIMELINE_RECENT_DATE_START, extent[1]], [breakpoint, range[1]]);
  }
  if (!spansEarlyDates) {
    return scale(timestamp, extent, range);
  }
  const breakpoint = range[0] + (range[1] - range[0]) * TIMELINE_EARLY_RANGE_SHARE;
  return timestamp < TIMELINE_EARLY_DATE_END
    ? scale(timestamp, [extent[0], TIMELINE_EARLY_DATE_END], [range[0], breakpoint])
    : scale(timestamp, [TIMELINE_EARLY_DATE_END, extent[1]], [breakpoint, range[1]]);
}

function timelineDateTicks(extent) {
  const spansEarlyDates = extent[0] < TIMELINE_EARLY_DATE_END && extent[1] > TIMELINE_EARLY_DATE_END;
  const spansRecentDates = extent[0] < TIMELINE_RECENT_DATE_START && extent[1] > TIMELINE_RECENT_DATE_START;
  if (spansEarlyDates && spansRecentDates) {
    return [
      extent[0],
      TIMELINE_EARLY_DATE_END,
      (TIMELINE_EARLY_DATE_END + TIMELINE_RECENT_DATE_START) / 2,
      TIMELINE_RECENT_DATE_START,
      (TIMELINE_RECENT_DATE_START + extent[1]) / 2,
      extent[1]
    ];
  }
  if (spansRecentDates) {
    const recentEndYear = new Date(extent[1]).getUTCFullYear();
    const recentTickCount = Math.min(3, Math.max(0, recentEndYear - 2007));
    const earlierTickCount = 6 - recentTickCount;
    return [
      ...Array.from(
        { length: earlierTickCount },
        (_, index) => extent[0] + index * (TIMELINE_RECENT_DATE_START - extent[0]) / (earlierTickCount - 1)
      ),
      ...Array.from(
        { length: recentTickCount },
        (_, index) => TIMELINE_RECENT_DATE_START + (index + 1) * (extent[1] - TIMELINE_RECENT_DATE_START) / recentTickCount
      )
    ];
  }
  if (!spansEarlyDates) {
    return Array.from({ length: 6 }, (_, index) => extent[0] + index * (extent[1] - extent[0]) / 5);
  }
  return [extent[0], TIMELINE_EARLY_DATE_END, ...Array.from(
    { length: 4 },
    (_, index) => TIMELINE_EARLY_DATE_END + (index + 1) * (extent[1] - TIMELINE_EARLY_DATE_END) / 4
  )];
}

function addTitle(node, text) {
  node.append(el("title", {}, text));
}

function drawAxes(svg, width, height, xKey, yKey, xExtent, yExtent, capped = {}, options = {}) {
  const margin = { ...AXIS_MARGIN };
  const ascendingDown = Boolean(options.ascendingDown);
  const verticalGrid = options.grid === "x";
  const yValues = Array.isArray(options.yTicks) && options.yTicks.length > 1 ? options.yTicks : null;
  const yIntervals = (yValues?.length || 5) - 1;
  const yRange = options.yRange || [margin.top, height - margin.bottom];
  for (let i = 0; i <= yIntervals; i++) {
    const rawValue = yValues?.[i] ?? (ascendingDown
      ? yExtent[0] + i * (yExtent[1] - yExtent[0]) / yIntervals
      : yExtent[1] - i * (yExtent[1] - yExtent[0]) / yIntervals);
    const y = typeof options.yPosition === "function"
      ? options.yPosition(rawValue)
      : yRange[0] + i * (yRange[1] - yRange[0]) / yIntervals;
    if (!verticalGrid) svg.append(el("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "grid-line" }));
    const value = yKey === "mentionRank" ? Math.round(rawValue) : rawValue;
    const tick = capped.y && i === 0 ? `${formatNumber(value)}+` : formatNumber(value);
    svg.append(el("text", { x: margin.left - 8, y: y + 3, "text-anchor": "end", class: "axis-label" }, tick));
  }
  if (["createdAt", "documentDate", "startDate"].includes(xKey)) {
    const xAxisY = Number.isFinite(options.xAxisY) ? options.xAxisY : height - margin.bottom;
    const xGridBottom = Number.isFinite(options.xGridBottom) ? options.xGridBottom : height - margin.bottom;
    const xTicks = options.xTicks || Array.from({ length: 6 }, (_, index) => xExtent[0] + index * (xExtent[1] - xExtent[0]) / 5);
    const xPositions = xTicks.map((value, index) => typeof options.xPosition === "function"
      ? options.xPosition(value)
      : margin.left + index * (width - margin.left - margin.right) / Math.max(1, xTicks.length - 1));
    const hideCrowdedFirstDateLabel = xPositions.length > 1 && xPositions[1] - xPositions[0] < 34;
    xTicks.forEach((value, i) => {
      const x = xPositions[i];
      if (verticalGrid) svg.append(el("line", { x1: x, y1: margin.top, x2: x, y2: xGridBottom, class: "grid-line timeline-date-grid-line" }));
      if (!(hideCrowdedFirstDateLabel && i === 0)) svg.append(el("text", { x, y: xAxisY + 18, "text-anchor": i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle", class: "axis-label" }, new Date(value).getUTCFullYear()));
    });
  }
  const xLabelY = Number.isFinite(options.xLabelY) ? options.xLabelY : height - 13;
  svg.append(el("text", { x: (margin.left + width - margin.right) / 2, y: xLabelY, "text-anchor": "middle", class: "axis-label" }, label(xKey)));
  const yLabelY = Number.isFinite(options.yLabelY) ? options.yLabelY : height / 2;
  const yLabel = el("text", { x: 15, y: yLabelY, transform: `rotate(-90 15 ${yLabelY})`, "text-anchor": "middle", class: "axis-label" }, label(yKey));
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
  const spanX = Math.max(1, xExtent[1] - xExtent[0]), spanY = Math.max(1, yExtent[1] - yExtent[0]);
  const fit = Math.min(width * coverage / spanX, height * coverage / spanY);
  const centerX = (xExtent[0] + xExtent[1]) / 2, centerY = (yExtent[0] + yExtent[1]) / 2;
  points.forEach(point => {
    point.x = width / 2 + (point.x - centerX) * fit;
    point.y = height / 2 + (point.y - centerY) * fit;
  });
}

function networkEdgeTargetLength(edge, evidenceExtent) {
  const strength = scale(Math.log1p(relationshipEvidenceCount(edge) || 1), evidenceExtent, [0, 1]);
  return 118 - strength * 52;
}

function settleNetworkPositions(nodes, edges, positions, width, height) {
  const evidenceValues = edges.map(edge => Math.log1p(relationshipEvidenceCount(edge) || 1));
  const evidenceExtent = [Math.min(...evidenceValues), Math.max(...evidenceValues)];
  const links = new Map(nodes.map(node => [node.id, 0]));
  edges.forEach(edge => {
    links.set(edge.source, (links.get(edge.source) || 0) + 1);
    links.set(edge.target, (links.get(edge.target) || 0) + 1);
  });
  for (let round = 0; round < 140; round++) {
    edges.forEach(edge => {
      const a = positions.get(edge.source), b = positions.get(edge.target);
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      const target = networkEdgeTargetLength(edge, evidenceExtent);
      const pull = Math.max(-5, Math.min(5, (distance - target) * .025));
      const aShare = links.get(edge.source) <= links.get(edge.target) ? .65 : .35;
      a.x += dx / distance * pull * aShare; a.y += dy / distance * pull * aShare;
      b.x -= dx / distance * pull * (1 - aShare); b.y -= dy / distance * pull * (1 - aShare);
    });
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = positions.get(nodes[i].id), b = positions.get(nodes[j].id);
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      if (distance < 44) { const push = (44 - distance) * .035; a.x -= dx / distance * push; a.y -= dy / distance * push; b.x += dx / distance * push; b.y += dy / distance * push; }
    }
    positions.forEach(point => {
      point.x += (width / 2 - point.x) * .002;
      point.y += (height / 2 - point.y) * .002;
    });
  }
}

function renderNetwork() {
  const { svg, width, height } = clearChart();
  const zoom = Math.max(.5, Math.min(2.5, Number(state.config.zoom) || 1));
  const labelSize = Math.max(10, state.config.labelSize / zoom);
  const collectionMode = state.config.nodeRole === "collection";
  let candidates, edges;
  if (collectionMode) {
    ({ candidates, edges } = collectionNetworkData());
  } else {
    candidates = filteredEntities();
    const candidateIds = new Set(candidates.map(item => item.id));
    const visibleDocumentIds = new Set(state.catalog.documents.filter(document => sourceMatches(document.source)).map(document => document.id));
    edges = state.catalog.edges.map(edge => filteredEdge(edge, visibleDocumentIds)).filter(edge => edge && candidateIds.has(edge.source) && candidateIds.has(edge.target) && relationshipEvidenceCount(edge) >= state.config.minEvidence && (state.config.relation === "all" || edge.relationship === state.config.relation));
  }
  const degree = new Map();
  edges.forEach(edge => { const strength = relationshipEvidenceCount(edge); degree.set(edge.source, (degree.get(edge.source) || 0) + strength); degree.set(edge.target, (degree.get(edge.target) || 0) + strength); });
  const nodes = candidates.filter(node => degree.has(node.id)).sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, state.config.limit);
  const ids = new Set(nodes.map(node => node.id));
  edges = edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
  if (!nodes.length) return showEmpty();
  const positions = new Map();
  nodes.forEach((node, index) => {
    const phase = ((node.category || node.name).charCodeAt(0) % 5) * .25;
    positions.set(node.id, networkSeedPosition(index, nodes.length, width, height, collectionMode, phase));
  });
  if (!collectionMode) settleNetworkPositions(nodes, edges, positions, width, height);
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
    const strength = collectionMode ? edge.evidenceCount : relationshipEvidenceCount(edge);
    const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "network-relationship-line mark", "stroke-width": Math.min(2, .4 + Math.sqrt(strength) * .22) });
    addTitle(line, `${label(edge.relationship)} · ${formatNumber(strength)} ${collectionMode ? "entities" : "weighted evidence segments"}`);
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
      : `${node.name} · ${label(state.config.size)}: ${formatNumber(node[state.config.size])}${["contextAdjustedMentions", "epistemicAdjustedMentions"].includes(state.config.size) ? ` · Raw mentions: ${formatNumber(node.mentions)}` : ""}`);
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
      const line = el("line", { x1: sourcePosition.x, y1: sourcePosition.y, x2: targetPosition.x, y2: targetPosition.y, class: "scatter-relationship-line", "stroke-width": Math.min(2, .4 + Math.sqrt(relationshipEvidenceCount(relationship.edge)) * .22) });
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
    const rawMentionDetail = ["contextAdjustedMentions", "epistemicAdjustedMentions"].includes(state.config.y) ? ` · Raw mentions: ${formatNumber(item.mentions)}` : "";
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
    if (derivativeCoverageWarning(item)) {
      svg.append(el("circle", { cx: x, cy: y, r: radius + 6, fill: "none", stroke: "#111", "stroke-width": 2, class: "derivative-ring", "pointer-events": "none" }));
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
    relationships: overlay.edges.map(relationship => ({ source: relationship.source, target: relationship.target, evidenceCount: relationshipEvidenceCount(relationship.edge) })),
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
  const maximumSize = Math.max(10, Math.floor(requestedSize * areaScale));
  const spineWidth = Math.min(18, Math.max(6, block.width * .11));
  const horizontalPadding = Math.min(18, Math.max(7, block.width * .055));
  const textWidth = block.width - spineWidth - horizontalPadding * 2;
  let labelSize = maximumSize;
  let lines = [];
  let authorLine = "";
  let complete = false;
  const author = bookAuthor(block.item);
  while (labelSize >= 10) {
    const maxCharacters = Math.max(4, Math.floor(textWidth / (labelSize * .62)));
    const authorSize = Math.max(10, labelSize * .72);
    const maxLines = Math.max(1, Math.min(4, Math.floor((block.height - 14 - (author ? authorSize * 1.65 : 0)) / (labelSize * 1.15))));
    lines = bookLabelLines(block.item.name, maxCharacters, maxLines);
    authorLine = author ? bookLabelLines(author, Math.max(5, Math.floor(textWidth / (authorSize * .58))), 1)[0] : "";
    complete = Boolean(lines.length) && !lines.at(-1).endsWith("…") && lines.every(line => line.length <= maxCharacters);
    if (complete || labelSize === 10) break;
    labelSize -= 1;
  }
  const lineHeight = labelSize * 1.15;
  const authorSize = Math.max(10, labelSize * .72);
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

function machineDataPathURL(pathValue) {
  const input = state.catalog?.input || {};
  const repository = input.repository || "ufo-files/machine-data";
  const revision = input.revision || "main";
  const path = String(pathValue || "").split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${repository}/blob/${encodeURIComponent(revision)}/${path}`;
}

function machineDataDocumentURL(document) {
  return machineDataPathURL(document.path);
}

function documentEntityCounts() {
  const counts = new Map(state.catalog.documents.map(document => [document.id, 0]));
  state.catalog.entities.forEach(entity => {
    (entity.documentIds || []).forEach(documentId => counts.set(documentId, (counts.get(documentId) || 0) + 1));
  });
  return counts;
}

function documentNaturalSortKey(document) {
  return String(document.title || document.path || "")
    .toLocaleLowerCase()
    .replace(/\d+/g, digits => digits.padStart(20, "0"));
}

function compareDocumentBrowserRecords(left, right) {
  return right.entityCount - left.entityCount
    || (left.documentSortKey < right.documentSortKey ? -1 : left.documentSortKey > right.documentSortKey ? 1 : 0);
}

function documentCardHTML(document, wordExtent) {
  const intensity = clampedScale(document.words, wordExtent, [.14, .94]);
  const language = document.originalLanguage ? ` · ${document.originalLanguage}` : "";
  const translation = document.translationAvailable ? ` · EN ${label(document.translationReviewStatus)}` : "";
  return `<article class="document-card">
    <button class="document-card-main" type="button" data-document-inspect="${escapeHTML(document.id)}">
      <span class="document-file-icon" aria-hidden="true" title="${formatNumber(document.words)} words" style="--document-intensity:${intensity};--document-icon-ink:${intensity > .56 ? "#f6f5ef" : "#111"}">TXT</span>
      <span class="document-file-copy"><strong>${escapeHTML(document.title || document.path)}</strong><small>${escapeHTML(document.path)}</small></span>
    </button>
    <div class="document-card-meta"><span>${escapeHTML(document.source)}${escapeHTML(language)}${escapeHTML(translation)}</span><span>${formatNumber(document.entityCount)} published entities · ${formatNumber(document.words)} words${document.epistemicQualifierCount ? ` · ${formatNumber(document.epistemicQualifierCount)} qualifier candidate${document.epistemicQualifierCount === 1 ? "" : "s"}` : ""}</span></div>
    <a class="document-source-link" href="${escapeHTML(machineDataPathURL(document.canonicalPath || document.path))}" target="_blank" rel="noopener noreferrer">Open${document.canonicalPath ? ` ${escapeHTML(document.originalLanguage || "pt-BR")}` : ""} ↗</a>
    ${document.translationPath ? `<a class="document-source-link" href="${escapeHTML(machineDataPathURL(document.translationPath))}" target="_blank" rel="noopener noreferrer">Open EN · ${escapeHTML(label(document.translationReviewStatus))} ↗</a>` : ""}
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
  const scoped = state.catalog.documents.filter(document => sourceMatches(document.source)).map(document => ({
    ...document,
    entityCount: entityCounts.get(document.id) || 0,
    documentSortKey: documentNaturalSortKey(document)
  }));
  const matching = scoped
    .filter(document => !query || [document.title, document.path, document.source, document.format, document.engine, document.originalLanguage, document.translationReviewStatus]
      .some(value => String(value || "").toLocaleLowerCase().includes(query)))
    .sort(compareDocumentBrowserRecords);
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

function knownStructuredDateDefect(document) {
  if (!document?.documentDate) return null;
  const year = Number(document.documentDate.slice(0, 4));
  const databaseId = Number(document.sourceRecord?.databaseId);
  if (!Number.isFinite(year) || year < 1800) return "The preserved source contains a malformed year earlier than 1800.";
  if (["UPDB-BAASS", "UPDB-NIDS"].includes(document.source) && year === 1905) {
    return "The preserved UPDB source belongs to the audited 1905 century-corruption block.";
  }
  if (document.source === "UPDB-NICAP" && databaseId >= 5182510 && databaseId <= 5182538) {
    return "The preserved NICAP row belongs to an audited block containing century-truncated and mismatched dates.";
  }
  if (document.source === "UPDB-NICAP" && [5176695, 5176696].includes(databaseId)) {
    return "The preserved NICAP row labels its year unknown but stores 1900-01-01.";
  }
  if (document.source === "UPDB-NICAP" && NICAP_IMPRECISE_DATE_DATABASE_IDS.has(databaseId)) {
    return "The preserved NICAP row carries a season, month, range, or unknown-date qualifier that is incompatible with exact-day precision.";
  }
  if (document.source === "UPDB-MUFON" && year === 1890) {
    return "The preserved MUFON row uses an audited 1890 sentinel or unsupported placeholder date.";
  }
  return null;
}

function reportedEventDateReview(document) {
  const knownDefect = knownStructuredDateDefect(document);
  if (knownDefect && document?.reportedEventDateReview?.method !== "analyst-review") {
    return { status: "review_required", reason: "known-source-date-defect", method: "source-date-audit", evidence: knownDefect };
  }
  if (document?.reportedEventDateReview?.status) return document.reportedEventDateReview;
  if (!document?.documentDate) return { status: "review_required", reason: "missing-date", method: "timeline-fallback" };
  if ((document.documentDatePrecision || "day") !== "day") return { status: "review_required", reason: "imprecise-date", method: "timeline-fallback" };
  if ((document.documentDateConfidence ?? 0) < .9) return { status: "review_required", reason: "low-date-confidence", method: "timeline-fallback" };
  if (document.documentDateEvidence?.method !== "metadata:document_date") return { status: "review_required", reason: "untrusted-date-method", method: "timeline-fallback" };
  if (document.documentDate < REPORTED_EVENT_AUTOMATIC_START_DATE) {
    return { status: "review_required", reason: "before-modern-reporting-baseline", method: "timeline-fallback" };
  }
  return { status: "published", reason: "trusted-structured-date", method: "timeline-fallback" };
}

function reportedTimelineEvent(document) {
  if (document?.engine !== "structured-database-extract" || !document.documentDate) return null;
  const dateReview = reportedEventDateReview(document);
  if (dateReview.status !== "published" || (document.source !== "UPDB-MUFON" && dateReview.method !== "analyst-review")) return null;
  const reportId = document.sourceRecord?.externalId || document.sourceRecord?.databaseId || document.path?.match(/mufon-(\d+)\.txt$/i)?.[1] || document.id;
  const sourceLabel = document.source === "UPDB-MUFON" ? "MUFON" : document.source?.replace(/^UPDB-/, "") || "Database";
  const familyId = document.sourceFamily?.id || `unknown:${document.id}`;
  return {
    id: `reported-${document.id}`,
    title: `${sourceLabel} report ${reportId}`,
    eventType: "reported_sighting",
    startDate: document.documentDate,
    datePrecision: document.documentDatePrecision || "day",
    confidence: document.documentDateConfidence ?? .99,
    mentionCount: 1,
    documentCount: 1,
    independentSourceFamilyCount: 1,
    sourceFamilyIds: [familyId],
    documentIds: [document.id],
    entityIds: [],
    evidence: [{
      documentId: document.id,
      excerpt: document.documentDateEvidence?.excerpt || `${document.title} · ${document.documentDate}`,
      ...(document.documentDateEvidence?.segment != null ? { segment: document.documentDateEvidence.segment } : {})
    }],
    dateReview,
    reportedDocument: document,
    source: document.source
  };
}

function historicalTimelineCandidate(document) {
  if (document?.engine !== "structured-database-extract" || !document.documentDate) return null;
  const dateReview = reportedEventDateReview(document);
  const year = Number(document.documentDate.slice(0, 4));
  if (dateReview.status !== "review_required" || dateReview.reason !== "before-modern-reporting-baseline"
    || !Number.isFinite(year) || year < 1800 || document.documentDate >= REPORTED_EVENT_AUTOMATIC_START_DATE) return null;
  const reportId = document.sourceRecord?.externalId || document.sourceRecord?.databaseId || document.id;
  const familyId = document.sourceFamily?.id || `unknown:${document.id}`;
  return {
    id: `historical-candidate-${document.id}`,
    title: `${document.source} unreviewed source date ${reportId}`,
    eventType: "historical_date_candidate",
    startDate: document.documentDate,
    datePrecision: document.documentDatePrecision || "day",
    confidence: Math.min(document.documentDateConfidence ?? .5, .5),
    mentionCount: 1,
    documentCount: 1,
    independentSourceFamilyCount: 1,
    sourceFamilyIds: [familyId],
    documentIds: [document.id],
    entityIds: [],
    evidence: [{
      documentId: document.id,
      excerpt: document.documentDateEvidence?.excerpt || `${document.title} · ${document.documentDate}`,
      ...(document.documentDateEvidence?.segment != null ? { segment: document.documentDateEvidence.segment } : {})
    }],
    dateReview,
    historicalCandidateDocument: document,
    source: document.source
  };
}

function timelineEventCandidates() {
  const published = (state.catalog.events || []).filter(item => item.startDate && item.confidence >= .9).map(item => {
    const documentIds = item.documentIds.filter(id => sourceMatches(state.documentById.get(id)?.source));
    if (!documentIds.length) return null;
    const sourceFamilyIds = [...new Set(documentIds.map(id => state.documentById.get(id)?.sourceFamily?.id || `unknown:${id}`))];
    const sources = [...new Set(documentIds.map(id => state.documentById.get(id)?.source).filter(Boolean))];
    return {
      ...item,
      documentIds,
      documentCount: documentIds.length,
      independentSourceFamilyCount: sourceFamilyIds.length,
      sourceFamilyIds,
      source: sources.length === 1 ? sources[0] : "",
      sources,
      evidence: (item.evidence || []).filter(evidence => documentIds.includes(evidence.documentId))
    };
  }).filter(Boolean);
  const reported = state.catalog.documents
    .filter(document => sourceMatches(document.source))
    .map(reportedTimelineEvent)
    .filter(Boolean);
  const historical = state.config.timelineHistoricalCandidates ? state.catalog.documents
    .filter(document => sourceMatches(document.source))
    .map(historicalTimelineCandidate)
    .filter(Boolean) : [];
  return [...published, ...reported, ...historical];
}

function timelineDateLabel(value, precision = "day") {
  const parts = String(value || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return String(value || "");
  const [year, month, day] = parts;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (precision === "year") return String(year);
  if (precision === "month") return `${monthNames[month - 1]} ${year}`;
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

function timelineBucket(value, period, precision = "day") {
  const parts = String(value || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  const bucketPeriod = precision === "year" ? "year" : precision === "month" && period === "week" ? "month" : period;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (bucketPeriod === "year") return { key: String(year), startDate: `${year}-01-01`, label: String(year), period: "year" };
  if (bucketPeriod === "month") {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return { key, startDate: `${key}-01`, label: `${monthNames[month - 1]} ${year}`, period: "month" };
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const startDate = date.toISOString().slice(0, 10);
  return { key: startDate, startDate, label: `Week of ${startDate}`, period: "week" };
}

function groupTimelineEvents(events, period = "year") {
  const groups = new Map();
  events.forEach(event => {
    const bucket = timelineBucket(event.startDate, period, event.datePrecision || "day");
    if (!bucket) return;
    const historicalCandidateGroup = Boolean(event.historicalCandidateDocument);
    const groupKey = `${bucket.period}:${bucket.key}:${historicalCandidateGroup ? "candidate" : "published"}`;
    if (!groups.has(groupKey)) groups.set(groupKey, {
      id: `event-group-${bucket.period}-${bucket.key}-${historicalCandidateGroup ? "candidate" : "published"}`,
      title: bucket.label,
      eventType: "event_group",
      startDate: bucket.startDate,
      datePrecision: bucket.period,
      groupPeriod: bucket.period,
      eventCount: 0,
      reportedEventCount: 0,
      publishedEventCount: 0,
      historicalCandidateCount: 0,
      historicalCandidateGroup,
      mentionCount: 0,
      confidenceTotal: 0,
      events: [],
      evidence: [],
      documentIds: new Set(),
      entityIds: new Set(),
      sourceFamilyIds: new Set(),
      sources: new Set()
    });
    const group = groups.get(groupKey);
    group.eventCount += 1;
    group.historicalCandidateCount += event.historicalCandidateDocument ? 1 : 0;
    group.reportedEventCount += event.reportedDocument ? 1 : 0;
    group.publishedEventCount += event.reportedDocument || event.historicalCandidateDocument ? 0 : 1;
    group.mentionCount += event.mentionCount || 1;
    group.confidenceTotal += event.confidence || 0;
    group.events.push(event);
    if (group.evidence.length < 24) group.evidence.push(...(event.evidence || []).slice(0, 24 - group.evidence.length));
    (event.documentIds || []).forEach(id => group.documentIds.add(id));
    (event.entityIds || []).forEach(id => group.entityIds.add(id));
    (event.sourceFamilyIds || []).forEach(id => group.sourceFamilyIds.add(id));
    (event.sources || [event.source]).filter(Boolean).forEach(source => group.sources.add(source));
  });
  return [...groups.values()].map(group => ({
    ...group,
    confidence: group.confidenceTotal / Math.max(1, group.eventCount),
    documentIds: [...group.documentIds],
    documentCount: group.documentIds.size,
    entityIds: [...group.entityIds],
    sourceFamilyIds: [...group.sourceFamilyIds],
    independentSourceFamilyCount: group.sourceFamilyIds.size,
    sourceCount: group.sources.size,
    sources: [...group.sources]
  })).sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function timelineEventStrengthCompare(left, right) {
  return (right.mentionCount || 0) - (left.mentionCount || 0)
    || (right.documentCount || 0) - (left.documentCount || 0)
    || (right.confidence || 0) - (left.confidence || 0);
}

function assignTimelineMentionRanks(items) {
  [...items].sort((left, right) => timelineEventStrengthCompare(left, right)
    || String(left.startDate || "").localeCompare(String(right.startDate || ""))
    || String(left.id || "").localeCompare(String(right.id || "")))
    .forEach((item, index) => { item.mentionRank = index + 1; });
  return items;
}

function timeBalancedTimelineEvents(items, requestedLimit, requestedRelevantLimit = DEFAULT_TIMELINE_RELEVANCE_CUTOFF, priorityPredicate = null) {
  const ordered = [...items].sort((left, right) => timelineEventStrengthCompare(left, right)
    || String(left.startDate || "").localeCompare(String(right.startDate || ""))
    || String(left.id || "").localeCompare(String(right.id || "")));
  const limit = Math.max(1, Math.round(Number(requestedLimit) || ordered.length));
  if (ordered.length <= limit) return ordered;
  const decadeFor = item => Math.floor(Number((item.startDate || "").slice(0, 4)) / 10) * 10;
  const decades = new Set(ordered.map(decadeFor).filter(Number.isFinite));
  const selected = new Set();
  const relevantLimit = Math.min(limit - 1, Math.max(0, Math.round(Number(requestedRelevantLimit) || 0)));
  ordered.slice(0, relevantLimit).forEach(item => selected.add(item.id));
  if (priorityPredicate) {
    ordered.filter(priorityPredicate).forEach(item => {
      if (selected.size < limit) selected.add(item.id);
    });
  }
  const earliest = [...ordered].sort((left, right) => String(left.startDate || "").localeCompare(String(right.startDate || "")))[0];
  const decadeCounts = new Map();
  if (earliest && !selected.has(earliest.id)) {
    selected.add(earliest.id);
    const decade = decadeFor(earliest);
    if (Number.isFinite(decade)) decadeCounts.set(decade, 1);
  }
  const breadthLimit = Math.max(0, limit - selected.size);
  const decadeFloor = Math.min(TIMELINE_DECADE_FLOOR, Math.max(1, Math.floor(breadthLimit / Math.max(1, decades.size))));
  ordered.forEach(item => {
    if (selected.has(item.id) || selected.size >= limit) return;
    const decade = decadeFor(item);
    if (!Number.isFinite(decade) || (decadeCounts.get(decade) || 0) >= decadeFloor) return;
    selected.add(item.id);
    decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
  });
  for (const item of ordered) {
    if (selected.size >= limit) break;
    selected.add(item.id);
  }
  return ordered.filter(item => selected.has(item.id)).slice(0, limit);
}

function timelineRelevanceLayout(maximumRank, requestedCutoff, range) {
  const maximum = Math.max(1, Math.round(Number(maximumRank) || 1));
  const cutoff = Math.max(1, Math.round(Number(requestedCutoff) || DEFAULT_TIMELINE_RELEVANCE_CUTOFF));
  const [top, bottom] = range;
  const relevanceActive = cutoff < maximum;
  const relevanceY = top + (bottom - top) * TIMELINE_RELEVANCE_GUIDE_FRACTION;
  const gap = Math.min(8, Math.max(3, (bottom - top) * .012));
  const position = rank => {
    if (!relevanceActive) return clampedScale(rank, [1, maximum], [top, bottom]);
    if (rank <= cutoff) return clampedScale(rank, [1, cutoff], [top, relevanceY - gap]);
    return clampedScale(rank, [cutoff + 1, maximum], [relevanceY + gap, bottom]);
  };
  const ticks = relevanceActive
    ? [...new Set([1, Math.max(1, Math.round(cutoff / 2)), cutoff, Math.round((cutoff + 1 + maximum) / 2), maximum])]
    : [...new Set([1, Math.round(maximum / 4), Math.round(maximum / 2), Math.round(maximum * 3 / 4), maximum])];
  return { active: true, relevanceActive, cutoff, maximum, top, bottom, relevanceY, position, ticks };
}

function drawTimelineRelevanceCutoff(svg, width, margin, layout, labelSize = 10) {
  if (!layout?.relevanceActive) return null;
  const text = width < 600 ? `Top ${layout.cutoff}` : `Top ${layout.cutoff} by mention rank`;
  const x = width - margin.right - 4;
  const y = layout.relevanceY - 7;
  const textWidth = text.length * labelSize * .58;
  const layer = el("g", { class: "timeline-relevance-cutoff-layer" });
  const line = el("line", {
    x1: margin.left, y1: layout.relevanceY,
    x2: width - margin.right, y2: layout.relevanceY,
    class: "timeline-relevance-cutoff"
  });
  addTitle(line, `At most ${layout.cutoff} top-ranked nodes appear above this relevance guide. Lower-ranked dates remain visible below it.`);
  layer.append(line);
  svg.append(layer);
  return {
    text, x, y, anchor: "end",
    box: {
      left: x - textWidth,
      right: x,
      top: y - labelSize - 3,
      bottom: y + 3
    }
  };
}

function drawTimelineDateBaseline(svg, width, margin, y) {
  if (!Number.isFinite(y)) return;
  svg.append(el("line", {
    x1: margin.left, y1: y,
    x2: width - margin.right, y2: y,
    class: "timeline-date-baseline"
  }));
}

function timelineRecencyGuidePlacement(xExtent, xRange, requestedYear, bounds, labelSize = 10, position = clampedScale) {
  const year = Math.round(Number(requestedYear) || DEFAULT_TIMELINE_RECENCY_YEAR);
  const timestamp = Date.UTC(year, 0, 1);
  if (timestamp < xExtent[0] || timestamp > xExtent[1]) return null;
  const x = position(timestamp, xExtent, xRange);
  const text = bounds.right - bounds.left < 600 ? `Recent · ${year}+` : `More recent · ${year}–present`;
  const textWidth = text.length * labelSize * .58;
  const anchor = x + textWidth + 7 > bounds.right ? "end" : "start";
  const textX = x + (anchor === "end" ? -6 : 6);
  const y = bounds.bottom - 7;
  return {
    year, x, text, textX, y, anchor,
    box: {
      left: anchor === "end" ? textX - textWidth : textX,
      right: anchor === "end" ? textX : textX + textWidth,
      top: y - labelSize - 3,
      bottom: y + 3
    }
  };
}

function drawTimelineRecencyGuide(svg, margin, baseline, placement) {
  if (!placement) return;
  const layer = el("g", { class: "timeline-recency-guide-layer" });
  const line = el("line", {
    x1: placement.x, y1: margin.top,
    x2: placement.x, y2: baseline,
    class: "timeline-recency-guide"
  });
  addTitle(line, `Dates from ${placement.year} onward are to the right of this recency guide.`);
  layer.append(line);
  svg.append(layer);
}

function drawTimelineGuideLabels(svg, relevancePlacement, recencyPlacement) {
  const layer = el("g", { class: "timeline-guide-labels" });
  if (relevancePlacement) layer.append(el("text", {
    x: relevancePlacement.x, y: relevancePlacement.y,
    "text-anchor": relevancePlacement.anchor,
    class: "timeline-relevance-cutoff-label"
  }, relevancePlacement.text));
  if (recencyPlacement) layer.append(el("text", {
    x: recencyPlacement.textX, y: recencyPlacement.y,
    "text-anchor": recencyPlacement.anchor,
    class: "timeline-recency-guide-label"
  }, recencyPlacement.text));
  svg.append(layer);
}

function timelineEventProvenance(item) {
  const candidate = item.groupPeriod ? item.historicalCandidateCount : item.historicalCandidateDocument ? 1 : 0;
  const reported = item.groupPeriod ? item.reportedEventCount : item.reportedDocument ? 1 : 0;
  const reviewed = item.groupPeriod ? item.publishedEventCount : item.reportedDocument || item.historicalCandidateDocument ? 0 : 1;
  if (candidate && !reported && !reviewed) return "candidate";
  return candidate || reported && reviewed ? "mixed" : reported ? "reported" : "reviewed";
}

function timelineTopLabelPlacements(items, positionFor, radiusFor, bounds, labelSize, limit = 10, reserved = []) {
  const placements = new Map();
  const occupied = [...reserved];
  const padding = 6;
  const overlaps = box => occupied.some(other => !(
    box.right + padding < other.left || box.left - padding > other.right
    || box.bottom + padding < other.top || box.top - padding > other.bottom
  ));
  for (const item of items) {
    if (placements.size >= limit) break;
    const point = positionFor(item);
    const radius = radiusFor(item);
    const text = item.title.slice(0, 22);
    const textWidth = Math.max(labelSize * 3, text.length * labelSize * .62);
    const textHeight = labelSize + 4;
    const gap = 5;
    const candidates = [
      { x: point.x, y: point.y - radius - gap, anchor: "middle", left: point.x - textWidth / 2, top: point.y - radius - gap - textHeight },
      { x: point.x, y: point.y + radius + gap + labelSize, anchor: "middle", left: point.x - textWidth / 2, top: point.y + radius + gap },
      { x: point.x + radius + gap, y: point.y + labelSize * .35, anchor: "start", left: point.x + radius + gap, top: point.y - textHeight / 2 },
      { x: point.x - radius - gap, y: point.y + labelSize * .35, anchor: "end", left: point.x - radius - gap - textWidth, top: point.y - textHeight / 2 }
    ].map(candidate => ({
      ...candidate,
      right: candidate.left + textWidth,
      bottom: candidate.top + textHeight
    }));
    const placement = candidates.find(box => box.left >= bounds.left && box.right <= bounds.right
      && box.top >= bounds.top && box.bottom <= bounds.bottom && !overlaps(box));
    if (!placement) continue;
    occupied.push(placement);
    placements.set(item.id, { ...placement, text });
  }
  return placements;
}

function timelineHistoricalMarkerPlacements(xExtent, xRange, bounds, labelSize = 10, position = clampedScale) {
  const compact = bounds.right - bounds.left < 600;
  const markerLanes = [];
  return TIMELINE_HISTORICAL_MARKERS.flatMap(marker => {
    const timestamp = new Date(`${marker.date}T00:00:00Z`).getTime();
    if (timestamp < xExtent[0] || timestamp > xExtent[1]) return [];
    const x = position(timestamp, xExtent, xRange);
    const displayLabel = compact ? marker.shortLabel || marker.label : marker.label;
    const textWidth = displayLabel.length * labelSize * .58;
    const useEndAnchor = x > (bounds.left + bounds.right) / 2 || x + textWidth + 8 > bounds.right;
    const textX = x + (useEndAnchor ? -6 : 6);
    const horizontalBox = {
      left: useEndAnchor ? textX - textWidth : textX,
      right: useEndAnchor ? textX : textX + textWidth
    };
    let lane = markerLanes.findIndex(boxes => boxes.every(box => horizontalBox.right + 6 < box.left || horizontalBox.left - 6 > box.right));
    if (lane < 0) lane = markerLanes.length;
    if (!markerLanes[lane]) markerLanes[lane] = [];
    markerLanes[lane].push(horizontalBox);
    const y = bounds.top + 18 + lane * (labelSize + 8);
    return [{
      ...marker,
      displayLabel,
      x,
      textX,
      y,
      anchor: useEndAnchor ? "end" : "start",
      box: {
        ...horizontalBox,
        top: y - labelSize - 3,
        bottom: y + 3
      }
    }];
  });
}

function drawTimelineHistoricalMarkers(svg, height, margin, placements, bottom = height - margin.bottom) {
  const layer = el("g", { class: "timeline-historical-markers" });
  placements.forEach(marker => {
    const line = el("line", {
      x1: marker.x, y1: margin.top, x2: marker.x, y2: bottom,
      class: "timeline-historical-marker"
    });
    addTitle(line, `${marker.detail} Source: ${marker.sourceUrl}`);
    layer.append(line);
  });
  svg.append(layer);
}

function drawTimelineHistoricalMarkerLabels(svg, placements) {
  const layer = el("g", { class: "timeline-historical-marker-labels" });
  placements.forEach(marker => {
    const leaderY = marker.y - 3.5;
    layer.append(el("line", {
      x1: marker.x, y1: leaderY,
      x2: marker.textX + (marker.anchor === "end" ? 2 : -2), y2: leaderY,
      class: "timeline-historical-marker-leader"
    }));
    const text = el("text", {
      x: marker.textX, y: marker.y, "text-anchor": marker.anchor,
      class: "timeline-historical-marker-label"
    }, marker.displayLabel);
    addTitle(text, marker.detail);
    layer.append(text);
  });
  svg.append(layer);
}

function renderTimeline() {
  const { svg, width, height } = clearChart();
  const rawEventCandidates = state.config.timelineRole === "event" ? timelineEventCandidates() : [];
  const candidates = (state.config.timelineRole === "event"
    ? state.config.timelineGrouping ? groupTimelineEvents(rawEventCandidates, state.config.timelineGroupPeriod) : rawEventCandidates
    : state.config.timelineRole === "entity"
    ? filteredEntities().map(entity => {
        const documents = entity.documentIds.map(id => state.documentById.get(id)).filter(document => document?.documentDate && sourceMatches(document.source)).sort((a, b) => new Date(a.documentDate) - new Date(b.documentDate));
        return documents.length ? { ...entity, title: entity.name, documentDate: documents[0].documentDate, source: documents[0].source, format: documents[0].format, entityRecord: entity } : null;
      }).filter(Boolean)
    : state.catalog.documents.filter(item => item.documentDate && sourceMatches(item.source)));
  const rankedData = state.config.timelineRole === "event"
    ? timeBalancedTimelineEvents(
      candidates,
      state.config.limit,
      DEFAULT_TIMELINE_RELEVANCE_CUTOFF,
      state.config.timelineHistoricalCandidates
        ? item => Boolean(item.groupPeriod ? item.historicalCandidateCount : item.historicalCandidateDocument)
        : null
    )
    : candidates.sort((a, b) => (b[state.config.y] || 0) - (a[state.config.y] || 0)).slice(0, state.config.limit);
  if (!rankedData.length) return showEmpty();
  if (state.config.timelineRole === "event") assignTimelineMentionRanks(rankedData);
  const data = rankedData;
  if (!data.length) return showEmpty();
  const timelineDate = item => item.startDate || item.documentDate;
  const xExtent = timelineDateExtent(
    data,
    rawEventCandidates,
    state.config.timelineRole,
    state.config.timelineRole === "event" && state.config.timelineCorrelativeMarkers ? TIMELINE_HISTORICAL_MARKERS : []
  );
  const maximumRank = state.config.timelineRole === "event" ? Math.max(...rankedData.map(item => item.mentionRank)) : null;
  const yExtent = state.config.timelineRole === "event" ? [1, maximumRank] : valueExtent(data, state.config.y);
  const relevanceLayout = state.config.timelineRole === "event"
    ? timelineRelevanceLayout(maximumRank, state.config.timelineRelevanceCutoff, [AXIS_MARGIN.top, height - AXIS_MARGIN.bottom])
    : null;
  const sizeExtent = valueExtent(data, state.config.size);
  const timelineXRange = [AXIS_MARGIN.left, width - AXIS_MARGIN.right];
  const timelineXPosition = value => timelineDatePosition(value, xExtent, timelineXRange);
  const margin = drawAxes(
    svg, width, height,
    state.config.timelineRole === "event" ? "startDate" : "documentDate",
    state.config.y, xExtent, yExtent, {},
    state.config.timelineRole === "event"
      ? { ascendingDown: true, grid: "x", yTicks: relevanceLayout.ticks, yPosition: relevanceLayout.position, xTicks: timelineDateTicks(xExtent), xPosition: timelineXPosition }
      : { ascendingDown: false, grid: "x", xTicks: timelineDateTicks(xExtent), xPosition: timelineXPosition }
  );
  const positionFor = item => ({
    x: timelineXPosition(new Date(timelineDate(item)).getTime()),
    y: state.config.timelineRole === "event"
      ? relevanceLayout.position(item[state.config.y])
      : clampedScale(item[state.config.y], yExtent, [height - margin.bottom, margin.top])
  });
  const historicalMarkers = state.config.timelineCorrelativeMarkers
    ? timelineHistoricalMarkerPlacements(
      xExtent,
      [margin.left, width - margin.right],
      { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom },
      10,
      timelineDatePosition
    )
    : [];
  const recencyGuide = relevanceLayout ? timelineRecencyGuidePlacement(
    xExtent,
    [margin.left, width - margin.right],
    state.config.timelineRecencyYear,
    { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom },
    10,
    timelineDatePosition
  ) : null;
  drawTimelineHistoricalMarkers(svg, height, margin, historicalMarkers);
  drawTimelineDateBaseline(svg, width, margin, height - margin.bottom);
  const relevanceCutoffBox = drawTimelineRelevanceCutoff(svg, width, margin, relevanceLayout, 10);
  drawTimelineRecencyGuide(svg, margin, height - margin.bottom, recencyGuide);
  const eventEntityNames = new Map((state.catalog.entities || []).map(entity => [entity.id, entity.name]));
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
      const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "scatter-relationship-line", "stroke-width": Math.min(2, .4 + Math.sqrt(relationshipEvidenceCount(relationship.edge)) * .22) });
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
  const topLabelCandidates = [...data]
    .sort((a, b) => state.config.timelineRole === "event"
      ? a.mentionRank - b.mentionRank
      : (b[state.config.size] || 0) - (a[state.config.size] || 0) || b.confidence - a.confidence)
  const topLabelPlacements = state.config.labels === "top" ? timelineTopLabelPlacements(
    topLabelCandidates,
    positionFor,
    item => scale(item[state.config.size], sizeExtent, [3, 12]),
    { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom },
    state.config.labelSize,
    10,
    [...historicalMarkers.map(marker => marker.box), ...(relevanceCutoffBox ? [relevanceCutoffBox.box] : []), ...(recencyGuide ? [recencyGuide.box] : [])]
  ) : new Map();
  const timelineNodeLabelLayer = el("g", { class: "timeline-node-labels" });
  data.forEach((item, index) => {
    const { x, y } = positionFor(item);
    const radius = scale(item[state.config.size], sizeExtent, [3, 12]);
    const shade = scale(item[state.config.size], sizeExtent, [.18, .96]);
    const provenance = state.config.timelineRole === "event" ? timelineEventProvenance(item) : "";
    const hasHistoricalCandidate = state.config.timelineRole === "event" && (item.groupPeriod ? item.historicalCandidateCount : item.historicalCandidateDocument);
    const dot = el("circle", { cx: x, cy: y, r: radius, fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": 1, class: `mark${provenance ? ` timeline-event-node timeline-${provenance}${hasHistoricalCandidate ? " timeline-has-candidate" : ""}` : ""}` });
    const groupBreakdown = item.groupPeriod ? ` · ${formatNumber(item.historicalCandidateCount)} historical dates awaiting review · ${formatNumber(item.reportedEventCount)} published database reports · ${formatNumber(item.publishedEventCount)} reviewed events` : "";
    addTitle(dot, item.groupPeriod ? `${item.title} · ${formatNumber(item.eventCount)} events${groupBreakdown}` : `${item.title} · ${timelineDateLabel(timelineDate(item), item.datePrecision)}`);
    dot.addEventListener("click", () => state.config.timelineRole === "event" ? item.groupPeriod ? inspectTimelineGroup(item) : item.historicalCandidateDocument ? inspectDocument(item.historicalCandidateDocument) : item.reportedDocument ? inspectDocument(item.reportedDocument) : inspectEvent(item) : item.entityRecord ? inspectEntity(item.entityRecord) : inspectDocument(item));
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
    if (hasHistoricalCandidate) {
      svg.append(el("circle", { cx: x, cy: y, r: radius + 3, fill: "none", class: "timeline-candidate-ring", "pointer-events": "none" }));
    }
    const topLabel = topLabelPlacements.get(item.id);
    if (state.config.labels === "all") {
      timelineNodeLabelLayer.append(el("text", { x, y: Math.min(height - margin.bottom + 18, y + radius + state.config.labelSize), "text-anchor": "middle", class: "chart-label node-label" }, item.title.slice(0, 22)));
    } else if (topLabel) {
      timelineNodeLabelLayer.append(el("text", { x: topLabel.x, y: topLabel.y, "text-anchor": topLabel.anchor, class: "chart-label node-label" }, topLabel.text));
    }
  });
  svg.append(timelineNodeLabelLayer);
  drawTimelineHistoricalMarkerLabels(svg, historicalMarkers);
  drawTimelineGuideLabels(svg, relevanceCutoffBox, recencyGuide);
  drawIntensityLegend(relevanceLayout?.relevanceActive, Boolean(recencyGuide));
  const eventScope = state.config.timelineHistoricalCandidates
    ? "reviewed events, published reports, and screened unreviewed historical dates"
    : "reviewed events and published reports";
  const relevanceSummary = relevanceLayout?.relevanceActive
    ? `top ${state.config.timelineRelevanceCutoff} above relevance guide`
    : "all shown ranks use full height";
  const eventSummary = state.config.timelineGrouping
    ? `${data.length} time-balanced date groups of ${formatNumber(candidates.length)} · ${formatNumber(rawEventCandidates.length)} ${eventScope} · ${relevanceSummary} · recency guide ${state.config.timelineRecencyYear}`
    : `${data.length} of ${formatNumber(rawEventCandidates.length)} events and reported sightings · ${relevanceSummary} · recency guide ${state.config.timelineRecencyYear}`;
  setSummary(state.config.timelineRole === "event" ? eventSummary : `${data.length} ${state.config.timelineRole === "entity" ? "entities" : "dated source documents"}`, "timeline");
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
  const rowTotal = new Map(sources.map(source => [source.name, Math.max(counts.filter(item => item.source === source.name).reduce((sum, item) => sum + item.value, 0), 1)]));
  columns.forEach((column, index) => svg.append(el("text", { x: margin.left + (index + .5) * cellW, y: margin.top - 12, "text-anchor": "middle", class: "chart-label" }, column.label.slice(0, state.config.matrixColumns === "entity" ? 12 : 15))));
  sources.forEach((source, index) => svg.append(el("text", { x: margin.left - 8, y: margin.top + (index + .55) * cellH, "text-anchor": "end", class: "chart-label" }, source.name.slice(0, 24))));
  counts.forEach(item => {
    const row = sources.findIndex(source => source.name === item.source), column = columns.findIndex(candidate => candidate.id === item.columnId);
    const denominator = state.config.matrixNormalize === "rowShare" ? rowTotal.get(item.source) : max;
    const opacity = .08 + item.value / denominator * .92;
    const rect = el("rect", { x: margin.left + column * cellW + 1, y: margin.top + row * cellH + 1, width: Math.max(2, cellW - 2), height: Math.max(2, cellH - 2), fill: "#111", "fill-opacity": opacity, stroke: "none", class: "mark" });
    const normalized = denominator ? item.value / denominator : 0;
    addTitle(rect, `${item.source} · ${item.columnLabel}: ${item.value} · ${state.config.matrixNormalize === "rowShare" ? `${Math.round(normalized * 100)}% of this collection's visible row total` : "global raw-count scale"}`); rect.addEventListener("click", () => inspectMatrix({ ...item, normalized, normalization: state.config.matrixNormalize })); svg.append(rect);
  });
  drawIntensityLegend();
  setSummary(`${sources.length} collections × ${columns.length} ${state.config.matrixColumns === "entity" ? "entities" : "entity types"} · ${state.config.matrixNormalize === "rowShare" ? "within-collection shade" : "raw-count shade"}`, "matrix");
}

function buildCoverageAggregate(catalog) {
  const documents = catalog?.documents || [];
  const documentIds = new Set(documents.map(document => document.id));
  const values = Object.fromEntries(COVERAGE_DIMENSIONS.map(dimension => [dimension, new Map()]));
  const add = (dimension, value, documentId) => {
    const bucketLabel = value || `Unknown ${dimension}`;
    if (!values[dimension].has(bucketLabel)) values[dimension].set(bucketLabel, new Set());
    values[dimension].get(bucketLabel).add(documentId);
  };
  documents.forEach(document => {
    const year = String(document.documentDate || "").match(/^\d{4}/)?.[0];
    add("time", year ? `${year.slice(0, 3)}0s` : "Unknown date", document.id);
    add("collection", document.source || "Unknown collection", document.id);
    add("format", document.format || "Unknown format", document.id);
  });
  const geographyByDocument = new Map(), categoryByDocument = new Map(), modalityByDocument = new Map(), documentsWithUnmappedLocations = new Set();
  const collect = (map, documentId, value) => {
    if (!documentIds.has(documentId) || !value) return;
    if (!map.has(documentId)) map.set(documentId, new Set());
    map.get(documentId).add(value);
  };
  (catalog?.entities || []).forEach(entity => (entity.documentIds || []).forEach(documentId => {
    collect(categoryByDocument, documentId, entity.category);
    if (entity.category === "location") {
      if (entity.geo) collect(geographyByDocument, documentId, entity.canonicalName || entity.name);
      else documentsWithUnmappedLocations.add(documentId);
    }
  }));
  (catalog?.events || []).forEach(event => (event.documentIds || []).forEach(documentId => collect(modalityByDocument, documentId, event.eventType)));
  documents.forEach(document => {
    (geographyByDocument.get(document.id) || []).forEach(value => add("geography", value, document.id));
    if (!geographyByDocument.has(document.id) || documentsWithUnmappedLocations.has(document.id)) add("geography", "Unknown geography", document.id);
    (categoryByDocument.get(document.id) || ["Unknown category"]).forEach(value => add("category", value, document.id));
    (modalityByDocument.get(document.id) || ["Unknown modality"]).forEach(value => add("modality", value, document.id));
  });
  const documentById = new Map(documents.map(document => [document.id, document]));
  return {
    schema: "ufo-files-corpus-coverage/v1",
    policy: {
      unit: "Documents are counted once per cell even when a dimension is multi-valued",
      denominator: "Each cell is normalized within its row and active cohort",
      unknowns: "Missing dates, reviewed coordinates, published categories, and event modalities are explicit buckets",
      warning: "Corpus gaps are not evidence that real-world events did not occur"
    },
    dimensions: COVERAGE_DIMENSIONS.map(dimension => {
      const buckets = [...values[dimension]].map(([bucketLabel, ids]) => {
        const sortedIds = [...ids].sort();
        return {
          id: `${dimension}:${encodeURIComponent(bucketLabel)}`, label: bucketLabel, unknown: bucketLabel.startsWith("Unknown "),
          documentCount: sortedIds.length,
          wordCount: sortedIds.reduce((sum, id) => sum + Number(documentById.get(id)?.words || 0), 0),
          datedDocumentCount: sortedIds.filter(id => documentById.get(id)?.documentDate).length,
          documentIds: sortedIds
        };
      }).sort((left, right) => Number(left.unknown) - Number(right.unknown) || right.documentCount - left.documentCount || left.label.localeCompare(right.label));
      const unknownIds = new Set(buckets.filter(bucket => bucket.unknown).flatMap(bucket => bucket.documentIds));
      return {
        id: dimension, label: COVERAGE_DIMENSION_LABELS[dimension],
        multiValue: ["geography", "category", "modality"].includes(dimension),
        knownDocumentCount: documents.length - unknownIds.size, documentCount: documents.length, buckets
      };
    })
  };
}

function coverageData(catalog = state.catalog) {
  if (catalog?.coverage?.schema === "ufo-files-corpus-coverage/v1" && Array.isArray(catalog.coverage.dimensions)) return catalog.coverage;
  const coverage = buildCoverageAggregate(catalog || {});
  if (catalog) catalog.coverage = coverage;
  return coverage;
}

function coverageDimension(coverage, id) {
  return coverage.dimensions.find(dimension => dimension.id === id) || coverage.dimensions[0];
}

function coverageScopeDocumentIds(catalog, config, prefix = "") {
  const collection = prefix ? config[`coverage${prefix}Collection`] : "all";
  const from = prefix ? config[`coverage${prefix}From`] : "";
  const to = prefix ? config[`coverage${prefix}To`] : "";
  return new Set((catalog?.documents || []).filter(document => {
    const selected = config.allSources || config.sources.includes(document.source);
    if (!selected || collection !== "all" && document.source !== collection) return false;
    if (from && (!document.documentDate || document.documentDate < from)) return false;
    if (to && (!document.documentDate || document.documentDate > to)) return false;
    return true;
  }).map(document => document.id));
}

function coverageMetricValue(documentIds, metric, documentById) {
  if (metric === "wordCount") return [...documentIds].reduce((sum, id) => sum + Number(documentById.get(id)?.words || 0), 0);
  if (metric === "datedDocumentCount") return [...documentIds].filter(id => documentById.get(id)?.documentDate).length;
  return documentIds.size;
}

function coverageMetricLabel(metric) {
  return ({ documentCount: "Document count", wordCount: "Word count", datedDocumentCount: "Dated-document count" })[metric] || label(metric);
}

function coverageDimensionCompleteness(dimension, scopeIds) {
  if (!scopeIds.size) return 0;
  const unknown = new Set(dimension.buckets.filter(bucket => bucket.unknown).flatMap(bucket => bucket.documentIds));
  const unknownCount = [...scopeIds].filter(id => unknown.has(id)).length;
  return (scopeIds.size - unknownCount) / scopeIds.size;
}

function coverageCellScope(row, column, scopeIds, metric, documentById, rowCompleteness, columnCompleteness) {
  const rowIds = new Set(row.documentIds), columnIds = new Set(column.documentIds);
  const denominatorIds = [...scopeIds].filter(id => rowIds.has(id)).sort();
  const contributingIds = denominatorIds.filter(id => columnIds.has(id));
  const denominatorDocuments = new Set(denominatorIds);
  const contributing = new Set(contributingIds);
  const numerator = coverageMetricValue(contributing, metric, documentById);
  const denominator = coverageMetricValue(denominatorDocuments, metric, documentById);
  let status = "zero";
  if (!denominatorDocuments.size) status = "empty";
  else if (row.unknown || column.unknown) status = "unknown";
  else if (numerator > 0) status = "covered";
  else if (!denominator || Math.min(rowCompleteness, columnCompleteness) < .75) status = "insufficient";
  return {
    status, numerator, denominator, ratio: denominator ? numerator / denominator : null,
    contributingIds, denominatorDocumentIds: denominatorIds,
    metadataCompleteness: Math.min(rowCompleteness, columnCompleteness)
  };
}

function coverageScopedBuckets(dimension, scopeIds, limit = true) {
  const visible = dimension.buckets.map(bucket => ({
    ...bucket, scopedCount: bucket.documentIds.filter(id => scopeIds.has(id)).length
  })).filter(bucket => bucket.scopedCount || bucket.unknown);
  const unknown = visible.filter(bucket => bucket.unknown);
  const knownLimit = dimension.id === "geography" ? 10 : 16;
  const known = visible.filter(bucket => !bucket.unknown).sort((left, right) => right.scopedCount - left.scopedCount || left.label.localeCompare(right.label));
  if (limit) known.splice(knownLimit);
  return [...known, ...unknown];
}

function coverageMatrixData(catalog = state.catalog, config = state.config, options = {}) {
  const normalizedConfig = normalizeCoverageAxes({ ...config });
  const coverage = coverageData(catalog);
  const rowDimension = coverageDimension(coverage, normalizedConfig.coverageRows);
  const columnDimension = coverageDimension(coverage, normalizedConfig.coverageColumns);
  const scopeSpecs = normalizedConfig.coverageCompare ? [["A", "A"], ["B", "B"]] : [["Corpus", ""]];
  const scopes = scopeSpecs.map(([labelText, prefix]) => ({ label: labelText, ids: coverageScopeDocumentIds(catalog, normalizedConfig, prefix) }));
  const visibleScopeIds = new Set(scopes.flatMap(scope => [...scope.ids]));
  const rows = coverageScopedBuckets(rowDimension, visibleScopeIds, options.limitBuckets !== false);
  const columns = coverageScopedBuckets(columnDimension, visibleScopeIds, options.limitBuckets !== false);
  const documentById = new Map((catalog?.documents || []).map(document => [document.id, document]));
  const cells = rows.flatMap(row => columns.map(column => ({
    row, column,
    scopes: scopes.map(scope => coverageCellScope(
      row, column, scope.ids, normalizedConfig.coverageMetric, documentById,
      coverageDimensionCompleteness(rowDimension, scope.ids), coverageDimensionCompleteness(columnDimension, scope.ids)
    ))
  })));
  return { coverage, rowDimension, columnDimension, scopes, rows, columns, cells };
}

function coverageCellStatus(scopes) {
  if (scopes.some(scope => scope.status === "unknown")) return "unknown";
  if (scopes.every(scope => scope.status === "empty")) return "empty";
  if (scopes.some(scope => scope.status === "insufficient" || scope.status === "empty")) return "insufficient";
  if (scopes.every(scope => scope.status === "zero")) return "zero";
  return "covered";
}

function coverageStatusLabel(status) {
  return ({ covered: "Matching records", zero: "No matching records", insufficient: "Not enough source coverage to assess", unknown: "Unknown metadata bucket", empty: "No records in denominator" })[status];
}

function coverageScopeHTML(scope, labelText) {
  const ratio = scope.ratio == null ? "—" : `${Math.round(scope.ratio * 100)}%`;
  return `<span class="coverage-value coverage-value-${scope.status}">${labelText ? `<b>${escapeHTML(labelText)}</b>` : ""}<strong>${ratio}</strong><small>${formatNumber(scope.numerator)} / ${formatNumber(scope.denominator)}</small></span>`;
}

function topicalCompleteness(catalog = state.catalog, claimCatalog = state.claimCatalog) {
  const documents = catalog?.documents || [];
  const dimensions = new Map(coverageData(catalog).dimensions.map(dimension => [dimension.id, dimension]));
  const cases = catalog?.cases || [];
  const observationalCases = cases.filter(item => item.caseKind === "observation");
  const claims = claimCatalog?.claims || catalog?.claims || [];
  const measuredObservations = (catalog?.craftObservations || []).filter(item => item.measurements?.length).length;
  const item = (id, labelText, numerator, denominator, note) => ({
    id, label: labelText, numerator, denominator,
    ratio: denominator ? numerator / denominator : null,
    note
  });
  return [
    item("dated", "Dated documents", dimensions.get("time")?.knownDocumentCount || 0, documents.length, "Publication or event date available"),
    item("geography", "Reviewed geography", dimensions.get("geography")?.knownDocumentCount || 0, documents.length, "At least one reviewed place mention; not an incident coordinate"),
    item("modality", "Event / evidence modality", dimensions.get("modality")?.knownDocumentCount || 0, documents.length, "At least one typed event or evidence modality"),
    item("case-sensors", "Case sensor metadata", observationalCases.filter(item => item.dataCompleteness?.sensorModality).length, observationalCases.length, "Reported sensor modality recorded for observational cases"),
    item("assessments", "Published case assessments", cases.filter(item => item.resolutionStatus !== "unassessed").length, cases.length, "Attributed assessment recorded separately from the report"),
    item("measurements", "Craft reports with dimensions", measuredObservations, (catalog?.craftObservations || []).length, "Explicit physical measurement retained; dimensions are never inferred"),
    item("claims", "Reviewed claims", claims.filter(claim => claim.review?.status === "published").length, claims.length, "Structured claims that passed editorial review")
  ];
}

function topicalCompletenessHTML(items) {
  return `<section class="coverage-scoreboard" aria-label="Topical metadata completeness"><header><strong>Topical metadata completeness</strong><span>Measures this corpus and its structured metadata—not the prevalence or reality of UAP events.</span></header>${items.map(item => {
    const percent = item.ratio == null ? "—" : `${Math.round(item.ratio * 100)}%`;
    return `<article class="coverage-score-card"><strong>${escapeHTML(percent)}</strong><span>${escapeHTML(item.label)}</span><small>${formatNumber(item.numerator)} / ${formatNumber(item.denominator)} · ${escapeHTML(item.note)}</small></article>`;
  }).join("")}</section>`;
}

function renderCoverage() {
  hideMapView();
  const svg = $("#chart"), view = $("#tableView");
  svg.setAttribute("hidden", ""); svg.replaceChildren(); view.hidden = false;
  $("#chartWrap").classList.remove("triage-mode", "claims-mode", "craft-mode", "species-mode", "species-lineup-mode", "programs-mode");
  $("#chartWrap").classList.add("table-mode", "coverage-mode");
  $("#legend").innerHTML = `<span class="coverage-key covered">Covered</span><span class="coverage-key zero">No matching records</span><span class="coverage-key insufficient">Not enough coverage</span><span class="coverage-key unknown">Unknown metadata</span>`;
  const matrix = coverageMatrixData();
  if (!matrix.rows.length || !matrix.columns.length || matrix.scopes.every(scope => !scope.ids.size)) {
    view.innerHTML = `<div class="coverage-warning"><strong>Interpretation warning</strong><span>${escapeHTML(matrix.coverage.policy.warning)}.</span></div>`;
    return showEmpty();
  }
  const cellMap = new Map(matrix.cells.map(cell => [`${cell.row.id}|${cell.column.id}`, cell]));
  view.innerHTML = `<div class="coverage-warning"><strong>Interpretation warning</strong><span>Percentages are relative to each row. ${escapeHTML(matrix.coverage.policy.warning)}. Sparse cells may reflect incomplete collection, dates, coordinates, classification, or event metadata.</span></div>
    ${topicalCompletenessHTML(topicalCompleteness())}
    <div class="coverage-table-wrap"><table class="coverage-table"><thead><tr><th>${escapeHTML(matrix.rowDimension.label)} ↓ / ${escapeHTML(matrix.columnDimension.label)} →</th>${matrix.columns.map(column => `<th class="${column.unknown ? "is-unknown" : ""}">${escapeHTML(label(column.label))}</th>`).join("")}</tr></thead><tbody>${matrix.rows.map(row => `<tr><th class="${row.unknown ? "is-unknown" : ""}">${escapeHTML(label(row.label))}</th>${matrix.columns.map(column => {
      const cell = cellMap.get(`${row.id}|${column.id}`), status = coverageCellStatus(cell.scopes);
      const title = `${row.label} × ${column.label}: ${coverageStatusLabel(status)}; ${cell.scopes.map((scope, index) => `${matrix.scopes[index].label} ${scope.numerator}/${scope.denominator}`).join("; ")}`;
      const contributing = [...new Set(cell.scopes.flatMap(scope => scope.contributingIds))];
      const delta = cell.scopes.length === 2 && cell.scopes.every(scope => scope.ratio != null)
        ? `<em>Δ ${Math.round((cell.scopes[1].ratio - cell.scopes[0].ratio) * 100)} pts</em>`
        : "";
      const comparison = cell.scopes.length === 2;
      const values = cell.scopes.map((scope, index) => coverageScopeHTML(scope, comparison ? matrix.scopes[index].label : "")).join("");
      const metadata = comparison ? `<span class="coverage-cell-meta">${delta}<i>${escapeHTML(coverageStatusLabel(status))}</i></span>` : "";
      return `<td><button type="button" class="coverage-cell coverage-cell-${status} ${comparison ? "is-comparison" : ""}" title="${escapeHTML(title)}" aria-label="${escapeHTML(title)}" data-coverage-cell="${escapeHTML(row.id)}|${escapeHTML(column.id)}" data-denominator="${escapeHTML(cell.scopes.map(scope => scope.denominator).join("|"))}" data-document-ids="${escapeHTML(contributing.join(" "))}">${values}${metadata}</button></td>`;
    }).join("")}</tr>`).join("")}</tbody></table></div>`;
  const warning = view.querySelector?.(".coverage-warning");
  if (warning) {
    const syncCaptionHeight = () => view.style.setProperty("--coverage-caption-height", `${warning.getBoundingClientRect().height}px`);
    syncCaptionHeight();
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncCaptionHeight).observe(warning);
  }
  $$('[data-coverage-cell]').forEach(button => button.addEventListener("click", () => {
    const [rowId, columnId] = button.dataset.coverageCell.split("|");
    inspectCoverageCell(matrix.cells.find(cell => cell.row.id === rowId && cell.column.id === columnId), matrix);
  }));
  const cohorts = matrix.scopes.map(scope => `${scope.label}: ${scope.ids.size}`).join(" · ");
  setSummary(`${matrix.rows.length} × ${matrix.columns.length} coverage cells · row-relative denominators · cohort documents ${cohorts}`, "coverage");
}

function craftObservationMatches(observation) {
  if (!sourceMatches(observation.source) || observation.confidence < state.config.minConfidence) return false;
  if (state.config.craftWitnessType !== "all" && observation.witnessType !== state.config.craftWitnessType) return false;
  if (state.config.craftDateFrom && (!observation.date || observation.date < state.config.craftDateFrom)) return false;
  if (state.config.craftDateTo && (!observation.date || observation.date > state.config.craftDateTo)) return false;
  const axes = new Set((observation.measurements || []).map(measurement => measurement.axis));
  if (state.config.craftDimensions === "any" && !axes.size) return false;
  if (state.config.craftDimensions === "both" && !(axes.has("width") && axes.has("height"))) return false;
  if (state.config.craftDimensions === "none" && axes.size) return false;
  const locationQuery = state.config.craftLocation.trim().toLowerCase();
  if (locationQuery) {
    const locations = (observation.entityIds || []).map(id => state.catalog.entities.find(entity => entity.id === id)).filter(entity => entity?.category === "location");
    if (!locations.some(location => location.name.toLowerCase().includes(locationQuery))) return false;
  }
  return true;
}

function craftDimensionAggregate(observations, axis) {
  const measurements = observations.flatMap(observation => (observation.measurements || []).filter(measurement => measurement.axis === axis));
  if (!measurements.length) return null;
  const values = measurements.map(measurement => measurement.normalizedMeters);
  return {
    meanMeters: values.reduce((sum, value) => sum + value, 0) / values.length,
    minMeters: Math.min(...values), maxMeters: Math.max(...values), n: values.length,
    observationCount: observations.filter(observation => observation.measurements?.some(measurement => measurement.axis === axis)).length,
    measurementIds: measurements.map(measurement => measurement.id)
  };
}

function filteredCraftClasses() {
  const observations = (state.catalog.craft?.observations || []).filter(craftObservationMatches);
  return (state.catalog.craft?.classes || []).map(craftClass => {
    const matching = observations.filter(observation => observation.classId === craftClass.classId);
    const matchingById = new Map(matching.map(observation => [observation.id, observation]));
    const sourceCounts = matching.reduce((counts, observation) => counts.set(observation.source, (counts.get(observation.source) || 0) + 1), new Map());
    const dominantSource = [...sourceCounts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || "";
    return {
      ...craftClass,
      observations: matching,
      observationCount: matching.length,
      documentCount: new Set(matching.map(observation => observation.documentId)).size,
      sourceCount: sourceCounts.size,
      dominantSource,
      confidence: matching.length ? matching.reduce((sum, observation) => sum + observation.confidence, 0) / matching.length : 0,
      dimensions: { width: craftDimensionAggregate(matching, "width"), height: craftDimensionAggregate(matching, "height") },
      visualEvidence: (craftClass.visualEvidence || []).map(feature => {
        const contributing = (feature.observationIds || []).map(id => matchingById.get(id)).filter(Boolean);
        return { ...feature, observationCount: contributing.length, documentCount: new Set(contributing.map(item => item.documentId)).size };
      }).filter(feature => feature.observationCount),
      documentIds: [...new Set(matching.map(observation => observation.documentId))],
      evidence: matching.map(observation => ({ documentId: observation.documentId, excerpt: observation.excerpt }))
    };
  }).filter(craftClass => craftClass.observationCount || craftClass.authority);
}

function craftMetricExtent(classes, key) {
  const values = classes.map(item => item[key] || 0);
  return [Math.min(...values, 0), Math.max(...values, 1)];
}

function craftDimensionLabel(axis, summary) {
  const prefix = axis === "width" ? "W" : "H";
  if (!summary) return `${prefix} unavailable · n 0`;
  const precision = summary.meanMeters < 10 ? 1 : 0;
  return `${prefix} ${summary.meanMeters.toFixed(precision)} m · n ${summary.n}`;
}

function craftAuthoritySizeLabel(authority) {
  const size = authority?.sizeMeters;
  if (!size) return "SIZE unknown";
  if (Number.isFinite(size.minimum) && Number.isFinite(size.maximum)) return `SIZE ${size.minimum}–${size.maximum} m`;
  if (Number.isFinite(size.head)) return `HEAD ${size.head} m · TAIL ${size.appendageMinimum}–${size.appendageMaximum} m`;
  return "SIZE unknown";
}


function documentCooccurrenceRelationships(classes, neighbors = 1) {
  const candidates = [];
  for (let leftIndex = 0; leftIndex < classes.length; leftIndex += 1) {
    const left = classes[leftIndex];
    const leftDocuments = new Set(left.documentIds || []);
    if (!leftDocuments.size) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < classes.length; rightIndex += 1) {
      const right = classes[rightIndex];
      const sharedDocumentIds = (right.documentIds || []).filter(documentId => leftDocuments.has(documentId));
      if (!sharedDocumentIds.length) continue;
      candidates.push({
        key: [left.classId, right.classId].sort().join("|"),
        source: left.classId,
        target: right.classId,
        sourceName: left.name,
        targetName: right.name,
        sharedDocumentIds,
        documentCount: sharedDocumentIds.length
      });
    }
  }
  const selected = new Map();
  classes.forEach(craftClass => {
    candidates
      .filter(candidate => candidate.source === craftClass.classId || candidate.target === craftClass.classId)
      .sort((left, right) => right.documentCount - left.documentCount || left.key.localeCompare(right.key))
      .slice(0, neighbors)
      .forEach(candidate => selected.set(candidate.key, candidate));
  });
  return [...selected.values()].sort((left, right) => right.documentCount - left.documentCount || left.key.localeCompare(right.key));
}


function craftRadialLayout(count, width, availableHeight = 720) {
  const height = Math.max(440, availableHeight);
  if (width < 760) {
    const columns = 3;
    const rows = Math.ceil(count / columns);
    const horizontalStep = width / columns;
    const verticalStep = height / rows;
    return {
      height,
      positions: Array.from({ length: count }, (_, index) => ({
        x: horizontalStep * (index % columns + .5),
        y: verticalStep * (Math.floor(index / columns) + .42)
      }))
    };
  }
  const center = { x: width / 2, y: height / 2 };
  const positions = [center];
  const innerCount = Math.min(6, count - 1);
  for (let index = 0; index < innerCount; index += 1) {
    const angle = -Math.PI / 2 + index / innerCount * Math.PI * 2;
    positions.push({ x: center.x + Math.cos(angle) * width * .27, y: center.y + Math.sin(angle) * height * .23 });
  }
  const outerCount = count - positions.length;
  for (let index = 0; index < outerCount; index += 1) {
    const angle = -Math.PI / 2 + index / outerCount * Math.PI * 2 + Math.PI / Math.max(outerCount, 1);
    positions.push({ x: center.x + Math.cos(angle) * width * .42, y: center.y + Math.sin(angle) * height * .35 });
  }
  return { height, positions };
}

function centerCraftPositions(positions, radii, width, height, narrow = false) {
  if (!positions.length) return positions;
  const labelHalfWidth = narrow ? 48 : 72;
  const labelDepth = narrow ? 34 : 48;
  const bounds = positions.reduce((result, position, index) => {
    const radius = radii[index] || 0;
    result.left = Math.min(result.left, position.x - Math.max(radius, labelHalfWidth));
    result.right = Math.max(result.right, position.x + Math.max(radius, labelHalfWidth));
    result.top = Math.min(result.top, position.y - radius);
    result.bottom = Math.max(result.bottom, position.y + radius + labelDepth);
    return result;
  }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const offsetX = width / 2 - (bounds.left + bounds.right) / 2;
  const offsetY = height / 2 - (bounds.top + bounds.bottom) / 2;
  return positions.map(position => ({ x: position.x + offsetX, y: position.y + offsetY }));
}

function renderCraft() {
  const { svg } = clearChart();
  const classes = filteredCraftClasses().sort((left, right) =>
    (right[state.config.craftSize] || 0) - (left[state.config.craftSize] || 0) ||
    right.observationCount - left.observationCount || left.name.localeCompare(right.name)
  );
  if (!classes.length) return showEmpty();
  const width = Math.max(360, svg.getBoundingClientRect().width);
  const availableHeight = Math.max(440, svg.getBoundingClientRect().height || $("#chartWrap").clientHeight || 440);
  const layout = craftRadialLayout(classes.length, width, availableHeight);
  svg.setAttribute("viewBox", `0 0 ${width} ${layout.height}`);
  svg.style.setProperty("height", `${layout.height}px`);
  $("#chartWrap").classList.add("craft-mode");
  const sizeExtent = craftMetricExtent(classes, state.config.craftSize);
  const radii = new Map(classes.map(craftClass => [craftClass.classId, scale(craftClass[state.config.craftSize] || 0, sizeExtent, width < 760 ? [5, 14] : [7, 30])]));
  layout.positions = centerCraftPositions(layout.positions, classes.map(craftClass => radii.get(craftClass.classId)), width, layout.height, width < 760);
  const positionByClassId = new Map(classes.map((craftClass, index) => [craftClass.classId, layout.positions[index]]));
  const relationships = documentCooccurrenceRelationships(classes);
  if (relationships.length) {
    const relationshipLayer = el("g", { class: "craft-relationship-layer", "aria-hidden": "true" });
    relationships.forEach(relationship => {
      const source = positionByClassId.get(relationship.source), target = positionByClassId.get(relationship.target);
      const line = el("line", {
        x1: source.x, y1: source.y, x2: target.x, y2: target.y,
        class: "craft-relationship-line",
        "stroke-width": Math.min(2.4, .7 + Math.sqrt(relationship.documentCount) * .18),
        "data-shared-documents": relationship.documentCount
      });
      addTitle(line, `${relationship.sourceName} and ${relationship.targetName} appear together in ${relationship.documentCount} source document${relationship.documentCount === 1 ? "" : "s"}`);
      relationshipLayer.append(line);
    });
    svg.append(relationshipLayer);
  }
  classes.forEach((craftClass, index) => {
    const { x: centerX, y: centerY } = layout.positions[index];
    const radius = radii.get(craftClass.classId);
    const shade = scale(craftClass[state.config.craftSize] || 0, sizeExtent, [.18, .96]);
    const group = el("g", { class: "craft-node mark", tabindex: "0", role: "button", "aria-label": `Inspect ${craftClass.name}`, "data-node-radius": radius.toFixed(2) });
    group.append(el("circle", { cx: centerX, cy: centerY, r: radius + 10, fill: "transparent", stroke: "transparent", class: "craft-hitbox" }));
    group.append(el("circle", { cx: centerX, cy: centerY, r: radius, fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": 1, class: "craft-node-circle" }));
    const displayName = craftClass.name.toUpperCase();
    const labelOffset = width < 760 ? 15 : 22;
    group.append(el("text", { x: centerX, y: centerY + radius + labelOffset, fill: "#111", "text-anchor": "middle", class: "craft-class-label" }, displayName));
    const metricLine = `${craftClass.documentCount} docs · ${craftClass.observationCount} obs`;
    group.append(el("text", { x: centerX, y: centerY + radius + (width < 760 ? 27 : 38), fill: "#111", "text-anchor": "middle", class: "craft-metric-label" }, metricLine));
    addTitle(group, `${craftClass.name}: ${craftClass.observationCount} observations in ${craftClass.documentCount} documents`);
    group.addEventListener("click", () => inspectCraft(craftClass));
    group.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) inspectCraft(craftClass); });
    svg.append(group);
  });
  const sizeLabel = { documentCount: "Independent documents", observationCount: "Classified observations", sourceCount: "Collections" }[state.config.craftSize];
  $("#legend").innerHTML = `<span class="legend-item"><i class="craft-size-key"></i>Node size + shade: ${escapeHTML(sizeLabel)}</span>${relationships.length ? `<span class="legend-item"><i class="craft-relationship-key"></i>Shared source documents</span>` : ""}`;
  const corpusClasses = classes.filter(item => item.observationCount).length;
  const authorityClasses = classes.filter(item => item.authority).length;
  setSummary(`${classes.length} profiles · ${corpusClasses} corpus-backed classes · ${authorityClasses} externally documented reference profiles · ${classes.reduce((sum, item) => sum + item.observationCount, 0)} classified observations · taxonomy v${state.catalog.craft.taxonomyVersion}`, "craft");
}

function speciesObservationMatches(observation) {
  return sourceMatches(observation.source) && observation.confidence >= state.config.minConfidence;
}

function filteredSpeciesClasses() {
  const observations = (state.catalog.species?.observations || []).filter(speciesObservationMatches);
  const query = state.config.speciesSearch.trim().toLowerCase();
  return (state.catalog.species?.classes || []).map(speciesClass => {
    const matching = observations.filter(observation => observation.classId === speciesClass.classId);
    const sourceCounts = new Set(matching.map(observation => observation.source));
    const matchingObservationIds = new Set(matching.map(observation => observation.id));
    const appearanceEvidence = (speciesClass.appearanceEvidence || []).filter(evidence =>
      sourceMatches(evidence.source) && (!evidence.observationId || matchingObservationIds.has(evidence.observationId))
    );
    return {
      ...speciesPresentation(speciesClass),
      observations: matching,
      observationCount: matching.length,
      documentCount: new Set(matching.map(observation => observation.documentId)).size,
      sourceCount: sourceCounts.size,
      confidence: matching.length ? matching.reduce((sum, observation) => sum + observation.confidence, 0) / matching.length : 0,
      documentIds: [...new Set(matching.map(observation => observation.documentId))],
      evidence: matching.map(observation => ({ documentId: observation.documentId, excerpt: observation.excerpt })),
      appearanceEvidence,
      appearanceEvidenceCount: appearanceEvidence.length
    };
  }).filter(speciesClass => speciesClass.observationCount
    && (state.config.speciesCategory === "all" || speciesClass.category === state.config.speciesCategory)
    && (!query || speciesClass.name.toLowerCase().includes(query)
      || speciesClass.classId === "rigelians" && "rigelians".includes(query)));
}

function speciesOrganicLayout(classes, relationships, width, availableHeight = 620, visualWeights = new Map()) {
  const narrow = width < 760;
  const height = Math.max(narrow ? 340 : 540, availableHeight);
  const center = { x: width / 2, y: height / 2 };
  const labelHalfWidth = narrow ? 70 : 86;
  const topPadding = narrow ? 25 : 34;
  const bottomPadding = narrow ? 60 : 60;
  const usableWidth = Math.max(1, width - labelHalfWidth * 2);
  const usableHeight = Math.max(1, height - topPadding - bottomPadding);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const positions = narrow ? (() => {
    const columns = Math.min(3, classes.length);
    const rows = Math.ceil(classes.length / columns);
    const slots = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns && slots.length < classes.length; column += 1) {
        const x = columns === 1 ? center.x : labelHalfWidth + column / (columns - 1) * usableWidth;
        const y = rows === 1 ? center.y : topPadding + row / (rows - 1) * usableHeight;
        slots.push({
          x: Math.max(labelHalfWidth, Math.min(width - labelHalfWidth, x + (row % 2 ? 4 : -4) * (column - 1))),
          y: Math.max(topPadding, Math.min(height - bottomPadding, y + (column - 1) * 3))
        });
      }
    }
    return slots.sort((left, right) =>
      Math.hypot(left.x - center.x, left.y - center.y) - Math.hypot(right.x - center.x, right.y - center.y)
      || Math.atan2(left.y - center.y, left.x - center.x) - Math.atan2(right.y - center.y, right.x - center.x)
    );
  })() : classes.map((speciesClass, index) => {
    const radius = index ? Math.sqrt(index / Math.max(1, classes.length - 1)) : 0;
    const angle = index * goldenAngle - Math.PI / 2;
    return {
      x: center.x + Math.cos(angle) * usableWidth * .46 * radius,
      y: center.y + Math.sin(angle) * usableHeight * .46 * radius
    };
  });
  if (narrow) return { height, positions: new Map(classes.map((speciesClass, index) => [speciesClass.classId, positions[index]])) };
  const classIndex = new Map(classes.map((speciesClass, index) => [speciesClass.classId, index]));
  const linkedPairs = relationships.map(relationship => ({
    source: classIndex.get(relationship.source),
    target: classIndex.get(relationship.target),
    strength: Math.min(2, 1 + Math.log2(relationship.documentCount || 1) * .18)
  })).filter(pair => pair.source !== undefined && pair.target !== undefined);
  const minimumX = narrow ? 106 : 152;
  const minimumY = narrow ? 54 : 86;
  const targetLinkDistance = narrow ? 118 : 220;
  const clampPositions = () => positions.forEach(position => {
    position.x = Math.max(labelHalfWidth, Math.min(width - labelHalfWidth, position.x));
    position.y = Math.max(topPadding, Math.min(height - bottomPadding, position.y));
  });

  for (let iteration = 0; iteration < 160; iteration += 1) {
    const cooling = 1 - iteration / 160;
    linkedPairs.forEach(pair => {
      const source = positions[pair.source], target = positions[pair.target];
      const dx = target.x - source.x, dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const pull = (distance - targetLinkDistance) * .006 * pair.strength * (.35 + cooling);
      source.x += dx / distance * pull;
      source.y += dy / distance * pull;
      target.x -= dx / distance * pull;
      target.y -= dy / distance * pull;
    });
    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        let dx = positions[right].x - positions[left].x;
        let dy = positions[right].y - positions[left].y;
        if (Math.abs(dx) >= minimumX || Math.abs(dy) >= minimumY) continue;
        if (!dx && !dy) {
          const angle = (left + right + 1) * goldenAngle;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
        }
        if (narrow) {
          const overlapX = minimumX - Math.abs(dx);
          const overlapY = minimumY - Math.abs(dy);
          if (overlapX / minimumX < overlapY / minimumY) {
            const direction = Math.sign(dx) || 1;
            const push = overlapX * .52;
            positions[left].x -= direction * push;
            positions[right].x += direction * push;
          } else {
            const direction = Math.sign(dy) || 1;
            const push = overlapY * .52;
            positions[left].y -= direction * push;
            positions[right].y += direction * push;
          }
          continue;
        }
        const distance = Math.max(.001, Math.hypot(dx / minimumX, dy / minimumY));
        if (distance >= 1) continue;
        const push = (1 - distance) * 8 * (.45 + cooling);
        const directionX = dx / minimumX / distance;
        const directionY = dy / minimumY / distance;
        positions[left].x -= directionX * push;
        positions[left].y -= directionY * push;
        positions[right].x += directionX * push;
        positions[right].y += directionY * push;
      }
    }
    positions.forEach(position => {
      position.x += (center.x - position.x) * (narrow ? .0018 : .0008);
      position.y += (center.y - position.y) * (narrow ? .0018 : .0008);
    });
    clampPositions();
  }
  const weightedCenter = () => {
    const total = classes.reduce((sum, speciesClass) => sum + (visualWeights.get(speciesClass.classId) || 1), 0);
    return positions.reduce((result, position, index) => {
      const weight = visualWeights.get(classes[index].classId) || 1;
      result.x += position.x * weight / total;
      result.y += position.y * weight / total;
      return result;
    }, { x: 0, y: 0 });
  };
  const bounds = positions.reduce((result, position) => ({
    left: Math.min(result.left, position.x),
    right: Math.max(result.right, position.x),
    top: Math.min(result.top, position.y),
    bottom: Math.max(result.bottom, position.y)
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const visualCenter = weightedCenter();
  const scaleX = Math.max(1, usableWidth * .86 / Math.max(1, bounds.right - bounds.left));
  const scaleY = Math.max(1, usableHeight * .82 / Math.max(1, bounds.bottom - bounds.top));
  positions.forEach(position => {
    position.x = visualCenter.x + (position.x - visualCenter.x) * scaleX;
    position.y = visualCenter.y + (position.y - visualCenter.y) * scaleY;
  });
  clampPositions();
  const fittedCenter = weightedCenter();
  const fittedBounds = positions.reduce((result, position) => ({
    left: Math.min(result.left, position.x),
    right: Math.max(result.right, position.x),
    top: Math.min(result.top, position.y),
    bottom: Math.max(result.bottom, position.y)
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const offsetX = Math.max(labelHalfWidth - fittedBounds.left, Math.min(width - labelHalfWidth - fittedBounds.right, center.x - fittedCenter.x));
  const offsetY = Math.max(topPadding - fittedBounds.top, Math.min(height - bottomPadding - fittedBounds.bottom, center.y - fittedCenter.y));
  positions.forEach(position => {
    position.x += offsetX;
    position.y += offsetY;
  });
  return { height, positions: new Map(classes.map((speciesClass, index) => [speciesClass.classId, positions[index]])) };
}

function compactSpeciesName(name, limit = 24) {
  return name.length <= limit ? name : `${name.slice(0, limit - 1).trim()}…`;
}

function speciesLineupName(name) {
  if (name.startsWith("EBEs")) return "EBEs";
  return name.replace(/^The /, "").replace(/ \([^)]*\)$/, "");
}

function speciesSupportsBespokeFigure(speciesClass) {
  const descriptors = (speciesClass.appearanceEvidence || [])
    .flatMap(evidence => evidence.descriptors || [])
    .map(descriptor => descriptor.trim().toLowerCase());
  const categoryOnlyDescriptors = new Set(["human", "humanlike", "reptilian", "insectoid"]);
  const hasCorpusSupport = descriptors.some(descriptor => descriptor && !categoryOnlyDescriptors.has(descriptor));
  const allowsReferenceFigure = Boolean(speciesClass.illustrationDescriptors?.length && SPECIES_LINEUP_ASSETS.has(speciesClass.classId));
  return hasCorpusSupport || allowsReferenceFigure;
}

function speciesLineupNameLines(name, limit = 15) {
  const compact = speciesLineupName(name);
  if (compact.length <= limit) return [compact];
  const words = compact.split(/\s+/);
  let first = "";
  while (words.length && `${first}${first ? " " : ""}${words[0]}`.length <= limit) {
    first += `${first ? " " : ""}${words.shift()}`;
  }
  if (!first) first = words.shift();
  const second = compactSpeciesName(words.join(" "), limit);
  return second ? [first, second] : [compactSpeciesName(first, limit)];
}

function speciesLineupImageFrame(position, classId, baseline) {
  const bounds = SPECIES_LINEUP_INK_BOUNDS.get(classId) || { top: 0, bottom: SPECIES_LINEUP_CANVAS_HEIGHT };
  const inkHeight = Math.max(1, bounds.bottom - bounds.top);
  const height = position.displayHeight * SPECIES_LINEUP_CANVAS_HEIGHT / inkHeight;
  const width = height * 2 / 3;
  return {
    x: position.x - width / 2,
    y: baseline - bounds.bottom / SPECIES_LINEUP_CANVAS_HEIGHT * height,
    width,
    height
  };
}

function speciesLineupAsset(classId, usesGenericFigure, metric) {
  if (metric === "physicalHeight") {
    const displayAsset = (usesGenericFigure ? SPECIES_LINEUP_GENERIC_DISPLAY_ASSETS : SPECIES_LINEUP_DISPLAY_ASSETS).get(classId);
    if (displayAsset) return displayAsset;
  }
  return usesGenericFigure ? SPECIES_LINEUP_GENERIC_ASSET : SPECIES_LINEUP_ASSETS.get(classId);
}

function speciesLineupLayout(classes, width, availableHeight = 560, metric = "physicalHeight", spacing = 0) {
  const narrow = width < 760;
  const height = Math.max(narrow ? 440 : 520, availableHeight);
  const top = narrow ? 28 : 34;
  const bottom = narrow ? 104 : 110;
  const baseline = height - bottom;
  const plotHeight = baseline - top;
  const itemWidth = (narrow ? 92 : 104) + Math.min(160, Math.max(-80, Number(spacing) || 0));
  const sidePadding = narrow ? 46 : 56;
  const canvasWidth = Math.max(width, sidePadding * 2 + itemWidth * classes.length);
  const maxObservations = Math.max(1, ...classes.map(item => item.observationCount || 0));
  const minimumFigureHeight = narrow ? 76 : 86;
  const positions = new Map(classes.map((speciesClass, index) => {
    const reportedHeight = speciesClass.physicalHeight?.representativeFeet;
    const isScaled = metric !== "physicalHeight" || Number.isFinite(reportedHeight);
    const displayHeight = metric === "physicalHeight"
      ? isScaled
        ? Math.max(minimumFigureHeight, Math.min(plotHeight, reportedHeight / SPECIES_LINEUP_HEIGHT_CEILING_FEET * plotHeight))
        : Math.max(minimumFigureHeight, plotHeight * SPECIES_LINEUP_UNSTATED_HEIGHT_FEET / SPECIES_LINEUP_HEIGHT_CEILING_FEET)
      : Math.max(minimumFigureHeight, Math.sqrt((speciesClass.observationCount || 0) / maxObservations) * plotHeight);
    return [speciesClass.classId, {
      x: sidePadding + itemWidth * (index + .5),
      displayHeight,
      isScaled
    }];
  }));
  return { height, canvasWidth, top, baseline, plotHeight, itemWidth, sidePadding, maxObservations, positions };
}

function signalFrequencyLabel(hertz) {
  const units = [[1e9, "GHz"], [1e6, "MHz"], [1e3, "kHz"]];
  const unit = units.find(([threshold]) => hertz >= threshold);
  if (!unit) return `${formatNumber(hertz)} Hz`;
  const value = hertz / unit[0];
  return `${Number(value.toPrecision(4))} ${unit[1]}`;
}

function signalBandDefinitions() {
  return [
    [3, 3e3, "ELF"], [3e3, 3e4, "VLF"], [3e4, 3e5, "LF"], [3e5, 3e6, "MF"],
    [3e6, 3e7, "HF"], [3e7, 3e8, "VHF"], [3e8, 1e9, "UHF"], [1e9, 2e9, "L"],
    [2e9, 4e9, "S"], [4e9, 8e9, "C"], [8e9, 12e9, "X"], [12e9, 18e9, "Ku"],
    [18e9, 27e9, "K"], [27e9, 40e9, "Ka"], [40e9, 3e11, "mmWave"]
  ];
}

function filteredSignalFrequencies() {
  const observations = (state.catalog.signals?.observations || []).filter(item => sourceMatches(item.source));
  const grouped = new Map();
  observations.forEach(observation => {
    const key = String(observation.frequencyHz);
    const item = grouped.get(key) || {
      id: `signal-frequency-${key}`, frequencyHz: observation.frequencyHz,
      frequencyLabel: observation.frequencyLabel || signalFrequencyLabel(observation.frequencyHz),
      observations: [], documentIds: new Set(), sources: new Set(), entityIds: new Set(), eventIds: new Set()
    };
    item.observations.push(observation);
    item.documentIds.add(observation.documentId);
    item.sources.add(observation.source);
    (observation.entityIds || []).forEach(id => item.entityIds.add(id));
    (observation.eventIds || []).forEach(id => item.eventIds.add(id));
    grouped.set(key, item);
  });
  return [...grouped.values()].map(item => ({
    ...item,
    mentionCount: item.observations.length,
    documentCount: item.documentIds.size,
    sourceCount: item.sources.size,
    documentIds: [...item.documentIds], sources: [...item.sources],
    entityIds: [...item.entityIds], eventIds: [...item.eventIds]
  })).sort((left, right) => left.frequencyHz - right.frequencyHz);
}

function renderSignals() {
  clearChart();
  const items = filteredSignalFrequencies();
  if (!items.length) return showEmpty();
  const svg = $("#chart"), { width, height } = dimensions();
  const margin = { top: 42, right: 28, bottom: 66, left: 56 };
  const baseline = height - margin.bottom;
  const extent = [Math.max(1, Math.min(...items.map(item => item.frequencyHz))), Math.max(...items.map(item => item.frequencyHz))];
  if (extent[0] === extent[1]) { extent[0] /= 1.5; extent[1] *= 1.5; }
  const logExtent = extent.map(Math.log10);
  const x = value => scale(Math.log10(value), logExtent, [margin.left, width - margin.right]);
  const maximum = Math.max(...items.map(item => item.mentionCount), 1);
  const y = value => baseline - value / maximum * (baseline - margin.top - 22);
  const mentionExtent = valueExtent(items, "mentionCount");
  const bands = el("g", { class: "signal-bands" });
  signalBandDefinitions().forEach(([start, end, name], index) => {
    const visibleStart = Math.max(start, extent[0]), visibleEnd = Math.min(end, extent[1]);
    if (visibleStart >= visibleEnd) return;
    const left = x(visibleStart), right = x(visibleEnd);
    bands.append(el("rect", { x: left, y: margin.top, width: Math.max(0, right - left), height: baseline - margin.top, class: `signal-band signal-band-${index % 2}` }));
    if (right - left > 24) bands.append(el("text", { x: (left + right) / 2, y: margin.top + 13, "text-anchor": "middle", class: "signal-band-label" }, name));
  });
  svg.append(bands);
  const grid = el("g", { class: "signal-grid" });
  [0, .25, .5, .75, 1].forEach(fraction => {
    const value = Math.round(maximum * fraction), py = y(value);
    grid.append(el("line", { x1: margin.left, y1: py, x2: width - margin.right, y2: py, class: "signal-grid-line" }));
    grid.append(el("text", { x: margin.left - 9, y: py + 4, "text-anchor": "end", class: "axis-label" }, formatNumber(value)));
  });
  const decades = [];
  for (let power = Math.floor(logExtent[0]); power <= Math.ceil(logExtent[1]); power += 1) {
    const value = 10 ** power;
    if (value >= extent[0] && value <= extent[1]) decades.push(value);
  }
  const frequencyTicks = [...new Set([extent[0], ...decades, extent[1]])];
  const visibleFrequencyTicks = width >= 700 ? [...frequencyTicks] : [];
  if (width < 700) frequencyTicks.forEach((value, index) => {
    const isLast = index === frequencyTicks.length - 1;
    if (!visibleFrequencyTicks.length || x(value) - x(visibleFrequencyTicks.at(-1)) >= 48) visibleFrequencyTicks.push(value);
    if (isLast && visibleFrequencyTicks.at(-1) !== value) {
      if (x(value) - x(visibleFrequencyTicks.at(-1)) < 48) visibleFrequencyTicks.pop();
      visibleFrequencyTicks.push(value);
    }
  });
  visibleFrequencyTicks.forEach(value => {
    const px = x(value);
    grid.append(el("line", { x1: px, y1: margin.top, x2: px, y2: baseline, class: "signal-frequency-grid-line" }));
    grid.append(el("text", { x: px, y: baseline + 22, "text-anchor": "middle", class: "axis-label" }, signalFrequencyLabel(value)));
  });
  grid.append(el("line", { x1: margin.left, y1: baseline, x2: width - margin.right, y2: baseline, class: "signal-baseline" }));
  grid.append(el("text", { x: 14, y: (margin.top + baseline) / 2, transform: `rotate(-90 14 ${(margin.top + baseline) / 2})`, "text-anchor": "middle", class: "axis-label" }, "MENTIONS"));
  grid.append(el("text", { x: (margin.left + width - margin.right) / 2, y: height - 15, "text-anchor": "middle", class: "axis-label" }, "RADIO FREQUENCY · LOG SCALE"));
  svg.append(grid);

  const peakLayer = el("g", { class: "signal-peaks" });
  const rankedLabels = [...items].sort((a, b) => b.mentionCount - a.mentionCount || b.documentCount - a.documentCount);
  const strongest1600 = items.find(item => item.frequencyHz === 1_600_000_000);
  if (strongest1600) {
    rankedLabels.splice(rankedLabels.indexOf(strongest1600), 1);
    rankedLabels.unshift(strongest1600);
  }
  const labelPlacements = new Map(), labelsByTier = [[], [], []];
  const labelSize = Math.max(10, Number(state.config.labelSize) || 12);
  rankedLabels.slice(0, width < 700 ? 4 : 16).forEach(item => {
    const px = x(item.frequencyHz), halfWidth = item.frequencyLabel.length * labelSize * .3 + 4;
    const tier = labelsByTier.findIndex(placements => placements.every(label => Math.abs(px - label.px) >= halfWidth + label.halfWidth + 8));
    if (tier < 0) return;
    labelsByTier[tier].push({ px, halfWidth });
    labelPlacements.set(item.id, tier);
  });
  items.forEach(item => {
    const px = x(item.frequencyHz), py = y(item.mentionCount);
    const group = el("g", { class: "signal-peak", tabindex: "0", role: "button", "aria-label": `${item.frequencyLabel}: ${item.mentionCount} mentions across ${item.documentCount} documents` });
    group.append(el("path", { d: `M${Math.max(margin.left, px - 5)} ${baseline} L${px} ${py} L${Math.min(width - margin.right, px + 5)} ${baseline} Z`, class: "signal-peak-fill" }));
    group.append(el("line", { x1: px, y1: baseline, x2: px, y2: py, class: "signal-peak-line" }));
    group.append(el("circle", {
      cx: px, cy: py, r: Math.max(4, Math.min(10, 3 + Math.sqrt(item.mentionCount))),
      fill: "#111", "fill-opacity": scale(item.mentionCount, mentionExtent, [.18, .96]),
      "data-mentions": item.mentionCount, class: "signal-peak-node"
    }));
    addTitle(group, `${item.frequencyLabel} · ${item.mentionCount} mentions · ${item.documentCount} documents · ${item.sourceCount} collections`);
    if (labelPlacements.has(item.id)) {
      const tier = labelPlacements.get(item.id);
      group.append(el("line", { x1: px, y1: py - 6, x2: px, y2: py - 18 - tier * 13, class: "signal-label-leader" }));
      group.append(el("text", { x: px, y: py - 22 - tier * 13, "text-anchor": "middle", class: "signal-peak-label" }, item.frequencyLabel));
    }
    group.addEventListener("click", () => inspectSignalFrequency(item));
    group.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) inspectSignalFrequency(item); });
    peakLayer.append(group);
  });
  svg.append(peakLayer);
  $("#legend").innerHTML = `<span class="legend-item"><i class="signal-mention-key"></i>Node size + shade: mentions</span><span class="legend-item"><i class="signal-peak-key"></i>Peak height: mentions</span><span class="legend-item"><i class="signal-band-key"></i>Radio band</span>`;
  setSummary(`${items.length} normalized frequencies · ${items.reduce((sum, item) => sum + item.mentionCount, 0)} mentions · ${new Set(items.flatMap(item => item.documentIds)).size} documents`, "signals");
}

function renderSpeciesLineup() {
  const { svg } = clearChart();
  const metric = state.config.speciesY === "observationCount" ? "observationCount" : "physicalHeight";
  const query = state.config.speciesSearch.trim().toLowerCase();
  const corpusClasses = filteredSpeciesClasses();
  const referenceProfiles = SPECIES_LINEUP_REFERENCE_PROFILES.filter(profile =>
    !corpusClasses.some(speciesClass => speciesClass.classId === profile.classId)
    &&
    (state.config.speciesCategory === "all" || profile.category === state.config.speciesCategory)
    && (!query || profile.name.toLowerCase().includes(query))
  );
  const classes = [...corpusClasses, ...referenceProfiles].sort((left, right) =>
    right.observationCount - left.observationCount || left.name.localeCompare(right.name)
  );
  if (!classes.length) return showEmpty();
  const width = Math.max(360, svg.getBoundingClientRect().width);
  const minimumHeight = width < 760 ? 440 : 520;
  const measuredHeight = svg.getBoundingClientRect().height || $("#chartWrap").clientHeight;
  const layout = speciesLineupLayout(classes, width, Math.max(minimumHeight, measuredHeight || minimumHeight), metric, state.config.speciesSpacing);
  svg.setAttribute("viewBox", `0 0 ${layout.canvasWidth} ${layout.height}`);
  svg.style.setProperty("width", `${layout.canvasWidth}px`);
  svg.style.setProperty("height", `${layout.height}px`);
  $("#chartWrap").classList.add("species-mode", "species-lineup-mode");

  const defs = el("defs");
  const backgroundFilter = el("filter", {
    id: "species-lineup-character-background",
    x: "-10%",
    y: "-10%",
    width: "120%",
    height: "120%",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB"
  });
  backgroundFilter.append(
    el("feFlood", { class: "species-lineup-background-color", result: "speciesLineupBackgroundColor" }),
    el("feComposite", { in: "speciesLineupBackgroundColor", in2: "SourceAlpha", operator: "in" })
  );
  defs.append(backgroundFilter);
  svg.append(defs);

  const wall = el("g", { class: "species-lineup-wall", "aria-hidden": "true" });
  const ticks = metric === "physicalHeight"
    ? [2, 4, 6, 8, 10, 12].map(value => ({ value, label: `${value}′`, y: layout.baseline - value / SPECIES_LINEUP_HEIGHT_CEILING_FEET * layout.plotHeight }))
    : [...new Set([0, .25, .5, .75, 1].map(fraction => Math.round(layout.maxObservations * fraction)))].map(value => ({
      value,
      label: String(value),
      y: layout.baseline - Math.sqrt(value / layout.maxObservations) * layout.plotHeight
    }));
  ticks.forEach(tick => {
    wall.append(el("line", { x1: 0, y1: tick.y, x2: layout.canvasWidth, y2: tick.y, class: "species-lineup-rule" }));
    wall.append(el("text", { x: 10, y: tick.y - 5, class: "species-lineup-tick" }, tick.label));
  });
  wall.append(el("line", { x1: 0, y1: layout.baseline, x2: layout.canvasWidth, y2: layout.baseline, class: "species-lineup-baseline" }));
  if (layout.canvasWidth > width) {
    wall.append(el("text", { x: width - 12, y: layout.top + 10, "text-anchor": "end", class: "species-lineup-scroll-hint" }, `${classes.length} PROFILE ROSTER →`));
  }
  svg.append(wall);

  const mentionRank = new Map(classes.map((speciesClass, index) => [speciesClass.classId, index]));
  const paintOrder = [...classes].sort((left, right) =>
    layout.positions.get(right.classId).displayHeight - layout.positions.get(left.classId).displayHeight
    || mentionRank.get(left.classId) - mentionRank.get(right.classId)
  );
  paintOrder.forEach(speciesClass => {
    const index = mentionRank.get(speciesClass.classId);
    const position = layout.positions.get(speciesClass.classId);
    const supportsBespokeFigure = speciesSupportsBespokeFigure(speciesClass);
    const specificAsset = SPECIES_LINEUP_ASSETS.get(speciesClass.classId);
    const usesGenericFigure = !supportsBespokeFigure || !specificAsset;
    const asset = speciesLineupAsset(speciesClass.classId, usesGenericFigure, metric);
    const silhouette = SPECIES_LINEUP_NO_BACKGROUND.has(speciesClass.classId)
      ? null
      : usesGenericFigure
      ? SPECIES_LINEUP_GENERIC_SILHOUETTE
      : SPECIES_LINEUP_SILHOUETTES.get(speciesClass.classId);
    const metricText = metric === "physicalHeight"
      ? speciesClass.physicalHeight?.label || "height unstated"
      : `${speciesClass.observationCount} obs`;
    const mentionText = speciesClass.groundingType === "reference" && !speciesClass.observationCount
      ? "reference profile"
      : `${speciesClass.observationCount} ${speciesClass.observationCount === 1 ? "mention" : "mentions"}`;
    const group = el("g", {
      class: `species-lineup-character mark${position.isScaled ? "" : " is-unscaled"}${usesGenericFigure ? " uses-generic-figure" : ""}`,
      tabindex: "0",
      role: "button",
      "aria-label": `Inspect ${speciesClass.name}; ${metricText}`,
      "data-category": speciesClass.category,
      "data-class-id": speciesClass.classId,
      "data-mention-rank": String(index + 1),
      "data-observation-count": String(speciesClass.observationCount),
      "data-display-height": position.displayHeight.toFixed(2),
      "data-scaled": String(position.isScaled),
      "data-appearance-evidence-count": String(speciesClass.appearanceEvidenceCount || 0),
      "data-figure-kind": usesGenericFigure ? "generic-figure" : "reference-grounded"
    });
    const imageFrame = speciesLineupImageFrame(
      position,
      usesGenericFigure ? "generic_figure" : speciesClass.classId,
      layout.baseline
    );
    if (silhouette) {
      group.append(el("image", {
        href: silhouette,
        x: imageFrame.x,
        y: imageFrame.y,
        width: imageFrame.width,
        height: imageFrame.height,
        preserveAspectRatio: "xMidYMax meet",
        filter: "url(#species-lineup-character-background)",
        class: `species-lineup-figure-background${speciesClass.classId === "orb_light_beings" ? " is-translucent" : ""}`,
        "aria-hidden": "true"
      }));
    }
    group.append(el("rect", {
      x: position.x - layout.itemWidth / 2 + 4,
      y: Math.max(layout.top, layout.baseline - position.displayHeight - 8),
      width: layout.itemWidth - 8,
      height: layout.baseline - Math.max(layout.top, layout.baseline - position.displayHeight - 8) + 68,
      rx: 3,
      class: "species-lineup-focus"
    }));
    if (asset) {
      group.append(el("image", {
        href: asset,
        x: imageFrame.x,
        y: imageFrame.y,
        width: imageFrame.width,
        height: imageFrame.height,
        preserveAspectRatio: "xMidYMax meet",
        class: "species-lineup-figure"
      }));
    } else {
      group.append(el("rect", { x: position.x - 23, y: layout.baseline - 88, width: 46, height: 88, class: "species-lineup-missing" }));
      group.append(el("text", { x: position.x, y: layout.baseline - 42, "text-anchor": "middle", class: "species-lineup-missing-label" }, "NO ART"));
    }
    const name = el("text", { x: position.x, y: layout.baseline + 17, "text-anchor": "middle", class: "species-lineup-name" });
    speciesLineupNameLines(speciesClass.name).forEach((line, lineIndex) => name.append(el("tspan", { x: position.x, dy: lineIndex ? 12 : 0 }, line.toUpperCase())));
    group.append(name);
    if (metric === "physicalHeight") {
      group.append(el("text", { x: position.x, y: layout.baseline + 49, "text-anchor": "middle", class: "species-lineup-height-label" }, metricText.toUpperCase()));
    }
    group.append(el("text", { x: position.x, y: layout.baseline + (metric === "physicalHeight" ? 63 : 49), "text-anchor": "middle", class: "species-lineup-metric" }, mentionText.toUpperCase()));
    addTitle(group, speciesClass.groundingType === "reference" && !speciesClass.observationCount
      ? `${speciesClass.name}: ${metricText}; reference profile, not a corpus observation`
      : `${speciesClass.name}: ${metricText}; ${speciesClass.observationCount} name observations across ${speciesClass.documentCount} documents in the filtered corpus`);
    group.addEventListener("click", () => inspectSpecies(speciesClass));
    group.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) inspectSpecies(speciesClass); });
    svg.append(group);
  });

  const scaledCount = classes.filter(item => Number.isFinite(item.physicalHeight?.representativeFeet)).length;
  const genericCount = classes.filter(item => !speciesSupportsBespokeFigure(item)).length;
  $("#legend").innerHTML = metric === "physicalHeight"
    ? `<span class="legend-item">Order: most-mentioned first</span><span class="legend-item"><i class="species-lineup-height-key"></i>Figure height: reviewed representative height</span><span class="legend-item"><i class="species-lineup-unknown-key"></i>Height unstated: neutral 6′ placeholder</span><span class="legend-item">${scaledCount} of ${classes.length} profiles have reviewed height statements</span><span class="legend-item">${genericCount} faceless generic figures: no specific corpus-backed anatomy</span><span class="legend-item">Reference-grounded interpretations · not witness portraits</span>`
    : `<span class="legend-item">Order: most-mentioned first</span><span class="legend-item"><i class="species-lineup-height-key"></i>Figure height: square-root-scaled name observations</span><span class="legend-item">${genericCount} faceless generic figures: no specific corpus-backed anatomy</span><span class="legend-item">Mentions are not existence evidence</span>`;
  const referenceCount = classes.filter(item => item.groundingType === "reference" && !item.observationCount).length;
  setSummary(`${classes.length - referenceCount} corpus-mentioned profiles · ${referenceCount} visual-reference profiles · ${classes.reduce((sum, item) => sum + item.observationCount, 0)} literal name observations · ${new Set(classes.flatMap(item => item.documentIds)).size} documents · taxonomy v${state.catalog.species.taxonomyVersion}`, "species");
}

function renderSpeciesOrganic() {
  const { svg } = clearChart();
  const classes = filteredSpeciesClasses().sort((left, right) =>
    (right[state.config.speciesSize] || 0) - (left[state.config.speciesSize] || 0)
    || right.observationCount - left.observationCount || left.name.localeCompare(right.name)
  );
  if (!classes.length) return showEmpty();
  const width = Math.max(360, svg.getBoundingClientRect().width);
  const minimumHeight = width < 760 ? 340 : 440;
  const measuredHeight = svg.getBoundingClientRect().height || $("#chartWrap").clientHeight;
  const availableHeight = width < 760 ? minimumHeight : Math.max(minimumHeight, measuredHeight || minimumHeight);
  const relationships = documentCooccurrenceRelationships(classes);
  const extent = craftMetricExtent(classes, state.config.speciesSize);
  const radii = new Map(classes.map(item => [item.classId, scale(item[state.config.speciesSize] || 0, extent, width < 760 ? [6, 14] : [8, 25])]));
  const visualWeights = new Map(classes.map(item => [item.classId, radii.get(item.classId) ** 2]));
  const layout = speciesOrganicLayout(classes, relationships, width, availableHeight, visualWeights);
  svg.setAttribute("viewBox", `0 0 ${width} ${layout.height}`);
  svg.style.setProperty("height", `${layout.height}px`);
  $("#chartWrap").classList.add("species-mode");
  if (relationships.length) {
    const layer = el("g", { class: "species-relationship-layer", "aria-hidden": "true" });
    relationships.forEach(relationship => {
      const source = layout.positions.get(relationship.source), target = layout.positions.get(relationship.target);
      const line = el("line", {
        x1: source.x, y1: source.y, x2: target.x, y2: target.y,
        class: "species-relationship-line",
        "stroke-width": Math.min(2.4, .7 + Math.sqrt(relationship.documentCount) * .18),
        "data-shared-documents": relationship.documentCount
      });
      addTitle(line, `${relationship.sourceName} and ${relationship.targetName} appear in ${relationship.documentCount} shared source document${relationship.documentCount === 1 ? "" : "s"}`);
      layer.append(line);
    });
    svg.append(layer);
  }
  const dashByCategory = { human: "", zeta_grey: "7 2", animal_insect: "2 2", hybrid: "8 2 2 2", reptilian: "1 2", other: "10 3" };
  classes.forEach(speciesClass => {
    const position = layout.positions.get(speciesClass.classId), radius = radii.get(speciesClass.classId);
    const shade = scale(speciesClass[state.config.speciesSize] || 0, extent, [.2, .95]);
    const group = el("g", { class: "species-node mark", tabindex: "0", role: "button", "aria-label": `Inspect ${speciesClass.name}`, "data-category": speciesClass.category, "data-node-radius": radius.toFixed(2) });
    group.append(el("circle", { cx: position.x, cy: position.y, r: radius + 9, fill: "transparent", stroke: "transparent", class: "species-hitbox" }));
    group.append(el("circle", { cx: position.x, cy: position.y, r: radius, fill: "#111", "fill-opacity": shade, stroke: "#111", "stroke-width": 2, "stroke-dasharray": dashByCategory[speciesClass.category], class: "species-node-circle" }));
    group.append(el("text", { x: position.x, y: position.y + radius + (width < 760 ? 14 : 18), fill: "#111", "text-anchor": "middle", class: "species-class-label" }, compactSpeciesName(speciesClass.name, width < 760 ? 14 : 26).toUpperCase()));
    group.append(el("text", { x: position.x, y: position.y + radius + (width < 760 ? 25 : 32), fill: "#111", "text-anchor": "middle", class: "species-metric-label" }, `${speciesClass.documentCount} docs · ${speciesClass.observationCount} obs`));
    addTitle(group, `${speciesClass.name}: ${speciesClass.observationCount} name observations in ${speciesClass.documentCount} documents`);
    group.addEventListener("click", () => inspectSpecies(speciesClass));
    group.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) inspectSpecies(speciesClass); });
    svg.append(group);
  });
  const sizeLabel = { documentCount: "Independent documents", observationCount: "Name observations", sourceCount: "Collections" }[state.config.speciesSize];
  const representedCategories = (state.catalog.species?.categories || []).filter(category => classes.some(item => item.category === category.id));
  $("#legend").innerHTML = `<span class="legend-item"><i class="species-size-key"></i>Node size + shade: ${escapeHTML(sizeLabel)}</span>${representedCategories.map(category => `<span class="legend-item"><i class="species-category-key" data-category="${escapeHTML(category.id)}"></i>${escapeHTML(category.label)}</span>`).join("")}${relationships.length ? `<span class="legend-item"><i class="species-relationship-key"></i>Shared source documents</span>` : ""}`;
  setSummary(`${classes.length} corpus-mentioned profiles · ${classes.reduce((sum, item) => sum + item.observationCount, 0)} literal name observations · ${new Set(classes.flatMap(item => item.documentIds)).size} documents · taxonomy v${state.catalog.species.taxonomyVersion}`, "species");
}

function renderSpecies() {
  return state.config.speciesLayout === "organic" ? renderSpeciesOrganic() : renderSpeciesLineup();
}

function triageComponent(id, numerator, denominator, known, detail) {
  const definition = TRIAGE_SIGNALS.find(signal => signal.id === id);
  const safeDenominator = Math.max(1, Number(denominator) || definition?.denominator || 1);
  const safeNumerator = Math.min(safeDenominator, Math.max(0, Number(numerator) || 0));
  return {
    id,
    label: definition?.label || label(id),
    fields: definition?.fields || "",
    known: Boolean(known),
    numerator: safeNumerator,
    denominator: safeDenominator,
    ratio: known ? safeNumerator / safeDenominator : null,
    detail
  };
}

function triageCase(event, catalog = state.catalog, config = state.config) {
  const allDocuments = Array.isArray(catalog?.documents) ? catalog.documents : null;
  const documentMap = new Map((allDocuments || []).map(document => [document.id, document]));
  const hasDocumentIds = Array.isArray(event.documentIds);
  const documentIds = hasDocumentIds ? [...new Set(event.documentIds)] : [];
  const documentReferencesKnown = hasDocumentIds && allDocuments !== null && documentIds.every(id => documentMap.has(id));
  const documents = documentIds.map(id => documentMap.get(id)).filter(Boolean).filter(document => sourceIsSelected(document.source, config.sources || [], config.allSources));
  const scopedDocumentIds = new Set(documents.map(document => document.id));
  const collections = [...new Set(documents.map(document => document.source))].sort();

  const allEntities = Array.isArray(catalog?.entities) ? catalog.entities : null;
  const entityMap = new Map((allEntities || []).map(entity => [entity.id, entity]));
  const hasEntityIds = Array.isArray(event.entityIds);
  const entityIds = hasEntityIds ? [...new Set(event.entityIds)] : [];
  const entityReferencesKnown = hasEntityIds && allEntities !== null && entityIds.every(id => entityMap.has(id));
  const entities = entityIds.map(id => entityMap.get(id)).filter(Boolean);
  const entityCategories = new Set(entities.map(entity => entity.category).filter(Boolean));
  const mappedLocations = entities.filter(entity => entity.category === "location" && entity.geo && Number.isFinite(entity.geo.lat) && Number.isFinite(entity.geo.lon));

  const edgesKnown = Array.isArray(catalog?.edges) && entityReferencesKnown;
  const entityIdSet = new Set(entityIds);
  const typedEdges = edgesKnown ? catalog.edges.filter(edge => entityIdSet.has(edge.source) && entityIdSet.has(edge.target) && edge.relationship && edge.relationship !== "co_mentioned") : [];

  const evidenceKnown = Array.isArray(event.evidence);
  const evidence = evidenceKnown ? event.evidence.filter(item => !scopedDocumentIds.size || scopedDocumentIds.has(item.documentId)) : [];
  const excerptDocuments = new Set(evidence.filter(item => item.documentId && String(item.excerpt || "").trim()).map(item => item.documentId));

  const publishedDuplicateCount = Array.isArray(catalog?.duplicateCandidates) ? catalog.duplicateCandidates.length : 0;
  const possibleDuplicateCount = Number(catalog?.counts?.possibleDuplicates);
  const duplicateCatalogComplete = !Number.isFinite(possibleDuplicateCount) || publishedDuplicateCount >= possibleDuplicateCount;
  const duplicateCandidatesKnown = Array.isArray(catalog?.duplicateCandidates) && duplicateCatalogComplete && entityReferencesKnown;
  const ambiguousNames = new Set((catalog?.duplicateCandidates || []).flatMap(candidate => [candidate.left?.name, candidate.right?.name]).filter(Boolean).map(name => String(name).toLocaleLowerCase()));
  const ambiguousEntities = duplicateCandidatesKnown ? entities.filter(entity => ambiguousNames.has(String(entity.name).toLocaleLowerCase())) : [];
  const identityAmbiguityDetail = !Array.isArray(catalog?.duplicateCandidates)
    ? "Duplicate-candidate catalog unavailable"
    : !duplicateCatalogComplete
      ? `Duplicate-candidate catalog publishes ${publishedDuplicateCount} of ${possibleDuplicateCount} possible pairs`
      : !entityReferencesKnown
        ? "Associated entity references unavailable"
        : ambiguousEntities.length
          ? ambiguousEntities.map(entity => entity.name).join(", ")
          : "No linked entity appears in the duplicate-candidate catalog";

  const missingMetadata = [
    !event.startDate || !event.datePrecision,
    !hasDocumentIds || !documentIds.length,
    !evidenceKnown || !evidence.some(item => String(item.excerpt || "").trim()),
    !hasEntityIds || !entityIds.length,
    !event.eventType || !event.titleReviewStatus
  ];
  const associatedRatio = entityReferencesKnown
    ? (Math.min(entityIds.length, 4) / 4 + Math.min(entityCategories.size, 3) / 3) / 2
    : 0;
  const components = [
    triageComponent("supportingDocuments", Math.min(documents.length, 3), 3, documentReferencesKnown, `${documents.length} distinct published document${documents.length === 1 ? "" : "s"}`),
    triageComponent("collectionDiversity", Math.min(collections.length, 3), 3, documentReferencesKnown, `${collections.length} collection${collections.length === 1 ? "" : "s"}`),
    triageComponent("dateSpecificity", event.datePrecision === "day" ? 1 : 0, 1, Boolean(event.startDate && event.datePrecision), event.startDate ? `${event.startDate} · ${event.datePrecision || "precision unknown"}` : "Event date unavailable"),
    triageComponent("mappedLocation", mappedLocations.length ? 1 : 0, 1, entityReferencesKnown, mappedLocations.length ? mappedLocations.map(entity => entity.name).join(", ") : "No associated entity has reviewed coordinates"),
    triageComponent("associatedEntities", associatedRatio, 1, entityReferencesKnown, `${entities.length} linked entit${entities.length === 1 ? "y" : "ies"} · ${entityCategories.size} type${entityCategories.size === 1 ? "" : "s"}`),
    triageComponent("typedRelationships", Math.min(typedEdges.length, 2), 2, edgesKnown, `${typedEdges.length} typed relationship${typedEdges.length === 1 ? "" : "s"} among associated entities`),
    triageComponent("evidenceExcerpts", Math.min(excerptDocuments.size, 3), 3, evidenceKnown, `${excerptDocuments.size} document${excerptDocuments.size === 1 ? "" : "s"} with a published excerpt`),
    triageComponent("identityAmbiguity", ambiguousEntities.length ? 1 : 0, 1, duplicateCandidatesKnown, identityAmbiguityDetail),
    triageComponent("metadataGaps", missingMetadata.filter(Boolean).length, 5, true, `${missingMetadata.filter(Boolean).length} of 5 follow-up checks flagged`)
  ];
  const enabledComponents = components.filter(component => config.triageSignals?.[component.id]?.enabled);
  const totalWeight = enabledComponents.reduce((sum, component) => sum + config.triageSignals[component.id].weight, 0);
  const knownWeight = enabledComponents.filter(component => component.known).reduce((sum, component) => sum + config.triageSignals[component.id].weight, 0);
  const earnedWeight = enabledComponents.filter(component => component.known).reduce((sum, component) => sum + component.ratio * config.triageSignals[component.id].weight, 0);
  return {
    event,
    documents,
    collections,
    entities,
    typedEdges,
    evidence,
    components,
    totalWeight,
    knownWeight,
    earnedWeight,
    score: knownWeight ? earnedWeight / knownWeight * 100 : null,
    certainty: totalWeight ? knownWeight / totalWeight * 100 : 0
  };
}

function triageStableCompare(left, right) {
  const leftKey = `${String(left.event.title || "").toLowerCase()}\u0000${left.event.id || ""}`;
  const rightKey = `${String(right.event.title || "").toLowerCase()}\u0000${right.event.id || ""}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function triageCandidates(catalog = state.catalog, config = state.config) {
  const query = String(config.triageSearch || "").trim().toLocaleLowerCase();
  const direction = config.triageDirection === "asc" ? 1 : -1;
  const valueFor = candidate => ({
    score: candidate.score,
    certainty: candidate.certainty,
    date: candidate.event.startDate || null,
    title: String(candidate.event.title || "").toLowerCase()
  })[config.triageSort] ?? candidate.score;
  return (catalog?.events || [])
    .map(event => triageCase(event, catalog, config))
    .filter(candidate => config.allSources ? true : candidate.documents.length > 0)
    .filter(candidate => !query || [candidate.event.title, candidate.event.eventType, candidate.event.startDate, ...candidate.collections]
      .some(value => String(value || "").toLocaleLowerCase().includes(query)))
    .sort((left, right) => {
      const leftValue = valueFor(left), rightValue = valueFor(right);
      if (leftValue == null && rightValue != null) return 1;
      if (leftValue != null && rightValue == null) return -1;
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      if (config.triageSort === "score" && left.certainty !== right.certainty) return right.certainty - left.certainty;
      return triageStableCompare(left, right);
    });
}

function triageNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1).replace(/\.0$/, "");
}

function triageBreakdownHTML(candidate) {
  return candidate.components.map(component => {
    const config = state.config.triageSignals[component.id];
    const raw = component.known ? `${triageNumber(component.numerator)}/${triageNumber(component.denominator)}` : "Unknown";
    const weighted = !config.enabled ? "Off" : component.known ? `${triageNumber(component.ratio * config.weight)}/${config.weight} points` : `0/${config.weight} certainty weight`;
    return `<div class="triage-component ${config.enabled ? "" : "is-disabled"} ${component.known ? "" : "is-unknown"}">
      <span><strong>${escapeHTML(component.label)}</strong><small>${escapeHTML(component.fields)}</small></span>
      <span><strong>${escapeHTML(raw)}</strong><small>${escapeHTML(weighted)}</small></span>
      <small>${escapeHTML(component.detail)}</small>
    </div>`;
  }).join("");
}

function renderTriage() {
  hideMapView();
  const svg = $("#chart"), queue = $("#tableView");
  svg.setAttribute("hidden", "");
  svg.replaceChildren();
  queue.hidden = false;
  $("#chartWrap").classList.add("table-mode", "triage-mode");
  $("#legend").innerHTML = "";
  const candidates = triageCandidates();
  if (!candidates.length) {
    queue.replaceChildren();
    return showEmpty();
  }
  queue.innerHTML = `<div class="triage-queue-note"><strong>Review priority, not credibility</strong><span>Priority compares known signals; certainty shows how much of the scoring model had usable data.</span></div><div class="triage-queue">${candidates.map((candidate, index) => `
    <article class="triage-case">
      <button class="triage-case-open" type="button" data-triage-case="${index}">
        <span class="triage-case-rank">${String(index + 1).padStart(2, "0")}</span>
        <span class="triage-case-title"><strong>${escapeHTML(candidate.event.title)}</strong><small>${escapeHTML(label(candidate.event.eventType))} · ${escapeHTML(candidate.event.startDate || "Date unavailable")} · ${candidate.documents.length} documents / ${candidate.collections.length} collections</small></span>
        <span class="triage-case-score"><strong>${candidate.score == null ? "—" : Math.round(candidate.score)}</strong><small>of 100 priority</small></span>
        <span class="triage-case-certainty"><strong>${Math.round(candidate.certainty)}%</strong><small>certainty · ${triageNumber(candidate.knownWeight)}/${triageNumber(candidate.totalWeight)} weight known</small></span>
        <span aria-hidden="true">→</span>
      </button>
      <div class="triage-breakdown">${triageBreakdownHTML(candidate)}</div>
    </article>`).join("")}</div>`;
  $$('[data-triage-case]').forEach(button => button.addEventListener("click", () => openTriageCase(candidates[Number(button.dataset.triageCase)])));
  const selectedCollections = state.config.allSources ? "all collections" : `${state.config.sources.length} selected collection${state.config.sources.length === 1 ? "" : "s"}`;
  setSummary(`${candidates.length} published event candidates from ${selectedCollections} · ranked by ${label(state.config.triageSort).toLowerCase()}${state.config.triageSort === "score" ? ", then certainty" : ""} · not selected from all source documents`, "triage");
}

function claimDocument(claim) {
  return state.documentById.get(claim.evidence?.documentId);
}

function filteredClaimData(catalog = state.claimCatalog, config = state.config) {
  const relationships = (catalog?.relationships || []).filter(relationship => {
    if (config.claimRelation !== "all" && relationship.type !== config.claimRelation) return false;
    return config.claimReviewStatus === "all" || relationship.review?.status === config.claimReviewStatus;
  });
  const relatedClaimIds = new Set(relationships.flatMap(relationship => [relationship.from, relationship.to]));
  const claims = (catalog?.claims || []).filter(claim => {
    const document = claimDocument(claim);
    if (!document || !sourceMatches(document.source)) return false;
    if (config.claimEntity !== "all" && !claim.entityIds?.includes(config.claimEntity)) return false;
    if (config.claimDateStart && (!claim.appearanceDate || claim.appearanceDate < config.claimDateStart)) return false;
    if (config.claimDateEnd && (!claim.appearanceDate || claim.appearanceDate > config.claimDateEnd)) return false;
    return (config.claimRelation === "all" && config.claimReviewStatus === "all") || relatedClaimIds.has(claim.id);
  }).sort((left, right) => String(left.appearanceDate || "9999").localeCompare(String(right.appearanceDate || "9999")) || left.id.localeCompare(right.id));
  const visibleIds = new Set(claims.map(claim => claim.id));
  return { claims, relationships: relationships.filter(relationship => visibleIds.has(relationship.from) && visibleIds.has(relationship.to)) };
}

function firstClaimIdsByLineage(catalog = state.claimCatalog) {
  const firstIds = new Map();
  (catalog?.claims || []).forEach(claim => {
    const current = firstIds.get(claim.lineageId);
    if (!current || String(claim.appearanceDate || "9999").localeCompare(String(current.appearanceDate || "9999")) < 0
      || claim.appearanceDate === current.appearanceDate && claim.id.localeCompare(current.id) < 0) firstIds.set(claim.lineageId, claim);
  });
  return new Map([...firstIds].map(([lineageId, claim]) => [lineageId, claim.id]));
}

function claimFilterSummary(config = state.config) {
  const entity = config.claimEntity === "all" ? "all entities" : state.claimCatalog?.entities?.find(item => item.id === config.claimEntity)?.label || config.claimEntity;
  const date = config.claimDateStart || config.claimDateEnd ? `${config.claimDateStart || "any"} to ${config.claimDateEnd || "any"}` : "all dates";
  const collections = config.allSources ? "all collections" : config.sources.length ? config.sources.join(", ") : "no collections";
  return `Entity: ${entity}; dates: ${date}; collections: ${collections}; relationship: ${label(config.claimRelation)}; relationship review: ${label(config.claimReviewStatus)}`;
}

function claimEvidenceCardHTML(claim, firstAppearance = false) {
  const document = claimDocument(claim);
  const sourceLink = document ? machineDataDocumentURL(document) : "";
  return `<article class="claim-record">
    <div class="claim-record-date"><time datetime="${escapeHTML(claim.appearanceDate || "")}">${escapeHTML(claim.appearanceDate || "Date unavailable")}</time>${firstAppearance ? "<strong>First appearance</strong>" : ""}</div>
    <div class="claim-record-body">
      <p class="claim-statement">${escapeHTML(claim.statement)}</p>
      <div class="claim-proposition"><span>${escapeHTML(claim.subject)}</span><b>${escapeHTML(claim.predicate)}</b><span>${escapeHTML(claim.object)}</span></div>
      <blockquote>${escapeHTML(claim.evidence.excerpt)}</blockquote>
      <div class="claim-record-meta"><span>Text-fit confidence: ${Math.round(claim.claimConfidence * 100)}%</span><span>${escapeHTML(label(claim.modality))} · ${escapeHTML(label(claim.polarity))}</span><span>Extracted: ${escapeHTML(label(claim.extraction.method))}</span><span>Review: ${escapeHTML(label(claim.review.method))}</span></div>
      <a href="${escapeHTML(sourceLink)}" target="_blank" rel="noopener noreferrer">${escapeHTML(document?.title || claim.evidence.documentId)} · ${escapeHTML(document?.source || "Unknown collection")} · ${escapeHTML(claim.evidence.locator || `segment ${claim.evidence.segment ?? "not recorded"}`)} ↗</a>
    </div>
  </article>`;
}

function claimComparisonHTML(relationship, claimById) {
  const left = claimById.get(relationship.from), right = claimById.get(relationship.to);
  if (!left || !right) return "";
  const comparisonKind = relationship.type === "contradicts" ? "Contradiction" : ["supports", "repeats"].includes(relationship.type) ? "Agreement" : label(relationship.type);
  const evidence = claim => {
    const document = claimDocument(claim);
    return `<div class="claim-comparison-side"><strong>${escapeHTML(claim.statement)}</strong><blockquote>${escapeHTML(claim.evidence.excerpt)}</blockquote><small>${escapeHTML(document?.source || "Unknown collection")} · ${escapeHTML(claim.sourceFamily.label)}</small></div>`;
  };
  return `<article class="claim-comparison claim-comparison-${escapeHTML(relationship.type)}">
    <header><span>${escapeHTML(comparisonKind)}</span><strong>${escapeHTML(label(relationship.type))}</strong><small>${escapeHTML(label(relationship.review.status))} · ${escapeHTML(label(relationship.review.method))}</small></header>
    <div class="claim-comparison-sides">${evidence(left)}${evidence(right)}</div>
    <p>${escapeHTML(relationship.rationale)}</p>
  </article>`;
}

function renderClaims() {
  hideMapView();
  const svg = $("#chart"), view = $("#tableView");
  svg.setAttribute("hidden", "");
  svg.replaceChildren();
  view.hidden = false;
  $("#chartWrap").classList.add("table-mode", "claims-mode");
  $("#legend").innerHTML = "";
  const { claims, relationships } = filteredClaimData();
  if (!claims.length) {
    view.replaceChildren();
    return showEmpty();
  }
  const claimById = new Map(claims.map(claim => [claim.id, claim]));
  const lineages = new Map();
  claims.forEach(claim => {
    if (!lineages.has(claim.lineageId)) lineages.set(claim.lineageId, []);
    lineages.get(claim.lineageId).push(claim);
  });
  const lineageLabels = new Map((state.claimCatalog.lineages || []).map(lineage => [lineage.id, lineage.label]));
  const firstClaimIds = firstClaimIdsByLineage();
  const timeline = [...lineages].map(([lineageId, lineageClaims]) => {
    const familyGroups = new Map();
    lineageClaims.forEach(claim => {
      if (!familyGroups.has(claim.sourceFamily.id)) familyGroups.set(claim.sourceFamily.id, []);
      familyGroups.get(claim.sourceFamily.id).push(claim);
    });
    const firstId = firstClaimIds.get(lineageId);
    const documentCount = new Set(lineageClaims.map(claim => claim.evidence.documentId)).size;
    return `<section class="claim-lineage">
      <header><div><p>Claim lineage</p><h3>${escapeHTML(lineageLabels.get(lineageId) || lineageId)}</h3></div><div><strong>${familyGroups.size}</strong> independent source ${familyGroups.size === 1 ? "family" : "families"}<small>${documentCount} document${documentCount === 1 ? "" : "s"} · ${lineageClaims.length} claim${lineageClaims.length === 1 ? "" : "s"} · no combined score</small></div></header>
      <div class="claim-family-list">${[...familyGroups.values()].map(familyClaims => { const familyDocumentCount = new Set(familyClaims.map(claim => claim.evidence.documentId)).size; return `<section class="claim-family"><h4>${escapeHTML(familyClaims[0].sourceFamily.label)} <span>${familyDocumentCount} document${familyDocumentCount === 1 ? "" : "s"}</span></h4>${familyClaims.map(claim => claimEvidenceCardHTML(claim, claim.id === firstId)).join("")}</section>`; }).join("")}</div>
    </section>`;
  }).join("");
  const comparisons = relationships.map(relationship => claimComparisonHTML(relationship, claimById)).join("");
  view.innerHTML = `<div class="claim-policy"><strong>Claim policy · ${escapeHTML(state.claimCatalog.policy.version)}</strong><p>${escapeHTML(state.claimCatalog.policy.summary)}</p><small>Active filters · ${escapeHTML(claimFilterSummary())}</small></div>${timeline}<section class="claim-comparisons"><header><p>Compared language</p><h3>Agreement, qualification, and contradiction</h3></header>${comparisons || "<p class=\"claim-comparisons-empty\">No comparisons match the active filters.</p>"}</section>`;
  const independentFamilies = new Set(claims.map(claim => claim.sourceFamily.id)).size;
  const documentCount = new Set(claims.map(claim => claim.evidence.documentId)).size;
  setSummary(`${claims.length} claims · ${documentCount} documents · ${independentFamilies} independent source families · ${relationships.length} comparisons`, "claims");
}

function tableRecords() {
  let records;
  if (state.config.tableRole === "document") {
    records = state.catalog.documents.filter(item => sourceMatches(item.source));
  } else if (state.config.tableRole === "case") {
    records = (state.catalog.cases || []).filter(item => item.documentIds.some(id => sourceMatches(state.documentById.get(id)?.source)));
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
  if (["classificationConfidence", "extractionConfidence", "inflationRate", "documentInflationRate", "dataCompletenessScore"].includes(field)) return `${Math.round(value * 100)}%`;
  if (Array.isArray(value)) return value.length ? value.map(label).join(", ") : "—";
  if (field === "createdAt") return new Date(value).toLocaleString();
  if (field === "durationMs") return `${Number(value).toLocaleString()} ms`;
  if (["category", "reviewStatus", "inflationRisk", "format", "eventType", "caseKind", "resolutionStatus", "reportStatus"].includes(field)) return label(value);
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
  const rowLabel = state.config.tableRole === "entity" ? "entities" : state.config.tableRole === "document" ? "transcript files" : state.config.tableRole === "case" ? "cases" : "collections";
  tableView.innerHTML = `<table class="builder-table"><thead><tr>${fields.map(field => `<th scope="col">${escapeHTML(label(field))}</th>`).join("")}</tr></thead><tbody data-table-body></tbody></table>`;
  const body = $("[data-table-body]");
  let shown = 0;
  const inspectRow = row => {
    const item = records[Number(row.dataset.tableRow)];
    if (state.config.tableRole === "entity") inspectEntity(item);
    else if (state.config.tableRole === "document") inspectDocument(item);
    else if (state.config.tableRole === "case") inspectCase(item);
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

function validateProgramCatalog(catalog) {
  const errors = [];
  if (catalog?.schema !== "ufo-files-government-programs/v1") errors.push("unexpected schema");
  if (!Array.isArray(catalog?.programs)) return [...errors, "programs must be an array"];
  const ids = new Set();
  const validDate = (date, precision) => {
    if (!({ decade: /^\d{3}0$/, year: /^\d{4}$/, month: /^\d{4}-\d{2}$/, day: /^\d{4}-\d{2}-\d{2}$/ })[precision]?.test(date || "")) return false;
    if (!["month", "day"].includes(precision)) return true;
    const [year, month, day] = date.split("-").map(Number);
    if (month < 1 || month > 12) return false;
    if (precision === "month") return true;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    return day >= 1 && day <= daysInMonth;
  };
  const validateInterval = (interval, owner) => {
    if (!validDate(interval.startDate, interval.startPrecision)) errors.push(`${owner}: invalid start date or precision`);
    if (interval.endDate && !validDate(interval.endDate, interval.endPrecision)) errors.push(`${owner}: invalid end date or precision`);
    if (interval.endDate && programDatePosition(interval.endDate, interval.endPrecision, "end") < programDatePosition(interval.startDate, interval.startPrecision, "start")) errors.push(`${owner}: end precedes start`);
  };
  catalog.programs.forEach(program => {
    if (!program.id || ids.has(program.id)) errors.push(`duplicate or missing id: ${program.id || "unknown"}`);
    ids.add(program.id);
    if (!program.name || !program.agency || !program.startDate) errors.push(`${program.id}: missing required field`);
    if (!["official", "congressional_record_claim"].includes(program.evidenceStatus)) errors.push(`${program.id}: invalid evidence status`);
    validateInterval(program, program.id);
    if (program.intervals !== undefined && (!Array.isArray(program.intervals) || !program.intervals.length)) errors.push(`${program.id}: intervals must be a non-empty array`);
    if (Array.isArray(program.intervals)) program.intervals.forEach((interval, index) => validateInterval(interval, `${program.id} interval ${index + 1}`));
    if (!Array.isArray(program.sources) || !program.sources.length || !program.sources.every(source => source.title && /^https:\/\//.test(source.url))) errors.push(`${program.id}: invalid source`);
  });
  const reviewEntityIds = new Set();
  const validDispositions = new Set(["merged", "not_program", "not_government", "unsupported_claim"]);
  if (!Array.isArray(catalog.entityReviews)) errors.push("entityReviews must be an array");
  (catalog.entityReviews || []).forEach(review => {
    if (!review.entityId || reviewEntityIds.has(review.entityId)) errors.push(`duplicate or missing entity review: ${review.entityId || "unknown"}`);
    reviewEntityIds.add(review.entityId);
    if (!review.name || !review.rationale || !validDispositions.has(review.disposition)) errors.push(`${review.entityId}: invalid entity review`);
    if (!Array.isArray(review.sources) || !review.sources.length || !review.sources.every(source => source.title && /^https:\/\//.test(source.url))) errors.push(`${review.entityId}: invalid review source`);
  });
  (catalog.entityReviews || []).filter(review => review.disposition === "merged").forEach(review => {
    const validProgramTarget = review.programId && ids.has(review.programId);
    const validEntityTarget = review.mergedEntityId && reviewEntityIds.has(review.mergedEntityId);
    if (!validProgramTarget && !validEntityTarget) errors.push(`${review.entityId}: merge references unknown target`);
  });
  (catalog.relationships || []).forEach(link => { if (!ids.has(link.source) || !ids.has(link.target)) errors.push(`relationship references unknown program: ${link.source} → ${link.target}`); });
  return errors;
}

function programCatalogWithCorpus(reviewedCatalog, graphCatalog) {
  const entities = (graphCatalog?.entities || []).filter(entity => entity.category === "program");
  const entityIds = new Set(entities.map(entity => entity.id));
  const allEntityIds = new Set((graphCatalog?.entities || []).map(entity => entity.id));
  const includedEntityIds = new Set(reviewedCatalog.programs.map(program => program.entityId).filter(Boolean));
  const reviewByEntityId = new Map((reviewedCatalog.entityReviews || []).map(review => [review.entityId, review]));
  const duplicateDecisions = [...includedEntityIds].filter(entityId => reviewByEntityId.has(entityId));
  const missingDecisions = entities.filter(entity => !includedEntityIds.has(entity.id) && !reviewByEntityId.has(entity.id));
  if (duplicateDecisions.length || missingDecisions.length) {
    const details = [
      duplicateDecisions.length ? `duplicate decisions: ${duplicateDecisions.join(", ")}` : "",
      missingDecisions.length ? `corpus entities missing review decisions: ${missingDecisions.map(entity => entity.canonicalName || entity.name).join(", ")}` : ""
    ].filter(Boolean).join("; ");
    throw new Error(`Program review coverage invalid: ${details}`);
  }
  const mergedEntityIdsByProgram = new Map();
  (reviewedCatalog.entityReviews || []).filter(review => review.disposition === "merged" && review.programId && entityIds.has(review.entityId)).forEach(review => {
    const merged = mergedEntityIdsByProgram.get(review.programId) || [];
    merged.push(review.entityId);
    mergedEntityIdsByProgram.set(review.programId, merged);
  });
  const reviewedPrograms = reviewedCatalog.programs.map(program => {
    const matchedEntityIds = [program.entityId, ...(mergedEntityIdsByProgram.get(program.id) || [])].filter(entityId => allEntityIds.has(entityId));
    return { ...program, entityIds: matchedEntityIds, provenance: "reviewed_interval" };
  });
  return {
    ...reviewedCatalog,
    programs: reviewedPrograms,
    reviewedProgramCount: reviewedPrograms.length,
    reviewedIntervalCount: reviewedPrograms.flatMap(programIntervals).length,
    corpusProgramCount: entities.length,
    reviewedEntityCount: entities.length,
    excludedEntityCount: entities.filter(entity => reviewByEntityId.has(entity.id)).length
  };
}

function programDatePosition(date, precision, boundary = "start") {
  if (!date) return null;
  const [year, month = "01", day = "01"] = date.split("-").map(Number);
  if (precision === "decade") return boundary === "end" ? year + 10 - 1 / 365 : year;
  if (precision === "year") return boundary === "end" ? year + 1 - 1 / 365 : year;
  if (precision === "month") return boundary === "end" ? year + month / 12 - 1 / 365 : year + (month - 1) / 12;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const start = Date.UTC(year, 0, 1);
  const next = Date.UTC(year + 1, 0, 1);
  return year + (parsed.getTime() - start) / (next - start);
}

function formatProgramDate(date, precision) {
  if (!date) return "Review date";
  if (precision === "decade") return `${date.slice(0, 3)}0s`;
  if (precision === "year") return date.slice(0, 4);
  if (precision === "month") return date.slice(0, 7);
  return date;
}

function programIntervals(program) {
  if (Array.isArray(program.intervals) && program.intervals.length) return program.intervals;
  return program.startDate ? [{
    startDate: program.startDate,
    endDate: program.endDate,
    startPrecision: program.startPrecision,
    endPrecision: program.endPrecision
  }] : [];
}

function programTimeframeLabel(program, reviewDate) {
  return programIntervals(program).map(interval => {
    const start = formatProgramDate(interval.startDate, interval.startPrecision);
    const end = interval.endDate ? formatProgramDate(interval.endDate, interval.endPrecision) : `reviewed through ${reviewDate}`;
    return `${start}–${end}`;
  }).join("; ");
}

function programLaneTimeframeSegments(program, reviewDate, compact = false) {
  return programIntervals(program).map(interval => {
    const start = formatProgramDate(interval.startDate, interval.startPrecision);
    const end = interval.endDate ? formatProgramDate(interval.endDate, interval.endPrecision) : reviewDate;
    if (compact) {
      const compactStart = interval.startPrecision === "decade" ? start : start.slice(0, 4);
      const compactEnd = interval.endPrecision === "decade" ? end : end.slice(0, 4);
      return `${compactStart}–${compactEnd}${interval.endDate ? "" : " · active"}`;
    }
    const conciseEnd = interval.endDate && start.includes("-") && end.includes("-") && start.slice(0, 4) === end.slice(0, 4) ? end.slice(5) : end;
    return `${start}–${conciseEnd}${interval.endDate ? "" : " · active"}`;
  });
}

function programCorpusDocumentCount(program) {
  const entities = (program.entityIds || [program.entityId]).map(entityId => state.catalog.entities.find(item => item.id === entityId)).filter(Boolean);
  const documentIds = new Set(entities.flatMap(entity => Array.isArray(entity.documentIds) ? entity.documentIds : []));
  const unlistedDocumentCount = entities.filter(entity => !Array.isArray(entity.documentIds)).reduce((total, entity) => total + (entity.documentCount || 0), 0);
  return documentIds.size + unlistedDocumentCount;
}

function truncatedProgramLabel(value, laneWidth, fontSize = state.config.labelSize) {
  const characterWidth = Math.max(6, Number(fontSize || 12) * .62);
  const maximum = Math.max(8, Math.floor((laneWidth - 18) / characterWidth));
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

function visiblePrograms() {
  const query = state.config.programSearch.trim().toLowerCase();
  return (state.programCatalog?.programs || []).filter(program => (state.config.programStatus === "all" || program.evidenceStatus === state.config.programStatus) && (state.config.programKind === "all" || program.kind === state.config.programKind) && (!query || `${program.name} ${program.agency} ${program.summary}`.toLowerCase().includes(query))).sort((left, right) => left.startDate.localeCompare(right.startDate) || left.name.localeCompare(right.name));
}

function inspectProgram(program) {
  state.selected = program;
  $("#builderView").classList.remove("inspector-collapsed");
  $("#inspector").classList.add("has-selection");
  const entities = (program.entityIds || [program.entityId]).map(entityId => state.catalog.entities.find(item => item.id === entityId)).filter(Boolean);
  const intervals = programIntervals(program);
  const start = formatProgramDate(intervals[0].startDate, intervals[0].startPrecision);
  const lastInterval = intervals.at(-1);
  const end = lastInterval.endDate ? formatProgramDate(lastInterval.endDate, lastInterval.endPrecision) : `Active at review (${state.programCatalog.reviewedAt})`;
  const sources = (program.sources || []).map(source => `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title)} ↗</a>`).join("");
  const chronology = intervals.length > 1 ? `<p>${intervals.map(interval => `${formatProgramDate(interval.startDate, interval.startPrecision)}–${interval.endDate ? formatProgramDate(interval.endDate, interval.endPrecision) : "active at review"}`).join("; ")}</p>` : "";
  const provenanceNote = program.evidenceStatus === "congressional_record_claim"
    ? "<p>This claim was formally entered into a congressional hearing record. That gives it congressional-record provenance, but does not mean Congress substantiated it or the Defense Department confirmed the program.</p>"
    : "";
  const corpusDocuments = programCorpusDocumentCount(program);
  $("#inspectorContent").innerHTML = `<p class="inspect-category">${escapeHTML(label(program.kind))} · ${escapeHTML(label(program.evidenceStatus))}</p><h3>${escapeHTML(program.name)}</h3><p>${escapeHTML(program.summary)}</p><div class="metric-row"><div class="metric"><strong>${escapeHTML(start)}</strong><small>reviewed start</small></div><div class="metric"><strong>${escapeHTML(end)}</strong><small>reviewed end / status</small></div><div class="metric"><strong>${entities.length ? formatNumber(corpusDocuments) : "—"}</strong><small>corpus document mentions</small></div></div><div class="program-inspector-note"><strong>${escapeHTML(program.agency)}</strong><span>${escapeHTML(program.country)}</span>${chronology}${provenanceNote}</div><div class="evidence-list"><h4>Reviewed chronology sources</h4>${sources}</div>`;
  refreshGraphAfterInspectorResize();
}

function renderPrograms() {
  const { svg, width, height } = clearChart();
  const programs = visiblePrograms();
  if (!programs.length) return showEmpty();
  $("#chartWrap").classList.add("programs-mode");
  const reviewDate = state.programCatalog.reviewedAt;
  const allIntervals = programs.flatMap(programIntervals);
  const minYear = Math.floor(Math.min(...allIntervals.map(interval => programDatePosition(interval.startDate, interval.startPrecision, "start"))) / 10) * 10;
  const maxYear = Math.ceil(Math.max(...allIntervals.map(interval => programDatePosition(interval.endDate || reviewDate, interval.endPrecision || "day", "end"))) / 10) * 10;
  const compactLabels = width < 520;
  const labelWidth = compactLabels ? Math.min(150, Math.max(130, width * .42)) : Math.min(220, Math.max(170, width * .25));
  const chartLeft = labelWidth + 18, chartRight = Math.max(chartLeft + 105, width - 20), chartTop = 54;
  const maximumTimeframeLines = Math.max(...programs.map(program => programIntervals(program).length));
  const rowHeight = (compactLabels ? 52 : 54) + Math.max(0, maximumTimeframeLines - 1) * 11;
  const contentHeight = Math.max(height, chartTop + programs.length * rowHeight + 28);
  svg.style.height = `${contentHeight}px`;
  svg.setAttribute("viewBox", `0 0 ${width} ${contentHeight}`);
  const x = year => chartLeft + (year - minYear) / Math.max(1, maxYear - minYear) * (chartRight - chartLeft);
  for (let year = minYear; year <= maxYear; year += maxYear - minYear > 40 ? 10 : 5) { svg.append(el("line", { x1: x(year), y1: chartTop - 18, x2: x(year), y2: chartTop + programs.length * rowHeight, class: "program-grid-line" })); svg.append(el("text", { x: x(year), y: chartTop - 27, "text-anchor": "middle", class: "program-year-label" }, String(year))); }
  const laneById = new Map(programs.map((program, index) => [program.id, {
    program,
    y: chartTop + index * rowHeight + rowHeight / 2,
    startX: x(programDatePosition(programIntervals(program)[0].startDate, programIntervals(program)[0].startPrecision, "start")),
    endX: x(programDatePosition(programIntervals(program).at(-1).endDate || reviewDate, programIntervals(program).at(-1).endPrecision || "day", "end"))
  }]));
  const bridgeLayer = el("g", { class: "program-bridge-layer" });
  (state.programCatalog.relationships || []).forEach(link => {
    const source = laneById.get(link.source), target = laneById.get(link.target);
    if (!source || !target) return;
    const bend = Math.max(18, Math.abs(target.y - source.y) * .36);
    const path = el("path", { d: `M${source.endX},${source.y} C${source.endX + bend},${source.y} ${target.startX - bend},${target.y} ${target.startX},${target.y}`, class: "program-bridge" });
    addTitle(path, `${source.program.name} → ${target.program.name} · ${label(link.type)}`);
    bridgeLayer.append(path);
    bridgeLayer.append(el("circle", { cx: source.endX, cy: source.y, r: 5, class: "program-bridge-node" }));
    bridgeLayer.append(el("circle", { cx: target.startX, cy: target.y, r: 5, class: "program-bridge-node" }));
  });
  svg.append(bridgeLayer);
  programs.forEach((program, index) => {
    const { y } = laneById.get(program.id);
    svg.append(el("line", { x1: 0, y1: y + rowHeight / 2, x2: chartRight, y2: y + rowHeight / 2, class: "program-row-rule" }));
    const row = el("g", { class: `program-row ${state.selected?.id === program.id ? "is-selected" : ""}` });
    row.append(el("text", { x: 10, y: y - 10, class: "program-name" }, truncatedProgramLabel(program.name, labelWidth, state.config.labelSize)));
    row.append(el("text", { x: 10, y: y + 5, class: "program-agency" }, truncatedProgramLabel(program.agency, labelWidth, 10)));
    const timeframe = el("text", { x: 10, y: y + 19, class: "program-timeframe" });
    programLaneTimeframeSegments(program, reviewDate, compactLabels).forEach((segment, segmentIndex) => timeframe.append(el("tspan", { x: 10, dy: segmentIndex ? 11 : 0 }, segment)));
    row.append(timeframe);
    programIntervals(program).forEach(interval => {
      const startX = x(programDatePosition(interval.startDate, interval.startPrecision, "start"));
      const endX = x(programDatePosition(interval.endDate || reviewDate, interval.endPrecision || "day", "end"));
      row.append(el("line", { x1: startX, y1: y, x2: Math.max(startX + 3, endX), y2: y, class: `program-bar ${program.evidenceStatus === "congressional_record_claim" ? "is-congressional-record" : ""}` }));
      row.append(el("circle", { cx: startX, cy: y, r: 4, class: `program-start ${program.evidenceStatus === "congressional_record_claim" ? "is-congressional-record" : ""}` }));
      if (!interval.endDate) row.append(el("path", { d: `M${endX - 7},${y - 5} L${endX},${y} L${endX - 7},${y + 5}`, class: "program-active-arrow" }));
    });
    addTitle(row, `${program.name} · ${programIntervals(program).map(interval => `${formatProgramDate(interval.startDate, interval.startPrecision)} → ${interval.endDate ? formatProgramDate(interval.endDate, interval.endPrecision) : `active at ${reviewDate}`}`).join("; ")} · ${label(program.evidenceStatus)}`);
    row.addEventListener("click", () => {
      const chartWrap = $("#chartWrap");
      const scrollTop = chartWrap.scrollTop;
      const scrollLeft = chartWrap.scrollLeft;
      state.selected = program;
      inspectProgram(program);
      renderGraph();
      requestAnimationFrame(() => { chartWrap.scrollTop = scrollTop; chartWrap.scrollLeft = scrollLeft; });
    });
    svg.append(row);
  });
  $("#legend").innerHTML = `<span class="legend-item"><i class="program-legend-official"></i>Officially documented interval</span><span class="legend-item"><i class="program-legend-congressional"></i>Claim entered into congressional record</span><span class="legend-item"><i class="program-legend-bridge"></i>Reviewed relationship bridge</span><span class="legend-item">→ Active at ${escapeHTML(reviewDate)}</span>`;
  setSummary(`${allIntervals.length} visible reviewed intervals · ${state.programCatalog.reviewedEntityCount} / ${state.programCatalog.corpusProgramCount} corpus candidates reviewed · ${state.programCatalog.excludedEntityCount} excluded or merged after review · ${(state.programCatalog.relationships || []).filter(link => laneById.has(link.source) && laneById.has(link.target)).length} relationship bridges`, "programs");
}

function showEmpty() {
  $("#emptyState").hidden = false;
  setSummary("No matching records", state.config.type);
}

function setSummary(text, type) {
  $("#resultSummary").textContent = text;
  $("#graphKicker").textContent = type === "document" ? "Documents" : type === "solar" ? "Milky Way" : label(type === "bars" ? "bar chart" : type);
  $("#policySummary").textContent = type === "network"
    ? state.config.nodeRole === "collection" ? `Links require ${state.config.minEvidence} shared published entities` : `Co-mentions require ${state.config.minEvidence} evidence segments · closer links have more evidence · position is approximate`
    : type === "map" ? "Places mentioned in documents—not incident coordinates · reviewed gazetteer only · ambiguous names omitted"
    : type === "book" ? "Titles require an explicit book, novel, or memoir cue in transcript text"
    : type === "document" ? "Sorted by published-entity count · TXT shade represents document length · source links open the exact machine-data file"
    : type === "triage" ? "Priority is not a credibility judgment · unknown data lowers certainty"
    : type === "claims" ? "Claim confidence, source-family independence, and document count remain separate · disagreement is never collapsed into one score"
    : type === "craft" ? "Reviewed descriptions only · missing axes remain unavailable · drawings summarize reports and are not physical verification"
    : type === "species" ? "Literal name mentions and separately reviewed appearance excerpts · faceless generic figure when specific corpus-backed anatomy is absent · claims are not biological verification"
    : type === "solar" ? state.config.solarScale === "sky"
      ? "Gaia EDR3 observed-source density · observer-centered survey limits and scanning artifacts retained"
      : state.config.solarScale === "local"
        ? state.config.solarCase !== "none"
          ? "Fish identifications and Hill-reported routes are a disputed claim layer · star positions use current measured astrometry · default camera follows Fish's published Zeta Tucanae occultation constraint and comparison-diagram roll · lines are not verified travel routes · background Gaia sample is not complete or volume-corrected"
          : "Background points are high-confidence Gaia DR3 sources · enlarged corpus and Solar System markers are identified separately · inverse parallax · local sample is not complete or volume-corrected"
        : "Hou & Han: 1,853 H II regions · 1,343 molecular clouds · 735 methanol masers · Reid et al.: 199 VLBI trigonometric-parallax anchors · published fits: Norma, Scutum–Centaurus, Sagittarius–Carina, Perseus, and Local · face-on Galactocentric coordinates · 18 kpc display radius · filled points are the 2014 compilation · open circles are the separate 2019 catalog and may overlap · thin curves are the paper's H II statistical fit, not an illustration · drag to orbit · scroll to zoom · no synthetic stars, invented target coordinates, or hand-drawn morphology"
    : type === "signals" ? "Explicit numeric frequency mentions in corpus text · not live RF measurements · mention does not establish a transmission or cause"
    : type === "coverage" ? "Corpus gaps are not evidence that real-world events did not occur · unknown metadata remains explicit"
    : type === "timeline" ? "Correlative dates are human-curated context · Codex suggested The X-Files premiere"
    : type === "programs" ? "Every displayed interval is source-reviewed and shows its timeframe · every corpus program candidate has an included, merged, or excluded review decision · dashed marks identify congressional-record claims that are not agency confirmation"
    : `${formatNumber(state.catalog.counts.documents)} source files · transcript text unchanged`;
}

function syncMapAnimationButton(playing = window.ufoGlobe?.autoRotate || false) {
  const button = $("#mapAnimationButton");
  const action = playing ? "Pause" : "Play";
  button.textContent = action;
  button.setAttribute("aria-label", `${action} map animation`);
  button.setAttribute("aria-pressed", String(playing));
}

function syncSolarAnimationButton(playing = window.ufoSolar?.autoRotate ?? !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
  const button = $("#solarAnimationButton");
  const action = playing ? "Pause" : "Play";
  button.textContent = action;
  button.setAttribute("aria-label", `${action} model rotation`);
  button.setAttribute("aria-pressed", String(playing));
}

function renderGraph() {
  if (!state.catalog) return;
  $("#chartWrap").classList.toggle("claims-mode", state.config.type === "claims");
  $("#chartWrap").classList.toggle("coverage-mode", state.config.type === "coverage");
  $("#emptyState").hidden = true;
  $("#graphTitle").textContent = state.config.title;
  $("#resetZoom").hidden = !["network", "map", "solar"].includes(state.config.type);
  $("#mapAnimationButton").hidden = state.config.type !== "map";
  if (state.config.type === "map") syncMapAnimationButton();
  $("#solarAnimationButton").hidden = state.config.type !== "solar" || state.config.solarScale === "sky";
  if (state.config.type === "solar") syncSolarAnimationButton();
  $("#exportButton").textContent = state.config.type === "triage" ? "Export queue CSV" : "Export PDF";
  $("#graphSubtitle").textContent = state.config.type === "programs"
    ? `${state.programCatalog?.reviewedIntervalCount || 0} reviewed intervals · ${state.programCatalog?.reviewedEntityCount || 0} / ${state.programCatalog?.corpusProgramCount || 0} corpus candidates reviewed`
    : graphDocumentCountSubtitle(state.catalog);
  ({ network: renderNetwork, map: renderMap, solar: renderSolar, book: renderBook, document: renderDocument, scatter: renderScatter, bars: renderBars, timeline: renderTimeline, programs: renderPrograms, matrix: renderMatrix, coverage: renderCoverage, table: renderTable, triage: renderTriage, claims: renderClaims, craft: renderCraft, species: renderSpecies, signals: renderSignals })[state.config.type]();
}

function evidenceHTML(evidence = []) {
  if (!evidence.length) return "<p>No excerpt stored for this derived summary.</p>";
  return evidence.map(item => {
    const doc = state.documentById.get(item.documentId);
    const source = doc ? machineDataDocumentURL(doc) : "";
    const qualifiers = epistemicQualifierHTML(item.epistemicQualifiers);
    return `<div class="evidence-card"><p>“${escapeHTML(item.excerpt)}”</p>${qualifiers}<small>${escapeHTML(doc?.path || item.documentId)}</small>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Inspect source evidence ↗</a>` : ""}</div>`;
  }).join("");
}

function epistemicQualifierHTML(qualifiers = []) {
  if (!qualifiers.length) return "";
  return `<p class="epistemic-note" role="note">Evidence weight adjusted for ${qualifiers.map(item => `${escapeHTML(label(item.category))} (“${escapeHTML(item.qualifier)}”)`).join(", ")}.</p>`;
}

function refreshGraphAfterInspectorResize() {
  if (state.catalog) requestAnimationFrame(renderGraph);
}

function updateDossierCount() {
  const count = dossierRecordCount();
  const node = $("#dossierCount");
  if (node) node.textContent = String(count);
}

function renderDossierCollector(selection = state.inspectorDossierSelection) {
  const container = $("#dossierCollector");
  if (!container || !selection) return;
  state.inspectorDossierSelection = selection;
  const selected = dossierHasSelection(selection);
  const count = selection.records.length;
  container.innerHTML = `<label for="dossierInspectorStance">Case dossier · Local classification</label>
    <select id="dossierInspectorStance" ${selected ? "disabled" : ""}><option value="supporting">Evidence for</option><option value="contrary">Evidence against</option><option value="context">Context only</option></select>
    <button class="button ${selected ? "quiet" : "primary"}" id="dossierInspectorAction" type="button">${selected ? "Remove" : `Add${count > 1 ? ` ${count}` : ""}`}</button>`;
  $("#dossierInspectorAction").addEventListener("click", () => toggleDossierSelection(selection, $("#dossierInspectorStance").value));
}

function dossierCollectorHTML(selection) {
  state.inspectorDossierSelection = selection;
  return selection?.records?.length ? '<div class="dossier-collect" id="dossierCollector"></div>' : "";
}

function renderDossier() {
  if (!state.dossier) return;
  updateDossierCount();
  $$('[data-dossier-field]').forEach(input => { input.value = state.dossier[input.dataset.dossierField] || ""; });
  $$('[data-dossier-list]').forEach(input => { input.value = state.dossier.annotations[input.dataset.dossierList].join("\n"); });
  $$('[data-dossier-review]').forEach(input => { input.value = state.dossier.review[input.dataset.dossierReview] || ""; });
  const missing = missingDossierRecords();
  const missingKeys = new Set(missing.map(record => `${record.type}|${record.id}`));
  const stanceNames = { supporting: "Evidence for", contrary: "Evidence against", context: "Context only" };
  const groups = DOSSIER_STANCES.map(stance => {
    const records = DOSSIER_RECORD_TYPES.flatMap(type => state.dossier.records[type].filter(record => record.stance === stance).map(record => ({ ...record, type })));
    if (!records.length) return "";
    return `<section class="dossier-record-group"><h4>${stanceNames[stance]} · ${records.length}</h4>${records.map(record => {
      const missingRecord = missingKeys.has(`${record.type}|${record.id}`);
      const source = record.sourceLinks[0]?.url;
      return `<div class="dossier-record ${missingRecord ? "is-missing" : ""}" data-dossier-record="${escapeHTML(record.id)}" data-dossier-type="${record.type}">
        <span><strong>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(record.label)}</a>` : escapeHTML(record.label)}</strong><small>${DOSSIER_RECORD_LABEL[record.type]} · ${escapeHTML(record.id)}${missingRecord ? " · Missing from current catalog" : ""}</small></span>
        <select aria-label="Evidence classification for ${escapeHTML(record.label)}" data-dossier-stance><option value="supporting" ${record.stance === "supporting" ? "selected" : ""}>Evidence for</option><option value="contrary" ${record.stance === "contrary" ? "selected" : ""}>Evidence against</option><option value="context" ${record.stance === "context" ? "selected" : ""}>Context only</option></select>
        <button class="button quiet" type="button" data-dossier-remove>Remove</button>
      </div>`;
    }).join("")}</section>`;
  }).join("");
  $("#dossierRecords").innerHTML = groups || '<p class="dossier-empty">No public catalog records selected yet. Open any graph mark and add its evidence from the inspector.</p>';
  $("#dossierProvenance").innerHTML = `<span><strong>Catalog:</strong> ${escapeHTML(state.dossier.catalog.repository)} @ ${escapeHTML(state.dossier.catalog.revision)}</span><span><strong>Generated:</strong> ${escapeHTML(state.dossier.catalog.generatedAt)}</span><span><strong>Captured view:</strong> ${escapeHTML(dataAwareTitle(state.dossier.graphConfiguration))}</span>`;
  const status = $("#dossierImportStatus");
  status.hidden = !state.dossierImportMessage;
  status.textContent = state.dossierImportMessage;
}

function saveDossierWorkspaceValue(input, timestamp = new Date().toISOString()) {
  if (input.dataset.dossierField) state.dossier[input.dataset.dossierField] = input.value;
  if (input.dataset.dossierList) state.dossier.annotations[input.dataset.dossierList] = input.value.split("\n").map(value => value.trim()).filter(Boolean);
  if (input.dataset.dossierReview) state.dossier.review[input.dataset.dossierReview] = input.value;
  persistDossier(state.dossier, undefined, timestamp);
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
  state.selected = null;
  if (state.config.type === "triage" && state.config.triageCaseId) {
    state.config.triageCaseId = "";
    persistHash();
  }
  refreshGraphAfterInspectorResize();
}

function documentSourceFamily(document) {
  return document?.sourceFamily || {
    id: `unknown:${document?.id || "missing"}`,
    label: document?.title || "Unclassified document",
    status: "unknown",
    familyStatus: "unknown",
    method: "unclassified",
    confidence: 0,
    evidence: [{ signal: "unclassified", detail: "No lineage assignment is published; conservatively counted as independent and unknown" }]
  };
}

function lineageGroupsHTML(documentIds = []) {
  const groups = new Map();
  [...new Set(documentIds)].map(documentId => state.documentById.get(documentId)).filter(Boolean).forEach(document => {
    const assignment = documentSourceFamily(document);
    if (!groups.has(assignment.id)) groups.set(assignment.id, { assignment: { ...assignment, status: assignment.familyStatus || assignment.status }, documents: [] });
    groups.get(assignment.id).documents.push(document);
  });
  if (!groups.size) return "";
  const statusOrder = { reviewed: 0, inferred: 1, unknown: 2 };
  const sortedGroups = [...groups.values()].sort((left, right) => (statusOrder[left.assignment.status] ?? 3) - (statusOrder[right.assignment.status] ?? 3) || left.assignment.label.localeCompare(right.assignment.label));
  const shownGroups = sortedGroups.slice(0, 30);
  const cards = shownGroups.map(group => {
    const assignments = group.documents.slice(0, 20).map(document => {
      const assignment = documentSourceFamily(document);
      const reasons = (assignment.evidence || []).slice(0, 4).map(item => {
        const evidenceDocument = state.documentById.get(item.evidenceDocumentId);
        return `<li><strong>${escapeHTML(label(item.signal || assignment.method))}</strong> · ${escapeHTML(item.detail || "Published lineage signal")}${item.excerpt ? `<blockquote>${escapeHTML(item.excerpt)}</blockquote>` : ""}${evidenceDocument ? `<small>Signal evidence: ${escapeHTML(evidenceDocument.title || evidenceDocument.path)}</small>` : ""}</li>`;
      }).join("");
      const source = machineDataDocumentURL(document);
      return `<article class="lineage-document"><h6>${escapeHTML(document.title || document.path)}</h6><small>${escapeHTML(document.source)} · ${escapeHTML(label(assignment.status))} · ${escapeHTML(label(assignment.method))} · ${Math.round((assignment.confidence || 0) * 100)}% confidence</small>${reasons ? `<ul>${reasons}</ul>` : ""}<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Inspect source document ↗</a></article>`;
    }).join("");
    return `<section class="lineage-family lineage-family-${escapeHTML(group.assignment.status)}"><header><span>${escapeHTML(label(group.assignment.status))}</span><h5>${escapeHTML(group.assignment.label)}</h5><small>${group.documents.length} supporting document${group.documents.length === 1 ? "" : "s"}${group.documents.length > 20 ? " · first 20 shown" : ""}</small></header>${assignments}</section>`;
  }).join("");
  return `<div class="evidence-list lineage-groups"><h4>Supporting documents by likely lineage · ${groups.size} ${groups.size === 1 ? "family" : "families"}</h4><p>Reviewed assignments come from published metadata. Inferred assignments expose their signals. Unknown documents remain separate and count as independent without implying confidence.${groups.size > shownGroups.length ? ` Showing the first ${shownGroups.length} families.` : ""}</p>${cards}</div>`;
}

function derivativeCoverageWarning(item) {
  const documents = item.documentCount || item.documentIds?.length || 0;
  const families = item.independentSourceFamilyCount ?? documents;
  const repeated = Math.max(0, documents - families);
  return documents >= 3 && repeated >= 2 && repeated / documents >= .5
    ? `Prominence warning: ${formatNumber(documents)} raw documents resolve to ${formatNumber(families)} likely independent source ${families === 1 ? "family" : "families"}. Repeated or derivative coverage drives most document prominence.`
    : "";
}

function showInspector(category, title, metrics, evidence, note = "", subtitle = "", dossierItems = null, options = {}) {
  const inspector = $("#inspector");
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">${escapeHTML(label(category))}</p><h3>${escapeHTML(title)}</h3>${subtitle ? `<p class="inspect-subtitle">${escapeHTML(subtitle)}</p>` : ""}${options.warning ? `<div class="lineage-warning" role="note">${escapeHTML(options.warning)}</div>` : ""}${note ? `<p>${escapeHTML(note)}</p>` : ""}<div class="metric-row">${metrics.map(([value, name]) => `<div class="metric"><strong>${escapeHTML(formatNumber(value))}</strong><small>${escapeHTML(name)}</small></div>`).join("")}</div>${dossierCollectorHTML(dossierItems)}${lineageGroupsHTML(options.documentIds)}<div class="evidence-list"><h4>Evidence</h4>${evidenceHTML(evidence)}</div>`;
  renderDossierCollector(dossierItems);
  if (!options.preserveGraph) refreshGraphAfterInspectorResize();
}

function inspectSolarNode(detail) {
  const target = (state.catalog?.astronomy?.targets || []).find(item => item.targetId === detail.targetId);
  const distance = detail.distanceLightYears ?? target?.position?.distanceLightYears;
  const metrics = [];
  if (target) metrics.push([target.mentionCount, "corpus mentions"], [target.documentCount, "documents"], [target.sourceCount, "collections"]);
  if (Number.isFinite(distance)) metrics.push([`${Number(distance).toFixed(1)} ly`, "measured distance"]);
  const subtitle = [detail.historicalId, detail.hip ? `HIP ${detail.hip}` : ""].filter(Boolean).join(" · ");
  const note = detail.claimLayer === "hill_fish"
    ? "The point uses current measured astrometry. Its Hill–Fish identity and connected route lines belong to a disputed claim layer, not a verified travel map."
    : target?.system === "Solar System"
      ? "Solar System entities share the Sun's position at this scale; corpus counts remain entity-specific."
      : "Position is fixed by reviewed astronomical coordinates; corpus prominence does not change it.";
  showInspector(target?.kind || detail.kind || "astronomy", detail.name, metrics, target?.evidence || [], note, subtitle, null, { documentIds: target?.documentIds || [], preserveGraph: true });
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

function inspectCraftCandidates() {
  const candidates = state.catalog?.craft?.reviewCandidates || [];
  const inspector = $("#inspector");
  state.selected = null;
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const cards = candidates.slice(0, 100).map(item => {
    const example = item.examples?.[0];
    const document = example ? state.documentById.get(example.documentId) : null;
    const source = document ? machineDataDocumentURL(document) : "";
    return `<div class="craft-review-card"><small>${escapeHTML(item.decision)} · ${escapeHTML(item.reason)} · ${formatNumber(item.count)} occurrence${item.count === 1 ? "" : "s"}</small><strong>${escapeHTML(item.phrase)}</strong>${example ? `<p>“${escapeHTML(example.excerpt)}”</p>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Open example source ↗</a>` : ""}` : ""}</div>`;
  }).join("");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Craft classification review</p><h3>Ambiguous and excluded phrases</h3><p>${formatNumber(state.catalog?.counts?.craftReviewCandidates || 0)} candidate occurrences are retained by phrase and decision. They are not included in class metrics unless published in Unknown / ambiguous for explicit review.</p><div class="evidence-list"><h4>Review queue</h4>${cards || "<p>No candidates await review.</p>"}</div>`;
  refreshGraphAfterInspectorResize();
}

function inspectSpeciesCandidates() {
  const candidates = state.catalog?.species?.reviewCandidates || [];
  const inspector = $("#inspector");
  state.selected = null;
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const cards = candidates.slice(0, 100).map(item => {
    const example = item.examples?.[0];
    const document = example ? state.documentById.get(example.documentId) : null;
    const source = document ? machineDataDocumentURL(document) : "";
    return `<div class="species-review-card"><small>${escapeHTML(item.decision)} · ${escapeHTML(item.reason)} · ${formatNumber(item.count)} occurrence${item.count === 1 ? "" : "s"}</small><strong>${escapeHTML(item.phrase)}</strong>${example ? `<p>“${escapeHTML(example.excerpt)}”</p>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Open example source ↗</a>` : ""}` : ""}</div>`;
  }).join("");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Species classification review</p><h3>Ambiguous name matches</h3><p>${formatNumber(state.catalog?.counts?.speciesReviewCandidates || 0)} common-language occurrences lacked explicit extraterrestrial context and are excluded from graph metrics.</p><div class="evidence-list"><h4>Review queue</h4>${cards || "<p>No ambiguous matches await review.</p>"}</div>`;
  refreshGraphAfterInspectorResize();
}

function inspectAstronomyCandidates() {
  const candidates = state.catalog?.astronomy?.reviewCandidates || [];
  const inspector = $("#inspector");
  state.selected = null;
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const cards = candidates.slice(0, 100).map(item => {
    const example = item.examples?.[0];
    const document = example ? state.documentById.get(example.documentId) : null;
    const source = document ? machineDataDocumentURL(document) : "";
    return `<div class="craft-review-card"><small>${escapeHTML(item.decision)} · ${escapeHTML(item.reason)} · ${formatNumber(item.count)} occurrence${item.count === 1 ? "" : "s"}</small><strong>${escapeHTML(item.name)}</strong>${example ? `<p>“${escapeHTML(example.excerpt)}”</p>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Open example source ↗</a>` : ""}` : ""}</div>`;
  }).join("");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Astronomy classification review</p><h3>Ambiguous and excluded name matches</h3><p>${formatNumber(state.catalog?.counts?.astronomyReviewCandidates || 0)} candidate occurrences are retained with their decision and source evidence. They are excluded from the published astronomy totals.</p><div class="evidence-list"><h4>Review queue · showing ${Math.min(100, candidates.length)} of ${candidates.length} grouped decisions</h4>${cards || "<p>No astronomy matches await review.</p>"}</div>`;
  refreshGraphAfterInspectorResize();
}

function inspectSignalFrequency(item) {
  state.selected = item;
  const inspector = $("#inspector");
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const entities = state.catalog.entities.filter(entity => item.entityIds.includes(entity.id));
  const events = (state.catalog.events || []).filter(event => item.eventIds.includes(event.id));
  const rows = item.observations.slice(0, 100).map(observation => {
    const document = state.documentById.get(observation.documentId);
    const source = document ? machineDataDocumentURL(document) : "";
    const provenance = observation.unitProvenance === "contextual-microwave-band" ? "GHz from microwave-band context" : "literal unit";
    return `<div class="signal-observation"><small>${escapeHTML(observation.source)} · ${provenance}</small><strong>${escapeHTML(observation.originalPhrase)}</strong><p>“${escapeHTML(observation.excerpt)}”</p>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(document.path)} ↗</a>` : ""}</div>`;
  }).join("");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Corpus frequency mention</p><h3>${escapeHTML(item.frequencyLabel)}</h3><p>This peak aggregates numeric frequency language in source transcripts. Values without a literal unit are included only when the same passage explicitly establishes microwave-band frequency context. It does not establish that a signal was detected, transmitted, anomalous, or associated with any specific cause.</p>
    <div class="metric-row"><div class="metric"><strong>${item.mentionCount}</strong><small>mentions</small></div><div class="metric"><strong>${item.documentCount}</strong><small>documents</small></div><div class="metric"><strong>${item.sourceCount}</strong><small>collections</small></div><div class="metric"><strong>${formatNumber(item.frequencyHz)}</strong><small>hertz</small></div></div>
    <div class="evidence-list"><h4>Associated records</h4><p>${events.length ? `${events.length} same-segment events` : "No same-segment published event"} · ${entities.length ? `${entities.length} same-segment entities: ${escapeHTML(entities.slice(0, 12).map(entity => entity.name).join(", "))}` : "no same-segment published entities"}</p></div>
    <div class="evidence-list"><h4>Source excerpts · showing ${Math.min(100, item.observations.length)} of ${item.observations.length}</h4>${rows}</div>`;
  refreshGraphAfterInspectorResize();
}

function inspectCraft(item) {
  state.selected = item;
  const inspector = $("#inspector");
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const observations = item.observations || [];
  const measurements = observations.flatMap(observation => (observation.measurements || []).map(measurement => ({ observation, measurement })));
  const entityIds = new Set(observations.flatMap(observation => observation.entityIds || []));
  const eventIds = new Set(observations.flatMap(observation => observation.eventIds || []));
  const entities = state.catalog.entities.filter(entity => entityIds.has(entity.id));
  const events = (state.catalog.events || []).filter(event => eventIds.has(event.id));
  const dimensions = ["width", "height"].map(axis => {
    const summary = item.dimensions[axis];
    return `<div class="craft-dimension-summary"><strong>${escapeHTML(craftDimensionLabel(axis, summary))}</strong><small>${summary ? `range ${summary.minMeters.toFixed(1)}–${summary.maxMeters.toFixed(1)} m · ${summary.observationCount} contributing reports` : "No usable reported measurement; not inferred"}</small></div>`;
  }).join("");
  const measurementRows = measurements.map(({ observation, measurement }) => {
    const document = state.documentById.get(observation.documentId), source = document ? machineDataDocumentURL(document) : "";
    return `<div class="craft-measurement"><strong>${escapeHTML(measurement.kind)} · ${escapeHTML(measurement.originalText)}</strong><small>${measurement.normalizedMeters.toFixed(3)} m · ${escapeHTML(measurement.reportedAs)} · ${escapeHTML(measurement.axisMethod)}${measurement.conversionApplied ? ` · unit conversion × ${measurement.conversionFactor}` : " · source unit already meters"}</small>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(document.path)} ↗</a>` : ""}</div>`;
  }).join("");
  const observationRows = observations.slice(0, 60).map(observation => {
    const document = state.documentById.get(observation.documentId), source = document ? machineDataDocumentURL(document) : "";
    return `<div class="craft-observation"><small>${escapeHTML(observation.matchType)} · ${Math.round(observation.confidence * 100)}% confidence · ${escapeHTML(observation.witnessType)}${observation.date ? ` · ${escapeHTML(observation.date)}` : ""}</small><strong>“${escapeHTML(observation.originalPhrase)}”</strong><p>${escapeHTML(observation.excerpt)}</p>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(document.path)} ↗</a>` : ""}</div>`;
  }).join("");
  const dossierItems = dossierSelection("crafts", item);
  const authority = item.authority ? `<div class="craft-authority"><small>External source profile · ${escapeHTML(item.authority.status)}</small><p>${escapeHTML(item.authority.visualProfile)} ${escapeHTML(item.authority.behavior)}</p><p>${escapeHTML(craftAuthoritySizeLabel(item.authority))}</p><a href="${escapeHTML(item.authority.url)}" target="_blank" rel="noopener noreferrer">Open source profile ↗</a></div>` : "";
  const visualEvidence = (item.visualEvidence || []).map(feature => `<div class="craft-visual-feature"><strong>${escapeHTML(label(feature.feature))}</strong><small>${feature.observationCount} matching excerpts · ${feature.documentCount} documents</small></div>`).join("");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Craft class · taxonomy v${escapeHTML(state.catalog.craft.taxonomyVersion)}</p><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.description)} Node size represents the selected prominence metric; reported dimensions remain evidence summaries and do not affect node geometry.</p>
    <div class="metric-row"><div class="metric"><strong>${item.observationCount}</strong><small>observations</small></div><div class="metric"><strong>${item.documentCount}</strong><small>documents</small></div><div class="metric"><strong>${item.sourceCount}</strong><small>collections</small></div><div class="metric"><strong>${Math.round(item.confidence * 100)}%</strong><small>mean confidence</small></div></div>
    ${authority}<div class="craft-dimension-summaries">${dimensions}</div>${visualEvidence ? `<div class="evidence-list"><h4>Corpus visual motifs</h4><div class="craft-visual-features">${visualEvidence}</div></div>` : ""}${dossierCollectorHTML(dossierItems)}
    <div class="evidence-list"><h4>Reported measurements · ${measurements.length}</h4>${measurementRows || "<p>No usable measurements are published for this filtered class. Missing dimensions remain unavailable.</p>"}</div>
    <div class="evidence-list"><h4>Associated records</h4><p>${events.length ? `${events.length} same-segment events` : "No same-segment published event"} · ${entities.length ? `${entities.length} same-segment entities: ${escapeHTML(entities.slice(0, 12).map(entity => entity.name).join(", "))}` : "no same-segment published entities"}</p></div>
    <div class="evidence-list"><h4>Classified source excerpts · showing ${Math.min(60, observations.length)} of ${observations.length}</h4>${observationRows}</div>`;
  renderDossierCollector(dossierItems);
  refreshGraphAfterInspectorResize();
}

function inspectSpecies(item) {
  state.selected = item;
  const inspector = $("#inspector");
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const observations = item.observations || [];
  const entityIds = new Set(observations.flatMap(observation => observation.entityIds || []));
  const eventIds = new Set(observations.flatMap(observation => observation.eventIds || []));
  const entities = state.catalog.entities.filter(entity => entityIds.has(entity.id));
  const events = (state.catalog.events || []).filter(event => eventIds.has(event.id));
  const rows = observations.slice(0, 60).map(observation => {
    const document = state.documentById.get(observation.documentId), source = document ? machineDataDocumentURL(document) : "";
    return `<div class="species-observation"><small>${escapeHTML(label(observation.matchType))} · ${Math.round(observation.confidence * 100)}% confidence${observation.date ? ` · ${escapeHTML(observation.date)}` : ""}</small><strong>“${escapeHTML(observation.originalPhrase)}”</strong><p>${escapeHTML(observation.excerpt)}</p>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(document.path)} ↗</a>` : ""}</div>`;
  }).join("");
  const appearanceEvidence = item.appearanceEvidence || [];
  const appearanceRows = appearanceEvidence.map(evidence => {
    const document = state.documentById.get(evidence.documentId);
    const source = document ? machineDataDocumentURL(document) : "";
    const descriptors = (evidence.descriptors || []).map(descriptor => `<span>${escapeHTML(descriptor)}</span>`).join("");
    return `<div class="species-appearance-evidence"><small>Reviewed corpus appearance evidence${evidence.reviewStatus ? ` · ${escapeHTML(evidence.reviewStatus)}` : ""}</small><div class="species-descriptor-list">${descriptors}</div><blockquote>“${escapeHTML(evidence.excerpt)}”</blockquote>${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(document.path)} ↗</a>` : ""}</div>`;
  }).join("");
  const dossierItems = dossierSelection("species", item);
  const grounding = state.catalog.species?.groundingSource || {};
  const heightSources = item.physicalHeight?.sources || [];
  const heightSourceLinks = heightSources.map(source => source.url
    ? `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title)}${source.author ? ` · ${escapeHTML(source.author)}` : ""} ↗</a>`
    : `<span>${escapeHTML(source.title)}${source.author ? ` · ${escapeHTML(source.author)}` : ""}</span>`
  ).join("");
  const heightEvidenceScope = item.physicalHeight?.evidenceScope === "modern-ufo-literature"
    ? `Modern UFO literature${item.physicalHeight.confidence ? ` · ${escapeHTML(item.physicalHeight.confidence)} confidence` : ""}`
    : "Local grounding reference";
  const physicalHeight = item.physicalHeight
    ? `<div class="species-height-summary"><strong>Reported physical height · ${escapeHTML(item.physicalHeight.label)}</strong><small>${escapeHTML(item.physicalHeight.basis)}</small><small>${heightEvidenceScope}</small>${heightSourceLinks ? `<div class="species-height-sources">${heightSourceLinks}</div>` : ""}</div>`
    : `<div class="species-height-summary is-unstated"><strong>Physical height unstated</strong><small>The grounding source does not provide a reviewed height for this profile; the lineup does not infer one.</small></div>`;
  const groundingAppearance = item.groundingAppearance
    ? `<div class="species-grounding-summary"><strong>Grounding-reference appearance</strong><p>${escapeHTML(item.groundingAppearance)}</p><small>Paraphrased from the local working reference · not corpus evidence</small></div>`
    : "";
  const identityNote = item.identityNote
    ? `<div class="species-grounding-summary"><strong>Identity boundary</strong><p>${escapeHTML(item.identityNote)}</p></div>`
    : "";
  const profileGrounding = item.groundingType === "corpus"
    ? "This reviewed profile is grounded directly in the quoted UFO Files corpus. Its label records the source's characterization and does not verify the underlying claim."
    : `This reviewed name was grounded by <em>${escapeHTML(grounding.title || "the local working reference")}</em>${grounding.author ? ` by ${escapeHTML(grounding.author)}` : ""}. Graph metrics and quoted snippets come only from the UFO Files corpus and do not verify the underlying biological claim.`;
  const supportsBespokeFigure = speciesSupportsBespokeFigure(item);
  const figureNote = supportsBespokeFigure
    ? appearanceEvidence.length
      ? `The bespoke lineup figure is a ${item.groundingType === "corpus" ? "corpus-grounded" : "reference-grounded"} interpretation retained because the corpus contains reviewed physical-description language. The excerpts establish descriptor support, not that every illustrated detail is independently corroborated.`
      : `The bespoke lineup figure is a reference-grounded interpretation based on the reviewed profile summary, not corpus appearance evidence. No qualifying physical-description excerpt was found in the audited corpus context.`
    : appearanceEvidence.length
      ? `The corpus identifies only a broad morphological group for this profile. That is not enough evidence for specific anatomy, so the lineup uses the neutral, faceless character rather than turning reference-only details into a witness-backed portrait.`
      : `No reviewed physical-description passage was found for this profile in the audited corpus context. The lineup therefore uses the same neutral, faceless character from the lineup's visual family rather than inventing defining traits.`;
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Species profile · ${escapeHTML(item.categoryLabel)} · taxonomy v${escapeHTML(state.catalog.species.taxonomyVersion)}</p><h3>${escapeHTML(item.name)}</h3><p>${profileGrounding}</p>
    <div class="metric-row"><div class="metric"><strong>${item.observationCount}</strong><small>name observations</small></div><div class="metric"><strong>${item.documentCount}</strong><small>documents</small></div><div class="metric"><strong>${item.sourceCount}</strong><small>collections</small></div><div class="metric"><strong>${appearanceEvidence.length}</strong><small>appearance excerpts</small></div></div>
    ${physicalHeight}${groundingAppearance}${identityNote}<div class="species-reconstruction-note ${supportsBespokeFigure ? "" : "is-generic"}">${escapeHTML(figureNote)}</div>${dossierCollectorHTML(dossierItems)}
    <div class="evidence-list species-appearance-list"><h4>Corpus appearance descriptors · ${appearanceEvidence.length}</h4>${appearanceRows || "<p>No qualifying physical-description snippet was found. Name mentions below remain available for audit, but they do not support a bespoke figure.</p>"}</div>
    <div class="evidence-list"><h4>Associated records</h4><p>${events.length ? `${events.length} same-segment events` : "No same-segment published event"} · ${entities.length ? `${entities.length} same-segment entities: ${escapeHTML(entities.slice(0, 12).map(entity => entity.name).join(", "))}` : "no same-segment published entities"}</p></div>
    <div class="evidence-list"><h4>All literal-name excerpts · showing ${Math.min(60, observations.length)} of ${observations.length}</h4>${rows}</div>`;
  renderDossierCollector(dossierItems);
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
    ? ` Strongest visible relationships: ${item.egoNetwork.neighbors.map(neighbor => `${neighbor.entity.name} (${formatNumber(relationshipEvidenceCount(neighbor.edge))})`).join(", ")}.`
    : "";
  showInspector(item.category, item.name, [...egoStats, [item.independentSourceFamilyCount ?? item.documentCount, "independent source families"], [item.documentCount, "raw documents"], [item.epistemicAdjustedMentions ?? item.contextAdjustedMentions ?? item.mentions, "epistemically adjusted mentions"], [item.mentions, "raw mentions"], [item.independentDocumentCount ?? item.documentCount, "context-independent documents"], [item.sourceCount, "collections"]], item.evidence, `${inflationNote}${geographyNote}${egoNote} ${label(item.reviewStatus)} · ${item.variants.length} observed name variant${item.variants.length === 1 ? "" : "s"}`, item.category === "book" ? bookAuthor(item) : "", dossierSelection("entities", item), { documentIds: item.documentIds, warning: derivativeCoverageWarning(item) });
}

function inspectEdge(edge) {
  const left = state.catalog.entities.find(item => item.id === edge.source), right = state.catalog.entities.find(item => item.id === edge.target);
  showInspector(edge.relationship, `${left?.name || "Entity"} ↔ ${right?.name || "Entity"}`, [[relationshipEvidenceCount(edge), "weighted segments"], [edge.evidenceCount, "raw segments"], [edge.independentSourceFamilyCount ?? edge.documentCount, "independent source families"], [edge.documentCount, "raw documents"], [`${Math.round(edge.confidence * 100)}%`, "confidence"]], edge.evidence, "A typed edge requires same-segment relation language; a co-mention requires repeat evidence.", "", dossierSelection("relationships", edge, () => `${left?.name || edge.source} ↔ ${right?.name || edge.target}`), { documentIds: edge.evidence.map(item => item.documentId), warning: derivativeCoverageWarning(edge) });
}

function inspectCollectionEdge(edge, nodes) {
  const left = nodes.find(item => item.id === edge.source), right = nodes.find(item => item.id === edge.target);
  const names = edge.sharedEntities.slice(0, 8).map(entity => entity.name).join(", ");
  const remainder = Math.max(0, edge.sharedEntities.length - 8);
  showInspector("shared_entities", `${left?.name || "Collection"} ↔ ${right?.name || "Collection"}`, [[edge.evidenceCount, "shared entities"], [edge.documentCount, "documents"], [`${Math.round(edge.confidence * 100)}%`, "avg. classification"]], edge.evidence, `${names}${remainder ? `, and ${remainder} more` : ""}`, "", dossierSelection("relationships", edge, () => `${left?.name || edge.source} ↔ ${right?.name || edge.target}`));
}

function inspectGroup(item) {
  const docs = item.documentIds.map(id => state.documentById.get(id)).filter(Boolean);
  showInspector("collection", item.name, [[item.documents, "documents"], [item.words, "words"], [item.bytes, "source bytes"]], docs.slice(0, 4).map(doc => ({ documentId: doc.id, excerpt: doc.title })), "An aggregate of completed transcript files; it does not alter source content.", "", dossierSelection("documents", docs));
}

function inspectDocument(item) {
  const dateEvidence = item.documentDateEvidence
    ? [{ documentId: item.id, excerpt: `${item.documentDate}: ${item.documentDateEvidence.excerpt}` }]
    : [{ documentId: item.id, excerpt: `Completed ${new Date(item.createdAt).toLocaleString()}` }];
  const languageNote = item.originalLanguage
    ? ` · canonical ${item.originalLanguage}${item.translationAvailable ? ` · English translation ${label(item.translationReviewStatus)}` : " · no English translation"}`
    : "";
  const sourceRecordNote = item.sourceRecord?.externalId
    ? ` · MUFON case ${item.sourceRecord.externalId}${item.sourceRecord.databaseId ? ` · UPDB row ${item.sourceRecord.databaseId}` : ""}`
    : "";
  const dateReviewNote = item.reportedEventDateReview
    ? ` · timeline date ${item.reportedEventDateReview.status === "published" ? "published" : `held for review (${label(item.reportedEventDateReview.reason)})`}`
    : "";
  const qualifiers = item.epistemicQualifiers || [];
  const qualifierNote = qualifiers.length
    ? ` ${formatNumber(qualifiers.length)} machine-detected epistemic qualifier candidate${qualifiers.length === 1 ? "" : "s"} await review. They annotate evidence and do not remove text, suppress claims, or change raw graph counts.`
    : "";
  const qualifierEvidence = qualifiers.map(candidate => ({ documentId: item.id, excerpt: candidate.evidenceExcerpt, epistemicQualifiers: [candidate] }));
  showInspector(item.format, item.title, [[item.words, "words"], [item.segments, "segments"], [item.bytes, "source bytes"], [qualifiers.length, "qualifier candidates"]], [...dateEvidence, ...qualifierEvidence], `${item.documentDate ? `${item.source} · document date via ${item.documentDateEvidence.method}` : item.source}${sourceRecordNote}${dateReviewNote}${languageNote}.${qualifierNote}`, "", dossierSelection("documents", item), { documentIds: [item.id] });
}

function inspectEvent(item) {
  showInspector(item.eventType, item.title, [[timelineDateLabel(item.startDate, item.datePrecision), "event date"], [item.mentionRank, "mention rank"], [item.mentionCount, "event mentions"], [item.independentSourceFamilyCount ?? item.documentIds.length, "independent source families"], [item.documentIds.length, "raw documents"], [`${Math.round(item.confidence * 100)}%`, "confidence"]], item.evidence, "Includes explicit incident dates and source-backed disclosure, hearing, program, and official-report milestones. FOIA processing and cataloging dates remain excluded.", "", dossierSelection("events", item), { documentIds: item.documentIds, warning: derivativeCoverageWarning({ ...item, documentCount: item.documentIds.length }) });
}

function inspectTimelineGroup(item) {
  const period = item.groupPeriod === "week" ? "weekly" : item.groupPeriod === "year" ? "yearly" : "monthly";
  showInspector("event_group", item.title, [
    [item.eventCount, "events + reports"],
    [item.historicalCandidateCount, "historical dates awaiting review"],
    [item.reportedEventCount, "published database reports"],
    [item.publishedEventCount, "reviewed events"],
    [item.documentCount, "source documents"],
    [item.independentSourceFamilyCount, "source families"],
    [item.sourceCount, "collections"]
  ], item.evidence, `A ${period} visual aggregate. Hollow historical database dates remain review candidates, while published database rows are counted as reported sightings rather than independently verified events. Open an evidence link to inspect an individual source record.`, "", null, { documentIds: item.documentIds });
}

function inspectCase(item) {
  const completeness = Object.entries(item.dataCompleteness || {}).map(([field, available]) => `${label(field)}: ${available ? "available" : "missing"}`).join(" · ");
  const attribution = item.assessmentAuthority
    ? `${item.resolutionStatus} assessment attributed to ${item.assessmentAuthority}${item.assessmentDate ? ` (${item.assessmentDate})` : ""}.`
    : "No published assessment is attached; this record remains unassessed by the app.";
  showInspector("case", item.title, [
    [item.startDate || "—", "reported event date"],
    [label(item.resolutionStatus), "attributed resolution"],
    [`${Math.round((item.dataCompletenessScore || 0) * 100)}%`, "scientific metadata"],
    [item.independentSourceFamilyCount, "independent source families"],
  ], item.evidence || [], `${attribution} Reported and assessed characteristics remain separate. ${completeness}`, "", null, { documentIds: item.documentIds });
}

function coverageUnresolvedFields(documentId, coverage) {
  return coverage.dimensions.filter(dimension => dimension.buckets.some(bucket => bucket.unknown && bucket.documentIds.includes(documentId))).map(dimension => dimension.label);
}

function inspectCoverageCell(cell, matrix) {
  if (!cell) return;
  state.selected = cell;
  $("#builderView").classList.remove("inspector-collapsed");
  $("#inspector").classList.add("has-selection");
  const allIds = [...new Set(cell.scopes.flatMap(scope => scope.contributingIds))];
  const documents = allIds.map(id => state.documentById.get(id)).filter(Boolean);
  const scopeCards = cell.scopes.map((scope, index) => `<div class="coverage-scope-card coverage-scope-${scope.status}"><strong>${escapeHTML(matrix.scopes[index].label)} · ${escapeHTML(coverageStatusLabel(scope.status))}</strong><span>${formatNumber(scope.numerator)} / ${formatNumber(scope.denominator)} ${escapeHTML(coverageMetricLabel(state.config.coverageMetric).toLowerCase())}</span><small>${Math.round(scope.metadataCompleteness * 100)}% minimum metadata completeness · ${scope.contributingIds.length} contributing document ID${scope.contributingIds.length === 1 ? "" : "s"}</small></div>`).join("");
  const documentCards = documents.slice(0, 50).map(document => {
    const unresolved = coverageUnresolvedFields(document.id, matrix.coverage);
    return `<article class="coverage-document"><strong>${escapeHTML(document.title || document.id)}</strong><small>${escapeHTML(document.id)} · ${escapeHTML(document.source || "Unknown collection")} · ${escapeHTML(document.documentDate || "Unknown date")}</small><span>${unresolved.length ? `Unresolved: ${escapeHTML(unresolved.join(", "))}` : "Coverage metadata complete for published dimensions"}</span><a href="${escapeHTML(machineDataDocumentURL(document))}" target="_blank" rel="noopener noreferrer">Inspect source document ↗</a></article>`;
  }).join("");
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Corpus coverage cell</p><h3>${escapeHTML(cell.row.label)} × ${escapeHTML(cell.column.label)}</h3>
    <p class="coverage-inspector-warning">Corpus gaps are not evidence that real-world events did not occur. “Not enough source coverage” means missing metadata could conceal matches.</p>
    <div class="coverage-scope-cards">${scopeCards}</div>
    <div class="evidence-list"><h4>Contributing document IDs</h4>${documentCards || `<p>${escapeHTML(coverageStatusLabel(coverageCellStatus(cell.scopes)))}. No document contributes to this intersection.</p>`}${documents.length > 50 ? `<p>Showing 50 of ${documents.length} contributing documents. Export the gap report for every stable ID.</p>` : ""}</div>`;
  refreshGraphAfterInspectorResize();
}

function inspectTriageCase(candidate, refresh = true) {
  if (!candidate) return;
  state.selected = candidate;
  const inspector = $("#inspector");
  $("#builderView").classList.remove("inspector-collapsed");
  inspector.classList.add("has-selection");
  const documents = candidate.documents.map(document => `<a class="triage-source-document" href="${escapeHTML(machineDataDocumentURL(document))}" target="_blank" rel="noopener noreferrer"><strong>${escapeHTML(document.title || document.path)}</strong><small>${escapeHTML(document.source)} · ${escapeHTML(document.path)}</small><span>Open source ↗</span></a>`).join("");
  const entities = candidate.entities.length
    ? `<div class="triage-entity-list">${candidate.entities.map(entity => `<span>${escapeHTML(entity.name)} <small>${escapeHTML(label(entity.category))}</small></span>`).join("")}</div>`
    : "<p>No associated entities are published for this event.</p>";
  const dossierItems = dossierSelection("events", candidate.event);
  $("#inspectorContent").innerHTML = `<p class="inspect-category">Investigation triage workspace</p><h3>${escapeHTML(candidate.event.title)}</h3>
    <p class="triage-priority-note">Priority is not a judgment of truth, credibility, or threat. Unknown inputs reduce certainty rather than counting as zero evidence.</p>
    <div class="metric-row"><div class="metric"><strong>${candidate.score == null ? "—" : Math.round(candidate.score)}</strong><small>Priority / 100</small></div><div class="metric"><strong>${Math.round(candidate.certainty)}%</strong><small>Certainty</small></div><div class="metric"><strong>${candidate.documents.length}</strong><small>Documents</small></div><div class="metric"><strong>${candidate.collections.length}</strong><small>Collections</small></div></div>
    ${dossierCollectorHTML(dossierItems)}
    <div class="evidence-list triage-inspector-section"><h4>Complete score breakdown</h4><div class="triage-breakdown">${triageBreakdownHTML(candidate)}</div></div>
    <div class="evidence-list triage-inspector-section"><h4>Associated entities</h4>${entities}</div>
    <div class="evidence-list triage-inspector-section"><h4>Published excerpts</h4>${evidenceHTML(candidate.evidence)}</div>
    <div class="evidence-list triage-inspector-section"><h4>Supporting source documents</h4>${documents || "<p>No supporting source document is available in the selected collection scope.</p>"}</div>`;
  renderDossierCollector(dossierItems);
  if (refresh) refreshGraphAfterInspectorResize();
}

function openTriageCase(candidate) {
  if (!candidate) return;
  state.config.triageCaseId = candidate.event.id;
  persistHash();
  inspectTriageCase(candidate);
}

function inspectMatrix(item) {
  const scaleNote = item.normalization === "rowShare"
    ? `Shade is ${Math.round((item.normalized || 0) * 100)}% of this collection's visible row total.`
    : "Shade uses the production raw-count scale.";
  if (item.entityId) {
    const entity = state.catalog.entities.find(candidate => candidate.id === item.entityId);
    const documentIds = entity.documentIds.filter(id => state.documentById.get(id)?.source === item.source);
    showInspector(entity.category, `${item.source} × ${entity.name}`, [[item.value, "documents"], [entity.mentions, "total mentions"], [entity.sourceCount, "collections"]], entity.evidence.filter(evidence => documentIds.includes(evidence.documentId)), `This cell measures documents containing the entity in this collection. ${scaleNote}`, "", dossierSelection("entities", entity));
    return;
  }
  const entities = state.catalog.entities.filter(entity => entity.category === item.category && entity.documentIds.some(id => state.documentById.get(id)?.source === item.source));
  showInspector(item.category, `${item.source} × ${label(item.category)}`, [[item.value, "entities"], [new Set(entities.flatMap(entity => entity.documentIds)).size, "documents"]], entities.slice(0, 4).flatMap(entity => entity.evidence.slice(0, 1)), `Distinct published entities with evidence in this collection. ${scaleNote}`, "", dossierSelection("entities", entities));
}

const UFO_FILES_URL = "https://ufo-files.app";
const UFO_FILES_GITHUB_URL = "https://github.com/ufo-files";
const GRAPH_BUILDER_URL = "https://ufo-files.github.io/relationship-graph-builder/";

function triageConfigurationExport(config = state.config) {
  return {
    schema: "ufo-files-triage-configuration/v1",
    notice: "Review priority only; not a judgment of truth, credibility, or threat.",
    profile: activeTriageProfileId(config),
    sort: { field: config.triageSort, direction: config.triageDirection },
    signals: TRIAGE_SIGNALS.map(signal => ({
      id: signal.id,
      label: signal.label,
      enabled: Boolean(config.triageSignals[signal.id].enabled),
      weight: config.triageSignals[signal.id].weight,
      publishedFields: signal.fields
    }))
  };
}

function downloadText(filename, textContent, mimeType) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([textContent], { type: mimeType }));
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function coverageGapReportRows(catalog = state.catalog, config = state.config) {
  const matrix = coverageMatrixData(catalog, config, { limitBuckets: false });
  const rows = matrix.cells.flatMap(cell => cell.scopes.map((scope, index) => ({
    rowDimension: matrix.rowDimension.label, row: cell.row.label,
    columnDimension: matrix.columnDimension.label, column: cell.column.label,
    cohort: matrix.scopes[index].label, status: coverageStatusLabel(scope.status), statusKey: scope.status,
    normalizedCoverage: scope.ratio, numerator: scope.numerator, denominator: scope.denominator,
    metadataCompleteness: scope.metadataCompleteness,
    contributingDocumentIds: scope.contributingIds,
    unresolvedMetadata: [...new Set(scope.contributingIds.flatMap(id => coverageUnresolvedFields(id, matrix.coverage)))]
  })));
  const statusRank = { insufficient: 0, empty: 1, zero: 2, unknown: 3, covered: 4 };
  return rows.sort((left, right) => (left.normalizedCoverage ?? -1) - (right.normalizedCoverage ?? -1)
    || left.metadataCompleteness - right.metadataCompleteness
    || (statusRank[left.statusKey] ?? 5) - (statusRank[right.statusKey] ?? 5)
    || left.row.localeCompare(right.row) || left.column.localeCompare(right.column));
}

function exportCoverageGapReport() {
  const headers = ["rank", "row_dimension", "row", "column_dimension", "column", "cohort", "status", "normalized_coverage", "numerator", "denominator", "metadata_completeness", "contributing_document_ids", "unresolved_metadata"];
  const rows = coverageGapReportRows().map((item, index) => [
    index + 1, item.rowDimension, item.row, item.columnDimension, item.column, item.cohort, item.status,
    item.normalizedCoverage == null ? "" : item.normalizedCoverage.toFixed(6), item.numerator, item.denominator,
    item.metadataCompleteness.toFixed(6), item.contributingDocumentIds.join(" "), item.unresolvedMetadata.join("; ")
  ]);
  downloadText("ufo-files-corpus-gap-report.csv", `${[headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n")}\n`, "text/csv");
  toast("Ranked gap report saved");
}

function exportTriageConfiguration() {
  downloadText("ufo-files-triage-configuration.json", `${JSON.stringify(triageConfigurationExport(), null, 2)}\n`, "application/json");
  toast("Scoring configuration saved");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportTriageQueue() {
  const candidates = triageCandidates();
  const headers = ["Rank", "Case ID", "Title", "Event date", "Event type", "Priority / 100", "Certainty %", "Known weight", "Enabled weight", ...TRIAGE_SIGNALS.map(signal => signal.label)];
  const rows = candidates.map((candidate, index) => [
    index + 1, candidate.event.id, candidate.event.title, candidate.event.startDate, candidate.event.eventType,
    candidate.score == null ? "" : candidate.score.toFixed(4), candidate.certainty.toFixed(4), candidate.knownWeight, candidate.totalWeight,
    ...candidate.components.map(component => {
      const config = state.config.triageSignals[component.id];
      if (!config.enabled) return "off";
      if (!component.known) return `unknown; 0/${config.weight} certainty weight`;
      return `${triageNumber(component.numerator)}/${triageNumber(component.denominator)}; ${triageNumber(component.ratio * config.weight)}/${config.weight} points`;
    })
  ]);
  downloadText("ufo-files-triage-queue.csv", `${[headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n")}\n`, "text/csv");
  toast("Triage queue saved");
}

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
  if (key === "claimEntity" && value !== "all") return state.claimCatalog?.entities?.find(entity => entity.id === value)?.label || value;
  if (Array.isArray(value)) return value.length ? value.map(item => label(item)).join(", ") : "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === "") return "None";
  if (key === "minConfidence") return `${Math.round(value * 100)}%`;
  if (key === "labelSize") return `${value}px`;
  if (key === "speciesSpacing") return `${value}px`;
  if (key === "zoom") return `${Number(value).toFixed(1)}×`;
  if (key === "moonTransitSeconds") return `${value}s`;
  if (key === "timelineRelevanceCutoff") return `Top ${value}`;
  if (key === "timelineRecencyYear") return `${value}–present`;
  if (key === "craftSize") return ({ documentCount: "Independent documents", observationCount: "Classified observations", sourceCount: "Collections" })[value] || label(value);
  if (key === "speciesSize") return ({ documentCount: "Independent documents", observationCount: "Name observations", sourceCount: "Collections" })[value] || label(value);
  if (key === "coverageMetric") return coverageMetricLabel(value);
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
    : !["document", "claims", "craft", "species", "signals", "coverage", "solar", "programs"].includes(config.type) && (config.type === "timeline" || !["bars", "timeline"].includes(config.type) || config.aggregation === "entity" || config.timelineRole === "entity");

  add("Graph type", "type");
  if (config.type === "network") {
    add("Nodes", "nodeRole"); add("Relationship", "relation");
  } else if (config.type === "map") {
    addText("Marks", "Geocoded locations"); addText("Position", "Reviewed coordinates"); add("Relationship", "relation");
  } else if (config.type === "solar") {
    const groups = astronomyTargetAccounting();
    addText("View", ({ local: "Corpus targets in the solar neighborhood", galaxy: "Layered observed spiral tracers and published four-arm fit", sky: "Observed Gaia source-density sky" })[config.solarScale] || "Astronomical reference view");
    addText("Position", config.solarScale === "sky" ? "Gaia EDR3 Galactic longitude and latitude" : config.solarScale === "galaxy" ? "Hou–Han Galactocentric coordinates from adopted photometric, trigonometric, or kinematic distances" : config.solarCase !== "none" ? "Current SIMBAD ICRS coordinates and inverse positive parallax for Fish-identified stars" : "Gaia DR3 ICRS coordinates and inverse positive parallax");
    addText("Sample", config.solarScale === "local" ? "11,639 high-confidence Gaia DR3 stars within 1,000 light-years, filtered from the checked-in 30,000-star local sample" : config.solarScale === "galaxy" ? "3,931 of 3,950 Hou–Han records inside 18 kpc, plus all 199 Reid VLBI parallax records; some objects overlap" : "1.8+ billion observed Gaia EDR3 sources");
    if (config.solarScale === "local" && config.solarCase !== "none") {
      addText("Default orientation", "Fish's published sightline: beyond Zeta 1 Reticuli, with Zeta Tucanae occulted; roll follows the published comparison diagram");
      addText("Hill–Fish Map", "Enabled · current measured star positions");
      addText("Case-layer semantics", "Twelve connected pattern points plus three unconnected background points; solid routes and broken expeditions are unverified Hill-reported claim relationships");
    }
    addText("Corpus encoding", ["local", "galaxy"].includes(config.solarScale) ? "Fixed-position target marker diameter follows a power scale anchored at 20 pixels for 100 direct mentions and capped at 50 pixels; Solar System targets collapse to their shared Sun location at this scale; measured positions are unchanged" : "None");
    addText("Corpus target accounting", `${groups.sorted.length} / ${groups.sorted.length} direct-mention targets`);
    addText(`Solar System at the Sun · ${groups.solar.length}`, astronomyTargetPlainList(groups.solar) || "None");
    addText(`Fixed ICRS points · ${groups.positioned.length}`, astronomyTargetPlainList(groups.positioned) || "None");
    addText(`Represented by the scene · ${groups.scene.length}`, astronomyTargetPlainList(groups.scene) || "None");
    addText(`No reviewed point position · ${groups.unpositioned.length}`, astronomyTargetPlainList(groups.unpositioned) || "None");
  } else if (config.type === "book") {
    addText("Marks", "Book titles"); addText("Layout", "Mention-weighted cover area");
  } else if (config.type === "document") {
    addText("Rows", "Completed transcript files"); addText("Layout", "Searchable file browser");
  } else if (config.type === "craft") {
    addText("Marks", "Reviewed craft-class nodes"); addText("Node size", "Selected prominence metric"); addText("Taxonomy", `ufo-files-craft-taxonomy/v1 · v${state.catalog?.craft?.taxonomyVersion || "Not loaded"}`);
  } else if (config.type === "species") {
    addText("Marks", "Corpus-mentioned species profiles"); addText("Relationship", "Shared source documents"); addText("Taxonomy", `ufo-files-species-taxonomy/v1 · v${state.catalog?.species?.taxonomyVersion || "Not loaded"}`);
  } else if (config.type === "signals") {
    addText("Marks", "Explicit numeric frequency mentions"); addText("X axis", "Radio frequency · logarithmic"); addText("Peak height", "Distinct source documents");
  } else if (config.type === "scatter") {
    add("X axis", "x"); add("Y axis", "y"); add("Relationship", "relation");
  } else if (config.type === "bars") {
    add("Group by", "aggregation"); add("Measure", "y");
  } else if (config.type === "timeline") {
    add("Marks", "timelineRole"); add("X axis", "x"); add("Y axis", "y");
    add("Correlative date markers", "timelineCorrelativeMarkers");
    if (config.timelineRole === "event") {
      add("Screened unreviewed historical dates", "timelineHistoricalCandidates");
      add("Relevance guide", "timelineRelevanceCutoff");
      add("Recency guide", "timelineRecencyYear");
      add("Group events", "timelineGrouping");
      if (config.timelineGrouping) add("Group by", "timelineGroupPeriod");
    }
    config.timelineRole === "entity" ? add("Relationship", "relation") : addText("Relationship", "Shared published entities");
  } else if (config.type === "programs") {
    addText("Rows", "Source-reviewed government program intervals");
    addText("Timeline", "Every displayed row has a reviewed timeframe");
    addText("Corpus review coverage", `${state.programCatalog?.reviewedEntityCount || 0} / ${state.programCatalog?.corpusProgramCount || 0} candidates`);
    addText("Excluded or merged", `${state.programCatalog?.excludedEntityCount || 0} reviewed decisions`);
    addText("Reviewed intervals", `${state.programCatalog?.reviewedIntervalCount || 0} records`);
  } else if (config.type === "matrix") {
    addText("Rows", "Collections"); add("Columns", "matrixColumns"); add("Cell intensity", "matrixNormalize");
  } else if (config.type === "coverage") {
    add("Rows", "coverageRows"); add("Columns", "coverageColumns"); add("Normalize by", "coverageMetric");
    addText("Comparison", config.coverageCompare ? "Cohort A versus Cohort B" : "Off");
    if (config.coverageCompare) {
      addText("Cohort A", `${config.coverageACollection === "all" ? "All selected collections" : config.coverageACollection}; ${config.coverageAFrom || "Any date"} to ${config.coverageATo || "Any date"}`);
      addText("Cohort B", `${config.coverageBCollection === "all" ? "All selected collections" : config.coverageBCollection}; ${config.coverageBFrom || "Any date"} to ${config.coverageBTo || "Any date"}`);
    }
    addText("Interpretation", "Corpus gaps are not evidence that real-world events did not occur");
  } else if (config.type === "claims") {
    addText("Layout", "Claim timeline"); addText("Grouping", "Independent source family"); add("Relationship", "claimRelation");
  } else {
    add("Rows", "tableRole"); add("Columns", "tableColumns");
  }

  if (["scatter", "network", "timeline", "map", "book"].includes(config.type)) {
    add(config.type === "book" ? "Shade" : "Size + shade", "size");
    addText("Shade scale", "Monochrome value scale");
    add("Labels", "labels");
  } else if (["bars", "matrix"].includes(config.type)) {
    addText("Shade scale", "Monochrome value scale");
  } else if (config.type === "craft") {
    add("Illustration area", "craftSize");
  } else if (config.type === "species") {
    if (config.speciesLayout === "lineup") {
      add("Character height", "speciesY");
      add("Spacing between species", "speciesSpacing");
    } else {
      add("Node size + shade", "speciesSize");
    }
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
  if (config.type === "programs") {
    add("Evidence status", "programStatus");
    add("Program type", "programKind");
    addText("Program search", config.programSearch || "Any");
  }
  if (config.type === "claims") {
    add("Claim entity", "claimEntity");
    addText("Appearance dates", config.claimDateStart || config.claimDateEnd ? `${config.claimDateStart || "Any"} to ${config.claimDateEnd || "Any"}` : "All");
    add("Relationship review", "claimReviewStatus");
    addText("Claim policy", `${state.claimCatalog?.policy?.version || CLAIM_POLICY_VERSION}: ${state.claimCatalog?.policy?.short || "Exact evidence and explicit review required"}`);
  }
  if (config.type === "craft") {
    add("Witness/source type", "craftWitnessType"); add("Reported dimensions", "craftDimensions");
    addText("Reported date", `${config.craftDateFrom || "Any"} – ${config.craftDateTo || "Any"}`);
    addText("Associated location", config.craftLocation || "Any"); add("Minimum confidence", "minConfidence");
  }
  if (config.type === "species") {
    add("Reference group", "speciesCategory"); addText("Name search", config.speciesSearch || "Any"); add("Minimum confidence", "minConfidence");
  }
  if (!["solar", "programs"].includes(config.type)) addText("Collections", config.allSources ? "All collections" : pdfGraphPropertyValue("sources", config.sources));
  if (usesEntities) add("Minimum confidence", "minConfidence");
  if (usesEntities) {
    addText("Corroboration metric", label(config.corroborationMetric));
    addText("Source-family policy", config.sourceFamilyPolicy);
    if (usesIndependentSourceFamilyFilter(config)) addText("Minimum source families", String(config.minIndependentSourceFamilies));
  }
  if (config.type === "network" || usesRelationships && config.relationshipLayer !== "off") add("Minimum evidence", "minEvidence");
  if (!["document", "table", "claims", "craft", "species", "signals", "coverage", "solar", "programs"].includes(config.type)) add("Maximum marks", "limit");
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
    if (node.classList.contains("node-label") || node.classList.contains("timeline-historical-marker-label")) {
      node.style.setProperty("stroke", "none");
      node.style.setProperty("paint-order", "normal");
    }
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

function addPDFCoverFooter(pdf, contentBottom = 740) {
  const footerY = Math.min(760, Math.max(742, contentBottom + 2));
  setPDFFont(pdf, 7.5); pdf.text("Exported by UFO Files", 48, footerY);
}

function addPDFCoverContinuationPage(pdf) {
  pdf.addPage("letter", "portrait");
  pdf.setFillColor(255); pdf.rect(0, 0, 612, 792, "F"); pdf.setDrawColor(17); pdf.setLineWidth(.75); pdf.rect(22.5, 22.5, 567, 747);
  setPDFFont(pdf, 13, true); pdf.text("UFO FILES", 48, 58);
  setPDFFont(pdf, 9); pdf.text("RELATIONSHIP GRAPH EXPORT", 48, 73);
  pdf.setLineWidth(1.5); pdf.line(48, 91, 564, 91);
  setPDFFont(pdf, 18); pdf.text("GRAPH PROPERTIES — CONTINUED", 48, 122);
  return 151;
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
  let qrBottom = qrY + 16;
  if (code) { const qrBounds = { x: urlX, y: qrY, width: 96, height: 96 }; drawPDFQRCode(pdf, code, qrBounds); pdf.link(qrBounds.x, qrBounds.y, qrBounds.width, qrBounds.height, { url: deepLink }); qrBottom = qrBounds.y + qrBounds.height; }
  else { setPDFFont(pdf, 8.25, false, 85); pdf.text("QR unavailable for this URL", urlX, qrY + 16); }

  const propertiesY = Math.max(414, summaryY + 190, qrBottom + 16);
  pdf.setDrawColor(160); pdf.setLineWidth(.5); pdf.line(48, propertiesY, 564, propertiesY);
  setPDFFont(pdf, 8.25, true); pdf.text("GRAPH PROPERTIES", 48, propertiesY + 23);
  const properties = pdfGraphProperties();
  const columns = [48, 226, 404];
  let rowY = propertiesY + 44;
  for (let index = 0; index < properties.length; index += 3) {
    const row = properties.slice(index, index + 3);
    const lineCounts = row.map(([, value]) => pdf.splitTextToSize(String(value), 154).length);
    const rowHeight = 27 + Math.max(...lineCounts) * 9;
    if (rowY + rowHeight > 724) {
      addPDFCoverFooter(pdf);
      rowY = addPDFCoverContinuationPage(pdf);
    }
    row.forEach(([name, value], column) => {
      setPDFFont(pdf, 6.75, true, 85); pdf.text(name.toUpperCase(), columns[column], rowY);
      setPDFFont(pdf, 8.25); pdf.text(pdf.splitTextToSize(String(value), 154), columns[column], rowY + 12, { lineHeightFactor: 1.2 });
    });
    rowY += rowHeight;
  }
  addPDFCoverFooter(pdf, rowY);
}

function drawPDFLegend(pdf, y, maxX = 564) {
  const items = [...document.querySelectorAll("#legend .legend-item, #legend .coverage-key")].map(item => ({
    label: item.textContent.trim(),
    status: ["covered", "zero", "insufficient", "unknown"].find(status => item.classList.contains(status))
  })).filter(item => item.label);
  if (!items.length) return y;
  let x = 48, lineY = y;
  items.forEach((item, index) => {
    setPDFFont(pdf, 7.5); const width = Math.min(150, pdf.getTextWidth(item.label) + 18);
    if (x + width > maxX) { x = 48; lineY += 16; }
    const shade = item.status === "covered" ? 210 : item.status ? 255 : Math.max(17, 225 - index * 26);
    pdf.setFillColor(shade); pdf.setDrawColor(17);
    if (item.status === "insufficient") pdf.setLineDashPattern?.([2, 1], 0);
    pdf.rect(x, lineY - 7, 8, 8, "FD");
    if (item.status === "zero") pdf.rect(x + 2, lineY - 5, 4, 4, "S");
    if (item.status === "unknown") pdf.rect(x + 1.5, lineY - 5.5, 5, 5, "S");
    pdf.setLineDashPattern?.([], 0);
    pdf.text(truncatePDFText(pdf, item.label, width - 14), x + 13, lineY); x += width;
  });
  return lineY;
}

function addPDFClaimContinuationPage(pdf, section) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.addPage("letter", pageWidth > pageHeight ? "landscape" : "portrait");
  pdf.setFillColor(255); pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setDrawColor(17); pdf.setLineWidth(.75); pdf.rect(24, 24, pageWidth - 48, pageHeight - 48);
  setPDFFont(pdf, 8.25, true); pdf.text("UFO FILES · CLAIMS", 45, 50);
  setPDFFont(pdf, 14); pdf.text(`${section.toUpperCase()} · CONTINUED`, 45, 72);
  setPDFFont(pdf, 6.75, false, 85); pdf.text(truncatePDFText(pdf, claimFilterSummary(), pageWidth - 90), 45, 89);
  pdf.setDrawColor(160); pdf.line(24, pageHeight - 52, pageWidth - 24, pageHeight - 52);
  setPDFFont(pdf, 7.25, true); pdf.text(`UFO Files · ${UFO_FILES_URL}`, 45, pageHeight - 34);
  return { x: 45, y: 106, width: pageWidth - 90, height: pageHeight - 176 };
}

function drawPDFTableView(pdf, bounds) {
  if (state.config.type === "claims") {
    const originalPage = pdf.internal.getCurrentPageInfo?.().pageNumber || pdf.getNumberOfPages();
    const policy = state.claimCatalog?.policy?.summary || "Published claim relationships require exact evidence and explicit review.";
    setPDFFont(pdf, 7, true); pdf.text("CLAIM POLICY", bounds.x + 8, bounds.y + 14);
    setPDFFont(pdf, 7, false, 85); const policyLines = pdf.splitTextToSize(policy, bounds.width - 16).slice(0, 3); pdf.text(policyLines, bounds.x + 8, bounds.y + 28, { lineHeightFactor: 1.2 });
    const filterY = bounds.y + 32 + policyLines.length * 8;
    setPDFFont(pdf, 6.75, false, 85); pdf.text(pdf.splitTextToSize(`ACTIVE FILTERS: ${claimFilterSummary()}`, bounds.width - 16).slice(0, 2), bounds.x + 8, filterY, { lineHeightFactor: 1.2 });
    let y = filterY + 26;
    let contentBounds = bounds;
    const ensureSpace = (height, section) => {
      if (y + height <= contentBounds.y + contentBounds.height) return;
      contentBounds = addPDFClaimContinuationPage(pdf, section);
      y = contentBounds.y;
    };
    const comparisons = [...document.querySelectorAll("#tableView .claim-comparison")];
    comparisons.forEach(comparison => {
      ensureSpace(60, "Claim comparisons");
      const kind = comparison.querySelector("header span")?.textContent || "Comparison";
      const relationship = comparison.querySelector("header strong")?.textContent || "Relationship";
      const status = comparison.querySelector("header small")?.textContent || "";
      const sides = [...comparison.querySelectorAll(".claim-comparison-side")];
      const columnGap = 10, columnWidth = (contentBounds.width - 32 - columnGap) / 2;
      pdf.setDrawColor(145); pdf.rect(contentBounds.x + 5, y, contentBounds.width - 10, 54);
      setPDFFont(pdf, 6.5, true, 85); pdf.text(`${kind.toUpperCase()} · ${relationship.toUpperCase()}`, contentBounds.x + 11, y + 11);
      setPDFFont(pdf, 6, false, 85); pdf.text(truncatePDFText(pdf, status, 150), contentBounds.x + contentBounds.width - 11, y + 11, { align: "right" });
      sides.slice(0, 2).forEach((side, index) => {
        const x = contentBounds.x + 11 + index * (columnWidth + columnGap);
        const statement = side.querySelector("strong")?.textContent || "Claim";
        const excerpt = side.querySelector("blockquote")?.textContent || "";
        setPDFFont(pdf, 6.5, true); pdf.text(truncatePDFText(pdf, statement, columnWidth), x, y + 23);
        setPDFFont(pdf, 6, false, 85); pdf.text(pdf.splitTextToSize(excerpt, columnWidth).slice(0, 2), x, y + 34, { lineHeightFactor: 1.1 });
      });
      const rationale = comparison.querySelector(":scope > p")?.textContent || "";
      setPDFFont(pdf, 6, false, 85); pdf.text(truncatePDFText(pdf, `Rationale: ${rationale}`, contentBounds.width - 32), contentBounds.x + 11, y + 49);
      y += 60;
    });
    const records = [...document.querySelectorAll("#tableView .claim-record")];
    records.forEach(record => {
      ensureSpace(62, "Claim evidence");
      const date = record.querySelector("time")?.textContent || "Date unavailable";
      const statement = record.querySelector(".claim-statement")?.textContent || "Claim";
      const excerpt = record.querySelector("blockquote")?.textContent || "";
      pdf.setDrawColor(190); pdf.rect(contentBounds.x + 5, y, contentBounds.width - 10, 56);
      setPDFFont(pdf, 6.75, true, 85); pdf.text(date.toUpperCase(), contentBounds.x + 11, y + 12);
      setPDFFont(pdf, 7.5, true); pdf.text(truncatePDFText(pdf, statement, contentBounds.width - 32), contentBounds.x + 11, y + 26);
      setPDFFont(pdf, 6.75, false, 85); pdf.text(pdf.splitTextToSize(excerpt, contentBounds.width - 32).slice(0, 2), contentBounds.x + 11, y + 39, { lineHeightFactor: 1.15 });
      y += 62;
    });
    pdf.setPage(originalPage);
    return;
  }
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

function programPDFIntervalLabel(program) {
  const intervals = programIntervals(program);
  return intervals.map(interval => `${formatProgramDate(interval.startDate, interval.startPrecision)}–${interval.endDate ? formatProgramDate(interval.endDate, interval.endPrecision) : `active at ${state.programCatalog.reviewedAt}`}`).join("; ");
}

function addPDFProgramPages(pdf, exportedAt) {
  const programs = visiblePrograms();
  const visibleIntervalCount = programs.flatMap(programIntervals).length;
  const rowsPerPage = 13;
  const pages = Array.from({ length: Math.max(1, Math.ceil(programs.length / rowsPerPage)) }, (_, index) => programs.slice(index * rowsPerPage, (index + 1) * rowsPerPage));
  const metadata = new Map(pdfProvenance(exportedAt));
  pages.forEach((pagePrograms, pageIndex) => {
    pdf.addPage("letter", "portrait");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(255); pdf.rect(0, 0, pageWidth, pageHeight, "F"); pdf.setDrawColor(17); pdf.setLineWidth(.75); pdf.rect(24, 24, pageWidth - 48, pageHeight - 48);
    setPDFFont(pdf, 8.25, true); pdf.text("PROGRAM INVENTORY", 45, 52);
    setPDFFont(pdf, 18); pdf.text(truncatePDFText(pdf, pdfExportTitle().toUpperCase(), pageWidth - 90), 45, 76);
    setPDFFont(pdf, 7.25, false, 85); pdf.text(`${visibleIntervalCount} visible reviewed intervals · catalog coverage ${state.programCatalog?.reviewedEntityCount || 0}/${state.programCatalog?.corpusProgramCount || 0} candidates · page ${pageIndex + 1} / ${pages.length}`, pageWidth - 45, 94, { align: "right" });
    setPDFFont(pdf, 7.25, false, 85); pdf.text("Every displayed interval is source-reviewed and shows its timeframe.", 45, 108);
    let y = 126;
    pagePrograms.forEach(program => {
      const documentCount = programCorpusDocumentCount(program);
      const documents = (program.entityIds || [program.entityId]).some(Boolean) ? `${formatNumber(documentCount)} corpus document mention${documentCount === 1 ? "" : "s"}` : "No current corpus entity";
      pdf.setDrawColor(195); pdf.line(45, y + 31, pageWidth - 45, y + 31);
      setPDFFont(pdf, 9, true); pdf.text(truncatePDFText(pdf, program.name, 255), 45, y + 11);
      setPDFFont(pdf, 7.25, true, 85); pdf.text(truncatePDFText(pdf, programPDFIntervalLabel(program).toUpperCase(), 235), pageWidth - 45, y + 11, { align: "right" });
      setPDFFont(pdf, 7.25, false, 85); pdf.text(truncatePDFText(pdf, `${program.agency} · ${documents}`, pageWidth - 190), 45, y + 25);
      pdf.text(label(program.evidenceStatus), pageWidth - 45, y + 25, { align: "right" });
      y += 39;
    });
    const noteY = 650;
    pdf.setDrawColor(160); pdf.line(40, noteY - 12, pageWidth - 40, noteY - 12);
    setPDFFont(pdf, 6.75, false, 85);
    pdf.text(truncatePDFText(pdf, "Review method: every corpus candidate has an included, merged, or excluded sourced decision; every displayed interval has reviewed dates.", pageWidth - 90), 45, noteY + 3);
    pdf.text(truncatePDFText(pdf, "Congressional-record provenance is not congressional substantiation or agency confirmation; it means only that the claim was entered into a hearing record.", pageWidth - 90), 45, noteY + 15);
    const metadataTop = pageHeight - 66;
    const metadataCenterY = (metadataTop + pageHeight - 24) / 2;
    pdf.setDrawColor(160); pdf.line(24, metadataTop, pageWidth - 24, metadataTop);
    setPDFFont(pdf, 7.25, true); pdf.text(`UFO Files · ${UFO_FILES_URL}`, 45, metadataCenterY + 2);
    setPDFFont(pdf, 6.75, false, 85); pdf.text(`Catalog ${metadata.get("CATALOG GENERATED")}`, 225, metadataCenterY - 8); pdf.text(`Source ${metadata.get("SOURCE OF TRUTH")}@${metadata.get("SOURCE REVISION")}`, 225, metadataCenterY + 2); pdf.text(`Exported ${metadata.get("EXPORTED")}`, 225, metadataCenterY + 12);
  });
}

async function addPDFGraphPage(pdf, exportedAt) {
  if (state.config.type === "programs") return addPDFProgramPages(pdf, exportedAt);
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
    const chartRect = $("#chartWrap").getBoundingClientRect();
    const landscape = chartRect.width / chartRect.height > 1.25;
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
    } else if (!$("#solarView").hidden) {
      const canvas = $("#solarCanvas");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", chartBounds.x + 1, chartBounds.y + 1, chartBounds.width - 2, chartBounds.height - 2, undefined, "FAST");
      const mapRect = $("#solarView").getBoundingClientRect();
      pdf.setDrawColor(17); pdf.setLineWidth(.45);
      [...document.querySelectorAll("#solarLeaders .solar-label-leader")].forEach(leader => {
        if (leader.style.display === "none") return;
        const coordinates = ["x1", "y1", "x2", "y2"].map(attribute => Number(leader.getAttribute(attribute)));
        if (!coordinates.every(Number.isFinite)) return;
        const [x1, y1, x2, y2] = coordinates;
        pdf.line(
          chartBounds.x + x1 / mapRect.width * chartBounds.width,
          chartBounds.y + y1 / mapRect.height * chartBounds.height,
          chartBounds.x + x2 / mapRect.width * chartBounds.width,
          chartBounds.y + y2 / mapRect.height * chartBounds.height
        );
      });
      [...document.querySelectorAll("#solarLabels .solar-label")].forEach(labelNode => {
        if (labelNode.hidden) return;
        const rect = labelNode.getBoundingClientRect();
        const x = chartBounds.x + (rect.left - mapRect.left) / mapRect.width * chartBounds.width;
        const y = chartBounds.y + (rect.top - mapRect.top) / mapRect.height * chartBounds.height;
        const text = truncatePDFText(pdf, labelNode.textContent, 100);
        setPDFFont(pdf, 7, true);
        const textWidth = pdf.getTextWidth(text);
        pdf.setFillColor(246, 245, 239); pdf.rect(x - 2, y - 2, textWidth + 4, 11, "F");
        pdf.setTextColor(17); pdf.text(text, x, y + 7);
      });
      const rosterNode = $("#solarRoster");
      const rosterTitle = rosterNode.querySelector("strong")?.textContent || "";
      const rosterDetail = rosterNode.querySelector("small")?.textContent || "";
      if (rosterTitle || rosterDetail) {
        const x = chartBounds.x + 12, y = chartBounds.y + chartBounds.height - 34, width = chartBounds.width - 24;
        pdf.setFillColor(246, 245, 239); pdf.rect(x - 4, y - 10, width + 8, 31, "F");
        pdf.setTextColor(17); setPDFFont(pdf, 7, true); pdf.text(truncatePDFText(pdf, rosterTitle, width), x, y);
        setPDFFont(pdf, 6.5, false, 85); pdf.text(truncatePDFText(pdf, rosterDetail, width), x, y + 12);
      }
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
  if (state.config.type === "triage") return exportTriageQueue();
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

function publicDossierPayloadFromHash() {
  try {
    const encoded = new URLSearchParams(location.hash.slice(1)).get("dossier");
    if (!encoded) return null;
    const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    if (payload.schema !== PUBLIC_DOSSIER_SCHEMA || !payload.records || DOSSIER_LEGACY_RECORD_TYPES.some(type => !Array.isArray(payload.records[type])) || payload.records.crafts !== undefined && !Array.isArray(payload.records.crafts) || payload.records.species !== undefined && !Array.isArray(payload.records.species)) return null;
    payload.records.crafts ||= [];
    payload.records.species ||= [];
    return payload;
  } catch (_) {
    return null;
  }
}

async function publicDossierFromHash(catalog = state.catalog, timestamp = new Date().toISOString()) {
  const payload = publicDossierPayloadFromHash();
  if (!payload) return null;
  catalog = applySpeciesPresentation(catalog);
  const dossier = emptyDossier(catalog, payload.graphConfiguration || state.config, timestamp);
  DOSSIER_RECORD_TYPES.forEach(type => {
    payload.records[type].forEach(reference => {
      let record;
      if (type === "documents") record = catalog.documents.find(item => item.id === reference.id);
      if (type === "events") record = (catalog.events || []).find(item => item.id === reference.id);
      if (type === "entities") record = catalog.entities.find(item => item.id === reference.id);
      if (type === "relationships") record = (catalog.edges || []).find(item => relationshipStableId(item) === reference.id);
      if (type === "crafts") {
        const craftClass = (catalog.craft?.classes || []).find(item => item.id === reference.id);
        if (craftClass) record = {
          ...craftClass,
          observations: (catalog.craft?.observations || []).filter(observation => observation.classId === craftClass.classId)
        };
      }
      if (type === "species") {
        const speciesClass = (catalog.species?.classes || []).find(item => item.id === reference.id);
        if (speciesClass) record = {
          ...speciesClass,
          observations: (catalog.species?.observations || []).filter(observation => observation.classId === speciesClass.classId)
        };
      }
      if (record) dossier.records[type].push({ ...dossierRecord(type, record), stance: "context", addedAt: timestamp });
      else dossier.records[type].push({ id: reference.id, label: reference.id, stance: "context", addedAt: timestamp, sourceLinks: [], ...(type === "relationships" ? { source: reference.source, target: reference.target, relationship: reference.relationship } : {}) });
    });
  });
  dossier.catalog.revision = payload.catalogRevision || dossier.catalog.revision;
  return dossier;
}

async function importDossierFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    parsed.records ||= {};
    parsed.records.crafts ||= [];
    parsed.records.species ||= [];
    const validation = validateDossierImport(parsed);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    parsed.graphConfiguration = normalizeDossierGraphConfiguration(parsed.graphConfiguration);
    state.dossier = sortedDossier(parsed);
    state.dossierIsPublicReference = false;
    const missing = missingDossierRecords();
    state.dossierImportMessage = missing.length
      ? `Imported ${dossierRecordCount()} records. ${missing.length} record${missing.length === 1 ? " is" : "s are"} missing from the current catalog and remain flagged by stable ID.`
      : `Imported ${dossierRecordCount()} records. Every stable ID is present in the current catalog.`;
    persistDossier(state.dossier, undefined, state.dossier.updatedAt);
    renderDossier();
    toast(missing.length ? `Imported with ${missing.length} stale ID${missing.length === 1 ? "" : "s"}` : "Dossier imported");
  } catch (error) {
    state.dossierImportMessage = `Import failed: ${error.message}`;
    renderDossier();
    toast("Dossier import failed");
  }
}

function captureDossierConfiguration(timestamp = new Date().toISOString()) {
  state.dossier.catalog = dossierCatalogSnapshot();
  state.dossier.graphConfiguration = dossierClone(state.config);
  persistDossier(state.dossier, undefined, timestamp);
  renderDossier();
  toast("Current catalog and graph captured");
}

function showLoadingState(message) {
  let node = $("#loadingState");
  if (!node) {
    node = document.createElement("div");
    node.className = "loading";
    node.id = "loadingState";
    $("#chartWrap").prepend(node);
  }
  node.innerHTML = `<span></span>${escapeHTML(message)}`;
}

function showCatalogError(error) {
  let node = $("#loadingState");
  if (!node) {
    node = document.createElement("div");
    node.className = "loading";
    node.id = "loadingState";
    $("#chartWrap").prepend(node);
  }
  node.innerHTML = `<strong>Catalog unavailable</strong><br><small>${escapeHTML(error.message)}. Serve this folder over HTTP.</small>`;
}

function astronomyBootstrapCatalog(payload) {
  if (payload?.schema !== ASTRONOMY_BOOTSTRAP_SCHEMA || payload.catalogSchema !== "ufo-files-relationship-catalog/v1") {
    throw new Error("Astronomy bootstrap invalid");
  }
  if (!Array.isArray(payload.documents) || !Array.isArray(payload.astronomy?.targets) || !Array.isArray(payload.astronomy?.reviewCandidates)) {
    throw new Error("Astronomy bootstrap is missing reviewed targets");
  }
  return {
    schema: payload.catalogSchema,
    generatedAt: payload.generatedAt,
    input: payload.input,
    counts: payload.counts,
    sources: [], documents: payload.documents, sourceFamilies: [], events: [], cases: [], entities: [], edges: [],
    coverage: {}, craft: { classes: [], observations: [], reviewCandidates: [] },
    species: { categories: [], classes: [], observations: [], reviewCandidates: [] },
    astronomy: payload.astronomy,
    signals: { frequencies: [], observations: [] }, duplicateCandidates: []
  };
}

async function loadFullCatalogPayload() {
  const [catalogResponse, claimResponse, programResponse] = await Promise.all([
    fetch("data/catalog.json", { cache: "no-cache" }),
    fetch("data/claims.json", { cache: "no-cache" }),
    fetch("data/government_programs.json", { cache: "no-cache" })
  ]);
  if (!catalogResponse.ok) throw new Error(`${catalogResponse.status} ${catalogResponse.statusText}`);
  if (!claimResponse.ok) throw new Error(`Claims ${claimResponse.status} ${claimResponse.statusText}`);
  if (!programResponse.ok) throw new Error(`Programs ${programResponse.status} ${programResponse.statusText}`);
  const catalog = await catalogResponse.json();
  if (Array.isArray(catalog.documentShards) && catalog.documentShards.length) {
    const shardPayloads = await Promise.all(catalog.documentShards.map(async shard => {
      const shardVersion = encodeURIComponent(shard.version || catalog.input?.revision || catalog.generatedAt || "current");
      const response = await fetch(`data/${shard.path}?v=${shardVersion}`);
      if (!response.ok) throw new Error(`Document shard ${shard.source}: ${response.status} ${response.statusText}`);
      const payload = await response.json();
      if (payload.schema !== "ufo-files-source-documents/v1" || payload.source !== shard.source || !Array.isArray(payload.documents)) {
        throw new Error(`Document shard invalid: ${shard.path}`);
      }
      return payload.documents;
    }));
    catalog.documents = shardPayloads.flat();
    if (catalog.documents.length !== catalog.counts.documents) {
      throw new Error(`Document shard count mismatch: expected ${catalog.counts.documents}, loaded ${catalog.documents.length}`);
    }
  }
  return { catalog, claimCatalog: await claimResponse.json(), programCatalog: await programResponse.json() };
}

function installFullCatalog({ catalog, claimCatalog, programCatalog }) {
  state.catalog = applySpeciesPresentation(catalog);
  state.claimCatalog = claimCatalog;
  state.programCatalog = programCatalog;
  const programErrors = validateProgramCatalog(state.programCatalog);
  if (programErrors.length) throw new Error(`Program catalog invalid: ${programErrors.join(" ")}`);
  state.programCatalog = programCatalogWithCorpus(state.programCatalog, state.catalog);
  state.catalog.entities = state.catalog.entities.map(withSignificanceDefaults);
  state.documentById.clear();
  state.catalog.documents.forEach(item => state.documentById.set(item.id, item));
  state.historicalTimelineCandidateCount = state.catalog.documents.filter(historicalTimelineCandidate).length;
  const claimErrors = validateClaimCatalog(state.claimCatalog, state.catalog.documents);
  if (claimErrors.length) throw new Error(`Claim catalog invalid: ${claimErrors.join(" ")}`);
  state.catalogMode = "full";
}

async function initializeDossier() {
  const sharedDossier = await publicDossierFromHash();
  state.dossier = sharedDossier || loadDossier() || emptyDossier();
  state.dossierIsPublicReference = Boolean(sharedDossier);
  if (sharedDossier) state.dossierImportMessage = "Opened a temporary public reference. Your saved local dossier remains preserved; edits to this reference stay in this tab unless you export them.";
  updateDossierCount();
}

function renderInitialView() {
  $("#loadingState")?.remove();
  syncAutomaticTitle();
  renderControls(); renderGraph();
}

async function openDossierDialog() {
  if (!await ensureFullCatalog()) return;
  if (!state.dossier) await initializeDossier();
  renderDossier();
  $("#dossierDialog").showModal();
}

async function ensureFullCatalog() {
  if (state.catalogMode === "full" || !state.catalog) return true;
  showLoadingState("Loading full corpus…");
  try {
    state.fullCatalogPromise ||= loadFullCatalogPayload();
    installFullCatalog(await state.fullCatalogPromise);
    if (!state.dossier) await initializeDossier();
    $("#loadingState")?.remove();
    return true;
  } catch (error) {
    state.fullCatalogPromise = null;
    showCatalogError(error);
    return false;
  }
}

async function init() {
  try {
    if (state.config.type === "solar") {
      const response = await fetch("data/astronomy.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Astronomy ${response.status} ${response.statusText}`);
      state.catalog = astronomyBootstrapCatalog(await response.json());
      state.catalogMode = "astronomy";
      state.documentById.clear();
      state.catalog.documents.forEach(item => state.documentById.set(item.id, item));
      renderInitialView();
      if (new URLSearchParams(location.search).get("dossier") === "open") await openDossierDialog();
      return;
    }
    installFullCatalog(await loadFullCatalogPayload());
    await initializeDossier();
    renderInitialView();
    if (new URLSearchParams(location.search).get("dossier") === "open") {
      await openDossierDialog();
    }
    if (state.config.type === "triage" && state.config.triageCaseId) {
      const candidate = triageCandidates().find(item => item.event.id === state.config.triageCaseId);
      if (candidate) inspectTriageCase(candidate, false);
    }
  } catch (error) {
    showCatalogError(error);
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
$("#dossierButton").addEventListener("click", openDossierDialog);
$("#closeDossier").addEventListener("click", () => $("#dossierDialog").close());
$("#dossierDialog").addEventListener("input", event => {
  if (event.target.matches("[data-dossier-field], [data-dossier-list], [data-dossier-review]")) saveDossierWorkspaceValue(event.target);
});
$("#dossierRecords").addEventListener("change", event => {
  if (!event.target.matches("[data-dossier-stance]")) return;
  const row = event.target.closest("[data-dossier-record]");
  const record = state.dossier.records[row.dataset.dossierType].find(item => item.id === row.dataset.dossierRecord);
  if (record) { record.stance = event.target.value; persistDossier(state.dossier); renderDossier(); }
});
$("#dossierRecords").addEventListener("click", event => {
  const button = event.target.closest("[data-dossier-remove]");
  if (!button) return;
  const row = button.closest("[data-dossier-record]");
  state.dossier.records[row.dataset.dossierType] = state.dossier.records[row.dataset.dossierType].filter(item => item.id !== row.dataset.dossierRecord);
  persistDossier(state.dossier); renderDossier(); renderDossierCollector();
});
$("#captureDossierConfig").addEventListener("click", () => captureDossierConfiguration());
$("#exportDossier").addEventListener("click", () => { downloadText(`${state.dossier.id}.json`, dossierJSON(), "application/json"); toast("Dossier JSON saved"); });
$("#reportDossier").addEventListener("click", () => { downloadText(`${state.dossier.id}-report.md`, dossierReport(), "text/markdown"); toast("Neutral source-linked report saved"); });
$("#shareDossier").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(publicDossierURL()); toast("Public identifier link copied — notes excluded"); }
  catch (_) { toast("Copy failed; export JSON to share the complete dossier"); }
});
$("#dossierImport").addEventListener("change", event => { const [file] = event.target.files; if (file) importDossierFile(file); event.target.value = ""; });
$("#newDossier").addEventListener("click", () => {
  if (!confirm("Start a new local dossier? Export the current JSON first if you need a backup.")) return;
  state.dossier = emptyDossier(); state.dossierIsPublicReference = false; state.dossierImportMessage = ""; persistDossier(state.dossier, undefined, state.dossier.createdAt); renderDossier(); renderDossierCollector();
});
$("#controlsButton").addEventListener("click", event => setMobileControls(event.currentTarget.getAttribute("aria-expanded") !== "true"));
$("#fullScreenButton").addEventListener("click", toggleGraphFullScreen);
$("#mapAnimationButton").addEventListener("click", () => {
  const playing = window.ufoGlobe?.setPlaying(!window.ufoGlobe.autoRotate) || false;
  syncMapAnimationButton(playing);
});
window.addEventListener("ufo-map-playback", event => syncMapAnimationButton(event.detail.playing));
$("#solarAnimationButton").addEventListener("click", () => {
  const playing = window.ufoSolar?.setPlaying(!window.ufoSolar.autoRotate) || false;
  syncSolarAnimationButton(playing);
});
window.addEventListener("ufo-solar-playback", event => syncSolarAnimationButton(event.detail.playing));
window.addEventListener("ufo-solar-drilldown", event => {
  if(state.config.type==="solar"&&event.detail?.scale==="local"&&state.config.solarScale!=="local")updateConfig("solarScale","local",true);
});
window.addEventListener("ufo-solar-select", event => {
  if(state.config.type==="solar"&&event.detail?.name)inspectSolarNode(event.detail);
});
$("#exportButton").addEventListener("click", exportCurrent);
$("#closeInspector").addEventListener("click", closeInspector);
$("#resetZoom").addEventListener("click", () => {
  if (state.config.type === "map") return window.ufoGlobe?.reset();
  if (state.config.type === "solar") return window.ufoSolar?.reset();
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
