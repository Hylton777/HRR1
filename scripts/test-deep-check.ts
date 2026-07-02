/**
 * TEST.md optional deep check: roundSizes vs draw, all results applied.
 * Run: npx tsx scripts/test-deep-check.ts
 */
import { EVENT_LIST } from "../src/config/events";
import { buildBracket } from "../src/lib/bracket-engine";
import { fetchEventResults } from "../src/lib/hrr-api";

async function main(): Promise<void> {
  const failures: string[] = [];
  let totalResults = 0;
  let totalApplied = 0;

  for (const event of EVENT_LIST) {
    const { results } = await fetchEventResults(event);
    const bracket = buildBracket(event, results, { raceDay: null, races: [] });
    const applied = bracket.rounds
      .flat()
      .filter((m) => m.status === "complete").length;
    totalResults += results.length;
    totalApplied += applied;

    if (applied !== results.length) {
      failures.push(
        `${event.id}: ${applied}/${results.length} results applied`,
      );
    }
    if (event.draw.rounds.length !== event.roundSizes.length) {
      failures.push(
        `${event.id}: ${event.draw.rounds.length} draw rounds vs ${event.roundSizes.length} in config`,
      );
    }
    for (let i = 0; i < event.roundSizes.length; i++) {
      const actual = event.draw.rounds[i]?.length ?? 0;
      if (actual !== event.roundSizes[i]) {
        failures.push(
          `${event.id} round ${i + 1}: expected ${event.roundSizes[i]}, draw has ${actual}`,
        );
      }
    }
    for (const round of bracket.rounds) {
      for (const m of round) {
        if (
          m.status === "complete" &&
          m.winner?.number != null &&
          m.loser?.number != null &&
          m.winner.number === m.loser.number
        ) {
          failures.push(
            `${event.id}:${m.id}: winner and loser share number ${m.winner.number}`,
          );
        }
      }
    }
  }

  console.log(
    `Events: ${EVENT_LIST.length} | Results: ${totalResults} | Applied: ${totalApplied}`,
  );
  if (failures.length) {
    console.error(`Deep check FAIL (${failures.length}):`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("Deep check PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
