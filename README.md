# UFO Files Graph Builder

A static graph builder for completed OCR and media transcripts in the UFO Files archive. It is designed for GitHub Pages: there is no server, database, CDN dependency, or runtime build step.

## Graph types

These previews are regenerated from the latest machine-data catalog after every successful rebuild. The default view includes the full app chrome, while each graph-type preview focuses on the graph itself. Every image includes a 1px black border for contrast against light backgrounds.

<!-- graph-screenshots:start -->
<p align="center">
  <strong>Default view</strong><br>
  <a href="assets/screenshots/default-view.png"><img src="assets/screenshots/default-view.png" alt="Default graph builder view screenshot" width="100%"></a>
</p>
<table>
  <tr>
    <td width="50%" align="center">
      <strong>Network</strong><br>
      <a href="assets/screenshots/network.png"><img src="assets/screenshots/network.png" alt="Network graph type screenshot" width="100%"></a>
    </td>
    <td width="50%" align="center">
      <strong>Map</strong><br>
      <a href="assets/screenshots/map.png"><img src="assets/screenshots/map.png" alt="Map graph type screenshot" width="100%"></a>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>Bookshelf</strong><br>
      <a href="assets/screenshots/book.png"><img src="assets/screenshots/book.png" alt="Bookshelf graph type screenshot" width="100%"></a>
    </td>
    <td width="50%" align="center">
      <strong>Documents</strong><br>
      <a href="assets/screenshots/document.png"><img src="assets/screenshots/document.png" alt="Documents graph type screenshot" width="100%"></a>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>Scatter</strong><br>
      <a href="assets/screenshots/scatter.png"><img src="assets/screenshots/scatter.png" alt="Scatter graph type screenshot" width="100%"></a>
    </td>
    <td width="50%" align="center">
      <strong>Bars</strong><br>
      <a href="assets/screenshots/bars.png"><img src="assets/screenshots/bars.png" alt="Bars graph type screenshot" width="100%"></a>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>Timeline</strong><br>
      <a href="assets/screenshots/timeline.png"><img src="assets/screenshots/timeline.png" alt="Timeline graph type screenshot" width="100%"></a>
    </td>
    <td width="50%" align="center">
      <strong>Matrix</strong><br>
      <a href="assets/screenshots/matrix.png"><img src="assets/screenshots/matrix.png" alt="Matrix graph type screenshot" width="100%"></a>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>Table</strong><br>
      <a href="assets/screenshots/table.png"><img src="assets/screenshots/table.png" alt="Table graph type screenshot" width="100%"></a>
    </td>
    <td width="50%"></td>
  </tr>
</table>
<!-- graph-screenshots:end -->

## Product model

The builder asks for five decisions:

1. **Graph type** — network, map, book, scatter, bars, timeline, matrix, or table.
2. **Data roles** — nodes/relationships or X and Y fields, depending on the shape.
3. **Encoding** — size, monochrome value scales, and labels.
4. **Refinement** — collections, entity types, confidence, evidence floor, and mark count.
5. **Output** — a URL-addressable view, browser save, exported SVG, globe PNG, or table CSV.

The default view is an ordinary builder configuration and uses the same rendering and data path as every saved view. Numeric scatter axes use a robust 95th-percentile cap only when the maximum is at least 50% beyond that cap; capped marks stay visible at the plot edge with a heavier outline and retain their exact values in the inspector and tooltip.

Scatter plots, maps, and entity timelines can add a deduplicated relationship layer through Graph Properties. The layer can be off, hover-only, or always visible; it also exposes the strongest-connections limit, evidence floor, relationship type, secondary-node sizing, and line strength. Secondary entities retain their native position and appear only once even when several primary entities connect to them. Maps render elevated globe arcs, while entity timelines connect marks in date/value space. The default shows one strongest connection per node with an always-visible subtle line. These choices persist in saved-view URLs.

Entities are a global data role: they can be network nodes, a Scatter axis, the Bar dimension, Timeline marks, Matrix columns, or Table rows. Network nodes can also be collections, connected by the published entities they share. The Table type also builds custom lists of transcript files and collections with selectable columns, sorting, search, row limits, evidence inspection, and CSV export. Entity-backed views share the same category, confidence, collection, evidence, label, and publication controls.

The Book type is a contiguous area view of titles explicitly identified in transcript text. The leading title keeps an upright 2:3 book-cover shape, while the remaining mention-weighted blocks flex to fill all available chart space. Their proportions favor near-square blocks for short titles and progressively wider blocks for longer titles so serif cover text wraps legibly. Title type scales with cell area, and cells too small for a complete title remain tooltip-only; shade is controlled independently by the selected prominence metric. Titles are extracted only from book, novel, or memoir cues; each mark opens its source evidence in the inspector.

The Map type renders a rotatable Three.js globe with SVG country boundaries and location-entity nodes. A Moon sized proportionally to Earth follows a time-compressed display orbit at its mean physical distance while keeping its near side tidally locked toward Earth. Animation starts paused and is controlled by Play/Pause beside Export PNG; dragging rotates the complete Earth–Moon system independently. Graph Properties includes a 2–10 second Moon transit control. While any part of the Moon is inside the viewport, its pass is timed to the selected duration and Earth spin is slowed proportionally: 2 seconds retains normal Earth speed and 10 seconds uses 20% speed. The lunar orbit and Earth spin both resume their normal animation speeds off-screen, including a clearly visible 60-second Earth revolution. A distant telephoto camera outside the lunar orbit preserves Earth’s original centered map scale and keeps the Moon near its familiar apparent size: the Moon starts upper-right on the far side, transits behind Earth, and crosses in front of Earth on the near half-orbit. Celestial-body entity markers are attached to their rendered body, so the Moon node, label, hit target, and relationships follow the lunar surface; projected labels remain hidden when Earth occludes their 3D nodes. Terrestrial node position comes only from the reviewed `data/location_coordinates.json` gazetteer; ambiguous and unmapped names are reported but never guessed onto the globe. Map nodes retain the same collection, confidence, prominence-inflation, size, label, and evidence-inspection controls as other entity views.

