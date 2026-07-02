import type { EventConfig } from "@/config/events";
import {
  crewsMatch,
  parseTimetableCrew,
  parseTimetableCrewNumber,
  resultMatchesPair,
} from "./hrr-api";
import { enrichCrew, withSeededFlag } from "./crew-seeds";
import type {
  BracketMatch,
  BracketState,
  Crew,
  DrawData,
  HrrResult,
  TimetableData,
  TimetableRace,
  UpcomingRace,
} from "./types";

function cloneDraw(draw: DrawData): DrawData {
  return JSON.parse(JSON.stringify(draw)) as DrawData;
}

function getCrewName(crew: Crew | null | undefined): string | null {
  return crew?.name ?? null;
}

function buildCrewRegistry(
  draw: DrawData,
  event: EventConfig,
): Map<string, Crew> {
  const registry = new Map<string, Crew>();

  const register = (crew: Crew | null) => {
    if (!crew?.name) return;
    const enriched = withSeededFlag(crew, event);
    registry.set(enriched.name.toLowerCase(), enriched);
    if (enriched.shortName) {
      registry.set(enriched.shortName.toLowerCase(), enriched);
    }
  };

  for (const round of draw.rounds) {
    for (const match of round) {
      register(match.berks);
      register(match.bucks);
    }
  }

  return registry;
}

function resolveCrew(raw: string, registry: Map<string, Crew>): Crew {
  const parsed = parseTimetableCrew(raw);
  const lower = parsed.toLowerCase();

  for (const [key, crew] of registry) {
    if (crewsMatch(key, lower) || crewsMatch(crew.name, parsed)) {
      return crew;
    }
  }

  return { name: parsed, shortName: parsed, seeded: false };
}

function createEmptyMatch(
  match: {
    id: string;
    drawRace?: number;
    berks: Crew | null;
    bucks: Crew | null;
    feeders?: string[];
  },
  roundIndex: number,
  matchIndex: number,
  roundLabels: string[],
): BracketMatch {
  return {
    id: match.id,
    roundIndex,
    matchIndex,
    drawRace: match.drawRace,
    roundLabel: roundLabels[roundIndex] ?? `Round ${roundIndex + 1}`,
    feeders: match.feeders,
    berks: match.berks,
    bucks: match.bucks,
    status: "pending",
    winner: null,
    loser: null,
    verdict: null,
    raceNumber: null,
    raceTime: null,
    raceDay: null,
    splits: null,
    station: null,
  };
}

function applyResultToMatch(
  match: BracketMatch,
  result: HrrResult,
  event: EventConfig,
  registry: Map<string, Crew>,
): BracketMatch {
  return {
    ...match,
    status: "complete",
    winner: enrichCrew(result.winner, event, registry) ?? result.winner,
    loser: enrichCrew(result.loser, event, registry) ?? result.loser,
    verdict: result.verdict,
    raceNumber: result.number,
    raceTime: result.raceTime,
    raceDay: result.raceDay,
    station: result.station,
    splits: {
      barrier: {
        time: result.barrier.split,
        loserLeading: result.barrier.loserLeading,
      },
      fawley: {
        time: result.fawley.split,
        loserLeading: result.fawley.loserLeading,
      },
      finish: { time: result.finish.split },
    },
  };
}

function crewMatchesSlot(
  crew: Crew | null,
  timetableName: string,
  timetableNumber: number | null,
): boolean {
  if (!crew) return false;
  if (
    timetableNumber != null &&
    crew.number != null &&
    crew.number === timetableNumber
  ) {
    return true;
  }
  if (crewsMatch(crew.name, timetableName)) return true;
  if (crew.shortName && crewsMatch(crew.shortName, timetableName)) return true;
  return false;
}

