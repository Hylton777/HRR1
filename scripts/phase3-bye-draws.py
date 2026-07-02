#!/usr/bin/env python3
"""Phase 3: bye-format draw repairs for remaining events with unmatched results."""

from __future__ import annotations

import json
import runpy
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
HRR_API = "https://www.hrr.co.uk/wp-json/hrr/v1/results"

gae = runpy.run_path(str(ROOT / "scripts" / "generate-all-events.py"))


def crew(num: int, entries: list[tuple[int, str]], short: str | None = None) -> dict:
    name = next(full for n, full in entries if n == num)
    obj = {"name": name, "shortName": short or name, "number": num}
    return obj


def load_entries(title: str) -> list[tuple[int, str]]:
    cache = Path("/tmp/hrr-2026-pdfs")
    text = gae["pdf_text"](cache / "entries.pdf")
    return gae["parse_entries"](text)[title]


def write_draw(name: str, draw: dict) -> None:
    path = DATA / f"{name}-2026-draw.json"
    path.write_text(json.dumps(draw, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {path.relative_to(ROOT)}")


def fetch_results(trophy_slug: str) -> list[dict]:
    results: list[dict] = []
    page = 1
    while page <= 99:
        params = urllib.parse.urlencode(
            {"trophy": trophy_slug, "race-year": "2026", "result-page": str(page)}
        )
        with urllib.request.urlopen(f"{HRR_API}?{params}") as response:
            data = json.loads(response.read())
        results.extend(data.get("results", []))
        if page >= data.get("pagination", {}).get("lastPage", 1):
            break
        page += 1
    return sorted(results, key=lambda r: r.get("raceDateTime", ""))


def apply_squad_short_name(slot: dict) -> None:
    name = slot.get("name", "")
    for letter in ("A", "B", "C", "D", "E"):
        if f"'{letter}'" in name or f" '{letter}'" in name:
            base = slot.get("shortName", name)
            if f"'{letter}'" not in base:
                slot["shortName"] = f"{base} '{letter}'"
            return


def station_crews(result: dict) -> tuple[dict, dict]:
    winner_on_berks = "berks" in result.get("station", "").lower()
    if winner_on_berks:
        berks = {
            "name": result["winner"]["name"],
            "shortName": result["winner"]["shortName"],
        }
        bucks = {
            "name": result["loser"]["name"],
            "shortName": result["loser"]["shortName"],
        }
    else:
        berks = {
            "name": result["loser"]["name"],
            "shortName": result["loser"]["shortName"],
        }
        bucks = {
            "name": result["winner"]["name"],
            "shortName": result["winner"]["shortName"],
        }
    apply_squad_short_name(berks)
    apply_squad_short_name(bucks)
    return berks, bucks


def build_rounds_from_r1(r1_matches: list[dict]) -> list[list[dict]]:
    prefixes = ["r1", "r2", "qf", "sf", "final"]
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


def repair_fawley() -> None:
    """Tuesday R1 from repair script + Thursday last-16 bye pairings."""
    import subprocess

    subprocess.run(
        ["python3", str(ROOT / "scripts/repair-draw-from-results.py"), "fawley"],
        check=True,
    )
    entries = load_entries("THE FAWLEY CHALLENGE CUP")
    draw = json.loads((DATA / "fawley-2026-draw.json").read_text())

    r2 = [
        {"id": "r2-0", "drawRace": 1, "feeders": ["r1-1"], "berks": None, "bucks": crew(586, entries, "Sir William Borlase's G.S.")},
        {"id": "r2-1", "drawRace": 2, "feeders": ["r1-0"], "berks": None, "bucks": crew(597, entries, "The Windsor Boys' Sch.")},
        {"id": "r2-2", "drawRace": 3, "feeders": ["r1-2"], "berks": None, "bucks": crew(541, entries, "Belen Jesuit Prep. Sch. 'A'")},
        {"id": "r2-3", "drawRace": 4, "feeders": ["r1-3"], "berks": None, "bucks": crew(565, entries, "Leander Club")},
        {"id": "r2-4", "drawRace": 5, "feeders": ["r1-4"], "berks": crew(553, entries, "Hartpury Coll. 'A'"), "bucks": None},
        {"id": "r2-5", "drawRace": 6, "feeders": ["r1-5"], "berks": None, "bucks": crew(570, entries, "Marlow R.C. 'A'")},
        {"id": "r2-6", "drawRace": 7, "feeders": ["r1-6"], "berks": None, "bucks": None},
        {"id": "r2-7", "drawRace": 8, "feeders": ["r1-7"], "berks": None, "bucks": None},
    ]

    qf = draw["rounds"][2]
    sf = draw["rounds"][3]
    final = draw["rounds"][4]
    draw["rounds"] = [draw["rounds"][0], r2, qf, sf, final]
    draw["source"] = "Henley Royal Regatta 2026 Draw (Phase 3: R1 + bye-aware R2)"
    write_draw("fawley", draw)


def repair_diamond_jubilee() -> None:
    entries = load_entries("THE DIAMOND JUBILEE CHALLENGE CUP")
    draw = json.loads((DATA / "diamond-jubilee-2026-draw.json").read_text())

    draw["rounds"][0][3]["berks"] = crew(648, entries, "Sydney R.C., AUS")

    r2 = [
        {"id": "r2-0", "drawRace": 1, "feeders": ["r1-0"], "berks": crew(612, entries, "George Heriot's Sch"), "bucks": crew(629, entries, "Los Gatos R.C., USA")},
        {"id": "r2-1", "drawRace": 2, "feeders": ["r1-1"], "berks": None, "bucks": crew(659, entries, "Wycliffe Coll.")},
        {"id": "r2-2", "drawRace": 3, "feeders": ["r1-2"], "berks": None, "bucks": crew(643, entries, "Shrewsbury Sch.")},
        {"id": "r2-3", "drawRace": 4, "feeders": ["r1-3"], "berks": None, "bucks": crew(653, entries, "Tideway Scullers' Sch. 'A'")},
        {"id": "r2-4", "drawRace": 5, "feeders": ["r1-4"], "berks": crew(632, entries, "Marlow R.C. 'A'"), "bucks": None},
        {"id": "r2-5", "drawRace": 6, "feeders": ["r1-5"], "berks": crew(615, entries, "Hartpury Coll. 'A'"), "bucks": None},
        {"id": "r2-6", "drawRace": 7, "feeders": ["r1-6"], "berks": crew(645, entries, "Sir William Perkins's Sch."), "bucks": None},
    ]

    qf = draw["rounds"][1]
    sf = draw["rounds"][2]
    final = draw["rounds"][3]
    draw["rounds"] = [draw["rounds"][0], r2, qf, sf, final]
    draw["source"] = "Henley Royal Regatta 2026 Draw (Phase 3: bye-aware last-16)"
    write_draw("diamond-jubilee", draw)


def repair_temple() -> None:
    """Rebuild Temple from Wednesday R1 results + standard 32-crew tree."""
    results = fetch_results("the-temple-challenge-cup")
    by_day: dict[str, list[dict]] = defaultdict(list)
    for result in results:
        by_day[result.get("raceDay") or "Unknown"].append(result)

    first_day = sorted(by_day.keys(), key=lambda day: by_day[day][0].get("raceDateTime", ""))[0]
    r1_results = by_day[first_day]

    r1: list[dict] = []
    for idx, result in enumerate(r1_results):
        berks, bucks = station_crews(result)
        for slot in (berks, bucks):
            name = slot.get("name", "")
            if "Nereus 'A'" in name:
                slot["shortName"] = "A.S.R. Nereus 'A'"
            elif "Nereus 'B'" in name:
                slot["shortName"] = "A.S.R. Nereus 'B'"
        r1.append(
            {
                "id": f"r1-{idx}",
                "drawRace": idx + 1,
                "berks": berks,
                "bucks": bucks,
            }
        )

    rounds = build_rounds_from_r1(r1)

    # Nereus A/B internal second-round slot needs distinct squad labels.
    rounds[1][4] = {
        "id": "r2-4",
        "drawRace": 5,
        "feeders": ["r1-8", "r1-9"],
        "berks": {
            "name": "Amsterdamsche Studenten Roeivereeniging Nereus 'A', Netherlands",
            "shortName": "A.S.R. Nereus 'A'",
        },
        "bucks": {
            "name": "Amsterdamsche Studenten Roeivereeniging Nereus 'B', Netherlands",
            "shortName": "A.S.R. Nereus 'B'",
        },
    }

    # Henley draw pairs r1-12 with r1-14 and r1-13 with r1-15 (not adjacent feeders).
    rounds[1][6] = {
        "id": "r2-6",
        "drawRace": 7,
        "feeders": ["r1-12", "r1-14"],
        "berks": None,
        "bucks": None,
    }
    rounds[1][7] = {
        "id": "r2-7",
        "drawRace": 8,
        "feeders": ["r1-13", "r1-15"],
        "berks": None,
        "bucks": None,
    }

    draw = {
        "event": "The Temple Challenge Cup",
        "year": 2026,
        "source": "Henley Royal Regatta 2026 Draw (Phase 3: R1 from results + standard tree)",
        "sourceUrl": "https://www.hrr.co.uk/wp-json/hrr/v1/results",
        "rounds": rounds,
    }
    write_draw("temple", draw)


def main() -> int:
    repair_fawley()
    repair_diamond_jubilee()
    repair_temple()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
