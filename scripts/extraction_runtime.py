"""Bounded document extraction with content-addressed, atomic JSON checkpoints.

The cache contains independent evidence, never final graph counts. Reduction is
always in input order, even when workers finish out of order.
"""
from __future__ import annotations

import collections
import concurrent.futures
import gzip
import hashlib
import json
import multiprocessing
import os
from pathlib import Path
import sys
import tempfile
import time
import unicodedata
import zlib


CACHE_SCHEMA = "graph-document-extraction/v1"
EXTRACTION_DATA = (
    "curated_entities.json", "entity_aliases.json", "book_catalog.json",
    "craft_taxonomy.json", "species_taxonomy.json", "astronomy_taxonomy.json",
    "curated_events.json",
)


def hash_files(paths, root: Path, seed: str) -> str:
    digest = hashlib.sha256(seed.encode())
    for path in sorted(set(paths)):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        if not path.is_file():
            digest.update(b"missing\0")
            continue
        file_digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                file_digest.update(chunk)
        digest.update(file_digest.digest())
    return digest.hexdigest()


def extraction_fingerprint(scripts: Path, data: Path, rules: Path, language: str) -> str:
    runtime = f"{CACHE_SCHEMA}:{sys.version}:{unicodedata.unidata_version}"
    code = hash_files(scripts.glob("*.py"), scripts, runtime)
    config = hash_files((data / name for name in EXTRACTION_DATA), data, code)
    return hash_files([rules], rules.parent, config + language)


def document_dependencies(path: Path, root: Path) -> list[Path]:
    """Include sidecars and all paired artifacts, including validation inputs."""
    dependencies = [path]
    if path.suffix.lower() == ".tsv":
        dependencies.append(path.with_suffix(".source.json"))
    pair_root = None
    if path.name == "document.json":
        pair_root = path.parent
    elif path.name == "translation.txt" and path.parent.name == "en":
        pair_root = path.parent.parent
    elif path.suffix.lower() == ".txt":
        # Legacy English exports may use a different filename.
        try:
            with path.open(encoding="utf-8", errors="replace") as stream:
                metadata = json.loads(stream.readline())
            if isinstance(metadata, dict) and "-search-text/" in str(metadata.get("schema", "")):
                pair_root = path.parent.parent
        except (ValueError, OSError):
            pass
    if pair_root is not None:
        dependencies.extend(item for item in pair_root.rglob("*") if item.is_file())
    for dependency in dependencies:
        if not dependency.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Extraction dependency escapes input root: {dependency}")
    return dependencies


def document_key(path: Path, root: Path, fingerprint: str) -> str:
    return hash_files(document_dependencies(path, root), root, fingerprint)


def read_checkpoint(path: Path, key: str):
    try:
        with gzip.open(path, "rt", encoding="utf-8") as stream:
            envelope = json.load(stream)
        payload = envelope["payload"]
        if (not isinstance(payload, str)
                or envelope["schema"] != CACHE_SCHEMA or envelope["key"] != key
                or hashlib.sha256(payload.encode()).hexdigest() != envelope["sha256"]):
            return False, None
        return True, json.loads(payload)
    except (OSError, EOFError, ValueError, KeyError, TypeError, zlib.error):
        return False, None