function matchHasBothCrews(
  match: BracketMatch,
  crewA: string,
  crewB: string,
  crewANumber: number | null = null,
  crewBNumber: number | null = null,
): boolean {
  const berks = match.berks;
  const bucks = match.bucks;
  if (!berks || !bucks) return false;
  return (
    (crewMatchesSlot(berks, crewA, crewANumber) &&
      crewMatchesSlot(bucks, crewB, crewBNumber)) ||
    (crewMatchesSlot(berks, crewB, crewBNumber) &&
      crewMatchesSlot(bucks, crewA, crewANumber))
  );
}

function matchHasResultCrews(match: BracketMatch, result: HrrResult): boolean {
  const winnerNames = [result.winner.name, result.winner.shortName].filter(
    Boolean,
  ) as string[];
  const loserNames = [result.loser.name, result.loser.shortName].filter(
    Boolean,
  ) as string[];

  for (const winner of winnerNames) {
    for (const loser of loserNames) {
      if (matchHasBothCrews(match, winner, loser)) {
        return true;
      }
    }
  }
  return false;
}


function getRoundWinners(round: BracketMatch[]): Set<string> {
  const winners = new Set<string>();
  for (const match of round) {
    if (match.status === "complete" && match.winner?.name) {
      winners.add(match.winner.name);
    }
  }
  return winners;
}

function buildMatchIndex(
  rounds: BracketMatch[][],
): Map<string, BracketMatch> {
  const map = new Map<string, BracketMatch>();
  for (const round of rounds) {
    for (const match of round) {
      map.set(match.id, match);
    }
  }
  return map;
}

function getFeederWinner(
  matchById: Map<string, BracketMatch>,
  feederId: string,
): Crew | null {
  const feeder = matchById.get(feederId);
  if (feeder?.status === "complete" && feeder.winner) {
    return feeder.winner;
  }
  return null;
}

/** Fill empty berks/bucks slots from completed feeder races (e.g. Wyfold R2, QF). */
function propagateFeederWinners(
  rounds: BracketMatch[][],
  event: EventConfig,
  registry: Map<string, Crew>,
  matchById: Map<string, BracketMatch>,
): boolean {
  let changed = false;

  for (const round of rounds) {
    for (const match of round) {
      if (match.status === "complete" || !match.feeders?.length) continue;

      if (match.feeders.length === 2) {
        const feederBerks = getFeederWinner(matchById, match.feeders[0]);
        const feederBucks = getFeederWinner(matchById, match.feeders[1]);

        if (!match.berks && feederBerks) {
          match.berks = enrichCrew(feederBerks, event, registry);
          changed = true;
        }
        if (!match.bucks && feederBucks) {
          match.bucks = enrichCrew(feederBucks, event, registry);
          changed = true;
        }
        continue;
      }

      if (match.feeders.length === 1) {
        const feederWinner = getFeederWinner(matchById, match.feeders[0]);
        if (!feederWinner) continue;

        if (match.berks && !match.bucks) {
          match.bucks = enrichCrew(feederWinner, event, registry);
          changed = true;
        } else if (!match.berks && match.bucks) {
          match.berks = enrichCrew(feederWinner, event, registry);
          changed = true;
        }
      }
    }
  }

  return changed;
}

function pairMatchesRoundWinners(
  rounds: BracketMatch[][],
  roundIndex: number,
  crewA: string,
  crewB: string,
): boolean {
  if (roundIndex <= 0) return false;
  const prevWinners = getRoundWinners(rounds[roundIndex - 1]);
  if (prevWinners.size === 0) return false;

  const aIsWinner = [...prevWinners].some((w) => crewsMatch(w, crewA));
  const bIsWinner = [...prevWinners].some((w) => crewsMatch(w, crewB));
  return aIsWinner && bIsWinner;
}

