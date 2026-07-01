import drawData from "@/data/pe-2026-draw.json";
import {
  crewsMatch,
  parseTimetableCrew,
  resultMatchesPair,
} from "./hrr-api";
import { enrichCrew, withSeededFlag } from "./crew-seeds";
import { EXPECTED_ROUND_SIZES } from "./bracket-layout";
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

const ROUND_LABELS = [
  "1st Round",
  "2nd Round",
  "Quarter-Final",
  "Semi-Final",
  "Final",
];

function cloneDraw(): DrawData {
  return JSON.parse(JSON.stringify(drawData)) as DrawData;
}

function getCrewName(crew: Crew | null | undefined): string | null {
  return crew?.name ?? null;
}

function buildCrewRegistry(draw: DrawData): Map<string, Crew> {
  const registry = new Map<string, Crew>();

  const register = (crew: Crew | null) => {
    if (!crew?.name) return;
    const enriched = withSeededFlag(crew);
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
): BracketMatch {
  return {
    id: match.id,
    roundIndex,
    matchIndex,
    drawRace: match.drawRace,
    roundLabel: ROUND_LABELS[roundIndex] ?? `Round ${roundIndex + 1}`,
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
  registry: Map<string, Crew>,
): BracketMatch {
  return {
    ...match,
    status: "complete",
    winner: enrichCrew(result.winner, registry) ?? result.winner,
    loser: enrichCrew(result.loser, registry) ?? result.loser,
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

function matchHasBothCrews(
  match: BracketMatch,
  crewA: string,
  crewB: string,
): boolean {
  const berks = getCrewName(match.berks);
  const bucks = getCrewName(match.bucks);
  if (!berks || !bucks) return false;
  return (
    (crewsMatch(berks, crewA) && crewsMatch(bucks, crewB)) ||
    (crewsMatch(berks, crewB) && crewsMatch(bucks, crewA))
  );
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
): BracketMatch | null {
  for (const round of rounds) {
    for (const match of round) {
      if (match.status === "complete") continue;
      if (matchHasBothCrews(match, berksRaw, bucksRaw)) {
        return match;
      }
    }
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    for (const match of rounds[ri]) {
      if (match.status === "complete") continue;
      const berks = getCrewName(match.berks);
      const bucks = getCrewName(match.bucks);
      if (berks && !bucks) {
        if (crewsMatch(berks, berksRaw) || crewsMatch(berks, bucksRaw)) {
          return match;
        }
      }
      if (!berks && bucks) {
        if (crewsMatch(bucks, berksRaw) || crewsMatch(bucks, bucksRaw)) {
          return match;
        }
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

  for (const round of rounds) {
    for (const match of round) {
      if (match.status === "complete") continue;
      if (!match.berks && !match.bucks) return match;
    }
  }

  return null;
}

function tryApplyResult(
  rounds: BracketMatch[][],
  result: HrrResult,
  registry: Map<string, Crew>,
): boolean {
  for (let ri = 0; ri < rounds.length; ri++) {
    for (let mi = 0; mi < rounds[ri].length; mi++) {
      const match = rounds[ri][mi];
      if (match.status === "complete") continue;

      if (
        matchHasBothCrews(match, result.winner.name, result.loser.name)
      ) {
        rounds[ri][mi] = applyResultToMatch(match, result, registry);
        return true;
      }

      const berks = getCrewName(match.berks);
      const bucks = getCrewName(match.bucks);
      if (berks && bucks && resultMatchesPair(result, berks, bucks)) {
        rounds[ri][mi] = applyResultToMatch(match, result, registry);
        return true;
      }
    }
  }
  return false;
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
    const match = findMatchForTimetableRace(rounds, berksRaw, bucksRaw);
    if (!match || match.status === "complete") continue;

    if (!match.berks && !match.bucks) {
      match.berks = resolveCrew(race.berks, registry);
      match.bucks = resolveCrew(race.bucks, registry);
    } else if (match.berks && !match.bucks) {
      const opponent = crewsMatch(getCrewName(match.berks)!, berksRaw)
        ? bucksRaw
        : berksRaw;
      if (!crewsMatch(getCrewName(match.berks)!, opponent)) {
        match.bucks = resolveCrew(opponent, registry);
      }
    } else if (!match.berks && match.bucks) {
      const opponent = crewsMatch(getCrewName(match.bucks)!, bucksRaw)
        ? berksRaw
        : berksRaw;
      if (!crewsMatch(getCrewName(match.bucks)!, opponent)) {
        match.berks = resolveCrew(opponent, registry);
      }
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

function validateDrawStructure(draw: DrawData): void {
  for (let i = 0; i < EXPECTED_ROUND_SIZES.length; i++) {
    const expected = EXPECTED_ROUND_SIZES[i];
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
        if (
          match.winner &&
          crewsMatch(match.winner.name, result.winner.name) &&
          match.loser &&
          crewsMatch(match.loser.name, result.loser.name)
        ) {
          matched.add(result.id);
        }
      }
    }
  }

  return results.filter((r) => !matched.has(r.id));
}

function applySeedsToDraw(draw: DrawData): void {
  for (const round of draw.rounds) {
    for (const match of round) {
      if (match.berks) match.berks = withSeededFlag(match.berks);
      if (match.bucks) match.bucks = withSeededFlag(match.bucks);
    }
  }
}

export function buildBracket(
  results: HrrResult[],
  timetable: TimetableData = { raceDay: null, races: [] },
): BracketState {
  const draw = cloneDraw();
  applySeedsToDraw(draw);
  validateDrawStructure(draw);
  const registry = buildCrewRegistry(draw);

  const rounds: BracketMatch[][] = draw.rounds.map((round, roundIndex) =>
    round.map((match, matchIndex) => {
      const bracketMatch = createEmptyMatch(match, roundIndex, matchIndex);
      bracketMatch.berks = enrichCrew(bracketMatch.berks, registry);
      bracketMatch.bucks = enrichCrew(bracketMatch.bucks, registry);
      return bracketMatch;
    }),
  );

  const sortedResults = [...results].sort(
    (a, b) =>
      new Date(a.raceDateTime).getTime() - new Date(b.raceDateTime).getTime(),
  );

  for (const result of sortedResults) {
    if (!tryApplyResult(rounds, result, registry)) {
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
      ? enrichCrew(final.winner, registry)
      : null;

  return {
    event: draw.event,
    year: draw.year,
    rounds,
    champion,
  };
}
