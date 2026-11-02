# Catalog extraction performance

Catalog builds extract evidence independently for each document, then merge it
in the original sorted input order. Entity counts, examples, floating-point
accumulation, cross-source relationships, lineage, duplicate detection, review
overlays, and output sharding remain in the global assembly stage.

## Running a build

```sh
python3 scripts/build_catalog.py \
  --input /path/to/machine-data \
  --input-repository ufo-files/machine-data \
  --input-revision REVISION \
  --paired-language en \
  --require-data \
  --workers 4 \
  --cache-dir .catalog-cache \
  --profile-report /tmp/catalog-profile.json
```

The default is one extraction process with no persistent cache. Production uses
four spawned workers, configurable through the `GRAPH_EXTRACTION_WORKERS`
repository variable, and a persistent cache under the runner's tool-cache
directory. PR builds use two workers without accessing the production cache.
At most twice the worker count is submitted at once. Workers receive extraction
configuration, not the parent's accumulated catalog. The queue is replenished
whenever any worker finishes, so a slow document does not idle other workers.
Out-of-order evidence waits on disk (in checkpoints, or a temporary spool when
caching is disabled) until it can be merged in order. Large documents still
require memory proportional to their own evidence, and global assembly still
retains the catalog in memory.

Aggregation stores context document membership in the existing weight maps,
shares those maps for single-source contexts, and detaches them when another
source appears. Normalized context strings are shared across entities. Empty
qualifier containers are not allocated, and lineage transcript text is released
after family assignment. These changes reduce memory pressure without changing
evidence counts or weighting.
During a build, garbage collection keeps collecting young temporary objects but
defers repeated full-generation scans of the live graph. The caller's original
thresholds are restored on success or failure. Single-source CI jobs check out
only their source directory instead of downloading every source.
Rejected and unpublished candidate state is released once its summary counts
are retained. Duplicate detection precomputes normalized names and uses
SequenceMatcher's upper bounds to skip pairs that cannot meet the existing
thresholds; acronym checks and final similarity scores are unchanged.

Clock catalogs that exceed 80 MiB are written as a small manifest plus bounded
document/observation files under `data/clock-mentions`. The clock loader accepts
both inline catalogs and manifests and checks shard and total counts before
installing the catalog. Each shard is at most 20 MiB, keeping generated files
below the repository's 95 MiB publishing limit.

Progress is flushed to stderr every 30 seconds while parallel extraction runs,
including the next document awaiting ordered merge, the merged document count,
cache hits/misses, throughput, and elapsed time. `--progress-interval 0` disables
logging. Serial builds report progress between documents. The JSON timing report
records setup, extraction/reduction, global assembly, and individual extractors.
Extractor times sum worker durations and must not be read as wall-clock totals.
The production workflow publishes these timings in its job summary.

## Cache validity and recovery

Each checkpoint contains JSON evidence compressed with gzip, a schema, its
content key, and a payload checksum. Files are written and flushed to a temporary
file, then atomically renamed. Restarting the same command reuses every complete
checkpoint, even if the earlier build failed before publishing any catalogs.
Unreadable, truncated, or checksum-invalid entries are recomputed. Temporary
`.pending-*` files left by a killed process are ignored.

Keys include document paths and contents, transcript sidecars, all files in a
paired-document bundle, the selected language, extraction Python source, entity
registries, extraction taxonomies, curated discussion events, and epistemic
rules, plus the Python and Unicode runtime versions. Missing dependencies are represented in the key. Contents are checked
again before a new checkpoint is published. The input checkout should remain
immutable throughout a build.

Global analyst reviews, claims, location metadata, and final graph relationships
are applied afresh on every build. A change to them does not require repeating
independent text extraction. A change to extraction code or rules invalidates
cached evidence conservatively. Old content keys remain on disk; remove an old
cache directory when no build is using it if disk space needs reclaiming. Cache
files are optional accelerators and are never committed or published.

## Matching and validation

Entity alias matching uses a required-word index to select precompiled literal
regexes. Matches retain the original boundary rules, whitespace behavior,
case sensitivity, alias precedence, and non-overlap behavior. Book aliases are
searched only when the segment has a required book-context cue. Species matching
also selects candidate patterns by required words while preserving taxonomy
order and context/source restrictions.

Use a fixed input sample spanning source types, paired translations, short
reports, and long transcripts to iterate:

```sh
python3 scripts/benchmark_catalog.py \
  --input /tmp/representative-machine-data \
  --output /tmp/catalog-benchmark \
  --baseline BASE_COMMIT \
  --workers 4
```

The benchmark runs the original builder, optimized serial extraction, parallel
cold-cache extraction, and parallel warm-cache extraction. It compares every
generated JSON file recursively, ignoring only `generatedAt`. It uses empty
claims for a partial sample; full production validation must use the normal
claims and `--require-data`. Choose a fresh output directory for each benchmark.
Add `--profile` in a separate run to capture cProfile reports for the serial
modes; do not compare profiled and unprofiled durations as speedup measurements.

Regression tests cover Unicode and overlapping aliases, ordered parallel output,
cache invalidation, corrupt entries, input changes during extraction, and atomic
checkpoint recovery. Run `python3 -m unittest discover -s tests -v`.
