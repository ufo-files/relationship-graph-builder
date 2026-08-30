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
import functools
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


SCHEMA = "ufo-files-relationship-catalog/v1"
DOCUMENT_SHARD_SCHEMA = "ufo-files-source-documents/v1"
ASTRONOMY_BOOTSTRAP_SCHEMA = "ufo-files-astronomy-bootstrap/v1"
DOCUMENT_SHARD_MAX_BYTES = 80 * 1024 * 1024
SOURCE_FAMILY_POLICY = "ufo-files-source-family-policy/v1"
REPORTED_EVENT_AUTOMATIC_START_DATE = dt.date(1947, 1, 1)
AUDITED_FILENAME_DATE_CONFLICTS = {
    "116740-unidentified-object-thought-to-be-helicopter-observed-near-nakhon-phanom-rtafb-9-6-1969.pdf": 1969,
}
# Audited against the preserved UPDB source rows on 2026-08-16. Keep the browser fallback in app.js aligned.
NICAP_CORRUPT_DATE_DATABASE_IDS = range(5182510, 5182539)
NICAP_UNKNOWN_YEAR_DATABASE_IDS = {5176695, 5176696}
NICAP_IMPRECISE_DATE_DATABASE_IDS = {
    5176761, 5176770, 5176790, 5176793, 5176826, 5176867, 5176876, 5176956, 5176975, 5176984,
    5178685, 5179533, 5180213, 5180214, 5180586, 5180630, 5181077, 5181078, 5181079, 5181319,
    5181349, 5181494, 5182083,
}
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
    "OVNI": ("UFO", "subject"),
    "OVNIs": ("UFO", "subject"),
    "objeto voador não identificado": ("UFO", "subject"),
    "objetos voadores não identificados": ("UFO", "subject"),
    "fenômeno anômalo não identificado": ("UAP", "subject"),
    "fenômenos anômalos não identificados": ("UAP", "subject"),
    "Câmara dos Deputados": ("Câmara dos Deputados", "government_agency"),
    "Arquivo Nacional": ("Arquivo Nacional", "government_agency"),
    "Comando da Aeronáutica": ("Comando da Aeronáutica", "government_agency"),
    "Força Aérea Brasileira": ("Força Aérea Brasileira", "government_agency"),
    "Marinha do Brasil": ("Marinha do Brasil", "government_agency"),
    "Ministério da Defesa": ("Ministério da Defesa", "government_agency"),
    "Operação Prato": ("Operação Prato", "program"),
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
LATIN_UPPER = "A-ZÀ-ÖØ-ÞĀ-Ž"
LATIN_LETTER = "A-Za-zÀ-ÖØ-öø-ÿĀ-ž"
CAP_PHRASE = re.compile(
    r"\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Gen\.|General|Colonel|Col\.|Major|Maj\.|Captain|Capt\.|Lt\.|Lieutenant|Capitão|Almirante)?"
    rf"\s*(?:[{LATIN_UPPER}][{LATIN_LETTER}'’-]{{1,25}}|[{LATIN_UPPER}]{{2,}})(?:\s+(?:of|the|and|&|for|d[aeo]s?|e|[{LATIN_UPPER}][{LATIN_LETTER}'’-]{{1,25}}|[{LATIN_UPPER}]{{2,}})){{1,5}}\b"
)
GENERATIONAL_SUFFIX_AFTER = re.compile(
    r"^\s*(?:,\s*|\(\s*)?(?:Jr\.?|Sr\.?|II|III|IV|V)(?:['’]s)?(?![\w'’])",
    re.IGNORECASE,
)
BOOK_TITLE_WORD = r"(?:[A-Z0-9][A-Za-z0-9.'’:-]*|(?:of|the|and|to|in|on|at|from|for|is|a|an)\b)"
BOOK_TITLE = rf"(?P<title>(?:[A-Z0-9][A-Za-z0-9.'’:-]{{1,}}|A)(?:\s+{BOOK_TITLE_WORD}){{0,11}})"
BOOK_PATTERNS = [
    re.compile(r"\b(?i:(?:book|novel|memoir)(?:\s+(?:called|titled|entitled))?)\s+[\"'“](?P<title>[^\"'”\n]{3,120})[\"'”]"),
    re.compile(rf"\b(?i:(?:book|novel|memoir)(?:\s+by\b(?!\s*(?:an?\s+)?(?:guy|author|man|woman)\b)\s*[^.!?\n]{{0,100}}?)?\s+(?:called|titled|entitled))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:author of (?:the\s+)?(?:(?:recently|newly)\s+published\s+)?(?:book|novel|memoir))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:(?:in|from|read|reading|through)\s+(?:his|her|their|the|a|this)\s+(?:new\s+|classic\s+)?(?:book|novel|memoir))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:classic\s+(?:book|novel|memoir))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:(?:book|novel|memoir)\s+(?:is|was))\s+(?![\"'“]){BOOK_TITLE}"),
    re.compile(rf"\b(?i:(?:wrote|published|released|picked up|read)\s+(?:a|the|this|his|her|their)\s+(?:new\s+|latest\s+)?(?:book|novel|memoir)(?:\s+(?:called|titled))?)\s+(?![\"'“]){BOOK_TITLE}"),
]
BOOK_CONTEXT_CUE = re.compile(r"\b(?:book|books|novel|memoir|author|read|reading|wrote|written|published)\b", re.IGNORECASE)
BOOK_TITLE_REJECT = {
    "a", "advanced", "an", "book", "brokers", "center", "extraterrestrial", "flying", "material", "project", "review", "service", "that", "the", "unidentified",
}
DATE_PATTERN = re.compile(
    r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+\d{1,2},?\s+(?:19|20)\d{2}\b|"
    r"(?<![\d-])\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+(?:19|20)\d{2}\b|"
    r"(?<![\d-])\b\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|"
    r"septembre|octobre|novembre|décembre|decembre)\s+(?:19|20)\d{2}\b|"
    r"\b(?:19|20)\d{2}-\d{2}-\d{2}\b"
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
    r"\b(?:occurred|happened|took place|encountered|landed|crashed|disappeared|arrived|launched|exploded|"
    r"survenu|arrivé|apparu|rencontré|atterri|écrasé|disparu|explosé)\b", re.I,
)
SIGHTING_DATE_CONTEXT = re.compile(
    r"\b(?:observed|sighted|witnessed|appearance|reported seeing|observe|voit|aperçoit|apercoit|"
    r"observé|aperçu|vu|signalé|témoigné)\b", re.I,
)
SIGHTING_SUBJECT_CONTEXT = re.compile(
    r"\b(?:ufo|uap|object|phenomen(?:on|a)|saucer|disc|craft|aircraft|foo\s*fighter|"
    r"ovni|objet|phénomène|phenomene|soucoupe|disque|engin|aéronef|aeronef|"
    r"(?:luminous|bright|unidentified)\s+(?:light|ball|body)|"
    r"(?:lumineux|brillant|non\s+identifié)\s+(?:lumière|boule|corps))s?\b", re.I,
)
INVALID_REPORTED_EVENT_DATE_CONTEXT = re.compile(
    r"\b(?:"
    r"date(?:\s+(?:is|was))?\s+(?:invalid|incorrect|wrong|unknown|not\s+(?:the\s+)?(?:actual|correct))|"
    r"(?:actual|correct)\s+date(?:\s+(?:is|was))?\s+(?:unknown|unavailable)|"
    r"(?:i|we)\s+(?:(?:do|did)(?:n['’]?t|\s+not)|can(?:not|['’]?t)|could(?:n['’]?t|\s+not))\s+"
    r"(?:know|remember|recall)\s+(?:the\s+)?(?:(?:actual|correct|exact)\s+)?date|"
    r"(?:i|we)\s+(?:am|are|was|were)\s+not\s+(?:entirely\s+)?sure\s+"
    r"(?:(?:of|about)\s+)?(?:the\s+)?(?:(?:actual|correct|exact)\s+)?date|"
    r"(?:required|forced)\s+(?:(?:me|us|the\s+(?:witness|reporter))\s+)?(?:to\s+)?(?:enter|provide|select|choose)\s+(?:a|the)\s+date|"
    r"(?:could|can)(?:n['’]?t|\s+not)\s+(?:enter|provide|select)\s+(?:the\s+)?(?:actual|correct)\s+date|"
    r"(?:no(?:ne)?\s+(?:was\s+)?provided\s+for\s+(?:the\s+)?date)|"
    r"date\s+(?:was\s+)?(?:not\s+provided|missing)"
    r")\b",
    re.I,
)
NON_EVENT_INVALID_REPORTED_DATE_CONTEXT = re.compile(
    r"\b(?:"
    r"(?:camera|nikon|watch|photos?|photographs?|pictures?|images?|youtube)(?:['’]s)?\s+"
    r"date(?:\s+(?:is|was))?\s+(?:invalid|incorrect|wrong)|"
    r"date(?:\s+(?:is|was))?\s+(?:invalid|incorrect|wrong)\s+(?:on|in)\s+"
    r"(?:(?:my|the|those)\s+)?(?:camera|nikon|watch|photos?|photographs?|pictures?|images?|youtube)|"
    r"(?:person|reporter|filer)[^.!?]{0,100}(?:other\s+(?:similar\s+)?(?:one|report)|similar\s+report)[^.!?]{0,60}"
    r"(?:got|has)\s+the\s+date(?:\s+(?:is|was))?\s+(?:invalid|incorrect|wrong)"
    r")\b",
    re.I,
)
EVENT_SUBJECT_CONTEXT = re.compile(
    r"\b(?:ufo|uap|object|target|phenomen(?:on|a)|saucer|disc|craft|aircraft|foo\s*fighter|"
    r"sighting|encounter|anomal(?:y|ous)|something|ovni|objet|cible|phénomène|phenomene|"
    r"soucoupe|disque|engin|aéronef|aeronef|observation|rencontre|anomalie|"
    r"(?:luminous|bright|unidentified)\s+(?:light|ball|body)|"
    r"(?:lumineux|brillant|non\s+identifié)\s+(?:lumière|boule|corps))s?\b", re.I,
)
RADAR_DATE_CONTEXT = re.compile(r"\b(?:tracked|detected)\b", re.I)
NON_UFO_EVENT_CONTEXT = re.compile(
    r"\b(?:airstrike|munition|artillery|combat|joint task force|task force operation|killed in action)\b", re.I,
)
EVENT_TYPES = [
    ("sighting", re.compile(
        r"\b(?:observed|sighted|witnessed|reported seeing|appearance|observe|voit|aperçoit|apercoit|"
        r"observé|aperçu|vu|signalé|témoigné)\b",
        re.I,
    )),
    ("radar_detection", re.compile(r"\b(?:radar|detected|tracked)\b", re.I)),
    ("landing", re.compile(r"\b(?:landed|landing|atterri|atterrissage)\b", re.I)),
    ("crash", re.compile(r"\b(?:crashed|crash|exploded|écrasé|ecrase|explosé|explose)\b", re.I)),
    ("encounter", re.compile(r"\b(?:encountered|encounter|rencontré|rencontre)\b", re.I)),
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
MONTH_LOOKUP = {name.casefold(): number for name, number in MONTHS.items()}
MONTH_LOOKUP.update({
    "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5,
    "juin": 6, "juillet": 7, "août": 8, "aout": 8, "septembre": 9, "octobre": 10,
    "novembre": 11, "décembre": 12, "decembre": 12,
})
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
    "air base", "air base group", "area code", "base operations", "city hall", "force base",
    "international airport", "naval base", "returned to base", "warning area",
    "air force", "armed forces", "assistant director", "chief of staff", "department",
    "executive officer", "flying object", "general public", "intelligence officer",
    "national security", "press release", "program manager", "project officer", "public affairs",
    "secretary of defense", "special agent", "the united states", "united states",
    "chief science officer founder",
    "unidentified aerial phenomena", "unidentified flying object",
    "program summary", "program sunmary", "this department",
}
NON_ENTITY_PHRASE = re.compile(
    r"^(?:"
    r"(?:the )?defense intelligence reference documents?|"
    r"spot intelligence reports?|intelligence reports?(?: no| relating| relatiag)?|"
    r"(?:international|research) organizations?|(?:advisory|services|house|investigations?) committees?|"
    r"(?:name of )?(?:the )?(?:investigating|meteorological|intelligence|police|first|safety|signal|liaison|briefing|preparing|personnel|requirements|district|public affairs) officers?|"
    r"district intelligence officers?|army officers?|"
    r"(?:foia|gvsc foia|milwaukee|san francisco|district|police|safety|signal|liaison|preparing|personnel|requirements|public affairs|intelligence) offices?|"
    r"(?:comanding|conmanding|comnanding|connanding|cornanding) officer|"
    r"bureau agents?|post offices?|post office inspectors?|military departments?|intelligence departmenty?|projects? agency|"
    r"(?:the )?(?:assistant |deputy )?d(?:iractor|ireator|ireotor|ireetor|irector)(?:ate)? (?:of |for )?(?:scientific )?intelligence|"
    r"intelligence (?:advisory|advisor|if|i|t|com|commu|con|div)|(?:an |the )intelligence|"
    r"office of scientifi(?:c|o)|administration is|the administration|"
    r"for departmental use only|departmento thousands of dollars?|bureau (?:will|vill) be advised of any|"
    r"authorized (?:army|navy) construction and land acquisi|subtotal department of the (?:army|air)|"
    r"title [ivxlc]+ (?:army|navy) military construction|title [ivxlc]+ department of energy|"
    r"(?:comments|carments) of (?:the )?preparing officer|"
    r"adjacent airport operations?|special flight rules areas?|launch site facility costs?|"
    r"controlled firing areas?|airport stream filters?|control airspace areas?|airport operators?|"
    r"restricted areas?|hyper lens based|surface areas?|range foulers?|"
    r"vfr terminal area charts?.*|cseti? websites?|strange object was film.*|"
    r"airport surface detection equipment.*|chart showing balloon .*|prearranged coord.*|"
    r"military operat(?:ions|ing) area|pacific islands?|library subject (?:and|area|&)?.*area codes|"
    r"base (?:commander|command)|emergency airport recommenda.*|diverse vector area.*|"
    r"air traffic on site coordination.*|report on sov.* island .*|same area near .* during .*"
    r"|superintendent (?:l|i)rwe range|chosen (?:eor|for) its foundation|"
    r"(?:the nation|national) institute|intelligence of the house of representa.*|"
    r"(?:ano|and) organization|administration is|general administration|"
    r"telephon(?:isallx advised this office that an|ically arvised this office thai an)|"
    r"appropriate committees of con(?:gress)?|aviation administration(?: has)?"
    r")$"
)
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
    "show", "thought", "travel", "type", "unidentified", "war", "working",
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
FIRST_NAMES.update({
    "alain", "andre", "antoine", "benoit", "bernard", "brigitte", "camille", "catherine",
    "cecile", "charlotte", "christophe", "claire", "claude", "dominique", "emilie", "etienne", "francois",
    "frederic", "gerard", "guillaume", "helene", "isabelle", "jacques", "julien", "laurent",
    "luc", "marc", "marie", "mathieu", "michel", "nathalie", "nicolas", "olivier", "pascal",
    "patrick", "pierre", "rene", "sebastien", "sophie", "stephane", "thierry", "valerie",
    "veronique", "vincent", "xavier",
})
ROLE_PREFIX = re.compile(r"^(?:President|Professor|Senator|Congressman|Congresswoman|Secretary|Admiral|General|Colonel|Captain)\s+", re.I)
FIELD_LABELS = {
    "date", "document", "from", "memorandum", "name", "page", "reference", "subject", "to",
}
HONORIFIC = re.compile(r"^(?:Dr\.|Mr\.|Mrs\.|Ms\.|Gen\.|General|Colonel|Col\.|Major|Maj\.|Captain|Capt\.|Lt\.|Lieutenant)\s+", re.I)
RELATIONS = [
    ("affiliated_with", re.compile(r"\b(?:worked|works|served|employed|assigned|member|director|chief|head|affiliated|travaille|travaillait|travaillé|employé|affilié|membre|directeur|chef)\b", re.I)),
    ("reported_to", re.compile(r"\b(?:reported to|under the command of|supervised by|sous le commandement de|supervisé par)\b", re.I)),
    ("investigated", re.compile(r"\b(?:investigated|investigation of|inquired into|examined|enquêté|enquête sur|examiné)\b", re.I)),
    ("located_at", re.compile(r"\b(?:located|stationed|based|at the site|near|situé|stationné|basé|sur le site|près de)\b", re.I)),
]

CRAFT_UNIT_FACTORS = {
    "in": 0.0254, "inch": 0.0254, "inches": 0.0254,
    "ft": 0.3048, "foot": 0.3048, "feet": 0.3048,
    "yd": 0.9144, "yard": 0.9144, "yards": 0.9144,
    "m": 1.0, "meter": 1.0, "meters": 1.0, "metre": 1.0, "metres": 1.0,
    "cm": 0.01, "centimeter": 0.01, "centimeters": 0.01, "centimetre": 0.01, "centimetres": 0.01,
    "km": 1000.0, "kilometer": 1000.0, "kilometers": 1000.0, "kilometre": 1000.0, "kilometres": 1000.0,
    "mi": 1609.344, "mile": 1609.344, "miles": 1609.344,
}
CRAFT_UNIT_PATTERN = "|".join(sorted((re.escape(unit) for unit in CRAFT_UNIT_FACTORS), key=len, reverse=True))
CRAFT_ESTIMATE_PATTERN = r"(?P<estimate>about|approximately|approx\.?|estimated|roughly|nearly|around)?\s*"
CRAFT_NUMBER_PATTERN = r"(?P<minimum>\d+(?:\.\d+)?)\s*(?:(?:-|–|to|through)\s*(?P<maximum>\d+(?:\.\d+)?))?"
CRAFT_MEASUREMENT_PATTERNS = [
    re.compile(
        rf"(?<![\d,.])\b{CRAFT_ESTIMATE_PATTERN}(?P<minimum>\d+(?:\.\d+)?)\s*(?P<unit1>{CRAFT_UNIT_PATTERN})\s*(?:-|–|to)\s*(?P<maximum>\d+(?:\.\d+)?)\s*(?P<unit>{CRAFT_UNIT_PATTERN})\b\s*(?:in\s+)?(?P<kind>diameter|wide|width|high|height|long|length)\b",
        re.I,
    ),
    re.compile(
        rf"(?<![\d,.])\b{CRAFT_ESTIMATE_PATTERN}{CRAFT_NUMBER_PATTERN}\s*(?P<unit>{CRAFT_UNIT_PATTERN})\b\s*(?:in\s+)?(?P<kind>diameter|wide|width|high|height|long|length)\b",
        re.I,
    ),
    re.compile(
        rf"(?<![\d,.])\b(?P<kind>diameter|width|height|length)\s+(?:of\s+)?{CRAFT_ESTIMATE_PATTERN}{CRAFT_NUMBER_PATTERN}\s*(?P<unit>{CRAFT_UNIT_PATTERN})\b",
        re.I,
    ),
    re.compile(
        rf"(?<![\d,.])\b{CRAFT_ESTIMATE_PATTERN}{CRAFT_NUMBER_PATTERN}\s*[- ](?P<unit>{CRAFT_UNIT_PATTERN})[- ](?P<kind>diameter|wide|width|high|height|long|length)\b",
        re.I,
    ),
]
CRAFT_PAIRED_MEASUREMENT = re.compile(
    rf"(?<![\d,.])\b{CRAFT_ESTIMATE_PATTERN}(?P<width>\d+(?:\.\d+)?)\s*(?:by|x|×)\s*(?P<height>\d+(?:\.\d+)?)\s*(?P<unit>{CRAFT_UNIT_PATTERN})\b",
    re.I,
)
CRAFT_UNMAPPED_SHAPE = re.compile(
    r"\b(?P<phrase>[a-z][a-z0-9-]{1,28}(?:-|\s)shaped\s+(?:objects?|craft|ufos?|uaps?))\b",
    re.I,
)
CRAFT_TRIGGER = re.compile(
    r"\b(?:sphere|spherical|orb|triangle|triangular|pyramid|pyramidal|tic[- ]tac|capsule|cigar|cylinder|cylindrical|"
    r"saucer|disc|disk|boomerang|chevron|egg|ovoid|diamond|cube|cubic|tetrahedron|blob|manta[- ]ray|jellyfish|hornet)(?:s|es|d|ical|[- ]shaped)?\b|"
    r"\b[a-z][a-z0-9-]{1,28}(?:-|\s)shaped\s+(?:objects?|craft|ufos?|uaps?)\b",
    re.I,
)
CRAFT_VISUAL_FEATURES = {
    "dark_body": re.compile(r"\b(?:black|dark|darkened|charcoal)\b", re.I),
    "light_emission": re.compile(r"\b(?:lights?|glowing|illuminated|luminous)\b", re.I),
    "three_lights": re.compile(r"\b(?:three|3)\b.{0,35}\b(?:lights?|glow(?:ing)?)\b", re.I),
    "corner_lights": re.compile(
        r"(?:\b(?:lights?|glow(?:ing)?)\b.{0,50}\b(?:corners?|tips?|points?|vertices)\b|"
        r"\b(?:corners?|tips?|points?|vertices)\b.{0,50}\b(?:lights?|glow(?:ing)?)\b)", re.I,
    ),
    "central_light": re.compile(
        r"\b(?:central|center|centre|middle)\b.{0,45}\b(?:lights?|glow(?:ing)?|illuminat(?:ed|ion)?|circle|cluster)\b", re.I,
    ),
    "metallic_surface": re.compile(r"\b(?:metallic|silver|aluminum|aluminium|chrome)\b", re.I),
    "smooth_surface": re.compile(r"\b(?:smooth|seamless|featureless)\b", re.I),
    "dome": re.compile(r"\b(?:dome|domed|cupola)\b", re.I),
    "rim_or_band": re.compile(r"\b(?:rim|rimmed|edge|perimeter|band)\b", re.I),
    "windows_or_ports": re.compile(r"\b(?:windows?|portholes?)\b", re.I),
    "underside": re.compile(r"\b(?:underside|underneath|bottom|belly)\b", re.I),
}

