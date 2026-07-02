/**
 * Verify Recent Results panel matches the knockout bracket for every event.
 * Run: npx tsx scripts/audit-recent-results-bracket.ts
 */
import { EVENT_LIST } from "../src/config/events";
import { buildBracket } from "../src/lib/bracket-engine";
import {
  crewDisplayLabel,
  findBracketMatchForResult,
  hasVisibleCrewMismatch,
  resolveResultDisplayCrews,
} from "../src/lib/display-consistency";
import { fetchEventResults, fetchEventTimetable } from "../src/lib/hrr-api";
import type { BracketMatch, HrrResult } from "../src/lib/types";

interface Issue {
  eventId: string;
  kind: string;
  message: string;
}

function auditEvent(
  eventId: string,
  rounds: BracketMatch[][],
  results: HrrResult[],
): Issue[] {
  const issues: Issue[] = [];
  const completeMatches = rounds.flat().filter((m) => m.status === "complete");
  const event = EVENT_LIST.find((e) => e.id === eventId)!;
  const matchToResults = new Map<string, HrrResult[]>();

  for (const result of results) {
    const match = findBracketMatchForResult(rounds, result, event);
    if (!match) {
      issues.push({
        eventId,
        kind: "orphan_result",
        message: `Race ${result.number} (${result.raceDay} ${result.raceTime}) has no matching complete bracket slot`,
      });
      continue;
    }

    if (match.status !== "complete" || !match.winner || !match.loser) {
      issues.push({
        eventId,
        kind: "incomplete_bracket_slot",
        message: `Race ${result.number} maps to ${match.id} but bracket slot is not complete`,
      });
      continue;
    }

    const mapped = matchToResults.get(match.id) ?? [];
    mapped.push(result);
    matchToResults.set(match.id, mapped);

    const displayed = resolveResultDisplayCrews(result, rounds, event);
    if (hasVisibleCrewMismatch(match.winner, displayed.winner)) {
      issues.push({
        eventId,
        kind: "winner_mismatch",
        message: `Race ${result.number}: Recent Results would show ${crewDisplayLabel(displayed.winner)} but bracket has ${crewDisplayLabel(match.winner)} (${match.id})`,
      });
    }
    if (hasVisibleCrewMismatch(match.loser, displayed.loser)) {
      issues.push({
        eventId,
        kind: "loser_mismatch",
        message: `Race ${result.number}: Recent Results would show ${crewDisplayLabel(displayed.loser)} but bracket has ${crewDisplayLabel(match.loser)} (${match.id})`,
      });
    }
  }

  for (const [matchId, mapped] of matchToResults) {
    if (mapped.length > 1) {
      issues.push({
        eventId,
        kind: "duplicate_mapping",
        message: `${matchId} is mapped from ${mapped.length} HRR results (${mapped.map((r) => `#${r.number}`).join(", ")})`,
      });
    }
  }

  const mappedMatchIds = new Set(matchToResults.keys());

  for (const match of completeMatches) {
    if (!mappedMatchIds.has(match.id)) {
      issues.push({
        eventId,
        kind: "missing_from_recent",
        message: `${match.id} (#${match.raceNumber ?? "?"}) is complete on the bracket but no HRR result maps to it for Recent Results`,
      });
    }
  }

  if (completeMatches.length !== mappedMatchIds.size) {
    issues.push({
      eventId,
      kind: "count_mismatch",
      message: `${completeMatches.length} complete bracket races vs ${mappedMatchIds.size} results mapped for Recent Results`,
    });
  }

  return issues;
}

async function main(): Promise<void> {
  const allIssues: Issue[] = [];
  const summary: Array<{
    eventId: string;
    results: number;
    complete: number;
    ok: boolean;
  }> = [];

  for (const event of EVENT_LIST) {
    const [{ results }, timetable] = await Promise.all([
      fetchEventResults(event),
      fetchEventTimetable(event),
    ]);
    const bracket = buildBracket(event, results, timetable);
    const complete = bracket.rounds
      .flat()
      .filter((m) => m.status === "complete").length;
    const issues = auditEvent(event.id, bracket.rounds, results);
    allIssues.push(...issues);
    summary.push({
      eventId: event.id,
      results: results.length,
      complete,
      ok: issues.length === 0,
    });
  }

  console.log("=== Recent Results ↔ Bracket ===\n");
  for (const row of summary) {
    console.log(
      `${row.eventId.padEnd(18)} results=${String(row.results).padStart(3)} complete=${String(row.complete).padStart(3)}  ${row.ok ? "OK" : "FAIL"}`,
    );
  }

  if (allIssues.length > 0) {
    console.error(`\n=== ISSUES: ${allIssues.length} ===\n`);
    for (const issue of allIssues) {
      console.error(`${issue.eventId}: [${issue.kind}] ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(
    `\nRecent Results ↔ Bracket: PASS (${EVENT_LIST.length} events)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
