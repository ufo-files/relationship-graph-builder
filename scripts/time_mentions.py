"""Extract literal time-of-day references; playback offsets and durations are excluded."""
from __future__ import annotations

import hashlib
import re

PERIOD = r"(?:a\.?\s*m\.?|p\.?\s*m\.?)"
ZONE = r"(?:UTC|GMT|UT|Zulu|Z|[ECMP][DS]T|[+-](?:0\d|1[0-4]):[0-5]\d)"
WORDS = {word: index for index, word in enumerate(
    ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"))}
HOUR_WORD = "(?:" + "|".join(WORDS) + ")"
PATTERNS = [
    ("colon", re.compile(rf"(?<![\w:.])(?P<h>\d{{1,2}}):(?P<m>\d{{2}})(?::(?P<s>\d{{2}}))?\s*(?P<p>{PERIOD})?(?:\s*(?P<z>{ZONE}))?(?![\w:])", re.I)),
    ("decimal", re.compile(rf"(?<![\w.])(?P<h>\d{{1,2}})\.(?P<m>\d{{2}})\s*(?P<p>{PERIOD})(?!\w)", re.I)),
    ("relative", re.compile(rf"\b(?P<fraction>half|quarter)\s+(?P<relation>past|to)\s+(?P<h>\d{{1,2}}|{HOUR_WORD})(?:\s*(?P<p>{PERIOD}))?(?:\s*(?P<part>in the morning|in the afternoon|in the evening|at night))?\b", re.I)),
    ("period", re.compile(rf"(?<![\w:.])(?P<h>\d{{1,2}}|{HOUR_WORD})\s*(?P<p>{PERIOD})(?!\w)", re.I)),
    ("military", re.compile(rf"(?<![\w:.])(?P<h>\d{{2}})(?P<m>\d{{2}})\s*(?P<z>hours?|hrs?|{ZONE})(?!\w)", re.I)),
    ("oclock", re.compile(rf"\b(?P<h>\d{{1,2}}|{HOUR_WORD})\s*o[’']?\s*clock\b(?:\s*(?P<p>{PERIOD}))?(?:\s*(?P<part>in the morning|in the afternoon|in the evening|at night))?", re.I)),
    ("part", re.compile(rf"\b(?P<h>\d{{1,2}}|{HOUR_WORD})\s+(?P<part>in the morning|in the afternoon|in the evening|at night)\b", re.I)),
    ("named", re.compile(r"\b(?P<named>noon|midnight)\b", re.I)),
]
TIME_CUE = re.compile(r"\b(?:at|around|about|approximately|approx\.?|before|after|by|until|since|from|between|time(?: was| of)?|hours?)\s*[:=]?\s*$", re.I)
CITATION = re.compile(r"\b(?:Genesis|Exodus|Matthew|Mark|Luke|John|Acts|Romans|Revelation|verse|chapter|ratio|aspect ratio|odds)\s*$", re.I)


def time_observations_for_segment(text: str, document_id: str, source: str, segment: int | str) -> list[dict]:
    observations, occupied = [], []
    for notation, pattern in PATTERNS:
        for match in pattern.finditer(text):
            if any(match.start() < end and match.end() > start for start, end in occupied):
                continue
            data = match.groupdict()
            previous = text[max(0, match.start() - 80):match.start()]
            following = text[match.end():match.end() + 40]
            # Do not salvage a suffix of an invalid time or a subtitle timecode.
            if re.search(r"\d[:.]\s*$", previous):
                continue
            if re.match(r"\s*(?:-->|→)", following) or re.search(r"(?:-->|→)\s*$", previous):
                continue
            if notation == "named":
                hour, minute = (12, 0) if data["named"].lower() == "noon" else (0, 0)
                period, hour24 = ("pm", 12) if hour == 12 else ("am", 0)
            else:
                raw_hour = data["h"].lower()
                hour = WORDS[raw_hour] if raw_hour in WORDS else int(raw_hour)
                minute = int(data.get("m") or 0)
                second = int(data.get("s") or 0)
                raw_period = data.get("p")
                zone = data.get("z") or ""
                if hour == 24 and minute == 0 and second == 0 and not raw_period:
                    hour = 0
                if hour > 23 or minute > 59 or second > 59:
                    continue
                period = re.sub(r"[.\s]", "", raw_period).lower() if raw_period else "unspecified"
                part = (data.get("part") or "").lower()
                if part:
                    period = "am" if "morning" in part else "pm"
                    # "twelve at night" means midnight; other twelve-parts are unclear.
                    if hour == 12 and "night" in part:
                        period = "am"
                if period != "unspecified":
                    if not 1 <= hour <= 12:
                        continue
                    hour24 = hour % 12 + (12 if period == "pm" else 0)
                elif notation == "military" or zone or hour == 0 or hour > 12:
                    hour24 = hour
                    period = "am" if hour < 12 else "pm"
                else:
                    hour24 = None
                if notation == "relative":
                    if not 1 <= hour <= 12:
                        continue
                    delta = 30 if data["fraction"].lower() == "half" else 15
                    delta *= -1 if data["relation"].lower() == "to" else 1
                    dial_minutes = (hour * 60 + delta) % 720
                    hour, minute = dial_minutes // 60, dial_minutes % 60
                    if hour24 is not None:
                        total = (hour24 * 60 + delta) % 1440
                        hour24, minute = total // 60, total % 60
                        period = "am" if hour24 < 12 else "pm"
                if notation == "colon":
                    if CITATION.search(previous):
                        continue
                    # Bare hh:mm is ambiguous with a media offset or citation.
                    if not raw_period and not zone and not TIME_CUE.search(previous):
                        continue
                    if re.match(r"\s*(?:minutes?|seconds?|mins?|secs?)\b", following, re.I):
                        continue
            key = f"{document_id}:{segment}:{match.start()}:{match.end()}"
            observations.append({
                "id": "time-" + hashlib.sha1(key.encode()).hexdigest()[:16],
                "documentId": document_id, "source": source, "segment": segment,
                "start": match.start(), "end": match.end(), "matchedText": match.group(),
                "minuteOfDial": (hour % 12) * 60 + minute,
                "hour24": hour24, "minute": minute, "second": int(data.get("s") or 0),
                "period": period, "zone": data.get("z") or None, "notation": notation,
                "excerpt": text[max(0, match.start() - 100):min(len(text), match.end() + 160)],
            })
            occupied.append(match.span())
    return sorted(observations, key=lambda item: item["start"])
