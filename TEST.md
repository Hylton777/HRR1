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
| Display consistency | `src/lib/display-consistency.ts` | Canonical crew resolution + cross-surface audit |
| Seeding | `src/lib/crew-seeds.ts` → `isSeededCrew()` | Maps `seededCrewNumbers` → `crew.seeded` |
| UI tree | `src/components/BracketTreeCore.tsx` → `MatchCard.tsx` | Renders rounds, connectors, match cards |
| Client fetch | `src/components/Dashboard.tsx` | SWR on `/api/bracket/{eventId}`, 30s refresh |
| API route | `src/app/api/bracket/[event]/route.ts` | `Cache-Control: no-store`; returns `resultAudit`, `displayAudit`, `bracketWarnings` |
| Draw repair | `scripts/phase2-bye-draws.py`, `phase3-bye-draws.py`, `phase4-bye-draws.py` | Bye-format draw JSON regeneration |
| Entries PDF | `scripts/generate-all-events.py`, `repair-draw-from-results.py` | `HRR-List-of-Entries-2026.pdf` on CloudFront |

**Match status values:** `pending` → `scheduled` (both `berks` and `bucks` known) → `complete` (result applied).

**Bye-format events** (single `feeders` entry, one side pre-placed): `lp`, `bridge`, `town`, `queen-mother`, `visitors`, `princess-royal`, `queen-victoria` (see `BYE_FORMAT_IDS` in `scripts/generate-all-events.py`), plus manually repaired draws: `wargrave`, `prince-philip`, `island`, `prince-albert`, `fawley`, `diamond-jubilee`, `temple`.

**Seeding display convention (important):** On the official Henley draw chart, seeded crews are printed in *italics*. **This app uses `font-bold` for seeded crews** (`isSeededCrew()` in `src/lib/crew-seeds.ts`, applied in `MatchCard.tsx`, `NextRacesPanel.tsx`, `RaceResultCard.tsx`). *Italic* in the UI means an **empty slot** (`TBD` or a feeder placeholder from `feederPlaceholderLabel()` in `src/lib/feeder-label.ts`), not seeding.

**Display sources of truth (important):** Crew names can arrive from three places — the static **draw JSON**, live **HRR results**, and the scraped **timetable**. The bracket engine merges these when applying results. For anything the user reads, the **built bracket** is canonical once a race is `complete`:

| UI surface | Component | Crew name source |
|------------|-----------|------------------|
| Knockout bracket | `MatchCard.tsx` | `BracketMatch.berks` / `bucks` / `winner` / `loser` from `buildBracket()` |
| Next races | `NextRacesPanel.tsx` | `upcomingRaces[]` — same `BracketMatch` crews via `collectUpcomingRaces()` |
| Recent results | `RaceResultCard.tsx` | `resolveResultDisplayCrews()` → bracket match when applied, else enriched draw |
| Fastest crews | `FastestCrewsModal.tsx` | `buildFastestCrewsLeaderboard()` → `match.winner` from bracket |
| Race detail modal | `RaceResultModal.tsx` | `raceResultFromMatch()` when opened from bracket; `resolveRaceResultDetail()` from recent results |

Cross-surface consistency is audited by `auditDisplayConsistency()` in `src/lib/display-consistency.ts` and exposed on the API as `displayAudit`. A rose `DisplayConsistencyBanner` appears when user-visible surfaces disagree.

---

## Automated pre-flight (run before manual QA)

Run from the project root:

```bash
# 1. Engine + slot-aware result application (10 bye/complex events)
npx tsx scripts/verify-phase1-engine.ts

# 2. Full 30-event audit: progression, feeders, name drift, timing
npx tsx scripts/audit-all-events.ts

# 3. Cross-surface display consistency (bracket vs next races, results, leaderboard)
npx tsx scripts/audit-display-consistency.ts

# 4. Ten-crew bye draw feeder wiring (Ladies/Bridge/Q Victoria pattern)
npx tsx scripts/validate-bye-draws.ts

# 5. Timetable vs results day ordering
npx tsx scripts/audit-timing.ts

# 6. Production build (types + lint)
npm run build
```

With the dev server running (`npm run dev`):

```bash
# 5. API-level result completeness for all events
python3 scripts/audit-event-results.py http://localhost:3000
```

