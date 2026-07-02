#!/usr/bin/env python3
"""Generate HRR 2026 draw JSON files from official Entries and Draw PDFs."""

from __future__ import annotations

import json
import math
import re
import sys
import unicodedata
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
MANIFEST_PATH = Path(__file__).resolve().parent / "generated-events-manifest.json"

ENTRIES_URL = "https://dftgz7dbeqc0e.cloudfront.net/2026/06/HRR-List-of-Entries-2026.pdf"
DRAW_URL = "https://dftgz7dbeqc0e.cloudfront.net/2026/07/Henley-Royal-Regatta-2026-07-02-120x170_Draw.pdf"
DRAW_SOURCE = "Henley Royal Regatta 2026 Draw (2 July 2026)"

SKIP_EXISTING = frozenset({"pe", "pow", "lp", "wyfold", "goblets", "diamond"})
BYE_FORMAT_IDS = frozenset({"lp", "bridge", "town", "queen-mother", "visitors", "princess-royal", "queen-victoria"})

# JRN pre-qualified crew numbers — hints only for manifest seededCrewNumbers, not draw seeding.
JRN_PREQUAL_SEEDS: dict[str, list[int]] = {
    "bridge": [15, 17, 20, 21, 24, 26],
    "thames": [27, 31, 33, 39, 41, 42, 44, 45, 48, 50, 59, 61, 62, 63, 67, 70],
    "wargrave": [76, 79, 87, 89, 93, 94, 95, 102, 103, 104, 109],
    "temple": [
        117, 118, 119, 127, 130, 136, 144, 149, 152, 155, 162, 184, 189, 191, 195, 199, 200, 201,
    ],
    "island": [203, 208, 211, 215, 216, 219, 221, 224, 226, 228, 245, 246, 249, 252],
    "pe": [
        254, 256, 263, 264, 266, 267, 270, 272, 273, 274, 276, 278, 280, 281, 282, 283, 284, 286,
        288, 290, 300,
    ],
    "prince-philip": [
        306, 307, 308, 309, 311, 313, 314, 315, 318, 323, 324, 327, 328, 329, 334, 339,
    ],
    "visitors": [352, 355, 356, 358, 359, 362, 364, 367],
    "wyfold": [
        383, 388, 392, 393, 395, 397, 400, 401, 405, 409, 413, 415, 416, 420,
    ],
    "pow": [434, 436, 443, 444, 446, 448, 450, 457],
    "princess-of-wales": [462, 463, 464, 465, 471],
    "danesfield": [481, 485, 486, 489, 491, 500, 501, 502],
    "queen-victoria": [512, 514, 516, 526, 527, 531],
    "fawley": [
        538, 541, 546, 552, 553, 556, 565, 570, 579, 582, 586, 591, 597, 598, 600,
    ],
    "diamond-jubilee": [
        609, 612, 615, 617, 629, 630, 632, 637, 641, 643, 644, 645, 648, 653, 655, 659,
    ],
    "britannia": [677, 679, 682, 683, 688, 693],
    "prince-albert": [704, 709, 716, 717, 721, 724, 727, 728, 730, 736, 744],
    "goblets": [749, 751, 753, 759, 761],
    "hambleden-pairs": [765, 767, 769, 770, 772, 774],
    "double-sculls": [777, 780, 781, 782, 783, 784, 787, 789, 790],
    "diamond": [813, 818, 819, 820, 830, 831, 832, 840],
    "princess-royal": [842, 848, 849, 850, 852, 853, 854, 856, 859],
}


@dataclass
class EventMeta:
    id: str
    entries_title: str
    draw_marker: str
    display_name: str
    short_label: str
    trophy_slug: str
    timetable_codes: list[str]
    header_category: str
    category: str
    race_day_preset: str
    format: str = "standard"  # standard | final_only | three_crew | bye | skip
    draw_override: str | None = None  # special extraction key