SIGNAL_FREQUENCY_PATTERN = re.compile(
    r"(?<![\w.])(?P<value>(?:\d{1,3}(?:,\d{3})+|\d{1,12})(?:\.\d+)?)\s*"
    r"(?P<unit>hz|khz|mhz|ghz|hertz|kilohertz|megahertz|gigahertz)\b",
    re.I,
)
SIGNAL_CONTEXTUAL_GHZ_VALUE_PATTERN = re.compile(
    r"(?<![\w.])(?P<value>\d{1,3}\.\d+)(?!\w)(?!\.\d)",
    re.I,
)
SIGNAL_CONTEXTUAL_GHZ_LEAD_IN = re.compile(r"\b(?:at|in|near|around)(?:\s+the)?\s*$", re.I)
SIGNAL_CONTEXTUAL_GHZ_CLAIM_CUE = re.compile(r"\b(?:frequency|signal)\b", re.I)
SIGNAL_CONTEXTUAL_GHZ_BAND_CUE = re.compile(r"\bmicrowave(?:\s+(?:frequency\s+)?range)?\b", re.I)
SIGNAL_CONTEXTUAL_UNIT_SUFFIX = re.compile(r"^\s*(?:[A-Za-z%°/]|per\b)", re.I)
SIGNAL_CONTEXTUAL_EXPLICIT_RANGE_SUFFIX = re.compile(
    r"^\s*(?:-|–|—|to\b)\s*(?:\d{1,3}(?:,\d{3})+|\d{1,12})(?:\.\d+)?\s*"
    r"(?:hz|khz|mhz|ghz|hertz|kilohertz|megahertz|gigahertz)\b",
    re.I,
)
SIGNAL_UNIT_FACTORS = {
    "hz": 1, "hertz": 1,
    "khz": 1_000, "kilohertz": 1_000,
    "mhz": 1_000_000, "megahertz": 1_000_000,
    "ghz": 1_000_000_000, "gigahertz": 1_000_000_000,
}

EPISTEMIC_RULE_SCHEMA = "ufo-files-epistemic-qualifier-rules/v1"


def load_epistemic_qualifier_rules(path: Path) -> dict | None:
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema") != EPISTEMIC_RULE_SCHEMA:
        raise ValueError(f"Unsupported epistemic qualifier rules: {path}")
    return {
        "schema": payload["schema"],
        "policy": payload.get("policy", "Annotations are additive and do not alter source data or graph counts."),
        "rules": [
            {**item, "compiled": re.compile(item["pattern"], re.I)}
            for item in payload.get("rules", [])
        ],
        "nonClaimFollowup": re.compile(payload["nonClaimFollowupPattern"], re.I),
    }


CLAIM_CLAUSE_BOUNDARY = re.compile(r"(?:[.!?;]|\s+\b(?:but|however|although|whereas|while)\b\s*)", re.I)


def claim_clause(text: str, *, preceding: bool = False) -> str:
    """Return only the clause adjacent to a qualifier, not the rest of the segment."""
    if preceding:
        parts = CLAIM_CLAUSE_BOUNDARY.split(text)
        return clean_space(parts[-1] if parts else text).strip(" ,:;—-.")
    boundary = CLAIM_CLAUSE_BOUNDARY.search(text)
    return clean_space(text[:boundary.start()] if boundary else text).strip(" ,:;—-.")


def epistemic_qualifiers_for_segment(
    text: str,
    segment: int | str,
    rules: dict | None,
    next_text: str = "",
    next_segment: int | str | None = None,
) -> list[dict]:
    if not rules:
        return []
    results = []
    for rule in rules["rules"]:
        for match in rule["compiled"].finditer(text):
            preceding = claim_clause(text[:match.start()], preceding=True)
            claim_text = claim_clause(text[match.end():])
            scope = "same_segment"
            claim_segment = segment
            confidence = float(rule["confidence"])
            if len(claim_text.split()) < 5 and len(preceding.split()) >= 5:
                claim_text = preceding
                scope = "preceding_clause"
            elif not claim_text and next_text:
                claim_text = claim_clause(clean_space(f"{claim_text} {next_text}"))
                scope = "next_segment_candidate"
                claim_segment = next_segment if next_segment is not None else (int(segment) + 1 if isinstance(segment, int) else None)
                confidence = min(confidence, .82)
            if not claim_text or rules["nonClaimFollowup"].match(claim_text):
                scope = "unresolved"
                confidence = min(confidence, .55)
            results.append({
                "category": rule["category"],
                "qualifier": match.group(0),
                "claimText": claim_text,
                "segment": segment,
                "claimSegment": claim_segment,
                "scope": scope,
                "confidence": round(confidence, 2),
                "evidenceWeight": round(1 - confidence * (1 - float(rule.get("evidenceWeight", 1))), 3),
                "speakerAttribution": "unresolved",
                "reviewStatus": "candidate",
                "evidenceExcerpt": text,
            })
    return results


def qualifiers_for_claim(qualifiers: list[dict], raw: str, canonical: str, segment: int | str) -> list[dict]:
    """Limit annotations to qualifiers whose resolved claim contains this mention."""
    mentions = {comparison_key(raw), comparison_key(canonical)} - {""}
    return [
        item for item in qualifiers
        if item.get("scope") != "unresolved"
        and item.get("claimSegment") == segment
        and any(re.search(rf"(?<!\w){re.escape(mention)}(?!\w)", comparison_key(item.get("claimText", ""))) for mention in mentions)
    ]


def signal_frequency_label(hertz: float) -> str:
    for threshold, suffix in ((1_000_000_000, "GHz"), (1_000_000, "MHz"), (1_000, "kHz")):
        if hertz >= threshold:
            value = hertz / threshold
            return f"{value:g} {suffix}"
    return f"{hertz:g} Hz"


def signal_observations_for_segment(text: str, document_id: str, source: str, segment: int | str) -> list[dict]:
    """Retain explicit frequencies plus tightly constrained unit-elided microwave values."""
    observations = []
    explicit_spans = []
    for match in SIGNAL_FREQUENCY_PATTERN.finditer(text):
        explicit_spans.append(match.span())
        value = float(match.group("value").replace(",", ""))
        hertz = value * SIGNAL_UNIT_FACTORS[match.group("unit").casefold()]
        if not 1 <= hertz <= 300_000_000_000:
            continue
        start = max(0, match.start() - 180)
        end = min(len(text), match.end() + 260)
        excerpt = clean_space(text[start:end])
        observations.append({
            "id": stable_id("signal-obs", f"{document_id}|{segment}|{match.start()}|{hertz.hex()}"),
            "frequencyHz": hertz,
            "frequencyLabel": signal_frequency_label(hertz),
            "originalPhrase": match.group(0),
            "documentId": document_id,
            "source": source,
            "segment": segment,
            "excerpt": excerpt,
        })
    for match in SIGNAL_CONTEXTUAL_GHZ_VALUE_PATTERN.finditer(text):
        if any(start <= match.start() < end for start, end in explicit_spans):
            continue
        prefix = text[max(0, match.start() - 180):match.start()]
        contextual_clause = claim_clause(prefix, preceding=True)
        suffix = text[match.end():]
        if (
            not SIGNAL_CONTEXTUAL_GHZ_LEAD_IN.search(contextual_clause[-24:])
            or not SIGNAL_CONTEXTUAL_GHZ_CLAIM_CUE.search(contextual_clause)
            or not SIGNAL_CONTEXTUAL_GHZ_BAND_CUE.search(contextual_clause)
            or SIGNAL_CONTEXTUAL_UNIT_SUFFIX.match(suffix)
            or SIGNAL_CONTEXTUAL_EXPLICIT_RANGE_SUFFIX.match(suffix)
        ):
            continue
        value = float(match.group("value"))
        hertz = value * SIGNAL_UNIT_FACTORS["ghz"]
        if not 300_000_000 <= hertz <= 300_000_000_000:
            continue
        start = max(0, match.start() - 180)
        end = min(len(text), match.end() + 260)
        observations.append({
            "id": stable_id("signal-obs", f"{document_id}|{segment}|{match.start()}|{hertz.hex()}"),
            "frequencyHz": hertz,
            "frequencyLabel": signal_frequency_label(hertz),
            "originalPhrase": match.group(0),
            "documentId": document_id,
            "source": source,
            "segment": segment,
            "excerpt": clean_space(text[start:end]),
            "unitProvenance": "contextual-microwave-band",
        })
    return observations


def signal_frequency_summaries(observations: list[dict], family_by_document: dict[str, str]) -> list[dict]:
    grouped: dict[float, list[dict]] = collections.defaultdict(list)
    for observation in observations:
        grouped[observation["frequencyHz"]].append(observation)
    summaries = []
    for hertz, matching in grouped.items():
        document_ids = sorted({item["documentId"] for item in matching})
        sources = sorted({item["source"] for item in matching})
        family_ids = sorted({family_by_document.get(document_id, document_id) for document_id in document_ids})
        summaries.append({
            "id": stable_id("signal-frequency", hertz.hex()),
            "frequencyHz": hertz,
            "frequencyLabel": signal_frequency_label(hertz),
            "mentionCount": len(matching),
            "documentCount": len(document_ids),
            "sourceCount": len(sources),
            "independentSourceFamilyCount": len(family_ids),
            "documentIds": document_ids,
            "sources": sources,
            "observationIds": [item["id"] for item in matching],
            "evidence": [{"documentId": item["documentId"], "excerpt": item["excerpt"]} for item in matching[:8]],
        })
    return sorted(summaries, key=lambda item: item["frequencyHz"])


@functools.lru_cache(maxsize=None)
def craft_phrase_pattern(phrase: str) -> re.Pattern:
    """Compile a reviewed literal phrase while tolerating spaces and hyphens."""
    raw_tokens = [token for token in re.split(r"[-\s]+", phrase.strip()) if token]
    tokens = [re.escape(token) for token in raw_tokens]
    if raw_tokens and raw_tokens[-1].lower() in {"object", "craft", "ufo", "uap", "saucer", "disc", "disk"}:
        tokens[-1] += "s?"
    return re.compile(r"\b" + r"(?:[-\s]+)".join(tokens) + r"\b", re.I)


def craft_witness_type(text: str, taxonomy: dict) -> tuple[str, str]:
    lowered = text.casefold()
    for witness_type, terms in taxonomy.get("witnessTypes", {}).items():
        term = next((candidate for candidate in terms if candidate.casefold() in lowered), None)
        if term:
            return witness_type, term
    return "unspecified", ""


def craft_measurements(text: str, document_id: str, segment: int) -> list[dict]:
    """Extract only explicit physical measurements and normalize units without inventing axes."""
    measurements: list[dict] = []
    occupied: list[tuple[int, int]] = []

    def add(match: re.Match, kind: str, minimum: float, maximum: float | None, unit: str, suffix: str = "") -> None:
        normalized_kind = {"wide": "width", "high": "height", "long": "length"}.get(kind.lower(), kind.lower())
        maximum = maximum if maximum is not None else minimum
        surrounding = text[max(0, match.start() - 20):min(len(text), match.end() + 45)].casefold()
        altitude_context = normalized_kind == "height" and (
            "at a height of" in surrounding
            or re.search(r"\b(?:in the sky|above (?:ground|sea level|them|the ground)|altitude)\b", surrounding)
        )
        if minimum <= 0 or maximum <= 0 or altitude_context:
            return
        axis = "height" if normalized_kind == "height" else "width"
        factor = CRAFT_UNIT_FACTORS[unit.lower()]
        raw = match.group(0).strip()
        measurement_id = stable_id("craft-measure", f"{document_id}|{segment}|{match.start()}|{normalized_kind}|{raw}|{suffix}")
        measurements.append({
            "id": measurement_id,
            "kind": normalized_kind,
            "axis": axis,
            "originalText": raw,
            "originalValue": minimum if minimum == maximum else None,
            "originalRange": [minimum, maximum] if minimum != maximum else None,
            "originalUnit": unit.lower(),
            "normalizedMeters": round(((minimum + maximum) / 2) * factor, 4),
            "normalizedRangeMeters": [round(minimum * factor, 4), round(maximum * factor, 4)],
            "conversionFactor": factor,
            "conversionApplied": factor != 1.0,
            "reportedAs": "estimate" if match.groupdict().get("estimate") else "direct",
            "axisMethod": "reported-height" if normalized_kind == "height" else (
                "reported-width" if normalized_kind == "width" else f"reported-{normalized_kind}-used-for-width"
            ),
        })

    for match in CRAFT_PAIRED_MEASUREMENT.finditer(text):
        unit = match.group("unit")
        add(match, "width", float(match.group("width")), None, unit, "width")
        add(match, "height", float(match.group("height")), None, unit, "height")
        occupied.append(match.span())
    for pattern in CRAFT_MEASUREMENT_PATTERNS:
        for match in pattern.finditer(text):
            if any(match.start() < end and match.end() > start for start, end in occupied):
                continue
            if match.groupdict().get("unit1") and match.group("unit1").lower() != match.group("unit").lower():
                continue
            minimum = float(match.group("minimum"))
            maximum = float(match.group("maximum")) if match.group("maximum") else None
            add(match, match.group("kind"), minimum, maximum, match.group("unit"))
            occupied.append(match.span())
    unique = {measurement["id"]: measurement for measurement in measurements}
    return list(unique.values())


def craft_observations_for_segment(
    text: str,
    document_id: str,
    source: str,
    segment: int | str,
    taxonomy: dict,
) -> tuple[list[dict], list[dict]]:
    """Classify reviewed craft phrases and retain exclusions/unmapped language for review."""
    source_mappings = [
        mapping
        for craft_class in taxonomy.get("classes", [])
        for mapping in craft_class.get("mappings", [])
        if source in mapping.get("sources", [])
    ]
    if not CRAFT_TRIGGER.search(text) and not any(
        craft_phrase_pattern(mapping["phrase"]).search(text) for mapping in source_mappings
    ):
        return [], []
    lowered = text.casefold()
    context_terms = [term.casefold() for term in taxonomy.get("contextTerms", [])]
    has_context = any(term in lowered for term in context_terms)
    exclusion = next((rule for rule in taxonomy.get("exclusionRules", [])
                      if any(term.casefold() in lowered for term in rule.get("terms", []))), None)
    matches: list[dict] = []
    candidates: list[dict] = []
    occupied: list[tuple[int, int]] = []
    witness_type, witness_phrase = craft_witness_type(text, taxonomy)

    for craft_class in taxonomy.get("classes", []):
        for mapping in craft_class.get("mappings", []):
            allowed_sources = mapping.get("sources")
            if allowed_sources and source not in allowed_sources:
                continue
            for match in craft_phrase_pattern(mapping["phrase"]).finditer(text):
                phrase = match.group(0)
                candidate = {
                    "phrase": phrase,
                    "normalizedPhrase": mapping["phrase"],
                    "classId": craft_class["id"],
                    "documentId": document_id,
                    "source": source,
                    "segment": segment,
                    "excerpt": text[:500],
                }
                if exclusion:
                    candidates.append({**candidate, "decision": "excluded", "reason": exclusion["id"]})
                    occupied.append(match.span())
                    continue
                if not has_context and mapping["matchType"] != "authority_class":
                    candidates.append({**candidate, "decision": "ambiguous", "reason": "missing-report-context"})
                    occupied.append(match.span())
                    continue
                matches.append({
                    "id": stable_id("craft-obs", f"{document_id}|{segment}|{match.start()}|{craft_class['id']}|{phrase.lower()}"),
                    "classId": craft_class["id"],
                    "originalPhrase": phrase,
                    "normalizedPhrase": mapping["phrase"],
                    "matchType": mapping["matchType"],
                    "confidence": mapping["confidence"],
                    "documentId": document_id,
                    "source": source,
                    "segment": segment,
                    "witnessType": witness_type,
                    "witnessPhrase": witness_phrase,
                    "excerpt": text[:500],
                    "measurements": [],
                })
                occupied.append(match.span())

    for match in CRAFT_UNMAPPED_SHAPE.finditer(text):
        if any(match.start() < end and match.end() > start for start, end in occupied):
            continue
        phrase = match.group("phrase")
        candidate = {
            "phrase": phrase, "normalizedPhrase": comparison_key(phrase), "classId": "unknown",
            "documentId": document_id, "source": source, "segment": segment, "excerpt": text[:500],
            "decision": "unmapped", "reason": "no-reviewed-phrase-mapping",
        }
        candidates.append(candidate)
        if has_context and not exclusion:
            matches.append({
                "id": stable_id("craft-obs", f"{document_id}|{segment}|{match.start()}|unknown|{phrase.lower()}"),
                "classId": "unknown", "originalPhrase": phrase, "normalizedPhrase": comparison_key(phrase),
                "matchType": "unmapped_candidate", "confidence": 0.5, "documentId": document_id,
                "source": source, "segment": segment, "witnessType": witness_type,
                "witnessPhrase": witness_phrase, "excerpt": text[:500], "measurements": [],
            })

    measurements = craft_measurements(text, document_id, segment)
    if len(matches) == 1:
        matches[0]["measurements"] = measurements
    elif measurements and matches:
        candidates.append({
            "phrase": ", ".join(match["originalPhrase"] for match in matches),
            "normalizedPhrase": "multiple craft phrases", "classId": "unknown", "documentId": document_id,
            "source": source, "segment": segment, "excerpt": text[:500], "decision": "ambiguous",
            "reason": "measurement-near-multiple-craft-phrases",
        })
    return matches, candidates


