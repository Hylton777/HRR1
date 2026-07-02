# HRR Bracket — QA Checklist

Manual and automated checks for verifying the live bracket site. This document references the actual data sources, components, and scripts in this repository.

**Last reviewed against codebase:** `src/config/events.ts`, `src/lib/bracket-engine.ts`, `scripts/audit-all-events.ts` (30 events, 2026 season).

---

## Architecture quick reference

| Layer | Location | Role |
|-------|----------|------|
| Draw (static) | `src/data/{event-id}-2026-draw.json` | Official pairings: `berks`, `bucks`, `feeders`, `drawRace` |
| Event config | `src/config/events.ts` | `roundSizes`, `roundLabels`, `seededCrewNumbers`, `trophySlug`, `crewCount` |
| Results API | `src/lib/hrr-api.ts` → `fetchEventResults()` | `https://www.hrr.co.uk/wp-json/hrr/v1/results` |
| Timetable scrape | `src/lib/hrr-api.ts` → `fetchEventTimetable()` | `https://www.hrr.co.uk/compete/race-timetable/` |
| Bracket engine | `src/lib/bracket-engine.ts` → `buildBracket()` | Applies results, propagates feeders, sets `status` |
| Crew matching | `src/lib/crew-match.ts` | `crewsMatch()`, `crewResultMatchesDraw()` |
| Seeding | `src/lib/crew-seeds.ts` → `isSeededCrew()` | Maps `seededCrewNumbers` → `crew.seeded` |
| UI tree | `src/components/BracketTreeCore.tsx` → `MatchCard.tsx` | Renders rounds, connectors, match cards |
| Client fetch | `src/components/Dashboard.tsx` | SWR on `/api/bracket/{eventId}`, 30s refresh |
| API route | `src/app/api/bracket/[event]/route.ts` | `Cache-Control: no-store`; returns `resultAudit`, `bracketWarnings` |
| Draw repair | `scripts/phase2-bye-draws.py`, `phase3-bye-draws.py`, `phase4-bye-draws.py` | Bye-format draw JSON regeneration |
| Entries PDF | `scripts/generate-all-events.py`, `repair-draw-from-results.py` | `HRR-List-of-Entries-2026.pdf` on CloudFront |

**Match status values:** `pending` → `scheduled` (both `berks` and `bucks` known) → `complete` (result applied).

**Bye-format events** (single `feeders` entry, one side pre-placed): `lp`, `bridge`, `town`, `queen-mother`, `visitors`, `princess-royal`, `queen-victoria` (see `BYE_FORMAT_IDS` in `scripts/generate-all-events.py`), plus manually repaired draws: `wargrave`, `prince-philip`, `island`, `prince-albert`, `fawley`, `diamond-jubilee`, `temple`.

**Seeding display convention (important):** On the official Henley draw chart, seeded crews are printed in *italics*. **This app uses `font-bold` for seeded crews** (`isSeededCrew()` in `src/lib/crew-seeds.ts`, applied in `MatchCard.tsx`, `NextRacesPanel.tsx`, `RaceResultCard.tsx`). *Italic* in the UI means an **empty slot** (`TBD` or a feeder placeholder from `feederPlaceholderLabel()` in `src/lib/feeder-label.ts`), not seeding.

---

## Automated pre-flight (run before manual QA)

Run from the project root:

```bash
# 1. Engine + slot-aware result application (10 bye/complex events)
npx tsx scripts/verify-phase1-engine.ts

# 2. Full 30-event audit: progression, feeders, name drift, timing
npx tsx scripts/audit-all-events.ts

# 3. Timetable vs results day ordering
npx tsx scripts/audit-timing.ts

# 4. Production build (types + lint)
npm run build
```

With the dev server running (`npm run dev`):

```bash
# 5. API-level result completeness for all events
python3 scripts/audit-event-results.py http://localhost:3000
```

**Pass criteria:** `verify-phase1-engine.ts` prints `PASS`; `audit-all-events.ts` ends with `ISSUES: 0 errors, 0 warnings`; `npm run build` succeeds.

After draw JSON changes for bye-format events:

```bash
python3 scripts/phase4-bye-draws.py   # runs phase2 + phase3 repair scripts
```