HRR_2026_EVENTS: list[EventMeta] = [
    EventMeta("grand", "THE GRAND CHALLENGE CUP", "THE GRAND CHALLENGE CUP", "Grand Challenge Cup", "Grand", "the-grand-challenge-cup", ["Grand"], "Premier men's eights", "premier-mens-eights", "pow", "final_only", "grand"),
    EventMeta("remenham", "THE REMENHAM CHALLENGE CUP", "THE REMENHAM CHALLENGE CUP", "Remenham Challenge Cup", "Remenham", "the-remenham-challenge-cup", ["Remenham"], "Premier women's eights", "premier-womens-eights", "pow", "final_only", "remenham"),
    EventMeta("lp", "THE LADIES\u2019 CHALLENGE PLATE", "THE LADIES", "Ladies' Challenge Plate", "Ladies", "the-ladies-challenge-plate", ["Ladies'"], "Intermediate men's eights", "intermediate-mens-eights", "lp", "bye"),
    EventMeta("bridge", "THE BRIDGE CHALLENGE PLATE", "THE BRIDGE CHALLENGE PLATE", "Bridge Challenge Plate", "Bridge", "the-bridge-challenge-plate", ["Bridge"], "Intermediate women's eights", "intermediate-womens-eights", "pow", "bye"),
    EventMeta("thames", "THE THAMES CHALLENGE CUP", "THE THAMES CHALLENGE CUP", "Thames Challenge Cup", "Thames", "the-thames-challenge-cup", ["Thames"], "Club men's eights", "club-mens-eights", "pe"),
    EventMeta("wargrave", "THE WARGRA VE CHALLENGE CUP", "THE W ARGRAVE CHALLENGE CUP", "Wargrave Challenge Cup", "Wargrave", "the-wargrave-challenge-cup", ["Wargrave"], "Club women's eights", "club-womens-eights", "pe", "standard", "wargrave"),
    EventMeta("temple", "THE TEMPLE CHALLENGE CUP", "THE TEMPLE CHALLENGE CUP", "Temple Challenge Cup", "Temple", "the-temple-challenge-cup", ["Temple"], "Student men's eights", "student-mens-eights", "pe"),
    EventMeta("island", "THE ISLAND CHALLENGE CUP", "THE ISLAND CHALLENGE CUP", "Island Challenge Cup", "Island", "the-island-challenge-cup", ["Island"], "Student women's eights", "student-womens-eights", "pe"),
    EventMeta("pe", "THE PRINCESS ELIZABETH CHALLENGE CUP", "THE PRINCESS ELIZABETH CHALLENGE CUP", "Princess Elizabeth Challenge Cup", "PE", "the-princess-elizabeth-challenge-cup", ["PE", "P Elizabeth"], "Junior men's eights", "junior-mens-eights", "pe", "skip"),
    EventMeta("prince-philip", "THE PRINCE PHILIP CHALLENGE TROPHY", "THE PRINCE PHILIP CHALLENGE TROPHY", "Prince Philip Challenge Trophy", "P Philip", "the-prince-philip-challenge-trophy", ["P Philip"], "Junior women's eights", "junior-womens-eights", "pe", "standard", "prince-philip"),
    EventMeta("stewards", "THE STEWARDS\u2019 CHALLENGE CUP", "THE STEW ARDS", "Stewards' Challenge Cup", "Stewards", "the-stewards-challenge-cup", ["Stewards"], "Premier men's coxless fours", "premier-mens-coxless-fours", "pow", "three_crew", "stewards"),
    EventMeta("town", "THE TOWN CHALLENGE CUP", "THE TOWN CHALLENGE CUP", "Town Challenge Cup", "Town", "the-town-challenge-cup", ["Town"], "Premier women's coxless fours", "premier-womens-coxless-fours", "pow", "bye"),
    EventMeta("visitors", "THE VISITORS\u2019 CHALLENGE CUP", "THE VISITORS", "Visitors' Challenge Cup", "Visitors", "the-visitors-challenge-cup", ["Visitors'"], "Intermediate men's coxless fours", "intermediate-mens-coxless-fours", "pow", "bye"),
    EventMeta("wyfold", "THE WYFOLD CHALLENGE CUP", "THE WYFOLD CHALLENGE CUP", "Wyfold Challenge Cup", "Wyfold", "the-wyfold-challenge-cup", ["Wyfold"], "Club coxless fours", "club-coxless-fours", "pe", "skip"),
    EventMeta("queen-mother", "THE QUEEN MOTHER CHALLENGE CUP", "THE QUEEN MOTHER CHALLENGE CUP", "Queen Mother Challenge Cup", "Q Mother", "the-queen-mother-challenge-cup", ["Q Mother"], "Premier men's quadruple sculls", "premier-mens-quads", "pow", "bye"),
    EventMeta("princess-grace", "THE PRINCESS GRACE CHALLENGE CUP", "THE PRINCESS GRACE CHALLENGE CUP", "Princess Grace Challenge Cup", "P Grace", "the-princess-grace-challenge-cup", ["P Grace"], "Premier women's quadruple sculls", "premier-womens-quads", "pow", "final_only"),
    EventMeta("pow", "THE PRINCE OF WALES CHALLENGE CUP", "THE PRINCE OF W ALES CHALLENGE CUP", "Prince of Wales Challenge Cup", "POW", "the-prince-of-wales-challenge-cup", ["Pr Wales"], "Intermediate men's quadruple sculls", "intermediate-mens-quads", "pow", "skip"),
    EventMeta("princess-of-wales", "THE PRINCESS OF WALES CHALLENGE TROPHY", "THE PRINCESS OF W ALES CHALLENGE TROPHY", "Princess of Wales Challenge Trophy", "P Wales", "the-princess-of-wales-challenge-trophy", ["P Wales"], "Intermediate women's quadruple sculls", "intermediate-womens-quads", "pow"),
    EventMeta("danesfield", "THE DANESFIELD CHALLENGE CUP", "THE DANESFIELD CHALLENGE CUP", "Danesfield Challenge Cup", "Danesfield", "the-danesfield-challenge-cup", ["Danesfield"], "Club women's quadruple sculls", "club-womens-quads", "pow", "standard", "danesfield"),
    EventMeta("queen-victoria", "THE QUEEN VICTORIA CHALLENGE CUP", "THE QUEEN VICTORIA CHALLENGE CUP", "Queen Victoria Challenge Cup", "Q Victoria", "the-queen-victoria-challenge-cup", ["Q Victoria"], "Student women's quadruple sculls", "student-womens-quads", "pow", "bye"),
    EventMeta("fawley", "THE FAWLEY CHALLENGE CUP", "THE FAWLEY CHALLENGE CUP", "Fawley Challenge Cup", "Fawley", "the-fawley-challenge-cup", ["Fawley"], "Junior men's quadruple sculls", "junior-mens-quads", "pe", "standard", "fawley"),
    EventMeta("diamond-jubilee", "THE DIAMOND JUBILEE CHALLENGE CUP", "THE DIAMOND JUBILEE CHALLENGE CUP", "Diamond Jubilee Challenge Cup", "D Jubilee", "the-diamond-jubilee-challenge-cup", ["D Jubilee"], "Junior women's quadruple sculls", "junior-womens-quads", "pe"),
    EventMeta("britannia", "THE BRITANNIA CHALLENGE CUP", "THE BRITANNIA CHALLENGE CUP", "Britannia Challenge Cup", "Britannia", "the-britannia-challenge-cup", ["Britannia"], "Club coxed fours", "club-coxed-fours", "pe", "standard", "britannia"),
    EventMeta("prince-albert", "THE PRINCE ALBERT CHALLENGE CUP", "THE PRINCE ALBERT CHALLENGE CUP", "Prince Albert Challenge Cup", "P Albert", "the-prince-albert-challenge-cup", ["P Albert"], "Student men's coxed fours", "student-mens-coxed-fours", "pe"),
    EventMeta("goblets", "THE SILVER GOBLETS & NICKALLS\u2019 CHALLENGE CUP", "THE SILVER GOBLETS", "Silver Goblets & Nickalls' Challenge Cup", "Goblets", "the-silver-goblets-and-nickalls-challenge-cup", ["Goblets"], "Premier men's coxless pairs", "premier-mens-coxless-pairs", "goblets", "skip"),
    EventMeta("hambleden-pairs", "THE HAMBLEDEN PAIRS CHALLENGE CUP", "THE HAMBLEDEN PAIRS CHALLENGE CUP", "Hambleden Pairs Challenge Cup", "Hambleden", "the-hambleden-pairs-challenge-cup", ["Hambleden"], "Premier women's coxless pairs", "premier-womens-coxless-pairs", "goblets"),
    EventMeta("double-sculls", "THE DOUBLE SCULLS CHALLENGE CUP", "THE DOUBLE SCULLS CHALLENGE CUP", "Double Sculls Challenge Cup", "Doubles", "the-double-sculls-challenge-cup", ["Doubles"], "Premier men's double sculls", "premier-mens-doubles", "goblets"),
    EventMeta("stonor", "THE STONOR CHALLENGE TROPHY", "THE STONOR CHALLENGE TROPHY", "Stonor Challenge Trophy", "Stonor", "the-stonor-challenge-trophy", ["Stonor"], "Premier women's double sculls", "premier-womens-doubles", "goblets"),
    EventMeta("diamond", "THE DIAMOND CHALLENGE SCULLS", "THE DIAMOND CHALLENGE SCULLS", "Diamond Challenge Sculls", "Diamond", "the-diamond-challenge-sculls", ["Diamonds", "D Sculls"], "Premier men's single sculls", "premier-mens-sculls", "pow", "skip"),
    EventMeta("princess-royal", "THE PRINCESS ROYAL CHALLENGE CUP", "THE PRINCESS ROYAL CHALLENGE CUP", "Princess Royal Challenge Cup", "P Royal", "the-princess-royal-challenge-cup", ["P Royal"], "Premier women's single sculls", "premier-womens-sculls", "goblets", "bye"),
]


