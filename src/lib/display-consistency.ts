import type { EventConfig } from "@/config/events";
import { resolveRegattaDayIso } from "@/lib/regatta-days";
import { enrichCrewFromEvent } from "@/lib/crew-seeds";
import { crewResultMatchesDraw } from "@/lib/crew-match";
import {
  buildFastestCrewsLeaderboard,
  type Landmark,
} from "@/lib/fastest-crews";
import { resultMatchesDrawPair } from "@/lib/hrr-api";
import {
  crewDisplayName,
  raceResultFromHrr,
  raceResultFromMatch,
  type RaceResultDetail,
} from "@/lib/race-result";
import type {
  BracketMatch,
  Crew,
  DisplayAudit,
  DisplayInconsistency,
  HrrResult,
  UpcomingRace,
} from "@/lib/types";

const LEADERBOARD_LANDMARKS: Landmark[] = ["barrier", "fawley", "finish"];

export function crewDisplayLabel(crew: Crew | null | undefined): string {
  if (!crew) return "TBD";
  return crewDisplayName(crew);
}

export function crewsEquivalentForDisplay(
  a: Crew | null | undefined,
  b: Crew | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.number != null && b.number != null) return a.number === b.number;
  return crewResultMatchesDraw(a, b) || crewResultMatchesDraw(b, a);
}

/** True when bracket and an alternate source would show different crew names to users. */
export function hasVisibleCrewMismatch(
  bracketCrew: Crew,
  otherCrew: Crew,
): boolean {
  if (crewsEquivalentForDisplay(bracketCrew, otherCrew)) return false;
  return crewDisplayLabel(bracketCrew) !== crewDisplayLabel(otherCrew);
}

function normalizeRaceNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function raceDaysMatch(
  matchDay: string | null | undefined,
  resultDay: string | null | undefined,
  raceDays: EventConfig["raceDays"],
): boolean {
  if (!matchDay || !resultDay) return false;

  const matchIso = resolveRegattaDayIso(matchDay, raceDays);
  const resultIso = resolveRegattaDayIso(resultDay, raceDays);
  if (matchIso && resultIso) return matchIso === resultIso;

  return matchDay.toLowerCase().trim() === resultDay.toLowerCase().trim();
}

function findMatchesByRaceNumber(
  completeMatches: BracketMatch[],
  resultNumber: string,
): BracketMatch[] {
  return completeMatches.filter(
    (match) => normalizeRaceNumber(match.raceNumber) === resultNumber,
  );
}

function pickRaceNumberMatch(
  matches: BracketMatch[],
  result: HrrResult,
  event: EventConfig,
): BracketMatch | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;

  const sameDay = matches.filter((match) =>
    raceDaysMatch(match.raceDay, result.raceDay, event.raceDays),
  );
  if (sameDay.length === 1) return sameDay[0]!;

  const pool = sameDay.length > 0 ? sameDay : matches;
  for (const match of pool) {
    if (!match.berks || !match.bucks) continue;
    if (resultMatchesDrawPair(result, match.berks, match.bucks)) {
      return match;
    }
  }

  for (const match of pool) {
    if (!match.winner || !match.loser) continue;
    const winnerMatches =
      crewResultMatchesDraw(match.winner, result.winner) ||
      crewResultMatchesDraw(
        match.winner,
        enrichCrewFromEvent(result.winner, event) ?? result.winner,
      );
    const loserMatches =
      crewResultMatchesDraw(match.loser, result.loser) ||
      crewResultMatchesDraw(
        match.loser,
        enrichCrewFromEvent(result.loser, event) ?? result.loser,
      );
    if (winnerMatches && loserMatches) {
      return match;
    }
  }

  return null;
}

