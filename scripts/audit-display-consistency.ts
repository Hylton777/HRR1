/**
 * Cross-surface display consistency audit for all HRR events.
 * Run: npx tsx scripts/audit-display-consistency.ts
 */
import { EVENT_LIST } from "../src/config/events";
import { buildBracket, collectUpcomingRaces } from "../src/lib/bracket-engine";
import { auditDisplayConsistency } from "../src/lib/display-consistency";
import { fetchEventResults, fetchEventTimetable } from "../src/lib/hrr-api";

async function main(): Promise<void> {
  let totalIssues = 0;
  let totalDrift = 0;
  const failures: string[] = [];
  const drift: string[] = [];

  for (const event of EVENT_LIST) {
    const [{ results }, timetable] = await Promise.all([
      fetchEventResults(event),
      fetchEventTimetable(event),
    ]);
    const bracket = buildBracket(event, results, timetable);
    const upcomingRaces = collectUpcomingRaces(bracket.rounds);
    const audit = auditDisplayConsistency(
      bracket.rounds,
      results,
      upcomingRaces,
      event,
    );

    if (!audit.isConsistent) {
      totalIssues += audit.inconsistencyCount;
      for (const issue of audit.inconsistencies) {
        failures.push(
          `${event.id}: [${issue.area}] ${issue.message}${
            issue.bracketLabel && issue.otherLabel
              ? ` (bracket: ${issue.bracketLabel}; other: ${issue.otherLabel})`
              : ""
          }`,
        );
      }
    }

    if (audit.enrichmentDriftCount > 0) {
      totalDrift += audit.enrichmentDriftCount;
      for (const issue of audit.enrichmentDrift) {
        drift.push(
          `${event.id}: [drift] ${issue.message} (bracket: ${issue.bracketLabel}; enrichment: ${issue.otherLabel})`,
        );
      }
    }
  }

  if (drift.length > 0) {
    console.warn(`Enrichment drift warnings: ${totalDrift}`);
    for (const warning of drift.slice(0, 10)) {
      console.warn(`  ${warning}`);
    }
    if (drift.length > 10) {
      console.warn(`  …and ${drift.length - 10} more`);
    }
  }

  if (failures.length > 0) {
    console.error("Display consistency check: FAIL");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    console.error(`ISSUES: ${totalIssues}`);
    process.exit(1);
  }

  console.log(
    `Display consistency check: PASS (${EVENT_LIST.length} events, 0 cross-surface mismatches${
      totalDrift > 0 ? `, ${totalDrift} enrichment drift warning(s)` : ""
    })`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