def download_pdf(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)


def pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def normalize_apostrophes(text: str) -> str:
    return text.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")


def normalize_name_key(name: str) -> str:
    name = normalize_apostrophes(name).lower()
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^\w\s&']", " ", name)
    name = re.sub(r"\s*&\s*", " and ", name)
    name = re.sub(r"\buniv\b", "university", name)
    name = re.sub(r"\b(r\.?c\.?|b\.?c\.?)\b", "rowing club", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def clean_draw_line(raw: str) -> str:
    line = normalize_apostrophes(raw.strip())
    line = re.sub(r"^T\s+eam\b", "Team", line)
    line = re.sub(r"^T\s+r", "Tr", line)
    line = re.sub(r"[\s\.]+$", "", line)
    line = re.sub(r"\s+", " ", line).strip()
    return line


def is_dot_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    non_dot = re.sub(r"[\s\.]", "", stripped)
    return len(non_dot) == 0


def is_crew_line(line: str) -> bool:
    line = clean_draw_line(line)
    if not line or len(line) < 2:
        return False
    if line.upper().startswith("THE DRAW"):
        return False
    if "continued" in line.lower():
        return False
    if is_dot_line(line):
        return False
    return True


def parse_entries(text: str) -> dict[str, list[tuple[int, str]]]:
    text = normalize_apostrophes(text)
    events: dict[str, list[tuple[int, str]]] = {}
    current_title: str | None = None
    current_crews: list[tuple[int, str]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("THE ") and (
            "CHALLENGE" in line or "SCULLS" in line or "PLATE" in line or "TROPHY" in line
        ):
            if "(continued" not in line.lower() and "(Holders" not in line:
                if current_title and current_crews:
                    events[current_title] = current_crews
                current_title = re.sub(r"\s+", " ", line)
                current_crews = []
            continue
        m = re.match(r"^(\d+)\s+(.+)$", line)
        if m and current_title:
            num = int(m.group(1))
            name = re.sub(r"\s+", " ", m.group(2)).strip()
            current_crews.append((num, name))
            continue
        tab_m = re.match(r"^(\d+)\t+(.+)$", line)
        if tab_m and current_title:
            num = int(tab_m.group(1))
            name = re.sub(r"\s+", " ", tab_m.group(2)).strip()
            current_crews.append((num, name))

    if current_title and current_crews:
        events[current_title] = current_crews

    merged: dict[str, list[tuple[int, str]]] = {}
    for title, crews in events.items():
        base = re.sub(r"\s*\(continued.*$", "", title, flags=re.I).strip()
        merged.setdefault(base, []).extend(crews)
    return merged


def split_draw_sections(draw_text: str) -> list[tuple[str, str]]:
    draw_text = normalize_apostrophes(draw_text)
    pattern = re.compile(
        r"(THE\s+(?:GRAND|REMENHAM|LADIES|BRIDGE|THAMES|WARGR?\s*A?\s*VE|TEMPLE|ISLAND|"
        r"PRINCESS\s+ELIZABETH|PRINCE\s+PHILIP|STEW\s*ARDS|TOWN|VISITORS|WYFOLD|"
        r"QUEEN\s+MOTHER|PRINCESS\s+GRACE|PRINCE\s+OF\s+W\s*ALES|PRINCESS\s+OF\s+W\s*ALES|"
        r"DANESFIELD|QUEEN\s+VICTORIA|FAWLEY|DIAMOND\s+JUBILEE|BRITANNIA|PRINCE\s+ALBERT|"
        r"SILVER\s+GOBLETS|HAMBLEDEN\s+PAIRS|DOUBLE\s+SCULLS|STONOR|DIAMOND\s+CHALLENGE|"
        r"PRINCESS\s+ROYAL)[^\n]*(?:CUP|SCULLS|PLATE|TROPHY))",
        re.I,
    )
    matches = list(pattern.finditer(draw_text))
    sections: list[tuple[str, str]] = []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(draw_text)
        sections.append((match.group(1).upper(), draw_text[start:end]))
    return sections


def extract_crew_lines(section_body: str, stop_at_repeat: bool = True) -> list[str]:
    crews: list[str] = []
    seen: set[str] = set()
    started = False
    for raw in section_body.splitlines():
        if not is_crew_line(raw):
            if started and is_dot_line(raw):
                break
            continue
        name = clean_draw_line(raw)
        key = normalize_name_key(name)
        if stop_at_repeat and key in seen:
            break
        seen.add(key)
        crews.append(name)
        started = True
    return crews


def extract_r1_pairings(crew_lines: list[str]) -> list[tuple[str, str]]:
    if len(crew_lines) % 2 != 0:
        raise ValueError(f"Odd crew line count ({len(crew_lines)}) — likely bye format")
    return [(crew_lines[i], crew_lines[i + 1]) for i in range(0, len(crew_lines), 2)]


def title_case_event(entries_title: str) -> str:
    title = entries_title.strip()
    if title.upper().startswith("THE "):
        title = "The " + title[4:]
    words = title.split()
    small = {"and", "of", "the", "&"}
    cased = []
    for i, word in enumerate(words):
        if i > 0 and word.lower() in small:
            cased.append(word.lower())
        elif word.lower() == "cup":
            cased.append("Cup")
        elif word.lower() == "sculls":
            cased.append("Sculls")
        elif word.lower() == "plate":
            cased.append("Plate")
        elif word.lower() == "trophy":
            cased.append("Trophy")
        else:
            cased.append(word[:1].upper() + word[1:].lower() if word.isupper() else word)
    return " ".join(cased)


def match_crew(draw_name: str, entries: list[tuple[int, str]]) -> tuple[int | None, str, str]:
    draw_key = normalize_name_key(draw_name)
    best: tuple[int, str] | None = None
    best_score = 0
    for num, full in entries:
        full_key = normalize_name_key(full)
        score = 0
        if draw_key == full_key:
            score = 100
        elif draw_key in full_key or full_key in draw_key:
            score = 80
        else:
            draw_tokens = set(draw_key.split())
            full_tokens = set(full_key.split())
            overlap = len(draw_tokens & full_tokens)
            if overlap >= 2:
                score = 50 + overlap
            elif draw_tokens and draw_tokens <= full_tokens:
                score = 45 + len(draw_tokens)
        if score > best_score:
            best_score = score
            best = (num, full)
    if best and best_score >= 45:
        return best[0], best[1], draw_name
    return None, draw_name, draw_name


def make_short_name(draw_name: str, full_name: str | None = None) -> str:
    name = draw_name
    name = re.sub(r"\s+", " ", name).strip()
    if len(name) <= 42:
        return name
    if full_name and len(full_name) <= 42:
        return full_name
    return name[:39] + "..."


def crew_obj(draw_name: str, entries: list[tuple[int, str]]) -> dict[str, Any]:
    number, full_name, short = match_crew(draw_name, entries)
    return {
        "name": full_name,
        "shortName": make_short_name(short, full_name),
        **({"number": number} if number is not None else {}),
    }


def round_prefixes(crew_count: int) -> list[str]:
    k = int(math.log2(crew_count))
    if crew_count == 32:
        return ["r1", "r2", "qf", "sf", "final"]
    if crew_count == 16:
        return ["r1", "qf", "sf", "final"]
    if crew_count == 8:
        return ["qf", "sf", "final"]
    if crew_count == 4:
        return ["sf", "final"]
    if crew_count == 2:
        return ["final"]
    raise ValueError(f"Unsupported crew count {crew_count}")


def round_sizes(crew_count: int) -> list[int]:
    k = int(math.log2(crew_count))
    return [crew_count // (2 ** (i + 1)) for i in range(k)]


def build_standard_bracket(
    pairings: list[tuple[str, str]], entries: list[tuple[int, str]]
) -> list[list[dict[str, Any]]]:
    crew_count = len(pairings) * 2
    prefixes = round_prefixes(crew_count)
    rounds: list[list[dict[str, Any]]] = []

    r0: list[dict[str, Any]] = []
    p0 = prefixes[0]
    for idx, (berks_name, bucks_name) in enumerate(pairings):
        r0.append(
            {
                "id": f"{p0}-{idx}",
                "drawRace": idx + 1,
                "berks": crew_obj(berks_name, entries),
                "bucks": crew_obj(bucks_name, entries),
            }
        )
    rounds.append(r0)

    prev_ids = [m["id"] for m in r0]
    for round_index in range(1, len(prefixes)):
        prefix = prefixes[round_index]
        match_count = len(prev_ids) // 2
        round_matches: list[dict[str, Any]] = []
        next_ids: list[str] = []
        for idx in range(match_count):
            match_id = f"{prefix}-{idx}"
            round_matches.append(
                {
                    "id": match_id,
                    "drawRace": idx + 1,
                    "feeders": [prev_ids[idx * 2], prev_ids[idx * 2 + 1]],
                    "berks": None,
                    "bucks": None,
                }
            )
            next_ids.append(match_id)
        rounds.append(round_matches)
        prev_ids = next_ids

    return rounds


def build_final_only(crews: list[str], entries: list[tuple[int, str]]) -> list[list[dict[str, Any]]]:
    if len(crews) != 2:
        raise ValueError(f"final_only expects 2 crews, got {len(crews)}")
    return [
        [
            {
                "id": "final-0",
                "drawRace": 1,
                "berks": crew_obj(crews[0], entries),
                "bucks": crew_obj(crews[1], entries),
            }
        ]
    ]


def build_three_crew_bracket(crews: list[str], entries: list[tuple[int, str]]) -> list[list[dict[str, Any]]]:
    if len(crews) != 3:
        raise ValueError(f"three_crew expects 3 crews, got {len(crews)}")
    return [
        [
            {
                "id": "sf-0",
                "drawRace": 1,
                "berks": crew_obj(crews[0], entries),
                "bucks": crew_obj(crews[1], entries),
            }
        ],
        [
            {
                "id": "final-0",
                "drawRace": 1,
                "feeders": ["sf-0"],
                "berks": crew_obj(crews[2], entries),
                "bucks": None,
            }
        ],
    ]


def special_draw_crews(draw_text: str, key: str) -> list[str]:
  draw_text = normalize_apostrophes(draw_text)
  if key == "grand":
      m = re.search(r"THE GRAND CHALLENGE CUP\s*(.*?)(?:\.{5,}|\n\s*\.{3,})", draw_text, re.S | re.I)
      block = m.group(1) if m else ""
      lines = [clean_draw_line(x) for x in block.splitlines() if is_crew_line(x)]
      return lines[:2]
  if key == "remenham":
      m = re.search(
          r"Oxford Brookes Univ[^\n]*\n\s*\.[^\n]*\n((?:[^\n]+\n){1,4})THE REMENHAM",
          draw_text,
          re.I,
      )
      block = m.group(1) if m else ""
      lines = [clean_draw_line(x) for x in block.splitlines() if is_crew_line(x)]
      return lines[:2]
  if key == "stewards":
      m = re.search(r"THE STEW\s*ARDS[^\n]*\s*(.*?)(?:\.{5,}|\n\s*\.{3,})", draw_text, re.S | re.I)
      block = m.group(1) if m else ""
      lines = [clean_draw_line(x) for x in block.splitlines() if is_crew_line(x)]
      return lines[:3]
  if key == "danesfield":
      idx = draw_text.upper().find("THE DANESFIELD CHALLENGE CUP")
      if idx < 0:
          return []
      chunk = draw_text[max(0, idx - 3000) : idx]
      # Danesfield crews sit in the block immediately above the header (after Britannia).
      m = re.search(
          r"Cantabrigian R\s*\.C\s*\.(.*)$",
          chunk,
          re.S | re.I,
      )
      block = "Cantabrigian R.C." + (m.group(1) if m else "")
      return extract_crew_lines(block)
  if key == "wargrave":
      m = re.search(
          r"THE W\s*ARGRAVE CHALLENGE CUP\s*(.*?)(?:THE WYFOLD CHALLENGE CUP|THE W\s*YFOLD)",
          draw_text,
          re.S | re.I,
      )
      block = m.group(1) if m else ""
      lines = extract_crew_lines(block)
      if len(lines) > 32:
          lines = lines[:32]
      return lines
  if key == "britannia":
      m = re.search(
          r"THE BRITANNIA CHALLENGE CUP\s*(.*?)(?:Cantabrigian R\s*\.C\s*\.|THE DANESFIELD)",
          draw_text,
          re.S | re.I,
      )
      block = m.group(1) if m else ""
      return extract_crew_lines(block)
  if key == "fawley":
      m = re.search(
          r"King's Sch\s*\.,\s*Worcester(.*?)THE PRINCESS ELIZABETH CHALLENGE CUP",
          draw_text,
          re.S | re.I,
      )
      block = ("King's Sch., Worcester" + m.group(1)) if m else ""
      lines = extract_crew_lines(block)
      if len(lines) > 32:
          lines = lines[:32]
      return lines
  if key == "prince-philip":
      m = re.search(
          r"THE PRINCE PHILIP CHALLENGE TROPHY\s*(.*?)(?:\.{5,}|\n\s*\.{3,})",
          draw_text,
          re.S | re.I,
      )
      block = m.group(1) if m else ""
      lines = extract_crew_lines(block, stop_at_repeat=True)
      if len(lines) >= 32:
          return lines[:32]
      return lines
  raise KeyError(key)


def find_section_lines(sections: list[tuple[str, str]], marker: str) -> list[str]:
    marker_u = marker.upper()
    for header, body in sections:
        header_compact = re.sub(r"\s+", " ", header)
        if marker_u in header_compact:
            return extract_crew_lines(body)
    return []


def is_power_of_two(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0


@dataclass
class GenerationResult:
    event_id: str
    status: str
    output_path: str | None = None
    message: str | None = None
    crew_count: int | None = None
    round_sizes: list[int] = field(default_factory=list)


def generate_event(
    meta: EventMeta,
    entries_map: dict[str, list[tuple[int, str]]],
    draw_text: str,
    draw_sections: list[tuple[str, str]],
) -> GenerationResult:
    if meta.id in SKIP_EXISTING:
        return GenerationResult(meta.id, "skipped", message="existing manual draw JSON")

    if meta.format == "bye" or meta.id in BYE_FORMAT_IDS:
        return GenerationResult(
            meta.id,
            "manual_required",
            message="Bye / non-standard draw format — build draw JSON manually from steward chart",
        )

    if meta.format == "skip":
        return GenerationResult(meta.id, "skipped", message="marked skip in metadata")

    entries = entries_map.get(meta.entries_title)
    if not entries:
        # try fuzzy title match
        for title, crews in entries_map.items():
            if normalize_name_key(meta.entries_title) in normalize_name_key(title):
                entries = crews
                break
    if not entries:
        return GenerationResult(meta.id, "failed", message=f"No entries found for {meta.entries_title}")

    try:
        if meta.draw_override:
            crew_lines = special_draw_crews(draw_text, meta.draw_override)
        else:
            crew_lines = find_section_lines(draw_sections, meta.draw_marker)

        if meta.format == "final_only":
            rounds = build_final_only(crew_lines[:2], entries)
            crew_count = 2
        elif meta.format == "three_crew":
            rounds = build_three_crew_bracket(crew_lines[:3], entries)
            crew_count = 3
        else:
            if not crew_lines:
                return GenerationResult(meta.id, "failed", message="No crew lines parsed from draw PDF")
            if not is_power_of_two(len(crew_lines)):
                return GenerationResult(
                    meta.id,
                    "manual_required",
                    message=f"Draw has {len(crew_lines)} crews (not power of 2) — likely bye format",
                )
            pairings = extract_r1_pairings(crew_lines)
            rounds = build_standard_bracket(pairings, entries)
            crew_count = len(crew_lines)

        unmatched = sum(
            1
            for rnd in rounds
            for match in rnd
            for side in ("berks", "bucks")
            if match.get(side) and match[side].get("number") is None
        )

        draw_data = {
            "event": title_case_event(meta.entries_title),
            "year": 2026,
            "source": DRAW_SOURCE,
            "sourceUrl": DRAW_URL,
            "rounds": rounds,
        }

        out_path = DATA_DIR / f"{meta.id}-2026-draw.json"
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(draw_data, f, indent=2, ensure_ascii=False)
            f.write("\n")

        sizes = round_sizes(crew_count) if crew_count and crew_count >= 2 and is_power_of_two(crew_count) else [
            len(r) for r in rounds
        ]
        msg = None
        if unmatched:
            msg = f"{unmatched} crew slot(s) could not be matched to entry numbers"

        return GenerationResult(
            meta.id,
            "success",
            output_path=str(out_path.relative_to(ROOT)),
            message=msg,
            crew_count=crew_count,
            round_sizes=sizes,
        )
    except Exception as exc:  # noqa: BLE001
        return GenerationResult(meta.id, "failed", message=str(exc))


def build_manifest(results: list[GenerationResult]) -> dict[str, Any]:
    events_meta = []
    for meta in HRR_2026_EVENTS:
        result = next((r for r in results if r.event_id == meta.id), None)
        entry = {
            "id": meta.id,
            "shortLabel": meta.short_label,
            "displayName": meta.display_name,
            "trophySlug": meta.trophy_slug,
            "timetableCodes": meta.timetable_codes,
            "headerCategory": meta.header_category,
            "raceDayPreset": meta.race_day_preset,
            "category": meta.category,
            "entriesTitle": meta.entries_title,
            "format": meta.format,
            "seededCrewNumbersHint": JRN_PREQUAL_SEEDS.get(meta.id, []),
            "generation": {
                "status": result.status if result else "not_run",
                "outputPath": result.output_path if result else None,
                "message": result.message if result else None,
                "crewCount": result.crew_count if result else None,
                "roundSizes": result.round_sizes if result else [],
            },
        }
        if meta.id in BYE_FORMAT_IDS or meta.format == "bye":
            entry["manualNote"] = (
                "Non-standard bye draw — transcribe steward chart manually (see lp-2026-draw.json pattern)"
            )
        events_meta.append(entry)

    return {
        "year": 2026,
        "entriesUrl": ENTRIES_URL,
        "drawUrl": DRAW_URL,
        "generatedAt": DRAW_SOURCE,
        "summary": {
            "totalEvents": len(HRR_2026_EVENTS),
            "success": sum(1 for r in results if r.status == "success"),
            "failed": sum(1 for r in results if r.status == "failed"),
            "skipped": sum(1 for r in results if r.status == "skipped"),
            "manualRequired": sum(1 for r in results if r.status == "manual_required"),
        },
        "events": events_meta,
        "results": [
            {
                "eventId": r.event_id,
                "status": r.status,
                "outputPath": r.output_path,
                "message": r.message,
                "crewCount": r.crew_count,
                "roundSizes": r.round_sizes,
            }
            for r in results
        ],
    }


def main() -> int:
    cache_dir = Path("/tmp/hrr-2026-pdfs")
    entries_path = cache_dir / "entries.pdf"
    draw_path = cache_dir / "draw.pdf"

    print("Downloading PDFs...")
    download_pdf(ENTRIES_URL, entries_path)
    download_pdf(DRAW_URL, draw_path)

    entries_text = pdf_text(entries_path)
    draw_text = pdf_text(draw_path)
    entries_map = parse_entries(entries_text)
    draw_sections = split_draw_sections(draw_text)

    print(f"Parsed {len(entries_map)} entry lists, {len(draw_sections)} draw sections")

    results: list[GenerationResult] = []
    for meta in HRR_2026_EVENTS:
        result = generate_event(meta, entries_map, draw_text, draw_sections)
        results.append(result)
        status_symbol = {
            "success": "✓",
            "failed": "✗",
            "skipped": "-",
            "manual_required": "!",
        }.get(result.status, "?")
        extra = f" → {result.output_path}" if result.output_path else ""
        msg = f" ({result.message})" if result.message else ""
        print(f"  [{status_symbol}] {meta.id}: {result.status}{extra}{msg}")

    manifest = build_manifest(results)
    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\nManifest written to {MANIFEST_PATH.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