**Optional deep check** (all events: `roundSizes` vs draw, 0 unmatched results):

```bash
npx tsx scripts/test-deep-check.ts
```

---

## 1. Progression logic

- [ ] **Winners match HRR API for every `complete` match** — For each event with results, compare `match.winner` / `match.loser` in `buildBracket()` output against `result.winner` / `result.loser` from `fetchEventResults()`. Automated: `npx tsx scripts/verify-phase1-engine.ts` (10 events) and `audit-all-events.ts` (winner/loser vs draw slots via `crewResultMatchesDraw()`). Manual: open [HRR results](https://www.hrr.co.uk/compete/results/) for the trophy and spot-check 2–3 races per round.

- [ ] **Recorded loser is never the winner** — `audit-all-events.ts` category `progression` checks `match.loser` ≠ `match.winner` on complete matches (`scripts/audit-all-events.ts`, ~line 256).

- [ ] **Feeder winners appear in child matches** — When `feeder.status === 'complete'`, `feeder.winner` must appear on `berks` or `bucks` of the child match (or propagate via `propagateFeederWinners()` in `bracket-engine.ts`). Automated: `audit-all-events.ts` category `progression` / `feeder_missing`.

- [ ] **Losers do not progress** — A crew in `feeder.loser` must not appear in downstream `berks`/`bucks` unless it is the same crew number under a false-positive name match. Automated: `audit-all-events.ts` message `only winner should progress`. Manual: pick a completed R1 heat and confirm the defeated crew is absent from the linked QF/R2 slot.

- [ ] **Bye crews advance without a fabricated result** — For single-feeder matches (`feeders.length === 1`, one of `berks`/`bucks` null in draw JSON), the pre-placed bye crew should appear on the draw immediately; the feeder winner fills the empty side via `propagateFeederWinners()` — no `status: 'complete'` until an actual HRR result exists. Manual: check `visitors` QF (`src/data/visitors-2026-draw.json` `qf-0`…`qf-3`) or `lp` QF before and after R1 completes. Empty side should show `Winner of {roundLabel} {drawRace}` (from `feederPlaceholderLabel()`), not a fake score.

- [ ] **Dual-feeder matches wait for both parents** — Matches with `feeders: ['r1-0', 'r1-1']` should not show `complete` until both feeders have `winner` set and a result matches the pair. Engine: `tryApplyResult()` in `bracket-engine.ts`.

- [ ] **No orphaned nodes** — Every crew in round *N* > 0 must trace to a `feeders` chain back to round 0, or be pre-placed on the draw. Automated: `audit-all-events.ts` `feeder_missing` errors for dangling `feederId` references. Manual: click a crew in R2/QF and visually follow connectors (`BracketConnectors.tsx`) to parent heats.

- [ ] **Prince Albert multi-stage tree** — `prince-albert` uses non-standard round ids (`qf-*` → `sf-*` last-16 → `qf2-*` → `sf2-*` → `final-0`; see `src/data/prince-albert-2026-draw.json`). Confirm Thursday last-16 results populate `sf-*` slots and downstream `qf2-*` receive winners via feeders, not by orphan insertion.

- [ ] **Squad-letter crews match correctly** — Events with multiple squads (e.g. `temple` Nereus 'A'/'B', `island` Brown 'A'/'B') must not swap winner/loser. Relies on `crewResultMatchesDraw()` and distinct `shortName` values in draw JSON. Automated: `verify-phase1-engine.ts` includes `temple` and `island`.

---

## 2. Draw order integrity

- [ ] **Matches within a round follow `drawRace`** — Each `DrawMatch` in `src/data/*-draw.json` has `drawRace` (1-based race number on the official chart). `bracket-layout.ts` sorts by `drawRace ?? matchIndex` for collision resolution. Manual: compare vertical order in `BracketTreeCore` column to the [official draw PDF](https://dftgz7dbeqc0e.cloudfront.net/2026/07/Henley-Royal-Regatta-2026-07-02-120x170_Draw.pdf) for one event (e.g. `pe`, `thames`).

- [ ] **Round column order matches `roundLabels`** — Column headers come from `event.roundLabels[roundIndex]` in `BracketTreeCore.tsx`. Confirm against HRR schedule for events with non-default labels:
  - `island`: `1st Round`, `Quarter-Final`, `Semi-Final`, `Penultimate`, `Final`
  - `diamond-jubilee` / `princess-royal`: `Last 16` instead of `2nd Round`
  - `prince-albert`: `Qualifier`, `Last 16`, `Quarter-Final`, `Semi-Final`, `Final`
  - Source: `roundLabels` in `src/config/events.ts`

- [ ] **`roundSizes` matches draw JSON length** — For each event, `draw.rounds[i].length === roundSizes[i]`. Automated: `validateRoundCounts()` in `src/lib/bracket-layout.ts` (surfaced as `bracketWarnings` on `/api/bracket/{eventId}`). API check: `roundCounts` array in JSON response.

- [ ] **Henley non-adjacent feeder pairings preserved** — Some repaired draws use non-standard feeder wiring (e.g. `temple` `r2-6` feeders `r1-12`+`r1-14`, `r2-7` feeders `r1-13`+`r1-15` in `scripts/phase3-bye-draws.py`). Confirm bracket connectors still align and results apply (23/23 for `temple`).

- [ ] **Regatta day per round** — `raceDays` in `events.ts` drives which rounds are expected on which day (`getScheduledRegattaDayForRound()` in `src/lib/regatta-days.ts`). Manual: on Wednesday, Wednesday-round matches may show times; Friday rounds should not show stale times from timetable bleed (`stripUnpublishedScheduleTimes` in `bracket-engine.ts`).

---

## 3. Seeding display

> **Convention:** Official chart = italics; **this app = bold** for seeded. Do not expect italics on named crews.

- [ ] **Seeded crews render bold** — Crews whose `number` is in `event.seededCrewNumbers` (`src/config/events.ts`) or with `crew.seeded === true` (set by `withSeededFlag()` in `bracket-engine.ts`) should use `font-bold` in `MatchCard.tsx` `CrewRow` and compact boxes. Manual: pick a seeded crew from the official draw (italic on PDF) and confirm **bold** on site.

- [ ] **Unseeded crews are not bold** — Crews not in `seededCrewNumbers` should use normal weight (or `font-medium` when winner). Manual: compare a known unseeded R1 crew.

- [ ] **`seededCrewNumbers` aligns with official draw** — Cross-check `seededCrewNumbers` for an event against italic entries on the draw PDF. Entries list: `HRR-List-of-Entries-2026.pdf` (parsed by `parse_entries()` in `scripts/generate-all-events.py`). Flag any crew italic on the chart but missing from `seededCrewNumbers`, or vice versa (e.g. pre-qualified but not seeded — Goblets #753 lesson in `.cursor/skills/add-henley-event/SKILL.md`).

- [ ] **Italic means empty, not seeded** — Slots without a `Crew` object should show italic `TBD` or `Winner of …` placeholder (`MatchCard.tsx` line ~102: `text-[var(--muted)] italic`). Confirm no seeded crew name appears in italic.

- [ ] **Seeding consistent across UI surfaces** — `NextRacesPanel.tsx`, `RaceResultCard.tsx`, `RaceResultModal.tsx`, and champion card in `BracketTreeCore.tsx` all use `isSeededCrew()` for bold styling. Spot-check the same crew in bracket, next races, and result modal.

- [ ] **Winner/loser styling does not fake seeding** — Winners get `font-medium` or `font-bold` (if seeded); losers get line-through. Seeding bold should only come from `isSeededCrew()`, not from win state alone.

---

## 4. Data consistency

- [ ] **Crew `number` stable across rounds** — When a crew progresses, `enrichCrew()` / `CrewRegistry` (`src/lib/crew-seeds.ts`) should preserve `number` from the draw. Automated: `audit-all-events.ts` category `name_drift` when feeder winner `#` ≠ slot `#`.

- [ ] **`shortName` vs `name` consistency** — Display uses `shortName || name` (`MatchCard.tsx` `displayName()`). Same crew should not change display string arbitrarily between rounds unless HRR publishes a different `shortName` in results. Manual: follow one crew from R1 to Final.

- [ ] **No duplicate crews in the same round** — Two slots in one round should not reference the same `number` (unless intentional squad internal, e.g. Nereus A vs B on pre-placed draw). Manual/script: for each round in draw JSON, collect `berks.number` and `bucks.number`, check for duplicates.

- [ ] **Round 1 crew count vs `crewCount`** — `event.crewCount` in `events.ts` should equal twice the R1 match count for standard knockouts, or match the bye-format entry total. Compare to entries PDF crew list for the event title (e.g. `THE TEMPLE CHALLENGE CUP` → 32 crews → 16 R1 matches).

- [ ] **Draw JSON `source` / repair provenance** — Repaired events document origin in `source` field (e.g. `Phase 3: bye-aware last-16`). After regeneration, confirm `sourceUrl` still points at HRR API or draw PDF.

- [ ] **API `resultAudit.isComplete`** — `GET /api/bracket/{eventId}` → `resultAudit` from `auditResultCompleteness()` (`src/lib/result-audit.ts`). `unmatchedResultCount` should be 0 when all published results are applied. `ResultAuditBanner.tsx` shows amber banner when incomplete.

- [ ] **All published results applied** — `resultCount` (fetched) vs count of `complete` matches. Automated: deep-check script above; `audit-all-events.ts` summary columns `results` and `done` should match for events with racing underway.

- [ ] **Official naming from entries PDF** — Repair scripts (`repair-draw-from-results.py`, `phase2-bye-draws.py`) resolve names via `match_entry()`. Spot-check full `name` fields in draw JSON against entries PDF, not just `shortName` from live results.

---

## 5. Live update behavior

- [ ] **API returns fresh data** — `src/app/api/bracket/[event]/route.ts` sets `export const dynamic = 'force-dynamic'` and `Cache-Control: no-store, max-age=0`. Manual: curl `/api/bracket/pe` twice after a new result; `lastUpdated` timestamp should change; `hrrGenerated` reflects HRR API `generated` field.

- [ ] **Client SWR refresh** — `Dashboard.tsx` uses `refreshInterval: 30000` and `revalidateOnFocus: true`. Manual: keep tab open 30s+ after a result posts; bracket should update without hard refresh. `LiveIndicator` shows validating state during refetch.

- [ ] **No stale winner after refresh** — Hard refresh (Ctrl+Shift+R) and confirm completed matches still show the current HRR winner. If wrong, check whether draw JSON slot assignment (`resolveResultForMatch()`) is incorrect, not caching.

- [ ] **Retry on error** — Simulate API failure (offline dev tools); `Dashboard.tsx` should show retry button calling `mutate()`.

- [ ] **Timetable merge** — When timetable HTML updates, `mergeTimetable()` should attach `raceTime` / `raceNumber` to correct slots. Compare `/api/bracket/{event}` match fields to [race timetable](https://www.hrr.co.uk/compete/race-timetable/) for today's races.

- [ ] **Mock stale vs fresh (dev)** — Temporarily modify a result in a local test or compare `buildBracket()` output before/after `fetchEventResults()` cache bust. Confirm `tryApplyResult()` re-applies when result set changes.

---

## 6. UI/UX and responsiveness

- [ ] **Desktop bracket layout** — `Bracket.tsx` → `BracketTreeCore` with `compact={false}`. Columns 220px wide; connectors via `BracketConnectors.tsx`. No overlapping match cards at 1280px+ width.

- [ ] **Mobile bracket layout** — `BracketMobileZoom.tsx` uses `compact={true}` (`COMPACT_MATCH_WIDTH` / `COMPACT_MATCH_HEIGHT` from `bracket-layout.ts`). Pinch/zoom and scroll; no clipped text at 375px width.

- [ ] **Long names truncate safely** — `MatchCard.tsx` uses `truncate` + `title={crew?.name}` for full name on hover. Manual: test `thames`, `visitors`, or `lp` with long composite club names.

- [ ] **Station labels on R1 (desktop)** — `showStations={roundIndex === 0}` shows **B** (Berks) / **K** (Bucks) in `CrewRow`. Confirm they match result `station` field (`1 - Berks` / `2 - Bucks` from HRR API).

- [ ] **Complete match interaction** — Completed matches open `RaceResultModal` on click (`raceResultFromMatch()` in `src/lib/race-result.ts`) showing verdict and splits when available.

- [ ] **View presets / regatta days** — If `regatta-days` view presets are exposed in UI, switching day focus should dim non-focused matches (`dimUnfocused` in `BracketTreeCore`). Matches outside the selected day use `opacity-25`.

- [ ] **No console errors on load** — DevTools console clean for `/` with each major event selected from the event selector (`HomeView.tsx` / `EVENT_LIST` in `events.ts`).

- [ ] **No failed network requests** — Network tab: `/api/bracket/{eventId}` returns 200 for all 30 event ids listed in `scripts/audit-event-results.py`. 404 only for invalid ids.

- [ ] **Loading and error states** — Skeleton/loading copy in `Dashboard.tsx`; error state with retry; `ClientErrorBoundary` catches render errors.

- [ ] **Result audit banner** — When `resultAudit.isComplete === false`, amber `ResultAuditBanner` lists missing races. Banner absent when complete.

---

## 7. Edge cases

- [ ] **Incomplete round (mixed statuses)** — Some matches `complete`, others `scheduled` or `pending` in the same round. UI should show winners/losers only on complete cards; pending cards show crews or placeholders without verdict. Engine: `updateStatuses()` in `bracket-engine.ts`.

- [ ] **Final match** — Last round (`final-0` or single `grand`/`remenham` final) sets `bracket.champion` in `buildBracket()`. Champion card renders in `BracketTreeCore` `ChampionCard` when `status === 'complete'`.

- [ ] **Events with no results yet** — `grand`, `remenham`, `stewards`, etc. should render static draw without errors; `resultAudit` may show 0 complete. No false `complete` statuses.

- [ ] **Single-race finals (2-crew events)** — `grand`, `remenham`, `princess-grace`: `roundSizes: [1]`. One match only; no feeders.

- [ ] **Stewards 3-crew format** — `stewards`: `roundSizes: [1, 1]` (semi + final). Confirm structure in `src/data/stewards-2026-draw.json`.

- [ ] **No repechage unless in draw** — HRR 2026 draws in this repo are knockout / bye-format only; there is no repechage round type. `prince-albert` `qf2`/`sf2` are extra knockout stages, not FISA repechage.

- [ ] **Internal club matches** — `lp` `qf-1` (two crews on draw, no feeder), `fawley` Belen vs Belen, `temple`/`island` squad internals: result must apply to the correct side using squad-letter logic in `crew-match.ts` (`parseSquadSuffix`, `hasConflictingSquadLetters`).

- [ ] **Empty / partial R1 from repair** — `fawley` draw has `r1-8`…`r1-15` as `null` slots (only 8 Tuesday heats raced). UI should show empty heats without breaking connectors.

- [ ] **POW multi-day timetable** — `pow` uses `POW_RACE_DAYS`; races span Tue/Wed/Thu/Sat. Confirm next-race panel and round scheduling respect day boundaries.

- [ ] **Diamond handicap rounds** — `diamond` (sculls) may have non-standard round layout in `src/data/diamond-2026-draw.json`; verify separately from eights events.

- [ ] **Regenerate draws without corruption** — Run `python3 scripts/phase4-bye-draws.py` twice; `git diff` should be clean. Guards against duplicate round insertion (historical `diamond-jubilee` bug in `phase3-bye-draws.py`).

---

## Event coverage matrix

All 30 events (use when spot-checking manually):

`grand`, `remenham`, `lp`, `bridge`, `thames`, `wargrave`, `temple`, `island`, `pe`, `prince-philip`, `stewards`, `town`, `visitors`, `wyfold`, `queen-mother`, `princess-grace`, `pow`, `princess-of-wales`, `danesfield`, `queen-victoria`, `fawley`, `diamond-jubilee`, `britannia`, `prince-albert`, `goblets`, `hambleden-pairs`, `double-sculls`, `stonor`, `diamond`, `princess-royal`

Priority events for bye/progression QA (covered by `verify-phase1-engine.ts`):  
`double-sculls`, `princess-royal`, `wargrave`, `island`, `visitors`, `temple`, `pow`, `pe`, `prince-philip`, `prince-albert`

---

## Known Issues / Notes

<!-- Fill in as you find problems during QA -->