export function findBracketMatchForResult(
  rounds: BracketMatch[][],
  result: HrrResult,
  event: EventConfig,
): BracketMatch | null {
  const resultNumber = normalizeRaceNumber(result.number);
  const completeMatches = rounds.flat().filter((match) => match.status === "complete");

  if (resultNumber) {
    const byRaceNumber = pickRaceNumberMatch(
      findMatchesByRaceNumber(completeMatches, resultNumber),
      result,
      event,
    );
    if (byRaceNumber) return byRaceNumber;
  }

  for (const match of completeMatches) {
    if (!match.berks || !match.bucks) continue;
    if (resultMatchesDrawPair(result, match.berks, match.bucks)) {
      return match;
    }
  }

  for (const match of completeMatches) {
    if (!match.winner || !match.loser) continue;
    const winnerMatches =
      crewResultMatchesDraw(match.winner, result.winner) ||
      crewResultMatchesDraw(match.winner, enrichCrewFromEvent(result.winner, event) ?? result.winner);
    const loserMatches =
      crewResultMatchesDraw(match.loser, result.loser) ||
      crewResultMatchesDraw(match.loser, enrichCrewFromEvent(result.loser, event) ?? result.loser);
    if (winnerMatches && loserMatches) {
      return match;
    }
  }

  return null;
}

/** Bracket is canonical once a result has been applied to a match. */
export function resolveResultDisplayCrews(
  result: HrrResult,
  rounds: BracketMatch[][],
  event: EventConfig,
): { winner: Crew; loser: Crew } {
  const match = findBracketMatchForResult(rounds, result, event);
  if (match?.winner && match?.loser) {
    return { winner: match.winner, loser: match.loser };
  }

  return {
    winner: enrichCrewFromEvent(result.winner, event) ?? result.winner,
    loser: enrichCrewFromEvent(result.loser, event) ?? result.loser,
  };
}

export function resolveRaceResultDetail(
  result: HrrResult,
  rounds: BracketMatch[][],
  event: EventConfig,
): RaceResultDetail {
  const match = findBracketMatchForResult(rounds, result, event);
  if (match?.status === "complete") {
    const fromMatch = raceResultFromMatch(match);
    if (fromMatch) return fromMatch;
  }

  const { winner, loser } = resolveResultDisplayCrews(result, rounds, event);
  return {
    ...raceResultFromHrr(result),
    winner,
    loser,
  };
}

function pushInconsistency(
  inconsistencies: DisplayInconsistency[],
  issue: DisplayInconsistency,
): void {
  inconsistencies.push(issue);
}