**Pass criteria:** `verify-phase1-engine.ts` prints `PASS`; `audit-all-events.ts` ends with `ISSUES: 0 errors, 0 warnings`; `audit-display-consistency.ts` prints `PASS` (enrichment drift warnings are acceptable — see §4); `validate-bye-draws.ts` prints `PASS`; `npm run build` succeeds.

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

- [ ] **Ten-crew bye feeder wiring** — Events with `roundSizes: [2, 4, 2, 1]` (`lp`, `bridge`, `queen-victoria`): first heat (`r1-0`) feeds **qf-0** (Q1), second heat (`r1-1`) feeds **qf-3** (Q4). `qf-1` and `qf-2` are straight bye races with no feeders. Automated: `npx tsx scripts/validate-bye-draws.ts`. Common mistake: both heat winners feeding the top two quarter-finals (fixed for `bridge` 2026, `queen-victoria` 2026).

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

- [ ] **Temple draw-sheet order** — R1 array follows the official draw top-to-bottom (race 1 = `r1-0` Brookes 'E' vs Asopos; race 16 = `r1-15` London vs Newcastle). Adjacent feeders then wire correctly: heats 3+4 → `r2-1` (Njord vs Washington), 5+6 → `r2-2` (Laga vs Wesleyan), 13+14 → `r2-6` (day-2 race 7), 15+16 → `r2-7` (day-2 race 8). Automated repair: `scripts/phase3-bye-draws.py` `repair_temple()`. Confirm bracket connectors align and all 24 Temple results apply.

- [ ] **Wargrave draw-sheet order** — R1 follows the continued draw page top-to-bottom (race 1 = `r1-0` York vs Bristol; race 8 = `r1-7` Molesey 'C' vs Vesta 'A'). Wednesday last-16 bye pairings: `r2-0` Mercantile + Bristol winner, `r2-3` Thames 'A' + London 'B' winner, `r2-4` London 'A' + Cambridge winner, `r2-5` Tyne + Thames 'B' winner, `r2-6` Molesey 'A' + Lea winner, `r2-7` Sydney + Molesey 'C' winner. Distinct squad `shortName` values required for Thames/Molesey/London/Vesta. Automated repair: `scripts/phase2-bye-draws.py` `repair_wargrave()`. Confirm all 18 Wargrave results apply.

- [ ] **Regatta day per round** — `raceDays` in `events.ts` drives which rounds are expected on which day (`getScheduledRegattaDayForRound()` in `src/lib/regatta-days.ts`). Manual: on Wednesday, Wednesday-round matches may show times; Friday rounds should not show stale times from timetable bleed (`stripUnpublishedScheduleTimes` in `bracket-engine.ts`).

---

## 3. Seeding display

> **Convention:** Official chart = italics; **this app = bold** for seeded. Do not expect italics on named crews.

- [ ] **Seeded crews render bold** — Crews whose `number` is in `event.seededCrewNumbers` (`src/config/events.ts`) or with `crew.seeded === true` (set by `withSeededFlag()` in `bracket-engine.ts`) should use `font-bold` in `MatchCard.tsx` `CrewRow` and compact boxes. Manual: pick a seeded crew from the official draw (italic on PDF) and confirm **bold** on site.

- [ ] **Unseeded crews are not bold** — Crews not in `seededCrewNumbers` should use normal weight (or `font-medium` when winner). Manual: compare a known unseeded R1 crew.

