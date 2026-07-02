#!/usr/bin/env python3
"""Phase 2: repair bye-format knockout draws for events with non-standard progression."""

from __future__ import annotations

import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"

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
        {"id": "qf-6", "drawRace": 7, "feeders": ["r1-6"], "berks": crew(208, entries, "Brown Univ., USA 'A'"), "bucks": None},
        {"id": "qf-7", "drawRace": 8, "feeders": ["r1-7"], "berks": crew(203, entries, "A.S.R. Nereus, NED"), "bucks": None},
    ]

    sf = [
        {"id": "sf-0", "drawRace": 1, "feeders": ["qf-0", "qf-1"], "berks": None, "bucks": None},
        {"id": "sf-1", "drawRace": 2, "feeders": ["qf-2", "qf-3"], "berks": None, "bucks": None},
        {"id": "sf-2", "drawRace": 3, "feeders": ["qf-4", "qf-5"], "berks": None, "bucks": None},
        {"id": "sf-3", "drawRace": 4, "feeders": ["qf-6", "qf-7"], "berks": None, "bucks": None},
    ]
    penultimate = [
        {"id": "sf4-0", "drawRace": 1, "feeders": ["sf-0", "sf-1"], "berks": None, "bucks": None},
        {"id": "sf4-1", "drawRace": 2, "feeders": ["sf-2", "sf-3"], "berks": None, "bucks": None},
    ]
    final = [
        {"id": "final-0", "drawRace": 1, "feeders": ["sf4-0", "sf4-1"], "berks": None, "bucks": None},
    ]

    draw["rounds"] = [draw["rounds"][0], qf, sf, penultimate, final]
    draw["source"] = "Henley Royal Regatta 2026 Draw (Phase 2: bye-format quarter-finals)"
    write_draw("island", draw)


def repair_prince_albert() -> None:
    entries = load_entries("THE PRINCE ALBERT CHALLENGE CUP")

    def c(num: int, short: str | None = None) -> dict:
        obj = crew(num, entries)
        if short:
            obj["shortName"] = short
        return obj

    # Wednesday quarter-finals (4 races).
    qf = [
        {
            "id": "qf-0",
            "drawRace": 1,
            "berks": c(725, "Massachusetts Inst . T ech ., USA"),
            "bucks": c(731, "Oxford Univ . 'B'"),
        },
        {
            "id": "qf-1",
            "drawRace": 2,
            "berks": c(704, "A .U .S .R . Orca, NED"),
            "bucks": c(709, "Cambridge Univ"),
        },
        {
            "id": "qf-2",
            "drawRace": 3,
            "berks": c(726, "Melbourne Univ ., AUS"),
            "bucks": c(738, "Univ . of London"),
        },
        {
            "id": "qf-3",
            "drawRace": 4,
            "berks": c(713, "Edinburgh Univ"),
            "bucks": c(736, "Univ . Coll ., Dublin, IRL"),
        },
    ]

    # Thursday last-16: pre-qualified / bye crews vs Wednesday QF winners (or direct qualifiers).
    sf = [
        {"id": "sf-0", "drawRace": 1, "feeders": ["qf-3"], "berks": c(728, "Oxford Brookes Univ . 'A'"), "bucks": None},
        {"id": "sf-1", "drawRace": 2, "feeders": [], "berks": c(727, "Newcastle Univ."), "bucks": c(712, "Durham Univ .")},
        {"id": "sf-2", "drawRace": 3, "feeders": [], "berks": c(730, "Oxford Univ . 'A'"), "bucks": c(729, "Oxford Brookes Univ . 'B'")},
        {"id": "sf-3", "drawRace": 4, "feeders": ["qf-2"], "berks": c(716, "Harvard Univ., USA"), "bucks": None},
        {"id": "sf-4", "drawRace": 5, "feeders": [], "berks": c(737, "Univ . of Birmingham"), "bucks": c(717, "Imperial Coll. London")},
        {"id": "sf-5", "drawRace": 6, "feeders": ["qf-1"], "berks": None, "bucks": c(721, "K.S.R.V . Njord, NED")},
        {"id": "sf-6", "drawRace": 7, "feeders": [], "berks": c(710, "Drexel Univ ., USA"), "bucks": c(744, "U.S.R. Triton, NED")},
        {"id": "sf-7", "drawRace": 8, "feeders": ["qf-0"], "berks": None, "bucks": c(724, "M.S.R.V . Saurus, NED")},
    ]

    # Downstream knockout tree for 8 last-16 winners.
    qf2 = [
        {"id": "qf2-0", "drawRace": 1, "feeders": ["sf-0", "sf-1"], "berks": None, "bucks": None},
        {"id": "qf2-1", "drawRace": 2, "feeders": ["sf-2", "sf-3"], "berks": None, "bucks": None},
        {"id": "qf2-2", "drawRace": 3, "feeders": ["sf-4", "sf-5"], "berks": None, "bucks": None},
        {"id": "qf2-3", "drawRace": 4, "feeders": ["sf-6", "sf-7"], "berks": None, "bucks": None},
    ]
    sf2 = [
        {"id": "sf2-0", "drawRace": 1, "feeders": ["qf2-0", "qf2-1"], "berks": None, "bucks": None},
        {"id": "sf2-1", "drawRace": 2, "feeders": ["qf2-2", "qf2-3"], "berks": None, "bucks": None},
    ]
    final = [
        {"id": "final-0", "drawRace": 1, "feeders": ["sf2-0", "sf2-1"], "berks": None, "bucks": None},
    ]

    draw = {
        "event": "The Prince Albert Challenge Cup",
        "year": 2026,
        "source": "Henley Royal Regatta 2026 Draw (Phase 2: 20-crew bye-format)",
        "sourceUrl": "https://dftgz7dbeqc0e.cloudfront.net/2026/07/Henley-Royal-Regatta-2026-07-02-120x170_Draw.pdf",
        "rounds": [qf, sf, qf2, sf2, final],
    }
    write_draw("prince-albert", draw)


def main() -> int:
    repair_wargrave()
    repair_prince_philip()
    repair_island()
    repair_prince_albert()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
