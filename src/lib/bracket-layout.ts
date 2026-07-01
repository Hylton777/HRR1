import type { BracketMatch } from "./types";

/**
 * Compute vertical offset (px) for each match so feeder lines align
 * per the official Henley steward draw (not standard binary propagation).
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
    for (const match of rounds[ri]) {
      if (match.feeders?.length === 2) {
        const y0 = offsets.get(match.feeders[0]);
        const y1 = offsets.get(match.feeders[1]);
        if (y0 !== undefined && y1 !== undefined) {
          offsets.set(match.id, (y0 + y1) / 2);
          continue;
        }
      }

      offsets.set(match.id, match.matchIndex * cell * Math.pow(2, ri));
    }
  }

  return offsets;
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