function findMatchForTimetableRace(
  rounds: BracketMatch[][],
  berksRaw: string,
  bucksRaw: string,
  berksNumber: number | null,
  bucksNumber: number | null,
): BracketMatch | null {
  for (const round of rounds) {
    for (const match of round) {
      if (match.status === "complete") continue;
      if (matchHasBothCrews(match, berksRaw, bucksRaw, berksNumber, bucksNumber)) {
        return match;
      }
    }
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    if (!pairMatchesRoundWinners(rounds, ri, berksRaw, bucksRaw)) continue;
    for (const match of rounds[ri]) {
      if (match.status === "complete") continue;
      if (!match.berks && !match.bucks) return match;
    }
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    for (const match of rounds[ri]) {
      if (match.status === "complete") continue;
      const berks = getCrewName(match.berks);
      const bucks = getCrewName(match.bucks);
      if (berks && !bucks) {
        if (
          crewMatchesSlot(match.berks, berksRaw, berksNumber) ||
          crewMatchesSlot(match.berks, bucksRaw, bucksNumber)
        ) {
          return match;
        }
      }
      if (!berks && bucks) {
        if (
          crewMatchesSlot(match.bucks, berksRaw, berksNumber) ||
          crewMatchesSlot(match.bucks, bucksRaw, bucksNumber)
        ) {
          return match;
        }
      }
    }
  }

  return null;
}

function resultMatchesByRaceNumber(
  match: BracketMatch,
  result: HrrResult,
): boolean {
  if (!match.raceNumber || !result.number) return false;
  return match.raceNumber.trim() === result.number.trim();
}

function tryApplyResult(
  rounds: BracketMatch[][],
  result: HrrResult,
  event: EventConfig,
  registry: Map<string, Crew>,
  matchById: Map<string, BracketMatch>,
): boolean {
  for (let ri = 0; ri < rounds.length; ri++) {
    for (let mi = 0; mi < rounds[ri].length; mi++) {
      const match = rounds[ri][mi];
      if (match.status === "complete") continue;

      if (matchHasResultCrews(match, result)) {
        rounds[ri][mi] = applyResultToMatch(match, result, event, registry);
        return true;
      }

      const berks = getCrewName(match.berks);
      const bucks = getCrewName(match.bucks);
      if (berks && bucks && resultMatchesPair(result, berks, bucks)) {
        rounds[ri][mi] = applyResultToMatch(match, result, event, registry);
        return true;
      }

      if (match.feeders?.length === 2) {
        const feederBerks = getFeederWinner(matchById, match.feeders[0]);
        const feederBucks = getFeederWinner(matchById, match.feeders[1]);
        if (
          feederBerks &&
          feederBucks &&
          resultMatchesPair(result, feederBerks.name, feederBucks.name)
        ) {
          const prepared: BracketMatch = {
            ...match,
            berks:
              match.berks ?? enrichCrew(feederBerks, event, registry),
            bucks:
              match.bucks ?? enrichCrew(feederBucks, event, registry),
          };
          rounds[ri][mi] = applyResultToMatch(
            prepared,
            result,
            event,
            registry,
          );
          return true;
        }
      }

      if (
        resultMatchesByRaceNumber(match, result) &&
        match.berks &&
        match.bucks
      ) {
        const berksName = getCrewName(match.berks);
        const bucksName = getCrewName(match.bucks);
        if (
          berksName &&
          bucksName &&
          (matchHasResultCrews(match, result) ||
            resultMatchesPair(result, berksName, bucksName))
        ) {
          rounds[ri][mi] = applyResultToMatch(match, result, event, registry);
          return true;
        }
      }
    }
  }
  return false;
}

function tryApplyResultByRaceNumber(
  rounds: BracketMatch[][],
  result: HrrResult,
  event: EventConfig,
  registry: Map<string, Crew>,
): boolean {
  if (!result.number) return false;

  const candidates: Array<{ ri: number; mi: number; match: BracketMatch }> = [];

  for (let ri = 0; ri < rounds.length; ri++) {
    for (let mi = 0; mi < rounds[ri].length; mi++) {
      const match = rounds[ri][mi];
      if (match.status === "complete") continue;
      if (!resultMatchesByRaceNumber(match, result)) continue;
      if (!match.berks || !match.bucks) continue;

      const berksName = getCrewName(match.berks);
      const bucksName = getCrewName(match.bucks);
      if (
        berksName &&
        bucksName &&
        (matchHasResultCrews(match, result) ||
            resultMatchesPair(result, berksName, bucksName))
      ) {
        candidates.push({ ri, mi, match });
      }
    }
  }

  if (candidates.length !== 1) return false;

  const { ri, mi, match } = candidates[0]!;
  rounds[ri][mi] = applyResultToMatch(match, result, event, registry);
  return true;
}

