/**
 * Validate Henley 10-crew bye draw feeder wiring.
 * Run: npx tsx scripts/validate-bye-draws.ts
 *
 * Pattern (Ladies'/Bridge): 2 heats on day 1 feed Q1 and Q4, not Q1 and Q2.
 */
import { EVENT_LIST } from "../src/config/events";
import type { DrawData } from "../src/lib/types";

const TEN_CREW_ROUND_SIZES = [2, 4, 2, 1];

interface ByeDrawIssue {
  eventId: string;
  message: string;
}

function isTenCrewByeFormat(roundSizes: readonly number[]): boolean {
  return (
    roundSizes.length === TEN_CREW_ROUND_SIZES.length &&
    roundSizes.every((size, index) => size === TEN_CREW_ROUND_SIZES[index])
  );
}

function validateTenCrewByeDraw(eventId: string, draw: DrawData): ByeDrawIssue[] {
  const issues: ByeDrawIssue[] = [];
  const round0 = draw.rounds[0] ?? [];
  const quarterFinals = draw.rounds[1] ?? [];

  if (round0.length !== 2) {
    issues.push({
      eventId,
      message: `expected 2 heats in round 0, found ${round0.length}`,
    });
    return issues;
  }

  const qf0 = quarterFinals.find((match) => match.id === "qf-0");
  const qf1 = quarterFinals.find((match) => match.id === "qf-1");
  const qf3 = quarterFinals.find((match) => match.id === "qf-3");

  const qf0FeedsR10 = qf0?.feeders?.includes("r1-0") ?? false;
  const qf3FeedsR11 = qf3?.feeders?.includes("r1-1") ?? false;
  const qf1FeedsR11 = qf1?.feeders?.includes("r1-1") ?? false;

  if (!qf0FeedsR10) {
    issues.push({
      eventId,
      message: "qf-0 must feed from r1-0 (top quarter-final)",
    });
  }

  if (!qf3FeedsR11) {
    issues.push({
      eventId,
      message: "qf-3 must feed from r1-1 (bottom quarter-final)",
    });
  }

  if (qf1FeedsR11) {
    issues.push({
      eventId,
      message: "qf-1 must not feed from r1-1 — second heat winner belongs in qf-3",
    });
  }

  if (qf1?.feeders?.length) {
    issues.push({
      eventId,
      message: `qf-1 must be a straight bye race with no feeders (found ${qf1.feeders.join(", ")})`,
    });
  }

  return issues;
}

function main(): void {
  const issues: ByeDrawIssue[] = [];

  for (const event of EVENT_LIST) {
    if (!isTenCrewByeFormat(event.roundSizes)) continue;
    issues.push(...validateTenCrewByeDraw(event.id, event.draw));
  }

  if (issues.length > 0) {
    console.error("Bye draw validation: FAIL");
    for (const issue of issues) {
      console.error(`  ${issue.eventId}: ${issue.message}`);
    }
    process.exit(1);
  }

  const checked = EVENT_LIST.filter((event) =>
    isTenCrewByeFormat(event.roundSizes),
  ).map((event) => event.id);

  console.log(
    `Bye draw validation: PASS (${checked.join(", ")})`,
  );
}

main();