def craft_review_summary(candidates: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str, str], dict] = {}
    for candidate in candidates:
        key = (candidate["decision"], comparison_key(candidate["phrase"]), candidate["reason"])
        item = grouped.setdefault(key, {
            "id": stable_id("craft-candidate", "|".join(key)),
            "phrase": candidate["phrase"], "decision": candidate["decision"], "reason": candidate["reason"],
            "count": 0, "examples": [],
        })
        item["count"] += 1
        if len(item["examples"]) < 3:
            item["examples"].append({key: candidate[key] for key in ("documentId", "source", "segment", "excerpt")})
    return sorted(grouped.values(), key=lambda item: (-item["count"], item["phrase"].lower()))


def craft_dimension_summary(observations: list[dict], axis: str) -> dict | None:
    measurements = [measurement for observation in observations for measurement in observation.get("measurements", [])
                    if measurement["axis"] == axis]
    if not measurements:
        return None
    values = [measurement["normalizedMeters"] for measurement in measurements]
    return {
        "meanMeters": round(sum(values) / len(values), 3),
        "minMeters": round(min(values), 3),
        "maxMeters": round(max(values), 3),
        "n": len(values),
        "observationCount": sum(any(measurement["axis"] == axis for measurement in observation.get("measurements", []))
                                for observation in observations),
        "measurementIds": [measurement["id"] for measurement in measurements],
    }


def craft_visual_evidence(observations: list[dict]) -> list[dict]:
    """Summarize literal visual motifs without turning sparse details into class-wide claims."""
    features = []
    for feature, pattern in CRAFT_VISUAL_FEATURES.items():
        matching = [observation for observation in observations if pattern.search(observation.get("excerpt", ""))]
        if not matching:
            continue
        features.append({
            "feature": feature,
            "observationCount": len(matching),
            "documentCount": len({observation["documentId"] for observation in matching}),
            "observationIds": [observation["id"] for observation in matching],
            "examples": [
                {"documentId": observation["documentId"], "excerpt": observation["excerpt"]}
                for observation in matching[:3]
            ],
        })
    return features


def craft_class_summaries(taxonomy: dict, observations: list[dict]) -> list[dict]:
    summaries = []
    for craft_class in taxonomy.get("classes", []):
        matching = [observation for observation in observations if observation["classId"] == craft_class["id"]]
        if not matching and craft_class["id"] != "unknown" and not craft_class.get("authority"):
            continue
        document_ids = sorted({observation["documentId"] for observation in matching})
        sources = sorted({observation["source"] for observation in matching})
        summaries.append({
            "id": f"craft-class-{craft_class['id']}",
            "classId": craft_class["id"], "name": craft_class["label"], "description": craft_class["description"],
            "authority": craft_class.get("authority"),
            "drawingProfile": craft_class.get("drawingProfile"),
            "observationCount": len(matching), "documentCount": len(document_ids), "sourceCount": len(sources),
            "documentIds": document_ids, "sources": sources,
            "confidence": round(sum(item["confidence"] for item in matching) / len(matching), 3) if matching else 0,
            "dimensions": {
                "width": craft_dimension_summary(matching, "width"),
                "height": craft_dimension_summary(matching, "height"),
            },
            "observationIds": [observation["id"] for observation in matching],
            "evidence": [{"documentId": item["documentId"], "excerpt": item["excerpt"]} for item in matching[:8]],
            "visualEvidence": craft_visual_evidence(matching),
        })
    return summaries


def compile_astronomy_taxonomy(taxonomy: dict) -> dict:
    """Compile the reviewed astronomy target list into one cheap segment matcher."""
    trigger_stopwords = {
        "a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "the", "to", "with",
        "de", "des", "du", "et", "la", "le", "les", "un", "une",
        "as", "da", "das", "do", "dos", "e", "o", "os", "um", "uma",
    }
    entries = sorted([
        (
            target,
            alias,
            species_phrase_pattern(alias),
            target.get("requiresContext", False) or alias.casefold() in {
                item.casefold() for item in target.get("contextualAliases", [])
            },
        )
        for target in taxonomy.get("targets", [])
        for alias in target.get("aliases", [])
    ], key=lambda item: (-len(item[1]), item[1].casefold()))
    trigger_tokens = {
        token
        for _, alias, _, _ in entries
        for token in re.findall(r"[^\W_]+(?:['’][^\W_]+)*", alias.casefold())
        if len(token) >= 2 and token not in trigger_stopwords
    }
    context_patterns = {
        target["id"]: [species_phrase_pattern(term) for term in target.get("contextAny", [])]
        for target in taxonomy.get("targets", [])
    }
    exclusion_patterns = {
        target["id"]: [species_phrase_pattern(term) for term in target.get("excludeContextAny", [])]
        for target in taxonomy.get("targets", [])
    }
    return {
        "entries": entries,
        "triggerTokens": trigger_tokens,
        "contextPatterns": context_patterns,
        "exclusionPatterns": exclusion_patterns,
        "globalContextPatterns": [species_phrase_pattern(term) for term in taxonomy.get("contextTerms", [])],
        "postpositiveContextPatterns": [
            re.compile(pattern, re.IGNORECASE)
            for pattern in taxonomy.get("postpositiveContextPatterns", [])
        ],
    }


def astronomy_clause_bounds_for_match(text: str, start: int, end: int) -> tuple[int, int]:
    """Return the punctuation- or contrast-bounded span containing one alias."""
    boundaries = list(re.finditer(
        r"[.!?;:]|\b(?:although|but|however|though|whereas|while|mais|cependant|pourtant|tandis\s+que|alors\s+que|embora|enquanto|porém|contudo)\b",
        text,
        re.IGNORECASE,
    ))
    clause_start = max((item.end() for item in boundaries if item.end() <= start), default=0)
    clause_end = min((item.start() for item in boundaries if item.start() >= end), default=len(text))
    return clause_start, clause_end


def astronomy_clause_for_match(text: str, start: int, end: int) -> str:
    """Return the punctuation- or contrast-bounded clause containing one alias."""
    clause_start, clause_end = astronomy_clause_bounds_for_match(text, start, end)
    return text[clause_start:clause_end]


def astronomy_global_context_for_match(
    text: str,
    match: re.Match,
    clause_start: int,
    clause_end: int,
    compiled: dict,
) -> str:
    """Keep broad context inside the coordinated predicate containing one alias."""
    aliases = sorted({
        alias_match.span()
        for _, _, alias_pattern, _ in compiled["entries"]
        for alias_match in alias_pattern.finditer(text, clause_start, clause_end)
    })
    connector = re.compile(r"\s*(?:(?:,|&)|\b(?:and|or|et|ou|e)\b\s*)*\s*", re.IGNORECASE)
    context_start = clause_start
    context_end = clause_end
    for conjunction in re.finditer(r"\b(?:and|or|et|ou|e)\b", text[clause_start:clause_end], re.IGNORECASE):
        boundary_start = clause_start + conjunction.start()
        boundary_end = clause_start + conjunction.end()
        preceding = [span for span in aliases if span[1] <= boundary_start]
        following = [span for span in aliases if span[0] >= boundary_end]
        if not preceding or not following:
            continue
        left_alias = preceding[-1]
        right_alias = following[0]
        aliases_are_coordinated = connector.fullmatch(text[left_alias[1]:boundary_start]) and connector.fullmatch(
            text[boundary_end:right_alias[0]]
        )
        if aliases_are_coordinated:
            continue
        if match.end() <= boundary_start:
            context_end = min(context_end, boundary_start)
        elif match.start() >= boundary_end:
            context_start = max(context_start, boundary_end)
    return text[context_start:context_end]


def astronomy_postpositive_context(text: str, match: re.Match, clause_end: int, compiled: dict) -> str:
    """Keep a following predicate with its matched or coordinated astronomy subjects."""
    cursor = match.end()
    cutoff = clause_end
    suffix = text[cursor:clause_end]
    predicate_starts = [
        predicate.start() + cursor
        for pattern in compiled["postpositiveContextPatterns"]
        if (predicate := pattern.search(suffix))
    ]
    first_predicate_start = min(predicate_starts, default=None)
    following_aliases = sorted({
        alias_match.span()
        for _, _, alias_pattern, _ in compiled["entries"]
        for alias_match in alias_pattern.finditer(text, cursor, clause_end)
    })
    connector = re.compile(r"\s*(?:(?:,|&)|\b(?:and|or|et|ou|e)\b\s*)*\s*", re.IGNORECASE)
    for alias_start, alias_end in following_aliases:
        if alias_start < cursor:
            continue
        if first_predicate_start is not None and alias_start > first_predicate_start:
            break
        if connector.fullmatch(text[cursor:alias_start]):
            cursor = alias_end
            continue
        cutoff = alias_start
        break
    return text[match.end():cutoff]


def astronomy_observations_for_segment(
    text: str,
    document_id: str,
    source: str,
    segment: int | str,
    taxonomy: dict,
    compiled: dict | None = None,
    context_segments: list[str] | None = None,
    context_segment_index: int | None = None,
) -> tuple[list[dict], list[dict]]:
    """Match reviewed astronomical names and quarantine context-dependent ambiguity."""
    compiled = compiled or compile_astronomy_taxonomy(taxonomy)
    text_tokens = set(re.findall(r"[^\W_]+(?:['’][^\W_]+)*", text.casefold()))
    text_tokens.update(re.sub(r"['’]s$", "", token) for token in tuple(text_tokens))
    if not text_tokens.intersection(compiled["triggerTokens"]):
        return [], []
    observations: list[dict] = []
    candidates: list[dict] = []
    occupied: list[tuple[int, int]] = []
    for target, alias, pattern, requires_context in compiled["entries"]:
        for match in pattern.finditer(text):
            if any(match.start() < end and match.end() > start for start, end in occupied):
                continue
            excerpt = clean_space(text[max(0, match.start() - 220):min(len(text), match.end() + 220)])
            base = {
                "targetId": target["id"],
                "name": target["name"],
                "kind": target["kind"],
                "originalPhrase": match.group(0),
                "normalizedPhrase": alias,
                "documentId": document_id,
                "source": source,
                "segment": segment,
                "excerpt": excerpt,
            }
            context_patterns = compiled["contextPatterns"].get(target["id"], [])
            exclusion_patterns = compiled["exclusionPatterns"].get(target["id"], [])
            clause_start, clause_end = astronomy_clause_bounds_for_match(text, match.start(), match.end())
            context_text = text[clause_start:clause_end]
            global_context = astronomy_global_context_for_match(text, match, clause_start, clause_end, compiled)
            postpositive_context = astronomy_postpositive_context(text, match, clause_end, compiled)
            exclusion_matches = (
                exclusion_match
                for item in exclusion_patterns
                for exclusion_match in item.finditer(text)
            )
            if any(exclusion_match.start() <= match.start() and exclusion_match.end() >= match.end() for exclusion_match in exclusion_matches):
                candidates.append({**base, "decision": "excluded", "reason": "reviewed-non-astronomical-context"})
                occupied.append(match.span())
                continue
            has_astronomical_context = any(item.search(context_text) for item in context_patterns) or any(
                item.search(global_context) for item in compiled["globalContextPatterns"]
            ) or any(item.search(postpositive_context) for item in compiled["postpositiveContextPatterns"])
            if requires_context and not has_astronomical_context:
                candidates.append({**base, "decision": "ambiguous", "reason": "missing-reviewed-astronomical-context"})
                occupied.append(match.span())
                continue
            observations.append({
                **base,
                "id": stable_id("astronomy-obs", f"{document_id}|{segment}|{match.start()}|{target['id']}"),
                "matchType": "reviewed_contextual_name" if requires_context else "reviewed_name",
                "confidence": 0.94 if requires_context else 0.99,
            })
            occupied.append(match.span())
    return observations, candidates


def astronomy_target_summaries(taxonomy: dict, observations: list[dict]) -> list[dict]:
    """Publish direct corpus counts separately from astronomical position metadata."""
    summaries = []
    for target in taxonomy.get("targets", []):
        matching = [item for item in observations if item["targetId"] == target["id"]]
        if not matching:
            continue
        document_ids = sorted({item["documentId"] for item in matching})
        sources = sorted({item["source"] for item in matching})
        summary = {
            "id": f"astronomy-target-{target['id']}",
            "targetId": target["id"],
            "name": target["name"],
            "kind": target["kind"],
            "system": target.get("system"),
            "parentBody": target.get("parentBody"),
            "mentionCount": len(matching),
            "segmentCount": len({(item["documentId"], str(item["segment"])) for item in matching}),
            "documentCount": len(document_ids),
            "sourceCount": len(sources),
            "documentIds": document_ids,
            "sources": sources,
            "sourceMetrics": {
                source: {
                    "mentions": sum(item["source"] == source for item in matching),
                    "documentCount": len({item["documentId"] for item in matching if item["source"] == source}),
                }
                for source in sources
            },
            "reviewStatus": "reviewed",
            "observationIds": [item["id"] for item in matching],
            "evidence": [
                {key: item[key] for key in ("documentId", "source", "segment", "excerpt", "originalPhrase")}
                for item in matching[:8]
            ],
        }
        if target.get("position"):
            summary["position"] = target["position"]
        summaries.append(summary)
    return sorted(summaries, key=lambda item: (-item["documentCount"], -item["mentionCount"], item["name"]))