def write_checkpoint(path: Path, key: str, result) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    envelope = dict(schema=CACHE_SCHEMA, key=key, payload=payload,
                    sha256=hashlib.sha256(payload.encode()).hexdigest())
    # A killed worker can leave a temporary file, but never a partial checkpoint.
    fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as raw:
            with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=1, mtime=0) as stream:
                stream.write(json.dumps(envelope, ensure_ascii=False).encode())
            raw.flush()
            os.fsync(raw.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


_CONTEXT = None
_EXTRACT = None
_FINGERPRINT = None
_CACHE = None
_SPOOL = None


def initialize_worker(context, extract, fingerprint, cache, spool):
    global _CONTEXT, _EXTRACT, _FINGERPRINT, _CACHE, _SPOOL
    _CONTEXT, _EXTRACT, _FINGERPRINT, _CACHE = context, extract, fingerprint, cache
    _SPOOL = spool


def extract_one(path, context, extract, fingerprint, cache, spool=None):
    started = time.perf_counter()
    key = document_key(path, context["input_root"], fingerprint) if cache else None
    checkpoint = cache / key[:2] / (key + ".json.gz") if cache else None
    if checkpoint:
        hit, result = read_checkpoint(checkpoint, key)
        if hit:
            return ((checkpoint, key) if spool else result), True, {"cacheRead": time.perf_counter() - started}
    fingerprint_seconds = time.perf_counter() - started
    result, timings = extract(path, context)
    timings["fingerprint"] = fingerprint_seconds
    if checkpoint:
        started = time.perf_counter()
        # Recheck before publication so mutable inputs cannot poison a key.
        if document_key(path, context["input_root"], fingerprint) != key:
            raise ValueError(f"Input changed during extraction: {path}")
        write_checkpoint(checkpoint, key, result)
        timings["checkpointWrite"] = time.perf_counter() - started
    elif spool:
        key = hashlib.sha256(path.as_posix().encode()).hexdigest()
        checkpoint = spool / (key + ".json.gz")
        write_checkpoint(checkpoint, key, result)
    return ((checkpoint, key) if spool else result), False, timings


def worker_extract(path):
    return extract_one(path, _CONTEXT, _EXTRACT, _FINGERPRINT, _CACHE, _SPOOL)


def iter_extracted_documents(paths, context, extract, fingerprint, cache,
                             workers, interval, stats):
    started = last_log = time.perf_counter()
    completed = 0
    finished = 0
    totals = collections.Counter()

    def progress(path, force=False):
        nonlocal last_log
        now = time.perf_counter()
        if interval and (force or now - last_log >= interval):
            elapsed = now - started
            print(f"[catalog] {completed}/{len(paths)} documents merged; {finished} extracted; "
                  f"cache hits={stats['cacheHits']} misses={stats['cacheMisses']}; "
                  f"{completed / max(elapsed, .001):.2f} docs/s; "
                  f"elapsed={elapsed:.1f}s; current={path.relative_to(context['input_root'])}",
                  file=sys.stderr, flush=True)
            last_log = now

    def accept(response):
        nonlocal finished
        result, hit, timings = response
        finished += 1
        stats["cacheHits" if hit else "cacheMisses"] += 1
        totals.update(timings)
        stats["extractorSeconds"] = dict(totals)
        return result

    if not paths:
        return
    progress(paths[0], True)
    if workers == 1:
        for path in paths:
            result = accept(extract_one(path, context, extract, fingerprint, cache))
            completed += 1
            progress(path, completed == len(paths))
            yield path, result
        return
    # Spawn avoids inheriting the growing parent catalog. Keep the work queue
    # bounded but replenish it on ANY completion. Out-of-order evidence stays on
    # disk, so one large document neither idles the pool nor fills parent memory.
    with tempfile.TemporaryDirectory(prefix="graph-extraction-") as temporary:
        with concurrent.futures.ProcessPoolExecutor(
            max_workers=workers, mp_context=multiprocessing.get_context("spawn"),
            initializer=initialize_worker,
            initargs=(context, extract, fingerprint, cache, Path(temporary)),
        ) as executor:
            remaining = iter(enumerate(paths))
            pending = {}
            ready = {}

            def submit_next():
                item = next(remaining, None)
                if item is not None:
                    index, path = item
                    pending[executor.submit(worker_extract, path)] = index

            for _ in range(min(len(paths), workers * 2)):
                submit_next()
            while pending:
                done, _ = concurrent.futures.wait(pending, timeout=interval or 30,
                                                 return_when=concurrent.futures.FIRST_COMPLETED)
                for future in done:
                    index = pending.pop(future)
                    ready[index] = accept(future.result())
                    submit_next()
                while completed in ready:
                    checkpoint, key = ready.pop(completed)
                    valid, result = read_checkpoint(checkpoint, key)
                    if not valid:
                        raise ValueError(f"Completed extraction checkpoint is unreadable: {checkpoint}")
                    if not cache:
                        checkpoint.unlink()
                    path = paths[completed]
                    completed += 1
                    progress(path, completed == len(paths))
                    yield path, result
                if completed < len(paths):
                    progress(paths[completed])
