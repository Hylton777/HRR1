import type { BracketMatch } from "./types";

/** Must match compact MatchCard CSS height exactly (includes verdict strip when complete) */
export const COMPACT_MATCH_HEIGHT = 58;
export const COMPACT_MATCH_GAP = 8;
export const COMPACT_MATCH_WIDTH = 128;

export const DESKTOP_MATCH_HEIGHT = 96;
export const DESKTOP_MATCH_GAP = 8;

/** Expected knockout sizes for PE (32 crew draw) */
export const EXPECTED_ROUND_SIZES = [16, 8, 4, 2, 1] as const;

/** Vertical centre of the bucks crew row within a match card (layout coords). */
export const BUCKS_SLOT_CENTER_RATIO = 0.72;
/** Vertical centre of the berks crew row within a match card (layout coords). */
export const BERKS_SLOT_CENTER_RATIO = 0.28;
/** Horizontal centre of the bucks crew column within a match card (layout coords). */
export const BUCKS_SLOT_CENTER_X_RATIO = 0.72;
/** Horizontal centre of the berks crew column within a match card (layout coords). */
export const BERKS_SLOT_CENTER_X_RATIO = 0.28;

function inferFeederAnchor(match: BracketMatch): "berks" | "bucks" {
  if (match.berks && !match.bucks) return "bucks";
  if (match.bucks && !match.berks) return "berks";
  return "bucks";
}

function matchCenter(top: number, matchHeight: number): number {
  return top + matchHeight / 2;
}

function topFromCenter(centerY: number, matchHeight: number): number {
  return centerY - matchHeight / 2;
}

function anchorYOnMatch(
  top: number,
  match: BracketMatch,
  matchHeight: number,
): number {
  const anchor = inferFeederAnchor(match);
  const ratio =
    anchor === "bucks" ? BUCKS_SLOT_CENTER_RATIO : BERKS_SLOT_CENTER_RATIO;
  return top + matchHeight * ratio;
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

/** Align 1st-round heats with the TBD row on their quarter-final. */
function backAlignFeederRound(
  rounds: BracketMatch[][],
  offsets: Map<string, number>,
  matchHeight: number,
): void {
  const round0 = rounds[0];
  if (!round0?.length) return;

  const childByFeeder = new Map<string, BracketMatch>();

  for (let ri = 1; ri < rounds.length; ri++) {
    for (const match of rounds[ri]) {
      if (match.feeders?.length === 1) {
        childByFeeder.set(match.feeders[0], match);
      }
    }
  }

  for (const feeder of round0) {
    const child = childByFeeder.get(feeder.id);
    if (!child) continue;

    const childTop = offsets.get(child.id);
    if (childTop === undefined) continue;

    const anchorY = anchorYOnMatch(childTop, child, matchHeight);
    offsets.set(feeder.id, topFromCenter(anchorY, matchHeight));
  }
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

  backAlignFeederRound(rounds, offsets, matchHeight);

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

/** Tallest column in a bracket tree — shared height for split-half alignment. */
export function getBracketTreeHeight(
  rounds: BracketMatch[][],
  offsets: Map<string, number>,
  matchHeight: number,
  gap: number,
): number {
  if (rounds.length === 0) return 0;
  return Math.max(
    ...rounds.map((round) =>
      getColumnHeight(round, offsets, matchHeight, gap),
    ),
  );
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

function matchCenterX(left: number, matchWidth: number): number {
  return left + matchWidth / 2;
}

function leftFromCenter(centerX: number, matchWidth: number): number {
  return centerX - matchWidth / 2;
}

function anchorXOnMatch(
  left: number,
  match: BracketMatch,
  matchWidth: number,
): number {
  const anchor = inferFeederAnchor(match);
  const ratio =
    anchor === "bucks" ? BUCKS_SLOT_CENTER_X_RATIO : BERKS_SLOT_CENTER_X_RATIO;
  return left + matchWidth * ratio;
}

function idealOffsetXForMatch(
  match: BracketMatch,
  offsets: Map<string, number>,
  matchWidth: number,
  cell: number,
  roundIndex: number,
): number {
  if (match.feeders?.length === 2) {
    const x0 = offsets.get(match.feeders[0]);
    const x1 = offsets.get(match.feeders[1]);
    if (x0 !== undefined && x1 !== undefined) {
      const center =
        (matchCenterX(x0, matchWidth) + matchCenterX(x1, matchWidth)) / 2;
      return leftFromCenter(center, matchWidth);
    }
  }

  return match.matchIndex * cell * Math.pow(2, roundIndex);
}

function backAlignFeederRoundHorizontal(
  rounds: BracketMatch[][],
  offsets: Map<string, number>,
  matchWidth: number,
): void {
  const round0 = rounds[0];
  if (!round0?.length) return;

  const childByFeeder = new Map<string, BracketMatch>();

  for (let ri = 1; ri < rounds.length; ri++) {
    for (const match of rounds[ri]) {
      if (match.feeders?.length === 1) {
        childByFeeder.set(match.feeders[0], match);
      }
    }
  }

  for (const feeder of round0) {
    const child = childByFeeder.get(feeder.id);
    if (!child) continue;

    const childLeft = offsets.get(child.id);
    if (childLeft === undefined) continue;

    const anchorX = anchorXOnMatch(childLeft, child, matchWidth);
    offsets.set(feeder.id, leftFromCenter(anchorX, matchWidth));
  }
}

function resolveCollisionsInRow(
  round: BracketMatch[],
  idealOffsets: Map<string, number>,
  matchWidth: number,
  gap: number,
): void {
  const sorted = [...round].sort((a, b) => {
    const da = idealOffsets.get(a.id) ?? 0;
    const db = idealOffsets.get(b.id) ?? 0;
    if (da !== db) return da - db;
    return (a.drawRace ?? a.matchIndex) - (b.drawRace ?? b.matchIndex);
  });

  let prevRight = -Infinity;

  for (const match of sorted) {
    const ideal = idealOffsets.get(match.id) ?? 0;
    const minLeft = prevRight === -Infinity ? ideal : prevRight + gap;
    if (ideal < minLeft) {
      idealOffsets.set(match.id, minLeft);
    }
    prevRight = (idealOffsets.get(match.id) ?? ideal) + matchWidth;
  }
}

/**
 * Compute horizontal offset (px) for each match so later-round races sit
 * halfway between their two feeder races in the row below.
 */
export function computeRowMatchOffsets(
  rounds: BracketMatch[][],
  matchWidth: number,
  gap: number,
): Map<string, number> {
  const cell = matchWidth + gap;
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
        idealOffsetXForMatch(match, offsets, matchWidth, cell, ri),
      );
    }

    resolveCollisionsInRow(round, roundIdeals, matchWidth, gap);

    for (const [id, left] of roundIdeals) {
      offsets.set(id, left);
    }
  }

  backAlignFeederRoundHorizontal(rounds, offsets, matchWidth);

  return offsets;
}