function applyTimetableRace(
  match: BracketMatch,
  race: TimetableRace,
  raceDay: string | null,
): void {
  match.raceTime = race.time;
  match.raceNumber = race.raceNumber;
  if (raceDay) {
    match.raceDay = raceDay;
  }
}

function mergeTimetable(
  rounds: BracketMatch[][],
  timetable: TimetableData,
  registry: Map<string, Crew>,
): void {
  const { races, raceDay } = timetable;
  const sortedRaces = [...races].sort((a, b) => {
    const numA = parseInt(a.raceNumber, 10) || 0;
    const numB = parseInt(b.raceNumber, 10) || 0;
    return numA - numB || a.time.localeCompare(b.time);
  });

  for (const race of sortedRaces) {
    const berksRaw = parseTimetableCrew(race.berks);
    const bucksRaw = parseTimetableCrew(race.bucks);
    const berksNumber = parseTimetableCrewNumber(race.berks);
    const bucksNumber = parseTimetableCrewNumber(race.bucks);
    const match = findMatchForTimetableRace(
      rounds,
      berksRaw,
      bucksRaw,
      berksNumber,
      bucksNumber,
    );
    if (!match || match.status === "complete") continue;

    const bothDrawCrewsKnown = Boolean(match.berks && match.bucks);
    const emptySlot = !match.berks && !match.bucks;

    if (emptySlot) {
      if (!pairMatchesRoundWinners(rounds, match.roundIndex, berksRaw, bucksRaw)) {
        continue;
      }
      match.berks = resolveCrew(race.berks, registry);
      match.bucks = resolveCrew(race.bucks, registry);
    } else if (match.berks && !match.bucks) {
      const opponentRaw = crewMatchesSlot(match.berks, berksRaw, berksNumber)
        ? race.bucks
        : race.berks;
      match.bucks = resolveCrew(opponentRaw, registry);
    } else if (!match.berks && match.bucks) {
      const opponentRaw = crewMatchesSlot(match.bucks, bucksRaw, bucksNumber)
        ? race.berks
        : race.bucks;
      match.berks = resolveCrew(opponentRaw, registry);
    } else if (!bothDrawCrewsKnown) {
      continue;
    }

    applyTimetableRace(match, race, raceDay);
  }
}

function updateStatuses(rounds: BracketMatch[][]): void {
  for (const round of rounds) {
    for (const match of round) {
      if (match.status === "complete") continue;
      if (match.berks && match.bucks) {
        match.status = "scheduled";
      }
    }
  }
}

export function collectUpcomingRaces(rounds: BracketMatch[][]): UpcomingRace[] {
  const upcoming = rounds
    .flat()
    .filter((match) => match.status === "scheduled")
    .map((match) => ({
      id: match.id,
      roundLabel: match.roundLabel,
      berks: match.berks,
      bucks: match.bucks,
      raceNumber: match.raceNumber,
      raceTime: match.raceTime,
      raceDay: match.raceDay,
    }));

  return upcoming.sort((a, b) => {
    if (a.raceTime && b.raceTime) {
      return a.raceTime.localeCompare(b.raceTime);
    }
    if (a.raceTime) return -1;
    if (b.raceTime) return 1;
    return 0;
  });
}

function validateDrawStructure(
  draw: DrawData,
  roundSizes: readonly number[],
): void {
  for (let i = 0; i < roundSizes.length; i++) {
    const expected = roundSizes[i];
    const actual = draw.rounds[i]?.length ?? 0;
    if (actual !== expected) {
      console.warn(
        `[bracket] Draw round ${i + 1}: expected ${expected} matches, found ${actual}`,
      );
    }
  }
}

