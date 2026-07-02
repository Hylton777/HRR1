#!/usr/bin/env python3
"""Phase 2: repair bye-format knockout draws for events with non-standard progression."""

from __future__ import annotations

import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"

gae = runpy.run_path(str(ROOT / "scripts" / "generate-all-events.py"))


def crew(num: int, entries: list[tuple[int, str]]) -> dict:
    name = next(full for n, full in entries if n == num)
    return {"name": name, "shortName": name, "number": num}


def load_entries(title: str) -> list[tuple[int, str]]:
    cache = Path("/tmp/hrr-2026-pdfs")
    text = gae["pdf_text"](cache / "entries.pdf")
    return gae["parse_entries"](text)[title]


def write_draw(name: str, draw: dict) -> None:
    path = DATA / f"{name}-2026-draw.json"
    path.write_text(json.dumps(draw, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {path.relative_to(ROOT)}")


def repair_wargrave() -> None:
    entries = load_entries("THE WARGRA VE CHALLENGE CUP")
    draw = json.loads((DATA / "wargrave-2026-draw.json").read_text())

    # Wednesday "last 16" pairings: bye/pre-qualified crew + Tuesday R1 winner.
      # Wednesday last-16: bye/pre-qualified crew on one station, Tuesday R1 winner on the other.
    r2_pairings = [
        (102, None, ["r1-0"]),   # Sydney vs Molesey C (feeder)
        (94, None, ["r1-1"]),   # Molesey A vs Lea
        (109, None, ["r1-2"]),   # Tyne vs Thames B
        (89, None, ["r1-3"]),   # London A vs Cambridge
        (None, 103, ["r1-4"]),   # London B vs Thames A
        (None, 87, ["r1-5"]),   # Molesey B vs Leander
        (None, 76, ["r1-6"]),   # Thames C vs Avon
        (None, 93, ["r1-7"]),   # Bristol vs Mercantile
    ]

    r2 = []
    for idx, (berks_num, bucks_num, feeders) in enumerate(r2_pairings):
        match = {
            "id": f"r2-{idx}",
            "drawRace": idx + 1,
            "feeders": feeders,
            "berks": crew(berks_num, entries) if berks_num else None,
            "bucks": crew(bucks_num, entries) if bucks_num else None,
        }
        r2.append(match)

    draw["rounds"][1] = r2
    draw["source"] = (
        "Henley Royal Regatta 2026 Draw (Phase 2: bye-aware last-16 pairings)"
    )
    write_draw("wargrave", draw)


def repair_prince_philip() -> None:
    entries = load_entries("THE PRINCE PHILIP CHALLENGE TROPHY")
    draw = json.loads((DATA / "prince-philip-2026-draw.json").read_text())

    # Eight single-feeder quarter-finals (bye crew vs R1 winner).
    bye_names = [
        (328, "St. Edward's School"),
        (324, "Shiplake College"),
        (334, "The Lady Eleanor Holles School"),
        (306, "Chicago Rowing Foundation, U.S.A."),
        (314, "Headington School"),
        (318, "Latymer Upper School"),
        (323, "RowAmerica Rye, U.S.A."),
        (327, "Sir William Perkins's School"),
    ]

    qf = []
    for idx, (num, _) in enumerate(bye_names):
        qf.append(
            {
                "id": f"qf-{idx}",
                "drawRace": idx + 1,
                "feeders": [f"r1-{idx}"],
                "berks": crew(num, entries),
                "bucks": None,
            }
        )

    # Rebuild SF/Final for 8 QF winners.
    sf = [
        {"id": "sf-0", "drawRace": 1, "feeders": ["qf-0", "qf-1"], "berks": None, "bucks": None},
        {"id": "sf-1", "drawRace": 2, "feeders": ["qf-2", "qf-3"], "berks": None, "bucks": None},
        {"id": "sf-2", "drawRace": 3, "feeders": ["qf-4", "qf-5"], "berks": None, "bucks": None},
        {"id": "sf-3", "drawRace": 4, "feeders": ["qf-6", "qf-7"], "berks": None, "bucks": None},
    ]
    final_sf = [
        {"id": "sf-4", "drawRace": 1, "feeders": ["sf-0", "sf-1"], "berks": None, "bucks": None},
        {"id": "sf-5", "drawRace": 2, "feeders": ["sf-2", "sf-3"], "berks": None, "bucks": None},
    ]
    final = [
        {"id": "final-0", "drawRace": 1, "feeders": ["sf-4", "sf-5"], "berks": None, "bucks": None},
    ]

    draw["rounds"] = [draw["rounds"][0], qf, sf, final_sf, final]
    draw["source"] = "Henley Royal Regatta 2026 Draw (Phase 2: bye-format quarter-finals)"
    write_draw("prince-philip", draw)


def repair_island() -> None:
    entries = load_entries("THE ISLAND CHALLENGE CUP")
    draw = json.loads((DATA / "island-2026-draw.json").read_text())

    qf = [
        {"id": "qf-0", "drawRace": 1, "feeders": ["r1-3"], "berks": crew(249, entries), "bucks": None},
        {
            "id": "qf-1",
            "drawRace": 2,
            "feeders": ["r1-2"],
            "berks": crew(211, entries),
            "bucks": crew(246, entries),
        },
        {"id": "qf-2", "drawRace": 3, "feeders": ["r1-1"], "berks": crew(216, entries), "bucks": None},
        {"id": "qf-3", "drawRace": 4, "feeders": ["r1-0"], "berks": crew(221, entries), "bucks": None},
        {
            "id": "qf-4",
            "drawRace": 5,
            "feeders": ["r1-4"],
            "berks": crew(212, entries),
            "bucks": crew(252, entries),
        },
        {"id": "qf-5", "drawRace": 6, "feeders": ["r1-5"], "berks": crew(228, entries), "bucks": None},
    ]

    sf = [
        {"id": "sf-0", "drawRace": 1, "feeders": ["qf-0", "qf-1"], "berks": None, "bucks": None},
        {"id": "sf-1", "drawRace": 2, "feeders": ["qf-2", "qf-3"], "berks": None, "bucks": None},
        {"id": "sf-2", "drawRace": 3, "feeders": ["qf-4", "qf-5"], "berks": None, "bucks": None},
    ]
    final = [
        {"id": "final-0", "drawRace": 1, "feeders": ["sf-0", "sf-1"], "berks": None, "bucks": None},
    ]

    draw["rounds"] = [draw["rounds"][0], qf, sf, final]
    draw["source"] = "Henley Royal Regatta 2026 Draw (Phase 2: bye-format quarter-finals)"
    write_draw("island", draw)


def repair_prince_albert() -> None:
    draw = json.loads((DATA / "prince-albert-2026-draw.json").read_text())
    entries = load_entries("THE PRINCE ALBERT CHALLENGE CUP")

    # Fix corrupted qf-1 berks slot (PDF parse merged wrong names).
    draw["rounds"][0][1]["berks"] = crew(704, entries)  # A.U.S.R. Orca, NED
    draw["rounds"][0][1]["berks"]["shortName"] = "A .U .S .R . Orca, NED"
    draw["source"] = "Henley Royal Regatta 2026 Draw (Phase 2: corrected qf-1 pairing)"
    write_draw("prince-albert", draw)


def main() -> int:
    repair_wargrave()
    repair_prince_philip()
    repair_island()
    repair_prince_albert()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