- [ ] **`seededCrewNumbers` aligns with official draw** — Cross-check `seededCrewNumbers` for an event against italic entries on the draw PDF. Entries list: `HRR-List-of-Entries-2026.pdf` (parsed by `parse_entries()` in `scripts/generate-all-events.py`). Flag any crew italic on the chart but missing from `seededCrewNumbers`, or vice versa (e.g. pre-qualified but not seeded — Goblets #753 lesson in `.cursor/skills/add-henley-event/SKILL.md`).

- [ ] **Italic means empty, not seeded** — Slots without a `Crew` object should show italic `TBD` or `Winner of …` placeholder (`MatchCard.tsx` line ~102: `text-[var(--muted)] italic`). Confirm no seeded crew name appears in italic.

- [ ] **Seeding consistent across UI surfaces** — `NextRacesPanel.tsx`, `RaceResultCard.tsx`, `RaceResultModal.tsx`, `FastestCrewsModal.tsx`, and champion card in `BracketTreeCore.tsx` all use `isSeededCrew()` for bold styling. Spot-check the same crew in bracket, next races, recent results, and fastest-crews modal.

- [ ] **Winner/loser styling does not fake seeding** — Winners get `font-medium` or `font-bold` (if seeded); losers get line-through. Seeding bold should only come from `isSeededCrew()`, not from win state alone.

---

## 4. Cross-surface display consistency

The draw, HRR results, and timetable can all supply crew names. Once `buildBracket()` has applied a result, every UI surface must show the same crews for that race.

- [ ] **Bracket is canonical for completed races** — `resolveResultDisplayCrews()` and `resolveRaceResultDetail()` in `src/lib/display-consistency.ts` look up the matching `BracketMatch` (by race number, then crew pair) and return `match.winner` / `match.loser` with draw `number` and `shortName`. Automated: `audit-display-consistency.ts` verifies the canonical recent-results path matches the bracket.

- [ ] **Next races ↔ bracket** — `upcomingRaces` is built from `collectUpcomingRaces(bracket.rounds)`; each entry's `id`, `berks`, and `bucks` must match the corresponding scheduled `BracketMatch`. Automated: `auditDisplayConsistency()` category `next_races`.

- [ ] **Recent results ↔ bracket** — `RaceResultCard.tsx` calls `resolveResultDisplayCrews()` so the list shows the same names as clicking the completed match on the bracket. Manual: pick a completed race (e.g. PE King's Coll. Sch. vs Deerfield) and compare bracket card, recent-results row, and race detail modal.

- [ ] **Fastest crews ↔ bracket** — `buildFastestCrewsLeaderboard()` reads `match.winner` from completed matches in the active round; each leaderboard row must map to a bracket winner with the same crew `number`. Automated: `auditDisplayConsistency()` category `leaderboard`.

- [ ] **API `displayAudit.isConsistent`** — `GET /api/bracket/{eventId}` → `displayAudit`. When `isConsistent === false`, rose `DisplayConsistencyBanner` lists mismatches. When `enrichmentDriftCount > 0` only, raw `enrichCrewFromEvent()` would have shown different names but the UI is still correct because the bracket path is used.

- [ ] **Enrichment drift monitoring** — `displayAudit.enrichmentDrift` records cases where raw enrichment would disagree with the bracket (e.g. similar school names, squad letters, composite clubs). These are warnings, not user-visible bugs, as long as `isConsistent === true`. Investigate drift entries when improving `crew-match.ts`.

- [ ] **Similar-name regression cases** — After crew-matching changes, manually verify:
  - PE: King's Coll. Sch. (#273) ≠ King's Sch., Worcester (#295) ≠ King's Sch., Chester (#293)
  - Events with multiple squads: `wargrave` Thames/Molesey/London A vs B, `temple` Nereus 'A'/'B', `fawley` Belen 'A'/'B'
  - Composite clubs: `Leander Club` vs `Leander Club & Leeds`

---

## 5. Data consistency (draw & results)

- [ ] **Crew `number` stable across rounds** — When a crew progresses, `enrichCrew()` / `CrewRegistry` (`src/lib/crew-seeds.ts`) should preserve `number` from the draw. Automated: `audit-all-events.ts` category `name_drift` when feeder winner `#` ≠ slot `#`.

- [ ] **`shortName` vs `name` consistency** — Display uses `shortName || name` (`MatchCard.tsx` `displayName()`). Same crew should not change display string arbitrarily between rounds unless HRR publishes a different `shortName` in results. Manual: follow one crew from R1 to Final.

- [ ] **No duplicate crews in the same round** — Two slots in one round should not reference the same `number` (unless intentional squad internal, e.g. Nereus A vs B on pre-placed draw). Manual/script: for each round in draw JSON, collect `berks.number` and `bucks.number`, check for duplicates.

- [ ] **Round 1 crew count vs `crewCount`** — `event.crewCount` in `events.ts` should equal twice the R1 match count for standard knockouts, or match the bye-format entry total. Compare to entries PDF crew list for the event title (e.g. `THE TEMPLE CHALLENGE CUP` → 32 crews → 16 R1 matches).

- [ ] **Draw JSON `source` / repair provenance** — Repaired events document origin in `source` field (e.g. `Phase 3: bye-aware last-16`). After regeneration, confirm `sourceUrl` still points at HRR API or draw PDF.

- [ ] **API `resultAudit.isComplete`** — `GET /api/bracket/{eventId}` → `resultAudit` from `auditResultCompleteness()` (`src/lib/result-audit.ts`). `unmatchedResultCount` should be 0 when all published results are applied. `ResultAuditBanner.tsx` shows amber banner when incomplete.

- [ ] **All published results applied** — `resultCount` (fetched) vs count of `complete` matches. Automated: deep-check script above; `audit-all-events.ts` summary columns `results` and `done` should match for events with racing underway.

- [ ] **Official naming from entries PDF** — Repair scripts (`repair-draw-from-results.py`, `phase2-bye-draws.py`) resolve names via `match_entry()`. Spot-check full `name` fields in draw JSON against entries PDF, not just `shortName` from live results.

---

## 6. Live update behavior

- [ ] **API returns fresh data** — `src/app/api/bracket/[event]/route.ts` sets `export const dynamic = 'force-dynamic'` and `Cache-Control: no-store, max-age=0`. Manual: curl `/api/bracket/pe` twice after a new result; `lastUpdated` timestamp should change; `hrrGenerated` reflects HRR API `generated` field.

- [ ] **Client SWR refresh** — `Dashboard.tsx` uses `refreshInterval: 30000` and `revalidateOnFocus: true`. Manual: keep tab open 30s+ after a result posts; bracket should update without hard refresh. `LiveIndicator` shows validating state during refetch.

- [ ] **No stale winner after refresh** — Hard refresh (Ctrl+Shift+R) and confirm completed matches still show the current HRR winner. If wrong, check whether draw JSON slot assignment (`resolveResultForMatch()`) is incorrect, not caching.

- [ ] **Retry on error** — Simulate API failure (offline dev tools); `Dashboard.tsx` should show retry button calling `mutate()`.

- [ ] **Timetable merge** — When timetable HTML updates, `mergeTimetable()` should attach `raceTime` / `raceNumber` to correct slots. Compare `/api/bracket/{event}` match fields to [race timetable](https://www.hrr.co.uk/compete/race-timetable/) for today's races.

- [ ] **Mock stale vs fresh (dev)** — Temporarily modify a result in a local test or compare `buildBracket()` output before/after `fetchEventResults()` cache bust. Confirm `tryApplyResult()` re-applies when result set changes.

---

## 7. UI/UX and responsiveness

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

## 8. Edge cases

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

### Latest automated run (London 2026-07-02)

| Check | Result |
|-------|--------|
| `verify-phase1-engine.ts` | **PASS** (10/10 target events, all results applied) |
| `audit-all-events.ts` | **PASS** — 0 errors, 0 warnings (30 events) |
| `audit-display-consistency.ts` | **PASS** — 0 cross-surface mismatches (31 enrichment drift warnings) |
| `audit-timing.ts` | **PASS** — 0 missing / 0 premature |
| `test-deep-check.ts` | **PASS** — 232/232 results applied, all `roundSizes` match draw |
| `npm run build` | **PASS** |
| `phase4-bye-draws.py` re-run | **Idempotent** (no diff) |
| Home `GET /` | **200** |
| All 30 `GET /api/bracket/{id}` | **200**, `bracketWarnings: []`, `Cache-Control: no-store` |

**`audit-event-results.py` (API `resultAudit.isComplete`):** exit 1 — six events flag *scheduled but not yet rowed* races, not data bugs:

| Event | Pending match(es) | Notes |
|-------|-------------------|-------|
| `temple` | `r2-5` Syracuse vs Oxford Brookes 'D' | 8/8 R2 complete; 24/24 HRR results applied |
| `fawley` | `r2-6`, `r2-7` | Thursday last-16 not yet rowed |
| `island` | `qf-7` Nereus vs London | QF not yet rowed |
| `lp` | `r1-1` | Thursday heat pending |
| `britannia` | `qf-0`…`qf-3` | Wednesday QFs pending |
| `diamond` | `r1-6`, `r1-7` | R1 heats pending |

`ResultAuditBanner` showing for these events is **expected** until HRR publishes results. Re-run API audit after racing: `python3 scripts/audit-event-results.py http://localhost:3000`.

**Manual QA not run in CI:** mobile pinch/zoom layout, long-name truncation hover, browser console inspection — see sections 3 and 6 above.

<!-- Add further issues below as you find them -->
