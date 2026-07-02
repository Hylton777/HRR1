import type { EventConfig } from "@/config/events";
import {
  getLondonTodayIso,
  getMatchRegattaDay,
  groupMatchesByDay,
} from "./regatta-days";
import { crewsMatch } from "./crew-match";
import type { BracketMatch, HrrResult, ResultAudit } from "./types";

function isRacedMatch(match: BracketMatch): boolean {
  return Boolean(match.berks?.name && match.bucks?.name);
}

function parseRaceTimeMinutes(raceTime: string | null): number | null {
  if (!raceTime) return null;
  const match = raceTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function getLondonNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  return hour * 60 + minute;
}

function isLikelyPastRace(
  match: BracketMatch,
  raceDays: EventConfig["raceDays"],
): boolean {
  const day = getMatchRegattaDay(match, raceDays);
  if (!day) return false;

  const today = getLondonTodayIso();
  if (day.isoDate < today) return true;
  if (day.isoDate > today) return false;

  const raceMinutes = parseRaceTimeMinutes(match.raceTime);
  if (raceMinutes == null) return false;

  // Allow a short buffer after scheduled time before flagging missing results.
  return getLondonNowMinutes() >= raceMinutes + 45;
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

function formatCrewLabel(crew: BracketMatch["berks"]): string {
  if (!crew) return "TBD";
  return crew.shortName ?? crew.name;
}

export function auditResultCompleteness(
  rounds: BracketMatch[][],
  results: HrrResult[],
  event: EventConfig,
): ResultAudit {
  const allMatches = rounds.flat();
  const racedMatches = allMatches.filter(isRacedMatch);
  const completeMatches = racedMatches.filter((m) => m.status === "complete");
  const unmatchedResults = countUnmatchedResults(rounds, results);

  const missingResults: ResultAudit["missingResults"] = [];
  const incompleteDays: ResultAudit["incompleteDays"] = [];
  const warnings: string[] = [];
  const flaggedIds = new Set<string>();

  const dayGroups = groupMatchesByDay(racedMatches, event.raceDays);

  for (const { day, matches } of dayGroups) {
    const complete = matches.filter((m) => m.status === "complete");
    const missing = matches.filter((m) => m.status !== "complete");

    if (complete.length > 0 && missing.length > 0) {
      incompleteDays.push({
        raceDay: day.label,
        isoDate: day.isoDate,
        complete: complete.length,
        missing: missing.length,
      });

      for (const match of missing) {
        missingResults.push({
          matchId: match.id,
          roundLabel: match.roundLabel,
          raceDay: match.raceDay,
          raceNumber: match.raceNumber,
          raceTime: match.raceTime,
          berks: formatCrewLabel(match.berks),
          bucks: formatCrewLabel(match.bucks),
          reason: "same_day_partial",
        });
        flaggedIds.add(match.id);
      }
    }
  }

  for (const match of racedMatches) {
    if (match.status === "complete" || flaggedIds.has(match.id)) continue;

    if (isLikelyPastRace(match, event.raceDays)) {
      missingResults.push({
        matchId: match.id,
        roundLabel: match.roundLabel,
        raceDay: match.raceDay,
        raceNumber: match.raceNumber,
        raceTime: match.raceTime,
        berks: formatCrewLabel(match.berks),
        bucks: formatCrewLabel(match.bucks),
        reason: "past_race_time",
      });
      flaggedIds.add(match.id);
    }
  }

  if (unmatchedResults.length > 0) {
    warnings.push(
      `${unmatchedResults.length} HRR result(s) fetched but not matched to the draw`,
    );
  }

  if (missingResults.length > 0) {
    warnings.push(
      `${missingResults.length} bracket race(s) appear to be missing results`,
    );
  }

  for (const day of incompleteDays) {
    warnings.push(
      `${day.raceDay}: ${day.complete} result(s) applied, ${day.missing} still missing`,
    );
  }

  const isComplete =
    missingResults.length === 0 && unmatchedResults.length === 0;

  return {
    isComplete,
    completeCount: completeMatches.length,
    expectedRacedCount: racedMatches.length,
    fetchedResultCount: results.length,
    unmatchedResultCount: unmatchedResults.length,
    missingResults,
    unmatchedResults: unmatchedResults.map((result) => ({
      id: result.id,
      number: result.number,
      raceDay: result.raceDay,
      raceTime: result.raceTime,
      winner: result.winner.shortName ?? result.winner.name,
      loser: result.loser.shortName ?? result.loser.name,
    })),
    incompleteDays,
    warnings,
  };
}
