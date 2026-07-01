import type { BracketMatch } from "./types";

/** Must match compact MatchCard CSS height exactly (includes verdict strip when complete) */
export const COMPACT_MATCH_HEIGHT = 58;
export const COMPACT_MATCH_GAP = 8;
export const COMPACT_MATCH_WIDTH = 128;

export const DESKTOP_MATCH_HEIGHT = 96;
export const DESKTOP_MATCH_GAP = 8;

/** Expected knockout sizes for PE (32 crew draw) */
export const EXPECTED_ROUND_SIZES = [16, 8, 4, 2, 1] as const;

function matchCenter(top: number, matchHeight: number): number {
  return top + matchHeight / 2;
}

function topFromCenter(centerY: number, matchHeight: number): number {
  return centerY - matchHeight / 2;
}

function idealOffsetForMatch(
  match: BracketMatch,
  offsets: Map<string, number>,
  matchHeight: number,
  cell: number,
  roundIndex: number,
): number {
  if (match.feeders?.length === 2) {
    const y0 = offsets.get(match.feeders[0]);
    const y1 = offsets.get(match.feeders[1]);
    if (y0 !== undefined && y1 !== undefined) {
      const center =
        (matchCenter(y0, matchHeight) + matchCenter(y1, matchHeight)) / 2;
      return topFromCenter(center, matchHeight);
    }
  }

  return match.matchIndex * cell * Math.pow(2, roundIndex);
}

/** Nudge matches apart only when feeder midpoints would overlap in the column */
function resolveCollisionsInRound(
  round: BracketMatch[],
  idealOffsets: Map<string, number>,
  matchHeight: number,
  gap: number,
): void {
  const sorted = [...round].sort((a, b) => {
    const da = idealOffsets.get(a.id) ?? 0;
    const db = idealOffsets.get(b.id) ?? 0;
    if (da !== db) return da - db;
    return (a.drawRace ?? a.matchIndex) - (b.drawRace ?? b.matchIndex);
  });

  let prevBottom = -Infinity;

  for (const match of sorted) {
    const ideal = idealOffsets.get(match.id) ?? 0;
    const minTop = prevBottom === -Infinity ? ideal : prevBottom + gap;
    if (ideal < minTop) {
      idealOffsets.set(match.id, minTop);
    }
    prevBottom = (idealOffsets.get(match.id) ?? ideal) + matchHeight;
  }
}

/**
 * Compute vertical offset (px) for each match so later-round races sit
 * exactly halfway between their two feeder races in the previous column.
 */
export function computeMatchOffsets(
  rounds: BracketMatch[][],
  matchHeight: number,
  gap: number,
): Map<string, number> {
  const cell = matchHeight + gap;
  const offsets = new Map<string, number>();

  const round0 = rounds[0];
  if (!round0) return offsets;

  for (let i = 0; i < round0.length; i++) {
    offsets.set(round0[i].id, i * cell);
  }

  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const roundIdeals = new Map<string, number>();

    for (const match of round) {
      roundIdeals.set(
        match.id,
        idealOffsetForMatch(match, offsets, matchHeight, cell, ri),
      );
    }

    resolveCollisionsInRound(round, roundIdeals, matchHeight, gap);

    for (const [id, top] of roundIdeals) {
      offsets.set(id, top);
    }
  }

  return offsets;
}

export function getColumnHeight(
  round: BracketMatch[],
  offsets: Map<string, number>,
  matchHeight: number,
  gap: number,
): number {
  if (round.length === 0) return 0;
  let maxBottom = 0;
  for (const match of round) {
    const top = offsets.get(match.id) ?? 0;
    maxBottom = Math.max(maxBottom, top + matchHeight);
  }
  return maxBottom + gap;
}

export function getMatchMarginTops(
  round: BracketMatch[],
  offsets: Map<string, number>,
  matchHeight: number,
): number[] {
  const sorted = [...round].sort(
    (a, b) => (offsets.get(a.id) ?? 0) - (offsets.get(b.id) ?? 0),
  );

  const margins: number[] = [];
  let prevBottom = 0;

  for (const match of sorted) {
    const top = offsets.get(match.id) ?? prevBottom;
    margins.push(Math.max(0, top - prevBottom));
    prevBottom = top + matchHeight;
  }

  const orderMap = new Map(sorted.map((m, i) => [m.id, i]));
  return round.map((m) => margins[orderMap.get(m.id) ?? 0] ?? 0);
}

/** Verify each round has the expected number of matches for a 32-crew draw */
export function validateRoundCounts(rounds: BracketMatch[][]): string[] {
  const warnings: string[] = [];

  for (let i = 0; i < EXPECTED_ROUND_SIZES.length; i++) {
    const expected = EXPECTED_ROUND_SIZES[i];
    const actual = rounds[i]?.length ?? 0;
    if (actual !== expected) {
      warnings.push(
        `Round ${i + 1}: expected ${expected} matches, got ${actual}`,
      );
    }
  }

  if (rounds.length > EXPECTED_ROUND_SIZES.length) {
    warnings.push(
      `Unexpected extra rounds: ${rounds.length} > ${EXPECTED_ROUND_SIZES.length}`,
    );
  }

  return warnings;
}

/** Check no two matches in a round share the same vertical slot */
export function validateRoundOffsets(
  round: BracketMatch[],
  offsets: Map<string, number>,
): string[] {
  const warnings: string[] = [];
  const seen = new Map<number, string>();

  for (const match of round) {
    const top = offsets.get(match.id);
    if (top === undefined) continue;
    const existing = seen.get(top);
    if (existing) {
      warnings.push(
        `${match.id} overlaps ${existing} at offset ${top}px — check draw order/feeder map`,
      );
    }
    seen.set(top, match.id);
  }

  return warnings;
}