## Run locally

From this directory:

```sh
python3 -m http.server 4173
```

## Entity identity review

Catalog rebuilds apply confirmed identity merges from `data/entity_aliases.json`. Each entry names one canonical entity and the exact aliases—acronyms, OCR variants, possessives, or alternate spellings—that should resolve to it. Similar names are never merged solely because they look alike.

Every rebuild also writes `data/duplicate_candidates.json` and includes the ranked queue in `data/catalog.json`. In the builder, open **Refine → Review possible duplicates** to inspect that queue. After confirming a pair refers to the same real entity, add the non-canonical spelling to the canonical record in `data/entity_aliases.json`; the next rebuild merges its mentions, documents, evidence, and edges.

Open <http://localhost:4173>.

## Rebuild the catalog

The deployed catalog is built from the public
[`ufo-files/machine-data`](https://github.com/ufo-files/machine-data) repository.
For a local rebuild, clone that repository and pass its path to the builder:

```sh
git clone https://github.com/ufo-files/machine-data.git /tmp/ufo-files-machine-data
python3 scripts/build_catalog.py --input /tmp/ufo-files-machine-data
```

If `--input` is omitted, the builder continues to use `/Volumes/OCR & Transcriptions 1`
for workstation builds. Output is written to `data/catalog.json` by default.

Only files carrying the expected `ufo-files-archive-ocr/v1` or `ufo-files-archive-media-transcripts/v1` metadata schema are included. Hidden operational directories, logs, quarantine, and this app are excluded. Source transcript content is never rewritten or copied; the catalog stores metadata, derived entity records, and short evidence excerpts.

The reviewed identity registry imported from the legacy project is checked in as `data/curated_entities.json`. To refresh it from a legacy checkout:

```sh
python3 scripts/import_legacy_registry.py /path/to/legacy/relationship-graph
python3 scripts/build_catalog.py
```

## Entity and relationship policy

- Curated identity matches take precedence over heuristics.
- Extraction confidence and classification confidence remain separate.
- Unreviewed people require at least three mentions across two documents.
- Book titles require one explicit book, novel, or memoir cue and reserve space in the published catalog.
- Other unreviewed entities require two mentions across two documents; dates require two mentions.
- Generic roles, field labels, document headings, partial phrases, all-caps phrases, and common OCR artifacts are rejected rather than treated as people.
- Typed relationships require both entities and a relation cue in the same segment.
- Generic co-mentions require at least two distinct segments.
- Sections containing more than 30 entities are not expanded into a clique.

Raw mention totals are retained, but entity-backed visualizations use context-adjusted mentions and independent-document counts as their default prominence metrics. The adjustment counts an exact context once per document, counts an exact context repeated across three or more documents once overall, and excludes `Requester:` metadata. Mention adjustment and prominence-inflation risk are separate: ordinary repetition within documents can reduce a mention total, while warning rings require a material loss of independent-document coverage. Each entity includes both rates, risk level, and the contributing repetition signals. Raw metrics remain explicit builder options and table fields. This is a transparent corpus-quality heuristic, not a claim about a person or entity's real-world importance.

The Significant People, Significant Places, and Significant Terms presets exclude high-inflation entities by default. The Refine panel can include them again for inspection; elevated and high-risk scatter points are marked with a dashed ring.

The catalog publishes up to 250 explicitly cued books plus the highest-evidence remaining entities, within the 1,200-entity payload cap, and up to 4,000 accepted edges. The full accepted and published counts, along with those caps, are explicit in the catalog metadata.

## Test

```sh
python3 -m unittest discover -s tests
node --check app.js
node --check map-globe.js
```

For GitHub Pages, publish this directory as the site root. `.nojekyll` is included.

## Automatic updates

Every push to `ufo-files/machine-data` updates `.machine-data-revision` through a
builder-scoped deploy key. That rebuild request immediately starts the `Rebuild
graph from machine-data` workflow, which rebuilds and tests the catalog, records
the exact machine-data commit in the catalog metadata, commits the refreshed
catalog, and deploys the static builder to GitHub Pages. The workflow can also be
run manually or triggered with a `machine-data-updated` `repository_dispatch`
event.

After a completed rebuild, the separate `Refresh README graph screenshots`
workflow captures every top-level graph type, commits the refreshed previews, and
updates the README gallery. It also runs after late rebuild failures in case the
catalog commit completed before deployment failed, runs when screenshot tooling
changes on `main`, and can be started manually. It does not run for pull requests.

## Map data and licenses

The vendored Three.js module is version 0.185.1 and is distributed under the MIT license in `vendor/THREE-LICENSE.txt`. Country boundaries in `assets/map/world-countries.svg` are generated from Natural Earth’s public-domain 1:110m Admin 0 Countries dataset using `scripts/geojson_to_svg.py`. The Moon surface is a flat grayscale treatment derived from NASA Scientific Visualization Studio’s 2K LRO color map; source and credit details are in `assets/map/moon-texture-source.txt`.
