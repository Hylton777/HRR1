/**
 * Phase 1 engine verification: slot-aware matching and result application.
 * Run: npx tsx scripts/verify-phase1-engine.ts
 */
import { EVENT_LIST } from "../src/config/events";
import { buildBracket } from "../src/lib/bracket-engine";
import { fetchEventResults } from "../src/lib/hrr-api";
import { crewResultMatchesDraw } from "../src/lib/crew-match";
import type { BracketMatch, Crew } from "../src/lib/types";

const TARGET_EVENTS = [
  "double-sculls",
  "princess-royal",
  "wargrave",
  "island",
  "visitors",
  "temple",
  "pow",
  "pe",
  "prince-philip",
  "prince-albert",
] as const;

function sharesCrewNumber(a: Crew, b: Crew): boolean {
  return a.number != null && b.number != null && a.number === b.number;
}

function auditAppliedResults(rounds: BracketMatch[][]): string[] {
  const issues: string[] = [];
  for (const round of rounds) {
    for (const match of round) {
      if (match.status !== "complete" || !match.winner || !match.loser) continue;

      if (sharesCrewNumber(match.winner, match.loser)) {
        issues.push(
          `${match.id}: winner and loser share crew number ${match.winner.number}`,
        );
      }

      const winnerOnDraw =
        (match.berks &&
          crewResultMatchesDraw(match.berks, match.winner)) ||
        (match.bucks &&
          crewResultMatchesDraw(match.bucks, match.winner));
      const loserOnDraw =
        (match.berks &&
          crewResultMatchesDraw(match.berks, match.loser)) ||
        (match.bucks &&
          crewResultMatchesDraw(match.bucks, match.loser));

      if (!winnerOnDraw) {
        issues.push(
          `${match.id}: winner ${match.winner.shortName ?? match.winner.name} not on draw`,
        );
      }
      if (!loserOnDraw) {
        issues.push(
          `${match.id}: loser ${match.loser.shortName ?? match.loser.name} not on draw`,
        );
      }
    }
  }
  return issues;
}

async function main(): Promise<void> {
  const allIssues: string[] = [];

  for (const eventId of TARGET_EVENTS) {
    const event = EVENT_LIST.find((e) => e.id === eventId);
    if (!event) continue;

    const { results } = await fetchEventResults(event);
    const bracket = buildBracket(event, results, { raceDay: null, races: [] });
    const issues = auditAppliedResults(bracket.rounds);
    if (issues.length) {
      allIssues.push(...issues.map((i) => `${eventId}: ${i}`));
    }
  }

  if (allIssues.length) {
    console.error("Phase1 engine check: FAIL");
    for (const issue of allIssues) {
      console.error(`  ${issue}`);
    }
    process.exit(1);
  }

  console.log("Phase1 engine check: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