def astronomy_review_summary(candidates: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    for candidate in candidates:
        groups[(candidate["targetId"], candidate["reason"])].append(candidate)
    return [
        {
            "targetId": target_id,
            "name": items[0]["name"],
            "decision": items[0]["decision"],
            "reason": reason,
            "count": len(items),
            "documentCount": len({item["documentId"] for item in items}),
            "examples": [
                {key: item[key] for key in ("documentId", "source", "segment", "excerpt", "originalPhrase")}
                for item in items[:5]
            ],
        }
        for (target_id, reason), items in sorted(groups.items())
    ]


@functools.lru_cache(maxsize=None)
def species_phrase_pattern(phrase: str) -> re.Pattern:
    """Compile one reviewed species name while tolerating whitespace and dash variants."""
    tokens = [re.escape(token) for token in re.split(r"[-—–\s]+", phrase.strip()) if token]
    return re.compile(r"(?<!\w)" + r"(?:[-—–\s]+)".join(tokens) + r"(?!\w)", re.I)


def compile_species_taxonomy(taxonomy: dict) -> dict:
    def alias_definition(alias: str | dict) -> dict:
        return {"phrase": alias} if isinstance(alias, str) else alias

    entries = sorted([
        (species_class, alias_definition(alias), species_phrase_pattern(alias_definition(alias)["phrase"]))
        for species_class in taxonomy.get("classes", [])
        for alias in species_class.get("aliases", [])
    ], key=lambda item: (-len(item[1]["phrase"]), item[1]["phrase"].casefold()))
    trigger_stopwords = {"alien", "aliens", "being", "beings", "extraterrestrial", "human", "humans", "people", "race", "races", "the"}
    trigger_tokens = {
        token
        for _, alias, _ in entries
        for token in re.findall(r"[a-z0-9']+", alias["phrase"].casefold())
        if len(token) >= 3 and token not in trigger_stopwords
    }
    context_patterns = [species_phrase_pattern(term) for term in taxonomy.get("contextTerms", [])]
    return {"entries": entries, "triggerTokens": trigger_tokens, "contextPatterns": context_patterns}


def species_appearance_excerpt(context: str, match_terms: list[str], limit: int = 900) -> str:
    """Return the smallest readable corpus window containing every reviewed match phrase."""
    cleaned = clean_space(context)
    occurrences = []
    for term_index, term in enumerate(match_terms):
        tokens = comparison_key(term).split()
        if not tokens:
            return ""
        pattern = re.compile(
            r"(?<![a-z0-9])" + r"[^a-z0-9]+".join(re.escape(token) for token in tokens) + r"(?![a-z0-9])",
            re.I,
        )
        matches = list(pattern.finditer(cleaned))
        if not matches:
            return ""
        occurrences.extend((match.start(), match.end(), term_index) for match in matches)
    occurrences.sort()
    counts = [0] * len(match_terms)
    covered = 0
    left = 0
    best = None
    for right, occurrence in enumerate(occurrences):
        term_index = occurrence[2]
        if counts[term_index] == 0:
            covered += 1
        counts[term_index] += 1
        while covered == len(match_terms):
            first = occurrences[left][0]
            last = max(item[1] for item in occurrences[left:right + 1])
            candidate = (last - first, first, last)
            if best is None or candidate < best:
                best = candidate
            left_term_index = occurrences[left][2]
            counts[left_term_index] -= 1
            if counts[left_term_index] == 0:
                covered -= 1
            left += 1
    if best is None or best[0] > limit:
        return ""
    _, first, last = best
    padding = max(0, limit - (last - first))
    start = max(0, first - min(260, padding // 2))
    end = min(len(cleaned), last + max(300, padding - (first - start)))
    if end - start > limit:
        end = start + limit
    if start:
        next_space = cleaned.find(" ", start)
        start = next_space + 1 if 0 <= next_space < first else start
    if end < len(cleaned):
        previous_space = cleaned.rfind(" ", last, end)
        end = previous_space if previous_space > last else end
    excerpt = cleaned[start:end]
    if not all(comparison_key(term) in comparison_key(excerpt) for term in match_terms):
        return ""
    return excerpt


def species_appearance_evidence(
    species_class: dict,
    context: str,
    document_id: str,
    source: str,
    segment: int,
    context_start: int,
    context_end: int,
) -> list[dict]:
    """Publish only manually reviewed physical-description patterns from corpus text."""
    normalized_context = comparison_key(context)
    evidence = []
    for rule in species_class.get("appearanceRules", []):
        match_terms = [str(term) for term in rule.get("matchAll", []) if str(term).strip()]
        if not match_terms or not all(comparison_key(term) in normalized_context for term in match_terms):
            continue
        excerpt = species_appearance_excerpt(context, match_terms)
        if not excerpt:
            continue
        evidence.append({
            "id": stable_id("species-appearance", f"{document_id}|{segment}|{species_class['id']}|{rule['id']}"),
            "classId": species_class["id"],
            "documentId": document_id,
            "source": source,
            "segment": segment,
            "contextStartSegment": context_start,
            "contextEndSegment": context_end,
            "ruleId": rule["id"],
            "reviewStatus": "reviewed",
            "descriptors": rule.get("descriptors", []),
            "excerpt": excerpt,
        })
    return evidence


def species_observations_for_segment(
    text: str,
    document_id: str,
    source: str,
    segment: int | str,
    taxonomy: dict,
    compiled: dict | None = None,
    context_segments: list[str] | None = None,
    context_segment_index: int | None = None,
) -> tuple[list[dict], list[dict]]:
    """Match reviewed names, retaining context-dependent matches outside the published set."""
    compiled = compiled or compile_species_taxonomy(taxonomy)
    text_tokens = set(re.findall(r"[a-z0-9']+", text.casefold()))
    if not text_tokens.intersection(compiled["triggerTokens"]):
        return [], []
    observations: list[dict] = []
    candidates: list[dict] = []
    occupied: list[tuple[int, int]] = []
    appearance_context = None
    segment_index = context_segment_index if context_segment_index is not None else segment if isinstance(segment, int) else 0
    appearance_context_start = segment_index
    appearance_context_end = segment_index
    for species_class, alias_definition, pattern in compiled["entries"]:
        alias = alias_definition["phrase"]
        allowed_sources = alias_definition.get("sources")
        if allowed_sources and source not in allowed_sources:
            continue
        for match in pattern.finditer(text):
            if any(match.start() < end and match.end() > start for start, end in occupied):
                continue
            phrase = match.group(0)
            common = bool(species_class.get("requiresContext"))
            context_window = text[max(0, match.start() - 180):min(len(text), match.end() + 180)]
            has_context = any(pattern.search(context_window) for pattern in compiled["contextPatterns"])
            reviewed_context = alias_definition.get("contextAny", [])
            reviewed_context_window = context_window
            if reviewed_context and context_segments:
                context_start = max(0, segment_index - 3)
                context_end = min(len(context_segments) - 1, segment_index + 3)
                reviewed_context_window = " ".join(context_segments[context_start:context_end + 1])
            has_reviewed_context = not reviewed_context or any(
                species_phrase_pattern(term).search(reviewed_context_window) for term in reviewed_context
            )
            base = {
                "classId": species_class["id"],
                "category": species_class["category"],
                "originalPhrase": phrase,
                "normalizedPhrase": alias,
                "documentId": document_id,
                "source": source,
                "segment": segment,
                "excerpt": text[:500],
            }
            if not has_reviewed_context:
                candidates.append({**base, "decision": "ambiguous", "reason": "missing-reviewed-local-context"})
                occupied.append(match.span())
                continue
            if common and not has_context and not reviewed_context:
                candidates.append({**base, "decision": "ambiguous", "reason": "missing-extraterrestrial-context"})
                occupied.append(match.span())
                continue
            observations.append({
                **base,
                "id": stable_id("species-obs", f"{document_id}|{segment}|{match.start()}|{species_class['id']}|{phrase.casefold()}"),
                "matchType": alias_definition.get("matchType", "contextual_name" if common else "reviewed_name"),
                "confidence": alias_definition.get("confidence", 0.9 if common else 0.98),
            })
            if species_class.get("appearanceRules"):
                if appearance_context is None:
                    if context_segments:
                        appearance_context_start = max(0, segment_index - 3)
                        appearance_context_end = min(len(context_segments) - 1, segment_index + 3)
                        appearance_context = " ".join(context_segments[appearance_context_start:appearance_context_end + 1])
                    else:
                        appearance_context = text
                observations[-1]["appearanceEvidence"] = species_appearance_evidence(
                    species_class, appearance_context, document_id, source, segment,
                    appearance_context_start, appearance_context_end,
                )
                for evidence in observations[-1]["appearanceEvidence"]:
                    evidence["observationId"] = observations[-1]["id"]
            occupied.append(match.span())
    return observations, candidates


def species_review_summary(candidates: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str, str], dict] = {}
    for candidate in candidates:
        key = (candidate["decision"], comparison_key(candidate["originalPhrase"]), candidate["reason"])
        item = grouped.setdefault(key, {
            "id": stable_id("species-candidate", "|".join(key)),
            "phrase": candidate["originalPhrase"],
            "classId": candidate["classId"],
            "decision": candidate["decision"],
            "reason": candidate["reason"],
            "count": 0,
            "examples": [],
        })
        item["count"] += 1
        if len(item["examples"]) < 3:
            item["examples"].append({key: candidate[key] for key in ("documentId", "source", "segment", "excerpt")})
    return sorted(grouped.values(), key=lambda item: (-item["count"], item["phrase"].casefold()))


def deduplicate_species_appearance_evidence(evidence_items: list[dict]) -> list[dict]:
    """Collapse adjacent name hits that resolve to the same reviewed corpus passage."""
    retained: list[dict] = []
    for evidence in sorted(
        evidence_items,
        key=lambda item: (item["documentId"], item["ruleId"], item["segment"], len(item["excerpt"])),
    ):
        duplicate_index = next((
            index
            for index, existing in enumerate(retained)
            if existing["documentId"] == evidence["documentId"]
            and existing["ruleId"] == evidence["ruleId"]
            and existing["contextStartSegment"] <= evidence["contextEndSegment"]
            and evidence["contextStartSegment"] <= existing["contextEndSegment"]
        ), None)
        if duplicate_index is None:
            retained.append(evidence)
        elif len(evidence["excerpt"]) < len(retained[duplicate_index]["excerpt"]):
            retained[duplicate_index] = evidence
    return retained


def species_class_summaries(taxonomy: dict, observations: list[dict]) -> list[dict]:
    categories = {item["id"]: item["label"] for item in taxonomy.get("categories", [])}
    summaries = []
    for species_class in taxonomy.get("classes", []):
        matching = [observation for observation in observations if observation["classId"] == species_class["id"]]
        if not matching:
            continue
        document_ids = sorted({observation["documentId"] for observation in matching})
        sources = sorted({observation["source"] for observation in matching})
        appearance_evidence = deduplicate_species_appearance_evidence([
            evidence
            for observation in matching
            for evidence in observation.get("appearanceEvidence", [])
        ])
        summaries.append({
            "id": f"species-class-{species_class['id']}",
            "classId": species_class["id"],
            "name": species_class["label"],
            "category": species_class["category"],
            "categoryLabel": categories.get(species_class["category"], species_class["category"]),
            "groundingAppearance": species_class.get("groundingAppearance"),
            "groundingType": species_class.get("groundingType", "reference"),
            "identityNote": species_class.get("identityNote"),
            "physicalHeight": species_class.get("physicalHeight"),
            "observationCount": len(matching),
            "documentCount": len(document_ids),
            "sourceCount": len(sources),
            "documentIds": document_ids,
            "sources": sources,
            "confidence": round(sum(item["confidence"] for item in matching) / len(matching), 3),
            "observationIds": [observation["id"] for observation in matching],
            "evidence": [{"documentId": item["documentId"], "excerpt": item["excerpt"]} for item in matching[:8]],
            "appearanceEvidenceCount": len(appearance_evidence),
            "appearanceEvidence": sorted(
                appearance_evidence,
                key=lambda item: (item["documentId"], item["segment"], item["ruleId"]),
            ),
        })
    return summaries


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_id(prefix: str, value: str) -> str:
    return f"{prefix}-{hashlib.sha1(value.encode('utf-8')).hexdigest()[:12]}"


def normalized_date(value: str) -> str | None:
    """Normalize only unambiguous day-level dates; never invent missing precision."""
    value = clean_space(value).replace(",", "")
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return dt.date.fromisoformat(value).isoformat()
        parts = value.split()
        if parts[0].casefold() in MONTH_LOOKUP:
            month, day, year = MONTH_LOOKUP[parts[0].casefold()], int(parts[1]), int(parts[2])
        elif len(parts) == 3 and parts[1].casefold() in MONTH_LOOKUP:
            day, month, year = int(parts[0]), MONTH_LOOKUP[parts[1].casefold()], int(parts[2])
        else:
            return None
        return dt.date(year, month, day).isoformat()
    except (ValueError, IndexError):
        return None


def known_structured_date_defect(metadata: dict | None, document_date: dict | None) -> str | None:
    """Identify audited upstream date values that must never be treated as event dates."""
    if not document_date:
        return None
    try:
        value = dt.date.fromisoformat(document_date["value"])
    except (KeyError, TypeError, ValueError):
        return "Malformed structured date."
    metadata = metadata or {}
    source = str(metadata.get("collection") or "")
    try:
        database_id = int(metadata.get("updb_database_id"))
    except (TypeError, ValueError):
        database_id = None
    if value.year < 1800:
        return "The preserved source contains a malformed year earlier than 1800."
    if source in {"UPDB-BAASS", "UPDB-NIDS"} and value.year == 1905:
        return "The preserved UPDB source belongs to the audited 1905 century-corruption block."
    if source == "UPDB-NICAP" and database_id in NICAP_CORRUPT_DATE_DATABASE_IDS:
        return "The preserved NICAP row belongs to an audited block containing century-truncated and mismatched dates."
    if source == "UPDB-NICAP" and database_id in NICAP_UNKNOWN_YEAR_DATABASE_IDS:
        return "The preserved NICAP row labels its year unknown but stores 1900-01-01."
    if source == "UPDB-NICAP" and database_id in NICAP_IMPRECISE_DATE_DATABASE_IDS:
        return "The preserved NICAP row carries a season, month, range, or unknown-date qualifier that is incompatible with exact-day precision."
    if source == "UPDB-MUFON" and value.year == 1890:
        return "The preserved MUFON row uses an audited 1890 sentinel or unsupported placeholder date."
    return None


def reported_event_date_review(
    segments: list[str],
    document_date: dict | None,
    document_id: str | None = None,
    reviews: dict | None = None,
    metadata: dict | None = None,
    source_path: str | None = None,
    source_blob_sha: str | None = None,
) -> dict:
    """Gate structured report dates that need human review before timeline publication."""
    review = (reviews or {}).get(document_id or "")
    review_binding_matches = (
        isinstance(review, dict)
        and review.get("sourcePath") == source_path
        and review.get("sourceBlobSha") == source_blob_sha
    )
    if review_binding_matches and document_date and review.get("status") in {"published", "excluded"}:
        source_date = review.get("sourceDate") or review.get("date")
        if source_date == document_date.get("value"):
            status = review["status"]
            result = {
                "status": status,
                "reason": review.get("reason") or (
                    "analyst-verified-date" if status == "published" else "analyst-rejected-date"
                ),
                "method": "analyst-review",
                "sourceDate": source_date,
                **({"note": review["note"]} if review.get("note") else {}),
            }
            if status == "published":
                result["date"] = review.get("date") or source_date
                result["precision"] = review.get("precision") or document_date.get("precision") or "day"
            return result
    known_defect = known_structured_date_defect(metadata, document_date)
    if known_defect:
        return {
            "status": "review_required",
            "reason": "known-source-date-defect",
            "method": "source-date-audit",
            "evidence": known_defect,
        }
    for index, segment in enumerate(segments):
        for match in INVALID_REPORTED_EVENT_DATE_CONTEXT.finditer(segment):
            nearby = segment[max(0, match.start() - 140):match.end() + 180]
            if NON_EVENT_INVALID_REPORTED_DATE_CONTEXT.search(segment):
                continue
            return {
                "status": "review_required",
                "reason": "explicit-invalid-date-language",
                "method": "source-language-gate",
                "evidence": nearby[:280],
                "segment": index,
            }
    if isinstance(review, dict) and review.get("status") in {"published", "excluded"} and not review_binding_matches:
        return {
            "status": "review_required",
            "reason": "analyst-review-source-changed",
            "method": "source-content-binding",
            "evidence": "The analyst decision does not match this source path and Git blob.",
        }
    if not document_date:
        return {"status": "review_required", "reason": "missing-date", "method": "automatic-date-gate"}
    if document_date.get("precision") != "day":
        return {"status": "review_required", "reason": "imprecise-date", "method": "automatic-date-gate"}
    if document_date.get("confidence", 0) < 0.9:
        return {"status": "review_required", "reason": "low-date-confidence", "method": "automatic-date-gate"}
    if document_date.get("method") != "metadata:document_date":
        return {"status": "review_required", "reason": "untrusted-date-method", "method": "automatic-date-gate"}
    try:
        value = dt.date.fromisoformat(document_date["value"])
    except (KeyError, TypeError, ValueError):
        return {"status": "review_required", "reason": "invalid-date", "method": "automatic-date-gate"}
    if value < REPORTED_EVENT_AUTOMATIC_START_DATE:
        return {
            "status": "review_required",
            "reason": "before-modern-reporting-baseline",
            "method": "automatic-date-gate",
        }
    return {"status": "published", "reason": "trusted-structured-date", "method": "automatic-date-gate"}


def temporal_candidates(
    segments: list[str], metadata: dict, document_id: str, segment_ids: list[str] | None = None,
) -> tuple[dict | None, list[dict], list[dict]]:
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
        segment_id = segment_ids[index] if segment_ids else index
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
                         "method": method, "evidence": segment[:280], "segment": segment_id}
            review.append(candidate)
            if kind == "document_date":
                document_dates.append(candidate)
            elif kind == "event_date":
                type_patterns = MILESTONE_TYPES if method == "milestone-language" else EVENT_TYPES
                type_context = segment if method == "milestone-language" else nearby
                event_type = next((name for name, pattern in type_patterns if pattern.search(type_context)), "reported_event")
                events.append({"id": stable_id("event", f"{document_id}|{segment_id}|{value}|{event_type}"),
                               "title": segment[:140], "eventType": event_type, "startDate": value, "endDate": None,
                               "datePrecision": "day", "confidence": confidence, "mentionCount": 1, "documentIds": [document_id],
                               "evidence": [{"documentId": document_id, "segment": segment_id, "excerpt": segment[:280]}]})
    document_date = max(document_dates, key=lambda item: item["confidence"], default=None)
    source_name = Path(str(metadata.get("source_file") or "")).name
    filename_year = AUDITED_FILENAME_DATE_CONFLICTS.get(source_name)
    if document_date and document_date.get("method") == "document-header" and filename_year:
        header_year = int(document_date["value"][:4])
        if header_year != filename_year:
            document_date.update({
                "kind": "date_conflict",
                "confidence": 0.2,
                "method": "filename-date-conflict",
                "evidence": (
                    f"OCR header candidate {document_date['value']} conflicts with the full date encoded "
                    f"in source filename {source_name}."
                )[:280],
            })
            document_date = None
    return document_date, events, review


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


def reviewed_event_titles(events: list[dict], path: Path) -> list[dict]:
    """Publish extracted events only after a human-reviewed public title exists."""
    reviews = json.loads(path.read_text(encoding="utf-8")).get("events", {}) if path.exists() else {}
    published = []
    for event in events:
        if event.get("reviewStatus") == "curated":
            event["titleReviewStatus"] = "curated"
            published.append(event)
            continue
        title = reviews.get(event["id"])
        if not title:
            continue
        event["title"] = clean_space(title)
        event["titleReviewStatus"] = "reviewed"
        published.append(event)
    return published


def curated_discussion_matches(segments: list[str], items: list[dict]) -> dict[str, dict]:
    """Find reviewed milestone discussions whose signature terms occur in a local text window."""
    original = " ".join(segments)
    text = comparison_key(original)
    matches = {}
    for item in items:
        rules = [[comparison_key(term) for term in rule] for rule in item.get("discussionMatchAny", [])]
        positions = []
        for rule in rules:
            if not rule:
                continue
            for anchor in re.finditer(re.escape(rule[0]), text):
                start, end = max(0, anchor.start() - 1200), min(len(text), anchor.end() + 1200)
                if all(term in text[start:end] for term in rule[1:]):
                    positions.append(anchor.start())
        distinct = []
        for position in sorted(set(positions)):
            if not distinct or position - distinct[-1] > 600:
                distinct.append(position)
        if distinct:
            position = distinct[0]
            matches[item["title"]] = {
                "mentionCount": len(distinct),
                "excerpt": clean_space(original[max(0, position - 140):position + 420])[:280],
            }
    return matches


def curated_events(
    path: Path,
    document_ids: dict[str, str],
    date_review: list[dict] | None = None,
    discussion_support: dict[str, list[dict]] | None = None,
) -> list[dict]:
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
        supporting_mentions_by_document: dict[str, int] = {}
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
                        supporting_mentions_by_document[candidate_document_id] = supporting_mentions_by_document.get(candidate_document_id, 0) + 1
                        if len(supporting_evidence) < 5:
                            supporting_evidence.append({
                                "documentId": candidate_document_id,
                                **({"segment": candidate["segment"]} if "segment" in candidate else {}),
                                "excerpt": clean_space(candidate.get("evidence", ""))[:280],
                            })
        for support in (discussion_support or {}).get(item["title"], []):
            candidate_document_id = support["documentId"]
            supporting_ids.add(candidate_document_id)
            supporting_mentions_by_document[candidate_document_id] = max(
                supporting_mentions_by_document.get(candidate_document_id, 0), support["mentionCount"]
            )
            if len(supporting_evidence) < 5:
                supporting_evidence.append({"documentId": candidate_document_id, "excerpt": support["excerpt"]})
        published.append({
            "id": stable_id("event", f"curated|{source_path}|{date}|{item['eventType']}"),
            "title": item["title"],
            "eventType": item["eventType"],
            "startDate": date,
            "endDate": None,
            "datePrecision": "day",
            "confidence": 0.99,
            "mentionCount": max(1, sum(supporting_mentions_by_document.values())),
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
    value = unicodedata.normalize("NFKD", value.casefold()).replace("œ", "oe").replace("æ", "ae")
    value = "".join(character for character in value if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def case_preserving_key(value: str) -> str:
    value = HONORIFIC.sub("", clean_space(value))
    value = value.replace("’", "'").replace("U. S.", "U.S.")
    return re.sub(r"[^A-Za-z0-9]+", " ", value).strip()


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


def source_title_from_path(path: Path) -> str:
    name = path.stem.replace("_", " ").replace("-", " ")
    return clean_space(re.sub(r"\s+", " ", name))


def title_from_path(path: Path) -> str:
    return source_title_from_path(path).title()


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


PAIRED_SCHEMA_FAMILIES = {"pt-BR": "portuguese", "fr-FR": "french"}
PAIRED_SEARCH_SCHEMAS = {
    f"ufo-files-{family}-search-text/v1" for family in PAIRED_SCHEMA_FAMILIES.values()
}
PAIRED_FAMILY_LANGUAGES = {family: language for language, family in PAIRED_SCHEMA_FAMILIES.items()}


def paired_document_date(value: object, family: str) -> object:
    """Normalize source-specific paired metadata without making numeric dates globally ambiguous."""
    if family != "french" or not isinstance(value, str):
        return value
    match = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", clean_space(value))
    if not match:
        return value
    try:
        day, month, year = map(int, match.groups())
        return dt.date(year, month, day).isoformat()
    except ValueError:
        return value


def valid_paired_canonical(canonical: object, family: str, document_id: object) -> bool:
    """Bind canonical provenance to the paired document before using its metadata."""
    canonical_language = PAIRED_FAMILY_LANGUAGES.get(family)
    return (
        isinstance(canonical, dict)
        and bool(document_id)
        and canonical.get("schema") == f"ufo-files-{family}-canonical/v1"
        and canonical.get("document_id") == document_id
        and canonical.get("canonical_language") == canonical_language
    )


def paired_segments(artifact: object) -> list[dict] | None:
    """Return segments from a well-formed paired artifact container."""
    if not isinstance(artifact, dict):
        return None
    pages = artifact.get("pages", [])
    top_level = artifact.get("segments", [])
    if not isinstance(pages, list) or not isinstance(top_level, list):
        return None
    segments = []
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get("segments", []), list):
            return None
        segments.extend(page.get("segments", []))
    segments.extend(top_level)
    if any(not isinstance(segment, dict) for segment in segments):
        return None
    return segments


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
    schema = metadata.get("schema")
    if schema in PAIRED_SEARCH_SCHEMAS:
        if metadata.get("language") != "en" or metadata.get("canonical") is not False:
            return None
        family = schema.removeprefix("ufo-files-").removesuffix("-search-text/v1")
        canonical_language = PAIRED_FAMILY_LANGUAGES.get(family)
        if not canonical_language:
            return None
        try:
            document = json.loads((path.parent.parent / "document.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if not isinstance(document, dict):
            return None
        source = document.get("source", {})
        expected_document_schema = f"ufo-files-{family}-document/v1"
        if (
            document.get("schema") != expected_document_schema
            or document.get("canonical_language") != canonical_language
            or not isinstance(source, dict)
        ):
            return None
        metadata["source_file"] = source.get("original_title") or source.get("relative_path") or path.name
        metadata["source_title"] = source.get("original_title")
        metadata["source_bytes"] = source.get("bytes") or path.stat().st_size
        metadata["source_sha256"] = source.get("sha256")
        metadata["document_date"] = paired_document_date(source.get("document_date"), family)
        metadata["medium"] = document.get("medium")
        metadata["original_language"] = source.get("original_language") or canonical_language
        metadata["document_id"] = document.get("document_id") or metadata.get("document_id")
        metadata["available_languages"] = document.get("available_languages") or [canonical_language, "en"]
        metadata["translation_available"] = document.get("translation_available", True)
        metadata["translation_review_status"] = document.get("translation_review_status")
        metadata["canonical_path"] = document.get("canonical_path")
        metadata["translation_path"] = document.get("translation_path")
        metadata["jurisdiction"] = source.get("jurisdiction")
        metadata["country_code"] = source.get("country")
        pair_root = path.parent.parent.resolve()
        canonical_value = document.get("canonical_path")
        if not isinstance(canonical_value, str) or not canonical_value:
            return None
        canonical_path = pair_root / canonical_value
        if not canonical_path.resolve().is_relative_to(pair_root) or not canonical_path.is_file():
            return None
        try:
            canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if not valid_paired_canonical(canonical, family, metadata["document_id"]):
            return None
        canonical_segments = paired_segments(canonical)
        if canonical_segments is None:
            return None
        canonical_segment_ids = [segment.get("segment_id") for segment in canonical_segments]
        if (
            not canonical_segment_ids
            or None in canonical_segment_ids
            or len(canonical_segment_ids) != len(set(canonical_segment_ids))
        ):
            return None
        canonical_source = canonical.get("source", {})
        extraction = canonical.get("extraction", {})
        if not isinstance(canonical_source, dict) or not isinstance(extraction, dict):
            return None
        if canonical_source:
            metadata["source_file"] = canonical_source.get("original_title") or canonical_source.get("relative_path") or metadata["source_file"]
            metadata["source_title"] = canonical_source.get("original_title") or metadata.get("source_title")
            metadata["source_bytes"] = canonical_source.get("bytes") or metadata["source_bytes"]
            metadata["source_sha256"] = canonical_source.get("sha256") or metadata.get("source_sha256")
            metadata["document_date"] = paired_document_date(
                canonical_source.get("document_date"), family
            ) or metadata.get("document_date")
            metadata["original_language"] = canonical_source.get("original_language") or metadata["original_language"]
            metadata["jurisdiction"] = canonical_source.get("jurisdiction") or metadata.get("jurisdiction")
            metadata["country_code"] = canonical_source.get("country") or metadata.get("country_code")
        metadata["medium"] = canonical.get("medium") or metadata.get("medium")
        metadata["created_at"] = extraction.get("generated_at")
        metadata["engine"] = extraction.get("engine")
        translation_value = document.get("translation_path")
        translation_path = pair_root / translation_value if translation_value else path.with_suffix(".json")
        if not translation_path.resolve().is_relative_to(pair_root) or not translation_path.exists():
            return None
        try:
            translation = json.loads(translation_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if translation.get("schema") != f"ufo-files-{family}-translation/v1":
            return None
        if metadata.get("document_id") and translation.get("document_id") != metadata["document_id"]:
            return None
        translated = paired_segments(translation)
        if translated is None:
            return None
        translated_ids = [segment.get("segment_id") for segment in translated]
        if canonical_segment_ids is not None and (
            translated_ids != canonical_segment_ids
            or any(segment.get("source_segment_id") != segment.get("segment_id") for segment in translated)
        ):
            return None
        accepted = [
            segment for segment in translated
            if segment.get("status") not in {"failed", "failed-protected-token-check"}
            and clean_space(segment.get("text", ""))
        ]
        if not accepted:
            return None
        metadata["segment_ids"] = [segment.get("segment_id") for segment in accepted]
        return metadata, [clean_space(segment["text"]) for segment in accepted]
    elif schema != "ufo-files-archive-ocr/v1":
        return None
    body = re.sub(r"(?m)^\{\"alpha_words\".*?\}\s*$", "", body)
    return metadata, list(sentence_segments(body))


def machine_data_paths(input_root: Path, paired_language: str = "en") -> list[Path]:
    """Select one textual representation per collection.

    Collections with a ``paired`` tree are multilingual derived datasets. For
    those collections, ingest only the requested translation and exclude both
    the root-language exports and canonical source-language copies. Legacy
    collections without paired data retain their existing traversal.
    """
    paired_collections = {
        child.name for child in input_root.iterdir()
        if child.is_dir() and (child / "paired").is_dir()
    }
    selected = []
    for path in input_root.rglob("*"):
        if not path.is_file() or (path.suffix.lower() not in {".txt", ".tsv"} and path.name != "document.json"):
            continue
        parts = path.relative_to(input_root).parts
        if set(parts) & SKIP_PARTS:
            continue
        if parts and parts[0] in paired_collections:
            canonical_pair = (
                paired_language in PAIRED_SCHEMA_FAMILIES
                and len(parts) >= 4
                and parts[1] == "paired"
                and parts[-1] == "document.json"
            )
            if canonical_pair:
                try:
                    canonical_pair = json.loads(path.read_text(encoding="utf-8")).get("canonical_language") == paired_language
                except (OSError, json.JSONDecodeError):
                    canonical_pair = False
            translated_pair = (
                paired_language == "en"
                and len(parts) >= 5
                and parts[1] == "paired"
                and parts[-2] == paired_language
                and parts[-1] == "translation.txt"
            )
            if not (canonical_pair or translated_pair):
                continue
        elif path.name == "document.json":
            continue
        selected.append(path)
    return sorted(selected)


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


def read_language_pair(path: Path) -> dict | None:
    """Read one canonical source-language document and English derivative once.

    The canonical segment is the graph counting unit. The translation is
    discoverable metadata and never enters entity/event counts as a second
    document or segment.
    """
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(document, dict):
            return None
        canonical_language = document.get("canonical_language")
        family = PAIRED_SCHEMA_FAMILIES.get(canonical_language)
        if not family or document.get("schema") != f"ufo-files-{family}-document/v1":
            return None
        pair_root = path.parent.resolve()
        canonical_value = document["canonical_path"]
        if not isinstance(canonical_value, str) or not canonical_value:
            return None
        canonical_path = path.parent / canonical_value
        if not canonical_path.resolve().is_relative_to(pair_root) or not canonical_path.is_file():
            return None
        canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
    except (OSError, KeyError, json.JSONDecodeError):
        return None
    document_id = document.get("document_id")
    if not valid_paired_canonical(canonical, family, document_id):
        return None
    canonical_segments = paired_segments(canonical)
    if canonical_segments is None:
        return None
    canonical_ids = [segment.get("segment_id") for segment in canonical_segments]
    if not canonical_ids or None in canonical_ids or len(canonical_ids) != len(set(canonical_ids)):
        return None

    translation = None
    translation_path = None
    if document.get("translation_available") is True:
        translation_value = document.get("translation_path")
        if not isinstance(translation_value, str) or not translation_value:
            return None
        translation_path = path.parent / translation_value
        if not translation_path.resolve().is_relative_to(pair_root) or not translation_path.is_file():
            return None
        try:
            translation = json.loads(translation_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        translated_segments = paired_segments(translation)
        if (
            translated_segments is None
            or translation.get("schema") != f"ufo-files-{family}-translation/v1"
            or translation.get("document_id") != document_id
        ):
            return None
        translated_ids = [segment.get("segment_id") for segment in translated_segments]
        if canonical_ids != translated_ids or any(
            segment.get("source_segment_id") != segment.get("segment_id")
            for segment in translated_segments
        ):
            return None

    source = canonical.get("source", {})
    document_source = document.get("source", {})
    extraction = canonical.get("extraction", {})
    if not isinstance(source, dict) or not isinstance(document_source, dict) or not isinstance(extraction, dict):
        return None
    metadata = {
        "source_file": source.get("original_title") or source.get("relative_path") or canonical_path.name,
        "source_title": source.get("original_title"),
        "source_bytes": source.get("bytes"),
        "source_sha256": source.get("sha256"),
        "document_date": paired_document_date(source.get("document_date"), family),
        "created_at": extraction.get("generated_at"),
        "engine": extraction.get("engine"),
        "original_language": source.get("original_language") or canonical_language,
        "jurisdiction": source.get("jurisdiction") or document_source.get("jurisdiction"),
        "country_code": source.get("country") or document_source.get("country"),
    }
    return {
        "document": document,
        "metadata": metadata,
        "segments": [clean_space(segment.get("text", "")) for segment in canonical_segments if clean_space(segment.get("text", ""))],
        "segment_ids": [
            segment["segment_id"] for segment in canonical_segments if clean_space(segment.get("text", ""))
        ],
        "canonical_path": canonical_path,
        "translation_path": translation_path,
        "translation": translation,
    }


def read_portuguese_pair(path: Path) -> dict | None:
    """Backward-compatible alias for the language-neutral pair reader."""
    return read_language_pair(path)


def classify_phrase(raw: str) -> tuple[str, float] | None:
    raw = clean_space(raw)
    if raw.casefold() in PERSON_HARD_NEGATIVES:
        return None
    key = comparison_key(raw)
    if len(key) < 3 or key in GENERIC or key in FIELD_LABELS or key in LOCATION_WORDS:
        return None
    if NON_ENTITY_PHRASE.fullmatch(key):
        return None
    if re.fullmatch(r"john doe(?: [ivx]+)?", key):
        return None
    if key.startswith(("bureau bulletin", "office memor", "post office box", "re bureau bulletin")):
        return None
    words = key.split()
    if len(words) > 6 or any(len(word) == 1 for word in words[1:-1]):
        return None
    lower = raw.lower()
    if key == "extraterrestrial intelligence":
        return "subject", 0.99
    if key in {"communications intelligence", "communication intelligence", "signals intelligence", "signal intelligence", "non human intelligence", "non human intelligences"}:
        return "subject", 0.95
    if key in KNOWN_LOCATIONS:
        return "location", 0.9
    if key.startswith("uss "):
        return None
    if lower.endswith((" of", " the", " and", " for")):
        return None
    if any(re.search(rf"\b{re.escape(word)}\b", lower) for word in LOCATION_WORDS):
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
    valid_words = all(
        re.fullmatch(rf"(?:[{LATIN_UPPER}][{LATIN_LETTER}'’-]{{1,25}}|[{LATIN_UPPER}]\.)", word)
        for word in person_words
    )
    given_names = comparison_key(person_words[0].rstrip(".")).split() if person_words else []
    has_first_name = bool(given_names) and all(name in FIRST_NAMES for name in given_names)
    if role_match and len(person_words) > 2 and not has_first_name:
        return None
    if ((2 <= len(person_words) <= 4 and has_first_name) or (role_match and 1 <= len(person_words) <= 4)) and valid_words:
        if person_words[0].lower() not in {"chapter", "figure", "table", "section", "appendix"}:
            return "person", 0.72 if has_first_name else 0.67
    return None


class EntityRegistry(dict[str, tuple[str, str]]):
    """Reviewed entity identities plus a compiled, boundary-aware alias matcher."""

    pattern: re.Pattern | None = None
    case_sensitive_pattern: re.Pattern | None = None
    all_pattern: re.Pattern | None = None
    case_insensitive_keys: set[str] = set()
    title_case_sensitive_keys: set[str] = set()
    reject_generational_suffix_keys: set[str] = set()
    book_pattern: re.Pattern | None = None
    metadata: dict[tuple[str, str], dict] = {}


def registry_alias_pattern(values: Iterable[str], *, ignore_case: bool) -> re.Pattern | None:
    aliases = {
        r"\s+".join(re.escape(part) for part in clean_space(value).split())
        for value in values
        if clean_space(value)
    }
    if not aliases:
        return None
    return re.compile(
        r"(?<![\w-])(" + "|".join(sorted(aliases, key=len, reverse=True)) + r")(?![\w-])",
        re.IGNORECASE if ignore_case else 0,
    )


def load_registry(paths: Iterable[Path]) -> EntityRegistry:
    registry = EntityRegistry()
    matchable_aliases = []
    case_sensitive_aliases = []
    case_insensitive_keys = set()
    title_case_sensitive_keys = set()
    reject_generational_suffix_keys = set()
    book_aliases = []
    metadata = {}
    for path in paths:
        if not path.exists():
            continue
        records = json.loads(path.read_text(encoding="utf-8"))
        file_registry = {}
        for record in records:
            canonical = clean_space(record.get("canonicalName") or record["name"])
            category = record["category"]
            authors = record.get("authors", [])
            if authors and (category != "book" or not isinstance(authors, list) or not all(isinstance(author, str) and clean_space(author) for author in authors)):
                raise ValueError(f"Invalid authors for {canonical!r}")
            if authors:
                metadata[(entity_key(canonical, category), category)] = {
                    "authors": [clean_space(author) for author in authors],
                    "authorReviewStatus": "reviewed",
                }
            match_case_insensitively = record.get("matchCaseInsensitively", False)
            if not isinstance(match_case_insensitively, bool):
                raise ValueError(f"Invalid matchCaseInsensitively value for {canonical!r}")
            reject_generational_suffix = record.get("rejectGenerationalSuffix", False)
            if not isinstance(reject_generational_suffix, bool):
                raise ValueError(f"Invalid rejectGenerationalSuffix value for {canonical!r}")
            for value in [canonical, *record.get("aliases", [])]:
                key = comparison_key(value)
                target = (canonical, category)
                if key in file_registry and file_registry[key] != target:
                    raise ValueError(f"Conflicting entity alias {value!r}: {file_registry[key]} vs {target}")
                file_registry[key] = target
                if category != "book":
                    case_sensitive_aliases.append(value)
                    title_case_sensitive_keys.add(case_preserving_key(value))
                    if match_case_insensitively:
                        matchable_aliases.append(value)
                        case_insensitive_keys.add(key)
                    if reject_generational_suffix:
                        reject_generational_suffix_keys.add(key)
                else:
                    book_aliases.append(value)
        registry.update(file_registry)
    registry.pattern = registry_alias_pattern(matchable_aliases, ignore_case=True)
    registry.case_sensitive_pattern = registry_alias_pattern(case_sensitive_aliases, ignore_case=False)
    registry.all_pattern = registry_alias_pattern(case_sensitive_aliases, ignore_case=True)
    registry.case_insensitive_keys = case_insensitive_keys
    registry.title_case_sensitive_keys = title_case_sensitive_keys
    registry.reject_generational_suffix_keys = reject_generational_suffix_keys
    registry.book_pattern = registry_alias_pattern(book_aliases, ignore_case=True)
    registry.metadata = metadata
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
    context_document_weights: dict[str, dict[str, float]] = field(default_factory=lambda: collections.defaultdict(dict))
    source_context_document_weights: dict[str, dict[str, dict[str, float]]] = field(default_factory=lambda: collections.defaultdict(lambda: collections.defaultdict(dict)))
    administrative_contexts: set[str] = field(default_factory=set)
    mentions: int = 0
    extraction_total: float = 0.0
    title_documents: set[str] = field(default_factory=set)

    def add(self, raw: str, doc_id: str, source: str, segment_id: str, excerpt: str, confidence: float, evidence_weight: float = 1.0, qualifiers: list[dict] | None = None) -> None:
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
        current_weight = self.context_document_weights[context].get(doc_id, 1.0)
        self.context_document_weights[context][doc_id] = min(current_weight, evidence_weight)
        source_weight = self.source_context_document_weights[source][context].get(doc_id, 1.0)
        self.source_context_document_weights[source][context][doc_id] = min(source_weight, evidence_weight)
        if ADMINISTRATIVE_CONTEXT.search(excerpt):
            self.administrative_contexts.add(context)
        self.mentions += 1
        self.extraction_total += confidence
        if len(self.examples) < 4:
            self.examples.append({"documentId": doc_id, "segment": segment_id.split(":", 1)[-1], "excerpt": excerpt[:280], "epistemicQualifiers": qualifiers or []})


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


def source_family_count(document_ids: Iterable[str], family_by_document: dict[str, str] | None = None) -> int:
    """Count conservative lineage families, treating every unclassified document independently."""
    family_by_document = family_by_document or {}
    return len({family_by_document.get(document_id, f"unknown:{document_id}") for document_id in document_ids})


OBSERVATIONAL_EVENT_TYPES = {
    "sighting", "encounter", "landing", "crash", "radar_detection", "reported_event",
}
CASE_RESOLUTION_STATUSES = {"unassessed", "open", "unresolved", "resolved", "insufficient_data"}


def case_records(
    events: list[dict],
    documents: list[dict],
    entities: list[dict],
    family_by_document: dict[str, str],
    reviews_path: Path,
) -> list[dict]:
    """Publish source-attributed case records without converting reports into conclusions."""
    payload = json.loads(reviews_path.read_text(encoding="utf-8")) if reviews_path.exists() else {}
    reviews = payload.get("events", {})
    document_by_id = {document["id"]: document for document in documents}
    entity_by_id = {entity["id"]: entity for entity in entities}
    records = []
    for event in events:
        review = reviews.get(event["id"], reviews.get(event.get("title", ""), {}))
        resolution_status = review.get("resolutionStatus", "unassessed")
        if resolution_status not in CASE_RESOLUTION_STATUSES:
            raise ValueError(f"Unsupported case resolution status for {event['title']}: {resolution_status}")
        document_ids = [document_id for document_id in event.get("documentIds", []) if document_id in document_by_id]
        entity_ids = [entity_id for entity_id in event.get("entityIds", []) if entity_id in entity_by_id]
        location_entity_ids = [entity_id for entity_id in entity_ids if entity_by_id[entity_id].get("category") == "location"]
        sensor_modalities = sorted(set(review.get("sensorModalities", [])))
        witness_types = sorted(set(review.get("witnessTypes", [])))
        reported = review.get("reportedCharacteristics", {})
        assessed = review.get("assessedCharacteristics", {})
        completeness = {
            "eventDate": bool(event.get("startDate")),
            "reviewedLocation": bool(location_entity_ids),
            "sensorModality": bool(sensor_modalities),
            "witnessType": bool(witness_types),
            "physicalMeasurements": bool(reported.get("measurements") or assessed.get("measurements")),
            "publishedAssessment": resolution_status != "unassessed",
        }
        records.append({
            "id": stable_id("case", event["id"]),
            "eventId": event["id"],
            "title": event["title"],
            "caseKind": "observation" if event.get("eventType") in OBSERVATIONAL_EVENT_TYPES else "institutional_record",
            "eventType": event.get("eventType"),
            "startDate": event.get("startDate"),
            "reportStatus": review.get("reportStatus", "reported"),
            "resolutionStatus": resolution_status,
            "assessmentAuthority": review.get("assessmentAuthority", ""),
            "assessmentDate": review.get("assessmentDate", ""),
            "sensorModalities": sensor_modalities,
            "witnessTypes": witness_types,
            "reportedCharacteristics": reported,
            "assessedCharacteristics": assessed,
            "documentIds": document_ids,
            "entityIds": entity_ids,
            "locationEntityIds": location_entity_ids,
            "collectionCount": len({document_by_id[document_id]["source"] for document_id in document_ids}),
            "independentSourceFamilyCount": source_family_count(document_ids, family_by_document),
            "dataCompleteness": completeness,
            "dataCompletenessScore": round(sum(completeness.values()) / len(completeness), 3),
            "reviewStatus": "reviewed" if review else "derived_event",
            "evidence": event.get("evidence", []),
        })
    return records


def coverage_aggregate(documents: list[dict], entities: list[dict], events: list[dict]) -> dict:
    """Publish metadata-only coverage buckets for client-side intersections."""
    document_by_id = {document["id"]: document for document in documents}
    all_document_ids = set(document_by_id)
    dimension_values: dict[str, dict[str, set[str]]] = {
        dimension: collections.defaultdict(set)
        for dimension in ("time", "geography", "collection", "format", "category", "modality")
    }

    for document in documents:
        document_id = document["id"]
        document_date = document.get("documentDate")
        time_label = f"{str(document_date)[:3]}0s" if document_date else "Unknown date"
        dimension_values["time"][time_label].add(document_id)
        dimension_values["collection"][document.get("source") or "Unknown collection"].add(document_id)
        dimension_values["format"][document.get("format") or "Unknown format"].add(document_id)

    document_geographies: dict[str, set[str]] = collections.defaultdict(set)
    documents_with_unmapped_locations: set[str] = set()
    document_categories: dict[str, set[str]] = collections.defaultdict(set)
    for entity in entities:
        for document_id in entity.get("documentIds", []):
            if document_id not in document_by_id:
                continue
            if entity.get("category"):
                document_categories[document_id].add(entity["category"])
            if entity.get("category") == "location":
                if entity.get("geo"):
                    document_geographies[document_id].add(entity.get("canonicalName") or entity.get("name"))
                else:
                    documents_with_unmapped_locations.add(document_id)

    document_modalities: dict[str, set[str]] = collections.defaultdict(set)
    for event in events:
        if not event.get("eventType"):
            continue
        for document_id in event.get("documentIds", []):
            if document_id in document_by_id:
                document_modalities[document_id].add(event["eventType"])

    for document_id in all_document_ids:
        for value in document_geographies.get(document_id, set()):
            dimension_values["geography"][value].add(document_id)
        if not document_geographies.get(document_id) or document_id in documents_with_unmapped_locations:
            dimension_values["geography"]["Unknown geography"].add(document_id)
        for value in document_categories.get(document_id) or {"Unknown category"}:
            dimension_values["category"][value].add(document_id)
        for value in document_modalities.get(document_id) or {"Unknown modality"}:
            dimension_values["modality"][value].add(document_id)

    labels = {
        "time": "Time period", "geography": "Geography", "collection": "Collection",
        "format": "Document format", "category": "Entity / subject category",
        "modality": "Event / evidence modality",
    }
    dimensions = []
    for dimension_id, values in dimension_values.items():
        buckets = []
        for value, document_ids in values.items():
            sorted_ids = sorted(document_ids)
            buckets.append({
                "id": stable_id("cov", f"{dimension_id}:{value}"),
                "label": value,
                "unknown": value.startswith("Unknown "),
                "documentCount": len(sorted_ids),
                "wordCount": sum(int(document_by_id[item].get("words") or 0) for item in sorted_ids),
                "datedDocumentCount": sum(1 for item in sorted_ids if document_by_id[item].get("documentDate")),
                "documentIds": sorted_ids,
            })
        buckets.sort(key=lambda item: (item["unknown"], -item["documentCount"], item["label"]))
        unknown_ids = set().union(*(set(item["documentIds"]) for item in buckets if item["unknown"])) if buckets else set()
        dimensions.append({
            "id": dimension_id,
            "label": labels[dimension_id],
            "multiValue": dimension_id in {"geography", "category", "modality"},
            "knownDocumentCount": len(all_document_ids - unknown_ids),
            "documentCount": len(all_document_ids),
            "buckets": buckets,
        })
    return {
        "schema": "ufo-files-corpus-coverage/v1",
        "policy": {
            "unit": "Documents are counted once per cell even when a dimension is multi-valued",
            "denominator": "Each cell is normalized within its row and active cohort",
            "unknowns": "Missing dates, reviewed coordinates, published categories, and event modalities are explicit buckets",
            "warning": "Corpus gaps are not evidence that real-world events did not occur",
        },
        "dimensions": dimensions,
    }


def significance_metrics(
    candidate: Candidate,
    source: str | None = None,
    family_by_document: dict[str, str] | None = None,
) -> dict:
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
        context_weights = candidate.context_document_weights
    else:
        mentions = candidate.source_mentions[source]
        coverage_documents = candidate.source_documents[source]
        context_mentions = candidate.source_context_mentions[source]
        context_documents = candidate.source_context_documents[source]
        context_weights = candidate.source_context_document_weights[source]

    adjusted_mentions = 0
    epistemic_adjusted = 0.0
    independent_documents: set[str] = set()
    for context, context_document_ids in context_documents.items():
        if context in candidate.administrative_contexts:
            continue
        if context in repeated_contexts:
            adjusted_mentions += 1
            epistemic_adjusted += min(context_weights.get(context, {}).values(), default=1.0)
            continue
        adjusted_mentions += len(context_document_ids)
        epistemic_adjusted += sum(context_weights.get(context, {}).get(document_id, 1.0) for document_id in context_document_ids)
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
        "epistemicAdjustedMentions": round(epistemic_adjusted, 3),
        "independentDocumentCount": len(independent_documents),
        "independentSourceFamilyCount": source_family_count(coverage_documents, family_by_document),
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


LINEAGE_URL = re.compile(r"https?://[^\s<>\]\[\"']+", re.I)
LINEAGE_URL_ORIGIN_CUE = re.compile(
    r"\b(?:(?:document\s+)?(?:source|origin)(?:\s+(?:url|link))?|"
    r"originally\s+(?:published|reported|broadcast)(?:\s+(?:at|by|from))?|"
    r"reprinted\s+from|based\s+on|courtesy(?:\s+of)?)\s*[:=-]?\s*$",
    re.I,
)
LINEAGE_ORIGIN = re.compile(
    r"\b(?:originally\s+(?:published|reported|broadcast)\s+by|"
    r"(?:source|origin|courtesy)\s*:|(?:interview|report|release)\s+(?:from|by))\s*"
    r"(?P<origin>[^\n.!?;]{4,120})",
    re.I,
)
LINEAGE_CITATION_CUE = re.compile(
    r"\b(?:according\s+to|cited?\s+(?:in|from)?|quoted?\s+from|reprinted\s+from|"
    r"based\s+on|source\s+(?:document)?\s*:|reported\s+in)\b",
    re.I,
)
LINEAGE_BOILERPLATE = re.compile(
    r"\b(?:requester|declassified/released|systematic review|transcription engine|"
    r"source bytes|all rights reserved|copyright|catalog(?:ed|uing))\b",
    re.I,
)


def normalized_lineage_text(value: str) -> str:
    return clean_space(re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKC", value).casefold()))


def canonical_lineage_url(value: str) -> str:
    return re.sub(r"[?#].*$", "", value.rstrip(".,);]")).casefold()


def lineage_origin_signals(segments: Iterable[str]) -> dict[str, dict]:
    signals: dict[str, dict] = {}
    for segment in segments:
        for url_match in LINEAGE_URL.finditer(segment):
            url = url_match.group(0)
            cue_context = segment[max(0, url_match.start() - 160):url_match.start()]
            if not LINEAGE_URL_ORIGIN_CUE.search(cue_context):
                continue
            canonical_url = canonical_lineage_url(url)
            location = canonical_url.split("://", 1)[-1]
            path = location.partition("/")[2]
            if len(path.strip("/")) < 6:
                continue
            key = f"url:{canonical_url}"
            signals.setdefault(key, {"kind": "url", "label": canonical_url, "excerpt": segment[:280]})
        for match in LINEAGE_ORIGIN.finditer(segment):
            label = clean_space(match.group("origin")).strip(" :-")
            normalized = normalized_lineage_text(label)
            if "http://" in label.casefold() or "https://" in label.casefold() or len(normalized) < 8 or normalized in {"unknown source", "the source", "news report", "press release"}:
                continue
            signals.setdefault(f"origin:{normalized}", {"kind": "named_origin", "label": label, "excerpt": segment[:280]})
    return signals


def source_lineage_assignments(records: list[dict]) -> tuple[list[dict], dict[str, dict]]:
    """Build conservative document families without merging or rewriting documents.

    Records need ``id``, ``title``, and ``segments``. Optional ``metadata`` may
    provide a reviewed ``source_family_id`` and ``source_family_label``.
    """
    if not records:
        return [], {}

    by_id = {record["id"]: record for record in records}
    parent = {record["id"]: record["id"] for record in records}
    reviewed_id = {
        record["id"]: clean_space(str((record.get("metadata") or {}).get("source_family_id") or ""))
        for record in records
    }
    reviewed_roots = {
        document_id: ({family_id} if family_id else set())
        for document_id, family_id in reviewed_id.items()
    }
    edge_evidence: dict[str, list[dict]] = collections.defaultdict(list)
    edges: list[tuple[float, str, str, str, dict]] = []

    def find(document_id: str) -> str:
        while parent[document_id] != document_id:
            parent[document_id] = parent[parent[document_id]]
            document_id = parent[document_id]
        return document_id

    def union(left: str, right: str) -> bool:
        left_root, right_root = find(left), find(right)
        if left_root == right_root:
            return True
        left_reviewed = reviewed_roots[left_root]
        right_reviewed = reviewed_roots[right_root]
        if left_reviewed and right_reviewed and left_reviewed != right_reviewed:
            return False
        parent[right_root] = left_root
        reviewed_roots[left_root] = left_reviewed | right_reviewed
        return True

    reviewed_groups: dict[str, list[str]] = collections.defaultdict(list)
    for document_id, family_id in reviewed_id.items():
        if family_id:
            reviewed_groups[family_id].append(document_id)
    for family_id, document_ids in reviewed_groups.items():
        for document_id in document_ids[1:]:
            evidence = {"signal": "reviewed_metadata", "detail": f"Reviewed source family {family_id}"}
            edges.append((1.0, document_ids[0], document_id, "reviewed_metadata", evidence))

    origins: dict[str, list[tuple[str, dict]]] = collections.defaultdict(list)
    for record in records:
        for key, signal in lineage_origin_signals(record.get("segments") or [] ).items():
            origins[key].append((record["id"], signal))
    for key, matches in origins.items():
        unique_ids = sorted({document_id for document_id, _ in matches})
        if len(unique_ids) < 2:
            continue
        signal = matches[0][1]
        signal_document_id = matches[0][0]
        for document_id in unique_ids[1:]:
            evidence = {
                "signal": "shared_origin",
                "detail": f"Shared {signal['kind'].replace('_', ' ')}: {signal['label']}",
                "excerpt": signal["excerpt"],
                "evidenceDocumentId": signal_document_id,
                "relatedDocumentId": unique_ids[0],
            }
            edges.append((.91, unique_ids[0], document_id, "shared_origin", evidence))

    normalized_titles: dict[str, list[str]] = collections.defaultdict(list)
    titles_by_token: dict[str, set[str]] = collections.defaultdict(set)
    for record in records:
        title = normalized_lineage_text(record.get("title") or "")
        if len(title) >= 10:
            normalized_titles[title].append(record["id"])
            anchor = max(title.split(), key=len)
            if len(anchor) >= 5:
                titles_by_token[anchor].add(title)
    for record in records:
        for segment in record.get("segments") or []:
            if not LINEAGE_CITATION_CUE.search(segment):
                continue
            normalized_segment = normalized_lineage_text(segment)
            candidate_titles = {
                title
                for token in set(normalized_segment.split())
                for title in titles_by_token.get(token, ())
            }
            matches = [
                target_id
                for title in candidate_titles
                for target_ids in [normalized_titles[title]]
                if title in normalized_segment
                for target_id in target_ids
                if target_id != record["id"]
            ]
            matches = sorted(set(matches))
            if len(matches) == 1:
                edges.append((.97, matches[0], record["id"], "direct_citation", {
                    "signal": "direct_citation",
                    "detail": f"Explicitly cites {by_id[matches[0]].get('title') or matches[0]}",
                    "excerpt": segment[:280],
                    "evidenceDocumentId": record["id"],
                    "relatedDocumentId": matches[0],
                }))
            elif len(matches) > 1:
                edge_evidence[record["id"]].append({
                    "signal": "ambiguous_citation",
                    "detail": "Citation title matches multiple documents; no family was assigned",
                    "excerpt": segment[:280],
                    "evidenceDocumentId": record["id"],
                    "candidateDocumentIds": matches,
                })

    excerpt_index: dict[str, list[tuple[str, str, str]]] = collections.defaultdict(list)
    for record in records:
        usable = []
        for segment in record.get("segments") or []:
            if LINEAGE_BOILERPLATE.search(segment):
                continue
            normalized = normalized_lineage_text(segment)
            tokens = normalized.split()
            if len(tokens) < 14 or len(set(tokens)) < 9:
                continue
            usable.append((normalized, segment[:280]))
            if len(usable) >= 40:
                break
        for normalized, excerpt in usable:
            tokens = normalized.split()
            positions = sorted({0, max(0, len(tokens) // 2 - 4), max(0, len(tokens) - 8)})
            for position in positions:
                key = " ".join(tokens[position:position + 8])
                excerpt_index[key].append((record["id"], normalized, excerpt))

    compared: set[tuple[str, str, str, str]] = set()
    best_similarity: dict[tuple[str, str], tuple[float, str, str]] = {}
    for matches in excerpt_index.values():
        if len(matches) > 24:
            exact_matches: dict[str, dict[str, str]] = collections.defaultdict(dict)
            for document_id, normalized, excerpt in matches:
                exact_matches[normalized].setdefault(document_id, excerpt)
            for normalized_matches in exact_matches.values():
                ordered = sorted(normalized_matches.items())
                if len(ordered) < 2:
                    continue
                left_id, left_excerpt = ordered[0]
                for right_id, right_excerpt in ordered[1:]:
                    best_similarity[(left_id, right_id)] = (1.0, left_excerpt, right_excerpt)
            continue
        for index, (left_id, left_text, left_excerpt) in enumerate(matches):
            for right_id, right_text, right_excerpt in matches[index + 1:]:
                if left_id == right_id:
                    continue
                comparison = (*sorted((left_id, right_id)), left_text, right_text)
                if comparison in compared:
                    continue
                compared.add(comparison)
                similarity = difflib.SequenceMatcher(None, left_text, right_text).ratio()
                pair = tuple(sorted((left_id, right_id)))
                if similarity > best_similarity.get(pair, (0, "", ""))[0]:
                    best_similarity[pair] = (similarity, left_excerpt, right_excerpt)
    for (left_id, right_id), (similarity, left_excerpt, right_excerpt) in best_similarity.items():
        evidence = {
            "signal": "near_duplicate_excerpt" if similarity >= .9 else "ambiguous_similarity",
            "detail": f"Evidence excerpts are {round(similarity * 100)}% text-similar",
            "excerpt": left_excerpt,
            "relatedExcerpt": right_excerpt,
            "evidenceDocumentId": left_id,
            "relatedDocumentId": right_id,
        }
        if similarity >= .9:
            edges.append((round(min(.96, .82 + similarity * .14), 3), left_id, right_id, "near_duplicate", evidence))
        elif similarity >= .78:
            edge_evidence[left_id].append(evidence)
            edge_evidence[right_id].append({**evidence, "relatedDocumentId": left_id, "excerpt": right_excerpt, "relatedExcerpt": left_excerpt})

    for confidence, left_id, right_id, method, evidence in sorted(
        edges,
        key=lambda item: (item[0], item[1], item[2], item[3]),
        reverse=True,
    ):
        if union(left_id, right_id):
            edge_evidence[left_id].append({**evidence, "confidence": confidence, "method": method})
            edge_evidence[right_id].append({**evidence, "confidence": confidence, "method": method, "relatedDocumentId": left_id})
        else:
            conflict = {"signal": "reviewed_family_conflict", "detail": "Strong signal conflicts with different reviewed families; records remain separate", "confidence": confidence}
            edge_evidence[left_id].append(conflict)
            edge_evidence[right_id].append(conflict)

    components: dict[str, list[str]] = collections.defaultdict(list)
    for document_id in parent:
        components[find(document_id)].append(document_id)
    families = []
    assignments: dict[str, dict] = {}
    for document_ids in components.values():
        document_ids.sort()
        dated = sorted(document_ids, key=lambda item: (by_id[item].get("documentDate") or "9999-99-99", by_id[item].get("title") or "", item))
        anchor_id = dated[0]
        reviewed_values = {reviewed_id[item] for item in document_ids if reviewed_id[item]}
        if reviewed_values:
            family_id = stable_id("sf", sorted(reviewed_values)[0])
        else:
            family_id = stable_id("sf", anchor_id)
        all_reviewed = all(reviewed_id[item] for item in document_ids)
        status = "reviewed" if all_reviewed else "inferred" if len(document_ids) > 1 else "unknown"
        metadata = by_id[anchor_id].get("metadata") or {}
        reviewed_labels = [
            clean_space(str((by_id[document_id].get("metadata") or {}).get("source_family_label") or ""))
            for document_id in dated
            if reviewed_id[document_id]
        ]
        reviewed_label = next((item for item in reviewed_labels if item), "")
        origin_labels = [signal["label"] for signal in lineage_origin_signals(by_id[anchor_id].get("segments") or []).values()]
        label = reviewed_label or clean_space(str(metadata.get("source_family_label") or "")) or (origin_labels[0] if origin_labels else by_id[anchor_id].get("title") or anchor_id)
        for document_id in document_ids:
            if reviewed_id[document_id]:
                method, confidence, assignment_status = "reviewed_metadata", 1.0, "reviewed"
            elif len(document_ids) > 1:
                inferred = [item for item in edge_evidence[document_id] if item.get("method")]
                strongest = max(inferred, key=lambda item: item.get("confidence", 0), default={})
                method, confidence, assignment_status = strongest.get("method", "chronological_precedence"), strongest.get("confidence", .8), "inferred"
            else:
                method, confidence, assignment_status = "unclassified", 0.0, "unknown"
            evidence = edge_evidence[document_id]
            if not evidence and reviewed_id[document_id]:
                evidence = [{
                    "signal": "reviewed_metadata",
                    "detail": f"Reviewed machine-data source family {reviewed_id[document_id]}",
                    "evidenceDocumentId": document_id,
                }]
            elif not evidence:
                evidence = [{
                    "signal": "unclassified",
                    "detail": "No sufficiently strong lineage signal; conservatively counted as an independent unknown family",
                }]
            assignment = {
                "id": family_id,
                "label": label,
                "status": assignment_status,
                "familyStatus": status,
                "method": method,
                "confidence": confidence,
                "evidence": evidence,
            }
            assignments[document_id] = assignment
        families.append({
            "id": family_id,
            "label": label,
            "status": status,
            "documentIds": document_ids,
            "anchorDocumentId": anchor_id,
            "anchorMethod": "chronological_precedence",
            "anchorEvidence": f"Earliest published document date: {by_id[anchor_id].get('documentDate') or 'unknown; stable title/ID fallback used'}",
        })
    families.sort(key=lambda family: (family["status"] == "unknown", family["label"], family["id"]))
    return families, assignments


def extract_mentions(segment: str, registry: dict[str, tuple[str, str]]) -> list[tuple[str, str, str, float, bool]]:
    found: dict[str, tuple[str, str, str, float, bool]] = {}
    known_spans = []
    for match in KNOWN_PATTERN.finditer(segment):
        raw = match.group(0)
        lookup = KNOWN_LOOKUP.get(known_lookup_key(raw))
        if lookup is None:
            continue
        known_spans.append(match.span())
        canonical, category = KNOWN[lookup]
        found[entity_key(canonical, category)] = (raw, canonical, category, 0.99, True)
    all_registry_pattern = getattr(registry, "all_pattern", None)
    all_registry_spans = [
        match.span()
        for match in all_registry_pattern.finditer(segment)
    ] if all_registry_pattern else []
    registry_pattern = getattr(registry, "pattern", None)
    registry_patterns = (
        (getattr(registry, "case_sensitive_pattern", None), False),
        (registry_pattern, True),
    )
    for direct_pattern, suppress_nested in registry_patterns:
        if not direct_pattern:
            continue
        for match in direct_pattern.finditer(segment):
            if suppress_nested and any(
                match.start() >= start
                and match.end() <= end
                and match.span() != (start, end)
                for start, end in all_registry_spans
            ):
                continue
            raw = match.group(0)
            if KNOWN_LOOKUP.get(known_lookup_key(raw)) is not None:
                continue
            registry_match = registry.get(comparison_key(raw))
            if not registry_match:
                continue
            canonical, category = registry_match
            reject_suffix_keys = getattr(registry, "reject_generational_suffix_keys", set())
            if (
                category == "person"
                and comparison_key(raw) in reject_suffix_keys
                and GENERATIONAL_SUFFIX_AFTER.match(segment[match.end():])
            ):
                continue
            found.setdefault(entity_key(canonical, category), (raw, canonical, category, 0.98, True))
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
    book_pattern = getattr(registry, "book_pattern", None)
    if book_pattern:
        for match in book_pattern.finditer(segment):
            context_start = max(segment.rfind(mark, 0, match.start()) for mark in ".!?;\n") + 1
            context_end_candidates = [segment.find(mark, match.end()) for mark in ".!?;\n"]
            context_end = min((end for end in context_end_candidates if end >= 0), default=len(segment))
            context = segment[max(context_start, match.start() - 60):min(context_end, match.end() + 60)]
            if not BOOK_CONTEXT_CUE.search(context):
                continue
            raw = match.group(0)
            canonical, category = registry[comparison_key(raw)]
            if len(canonical.split()) == 1:
                before = segment[max(context_start, match.start() - 48):match.start()]
                after = segment[match.end():min(context_end, match.end() + 48)]
                directly_cued = (
                    re.search(r"\b(?:book|novel|memoir)(?:\s+(?:called|titled|is|was))?\s*[,:'\"“]?\s*$", before, re.IGNORECASE)
                    or re.match(r"^\s*,?\s*(?:(?:your|his|her|their|the)\s+)?(?:(?:latest|new)\s+)?(?:book|novel|memoir)\b", after, re.IGNORECASE)
                )
                if not directly_cued:
                    continue
            found[entity_key(canonical, category)] = (raw, canonical, category, 0.98, True)
    for match in CAP_PHRASE.finditer(segment):
        if any(
            match.start() < end
            and match.end() > start
            and match.span() != (start, end)
            for start, end in [*known_spans, *all_registry_spans]
        ):
            continue
        raw = match.group(0)
        registry_key = comparison_key(raw)
        registry_match = registry.get(registry_key)
        case_insensitive_keys = getattr(registry, "case_insensitive_keys", set())
        if registry_match:
            if registry_key not in case_insensitive_keys:
                continue
            canonical, category = registry_match
            if category == "book":
                continue
            reject_suffix_keys = getattr(registry, "reject_generational_suffix_keys", set())
            if (
                category == "person"
                and registry_key in reject_suffix_keys
                and GENERATIONAL_SUFFIX_AFTER.match(segment[match.end():])
            ):
                continue
            found.setdefault(entity_key(canonical, category), (raw, canonical, category, 0.98, True))
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
    registry_windows = []
    for width in range(min(8, len(words)), 0, -1):
        for start in range(len(words) - width + 1):
            raw = clean_space(" ".join(words[start:start + width])).strip("-'_.")
            if KNOWN_LOOKUP.get(known_lookup_key(raw)) is not None:
                continue
            registry_key = comparison_key(raw)
            registry_match = registry.get(registry_key)
            if not registry_match or registry_match[1] == "book":
                continue
            registry_windows.append((start, start + width, raw, registry_key, registry_match))
    case_insensitive_keys = getattr(registry, "case_insensitive_keys", None)
    title_case_sensitive_keys = getattr(registry, "title_case_sensitive_keys", None)
    for start, end, raw, registry_key, (canonical, category) in registry_windows:
        reject_suffix_keys = getattr(registry, "reject_generational_suffix_keys", set())
        followed_by_rejected_suffix = (
            category == "person"
            and registry_key in reject_suffix_keys
            and end < len(words)
            and GENERATIONAL_SUFFIX_AFTER.match(f" {words[end]}")
        )
        if followed_by_rejected_suffix:
            continue
        if case_insensitive_keys is not None and title_case_sensitive_keys is not None:
            case_insensitive = registry_key in case_insensitive_keys
            if not case_insensitive and case_preserving_key(raw) not in title_case_sensitive_keys:
                continue
            if case_insensitive and any(
                other_start <= start
                and end <= other_end
                and (other_start, other_end) != (start, end)
                for other_start, other_end, *_ in registry_windows
            ):
                continue
        key = f"{category}:{entity_key(canonical, category)}"
        found.setdefault(key, (raw, canonical, category, 0.96, True))
    return list(found.values())


def duplicate_candidates(candidates: dict[str, Candidate], limit: int | None = 200) -> tuple[list[dict], int]:
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
    return ranked if limit is None else ranked[:limit], len(ranked)


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


def git_blob_sha(path: Path) -> str:
    """Return the Git object ID for the file's exact bytes."""
    content = path.read_bytes()
    header = f"blob {len(content)}\0".encode("ascii")
    return hashlib.sha1(header + content).hexdigest()


def normalized_evidence_text(value: str) -> str:
    """Collapse layout whitespace while preserving the source's exact wording."""
    return re.sub(r"\s+", " ", value).strip()


def validate_claim_source_blobs(input_root: Path, claims_path: Path, documents: Iterable[dict]) -> None:
    """Fail when claim evidence is absent from or no longer bound to its source file."""
    catalog = json.loads(claims_path.read_text(encoding="utf-8"))
    document_paths = {document["id"]: document["path"] for document in documents}
    errors = []
    for claim in catalog.get("claims", []):
        evidence = claim.get("evidence") or {}
        document_id = evidence.get("documentId")
        expected_sha = evidence.get("sourceBlobSha")
        relative_path = document_paths.get(document_id)
        prefix = claim.get("id") or "Unnamed claim"
        if not relative_path:
            errors.append(f"{prefix}: referenced document {document_id!r} is absent")
            continue
        if not isinstance(expected_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", expected_sha):
            errors.append(f"{prefix}: sourceBlobSha must be a 40-character lowercase Git object ID")
            continue
        actual_sha = git_blob_sha(input_root / relative_path)
        if actual_sha != expected_sha:
            errors.append(
                f"{prefix}: source content changed for {relative_path} "
                f"(expected {expected_sha}, found {actual_sha})"
            )
            continue
        source_text = normalized_evidence_text((input_root / relative_path).read_text(encoding="utf-8", errors="replace"))
        excerpt = normalized_evidence_text(str(evidence.get("excerpt") or ""))
        if not excerpt or excerpt not in source_text:
            errors.append(f"{prefix}: evidence excerpt is not exact source language from {relative_path}")
    if errors:
        raise ValueError("Claim evidence source validation failed:\n- " + "\n- ".join(errors))


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
    event_title_reviews: Path | None = None,
    reported_event_date_reviews: Path | None = None,
    claims_path: Path | None = None,
    paired_language: str = "en",
) -> dict:
    data_dir = Path(__file__).resolve().parents[1] / "data"
    registry = load_registry([data_dir / "curated_entities.json", data_dir / "entity_aliases.json", data_dir / "book_catalog.json"])
    location_coordinates = json.loads((data_dir / "location_coordinates.json").read_text(encoding="utf-8"))
    craft_taxonomy = json.loads((data_dir / "craft_taxonomy.json").read_text(encoding="utf-8"))
    species_taxonomy = json.loads((data_dir / "species_taxonomy.json").read_text(encoding="utf-8"))
    astronomy_taxonomy = json.loads((data_dir / "astronomy_taxonomy.json").read_text(encoding="utf-8"))
    compiled_species_taxonomy = compile_species_taxonomy(species_taxonomy)
    compiled_astronomy_taxonomy = compile_astronomy_taxonomy(astronomy_taxonomy)
    epistemic_rules = load_epistemic_qualifier_rules(input_root / "config" / "epistemic_qualifiers.json")
    curated_event_path = data_dir / "curated_events.json"
    curated_event_items = json.loads(curated_event_path.read_text(encoding="utf-8")).get("events", []) if curated_event_path.exists() else []
    reported_event_date_review_path = reported_event_date_reviews or data_dir / "reported_event_date_reviews.json"
    reported_event_date_review_payload = (
        json.loads(reported_event_date_review_path.read_text(encoding="utf-8"))
        if reported_event_date_review_path.exists() else {}
    )
    reported_event_date_review_records = reported_event_date_review_payload.get("documents", {})
    curated_discussion_support: dict[str, list[dict]] = collections.defaultdict(list)
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
    craft_observations: list[dict] = []
    craft_candidates: list[dict] = []
    species_observations: list[dict] = []
    species_candidates: list[dict] = []
    astronomy_observations: list[dict] = []
    astronomy_candidates: list[dict] = []
    signal_observations: list[dict] = []
    epistemic_qualifiers_by_segment: dict[str, list[dict]] = {}
    segment_entity_qualifiers: dict[str, dict[str, list[dict]]] = collections.defaultdict(dict)
    lineage_records: list[dict] = []

    paths = machine_data_paths(input_root, paired_language)
    for path in paths:
        relative = path.relative_to(input_root).as_posix()
        source = relative.split("/", 1)[0]
        parsed = None
        fmt = ""
        duration = None
        pair = read_language_pair(path) if path.name == "document.json" else None
        segment_ids = None
        document_fields = {}
        if pair:
            metadata, segments = pair["metadata"], pair["segments"]
            parsed = (metadata, segments)
            medium = pair["document"].get("medium")
            fmt = "transcript" if medium == "media" else "web" if medium == "web-page" else "ocr"
            relative = pair["canonical_path"].relative_to(input_root).as_posix()
            source = relative.split("/", 1)[0]
            segment_ids = pair["segment_ids"]
            document_fields = {
                "originalLanguage": pair["document"].get("canonical_language"),
                "availableLanguages": pair["document"].get("available_languages", [pair["document"].get("canonical_language")]),
                "translationAvailable": bool(pair["document"].get("translation_available")),
                "translationReviewStatus": pair["document"].get("translation_review_status", "unavailable"),
                "canonicalPath": pair["canonical_path"].relative_to(input_root).as_posix(),
                "translationPath": (
                    pair["translation_path"].relative_to(input_root).as_posix()
                    if pair["translation_path"] else None
                ),
                "pairedDocumentId": pair["document"].get("document_id"),
                "jurisdiction": metadata.get("jurisdiction"),
                "countryCode": metadata.get("country_code"),
            }
        elif path.suffix.lower() == ".txt":
            parsed = read_ocr(path)
            if parsed:
                metadata, segments = parsed
                fmt = "web" if metadata.get("medium") == "web-page" else "ocr"
                if metadata.get("schema") in PAIRED_SEARCH_SCHEMAS:
                    segment_ids = metadata.get("segment_ids")
                    pair_root = path.parent.parent.resolve()
                    canonical_value = metadata.get("canonical_path")
                    translation_value = metadata.get("translation_path")
                    canonical_path = pair_root / canonical_value if canonical_value else None
                    translation_path = pair_root / translation_value if translation_value else path
                    canonical_relative = (
                        canonical_path.resolve().relative_to(input_root.resolve()).as_posix()
                        if canonical_path and canonical_path.resolve().is_relative_to(pair_root)
                        else None
                    )
                    translation_relative = (
                        translation_path.resolve().relative_to(input_root.resolve()).as_posix()
                        if translation_path.resolve().is_relative_to(pair_root)
                        else relative
                    )
                    document_fields = {
                        "originalLanguage": metadata.get("original_language"),
                        "availableLanguages": metadata.get("available_languages") or [metadata.get("original_language"), "en"],
                        "translationAvailable": bool(metadata.get("translation_available", True)),
                        "translationReviewStatus": metadata.get("translation_review_status") or "unavailable",
                        "canonicalPath": canonical_relative,
                        "translationPath": translation_relative,
                        "pairedDocumentId": metadata.get("document_id"),
                        "jurisdiction": metadata.get("jurisdiction"),
                        "countryCode": metadata.get("country_code"),
                    }
        else:
            media = read_tsv(path)
            if media:
                metadata, segments, duration = media
                parsed = (metadata, segments)
                fmt = "transcript"
        if not parsed:
            continue
        metadata, segments = parsed
        doc_id = document_fields.get("pairedDocumentId") or stable_id("doc", relative)
        for event_title, support in curated_discussion_matches(segments, curated_event_items).items():
            curated_discussion_support[event_title].append({"documentId": doc_id, **support})
        words = sum(len(segment.split()) for segment in segments)
        title_path = Path(str(metadata.get("source_file") or path.name))
        source_title = clean_space(str(metadata.get("source_title") or "")) or source_title_from_path(title_path)
        title = source_title if metadata.get("source_title") else title_from_path(title_path)
        document_date, document_events, review_candidates = temporal_candidates(segments, metadata, doc_id, segment_ids)
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
            **document_fields,
        }
        if metadata.get("engine_mode") == "database-report":
            source_record = {
                "externalId": str(metadata["mufon_id"]) if metadata.get("mufon_id") is not None else None,
                "databaseId": metadata.get("updb_database_id"),
            }
            document["sourceRecord"] = {key: value for key, value in source_record.items() if value is not None}
            document["reportedEventDateReview"] = reported_event_date_review(
                segments,
                document_date,
                doc_id,
                reported_event_date_review_records,
                {**metadata, "collection": metadata.get("collection") or source},
                relative,
                git_blob_sha(path) if doc_id in reported_event_date_review_records else None,
            )
            date_decision = document["reportedEventDateReview"]
            if date_decision.get("status") == "published" and date_decision.get("method") == "analyst-review":
                document_date = {
                    **document_date,
                    "value": date_decision.get("date") or document_date["value"],
                    "precision": date_decision.get("precision") or document_date["precision"],
                    "method": "analyst-review",
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
        lineage_records.append({
            "id": doc_id,
            "title": title,
            "documentDate": document.get("documentDate"),
            "segments": segments,
            "metadata": metadata,
        })
        document_sources[doc_id] = source
        document_ids_by_path[relative] = doc_id
        source_counts[source] += 1
        source_words[source] += words
        title_sid = f"{doc_id}:title"
        for raw, canonical, category, confidence, curated in extract_title_mentions(source_title, registry):
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
        jurisdiction = clean_space(str(metadata.get("jurisdiction") or ""))
        jurisdiction_sid = f"{doc_id}:metadata:jurisdiction"
        for raw, canonical, category, confidence, curated in extract_title_mentions(jurisdiction, registry):
            if category != "location":
                continue
            key = f"{category}:{entity_key(canonical, category)}"
            candidate = candidates.get(key)
            if candidate is None:
                candidate = candidates[key] = Candidate(canonical, category, curated)
            else:
                if curated and not candidate.curated:
                    candidate.canonical = canonical
                candidate.curated = candidate.curated or curated
            candidate.add(
                raw,
                doc_id,
                source,
                jurisdiction_sid,
                f"Source jurisdiction: {jurisdiction}",
                confidence,
            )
        document_qualifiers = []
        for number, segment in enumerate(segments):
            sid = f"{doc_id}:{segment_ids[number]}" if segment_ids else f"{doc_id}:{number}"
            signal_segment = segment_ids[number] if segment_ids else number
            detected_qualifiers = epistemic_qualifiers_for_segment(
                segment,
                signal_segment,
                epistemic_rules,
                segments[number + 1] if number + 1 < len(segments) else "",
                segment_ids[number + 1] if segment_ids and number + 1 < len(segment_ids) else (number + 1 if number + 1 < len(segments) else None),
            )
            if detected_qualifiers:
                document_qualifiers.extend(detected_qualifiers)
                for qualifier in detected_qualifiers:
                    claim_segment = qualifier.get("claimSegment")
                    if claim_segment is None:
                        continue
                    claim_sid = f"{doc_id}:{claim_segment}"
                    target_qualifiers = epistemic_qualifiers_by_segment.setdefault(claim_sid, [])
                    if qualifier not in target_qualifiers:
                        target_qualifiers.append(qualifier)
            qualifiers = epistemic_qualifiers_by_segment.get(sid, [])
            signal_observations.extend(signal_observations_for_segment(segment, doc_id, source, signal_segment))
            observations, review_items = craft_observations_for_segment(segment, doc_id, source, signal_segment, craft_taxonomy)
            craft_observations.extend(observations)
            craft_candidates.extend(review_items)
            species_matches, species_review_items = species_observations_for_segment(
                segment, doc_id, source, signal_segment, species_taxonomy, compiled_species_taxonomy,
                context_segments=segments,
                context_segment_index=number,
            )
            species_observations.extend(species_matches)
            species_candidates.extend(species_review_items)
            astronomy_matches, astronomy_review_items = astronomy_observations_for_segment(
                segment, doc_id, source, signal_segment, astronomy_taxonomy, compiled_astronomy_taxonomy,
                context_segments=segments,
                context_segment_index=number,
            )
            astronomy_observations.extend(astronomy_matches)
            astronomy_candidates.extend(astronomy_review_items)
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
                claim_qualifiers = qualifiers_for_claim(qualifiers, raw, canonical, signal_segment)
                existing_qualifiers = segment_entity_qualifiers[sid].setdefault(key, [])
                existing_qualifiers.extend(item for item in claim_qualifiers if item not in existing_qualifiers)
                evidence_weight = min((item["evidenceWeight"] for item in claim_qualifiers), default=1.0)
                candidate.add(raw, doc_id, source, sid, segment, confidence, evidence_weight, claim_qualifiers)
                keys.append(key)
            if keys:
                segment_entities[sid] = list(dict.fromkeys(keys))
                segment_text[sid] = segment

        if document_qualifiers:
            document["epistemicQualifiers"] = document_qualifiers
            document["epistemicQualifierCount"] = len(document_qualifiers)

    source_families, source_family_assignments = source_lineage_assignments(lineage_records)
    family_by_document = {
        document_id: assignment["id"]
        for document_id, assignment in source_family_assignments.items()
    }
    for document in documents:
        document["sourceFamily"] = source_family_assignments[document["id"]]

    events = overlay_curated_events(
        events,
        curated_events(curated_event_path, document_ids_by_path, date_review, curated_discussion_support),
    )
    events = merge_events(events)
    events = reviewed_event_titles(events, event_title_reviews or data_dir / "event_title_reviews.json")
    events = merge_events(events)
    accepted_candidates = {key: value for key, value in candidates.items() if accepted(value)}
    all_possible_duplicates, possible_duplicate_count = duplicate_candidates(accepted_candidates, limit=None)
    possible_duplicates = all_possible_duplicates[:200]
    def publication_rank(item: tuple[str, Candidate]) -> tuple:
        candidate = item[1]
        metrics = significance_metrics(candidate, family_by_document=family_by_document)
        return (
            candidate.curated,
            len(candidate.title_documents),
            metrics["independentDocumentCount"],
            len(candidate.sources),
            metrics["epistemicAdjustedMentions"],
            metrics["contextAdjustedMentions"],
            candidate.mentions,
            candidate.canonical,
        )

    ranked = sorted(accepted_candidates.items(), key=publication_rank, reverse=True)
    # Books have their own graph mode and are relatively sparse. Publish every
    # accepted title instead of silently truncating the corpus at 250.
    book_items = [item for item in ranked if item[1].category == "book"]
    book_keys = {key for key, _ in book_items}
    non_book_limit = max(0, max_entities - len(book_items))
    published_items = book_items + [item for item in ranked if item[0] not in book_keys][:non_book_limit]
    published_items.sort(key=publication_rank, reverse=True)
    published = dict(published_items)
    entity_ids = {key: stable_id("ent", key) for key in published}
    attach_event_entities(events, segment_entities, document_title_entities, registry, published, entity_ids)
    documents_by_id = {document["id"]: document for document in documents}
    event_ids_by_segment: dict[str, list[str]] = collections.defaultdict(list)
    for event in events:
        for evidence in event.get("evidence", []):
            if evidence.get("segment") is not None:
                event_ids_by_segment[f"{evidence['documentId']}:{evidence['segment']}"].append(event["id"])
    events_by_id = {event["id"]: event for event in events}
    for observation in craft_observations:
        sid = f"{observation['documentId']}:{observation['segment']}"
        observation["epistemicQualifiers"] = epistemic_qualifiers_by_segment.get(sid, [])
        observation["entityIds"] = sorted({entity_ids[key] for key in segment_entities.get(sid, []) if key in entity_ids})
        observation["eventIds"] = sorted(set(event_ids_by_segment.get(sid, [])))
        event_dates = [events_by_id[event_id]["startDate"] for event_id in observation["eventIds"]]
        document_date = documents_by_id[observation["documentId"]].get("documentDate")
        observation["date"] = min(event_dates) if event_dates else document_date
    for observation in species_observations:
        sid = f"{observation['documentId']}:{observation['segment']}"
        observation["epistemicQualifiers"] = epistemic_qualifiers_by_segment.get(sid, [])
        observation["entityIds"] = sorted({entity_ids[key] for key in segment_entities.get(sid, []) if key in entity_ids})
        observation["eventIds"] = sorted(set(event_ids_by_segment.get(sid, [])))
        event_dates = [events_by_id[event_id]["startDate"] for event_id in observation["eventIds"]]
        document_date = documents_by_id[observation["documentId"]].get("documentDate")
        observation["date"] = min(event_dates) if event_dates else document_date

    for observation in signal_observations:
        sid = f"{observation['documentId']}:{observation['segment']}"
        observation["epistemicQualifiers"] = epistemic_qualifiers_by_segment.get(sid, [])
        observation["entityIds"] = sorted({entity_ids[key] for key in segment_entities.get(sid, []) if key in entity_ids})
        observation["eventIds"] = sorted(set(event_ids_by_segment.get(sid, [])))
        event_dates = [events_by_id[event_id]["startDate"] for event_id in observation["eventIds"]]
        document_date = documents_by_id[observation["documentId"]].get("documentDate")
        observation["date"] = min(event_dates) if event_dates else document_date
    entities = []
    for key, candidate in published_items:
        extraction = candidate.extraction_total / max(1, candidate.mentions)
        evidence_factor = min(1.0, 0.45 + len(candidate.documents) * 0.08 + candidate.mentions * 0.015)
        classification = 0.99 if candidate.curated else (min(0.98, extraction) if candidate.category == "book" else min(0.94, extraction * evidence_factor))
        name = candidate.canonical if candidate.curated else candidate.variants.most_common(1)[0][0]
        metrics = significance_metrics(candidate, family_by_document=family_by_document)
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
                    **significance_metrics(candidate, source, family_by_document),
                }
                for source in sorted(candidate.sources)
            },
            "evidence": candidate.examples,
        }
        entity.update(registry.metadata.get((entity_key(candidate.canonical, candidate.category), candidate.category), {}))
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
                    "weightedEvidence": 0.0,
                    "source_weighted_evidence": collections.Counter(),
                })
                document_id = sid.split(":", 1)[0]
                source = document_sources[document_id]
                stat["segments"].add(sid)
                shared_qualifiers = [
                    item for item in segment_entity_qualifiers[sid].get(left, [])
                    if item in segment_entity_qualifiers[sid].get(right, [])
                ]
                evidence_weight = min((item["evidenceWeight"] for item in shared_qualifiers), default=1.0)
                stat["weightedEvidence"] += evidence_weight
                stat["source_weighted_evidence"][source] += evidence_weight
                stat["documents"].add(document_id)
                stat["source_segments"][source].add(sid)
                stat["source_documents"][source].add(document_id)
                if len(stat["examples"]) < 3:
                    stat["examples"].append({"documentId": document_id, "segment": sid.split(":", 1)[1], "excerpt": text[:280], "epistemicQualifiers": shared_qualifiers})
    edges = []
    for (left, right, relation), stat in edge_stats.items():
        evidence_count = len(stat["segments"])
        weighted_evidence_count = stat["weightedEvidence"]
        document_count = len(stat["documents"])
        if relation == "co_mentioned" and evidence_count < 2:
            continue
        edges.append({
            "id": stable_id("edge", f"{left}|{right}|{relation}"),
            "source": entity_ids[left],
            "target": entity_ids[right],
            "relationship": relation,
            "evidenceCount": evidence_count,
            "epistemicAdjustedEvidenceCount": round(weighted_evidence_count, 3),
            "documentCount": document_count,
            "documentIds": sorted(stat["documents"]),
            "independentSourceFamilyCount": source_family_count(stat["documents"], family_by_document),
            "confidence": round(min(0.98, 0.48 + weighted_evidence_count * 0.06 + document_count * 0.05 + (0.12 if relation != "co_mentioned" else 0)), 3),
            "sourceMetrics": {
                source: {
                    "evidenceCount": len(stat["source_segments"][source]),
                    "epistemicAdjustedEvidenceCount": round(stat["source_weighted_evidence"][source], 3),
                    "documentCount": len(stat["source_documents"][source]),
                    "independentSourceFamilyCount": source_family_count(stat["source_documents"][source], family_by_document),
                }
                for source in sorted(stat["source_segments"])
            },
            "evidence": stat["examples"],
        })
    edges.sort(key=lambda edge: (edge["epistemicAdjustedEvidenceCount"], edge["documentCount"], edge["evidenceCount"]), reverse=True)
    all_edge_count = len(edges)
    edges = edges[:max_edges]

    for event in events:
        event["independentSourceFamilyCount"] = source_family_count(event.get("documentIds", []), family_by_document)
        for evidence in event.get("evidence", []):
            if evidence.get("segment") is not None:
                evidence["epistemicQualifiers"] = epistemic_qualifiers_by_segment.get(f"{evidence['documentId']}:{evidence['segment']}", [])

    cases = case_records(events, documents, entities, family_by_document, data_dir / "case_reviews.json")

    sources = [
        {"id": stable_id("src", source), "name": source, "documents": source_counts[source], "words": source_words[source]}
        for source in sorted(source_counts)
    ]
    craft_classes = craft_class_summaries(craft_taxonomy, craft_observations)
    craft_review = craft_review_summary(craft_candidates)
    species_classes = species_class_summaries(species_taxonomy, species_observations)
    species_review = species_review_summary(species_candidates)
    astronomy_targets = astronomy_target_summaries(astronomy_taxonomy, astronomy_observations)
    astronomy_review = astronomy_review_summary(astronomy_candidates)
    signal_frequencies = signal_frequency_summaries(signal_observations, family_by_document)
    input_name = input_repository.rsplit("/", 1)[-1] if input_repository else input_root.name
    catalog_input = {"rootName": input_name, "transcriptsAreSourceOfTruth": True, "pairedLanguage": paired_language}
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
            "sourceLineage": {
                "policy": SOURCE_FAMILY_POLICY,
                "fallback": "Every unclassified document remains an independent unknown family",
                "grouping": "Only reviewed metadata, explicit direct citation, shared named/URL origin, or >=90% near-duplicate excerpts may group documents",
                "uncertainty": "Ambiguous similarities and conflicting reviewed assignments are published as evidence but never collapsed",
                "textIntegrity": "Assignments do not merge documents or alter source text",
            },
            "entityRanking": "Curated identities first, then independent documents, source diversity, epistemic- and context-adjusted mentions, and raw mentions",
            "epistemicAdjustment": "Machine-detected qualifiers reduce derived mention and relationship ranking weight; source text, raw counts, and publication eligibility remain unchanged",
            "titleEvidence": "Curated aliases in document titles seed identity evidence; arbitrary title-case phrases are not classified",
            "confidenceSemantics": "Heuristic ranking signals, not calibrated probabilities",
            "temporalEvidence": "Events require explicit event language tied to an unambiguous day-level date; document dates require trusted metadata or a header; FOIA, release, declassification, and processing dates are excluded",
            "reportedEventDates": "Structured report dates publish automatically from 1947 onward only when day-precise, high-confidence metadata has no explicit invalid, required-form, malformed, sentinel, or audited source-defect signal; analyst review may publish, correct, coarsen, or exclude earlier source dates",
            "locationCoordinates": "Reviewed local gazetteer; ambiguous and unmapped names are not plotted",
            "craftClassification": "Versioned reviewed literal phrases in report-like context; exclusions and unmapped shape phrases remain in the craft review queue",
            "craftMeasurements": "Explicit same-segment values only; original units/ranges are retained, SI conversions are published, altitude is excluded, and missing axes are not inferred",
            "speciesClassification": "Versioned reviewed literal names and aliases; ambiguous common-language names require extraterrestrial context and remain reviewable when excluded",
            "astronomyClassification": "Versioned reviewed literal names and aliases; names with common non-astronomical uses require reviewed local context and remain reviewable when excluded",
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
            "acceptedBookCandidates": sum(1 for candidate in accepted_candidates.values() if candidate.category == "book"),
            "booksWithReviewedAuthors": sum(1 for entity in entities if entity["category"] == "book" and entity.get("authors")),
            "datedDocuments": sum(1 for document in documents if document.get("documentDate")),
            "publishedEvents": len(events),
            "publishedReportedEventDates": sum(
                1 for document in documents
                if document.get("reportedEventDateReview", {}).get("status") == "published"
            ),
            "reviewRequiredReportedEventDates": sum(
                1 for document in documents
                if document.get("reportedEventDateReview", {}).get("status") == "review_required"
            ),
            "excludedReportedEventDates": sum(
                1 for document in documents
                if document.get("reportedEventDateReview", {}).get("status") == "excluded"
            ),
            "publishedCases": len(cases),
            "observationalCases": sum(1 for case in cases if case["caseKind"] == "observation"),
            "assessedCases": sum(1 for case in cases if case["resolutionStatus"] != "unassessed"),
            "craftObservations": len(craft_observations),
            "craftClasses": sum(1 for item in craft_classes if item["observationCount"]),
            "craftReferenceClasses": sum(1 for item in craft_classes if item.get("authority")),
            "craftMeasurements": sum(len(item.get("measurements", [])) for item in craft_observations),
            "craftReviewCandidates": sum(item["count"] for item in craft_review),
            "speciesObservations": len(species_observations),
            "speciesClasses": len(species_classes),
            "speciesReviewCandidates": sum(item["count"] for item in species_review),
            "astronomyMentions": len(astronomy_observations),
            "astronomyTargets": len(astronomy_targets),
            "astronomyReviewCandidates": sum(item["count"] for item in astronomy_review),
            "signalObservations": len(signal_observations),
            "signalFrequencies": len(signal_frequencies),
            "epistemicQualifierCandidates": sum(len(items) for items in epistemic_qualifiers_by_segment.values()),
            "documentsWithEpistemicQualifiers": sum(bool(document.get("epistemicQualifierCount")) for document in documents),
            "sourceFamilies": len(source_families),
            "inferredSourceFamilies": sum(1 for family in source_families if family["status"] == "inferred"),
            "unknownSourceFamilies": sum(1 for family in source_families if family["status"] == "unknown"),
        },
        "sources": sources,
        "documents": documents,
        "sourceFamilies": source_families,
        "events": events,
        "cases": cases,
        "entities": entities,
        "edges": edges,
        "coverage": coverage_aggregate(documents, entities, events),
        "craft": {
            "schema": "ufo-files-craft-observations/v1",
            "taxonomyVersion": craft_taxonomy["version"],
            "authorities": craft_taxonomy.get("authorities", []),
            "classes": craft_classes,
            "observations": craft_observations,
            "reviewCandidates": craft_review,
        },
        "species": {
            "schema": "ufo-files-species-observations/v1",
            "taxonomyVersion": species_taxonomy["version"],
            "groundingSource": species_taxonomy.get("groundingSource", {}),
            "categories": species_taxonomy.get("categories", []),
            "classes": species_classes,
            "observations": species_observations,
            "reviewCandidates": species_review,
        },
        "astronomy": {
            "schema": "ufo-files-astronomy-observations/v1",
            "taxonomyVersion": astronomy_taxonomy["version"],
            "scope": astronomy_taxonomy["methodology"],
            "targets": astronomy_targets,
            "observations": astronomy_observations,
            "reviewCandidates": astronomy_review,
        },
        "signals": {
            "schema": "ufo-files-signal-frequency-observations/v1",
            "scope": "Explicit numeric frequency mentions in the transcript corpus; not live RF observations",
            "frequencies": signal_frequencies,
            "observations": signal_observations,
        },
        "epistemicQualifiers": {
            "schema": "ufo-files-epistemic-qualifiers/v1",
            "rulesSchema": epistemic_rules["schema"] if epistemic_rules else None,
            "policy": epistemic_rules["policy"] if epistemic_rules else "No machine-data qualifier rules were available for this build.",
            "status": "candidate",
            "changesRawCounts": False,
        },
        "duplicateCandidates": possible_duplicates,
    }
    if require_data and (not documents or not entities):
        raise ValueError(
            "Refusing to publish an empty catalog: "
            f"found {len(documents)} documents and {len(entities)} entities in {input_root}"
        )
    if claims_path:
        validate_claim_source_blobs(input_root, claims_path, documents)
    output.parent.mkdir(parents=True, exist_ok=True)
    document_shards = write_document_shards(output.parent / "source-documents", documents, output.parent)
    published_catalog = {**catalog, "documents": [], "documentShards": document_shards}
    output.write_text(json.dumps(published_catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    write_astronomy_bootstrap(output.with_name("astronomy.json"), catalog)
    if duplicate_report:
        duplicate_report.parent.mkdir(parents=True, exist_ok=True)
        duplicate_report.write_text(json.dumps({
            "schema": "ufo-files-entity-duplicate-candidates/v1",
            "input": catalog_input,
            "count": possible_duplicate_count,
            "totalCount": possible_duplicate_count,
            "shownCount": len(all_possible_duplicates),
            "candidates": all_possible_duplicates,
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


def source_shard_slug(source: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", source).encode("ascii", "ignore").decode().lower()).strip("-")
    return slug or f"source-{hashlib.sha1(source.encode('utf-8')).hexdigest()[:10]}"


def astronomy_bootstrap_payload(catalog: dict) -> dict:
    """Return the small payload required to render Galactic Entities."""
    astronomy = catalog["astronomy"]
    evidence_document_ids = {
        evidence["documentId"]
        for target in astronomy["targets"]
        for evidence in target.get("evidence", [])
    } | {
        evidence["documentId"]
        for candidate in astronomy["reviewCandidates"]
        for evidence in candidate.get("examples", [])
    }
    evidence_documents = [{
        key: document[key]
        for key in ("id", "path", "title", "source", "sourceFamily")
        if key in document
    } for document in catalog.get("documents", []) if document["id"] in evidence_document_ids]
    return {
        "schema": ASTRONOMY_BOOTSTRAP_SCHEMA,
        "catalogSchema": catalog["schema"],
        "generatedAt": catalog["generatedAt"],
        "input": catalog["input"],
        "counts": catalog["counts"],
        "sources": catalog["sources"],
        "documents": evidence_documents,
        "astronomy": {
            "schema": astronomy["schema"],
            "taxonomyVersion": astronomy["taxonomyVersion"],
            "scope": astronomy["scope"],
            "targets": astronomy["targets"],
            "reviewCandidates": astronomy["reviewCandidates"],
        },
    }


def write_astronomy_bootstrap(path: Path, catalog: dict) -> None:
    path.write_text(
        json.dumps(astronomy_bootstrap_payload(catalog), ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def write_document_shards(shard_dir: Path, documents: list[dict], data_dir: Path) -> list[dict]:
    """Publish source-scoped document payloads below GitHub's file-size limit."""
    shard_dir.mkdir(parents=True, exist_ok=True)
    expected: set[Path] = set()
    manifest: list[dict] = []
    by_source: dict[str, list[dict]] = collections.defaultdict(list)
    for document in documents:
        by_source[document["source"]].append(document)

    for source in sorted(by_source):
        encoded_documents = [json.dumps(item, ensure_ascii=False, separators=(",", ":")) for item in by_source[source]]
        chunks: list[list[str]] = []
        current: list[str] = []
        current_bytes = 0
        for encoded in encoded_documents:
            encoded_bytes = len(encoded.encode("utf-8")) + (1 if current else 0)
            if current and current_bytes + encoded_bytes > DOCUMENT_SHARD_MAX_BYTES:
                chunks.append(current)
                current, current_bytes = [], 0
                encoded_bytes = len(encoded.encode("utf-8"))
            current.append(encoded)
            current_bytes += encoded_bytes
        if current:
            chunks.append(current)

        slug = source_shard_slug(source)
        for index, chunk in enumerate(chunks, start=1):
            suffix = f"-{index:03d}" if len(chunks) > 1 else ""
            path = shard_dir / f"{slug}{suffix}.json"
            prefix = json.dumps({"schema": DOCUMENT_SHARD_SCHEMA, "source": source}, ensure_ascii=False, separators=(",", ":"))[:-1]
            payload = f'{prefix},"documents":[{",".join(chunk)}]}}\n'
            path.write_text(payload, encoding="utf-8")
            expected.add(path)
            manifest.append({
                "source": source,
                "path": path.relative_to(data_dir).as_posix(),
                "documents": len(chunk),
                "bytes": path.stat().st_size,
                "version": hashlib.sha256(payload.encode("utf-8")).hexdigest(),
            })

    for stale in shard_dir.glob("*.json"):
        if stale not in expected:
            stale.unlink()
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "catalog.json")
    parser.add_argument("--max-entities", type=int, default=1200)
    parser.add_argument("--max-edges", type=int, default=4000)
    parser.add_argument("--input-repository")
    parser.add_argument("--input-revision")
    parser.add_argument(
        "--paired-language",
        default="en",
        choices=["en", "pt-BR", "fr-FR"],
        help="For multilingual paired collections, ingest English derivatives or one canonical source language.",
    )
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
    parser.add_argument(
        "--reported-event-date-reviews",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "reported_event_date_reviews.json",
        help="Read analyst decisions for structured database-report event dates.",
    )
    parser.add_argument(
        "--claims",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "claims.json",
        help="Validate claim evidence bindings against the input checkout.",
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
        reported_event_date_reviews=args.reported_event_date_reviews.resolve(),
        claims_path=args.claims.resolve(),
        paired_language=args.paired_language,
    )
    print(json.dumps({"output": str(args.output), **catalog["counts"]}, indent=2))


if __name__ == "__main__":
    main()
