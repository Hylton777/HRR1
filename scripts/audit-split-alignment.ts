/**
 * Audit split-bracket vertical alignment: semis vs final vs full-bracket coords.
 * Run: npx tsx scripts/audit-split-alignment.ts
 */
import { EVENT_LIST } from "../src/config/events";
import { buildBracket } from "../src/lib/bracket-engine";
import { fetchEventResults, fetchEventTimetable } from "../src/lib/hrr-api";
import {
  COMPACT_MATCH_GAP,
  COMPACT_MATCH_HEIGHT,
  computeMatchOffsets,
  getBracketTreeHeight,
  getColumnHeight,
} from "../src/lib/bracket-layout";
import {
  canSplitBracket,
  splitBracketHalves,
} from "../src/lib/bracket-split";

const MATCH_HEIGHT = COMPACT_MATCH_HEIGHT;
const GAP = COMPACT_MATCH_GAP;

function matchCenterY(top: number): number {
  return top + MATCH_HEIGHT / 2;
}

async function main() {
  const issues: string[] = [];

  for (const event of EVENT_LIST) {
    const [{ results }, timetable] = await Promise.all([
      fetchEventResults(event),
      fetchEventTimetable(event),
    ]);
    const bracket = buildBracket(event, results, timetable);

    if (!canSplitBracket(bracket.rounds)) {
      console.log(`[${event.id}] skip — cannot split`);
      continue;
    }

    const split = splitBracketHalves(bracket.rounds);
    const fullOffsets = computeMatchOffsets(
      bracket.rounds,
      MATCH_HEIGHT,
      GAP,
    );

    const leftRounds = split.leftRounds.filter((r) => r.length > 0);
    const rightRounds = split.rightRounds.filter((r) => r.length > 0);
    const leftOffsets = computeMatchOffsets(leftRounds, MATCH_HEIGHT, GAP);
    const rightOffsets = computeMatchOffsets(rightRounds, MATCH_HEIGHT, GAP);

    const leftSemiTop = fullOffsets.get(split.leftSemiId!);
    const rightSemiTop = fullOffsets.get(split.rightSemiId!);
    const finalTop = fullOffsets.get(split.final!.id);
    const leftSemiHalfTop = leftOffsets.get(split.leftSemiId!);
    const rightSemiHalfTop = rightOffsets.get(split.rightSemiId!);

    const treeHeight = getBracketTreeHeight(
      bracket.rounds,
      fullOffsets,
      MATCH_HEIGHT,
      GAP,
    );

    if (
      leftSemiTop === undefined ||
      rightSemiTop === undefined ||
      finalTop === undefined
    ) {
      issues.push(`[${event.id}] missing full offsets for semi/final`);
      continue;
    }

    const leftSemiY = matchCenterY(leftSemiTop);
    const rightSemiY = matchCenterY(rightSemiTop);
    const finalY = matchCenterY(finalTop);
    const expectedFinalY = (leftSemiY + rightSemiY) / 2;

    const leftHalfMismatch =
      leftSemiHalfTop !== undefined &&
      Math.abs(leftSemiHalfTop - leftSemiTop) > 0.5;
    const rightHalfMismatch =
      rightSemiHalfTop !== undefined &&
      Math.abs(rightSemiHalfTop - rightSemiTop) > 0.5;

    const usesFullOffsets = !leftHalfMismatch && !rightHalfMismatch;
    const semiDelta = Math.abs(leftSemiY - rightSemiY);
    const finalCenterError = Math.abs(finalY - expectedFinalY);

    const finalMismatch = finalCenterError > 0.5;

    const leftHeight = Math.max(
      ...leftRounds.map((r) =>
        getColumnHeight(r, leftOffsets, MATCH_HEIGHT, GAP),
      ),
      0,
    );
    const rightHeight = Math.max(
      ...rightRounds.map((r) =>
        getColumnHeight(r, rightOffsets, MATCH_HEIGHT, GAP),
      ),
      0,
    );
    const heightDiff = Math.abs(leftHeight - rightHeight);

    const leftCols = leftRounds.length;
    const rightCols = rightRounds.length;

    console.log(
      `[${event.id}] semiΔ=${semiDelta.toFixed(1)} finalErr=${finalCenterError.toFixed(1)} treeH=${treeHeight.toFixed(0)} cols L/R=${leftCols}/${rightCols} fullOffsets=${usesFullOffsets ? "ok" : "NEEDS"}`,
    );

    if (leftHalfMismatch && !usesFullOffsets) {
      issues.push(
        `[${event.id}] left semi offset in half (${leftSemiHalfTop}) != full (${leftSemiTop})`,
      );
    }
    if (rightHalfMismatch) {
      issues.push(
        `[${event.id}] right semi offset in half (${rightSemiHalfTop}) != full (${rightSemiTop}) — fixed by fullOffsets`,
      );
    }
    if (finalMismatch) {
      issues.push(
        `[${event.id}] final Y (${finalY.toFixed(1)}) != midpoint of semis (${expectedFinalY.toFixed(1)})`,
      );
    }
    if (leftCols !== rightCols) {
      issues.push(
        `[${event.id}] column count mismatch: left=${leftCols} right=${rightCols}`,
      );
    }
    if (heightDiff > 1 && !usesFullOffsets) {
      issues.push(
        `[${event.id}] half height mismatch: left=${leftHeight} right=${rightHeight} (diff=${heightDiff}) — fixed by matchTreeHeight`,
      );
    }
  }

  console.log("\n--- Issues ---");
  if (issues.length === 0) {
    console.log("None");
  } else {
    for (const issue of issues) console.log(issue);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
