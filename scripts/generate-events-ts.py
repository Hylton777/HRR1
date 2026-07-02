#!/usr/bin/env python3
"""Generate src/config/events.ts from manifest + draw JSON files."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "generated-events-manifest.json"
OUT = ROOT / "src" / "config" / "events.ts"

RACE_DAY_PRESETS = {
    "pe": "PE_RACE_DAYS",
    "pow": "POW_RACE_DAYS",
    "lp": "LP_RACE_DAYS",
    "goblets": "GOBLETS_RACE_DAYS",
}

ROUND_LABELS = {
    1: ["Final"],
    2: ["Semi-Final", "Final"],
    3: ["Quarter-Final", "Semi-Final", "Final"],
    4: ["1st Round", "Quarter-Final", "Semi-Final", "Final"],
    5: ["1st Round", "2nd Round", "Quarter-Final", "Semi-Final", "Final"],
}


def round_labels_for(sizes: list[int]) -> list[str]:
    n = len(sizes)
    if n in ROUND_LABELS:
        return ROUND_LABELS[n]
    labels = []
    for i, s in enumerate(sizes):
        if i == 0 and s >= 8:
            labels.append("1st Round")
        elif i == 0 and s == 4:
            labels.append("Quarter-Final")
        elif i == 0 and s == 2:
            labels.append("Semi-Final")
        elif i == 0:
            labels.append("1st Round")
        elif s == 1:
            labels.append("Final")
        elif s == 2:
            labels.append("Semi-Final")
        elif s == 4:
            labels.append("Quarter-Final")
        else:
            labels.append(f"Round {i + 1}")
    if labels[-1] != "Final":
        labels[-1] = "Final"
    return labels


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    events = manifest["events"]

    # Load existing manual configs for seeds (preserve curated values)
    existing_seeds: dict[str, list[int]] = {
        "pe": [
            256, 263, 270, 273, 281, 282, 283, 284, 286, 288, 290, 300,
        ],
        "pow": [434, 443, 446, 450],
        "lp": [1, 3, 4, 6],
        "wyfold": [
            383, 388, 392, 393, 395, 397, 400, 401, 405, 409, 413, 415, 416, 420,
        ],
        "goblets": [749, 751, 759, 761],
        "diamond": [813, 818, 819, 820, 830, 831, 832, 840],
    }

    ids: list[str] = []
    imports: list[str] = []
    configs: list[str] = []

    for ev in events:
        eid = ev["id"]
        draw_path = ROOT / "src" / "data" / f"{eid}-2026-draw.json"
        if not draw_path.exists():
            gen = ev.get("generation", {})
            if gen.get("outputPath"):
                draw_path = ROOT / gen["outputPath"]
        if not draw_path.exists():
            print(f"WARN: missing draw for {eid}")
            continue

        draw = json.loads(draw_path.read_text())
        round_sizes = [len(r) for r in draw["rounds"]]
        crew_count = ev.get("generation", {}).get("crewCount")
        if not crew_count:
            crew_count = sum(
                1
                for rnd in draw["rounds"]
                for m in rnd
                for slot in (m.get("berks"), m.get("bucks"))
                if slot
            ) // max(1, len([r for r in draw["rounds"] if any(m.get("berks") or m.get("bucks") for m in r)]))

        # count unique crews in round 0 + byes
        seen = set()
        for rnd in draw["rounds"]:
            for m in rnd:
                for slot in (m.get("berks"), m.get("bucks")):
                    if slot and slot.get("number"):
                        seen.add(slot["number"])
        if seen:
            crew_count = max(crew_count or 0, len(seen))
        if not crew_count:
            crew_count = round_sizes[0] * 2 if round_sizes else 0

        var = eid.replace("-", "_")
        imports.append(f'import {var}Draw from "@/data/{eid}-2026-draw.json";')
        ids.append(eid)

        seeds = existing_seeds.get(eid, ev.get("seededCrewNumbersHint", []))
        seed_names = ev.get("seededCrewNamesHint", [])
        if not seed_names and seeds:
            seed_names = []

        race_days = RACE_DAY_PRESETS.get(ev["raceDayPreset"], "POW_RACE_DAYS")
        labels = round_labels_for(round_sizes)
        subtitle = f"Live knockout bracket · {crew_count} crews · {ev['headerCategory']}"

        no_racing = {
            "pe": "Heats run Tue–Wed; knockout continues Fri–Sun — times publish around 9pm BST the evening before.",
            "pow": "Races Thu–Sun — times publish around 9pm BST the evening before.",
            "lp": "Ladies' races Thu–Sun — times publish around 9pm BST the evening before.",
            "goblets": "Races Fri–Sun — times publish around 9pm BST the evening before.",
        }.get(eid, f"{ev['shortLabel']} races per HRR schedule — times publish around 9pm BST the evening before.")

        if eid == "pe":
            no_racing = "PE has no racing on Thursday — Friday times publish around 9pm BST the evening before."
        elif eid == "wyfold":
            no_racing = "Heats run Tue–Wed; knockout continues Fri–Sun — times publish around 9pm BST the evening before."
        elif eid == "goblets":
            no_racing = "Goblets races Fri–Sun — times publish around 9pm BST the evening before."
        elif eid == "diamond":
            no_racing = "Diamond races Thu–Sun — times publish around 9pm BST the evening before."

        configs.append(
            f"""  "{eid}": {{
    id: "{eid}",
    trophySlug: "{ev["trophySlug"]}",
    timetableCodes: {json.dumps(ev["timetableCodes"])},
    year: 2026,
    displayName: {json.dumps(ev["displayName"])},
    shortLabel: {json.dumps(ev["shortLabel"])},
    headerSubtitle: {json.dumps(subtitle)},
    crewCount: {crew_count},
    draw: {var}Draw as DrawData,
    raceDays: {race_days},
    roundSizes: {json.dumps(round_sizes)},
    roundLabels: {json.dumps(labels)},
    seededCrewNumbers: {json.dumps(seeds)},
    seededCrewNames: {json.dumps(seed_names)},
    noRacingNote: {json.dumps(no_racing)},
    category: {json.dumps(ev.get("category", "open"))},
  }},"""
        )

    event_id_union = " | ".join(f'"{i}"' for i in ids)

    content = f'''import type {{ DrawData }} from "@/lib/types";
import type {{ RegattaDay }} from "@/lib/regatta-days";
{chr(10).join(imports)}

export type EventCategory =
  | "premier-mens-eights"
  | "premier-womens-eights"
  | "intermediate-mens-eights"
  | "intermediate-mens-coxless-fours"
  | "intermediate-womens-eights"
  | "intermediate-quads"
  | "club-eights"
  | "club-fours"
  | "student-eights"
  | "student-fours"
  | "junior-eights"
  | "junior-quads"
  | "open"
  | string;

export type EventId = {event_id_union};

export interface EventConfig {{
  id: EventId;
  trophySlug: string;
  timetableCodes: string[];
  year: number;
  displayName: string;
  shortLabel: string;
  headerSubtitle: string;
  crewCount: number;
  draw: DrawData;
  raceDays: RegattaDay[];
  roundSizes: readonly number[];
  roundLabels: string[];
  seededCrewNumbers: readonly number[];
  seededCrewNames: readonly string[];
  noRacingNote?: string;
  category: EventCategory;
}}

const PE_RACE_DAYS: RegattaDay[] = [
  {{ id: "tue", label: "Tuesday 30 June", shortLabel: "Tue", isoDate: "2026-06-30", primaryRoundIndex: 0 }},
  {{ id: "wed", label: "Wednesday 1 July", shortLabel: "Wed", isoDate: "2026-07-01", primaryRoundIndex: 1 }},
  {{ id: "fri", label: "Friday 3 July", shortLabel: "Fri", isoDate: "2026-07-03", primaryRoundIndex: 2 }},
  {{ id: "sat", label: "Saturday 4 July", shortLabel: "Sat", isoDate: "2026-07-04", primaryRoundIndex: 3 }},
  {{ id: "sun", label: "Sunday 5 July", shortLabel: "Sun", isoDate: "2026-07-05", primaryRoundIndex: 4 }},
];

const POW_RACE_DAYS: RegattaDay[] = [
  {{ id: "thu", label: "Thursday 2 July", shortLabel: "Thu", isoDate: "2026-07-02", primaryRoundIndex: 0 }},
  {{ id: "fri", label: "Friday 3 July", shortLabel: "Fri", isoDate: "2026-07-03", primaryRoundIndex: 1 }},
  {{ id: "sat", label: "Saturday 4 July", shortLabel: "Sat", isoDate: "2026-07-04", primaryRoundIndex: 2 }},
  {{ id: "sun", label: "Sunday 5 July", shortLabel: "Sun", isoDate: "2026-07-05", primaryRoundIndex: 3 }},
];

const GOBLETS_RACE_DAYS: RegattaDay[] = [
  {{ id: "fri", label: "Friday 3 July", shortLabel: "Fri", isoDate: "2026-07-03", primaryRoundIndex: 0 }},
  {{ id: "sat", label: "Saturday 4 July", shortLabel: "Sat", isoDate: "2026-07-04", primaryRoundIndex: 1 }},
  {{ id: "sun", label: "Sunday 5 July", shortLabel: "Sun", isoDate: "2026-07-05", primaryRoundIndex: 2 }},
];

const LP_RACE_DAYS: RegattaDay[] = [
  {{ id: "thu", label: "Thursday 2 July", shortLabel: "Thu", isoDate: "2026-07-02", primaryRoundIndex: 0 }},
  {{ id: "fri", label: "Friday 3 July", shortLabel: "Fri", isoDate: "2026-07-03", primaryRoundIndex: 1 }},
  {{ id: "sat", label: "Saturday 4 July", shortLabel: "Sat", isoDate: "2026-07-04", primaryRoundIndex: 2 }},
  {{ id: "sun", label: "Sunday 5 July", shortLabel: "Sun", isoDate: "2026-07-05", primaryRoundIndex: 3 }},
];

export const EVENTS: Record<EventId, EventConfig> = {{
{chr(10).join(configs)}
}};

export const EVENT_LIST: EventConfig[] = [
{chr(10).join(f'  EVENTS[{json.dumps(i)}],' for i in ids)}
];

export function getEventConfig(id: string): EventConfig | null {{
  if (id in EVENTS) return EVENTS[id as EventId];
  return null;
}}

export function isEventId(id: string): id is EventId {{
  return id in EVENTS;
}}
'''
    OUT.write_text(content)
    print(f"Wrote {OUT} with {len(ids)} events")


if __name__ == "__main__":
    main()