export function auditDisplayConsistency(
  rounds: BracketMatch[][],
  results: HrrResult[],
  upcomingRaces: UpcomingRace[],
  event: EventConfig,
): DisplayAudit {
  const inconsistencies: DisplayInconsistency[] = [];
  const enrichmentDrift: DisplayInconsistency[] = [];
  const warnings: string[] = [];
  const matchById = new Map(
    rounds.flat().map((match) => [match.id, match] as const),
  );

  for (const race of upcomingRaces) {
    const match = matchById.get(race.id);
    if (!match) {
      pushInconsistency(inconsistencies, {
        area: "next_races",
        matchId: race.id,
        raceNumber: race.raceNumber,
        message: `Next race ${race.id} is not present in the bracket`,
      });
      continue;
    }

    if (!crewsEquivalentForDisplay(match.berks, race.berks)) {
      pushInconsistency(inconsistencies, {
        area: "next_races",
        matchId: race.id,
        raceNumber: race.raceNumber,
        message: `Next race ${race.id} Berks crew differs from bracket`,
        bracketLabel: crewDisplayLabel(match.berks),
        otherLabel: crewDisplayLabel(race.berks),
      });
    }

    if (!crewsEquivalentForDisplay(match.bucks, race.bucks)) {
      pushInconsistency(inconsistencies, {
        area: "next_races",
        matchId: race.id,
        raceNumber: race.raceNumber,
        message: `Next race ${race.id} Bucks crew differs from bracket`,
        bracketLabel: crewDisplayLabel(match.bucks),
        otherLabel: crewDisplayLabel(race.bucks),
      });
    }
  }

  for (const result of results) {
    const match = findBracketMatchForResult(rounds, result, event);
    if (!match || match.status !== "complete" || !match.winner || !match.loser) {
      continue;
    }

    const resolved = resolveResultDisplayCrews(result, rounds, event);
    if (hasVisibleCrewMismatch(match.winner, resolved.winner)) {
      pushInconsistency(inconsistencies, {
        area: "recent_results",
        matchId: match.id,
        raceNumber: result.number,
        message: `Race ${result.number}: canonical recent-results winner disagrees with bracket`,
        bracketLabel: crewDisplayLabel(match.winner),
        otherLabel: crewDisplayLabel(resolved.winner),
      });
    }
    if (hasVisibleCrewMismatch(match.loser, resolved.loser)) {
      pushInconsistency(inconsistencies, {
        area: "recent_results",
        matchId: match.id,
        raceNumber: result.number,
        message: `Race ${result.number}: canonical recent-results loser disagrees with bracket`,
        bracketLabel: crewDisplayLabel(match.loser),
        otherLabel: crewDisplayLabel(resolved.loser),
      });
    }

    const enrichedWinner = enrichCrewFromEvent(result.winner, event) ?? result.winner;
    const enrichedLoser = enrichCrewFromEvent(result.loser, event) ?? result.loser;

    if (hasVisibleCrewMismatch(match.winner, enrichedWinner)) {
      pushInconsistency(enrichmentDrift, {
        area: "enrichment_drift",
        matchId: match.id,
        raceNumber: result.number,
        message: `Race ${result.number}: raw enrichment would show a different winner than the bracket`,
        bracketLabel: crewDisplayLabel(match.winner),
        otherLabel: crewDisplayLabel(enrichedWinner),
      });
    }

    if (hasVisibleCrewMismatch(match.loser, enrichedLoser)) {
      pushInconsistency(enrichmentDrift, {
        area: "enrichment_drift",
        matchId: match.id,
        raceNumber: result.number,
        message: `Race ${result.number}: raw enrichment would show a different loser than the bracket`,
        bracketLabel: crewDisplayLabel(match.loser),
        otherLabel: crewDisplayLabel(enrichedLoser),
      });
    }
  }

  for (const landmark of LEADERBOARD_LANDMARKS) {
    const leaderboard = buildFastestCrewsLeaderboard(rounds, landmark, results);
    if (!leaderboard) continue;

    const activeMatches = rounds
      .flat()
      .filter(
        (match) =>
          match.roundIndex === leaderboard.roundIndex &&
          match.status === "complete" &&
          match.winner,
      );

    for (const entry of leaderboard.entries) {
      const sourceMatch = activeMatches.find(
        (match) => match.winner && crewsEquivalentForDisplay(match.winner, entry.crew),
      );

      if (!sourceMatch?.winner) {
        pushInconsistency(inconsistencies, {
          area: "leaderboard",
          message: `${landmark} leaderboard entry ${crewDisplayLabel(entry.crew)} has no matching bracket winner in ${leaderboard.roundLabel}`,
          otherLabel: crewDisplayLabel(entry.crew),
        });
        continue;
      }

      if (
        entry.crew.number != null &&
        sourceMatch.winner.number != null &&
        entry.crew.number !== sourceMatch.winner.number
      ) {
        pushInconsistency(inconsistencies, {
          area: "leaderboard",
          matchId: sourceMatch.id,
          message: `${landmark} leaderboard crew #${entry.crew.number} disagrees with bracket winner #${sourceMatch.winner.number}`,
          bracketLabel: crewDisplayLabel(sourceMatch.winner),
          otherLabel: crewDisplayLabel(entry.crew),
        });
      }
    }
  }

  if (enrichmentDrift.length > 0) {
    warnings.push(
      `${enrichmentDrift.length} result(s) would display differently without bracket-canonical crew resolution`,
    );
  }

  if (inconsistencies.some((issue) => issue.area === "next_races")) {
    warnings.push("Next races panel disagrees with bracket crew assignments");
  }

  if (inconsistencies.some((issue) => issue.area === "leaderboard")) {
    warnings.push("Fastest crews leaderboard disagrees with bracket winners");
  }

  return {
    isConsistent: inconsistencies.length === 0,
    inconsistencyCount: inconsistencies.length,
    inconsistencies,
    enrichmentDriftCount: enrichmentDrift.length,
    enrichmentDrift,
    warnings,
  };
}
