/**
 * Full bracket audit across all HRR events.
 * Run: npx tsx scripts/audit-all-events.ts
 */
import { EVENT_LIST } from "../src/config/events";
import { buildBracket } from "../src/lib/bracket-engine";
import { fetchEventResults, fetchEventTimetable } from "../src/lib/hrr-api";
import { crewsMatch, crewResultMatchesDraw } from "../src/lib/crew-match";
import {
  getLondonTodayIso,
  getScheduledRegattaDayForRound,
  resolveRegattaDayIso,
} from "../src/lib/regatta-days";
import type { BracketMatch, Crew } from "../src/lib/types";
import type { EventConfig } from "../src/config/events";

const FINISHED_BUFFER_MINUTES = 20;

interface Issue {
  eventId: string;
  severity: "error" | "warning";
  category: string;
  matchId?: string;
  message: string;
}

function parseRaceTimeMinutes(raceTime: string | null): number | null {
  if (!raceTime) return null;
  const m = raceTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
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

function matchDayIso(match: BracketMatch, event: EventConfig): string | null {
  if (match.raceDay) {
    return resolveRegattaDayIso(match.raceDay, event.raceDays);
  }
  return getScheduledRegattaDayForRound(match.roundIndex, event.raceDays)
    ?.isoDate ?? null;
}

function isMatchDueFinished(
  match: BracketMatch,
  event: EventConfig,
  timetableDayIso: string | null,
): boolean {
  if (!match.berks?.name || !match.bucks?.name) return false;
  if (!match.raceTime) return false;

  const dayIso = matchDayIso(match, event);
  if (!dayIso) return false;

  const today = getLondonTodayIso();
  if (dayIso < today) return true;
  if (dayIso > today) return false;

  const raceMinutes = parseRaceTimeMinutes(match.raceTime);
  if (raceMinutes == null) return false;

  return getLondonNowMinutes() >= raceMinutes + FINISHED_BUFFER_MINUTES;
}

function isMatchNotYetStarted(
  match: BracketMatch,
  event: EventConfig,
): boolean {
  const dayIso = matchDayIso(match, event);
  if (!dayIso) {
    const scheduledDay = getScheduledRegattaDayForRound(
      match.roundIndex,
      event.raceDays,
    );
    if (!scheduledDay) return false;
    return scheduledDay.isoDate > getLondonTodayIso();
  }

  const today = getLondonTodayIso();
  if (dayIso > today) return true;
  if (dayIso < today) return false;

  if (!match.raceTime) return false;
  const raceMinutes = parseRaceTimeMinutes(match.raceTime);
  if (raceMinutes == null) return false;

  return getLondonNowMinutes() < raceMinutes;
}

function crewLabel(crew: Crew | null): string {
  if (!crew) return "TBD";
  return crew.shortName ?? crew.name;
}

function crewsEquivalent(a: Crew | null, b: Crew | null): boolean {
  if (!a || !b) return false;
  if (a.number != null && b.number != null && a.number === b.number) return true;
  return (
    crewResultMatchesDraw(a, b) ||
    crewResultMatchesDraw(b, a) ||
    crewsMatch(a.name, b.name, { numberA: a.number, numberB: b.number })
  );
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

function auditEvent(
  event: EventConfig,
  rounds: BracketMatch[][],
  timetableDayIso: string | null,
): Issue[] {
  const issues: Issue[] = [];
  const matchById = buildMatchIndex(rounds);
  const allMatches = rounds.flat();

  for (const match of allMatches) {
    if (isMatchDueFinished(match, event, timetableDayIso)) {
      if (match.status !== "complete") {
        issues.push({
          eventId: event.id,
          severity: "error",
          category: "missing_result",
          matchId: match.id,
          message: `${match.roundLabel} ${match.id} (${crewLabel(match.berks)} vs ${crewLabel(match.bucks)}) was due ${match.raceTime} but has no result`,
        });
      }
    }

    if (isMatchNotYetStarted(match, event) && match.status === "complete") {
      issues.push({
        eventId: event.id,
        severity: "error",
        category: "premature_result",
        matchId: match.id,
        message: `${match.roundLabel} ${match.id} has a result but race time ${match.raceTime ?? "?"} on ${match.raceDay ?? "future day"} has not started yet`,
      });
    }

    if (match.status === "complete") {
      if (!match.winner || !match.loser) {
        issues.push({
          eventId: event.id,
          severity: "error",
          category: "incomplete_result",
          matchId: match.id,
          message: `${match.id} marked complete but missing winner/loser`,
        });
      } else {
        const winnerInDraw =
          crewsEquivalent(match.winner, match.berks) ||
          crewsEquivalent(match.winner, match.bucks);
        const loserInDraw =
          crewsEquivalent(match.loser, match.berks) ||
          crewsEquivalent(match.loser, match.bucks);
        if (!winnerInDraw || !loserInDraw) {
          issues.push({
            eventId: event.id,
            severity: "error",
            category: "result_crew_mismatch",
            matchId: match.id,
            message: `${match.id}: result winner=${crewLabel(match.winner)} loser=${crewLabel(match.loser)} but draw had ${crewLabel(match.berks)} vs ${crewLabel(match.bucks)}`,
          });
        }
        if (crewsEquivalent(match.winner, match.loser)) {
          issues.push({
            eventId: event.id,
            severity: "error",
            category: "result_crew_mismatch",
            matchId: match.id,
            message: `${match.id}: winner and loser are the same crew`,
          });
        }
      }
    }

    if (match.feeders?.length) {
      for (const feederId of match.feeders) {
        const feeder = matchById.get(feederId);
        if (!feeder) {
          issues.push({
            eventId: event.id,
            severity: "error",
            category: "feeder_missing",
            matchId: match.id,
            message: `${match.id} references missing feeder ${feederId}`,
          });
          continue;
        }

        if (feeder.status === "complete" && feeder.winner) {
          const winnerShouldAppear =
            crewsEquivalent(match.berks, feeder.winner) ||
            crewsEquivalent(match.bucks, feeder.winner);
          if (
            match.berks &&
            match.bucks &&
            !winnerShouldAppear &&
            match.status !== "pending"
          ) {
            issues.push({
              eventId: event.id,
              severity: "error",
              category: "progression",
              matchId: match.id,
              message: `${feeder.id} winner ${crewLabel(feeder.winner)} does not appear in ${match.id} (${crewLabel(match.berks)} vs ${crewLabel(match.bucks)})`,
            });
          }
        }

        if (
          feeder.status === "complete" &&
          feeder.winner &&
          feeder.loser &&
          match.berks &&
          match.bucks
        ) {
          const loserProgressed =
            crewsEquivalent(match.berks, feeder.loser) ||
            crewsEquivalent(match.bucks, feeder.loser);
          if (loserProgressed && !crewsEquivalent(feeder.winner, feeder.loser)) {
            issues.push({
              eventId: event.id,
              severity: "error",
              category: "progression",
              matchId: match.id,
              message: `${feeder.id} loser ${crewLabel(feeder.loser)} appears in ${match.id} — only winner should progress`,
            });
          }
        }
      }
    }

    if (match.berks && match.bucks && match.status === "complete" && match.winner) {
      const loser =
        crewsEquivalent(match.winner, match.berks) ? match.bucks : match.berks;
      if (loser && crewsEquivalent(match.loser, match.winner)) {
        issues.push({
          eventId: event.id,
          severity: "error",
          category: "progression",
          matchId: match.id,
          message: `${match.id}: recorded loser is the winner`,
        });
      }
    }
  }

  for (const match of allMatches) {
    if (!match.feeders?.length || match.status === "complete") continue;
    if (!match.berks && !match.bucks) continue;

    for (const feederId of match.feeders) {
      const feeder = matchById.get(feederId);
      if (!feeder?.winner) continue;

      const slot =
        match.berks && crewsEquivalent(match.berks, feeder.winner)
          ? "berks"
          : match.bucks && crewsEquivalent(match.bucks, feeder.winner)
            ? "bucks"
            : null;

      if (match.berks && match.bucks && !slot) {
        const inBerks = crewsEquivalent(match.berks, feeder.winner);
        const inBucks = crewsEquivalent(match.bucks, feeder.winner);
        if (!inBerks && !inBucks) {
          issues.push({
            eventId: event.id,
            severity: "warning",
            category: "name_drift",
            matchId: match.id,
            message: `${match.id}: feeder ${feeder.id} winner "${crewLabel(feeder.winner)}" (#${feeder.winner.number ?? "?"}) not matched in slots (${crewLabel(match.berks)} vs ${crewLabel(match.bucks)})`,
          });
        }
      }

      if (slot === "berks" && match.berks && feeder.winner) {
        if (!match.bucks && match.feeders?.length === 1) {
          continue;
        }
        if (
          match.berks.number != null &&
          feeder.winner.number != null &&
          match.berks.number !== feeder.winner.number
        ) {
          issues.push({
            eventId: event.id,
            severity: "error",
            category: "name_drift",
            matchId: match.id,
            message: `${match.id} berks #${match.berks.number} ${crewLabel(match.berks)} but feeder ${feeder.id} winner #${feeder.winner.number} ${crewLabel(feeder.winner)}`,
          });
        }
      }
      if (slot === "bucks" && match.bucks && feeder.winner) {
        if (
          match.bucks.number != null &&
          feeder.winner.number != null &&
          match.bucks.number !== feeder.winner.number
        ) {
          issues.push({
            eventId: event.id,
            severity: "error",
            category: "name_drift",
            matchId: match.id,
            message: `${match.id} bucks #${match.bucks.number} ${crewLabel(match.bucks)} but feeder ${feeder.id} winner #${feeder.winner.number} ${crewLabel(feeder.winner)}`,
          });
        }
      }
    }
  }

  const timetableIdx = timetableDayIso
    ? event.raceDays.findIndex((d) => d.isoDate === timetableDayIso)
    : -1;

  for (const match of allMatches) {
    if (match.status === "complete" || !match.raceTime) continue;
    const scheduledDay = getScheduledRegattaDayForRound(
      match.roundIndex,
      event.raceDays,
    );
    if (!scheduledDay || timetableIdx < 0) continue;
    const matchIdx = event.raceDays.findIndex(
      (d) => d.isoDate === scheduledDay.isoDate,
    );
    if (matchIdx > timetableIdx) {
      issues.push({
        eventId: event.id,
        severity: "error",
        category: "premature_schedule",
        matchId: match.id,
        message: `${match.roundLabel} ${match.id} has time ${match.raceTime} but timetable is only through ${timetableDayIso}`,
      });
    }
  }

  return issues;
}

async function main() {
  const allIssues: Issue[] = [];
  const summary: {
    id: string;
    results: number;
    complete: number;
    scheduled: number;
    pending: number;
    auditComplete: boolean;
    issues: number;
  }[] = [];

  console.log(`Audit at London ${getLondonTodayIso()} ${getLondonNowMinutes()}\n`);

  for (const event of EVENT_LIST) {
    try {
      const [{ results }, timetable] = await Promise.all([
        fetchEventResults(event),
        fetchEventTimetable(event),
      ]);
      const bracket = buildBracket(event, results, timetable);
      const rounds = bracket.rounds;
      const timetableDayIso = resolveRegattaDayIso(
        timetable.raceDay,
        event.raceDays,
      );

      const issues = auditEvent(event, rounds, timetableDayIso);
      allIssues.push(...issues);

      const flat = rounds.flat();
      summary.push({
        id: event.id,
        results: results.length,
        complete: flat.filter((m) => m.status === "complete").length,
        scheduled: flat.filter((m) => m.status === "scheduled").length,
        pending: flat.filter((m) => m.status === "pending").length,
        auditComplete: issues.length === 0,
        issues: issues.length,
      });
    } catch (err) {
      allIssues.push({
        eventId: event.id,
        severity: "error",
        category: "fetch",
        message: `Failed to audit: ${err instanceof Error ? err.message : String(err)}`,
      });
      summary.push({
        id: event.id,
        results: -1,
        complete: 0,
        scheduled: 0,
        pending: 0,
        auditComplete: false,
        issues: 1,
      });
    }
  }

  console.log("=== SUMMARY ===");
  console.log(
    "event".padEnd(18),
    "results",
    "done",
    "sched",
    "pend",
    "issues",
  );
  for (const s of summary) {
    console.log(
      s.id.padEnd(18),
      String(s.results).padStart(7),
      String(s.complete).padStart(4),
      String(s.scheduled).padStart(5),
      String(s.pending).padStart(4),
      String(s.issues).padStart(6),
      s.auditComplete ? "OK" : "FAIL",
    );
  }

  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  console.log(`\n=== ISSUES: ${errors.length} errors, ${warnings.length} warnings ===\n`);

  const byCategory = new Map<string, Issue[]>();
  for (const issue of allIssues) {
    const key = `${issue.eventId}:${issue.category}`;
    const list = byCategory.get(key) ?? [];
    list.push(issue);
    byCategory.set(key, list);
  }

  for (const [key, list] of [...byCategory.entries()].sort()) {
    console.log(`--- ${key} (${list.length}) ---`);
    for (const issue of list.slice(0, 8)) {
      console.log(`  [${issue.severity}] ${issue.message}`);
    }
    if (list.length > 8) console.log(`  ... and ${list.length - 8} more`);
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
