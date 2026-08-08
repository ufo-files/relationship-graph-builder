#!/usr/bin/env python3
"""Build a compact, static graph catalog from UFO Files transcripts.

The input files remain the source of truth. This script publishes conservative,
evidence-backed entity candidates and relationships for the browser app; it does
not rewrite or copy transcript text.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import difflib
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


SCHEMA = "ufo-files-relationship-catalog/v1"
REPEATED_CONTEXT_DOCUMENT_FLOOR = 3
DEFAULT_INPUT = Path("/Volumes/OCR & Transcriptions 1")
SKIP_PARTS = {
    ".git", ".state", ".tmp", ".Spotlight-V100", ".Trashes",
    "relationship-graph-builder", "logs", "quarantine",
}
KNOWN = {
    "AARO": ("All-domain Anomaly Resolution Office", "government_agency"),
    "CIA": ("Central Intelligence Agency", "government_agency"),
    "DIA": ("Defense Intelligence Agency", "government_agency"),
    "DOE": ("Department of Energy", "government_agency"),
    "FBI": ("Federal Bureau of Investigation", "government_agency"),
    "NASA": ("NASA", "government_agency"),
    "NSA": ("National Security Agency", "government_agency"),
    "NRO": ("National Reconnaissance Office", "government_agency"),
    "NORAD": ("NORAD", "government_agency"),
    "USAF": ("U.S. Air Force", "government_agency"),
    "U.S. Air Force": ("U.S. Air Force", "government_agency"),
    "United States Air Force": ("U.S. Air Force", "government_agency"),
    "Department of Defense": ("Department of Defense", "government_agency"),
    "Department of War": ("Department of War", "government_agency"),
    "Federal Aviation Administration": ("Federal Aviation Administration", "government_agency"),
    "National Archives": ("National Archives", "government_agency"),
    "Project Blue Book": ("Project Blue Book", "program"),
    "KONA BLUE": ("KONA BLUE", "program"),
    "Majestic 12": ("Majestic 12", "program"),
    "MJ-12": ("Majestic 12", "program"),
    "Area 51": ("Area 51", "location"),
    "Roswell": ("Roswell", "location"),
    "Project Moon Dust": ("Project Moon Dust", "program"),
    "Moon": ("Moon", "location"),
    "the Moon": ("Moon", "location"),
    "lunar surface": ("Moon", "location"),
    "far side of the Moon": ("Far Side of the Moon", "location"),
    "far side of Moon": ("Far Side of the Moon", "location"),
    "lunar far side": ("Far Side of the Moon", "location"),
    "back side of the Moon": ("Far Side of the Moon", "location"),
    "backside of the Moon": ("Far Side of the Moon", "location"),
    "UAP": ("UAP", "subject"),
    "UFO": ("UFO", "subject"),
    "UFOs": ("UFO", "subject"),
    "FOIA": ("FOIA", "subject"),
    "Nonviolent ETI": ("Nonviolent ETI", "subject"),
    "ETI": ("Extraterrestrial Intelligence", "subject"),
    "Extraterrestrial Intelligence": ("Extraterrestrial Intelligence", "subject"),
    "extraterrestrial beings": ("Extraterrestrial Intelligence", "subject"),
    "extraterrestrial life": ("Extraterrestrial Intelligence", "subject"),
    "alien intelligent life": ("Extraterrestrial Intelligence", "subject"),
    "contiguous universe": ("Contiguous Universe", "subject"),
    "Treaty on the Prevention of the Placement of Weapons in Outer Space": (
        "Treaty on the Prevention of the Placement of Weapons in Outer Space", "subject"
    ),
    "War in Space": ("War in Space", "subject"),
    "zero point energy": ("Zero-Point Energy", "subject"),
    "Defense Support Program": ("Defense Support Program", "program"),
    "USAF DSP satellite program": ("Defense Support Program", "program"),
    "DSP satellite program": ("Defense Support Program", "program"),
    "DSP": ("Defense Support Program", "program"),
    "Fastwalker": ("Fastwalker", "program"),
    "Fastwalkers": ("Fastwalker", "program"),
    "Sentry Eagle": ("Sentry Eagle", "program"),
    "Operation Desert Shield": ("Operation Desert Shield", "program"),
    "Operation Desert Storm": ("Operation Desert Storm", "program"),
    "Desert Storm": ("Operation Desert Storm", "program"),
    "Apollo 14": ("Apollo 14", "program"),
    "RC-135": ("RC-135", "program"),
    "WC-135": ("WC-135", "program"),
    "Star Wars missile-defense system": ("Strategic Defense Initiative", "program"),
    "anti-satellite weapons": ("Anti-Satellite Weapons", "subject"),
    "Scientific Study of Unidentified Flying Objects": (
        "Scientific Study of Unidentified Flying Objects", "book"
    ),
    "Scientific Study of Unidentified Flying": ("Scientific Study of Unidentified Flying Objects", "book"),
    "Colorado University Study on UFOs": ("Scientific Study of Unidentified Flying Objects", "book"),
    "Blue Book Project": ("Project Blue Book", "program"),
    "Grenadian UFO Resolution": ("Grenadian UFO Resolution", "subject"),
    "Grenadian resolution": ("Grenadian UFO Resolution", "subject"),
    "First International Congress on the UFO Phenomenon": (
        "First International Congress on the UFO Phenomenon", "organization"
    ),
    "First International Congress on UFO Phenomenon": (
        "First International Congress on the UFO Phenomenon", "organization"
    ),
    "First International Congress": ("First International Congress on the UFO Phenomenon", "organization"),
    "Special Political Committee": ("UN Special Political Committee", "government_agency"),
    "Committee on the Peaceful Uses of Outer Space": (
        "UN Committee on the Peaceful Uses of Outer Space", "government_agency"
    ),
    "Outer Space Committee": ("UN Committee on the Peaceful Uses of Outer Space", "government_agency"),
    "Outerspace Committee": ("UN Committee on the Peaceful Uses of Outer Space", "government_agency"),
    "Intercontinental UFO Galactic Spacecraft-Research and Analytic Network": (
        "Intercontinental UFO Galactic Spacecraft-Research and Analytic Network", "organization"
    ),
    "ICUFON": ("Intercontinental UFO Galactic Spacecraft-Research and Analytic Network", "organization"),
    "Quantrek": ("Quantrek", "organization"),
    "UN clearinghouse": ("UN UFO Clearinghouse", "organization"),
    "Smithsonian Astrophysical Observatory": ("Smithsonian Astrophysical Observatory", "organization"),
    "National Academy of Sciences": ("National Academy of Sciences", "organization"),
    "Academy of Sciences": ("National Academy of Sciences", "organization"),
    "United Nations Educational, Scientific and Cultural Organization": ("UNESCO", "government_agency"),
    "Educational, Scientific and Cultural Organization": ("UNESCO", "government_agency"),
    "World Health Organization": ("World Health Organization", "government_agency"),
    "Health Orgzniazation": ("World Health Organization", "government_agency"),
    "International Atomic Energy Agency": ("International Atomic Energy Agency", "government_agency"),
    "International Atomic Energy": ("International Atomic Energy Agency", "government_agency"),
    "United Nations Environment Programme": ("United Nations Environment Programme", "government_agency"),
    "Committee on Science and Technology": ("UN Committee on Science and Technology", "government_agency"),
    "Alberta Fireball": ("Alberta Fireball", "subject"),
    "Edgar Mitchell": ("Edgar Mitchell", "person"),
    "Edgar D. Mitchell": ("Edgar Mitchell", "person"),
    "Carol Rosin": ("Carol Rosin", "person"),
    "Wernher von Braun": ("Wernher von Braun", "person"),
    "Bob Fish": ("Bob Fish", "person"),
    "Dan Sherman": ("Dan Sherman", "person"),
    "Ahsan Iqbal": ("Ahsan Iqbal", "person"),
    "J. Allen Hynek": ("J. Allen Hynek", "person"),
    "Jacques Vallee": ("Jacques Vallee", "person"),
    "Larry Coyne": ("Larry Coyne", "person"),
    "Gordon Cooper": ("Gordon Cooper", "person"),
    "Stanton Friedman": ("Stanton Friedman", "person"),
    "James Cornell": ("James Cornell", "person"),
    "E.U. Condon": ("Edward U. Condon", "person"),
    "Sir Eric Gairy": ("Eric Gairy", "person"),
    "PM Gairy": ("Eric Gairy", "person"),
    "L. Gordon Cooper": ("Gordon Cooper", "person"),
    "LT.COL. Larry Coyne": ("Larry Coyne", "person"),
    "Morocco": ("Morocco", "location"),
    "Moroccan": ("Morocco", "location"),
    "Grenada": ("Grenada", "location"),
    "Acapulco": ("Acapulco", "location"),
    "Bermuda": ("Bermuda", "location"),
    "El Segundo": ("El Segundo", "location"),
    "MacDill AFB": ("MacDill Air Force Base", "location"),
    "Phoenix": ("Phoenix", "location"),
    "China": ("China", "location"),
    "Russia": ("Russia", "location"),
    "Pakistan": ("Pakistan", "location"),
    "Australia": ("Australia", "location"),
    "Spain": ("Spain", "location"),
    "Canada": ("Canada", "location"),
    "Alberta": ("Alberta", "location"),
    "Ohio": ("Ohio", "location"),
    "Florida": ("Florida", "location"),
    "Miami": ("Miami", "location"),
    "Dayton": ("Dayton", "location"),
    "Cambridge": ("Cambridge", "location"),
    "Massachusetts": ("Massachusetts", "location"),
}

ADMINISTRATIVE_CONTEXT = re.compile(r"^\s*(?:foia\s+)?requester\s*:", re.IGNORECASE)


def known_lookup_key(value: str) -> str:
    """Normalize Unicode OCR variants for stable known-entity lookup."""
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


KNOWN_LOOKUP = {known_lookup_key(key): key for key in KNOWN}
KNOWN_PATTERN = re.compile(
    r"(?<![\w-])(" + "|".join(sorted((re.escape(k) for k in KNOWN), key=len, reverse=True)) + r")(?![\w-])",
    re.IGNORECASE,
)
CAP_PHRASE = re.compile(
    r"\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Gen\.|General|Colonel|Col\.|Major|Maj\.|Captain|Capt\.|Lt\.|Lieutenant)?"
    r"\s*(?:[A-Z][A-Za-z'’-]{1,25}|[A-Z]{2,})(?:\s+(?:of|the|and|&|for|[A-Z][A-Za-z'’-]{1,25}|[A-Z]{2,})){1,5}\b"
)
BOOK_TITLE_WORD = r"(?:[A-Z0-9][A-Za-z0-9.'’:-]*|(?:of|the|and|to|in|on|at|from|for|is|a|an)\b)"
BOOK_TITLE = rf"(?P<title>(?:[A-Z0-9][A-Za-z0-9.'’:-]{{1,}}|A)(?:\s+{BOOK_TITLE_WORD}){{0,11}})"
BOOK_PATTERNS = [
    re.compile(r"\b(?i:(?:book|novel|memoir)(?:\s+(?:called|titled|entitled))?)\s+[\"'“](?P<title>[^\"'”\n]{3,120})[\"'”]"),
    re.compile(rf"\b(?i:(?:book|novel|memoir)(?:\s+by\b(?!\s*(?:an?\s+)?(?:guy|author|man|woman)\b)\s*[^.!?\n]{{0,100}}?)?\s+(?:called|titled|entitled))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:author of (?:the\s+)?(?:(?:recently|newly)\s+published\s+)?(?:book|novel|memoir))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:(?:in|from|read|reading|through)\s+(?:his|her|their|the|a|this)\s+(?:new\s+|classic\s+)?(?:book|novel|memoir))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:classic\s+(?:book|novel|memoir))\s+(?![\"'“]){BOOK_TITLE}"),
]
BOOK_TITLE_REJECT = {
    "a", "advanced", "an", "book", "brokers", "center", "extraterrestrial", "flying", "material", "project", "review", "service", "that", "the", "unidentified",
}
DATE_PATTERN = re.compile(
    r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+\d{1,2},?\s+(?:19|20)\d{2}\b|"
    r"(?<![\d-])\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+(?:19|20)\d{2}\b|\b(?:19|20)\d{2}-\d{2}-\d{2}\b"
)
ADMINISTRATIVE_DATE_CONTEXT = re.compile(
    r"\b(?:foia|freedom of information|declassif|released?|release date|request(?:ed|er)?|"
    r"received|date processed|digitized|scanned|ocr|uploaded|catalog(?:ed|uing)?|access(?:ed|ion)|"
    r"message taken|published|publication|drafted|newspaper|article|issue of|\w+ times of)\b", re.I,
)
MILESTONE_DATE_CONTEXT = re.compile(
    r"\b(?:appeared online|published|released|issued|submitted|"
    r"cleared\s+for\s+open\s+publication|announced|established|created|launched|"
    r"(?:open|public|congressional)\s+hearing)\b", re.I,
)
MILESTONE_SUBJECT_CONTEXT = re.compile(
    r"\b(?:ufo|uap|aaro|aatip|unidentified anomalous phenomena|unidentified flying object)\b|"
    r"u\s*[.·]?\s*[fpr]\s*[.·]?\s*o\s*[.]?", re.I,
)
DOCUMENT_DATE_CONTEXT = re.compile(r"^(?:date|memorandum|memo|letter|dispatch|telegram|cable|report)\b", re.I)
EVENT_DATE_CONTEXT = re.compile(
    r"\b(?:occurred|happened|took place|encountered|landed|crashed|disappeared|arrived|launched|exploded)\b", re.I,
)
SIGHTING_DATE_CONTEXT = re.compile(r"\b(?:observed|sighted|witnessed|appearance|reported seeing)\b", re.I)
SIGHTING_SUBJECT_CONTEXT = re.compile(
    r"\b(?:ufo|uap|object|phenomen(?:on|a)|saucer|disc|craft|aircraft|foo\s*fighter|"
    r"(?:luminous|bright|unidentified)\s+(?:light|ball|body))s?\b", re.I,
)
EVENT_SUBJECT_CONTEXT = re.compile(
    r"\b(?:ufo|uap|object|target|phenomen(?:on|a)|saucer|disc|craft|aircraft|foo\s*fighter|"
    r"sighting|encounter|anomal(?:y|ous)|something|"
    r"(?:luminous|bright|unidentified)\s+(?:light|ball|body))s?\b", re.I,
)
RADAR_DATE_CONTEXT = re.compile(r"\b(?:tracked|detected)\b", re.I)
NON_UFO_EVENT_CONTEXT = re.compile(
    r"\b(?:airstrike|munition|artillery|combat|joint task force|task force operation|killed in action)\b", re.I,
)
EVENT_TYPES = [
    ("sighting", re.compile(r"\b(?:observed|sighted|witnessed|reported seeing|appearance)\b", re.I)),
    ("radar_detection", re.compile(r"\b(?:radar|detected|tracked)\b", re.I)),
    ("landing", re.compile(r"\b(?:landed|landing)\b", re.I)),
    ("crash", re.compile(r"\b(?:crashed|crash|exploded)\b", re.I)),
    ("encounter", re.compile(r"\b(?:encountered|encounter)\b", re.I)),
]
MILESTONE_TYPES = [
    ("publication", re.compile(r"\b(?:article|story|appeared online|published)\b", re.I)),
    ("public_hearing", re.compile(r"\b(?:hearing|testified|testimony)\b", re.I)),
    ("program_milestone", re.compile(r"\b(?:program|office|established|created|launched)\b", re.I)),
    ("official_report", re.compile(r"\b(?:report|cleared\s+for\s+open\s+publication|issued|submitted)\b", re.I)),
]
MONTHS = {name: number for number, name in enumerate(
    ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"), 1
)}
MONTHS.update({name[:3]: number for name, number in list(MONTHS.items())})
MONTHS["Sept"] = 9
ORG_WORDS = {
    "agency", "administration", "aerospace", "air force", "army", "bureau", "committee",
    "corporation", "department", "directorate", "division", "foundation", "institute",
    "intelligence", "laboratory", "navy", "office", "organization", "university",
}
LOCATION_WORDS = {
    "air force base", "airport", "area", "base", "county", "desert", "island", "lake",
    "mount", "mountain", "range", "river", "site",
}
PROGRAM_WORDS = {"operation", "program", "project", "task force"}
GENERIC = {
    "air force", "armed forces", "assistant director", "chief of staff", "department",
    "executive officer", "flying object", "general public", "intelligence officer",
    "national security", "press release", "project officer", "public affairs",
    "secretary of defense", "special agent", "the united states", "united states",
    "chief science officer founder",
    "unidentified aerial phenomena", "unidentified flying object",
}
PERSON_HARD_NEGATIVES = {
    "general aviation", "general counsel", "general electric", "general motors",
    "general relativity",
}
NON_NAME_WORDS = {
    "act", "additional", "aerial", "all", "asset", "balloon", "balloons", "blue", "book",
    "command", "commands", "commanding", "concerning", "concerns", "congressional", "contained",
    "data", "details", "disclosure", "disc", "discs", "exemption", "field", "flying", "force",
    "code", "form", "general", "government", "group", "hearing", "information", "matter", "memorandum",
    "mission", "number", "object", "objects", "off", "operations", "part", "phenomena", "phone",
    "privacy", "rate", "regarding", "reply", "request", "security", "station", "task", "top",
    "thought", "travel", "type", "unidentified", "war", "working",
}
KNOWN_LOCATIONS = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
    "district of columbia", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
    "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey",
    "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah",
    "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming", "los alamos",
    "los angeles", "las vegas", "san francisco", "san diego", "kansas city", "white sands",
    "oak ridge", "middle east", "south america", "united kingdom", "soviet union", "milky way",
    "oklahoma city", "new york city", "colorado springs", "mexico city", "fort worth", "new orleans",
}
FIRST_NAMES = {
    "alan", "albert", "alex", "alexander", "allen", "andrew", "anna", "anthony", "arthur",
    "barbara", "ben", "benjamin", "bill", "bob", "brandon", "brian", "bruce", "carl", "carol",
    "charles", "chris", "christopher", "dan", "daniel", "david", "diana", "donald", "dorothy",
    "edgar", "edward", "elizabeth", "eric", "ernest", "eugene", "francis", "frank", "fred",
    "frederick", "gary", "george", "gerald", "glenn", "gordon", "harold", "harry", "helen",
    "henry", "herbert", "howard", "jack", "james", "jane", "jean", "jeremy", "jim", "joe",
    "john", "jose", "joseph", "judith", "karen", "keith", "kelly", "ken", "kenneth", "laura",
    "lee", "linda", "margaret", "mark", "mary", "michael", "mike", "milton", "monica", "nancy",
    "neil", "nikola", "paul", "peter", "philip", "raymond", "richard", "robert", "ronald",
    "russell", "sam", "samuel", "scott", "sidney", "staphen", "stanley", "stanton", "stephen",
    "steven", "susan", "thomas", "tim", "timothy", "walter", "william",
}
ROLE_PREFIX = re.compile(r"^(?:President|Professor|Senator|Congressman|Congresswoman|Secretary|Admiral|General|Colonel|Captain)\s+", re.I)
FIELD_LABELS = {
    "date", "document", "from", "memorandum", "name", "page", "reference", "subject", "to",
}
HONORIFIC = re.compile(r"^(?:Dr\.|Mr\.|Mrs\.|Ms\.|Gen\.|General|Colonel|Col\.|Major|Maj\.|Captain|Capt\.|Lt\.|Lieutenant)\s+", re.I)
RELATIONS = [
    ("affiliated_with", re.compile(r"\b(?:worked|works|served|employed|assigned|member|director|chief|head|affiliated)\b", re.I)),
    ("reported_to", re.compile(r"\b(?:reported to|under the command of|supervised by)\b", re.I)),
    ("investigated", re.compile(r"\b(?:investigated|investigation of|inquired into|examined)\b", re.I)),
    ("located_at", re.compile(r"\b(?:located|stationed|based|at the site|near)\b", re.I)),
]


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_id(prefix: str, value: str) -> str:
    return f"{prefix}-{hashlib.sha1(value.encode('utf-8')).hexdigest()[:12]}"


def normalized_date(value: str) -> str | None:
    """Normalize only unambiguous day-level dates; never invent missing precision."""
    value = clean_space(value).replace(",", "")
    try:
        if re.fullmatch(r"(?:19|20)\d{2}-\d{2}-\d{2}", value):
            return dt.date.fromisoformat(value).isoformat()
        parts = value.split()
        if parts[0] in MONTHS:
            month, day, year = MONTHS[parts[0]], int(parts[1]), int(parts[2])
        elif len(parts) == 3 and parts[1] in MONTHS:
            day, month, year = int(parts[0]), MONTHS[parts[1]], int(parts[2])
        else:
            return None
        return dt.date(year, month, day).isoformat()
    except (ValueError, IndexError):
        return None


def temporal_candidates(segments: list[str], metadata: dict, document_id: str) -> tuple[dict | None, list[dict], list[dict]]:
    """Classify dates by meaning and publish only strong document/event evidence."""
    review, document_dates, events = [], [], []
    for field in ("document_date", "authored_at", "record_date"):
        raw = metadata.get(field)
        if not raw:
            continue
        match = DATE_PATTERN.search(str(raw))
        value = normalized_date(match.group(0) if match else str(raw)[:10])
        if value:
            document_dates.append({"value": value, "precision": "day", "confidence": 0.99,
                                   "kind": "document_date", "method": f"metadata:{field}", "evidence": str(raw)[:280]})
    for index, segment in enumerate(segments):
        for match in DATE_PATTERN.finditer(segment):
            value = normalized_date(match.group(0))
            if not value:
                continue
            nearby = segment[max(0, match.start() - 120):match.end() + 120]
            milestone_nearby = segment
            if MILESTONE_SUBJECT_CONTEXT.search(segment) and index + 1 < len(segments):
                milestone_nearby = f"{segment} {segments[index + 1]}"
            prefix = segment[max(0, match.start() - 120):match.start()]
            milestone = (MILESTONE_DATE_CONTEXT.search(milestone_nearby)
                         and MILESTONE_SUBJECT_CONTEXT.search(milestone_nearby)
                         and not re.search(r"\(\s*Established\b", milestone_nearby, re.I))
            if milestone:
                kind, confidence, method = "event_date", 0.94, "milestone-language"
            elif ADMINISTRATIVE_DATE_CONTEXT.search(nearby):
                kind, confidence, method = "administrative_date", 0.98, "context-exclusion"
            elif NON_UFO_EVENT_CONTEXT.search(nearby):
                kind, confidence, method = "non_ufo_event", 0.9, "subject-exclusion"
            elif re.search(r"\bdated\s*$", prefix, re.I):
                kind, confidence, method = "referenced_document_date", 0.72, "dated-reference"
            elif (re.search(r"\b(?:after|before|since|until|prior to)\s*$", prefix, re.I)
                  or re.search(r"\bbetween\b[^.!?]{0,80}$", prefix, re.I)):
                kind, confidence, method = "relative_date", 0.72, "relative-date-exclusion"
            elif index < 12 and (re.match(r"^(?:date|dated)\s*[:.-]", segment, re.I) or DOCUMENT_DATE_CONTEXT.match(segment)):
                kind, confidence, method = "document_date", 0.94, "document-header"
            elif ((EVENT_DATE_CONTEXT.search(nearby) and EVENT_SUBJECT_CONTEXT.search(nearby))
                  or (SIGHTING_DATE_CONTEXT.search(nearby) and SIGHTING_SUBJECT_CONTEXT.search(nearby))
                  or (RADAR_DATE_CONTEXT.search(nearby) and re.search(r"\b(?:radar|object|target|track)\b", nearby, re.I))):
                kind, confidence, method = "event_date", 0.9, "event-language"
            else:
                kind, confidence, method = "unknown", 0.45, "unclassified-mention"
            candidate = {"value": value, "precision": "day", "confidence": confidence, "kind": kind,
                         "method": method, "evidence": segment[:280], "segment": index}
            review.append(candidate)
            if kind == "document_date":
                document_dates.append(candidate)
            elif kind == "event_date":
                type_patterns = MILESTONE_TYPES if method == "milestone-language" else EVENT_TYPES
                type_context = segment if method == "milestone-language" else nearby
                event_type = next((name for name, pattern in type_patterns if pattern.search(type_context)), "reported_event")
                events.append({"id": stable_id("event", f"{document_id}|{index}|{value}|{event_type}"),
                               "title": segment[:140], "eventType": event_type, "startDate": value, "endDate": None,
                               "datePrecision": "day", "confidence": confidence, "mentionCount": 1, "documentIds": [document_id],
                               "evidence": [{"documentId": document_id, "segment": index, "excerpt": segment[:280]}]})
    return max(document_dates, key=lambda item: item["confidence"], default=None), events, review


def merge_events(events: list[dict]) -> list[dict]:
    """Merge only strongly similar same-day reports; a shared date alone is never enough."""
    merged: list[dict] = []
    buckets: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    for event in events:
        bucket = buckets[(event["startDate"], event["eventType"])]
        identity = comparison_key(event["title"])
        match = next((candidate for candidate in bucket
                      if difflib.SequenceMatcher(None, identity, comparison_key(candidate["title"])).ratio() >= 0.82), None)
        if match is None:
            event["documentCount"] = len(event["documentIds"])
            bucket.append(event)
            merged.append(event)
            continue
        match["documentIds"] = sorted(set(match["documentIds"] + event["documentIds"]))
        for evidence in event["evidence"]:
            if evidence not in match["evidence"] and len(match["evidence"]) < 5:
                match["evidence"].append(evidence)
        match["documentCount"] = len(match["documentIds"])
        match["mentionCount"] = match.get("mentionCount", 1) + event.get("mentionCount", 1)
        match["confidence"] = round(min(0.98, max(match["confidence"], event["confidence"]) + 0.02), 3)
    return merged


def curated_events(path: Path, document_ids: dict[str, str], date_review: list[dict] | None = None) -> list[dict]:
    """Load reviewed historical milestones only when their source document is present."""
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    published = []
    for item in payload.get("events", []):
        source_path = item.get("sourcePath")
        document_id = document_ids.get(source_path)
        date = normalized_date(str(item.get("startDate", "")))
        if not document_id or not date or not item.get("title") or not item.get("eventType"):
            continue
        excerpt = clean_space(str(item.get("evidence", "")))[:280]
        supporting_ids = {document_id}
        supporting_evidence = [{"documentId": document_id, "excerpt": excerpt}]
        supporting_mentions = 0
        match_terms = [comparison_key(term) for term in item.get("matchTerms", [])]
        match_kinds = set(item.get("matchCandidateKinds", ["event_date", "unknown", "referenced_document_date"]))
        if match_terms:
            for record in date_review or []:
                candidate_document_id = record.get("documentId")
                if not candidate_document_id:
                    continue
                for candidate in record.get("candidates", []):
                    context = comparison_key(f"{record.get('path', '')} {candidate.get('evidence', '')}")
                    if (candidate.get("value") == date and candidate.get("kind") in match_kinds
                            and all(term in context for term in match_terms)):
                        supporting_ids.add(candidate_document_id)
                        supporting_mentions += 1
                        if len(supporting_evidence) < 5:
                            supporting_evidence.append({
                                "documentId": candidate_document_id,
                                **({"segment": candidate["segment"]} if "segment" in candidate else {}),
                                "excerpt": clean_space(candidate.get("evidence", ""))[:280],
                            })
        published.append({
            "id": stable_id("event", f"curated|{source_path}|{date}|{item['eventType']}"),
            "title": item["title"],
            "eventType": item["eventType"],
            "startDate": date,
            "endDate": None,
            "datePrecision": "day",
            "confidence": 0.99,
            "mentionCount": max(1, supporting_mentions),
            "reviewStatus": "curated",
            "documentIds": sorted(supporting_ids),
            "evidence": supporting_evidence,
        })
    return published


def overlay_curated_events(extracted: list[dict], reviewed: list[dict]) -> list[dict]:
    """Prefer reviewed wording and combine extracted support for the same dated milestone."""
    for curated in reviewed:
        matches = [event for event in extracted
                   if event["startDate"] == curated["startDate"]
                   and event["eventType"] == curated["eventType"]]
        for event in matches:
            curated["documentIds"] = sorted(set(curated["documentIds"] + event["documentIds"]))
            for evidence in event["evidence"]:
                if evidence not in curated["evidence"] and len(curated["evidence"]) < 5:
                    curated["evidence"].append(evidence)
            extracted.remove(event)
        curated["mentionCount"] = max(curated.get("mentionCount", 1), sum(event.get("mentionCount", 1) for event in matches))
        extracted.append(curated)
    return extracted


def attach_event_entities(
    events: list[dict],
    segment_entities: dict[str, list[str]],
    document_title_entities: dict[str, list[str]],
    registry: dict,
    published: dict[str, Candidate],
    entity_ids: dict[str, str],
) -> None:
    """Attach specific published entities evidenced by each event's supporting passages."""
    for event in events:
        keys: set[str] = set()
        for evidence in event.get("evidence", []):
            keys.update(document_title_entities.get(evidence["documentId"], []))
            if "segment" in evidence:
                keys.update(segment_entities.get(f"{evidence['documentId']}:{evidence['segment']}", []))
            for _, canonical, category, _, _ in extract_mentions(evidence.get("excerpt", ""), registry):
                keys.add(f"{category}:{entity_key(canonical, category)}")
        for _, canonical, category, _, _ in extract_mentions(event.get("title", ""), registry):
            keys.add(f"{category}:{entity_key(canonical, category)}")
        specific = [key for key in keys
                    if key in published and published[key].category not in {"date", "subject", "book"}]
        event["entityIds"] = sorted(entity_ids[key] for key in specific)


