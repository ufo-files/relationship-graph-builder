# UFO Files Graph Builder

A dependency-free, static graph builder for completed OCR and media transcripts in the UFO Files archive. It is designed for GitHub Pages: there is no server, database, CDN dependency, or runtime build step.

## Product model

The builder asks for five decisions:

1. **Graph type** — network, scatter, bars, timeline, matrix, or table.
2. **Data roles** — nodes/relationships or X and Y fields, depending on the shape.
3. **Encoding** — size, monochrome value scales, and labels.
4. **Refinement** — collections, entity types, confidence, evidence floor, and mark count.
5. **Output** — a URL-addressable view, browser save, exported SVG, or table CSV.

The default view is an ordinary builder configuration and uses the same rendering and data path as every saved view.

Entities are a global data role: they can be network nodes, a Scatter axis, the Bar dimension, Timeline marks, Matrix columns, or Table rows. Network nodes can also be collections, connected by the published entities they share. The Table type also builds custom lists of transcript files and collections with selectable columns, sorting, search, row limits, evidence inspection, and CSV export. Entity-backed views share the same category, confidence, collection, evidence, label, and publication controls.

## Run locally

From this directory:

```sh
python3 -m http.server 4173
```

Open <http://localhost:4173>.

## Rebuild the catalog

The deployed catalog is built from the public
[`ufo-files/machine-data`](https://github.com/ufo-files/machine-data) repository.
For a local rebuild, clone that repository and pass its path to the builder:

```sh
git clone https://github.com/ufo-files/machine-data.git /tmp/ufo-files-machine-data
python3 scripts/build_catalog.py --input /tmp/ufo-files-machine-data
```

If `--input` is omitted, the builder continues to use `/Volumes/OCR & Transcriptions`
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
- Other unreviewed entities require two mentions across two documents; dates require two mentions.
- Generic roles, field labels, document headings, partial phrases, all-caps phrases, and common OCR artifacts are rejected rather than treated as people.
- Typed relationships require both entities and a relation cue in the same segment.
- Generic co-mentions require at least two distinct segments.
- Sections containing more than 30 entities are not expanded into a clique.

The catalog publishes the highest-evidence 1,200 accepted entities and up to 4,000 accepted edges for a compact browser payload. The full accepted and published counts, along with those caps, are explicit in the catalog metadata.

## Test

```sh
python3 -m unittest discover -s tests
node --check app.js
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
