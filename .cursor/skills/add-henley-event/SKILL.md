# Add a Henley Royal Regatta Event

Use this skill when adding a new knockout event tab to the HRR bracket app (alongside PE, POW, Ladies, Wyfold).

The app is multi-event: draw JSON + `events.ts` config drive everything else (`/api/bracket/[event]`, tabs, mobile 2-day view, seeding, connectors). Most bugs come from **wrong draw structure** or **wrong feeder mapping**, not from missing UI wiring.

---

## Quick checklist

1. **Research the official draw** — [HRR draw PDF](https://dftgz7dbeqc0e.cloudfront.net/2026/07/Henley-Royal-Regatta-2026-07-02-120x170_Draw.pdf), [race timetable](https://www.hrr.co.uk/compete/race-timetable/), [HRR results API](https://www.hrr.co.uk/wp-json/hrr/v1/results).
2. **Create draw JSON** — `src/data/<event-id>-2026-draw.json`.
3. **Register event** — `src/config/events.ts` (`EventId`, `EVENTS`, `EVENT_LIST`, `headerSubtitle` in POW format).
4. **Verify bracket shape** — `roundSizes` must match `draw.rounds[].length` per round.
5. **Verify feeder mapping** — every progression path must match the steward chart, including byes.
6. **Verify visual alignment** — connector lines must run from each heat to the correct TBD slot.
7. **Configure seeds, timetable codes, race days** — seeds from **italic names on the draw PDF only** (not pre-qual lists); see lessons below.
8. **Build and hit API** — `npm run build`, `curl /api/bracket/<event-id>`.
9. **Smoke-test UI** — tab label, 2-day mobile view, bold seeds, no phantom future-round crews.

No UI changes are needed unless the tab label needs a special case (see Ladies).

---

## Files to touch

| File | Purpose |
|------|---------|
| `src/data/<id>-2026-draw.json` | Official pairings, feeders, crew names/numbers |
| `src/config/events.ts` | Event metadata, `roundSizes`, seeds, race days |
| `src/components/EventTabs.tsx` | Only if tab subtitle needs custom text |

Already generic (do **not** duplicate per event):

- `src/app/api/bracket/[event]/route.ts`
- `src/components/Dashboard.tsx`, `HomeView.tsx` (`?event=<id>`)
- `src/lib/bracket-engine.ts`, `src/lib/bracket-layout.ts`
- `src/lib/crew-seeds.ts`, `src/lib/regatta-days.ts`

---

## Draw JSON schema

```json
{
  "event": "The … Challenge Cup",
  "year": 2026,
  "source": "Henley Royal Regatta 2026 Draw (2 July 2026)",
  "sourceUrl": "https://dftgz7dbeqc0e.cloudfront.net/2026/07/Henley-Royal-Regatta-2026-07-02-120x170_Draw.pdf",
  "rounds": [
    [ /* round 0: earliest races */ ],
    [ /* round 1 */ ],
    …
  ]
}
```

Each match:

```json
{
  "id": "r1-0",
  "drawRace": 1,
  "berks": { "name": "…", "shortName": "…", "number": 256 },
  "bucks": { "name": "…", "shortName": "…", "number": 257 },
  "feeders": ["r1-0", "r1-1"]
}
```

| Field | Rules |
|-------|-------|
| `id` | Unique string; prefix by round (`r1-`, `r2-`, `qf-`, `sf-`, `final-`). |
| `drawRace` | 1-based order **within the round on the official chart** (top → bottom). Controls column order and collision resolution. |
| `berks` / `bucks` | Full HRR name + short display name + crew number when known. Use `null` for TBD / winner-not-yet-known slots. |
| `feeders` | Parent match `id`s whose winners feed this slot. Omit when both crews are pre-drawn (bye vs bye). |

Import in `events.ts`:

```ts
import newDraw from "@/data/new-2026-draw.json";
// …
draw: newDraw as DrawData,
```

---

## Event config (`events.ts`)

```ts
export type EventId = "pe" | "pow" | "lp" | "wyfold" | "new";

new: {
  id: "new",
  trophySlug: "the-…-challenge-cup",      // HRR API slug
  timetableCodes: ["Wyfold"],               // exact strings from timetable HTML
  year: 2026,
  displayName: "… Challenge Cup",
  shortLabel: "Wyfold",                     // tab button text
  headerSubtitle: "Live knockout bracket · N crews · …",  // see Header subtitle below
  crewCount: 32,
  draw: newDraw as DrawData,
  raceDays: PE_RACE_DAYS,                   // or custom — see below
  roundSizes: [16, 8, 4, 2, 1],
  roundLabels: ["1st Round", "2nd Round", "Quarter-Final", "Semi-Final", "Final"],
  seededCrewNumbers: [383, 388, …],         // preferred — authoritative
  seededCrewNames: ["…"],                   // fallback when numbers unknown
  noRacingNote: "…",
},
```

Add to `EVENT_LIST` in tab order.

**URL persistence:** `?event=new` (PE stays default with no param). `isEventId()` picks it up automatically.

---

## Header subtitle (`headerSubtitle`)

Shown under the page title in `HomeView.tsx`. **Every event must use the same three-part format as POW** — do not put schedule notes, bye formats, or draw quirks here (those belong in `noRacingNote` or the draw JSON).

```
Live knockout bracket · {crewCount} crews · {event category}
```

| Event | `headerSubtitle` |
|-------|------------------|
| PE | `Live knockout bracket · 32 crews · Junior men's eights` |
| POW | `Live knockout bracket · 16 crews · Intermediate quads` |
| Ladies | `Live knockout bracket · 10 crews · Intermediate men's eights` |
| Wyfold | `Live knockout bracket · 32 crews · Club coxless fours` |
| Goblets | `Live knockout bracket · 8 crews · Premier men's coxless pairs` |

Rules:

- Always **`{crewCount} crews`** — never "pairs", "heats", or bye counts in the subtitle.
- Third segment = HRR **event category** (e.g. Intermediate quads), not format/scheduling detail.
- Use middle dot ` · ` separators (same as POW).

---

## Bracket formats (reference)

| Event | Crews | `roundSizes` | Schedule notes |
|-------|-------|--------------|----------------|
| **PE** | 32 | `[16, 8, 4, 2, 1]` | Tue–Sun; no racing Thu |
| **POW** | 16 | `[8, 4, 2, 1]` | Thu–Sun; intermediate **quads** |
| **Ladies** | 10 | `[2, 4, 2, 1]` | Thu–Sun; **2 heats + 6 byes** |
| **Wyfold** | 32 | `[16, 8, 4, 2, 1]` | Tue–Wed heats; knockouts Fri–Sun |

### Standard full draw (PE, Wyfold)

- Every crew races round 1; binary tree; all later-round slots start `berks: null, bucks: null`.
- Each match has **two** `feeders` from the previous round.
- `roundSizes` halves each round: 32 → 16 → 8 → 4 → 2 → 1.

### Compact draw (POW)

- Same tree logic, fewer crews: 16 → 8 → 4 → 2 → 1.
- Verify event type in subtitle (POW is quads, not fours).

### Bye draw (Ladies) — most error-prone

**Do not** put all crews in round 1. Only the heats that actually run on day 1 belong in round 0.

Ladies pattern (verified 2026):

- **Round 0 (Thu):** 2 heats only — Marbacher/London, Peterhouse/Oxford Brookes.
- **Round 1 (Fri QF):** 4 races — 6 bye crews + 2 R1 winners.
- **Round 2 (SF):** 2 races.
- **Round 3 (Final):** 1 race.

Correct QF mapping:

| QF | Berks (bye) | Bucks (TBD or opponent) | Feeder |
|----|-------------|---------------------------|--------|
| Q1 | Leander | winner of Marbacher/London | `r1-0` |
| Q2 | Molesey & Nereus | Nautilus | — |
| Q3 | Washington | Thames | — |
| Q4 | Cambridge & Harvard | winner of Peterhouse/Oxford Brookes | `r1-1` |

**Common mistake:** assigning both R1 winners to the top two QFs, or putting Cambridge & Harvard in Q3 with Nautilus. Read the steward chart — the Peterhouse winner feeds **Q4**, not Q2.

---

## Feeder mapping & visual alignment

The bracket must show **where each winner goes**. This is controlled by `feeders` + layout code, not by manually spacing cards.

### How progression works in code

1. **`bracket-engine.ts`** applies HRR results, then **`propagateFeederWinners`** fills empty `berks`/`bucks` from completed feeder races. Required for Wyfold R2→QF and Ladies R1→QF.
2. **`bracket-layout.ts`** computes vertical positions:
   - **Two feeders:** child match centers between parent match centers.
   - **Later rounds:** stacked in `drawRace` order within each column.
   - **Single-feeder byes:** `backAlignFeederRound` runs **after** later rounds are placed — it aligns each round-0 heat with the **TBD row** on its child QF, creating a large vertical gap between day-1 heats when they feed distant QFs (e.g. top QF and bottom QF).
3. **`BracketConnectors.tsx`** draws lines:
   - Two feeders → standard fork connector.
   - One feeder → line from heat to `data-connector-anchor="bucks"` or `"berks"` on the child card (`MatchCard.tsx`).
4. **`inferFeederAnchor`** (layout + connectors): if `berks` is set and `bucks` is `null`, the feeder fills the **bucks** row (TBD at bottom of card). Opposite when only bucks is set.

### Rules for drawing bye matches

```
Bye crew pre-drawn on berks, winner slot empty on bucks:

{
  "id": "qf-0",
  "feeders": ["r1-0"],
  "berks": { "name": "Leander Club", … },
  "bucks": null
}
```

- `feeders` has **one** id — the heat whose winner fills the empty slot.
- Put the bye match at the correct **`drawRace`** position in its column (Q4 = `drawRace: 4` = bottom of QF column).
- The feeding heat stays in round 0 at the **`drawRace`** order from the chart (R1 heat 1 top, R1 heat 2 below — layout will space them to align with their QFs).

### Visual alignment checklist

- [ ] Each round-0 heat that feeds a QF has exactly one child with `feeders: ["<that-heat-id>"]`.
- [ ] Child QF is at the correct `drawRace` row (order preserved; bottom QF stays bottom).
- [ ] Empty slot is on the correct side (`bucks: null` when bye is berks).
- [ ] Connector lines run horizontally from heat → TBD row (not to center of whole QF card).
- [ ] Two-feeder matches (SF, Final) center between their parents automatically.

### ASCII: Ladies alignment

```
1st Round          Quarter-Final
─────────          ─────────────
[r1-0 Marb/Lon] ──────────────► [Leander  / TBD]  ← Q1 top
                                      …
                                      …
[r1-1 Pet/OB]  ──────────────► [Cam/Harv / TBD]  ← Q4 bottom
     ↑ large vertical gap between r1-0 and r1-1
```

---

## Seeding (bold crew names)

**The official draw PDF is the only authoritative source for seeds.** On the steward chart, **italic crew names are seeded**; roman (upright) names are not — even if that crew appears on a JRN pre-qualified list or qualified via the qualifying races.

**Do not** mark a crew as seeded because it pre-qualified, had a strong entry, or appears in press previews. Always read the draw PDF and list only italicized crews.

**Prefer `seededCrewNumbers`** — official draw numbers are authoritative once confirmed against italics on the chart.

```ts
seededCrewNumbers: [434, 443, 446, 450],
```

`crew-seeds.ts` logic:

- If crew has a number → bold only when number is in `seededCrewNumbers`.
- Otherwise fall back to fuzzy name match against `seededCrewNames`.

**POW lesson:** "Leander Club" (443) must be bold; "Leander Club & Leeds" (444) must **not** — numbered seeds prevent false positives.

**Goblets lesson (2026):** Donaghy & Nares (753) pre-qualified but are **not** italicized on the draw — they must not be in `seededCrewNumbers`. Pre-qualification ≠ seeding.

---

## Timetable merge (`bracket-engine.ts`)

HRR timetable rows are merged by **crew number + name**.

**Do:**

- Fill times on matches that already have both crews confirmed.
- Fill the empty slot on bye matches when the opponent is scheduled.
- Match by crew number first (most reliable).

**Do not:**

- Fill empty later-round slots from timetable unless **both** crews are confirmed (no "first empty slot" fallback).
- Show QF/SF/Final crews before the previous round has results — POW bug fix.

Timetable codes must match HTML exactly (`"Ladies'"`, `"Pr Wales"`, `"Wyfold"`, `"PE"`).

---

## Results API quirks

```bash
curl "https://www.hrr.co.uk/wp-json/hrr/v1/results?trophy=<slug>&race-year=2026&result-page=1"
```

| Lesson | Event | Detail |
|--------|-------|--------|
| Round labels | Wyfold | HRR returns `"Heat"` for **both** Tue heats and Wed 2nd round. Ignore `round` string; match by crew pairings. |
| Empty later slots | Wyfold | R2/QF slots start null — rely on `propagateFeederWinners`. |
| Pagination | All | Loop `result-page` until `lastPage`. |
| Unmatched results | All | Check server logs for `[bracket] Unmatched result`. |

API verification:

```bash
curl -s localhost:3000/api/bracket/<id> | jq '{
  roundCounts,
  bracketWarnings,
  complete: [.bracket.rounds[][] | select(.status=="complete")] | length
}'
```

`roundCounts` must equal `roundSizes`. `bracketWarnings` should be `[]`.

---

## Race days & mobile view

`raceDays` drives the mobile **2-day** preset (`regatta-days.ts`):

```ts
{
  id: "thu",
  label: "Thursday 2 July",
  shortLabel: "Thu",
  isoDate: "2026-07-02",
  primaryRoundIndex: 0,   // main round raced that day
}
```

**Lessons:**

- **PE / Wyfold:** Tue start; PE skips Thu; Wyfold has Wed 2nd-round heats.
- **POW / Ladies:** Thu–Sun (not Wed for Ladies — verify [racing schedule](https://www.hrr.co.uk/racing-schedule/)).
- `primaryRoundIndex` must match which round actually races that day.
- `noRacingNote` explains gaps (e.g. "times publish ~9pm BST evening before").

---

## Tab labels

| Event | `shortLabel` | Desktop subtitle (`EventTabs.tsx`) |
|-------|--------------|-----------------------------------|
| PE | `PE` | Princess Elizabeth |
| POW | `POW` | Prince of Wales |
| Ladies | `Ladies` | Challenge Plate (custom `event.id === "lp"` branch) |
| Wyfold | `Wyfold` | Wyfold |

Keep `shortLabel` short for mobile. Use `displayName` for the page `<h1>`.

---

## Draw research workflow

1. Open the official PDF; find the event's Wargrave/row section.
2. Count crews → derive `roundSizes` (or identify bye/heats pattern).
3. Transcribe **every** round-1 pairing with crew numbers from timetable when published.
4. Map **each** bye crew to its QF/SF slot on the chart — note which heat feeds which QF.
5. Record `feeders` for every match that depends on a prior winner.
6. Set `drawRace` top-to-bottom as races appear on the chart within each round.
7. Cross-check with live timetable + results after racing starts.

---

## Testing before merge

```bash
npm run build
npm run dev
curl -s localhost:3000/api/bracket/<id> | jq .
```

UI checks:

- [ ] Tab appears; `?event=<id>` persists on refresh
- [ ] Round column counts and labels correct
- [ ] Seeds bold per official draw
- [ ] Thursday (or day-1) heats connect to correct QF TBD rows
- [ ] Later rounds populate as results arrive (not before)
- [ ] Mobile 2-day view shows sensible days
- [ ] No crews in future rounds before winners known

---

## Adding event ID `foo` — minimal diff

```ts
// src/config/events.ts
export type EventId = "pe" | "pow" | "lp" | "wyfold" | "foo";
import fooDraw from "@/data/foo-2026-draw.json";

foo: { id: "foo", trophySlug: "…", timetableCodes: ["…"], … },
// append to EVENT_LIST
```

Create `src/data/foo-2026-draw.json`. Run build + API test. Fix feeders/alignment before merging.

---

## When to change shared engine code

Only modify `bracket-engine.ts` / `bracket-layout.ts` when discovering a **new progression pattern** that multiple events need (e.g. single-feeder byes, feeder winner propagation). Event-specific fixes belong in the draw JSON, not hacks in the engine.

If alignment is wrong:

1. Fix `feeders` and `drawRace` order in draw JSON first.
2. Confirm bye slots use `null` on the correct side.
3. Only then adjust layout ratios (`BUCKS_SLOT_CENTER_RATIO`, etc.).

---

## Official sources

- Draw PDF: https://dftgz7dbeqc0e.cloudfront.net/2026/07/Henley-Royal-Regatta-2026-07-02-120x170_Draw.pdf
- Timetable: https://www.hrr.co.uk/compete/race-timetable/
- Results API: `https://www.hrr.co.uk/wp-json/hrr/v1/results?trophy=<slug>&race-year=2026`
- Racing schedule: https://www.hrr.co.uk/racing-schedule/