function countUnmatchedResults(
  rounds: BracketMatch[][],
  results: HrrResult[],
): HrrResult[] {
  const matched = new Set<number>();

  for (const result of results) {
    for (const round of rounds) {
      for (const match of round) {
        if (match.status !== "complete") continue;
        if (!match.winner || !match.loser) continue;

        const winnerNames = [result.winner.name, result.winner.shortName].filter(
          Boolean,
        ) as string[];
        const loserNames = [result.loser.name, result.loser.shortName].filter(
          Boolean,
        ) as string[];

        const winnerMatched = winnerNames.some((name) =>
          crewsMatch(match.winner!.name, name),
        );
        const loserMatched = loserNames.some((name) =>
          crewsMatch(match.loser!.name, name),
        );

        if (winnerMatched && loserMatched) {
          matched.add(result.id);
        }
      }
    }
  }

  return results.filter((r) => !matched.has(r.id));
}

function applySeedsToDraw(draw: DrawData, event: EventConfig): void {
  for (const round of draw.rounds) {
    for (const match of round) {
      if (match.berks) match.berks = withSeededFlag(match.berks, event);
      if (match.bucks) match.bucks = withSeededFlag(match.bucks, event);
    }
  }
}

export function buildBracket(
  event: EventConfig,
  results: HrrResult[],
  timetable: TimetableData = { raceDay: null, races: [] },
): BracketState {
  const draw = cloneDraw(event.draw);
  applySeedsToDraw(draw, event);
  validateDrawStructure(draw, event.roundSizes);
  const registry = buildCrewRegistry(draw, event);

  const rounds: BracketMatch[][] = draw.rounds.map((round, roundIndex) =>
    round.map((match, matchIndex) => {
      const bracketMatch = createEmptyMatch(
        match,
        roundIndex,
        matchIndex,
        event.roundLabels,
      );
      bracketMatch.berks = enrichCrew(bracketMatch.berks, event, registry);
      bracketMatch.bucks = enrichCrew(bracketMatch.bucks, event, registry);
      return bracketMatch;
    }),
  );

  const sortedResults = [...results].sort(
    (a, b) =>
      new Date(a.raceDateTime).getTime() - new Date(b.raceDateTime).getTime(),
  );

  const applied = new Set<number>();
  const maxIterations = Math.max(sortedResults.length * 4, 16);
  let iterations = 0;
  let progress = true;

  while (progress && iterations < maxIterations) {
    progress = false;
    iterations += 1;
    const matchById = buildMatchIndex(rounds);

    for (const result of sortedResults) {
      if (applied.has(result.id)) continue;
      if (
        tryApplyResult(rounds, result, event, registry, matchById)
      ) {
        applied.add(result.id);
        progress = true;
      }
    }

    for (const result of sortedResults) {
      if (applied.has(result.id)) continue;
      if (tryApplyResultByRaceNumber(rounds, result, event, registry)) {
        applied.add(result.id);
        progress = true;
      }
    }

    if (
      propagateFeederWinners(rounds, event, registry, buildMatchIndex(rounds))
    ) {
      progress = true;
    }
  }

  for (const result of sortedResults) {
    if (!applied.has(result.id)) {
      console.warn(
        `[bracket] Unmatched result: race ${result.number} ${result.winner.name} beat ${result.loser.name}`,
      );
    }
  }

  const unmatched = countUnmatchedResults(rounds, sortedResults);
  if (unmatched.length > 0) {
    console.warn(
      `[bracket] ${unmatched.length} result(s) not applied to draw slots`,
    );
  }

  mergeTimetable(rounds, timetable, registry);
  updateStatuses(rounds);

  const final = rounds[rounds.length - 1][0];
  const champion =
    final.status === "complete" && final.winner
      ? enrichCrew(final.winner, event, registry)
      : null;

  return {
    event: draw.event,
    year: draw.year,
    rounds,
    champion,
  };
}
