#!/usr/bin/env python3
"""Rebuild a knockout draw's first round from published HRR results."""

from __future__ import annotations

import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
ENTRIES_URL = "https://dftgz7dbeqc0e.cloudfront.net/2026/06/HRR-List-of-Entries-2026.pdf"
HRR_API = "https://www.hrr.co.uk/wp-json/hrr/v1/results"


def normalize_apostrophes(text: str) -> str:
    return text.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")


def normalize_name_key(name: str) -> str:
    name = normalize_apostrophes(name).lower()
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"\s*\.\s*", ".", name)
    name = re.sub(r"[^\w\s&']", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def fetch_results(trophy_slug: str, year: int = 2026) -> list[dict]:
    results: list[dict] = []
    page = 1
    last_page = 1
    while page <= last_page:
        params = urllib.parse.urlencode(
            {
                "trophy": trophy_slug,
                "race-year": str(year),
                "result-page": str(page),
            }
        )
        with urllib.request.urlopen(f"{HRR_API}?{params}") as response:
            data = json.loads(response.read())
        results.extend(data.get("results", []))
        last_page = data.get("pagination", {}).get("lastPage", 1)
        page += 1
    return sorted(results, key=lambda r: r.get("raceDateTime", ""))


def parse_entries(text: str) -> dict[str, list[tuple[int, str]]]:
    events: dict[str, list[tuple[int, str]]] = {}
    current: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("THE ") and "CHALLENGE" in line.upper():
            current = line
            events[current] = []
            continue
        m = re.match(r"^(\d+)\s+(.+)$", line)
        if m and current:
            events[current].append((int(m.group(1)), m.group(2).strip()))
    return events


def match_entry(name: str, entries: list[tuple[int, str]]) -> tuple[int | None, str]:
    key = normalize_name_key(name)
    best_num: int | None = None
    best_name = name
    best = 0
    for num, full in entries:
        full_key = normalize_name_key(full)
        score = 0
        if key == full_key:
            score = 100
        elif key in full_key or full_key in key:
            score = 80
        else:
            overlap = len(set(key.split()) & set(full_key.split()))
            if overlap >= 2:
                score = 50 + overlap
        if score > best:
            best = score
            best_num = num
            best_name = full
    return best_num, best_name


def crew_from_result(result: dict, side: str, entries: list[tuple[int, str]]) -> dict:
    payload = result[side]
    number, full_name = match_entry(payload["name"], entries)
    obj = {
        "name": full_name,
        "shortName": payload.get("shortName") or full_name,
    }
    if number is not None:
        obj["number"] = number
    return obj


def station_crews(result: dict, entries: list[tuple[int, str]]) -> tuple[dict, dict]:
    winner_on_berks = "berks" in result.get("station", "").lower()
    if winner_on_berks:
        berks = crew_from_result(result, "winner", entries)
        bucks = crew_from_result(result, "loser", entries)
    else:
        berks = crew_from_result(result, "loser", entries)
        bucks = crew_from_result(result, "winner", entries)
    return berks, bucks


def round_prefixes(crew_count: int) -> list[str]:
    if crew_count == 32:
        return ["r1", "r2", "qf", "sf", "final"]
    if crew_count == 16:
        return ["r1", "qf", "sf", "final"]
    if crew_count == 8:
        return ["qf", "sf", "final"]
    raise ValueError(f"Unsupported crew count {crew_count}")


def build_rounds_from_r1(r1_matches: list[dict]) -> list[list[dict]]:
    crew_count = len(r1_matches) * 2
    prefixes = round_prefixes(crew_count)
    rounds: list[list[dict]] = [r1_matches]
    prev = r1_matches
    for prefix in prefixes[1:]:
        nxt: list[dict] = []
        for idx in range(0, len(prev), 2):
            feeders = [prev[idx]["id"]]
            if idx + 1 < len(prev):
                feeders.append(prev[idx + 1]["id"])
            nxt.append(
                {
                    "id": f"{prefix}-{idx // 2}",
                    "drawRace": idx // 2 + 1,
                    "feeders": feeders,
                    "berks": None,
                    "bucks": None,
                }
            )
        rounds.append(nxt)
        prev = nxt
    return rounds


def rebuild(event_id: str, trophy_slug: str, entries_title: str, display_event: str) -> None:
    from pypdf import PdfReader

    entries_path = Path("/tmp/hrr-entries-2026.pdf")
    if not entries_path.exists():
        urllib.request.urlretrieve(ENTRIES_URL, entries_path)
    entries_text = "\n".join(p.extract_text() or "" for p in PdfReader(entries_path).pages)
    entries_map = parse_entries(entries_text)
    entries = entries_map.get(entries_title)
    if not entries:
        raise SystemExit(f"No entries found for {entries_title}")

    results = fetch_results(trophy_slug)
    if not results:
        raise SystemExit(f"No HRR results found for {event_id}")

    if not math.log2(len(results) * 2).is_integer():
        raise SystemExit(
            f"Expected power-of-two first round for {event_id}, got {len(results)} results"
        )

    r1 = []
    for idx, result in enumerate(results):
        berks, bucks = station_crews(result, entries)
        r1.append(
            {
                "id": f"r1-{idx}",
                "drawRace": idx + 1,
                "berks": berks,
                "bucks": bucks,
            }
        )

    draw = {
        "event": display_event,
        "year": 2026,
        "source": "Henley Royal Regatta 2026 Draw (rebuilt from HRR results)",
        "sourceUrl": "https://www.hrr.co.uk/wp-json/hrr/v1/results",
        "rounds": build_rounds_from_r1(r1),
    }

    out = DATA_DIR / f"{event_id}-2026-draw.json"
    out.write_text(json.dumps(draw, indent=2, ensure_ascii=False) + "\n")
    print(f"Rebuilt {event_id} with {len(results)} first-round races -> {out}")


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: rebuild-r1-from-hrr-results.py <event-id>")
        return 1

    event_id = sys.argv[1]
    mapping = {
        "wargrave": (
            "the-wargrave-challenge-cup",
            "THE WARGRA VE CHALLENGE CUP",
            "The Wargrave Challenge Cup",
        ),
    }
    if event_id not in mapping:
        raise SystemExit(f"Unsupported event {event_id}")
    slug, entries_title, display = mapping[event_id]
    rebuild(event_id, slug, entries_title, display)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