export function getRowWidth(
  round: BracketMatch[],
  offsets: Map<string, number>,
  matchWidth: number,
  gap: number,
): number {
  if (round.length === 0) return 0;
  let maxRight = 0;
  for (const match of round) {
    const left = offsets.get(match.id) ?? 0;
    maxRight = Math.max(maxRight, left + matchWidth);
  }
  return maxRight + gap;
}

export function getMatchMarginLefts(
  round: BracketMatch[],
  offsets: Map<string, number>,
  matchWidth: number,
): number[] {
  const sorted = [...round].sort(
    (a, b) => (offsets.get(a.id) ?? 0) - (offsets.get(b.id) ?? 0),
  );

  const margins: number[] = [];
  let prevRight = 0;

  for (const match of sorted) {
    const left = offsets.get(match.id) ?? prevRight;
    margins.push(Math.max(0, left - prevRight));
    prevRight = left + matchWidth;
  }

  const orderMap = new Map(sorted.map((m, i) => [m.id, i]));
  return round.map((m) => margins[orderMap.get(m.id) ?? 0] ?? 0);
}

/** Verify each round has the expected number of matches for the event draw */
export function validateRoundCounts(
  rounds: BracketMatch[][],
  roundSizes: readonly number[] = EXPECTED_ROUND_SIZES,
): string[] {
  const warnings: string[] = [];

  for (let i = 0; i < roundSizes.length; i++) {
    const expected = roundSizes[i];
    const actual = rounds[i]?.length ?? 0;
    if (actual !== expected) {
      warnings.push(
        `Round ${i + 1}: expected ${expected} matches, got ${actual}`,
      );
    }
  }

  if (rounds.length > roundSizes.length) {
    warnings.push(
      `Unexpected extra rounds: ${rounds.length} > ${roundSizes.length}`,
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
