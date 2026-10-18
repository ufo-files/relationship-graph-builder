"""Literal drug and technology references, with reviewed aliases and source offsets."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

# Patterns are intentionally specific: bare acid, pot, mushrooms, AI and psi are
# ambiguous and are not aliases. These are mentions, not verified capabilities.
TOPICS = {
    "drugs": [
        ("lsd", "LSD", r"lysergic\s+acid\s+diethylamide|LSD(?:[ -]?25)?"),
        ("5-meo-dmt", "5-MeO-DMT", r"5[ -]?MeO[ -]?DMT|5[ -]methoxy[ -]N,?N[ -]dimethyltryptamine"),
        ("dmt", "DMT", r"N,?N[ -]dimethyltryptamine|dimethyltryptamine|DMT"),
        ("psilocybin", "Psilocybin", r"psilocybin(?:e)?|psilliciban|psilocyban|psilocyben|magic[ -]+mushrooms?"),
        ("psilocin", "Psilocin", r"psilocin"),
        ("mescaline", "Mescaline", r"mescalin(?:e)?"),
        ("peyote", "Peyote", r"peyote"),
        ("ayahuasca", "Ayahuasca", r"ayahuasca|aya[ -]huasca"),
        ("ketamine", "Ketamine", r"ketamine"),
        ("mdma", "MDMA", r"MDMA|methylenedioxymethamphetamine"),
        ("cannabis", "Cannabis", r"cannabis|marijuana|marihuana|hashish|tetrahydrocannabinol|THC"),
        ("ibogaine", "Ibogaine", r"ibogaine"),
        ("salvinorin", "Salvinorin A", r"salvinorin\s+A|salvia\s+divinorum"),
        ("scopolamine", "Scopolamine", r"scopolamine"),
        ("pcp", "PCP", r"phencyclidine|PCP"),
        ("amphetamine", "Amphetamines", r"amphetamines?|methamphetamines?|benzedrine"),
        ("barbiturates", "Barbiturates", r"barbiturates?|pentobarbital|sodium\s+pentothal|thiopental"),
        ("cocaine", "Cocaine", r"cocaine"),
        ("heroin", "Heroin", r"heroin|diacetylmorphine"),
        ("morphine", "Morphine", r"morphine"),
        ("opium", "Opium", r"opium"),
    ],
    "technologies": [
        ("radar", "Radar", r"radars?|RADAR|radio\s+detection\s+and\s+ranging"),
        ("sonar", "Sonar", r"sonars?|sound\s+navigation\s+and\s+ranging"),
        ("lidar", "Lidar", r"lidars?|light\s+detection\s+and\s+ranging"),
        ("psionics", "Psionics", r"psionics?"),
        ("emp", "EMP", r"electromagnetic[ -]+pulses?|EMP"),
        ("telepathy", "Telepathy", r"telepathy|telepathic"),
        ("remote-viewing", "Remote viewing", r"remote[ -]+viewing"),
        ("antigravity", "Antigravity", r"anti[ -]?gravity|gravitational[ -]+propulsion|gravity[ -]+propulsion"),
        ("propulsion", "Propulsion", r"propulsion"),
        ("directed-energy", "Directed energy", r"directed[ -]+energy|particle[ -]+beam(?:s)?"),
        ("laser", "Lasers", r"lasers?"),
        ("microwave", "Microwaves", r"microwaves?"),
        ("infrared", "Infrared", r"infra[ -]?red"),
        ("radio", "Radio", r"radios?|radio[ -]+frequency|RF\s+(?:signals?|systems?|transmitters?)"),
        ("stealth", "Stealth", r"stealth"),
        ("satellite", "Satellites", r"satellites?"),
        ("artificial-intelligence", "Artificial intelligence", r"artificial[ -]+intelligence|machine[ -]+learning|neural[ -]+networks?"),
        ("quantum-computing", "Quantum computing", r"quantum[ -]+comput(?:ing|ers?)"),
        ("holography", "Holography", r"hologra(?:ms?|phy|phic)"),
        ("nanotechnology", "Nanotechnology", r"nanotechnolog(?:y|ies)|nano[ -]?bots?"),
        ("nuclear", "Nuclear technology", r"nuclear[ -]+(?:reactors?|weapons?|propulsion|power|technology)|atomic[ -]+(?:bombs?|weapons?)"),
    ],
}
PATTERNS = {topic: re.compile(r"(?<!\w)(?:" + "|".join(
    f"(?P<t{index}>{pattern})" for index, (_, _, pattern) in enumerate(terms)
) + r")(?!\w)", re.I) for topic, terms in TOPICS.items()}


def topic_observations_for_segment(text: str, document_id: str, source: str, segment: int | str) -> dict:
    result = {topic: [] for topic in TOPICS}
    for topic, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            term_id = TOPICS[topic][int(match.lastgroup[1:])][0]
            # Prevent suffix matches inside larger hyphenated chemical names.
            if term_id == "dmt" and re.search(r"\w-\s*$", text[max(0, match.start()-8):match.start()]):
                continue
            key = f"{topic}:{document_id}:{segment}:{match.start()}:{term_id}"
            result[topic].append({
                "id": "topic-" + hashlib.sha1(key.encode()).hexdigest()[:16],
                "termId": term_id, "documentId": document_id, "source": source,
                "segment": segment, "start": match.start(), "end": match.end(),
                "matchedText": match.group(),
                "excerpt": text[max(0, match.start()-75):min(len(text), match.end()+125)],
            })
    return result


def write_topic_catalogs(directory: Path, observations: dict, documents: list[dict], catalog_input: dict, generated_at: str, max_bytes: int = 20 * 1024 * 1024) -> dict:
    """Write manifests and bounded occurrence shards, replacing obsolete shards."""
    directory.mkdir(parents=True, exist_ok=True)
    manifests = {}
    for topic, terms in TOPICS.items():
        rows = observations[topic]
        ids = {row["documentId"] for row in rows}
        parts, chunk, size = [], [], 3

        def flush():
            nonlocal chunk, size
            if not chunk:
                return
            name = f"{topic}-{len(parts)+1:03d}.json"
            (directory / name).write_text("[" + ",".join(chunk) + "]\n", encoding="utf-8")
            parts.append(name)
            chunk, size = [], 3

        for row in rows:
            encoded = json.dumps(row, ensure_ascii=False, separators=(",", ":"))
            row_size = len(encoded.encode("utf-8")) + 1
            if row_size + 3 > max_bytes:
                raise ValueError("Topic occurrence exceeds shard size limit")
            if size + row_size > max_bytes:
                flush()
            chunk.append(encoded)
            size += row_size
        flush()
        for old in directory.glob(f"{topic}-*.json"):
            if old.name not in parts:
                old.unlink()
        payload = {
            "schema": "ufo-files-topic-mentions/v1", "topic": topic,
            "generatedAt": generated_at, "input": catalog_input,
            "counts": {"scannedDocuments": len(documents), "mentions": len(rows), "documents": len(ids)},
            "terms": [{"id": key, "label": label} for key, label, _ in terms],
            "documents": [{key: doc[key] for key in ("id", "path", "title", "source")} for doc in documents if doc["id"] in ids],
            "parts": parts,
        }
        (directory / f"{topic}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        manifests[topic] = payload
    return manifests