def clean_space(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip(" \t\r\n,;:()[]{}")


def comparison_key(value: str) -> str:
    value = HONORIFIC.sub("", clean_space(value))
    value = value.replace("’", "'").replace("U. S.", "U.S.")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def entity_key(value: str, category: str) -> str:
    """Collapse harmless display variants without fuzzy-merging distinct entities."""
    normalized = clean_space(value)
    if category != "date":
        normalized = re.sub(r"['’]s$", "", normalized, flags=re.IGNORECASE)
    if category == "person":
        normalized = ROLE_PREFIX.sub("", normalized)
    key = comparison_key(normalized)
    if category != "date":
        key = re.sub(r"^the\s+", "", key)
    return key


def title_from_path(path: Path) -> str:
    name = path.stem.replace("_", " ").replace("-", " ")
    return clean_space(re.sub(r"\s+", " ", name)).title()


def clean_book_title(value: str) -> str:
    title = clean_space(value).strip("\"'“”‘’.,;:!?- ")
    title = re.split(r"(?<!\bMr)(?<!\bDr)(?<!\bMs)(?<!\bU\.S)(?<!\b[A-Z])\.\s+(?=[A-Z])", title, maxsplit=1)[0]
    title = re.sub(r"\s+(?:a|an|and|for|from|in|of|on|the|to)$", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s+in\s+(?:19|20)\d{2}$", "", title, flags=re.IGNORECASE)
    return title.strip("\"'“”‘’.,;:!?- ")


def plausible_book_title(value: str) -> bool:
    key = comparison_key(value)
    words = key.split()
    if len(key) < 3 or not words or len(words) > 12:
        return False
    if key in BOOK_TITLE_REJECT or words[0] in {"chapter", "figure", "table"}:
        return False
    return True


def sentence_segments(text: str) -> Iterable[str]:
    for block in re.split(r"(?:===== PAGE \d+ =====|\n{2,})", text):
        for item in re.split(
            r"(?<!\b[A-Z]\.)(?<!\b[A-Za-z]{2}\.)(?<!\b[A-Za-z]{3}\.)(?<=[.!?])\s+(?=[A-Z0-9])|\n",
            block,
        ):
            item = clean_space(item)
            if "Declassified/Released US Department of State" in item:
                continue
            if 24 <= len(item) <= 1600:
                yield item


def read_ocr(path: Path) -> tuple[dict, list[str]] | None:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    first, sep, body = text.partition("\n")
    if not sep:
        return None
    try:
        metadata = json.loads(first)
    except json.JSONDecodeError:
        return None
    if metadata.get("schema") != "ufo-files-archive-ocr/v1":
        return None
    body = re.sub(r"(?m)^\{\"alpha_words\".*?\}\s*$", "", body)
    return metadata, list(sentence_segments(body))


def read_tsv(path: Path) -> tuple[dict, list[str], int] | None:
    sidecar = path.with_suffix(".source.json")
    if not sidecar.exists():
        return None
    try:
        metadata = json.loads(sidecar.read_text(encoding="utf-8"))
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except (OSError, json.JSONDecodeError):
        return None
    if metadata.get("schema") != "ufo-files-archive-media-transcripts/v1":
        return None
    segments, duration = [], 0
    for line in lines:
        fields = line.split("\t", 2)
        if len(fields) != 3 or fields[0].lower() == "start":
            continue
        try:
            duration = max(duration, int(float(fields[1])))
        except ValueError:
            pass
        value = clean_space(fields[2])
        if value:
            segments.append(value)
    return metadata, segments, duration


def classify_phrase(raw: str) -> tuple[str, float] | None:
    raw = clean_space(raw)
    if raw.casefold() in PERSON_HARD_NEGATIVES:
        return None
    key = comparison_key(raw)
    if len(key) < 3 or key in GENERIC or key in FIELD_LABELS or key in LOCATION_WORDS:
        return None
    words = key.split()
    if len(words) > 6 or any(len(word) == 1 for word in words[1:-1]):
        return None
    lower = raw.lower()
    if key == "extraterrestrial intelligence":
        return "subject", 0.99
    if key in KNOWN_LOCATIONS:
        return "location", 0.9
    if key.startswith("uss "):
        return None
    if lower.endswith((" of", " the", " and", " for")):
        return None
    if any(word in lower for word in LOCATION_WORDS):
        return "location", 0.79
    if any(word in NON_NAME_WORDS for word in words):
        return None
    if lower.startswith(("director of ", "chief of ", "commanding ")):
        return None
    if key in {"united nations", "united press", "associated press", "aviation week", "abc news", "big media"}:
        return "organization", 0.88
    if any(word in lower for word in ORG_WORDS):
        category = "government_agency" if any(word in lower for word in ("agency", "bureau", "department", "air force", "army", "navy", "office")) else "organization"
        return category, 0.82
    if any(lower.startswith(word + " ") for word in PROGRAM_WORDS):
        return "program", 0.82
    if raw.isupper() or words[0] in {"mg", "rel", "please", "district"}:
        return None
    role_match = ROLE_PREFIX.match(raw)
    stripped = ROLE_PREFIX.sub("", HONORIFIC.sub("", raw))
    person_words = stripped.split()
    valid_words = all(re.match(r"^(?:[A-Z][A-Za-z'’-]{1,25}|[A-Z]\.)$", word) for word in person_words)
    has_first_name = person_words and person_words[0].rstrip(".").lower() in FIRST_NAMES
    if ((2 <= len(person_words) <= 4 and has_first_name) or (role_match and 1 <= len(person_words) <= 4)) and valid_words:
        if person_words[0].lower() not in {"chapter", "figure", "table", "section", "appendix"}:
            return "person", 0.72 if has_first_name else 0.67
    return None


def load_registry(paths: Iterable[Path]) -> dict[str, tuple[str, str]]:
    registry = {}
    for path in paths:
        if not path.exists():
            continue
        records = json.loads(path.read_text(encoding="utf-8"))
        file_registry = {}
        for record in records:
            canonical = clean_space(record.get("canonicalName") or record["name"])
            category = record["category"]
            for value in [canonical, *record.get("aliases", [])]:
                key = comparison_key(value)
                target = (canonical, category)
                if key in file_registry and file_registry[key] != target:
                    raise ValueError(f"Conflicting entity alias {value!r}: {file_registry[key]} vs {target}")
                file_registry[key] = target
        registry.update(file_registry)
    return registry


@dataclass
class Candidate:
    canonical: str
    category: str
    curated: bool = False
    variants: collections.Counter = field(default_factory=collections.Counter)
    documents: set[str] = field(default_factory=set)
    sources: set[str] = field(default_factory=set)
    segments: set[str] = field(default_factory=set)
    examples: list[dict] = field(default_factory=list)
    source_mentions: collections.Counter = field(default_factory=collections.Counter)
    source_documents: dict[str, set[str]] = field(default_factory=lambda: collections.defaultdict(set))
    context_mentions: collections.Counter = field(default_factory=collections.Counter)
    context_documents: dict[str, set[str]] = field(default_factory=lambda: collections.defaultdict(set))
    source_context_mentions: dict[str, collections.Counter] = field(default_factory=lambda: collections.defaultdict(collections.Counter))
    source_context_documents: dict[str, dict[str, set[str]]] = field(default_factory=lambda: collections.defaultdict(lambda: collections.defaultdict(set)))
    administrative_contexts: set[str] = field(default_factory=set)
    mentions: int = 0
    extraction_total: float = 0.0
    title_documents: set[str] = field(default_factory=set)

    def add(self, raw: str, doc_id: str, source: str, segment_id: str, excerpt: str, confidence: float) -> None:
        context = context_key(excerpt)
        self.variants[clean_space(raw)] += 1
        self.documents.add(doc_id)
        self.sources.add(source)
        self.segments.add(segment_id)
        self.source_mentions[source] += 1
        self.source_documents[source].add(doc_id)
        self.context_mentions[context] += 1
        self.context_documents[context].add(doc_id)
        self.source_context_mentions[source][context] += 1
        self.source_context_documents[source][context].add(doc_id)
        if ADMINISTRATIVE_CONTEXT.search(excerpt):
            self.administrative_contexts.add(context)
        self.mentions += 1
        self.extraction_total += confidence
        if len(self.examples) < 4:
            self.examples.append({"documentId": doc_id, "excerpt": excerpt[:280]})


def context_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = re.sub(r"\d+", "#", normalized)
    return clean_space(normalized)


def inflation_risk(rate: float, inflated_documents: int) -> str:
    if inflated_documents >= 2 and rate >= 0.5:
        return "high"
    if inflated_documents >= 2 and rate >= 0.2:
        return "elevated"
    return "low"


def significance_metrics(candidate: Candidate, source: str | None = None) -> dict:
    repeated_contexts = {
        context
        for context, documents in candidate.context_documents.items()
        if len(documents) >= REPEATED_CONTEXT_DOCUMENT_FLOOR
    }
    if source is None:
        mentions = candidate.mentions
        coverage_documents = candidate.documents
        context_mentions = candidate.context_mentions
        context_documents = candidate.context_documents
    else:
        mentions = candidate.source_mentions[source]
        coverage_documents = candidate.source_documents[source]
        context_mentions = candidate.source_context_mentions[source]
        context_documents = candidate.source_context_documents[source]

    adjusted_mentions = 0
    independent_documents: set[str] = set()
    for context, context_document_ids in context_documents.items():
        if context in candidate.administrative_contexts:
            continue
        if context in repeated_contexts:
            adjusted_mentions += 1
            continue
        adjusted_mentions += len(context_document_ids)
        independent_documents.update(context_document_ids)

    repeated_mentions = sum(
        context_mentions[context]
        for context in repeated_contexts
        if context not in candidate.administrative_contexts
    )
    administrative_mentions = sum(context_mentions[context] for context in candidate.administrative_contexts)
    within_document_duplicates = sum(
        max(0, context_mentions[context] - len(documents))
        for context, documents in context_documents.items()
    )
    inflated_mentions = max(0, mentions - adjusted_mentions)
    rate = inflated_mentions / max(1, mentions)
    inflated_documents = max(0, len(coverage_documents) - len(independent_documents))
    document_rate = inflated_documents / max(1, len(coverage_documents))
    return {
        "contextAdjustedMentions": adjusted_mentions,
        "independentDocumentCount": len(independent_documents),
        "inflatedMentionCount": inflated_mentions,
        "inflationRate": round(rate, 3),
        "inflatedDocumentCount": inflated_documents,
        "documentInflationRate": round(document_rate, 3),
        "inflationRisk": inflation_risk(document_rate, inflated_documents),
        "inflationSignals": {
            "repeatedContextMentions": repeated_mentions,
            "administrativeMentions": administrative_mentions,
            "withinDocumentDuplicates": within_document_duplicates,
        },
    }


def extract_mentions(segment: str, registry: dict[str, tuple[str, str]]) -> list[tuple[str, str, str, float, bool]]:
    found: dict[str, tuple[str, str, str, float, bool]] = {}
    for match in KNOWN_PATTERN.finditer(segment):
        raw = match.group(0)
        lookup = KNOWN_LOOKUP.get(known_lookup_key(raw))
        if lookup is None:
            continue
        canonical, category = KNOWN[lookup]
        found[entity_key(canonical, category)] = (raw, canonical, category, 0.99, True)
    for match in DATE_PATTERN.finditer(segment):
        raw = match.group(0)
        found[entity_key(raw, "date")] = (raw, raw, "date", 0.96, False)
    for pattern in BOOK_PATTERNS:
        for match in pattern.finditer(segment):
            raw = clean_book_title(match.group("title"))
            if not plausible_book_title(raw):
                continue
            registry_match = registry.get(comparison_key(raw))
            if registry_match and registry_match[1] == "book":
                canonical, category = registry_match
                found[entity_key(canonical, category)] = (raw, canonical, category, 0.98, True)
            else:
                found[entity_key(raw, "book")] = (raw, raw, "book", 0.97, False)
    for match in CAP_PHRASE.finditer(segment):
        raw = match.group(0)
        registry_match = registry.get(comparison_key(raw))
        if registry_match:
            canonical, category = registry_match
            if category == "book":
                continue
            found[entity_key(canonical, category)] = (raw, canonical, category, 0.98, True)
            continue
        classification = classify_phrase(raw)
        if not classification:
            continue
        category, confidence = classification
        key = entity_key(raw, category)
        found.setdefault(key, (raw, HONORIFIC.sub("", clean_space(raw)), category, confidence, False))
    return list(found.values())


def extract_title_mentions(title: str, registry: dict[str, tuple[str, str]]) -> list[tuple[str, str, str, float, bool]]:
    """Use document titles as curated identity evidence without treating arbitrary title case as NER."""
    words = clean_space(title).split()
    found: dict[str, tuple[str, str, str, float, bool]] = {}
    for match in KNOWN_PATTERN.finditer(title):
        raw = match.group(0)
        lookup = KNOWN_LOOKUP.get(known_lookup_key(raw))
        if lookup is None:
            continue
        canonical, category = KNOWN[lookup]
        key = f"{category}:{entity_key(canonical, category)}"
        found.setdefault(key, (raw, canonical, category, 0.99, True))
    for width in range(min(8, len(words)), 0, -1):
        for start in range(len(words) - width + 1):
            raw = clean_space(" ".join(words[start:start + width])).strip("-'_.")
            registry_match = registry.get(comparison_key(raw))
            if not registry_match:
                continue
            canonical, category = registry_match
            if category == "book":
                continue
            key = f"{category}:{entity_key(canonical, category)}"
            found.setdefault(key, (raw, canonical, category, 0.96, True))
    return list(found.values())


def duplicate_candidates(candidates: dict[str, Candidate], limit: int = 200) -> tuple[list[dict], int]:
    """Return likely but unresolved duplicates for human review; never merge them here."""
    items = [candidate for candidate in candidates.values() if candidate.category != "date"]
    matches = []
    buckets: dict[tuple[str, str], list[Candidate]] = collections.defaultdict(list)
    for candidate in items:
        name = candidate.canonical if candidate.curated else candidate.variants.most_common(1)[0][0]
        words = entity_key(name, candidate.category).split()
        if not words:
            continue
        anchor = words[-1][0] if candidate.category == "person" else words[0][0]
        buckets[(candidate.category, anchor)].append(candidate)

    for bucket in buckets.values():
        for index, left in enumerate(bucket):
            left_name = left.canonical if left.curated else left.variants.most_common(1)[0][0]
            left_identity = entity_key(left_name, left.category)
            left_words = left_identity.split()
            for right in bucket[index + 1:]:
                right_name = right.canonical if right.curated else right.variants.most_common(1)[0][0]
                right_identity = entity_key(right_name, right.category)
                right_words = right_identity.split()
                left_initials = "".join(word[0] for word in left_words if word not in {"and", "of", "the"})
                right_initials = "".join(word[0] for word in right_words if word not in {"and", "of", "the"})
                reason = None
                if len(left_words) >= 3 and left_initials == right_identity.replace(" ", ""):
                    reason = "acronym"
                elif len(right_words) >= 3 and right_initials == left_identity.replace(" ", ""):
                    reason = "acronym"
                if not reason:
                    if abs(len(left_identity) - len(right_identity)) > max(4, int(max(len(left_identity), len(right_identity)) * 0.25)):
                        continue
                    similarity = difflib.SequenceMatcher(None, left_identity, right_identity).ratio()
                    if left.category == "person" and left_words and right_words and left_words[-1] == right_words[-1] and similarity >= 0.86:
                        reason = "similar person name"
                    elif max(len(left_identity), len(right_identity)) >= 12 and similarity >= 0.92:
                        reason = "similar name"
                if not reason:
                    continue
                similarity = difflib.SequenceMatcher(None, left_identity, right_identity).ratio()
                matches.append({
                    "category": left.category,
                    "left": {"name": left_name, "mentions": left.mentions, "documentCount": len(left.documents)},
                    "right": {"name": right_name, "mentions": right.mentions, "documentCount": len(right.documents)},
                    "similarity": round(similarity, 3),
                    "reason": reason,
                    "aliasFile": "data/entity_aliases.json",
                })
    ranked = sorted(
        matches,
        key=lambda item: (item["similarity"], item["left"]["mentions"] + item["right"]["mentions"]),
        reverse=True,
    )
    return ranked[:limit], len(ranked)


def accepted(candidate: Candidate) -> bool:
    if candidate.curated:
        return True
    documents = len(candidate.documents)
    if candidate.category == "person":
        return candidate.mentions >= 3 and documents >= 2
    if candidate.category == "date":
        return candidate.mentions >= 2
    if candidate.category == "book":
        return candidate.mentions >= 1
    return candidate.mentions >= 2 and documents >= 2


def build(
    input_root: Path,
    output: Path,
    max_entities: int,
    max_edges: int,
    input_repository: str | None = None,
    input_revision: str | None = None,
    require_data: bool = False,
    duplicate_report: Path | None = None,
    date_review_report: Path | None = None,
) -> dict:
    data_dir = Path(__file__).resolve().parents[1] / "data"
    registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json"])
    location_coordinates = json.loads((data_dir / "location_coordinates.json").read_text(encoding="utf-8"))
    candidates: dict[str, Candidate] = {}
    documents: list[dict] = []
    segment_entities: dict[str, list[str]] = {}
    document_title_entities: dict[str, list[str]] = collections.defaultdict(list)
    segment_text: dict[str, str] = {}
    source_counts: collections.Counter = collections.Counter()
    source_words: collections.Counter = collections.Counter()
    document_sources: dict[str, str] = {}
    document_ids_by_path: dict[str, str] = {}
    events: list[dict] = []
    date_review: list[dict] = []

    paths = sorted(
        path for path in input_root.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".txt", ".tsv"}
        and not (set(path.relative_to(input_root).parts) & SKIP_PARTS)
    )
    for path in paths:
        relative = path.relative_to(input_root).as_posix()
        source = relative.split("/", 1)[0]
        parsed = None
        fmt = ""
        duration = None
        if path.suffix.lower() == ".txt":
            parsed = read_ocr(path)
            if parsed:
                metadata, segments = parsed
                fmt = "ocr"
        else:
            media = read_tsv(path)
            if media:
                metadata, segments, duration = media
                parsed = (metadata, segments)
                fmt = "transcript"
        if not parsed:
            continue
        metadata, segments = parsed
        doc_id = stable_id("doc", relative)
        words = sum(len(segment.split()) for segment in segments)
        title = title_from_path(Path(str(metadata.get("source_file") or path.name)))
        document_date, document_events, review_candidates = temporal_candidates(segments, metadata, doc_id)
        document = {
            "id": doc_id,
            "title": title,
            "source": source,
            "path": relative,
            "format": fmt,
            "words": words,
            "segments": len(segments),
            "bytes": int(metadata.get("source_bytes") or path.stat().st_size),
            "createdAt": metadata.get("created_utc") or metadata.get("created_at"),
            "engine": metadata.get("engine") or metadata.get("backend"),
            "durationMs": duration,
        }
        if document_date:
            document["documentDate"] = document_date["value"]
            document["documentDatePrecision"] = document_date["precision"]
            document["documentDateConfidence"] = document_date["confidence"]
            document["documentDateEvidence"] = {
                "excerpt": document_date["evidence"],
                "method": document_date["method"],
                **({"segment": document_date["segment"]} if "segment" in document_date else {}),
            }
        events.extend(document_events)
        if review_candidates:
            date_review.append({"documentId": doc_id, "path": relative, "candidates": review_candidates})
        documents.append(document)
        document_sources[doc_id] = source
        document_ids_by_path[relative] = doc_id
        source_counts[source] += 1
        source_words[source] += words
        title_sid = f"{doc_id}:title"
        for raw, canonical, category, confidence, curated in extract_title_mentions(title, registry):
            key = f"{category}:{entity_key(canonical, category)}"
            document_title_entities[doc_id].append(key)
            candidate = candidates.get(key)
            if candidate is None:
                candidate = candidates[key] = Candidate(canonical, category, curated)
            else:
                if curated and not candidate.curated:
                    candidate.canonical = canonical
                candidate.curated = candidate.curated or curated
            candidate.add(raw, doc_id, source, title_sid, f"Document title: {title}", confidence)
            candidate.title_documents.add(doc_id)
        for number, segment in enumerate(segments):
            sid = f"{doc_id}:{number}"
            mentions = extract_mentions(segment, registry)
            keys = []
            for raw, canonical, category, confidence, curated in mentions:
                key = f"{category}:{entity_key(canonical, category)}"
                candidate = candidates.get(key)
                if candidate is None:
                    candidate = candidates[key] = Candidate(canonical, category, curated)
                else:
                    if curated and not candidate.curated:
                        candidate.canonical = canonical
                    candidate.curated = candidate.curated or curated
                candidate.add(raw, doc_id, source, sid, segment, confidence)
                keys.append(key)
            if keys:
                segment_entities[sid] = list(dict.fromkeys(keys))
                segment_text[sid] = segment

    events = overlay_curated_events(
        events,
        curated_events(data_dir / "curated_events.json", document_ids_by_path, date_review),
    )
    events = merge_events(events)
    accepted_candidates = {key: value for key, value in candidates.items() if accepted(value)}
    possible_duplicates, possible_duplicate_count = duplicate_candidates(accepted_candidates)
    def publication_rank(item: tuple[str, Candidate]) -> tuple:
        candidate = item[1]
        metrics = significance_metrics(candidate)
        return (
            candidate.curated,
            len(candidate.title_documents),
            metrics["independentDocumentCount"],
            len(candidate.sources),
            metrics["contextAdjustedMentions"],
            candidate.mentions,
            candidate.canonical,
        )

    ranked = sorted(accepted_candidates.items(), key=publication_rank, reverse=True)
    book_items = [item for item in ranked if item[1].category == "book"][:min(250, max_entities)]
    book_keys = {key for key, _ in book_items}
    published_items = book_items + [item for item in ranked if item[0] not in book_keys][:max_entities - len(book_items)]
    published_items.sort(key=publication_rank, reverse=True)
    published = dict(published_items)
    entity_ids = {key: stable_id("ent", key) for key in published}
    attach_event_entities(events, segment_entities, document_title_entities, registry, published, entity_ids)
    entities = []
    for key, candidate in published_items:
        extraction = candidate.extraction_total / max(1, candidate.mentions)
        evidence_factor = min(1.0, 0.45 + len(candidate.documents) * 0.08 + candidate.mentions * 0.015)
        classification = 0.99 if candidate.curated else (min(0.98, extraction) if candidate.category == "book" else min(0.94, extraction * evidence_factor))
        name = candidate.canonical if candidate.curated else candidate.variants.most_common(1)[0][0]
        metrics = significance_metrics(candidate)
        entity = {
            "id": entity_ids[key],
            "name": name,
            "canonicalName": name,
            "category": candidate.category,
            "mentions": candidate.mentions,
            "documentCount": len(candidate.documents),
            "sourceCount": len(candidate.sources),
            **metrics,
            "extractionConfidence": round(extraction, 3),
            "classificationConfidence": round(classification, 3),
            "reviewStatus": "curated" if candidate.curated else ("review" if classification < 0.72 else "evidence_backed"),
            "variants": [name for name, _ in candidate.variants.most_common(6)],
            "documentIds": sorted(candidate.documents),
            "sourceMetrics": {
                source: {
                    "mentions": candidate.source_mentions[source],
                    "documentCount": len(candidate.source_documents[source]),
                    **significance_metrics(candidate, source),
                }
                for source in sorted(candidate.sources)
            },
            "evidence": candidate.examples,
        }
        if candidate.category == "location" and name in location_coordinates:
            entity["geo"] = location_coordinates[name]
        entities.append(entity)

    edge_stats: dict[tuple[str, str, str], dict] = {}
    for sid, keys in segment_entities.items():
        usable = sorted(set(key for key in keys if key in published))
        if len(usable) < 2 or len(usable) > 30:
            continue
        text = segment_text[sid]
        relation = next((name for name, pattern in RELATIONS if pattern.search(text)), "co_mentioned")
        for i, left in enumerate(usable):
            for right in usable[i + 1:]:
                if published[left].category == "date" and published[right].category == "date":
                    continue
                edge_key = (left, right, relation)
                stat = edge_stats.setdefault(edge_key, {
                    "segments": set(),
                    "documents": set(),
                    "source_segments": collections.defaultdict(set),
                    "source_documents": collections.defaultdict(set),
                    "examples": [],
                })
                document_id = sid.split(":", 1)[0]
                source = document_sources[document_id]
                stat["segments"].add(sid)
                stat["documents"].add(document_id)
                stat["source_segments"][source].add(sid)
                stat["source_documents"][source].add(document_id)
                if len(stat["examples"]) < 3:
                    stat["examples"].append({"documentId": document_id, "excerpt": text[:280]})
    edges = []
    for (left, right, relation), stat in edge_stats.items():
        evidence_count = len(stat["segments"])
        document_count = len(stat["documents"])
        if relation == "co_mentioned" and evidence_count < 2:
            continue
        edges.append({
            "id": stable_id("edge", f"{left}|{right}|{relation}"),
            "source": entity_ids[left],
            "target": entity_ids[right],
            "relationship": relation,
            "evidenceCount": evidence_count,
            "documentCount": document_count,
            "confidence": round(min(0.98, 0.48 + evidence_count * 0.06 + document_count * 0.05 + (0.12 if relation != "co_mentioned" else 0)), 3),
            "sourceMetrics": {
                source: {
                    "evidenceCount": len(stat["source_segments"][source]),
                    "documentCount": len(stat["source_documents"][source]),
                }
                for source in sorted(stat["source_segments"])
            },
            "evidence": stat["examples"],
        })
    edges.sort(key=lambda edge: (edge["evidenceCount"], edge["documentCount"]), reverse=True)
    all_edge_count = len(edges)
    edges = edges[:max_edges]

    sources = [
        {"id": stable_id("src", source), "name": source, "documents": source_counts[source], "words": source_words[source]}
        for source in sorted(source_counts)
    ]
    input_name = input_repository.rsplit("/", 1)[-1] if input_repository else input_root.name
    catalog_input = {"rootName": input_name, "transcriptsAreSourceOfTruth": True}
    if input_repository:
        catalog_input["repository"] = input_repository
    if input_revision:
        catalog_input["revision"] = input_revision
    catalog = {
        "schema": SCHEMA,
        "generatedAt": utc_now(),
        "input": catalog_input,
        "publicationPolicy": {
            "personEvidenceFloor": "3 mentions across 2 documents",
            "bookEvidenceFloor": "1 explicit title cue in transcript text",
            "otherEvidenceFloor": "2 mentions across 2 documents (dates: 2 mentions)",
            "relationshipEvidenceFloor": "2 co-mentions or 1 same-segment typed cue",
            "contextAdjustment": "Exact context repeats within one document count once; requester metadata is excluded; exact contexts spanning 3+ documents count once",
            "entityRanking": "Curated identities first, then independent documents, source diversity, context-adjusted mentions, and raw mentions",
            "titleEvidence": "Curated aliases in document titles seed identity evidence; arbitrary title-case phrases are not classified",
            "confidenceSemantics": "Heuristic ranking signals, not calibrated probabilities",
            "temporalEvidence": "Events require explicit event language tied to an unambiguous day-level date; document dates require trusted metadata or a header; FOIA, release, declassification, and processing dates are excluded",
            "locationCoordinates": "Reviewed local gazetteer; ambiguous and unmapped names are not plotted",
            "denseSegmentLimit": 30,
            "maxEntities": max_entities,
            "maxBooks": min(250, max_entities),
            "maxEdges": max_edges,
        },
        "counts": {
            "documents": len(documents),
            "sources": len(sources),
            "candidateEntities": len(candidates),
            "acceptedEntities": len(accepted_candidates),
            "publishedEntities": len(entities),
            "acceptedEdges": all_edge_count,
            "publishedEdges": len(edges),
            "possibleDuplicates": possible_duplicate_count,
            "mappedLocations": sum(1 for entity in entities if entity.get("geo")),
            "publishedBooks": sum(1 for entity in entities if entity["category"] == "book"),
            "datedDocuments": sum(1 for document in documents if document.get("documentDate")),
            "publishedEvents": len(events),
        },
        "sources": sources,
        "documents": documents,
        "events": events,
        "entities": entities,
        "edges": edges,
        "duplicateCandidates": possible_duplicates,
    }
    if require_data and (not documents or not entities):
        raise ValueError(
            "Refusing to publish an empty catalog: "
            f"found {len(documents)} documents and {len(entities)} entities in {input_root}"
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    if duplicate_report:
        duplicate_report.parent.mkdir(parents=True, exist_ok=True)
        duplicate_report.write_text(json.dumps({
            "schema": "ufo-files-entity-duplicate-candidates/v1",
            "input": catalog_input,
            "count": possible_duplicate_count,
            "totalCount": possible_duplicate_count,
            "shownCount": len(possible_duplicates),
            "candidates": possible_duplicates,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if date_review_report:
        date_review_report.parent.mkdir(parents=True, exist_ok=True)
        date_review_report.write_text(json.dumps({
            "schema": "ufo-files-date-review/v1",
            "generatedAt": catalog["generatedAt"],
            "input": catalog_input,
            "documentsWithCandidates": len(date_review),
            "records": date_review,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return catalog


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "catalog.json")
    parser.add_argument("--max-entities", type=int, default=1200)
    parser.add_argument("--max-edges", type=int, default=4000)
    parser.add_argument("--input-repository")
    parser.add_argument("--input-revision")
    parser.add_argument(
        "--duplicate-report",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "duplicate_candidates.json",
        help="Write unresolved likely duplicate pairs for review.",
    )
    parser.add_argument(
        "--require-data",
        action="store_true",
        help="Fail without writing the catalog when no documents or entities are found.",
    )
    parser.add_argument(
        "--date-review-report",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "date_review.json",
        help="Write classified date candidates and evidence for human review.",
    )
    args = parser.parse_args()
    catalog = build(
        args.input.resolve(),
        args.output.resolve(),
        args.max_entities,
        args.max_edges,
        args.input_repository,
        args.input_revision,
        args.require_data,
        args.duplicate_report.resolve(),
        args.date_review_report.resolve(),
    )
    print(json.dumps({"output": str(args.output), **catalog["counts"]}, indent=2))


if __name__ == "__main__":
    main()
