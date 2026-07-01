import drawData from "@/data/pe-2026-draw.json";
import {
  crewsMatch,
  parseTimetableCrew,
  resultMatchesPair,
} from "./hrr-api";
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

function createEmptyMatch(
  match: { id: string; berks: Crew | null; bucks: Crew | null },
  roundIndex: number,
  matchIndex: number,
): BracketMatch {
  return {
    id: match.id,
    roundIndex,
    matchIndex,
    roundLabel: ROUND_LABELS[roundIndex] ?? `Round ${roundIndex + 1}`,
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
): BracketMatch {
  const berksName = getCrewName(match.berks);
  const winnerIsBerks = berksName
    ? crewsMatch(result.winner.name, berksName)
    : false;

  return {
    ...match,
    status: "complete",
    winner: result.winner,
    loser: result.loser,
    verdict: result.verdict,
    raceNumber: result.number,
    raceTime: result.raceTime,
    raceDay: result.raceDay,
    station: result.station,
    splits: {
      barrier: result.barrier.split,
      fawley: result.fawley.split,
      finish: result.finish.split,
    },
    berks: winnerIsBerks ? result.winner : result.loser,
    bucks: winnerIsBerks ? result.loser : result.winner,
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

function propagateWinnersWhenEmpty(rounds: BracketMatch[][]): void {
  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const currentRound = rounds[ri];
    const nextRound = rounds[ri + 1];

    for (let mi = 0; mi < currentRound.length; mi++) {
      const match = currentRound[mi];
      if (match.status !== "complete" || !match.winner) continue;

      const nextMatchIndex = Math.floor(mi / 2);
      const nextSide: "berks" | "bucks" = mi % 2 === 0 ? "berks" : "bucks";
      const nextMatch = nextRound[nextMatchIndex];
      if (nextMatch && !nextMatch[nextSide]) {
        nextMatch[nextSide] = match.winner;
      }
    }
  }
}

function tryApplyResult(
  rounds: BracketMatch[][],
  result: HrrResult,
): boolean {
  for (let ri = 0; ri < rounds.length; ri++) {
    for (let mi = 0; mi < rounds[ri].length; mi++) {
      const match = rounds[ri][mi];
      if (match.status === "complete") continue;

      if (
        matchHasBothCrews(match, result.winner.name, result.loser.name)
      ) {
        rounds[ri][mi] = applyResultToMatch(match, result);
        return true;
      }

      const berks = getCrewName(match.berks);
      const bucks = getCrewName(match.bucks);
      if (berks && bucks && resultMatchesPair(result, berks, bucks)) {
        rounds[ri][mi] = applyResultToMatch(match, result);
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
): boolean {
  const berksRaw = parseTimetableCrew(race.berks);
  const bucksRaw = parseTimetableCrew(race.bucks);

  if (!matchHasBothCrews(match, berksRaw, bucksRaw)) {
    return false;
  }

  match.raceTime = race.time;
  match.raceNumber = race.raceNumber;
  if (raceDay) {
    match.raceDay = raceDay;
  }
  return true;
}

function mergeTimetable(
  rounds: BracketMatch[][],
  timetable: TimetableData,
): void {
  const { races, raceDay } = timetable;

  for (const race of races) {
    const berksRaw = parseTimetableCrew(race.berks);
    const bucksRaw = parseTimetableCrew(race.bucks);

    for (const round of rounds) {
      for (const match of round) {
        if (match.status === "complete") continue;

        const berks = getCrewName(match.berks);
        const bucks = getCrewName(match.bucks);

        if (berks && bucks) {
          applyTimetableRace(match, race, raceDay);
          continue;
        }

        if (!berks && !bucks) {
          match.berks = { name: berksRaw, shortName: berksRaw };
          match.bucks = { name: bucksRaw, shortName: bucksRaw };
          applyTimetableRace(match, race, raceDay);
        } else if (berks && !bucks) {
          const opponent = crewsMatch(berks, berksRaw) ? bucksRaw : berksRaw;
          if (!crewsMatch(berks, opponent)) {
            match.bucks = { name: opponent, shortName: opponent };
          }
        } else if (!berks && bucks) {
          const opponent = crewsMatch(bucks, bucksRaw) ? berksRaw : berksRaw;
          if (!crewsMatch(bucks, opponent)) {
            match.berks = { name: opponent, shortName: opponent };
          }
        }
      }
    }
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

export function buildBracket(
  results: HrrResult[],
  timetable: TimetableData = { raceDay: null, races: [] },
): BracketState {
  const draw = cloneDraw();

  const rounds: BracketMatch[][] = draw.rounds.map((round, roundIndex) =>
    round.map((match, matchIndex) =>
      createEmptyMatch(match, roundIndex, matchIndex),
    ),
  );

  const sortedResults = [...results].sort(
    (a, b) =>
      new Date(a.raceDateTime).getTime() - new Date(b.raceDateTime).getTime(),
  );

  for (const result of sortedResults) {
    tryApplyResult(rounds, result);
  }

  propagateWinnersWhenEmpty(rounds);
  mergeTimetable(rounds, timetable);
  updateStatuses(rounds);

  const final = rounds[rounds.length - 1][0];
  const champion =
    final.status === "complete" && final.winner ? final.winner : null;

  return {
    event: draw.event,
    year: draw.year,
    rounds,
    champion,
  };
}
