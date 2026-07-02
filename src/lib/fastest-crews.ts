import type { BracketMatch, Crew, HrrResult } from "./types";

export type Landmark = "barrier" | "fawley" | "finish";

const LANDMARK_LABELS: Record<Landmark, string> = {
  barrier: "Barrier",
  fawley: "Fawley",
  finish: "Finish",
};

export interface FastestCrewEntry {
  crew: Crew;
  time: string;
  timeSeconds: number;
  loserLeading: boolean;
}

export interface FastestCrewsLeaderboard {
  roundIndex: number;
  roundLabel: string;
  landmark: Landmark;
  entries: FastestCrewEntry[];
}

export function landmarkLabel(landmark: Landmark): string {
  return LANDMARK_LABELS[landmark];
}

/** Parse Henley split strings such as "01:50" or "6:29" into seconds. */
export function parseSplitTime(time: string): number | null {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

export function getActiveRoundIndex(rounds: BracketMatch[][]): number | null {
  let maxRound: number | null = null;

  for (const round of rounds) {
    for (const match of round) {
      if (match.status !== "complete" || !match.winner) continue;
      if (maxRound === null || match.roundIndex > maxRound) {
        maxRound = match.roundIndex;
      }
    }
  }

  return maxRound;
}

function isWithdrawnMatch(match: BracketMatch, results: HrrResult[]): boolean {
  if (!match.winner || !match.loser) return false;

  return results.some(
    (result) =>
      result.withdrawn &&
      result.winner.name === match.winner!.name &&
      result.loser.name === match.loser!.name &&
      (match.raceNumber == null || result.number === match.raceNumber),
  );
}

function splitForLandmark(
  match: BracketMatch,
  landmark: Landmark,
): { time: string; loserLeading: boolean } | null {
  const split = match.splits?.[landmark];
  if (!split?.time) return null;
  return {
    time: split.time,
    loserLeading: landmark !== "finish" && Boolean(split.loserLeading),
  };
}

export function buildFastestCrewsLeaderboard(
  rounds: BracketMatch[][],
  landmark: Landmark,
  results: HrrResult[] = [],
): FastestCrewsLeaderboard | null {
  const activeRoundIndex = getActiveRoundIndex(rounds);
  if (activeRoundIndex === null) return null;

  const activeMatches = rounds
    .flat()
    .filter(
      (match) =>
        match.roundIndex === activeRoundIndex &&
        match.status === "complete" &&
        match.winner &&
        !isWithdrawnMatch(match, results),
    );

  if (activeMatches.length === 0) return null;

  const entries: FastestCrewEntry[] = [];

  for (const match of activeMatches) {
    if (!match.winner) continue;
    const split = splitForLandmark(match, landmark);
    if (!split) continue;

    const timeSeconds = parseSplitTime(split.time);
    if (timeSeconds === null) continue;

    entries.push({
      crew: match.winner,
      time: split.time,
      timeSeconds,
      loserLeading: split.loserLeading,
    });
  }

  if (entries.length === 0) return null;

  entries.sort((a, b) => a.timeSeconds - b.timeSeconds);

  const roundLabel =
    activeMatches[0]?.roundLabel ?? `Round ${activeRoundIndex + 1}`;

  return {
    roundIndex: activeRoundIndex,
    roundLabel,
    landmark,
    entries,
  };
}

export function hasFastestCrewsData(
  rounds: BracketMatch[][],
  results: HrrResult[] = [],
): boolean {
  return buildFastestCrewsLeaderboard(rounds, "barrier", results) !== null;
}
