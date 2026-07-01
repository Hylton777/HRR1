import type { BracketMatch, Crew, HrrResult } from "./types";

export interface SplitTiming {
  time: string;
  loserLeading?: boolean;
}

export interface RaceResultDetail {
  id: string | number;
  roundLabel: string;
  raceNumber: string | null;
  raceDay: string | null;
  raceTime: string | null;
  winner: Crew;
  loser: Crew;
  verdict: string;
  station: string | null;
  withdrawn?: boolean;
  splits: {
    barrier?: SplitTiming;
    fawley?: SplitTiming;
    finish?: SplitTiming;
  };
}

function displayName(crew: Crew | null | undefined): string {
  if (!crew) return "—";
  return crew.shortName || crew.name;
}

export function formatStation(station: string | null | undefined): string | null {
  if (!station) return null;
  if (station.includes("Berks")) return "Berks";
  if (station.includes("Bucks")) return "Bucks";
  return station;
}

export function raceResultFromHrr(result: HrrResult): RaceResultDetail {
  return {
    id: result.id,
    roundLabel: result.round,
    raceNumber: result.number,
    raceDay: result.raceDay,
    raceTime: result.raceTime,
    winner: result.winner,
    loser: result.loser,
    verdict: result.verdict,
    station: result.station,
    withdrawn: result.withdrawn,
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

export function raceResultFromMatch(match: BracketMatch): RaceResultDetail | null {
  if (match.status !== "complete" || !match.winner || !match.loser || !match.verdict) {
    return null;
  }

  const splits = match.splits;
  if (!splits?.finish) return null;

  return {
    id: match.id,
    roundLabel: match.roundLabel,
    raceNumber: match.raceNumber,
    raceDay: match.raceDay,
    raceTime: match.raceTime,
    winner: match.winner,
    loser: match.loser,
    verdict: match.verdict,
    station: match.station,
    splits: {
      barrier: splits.barrier
        ? {
            time: splits.barrier.time,
            loserLeading: splits.barrier.loserLeading,
          }
        : undefined,
      fawley: splits.fawley
        ? {
            time: splits.fawley.time,
            loserLeading: splits.fawley.loserLeading,
          }
        : undefined,
      finish: splits.finish ? { time: splits.finish.time } : undefined,
    },
  };
}

export function formatRaceMeta(detail: RaceResultDetail): string {
  const parts: string[] = [];
  if (detail.raceNumber) parts.push(`Race ${detail.raceNumber}`);
  if (detail.raceDay) parts.push(detail.raceDay);
  if (detail.raceTime) parts.push(detail.raceTime);
  return parts.join(" · ");
}

export { displayName as crewDisplayName };
