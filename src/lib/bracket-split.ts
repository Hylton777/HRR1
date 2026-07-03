import type { BracketMatch, BracketState } from "./types";

export interface SplitBracketHalves {
  leftRounds: BracketMatch[][];
  rightRounds: BracketMatch[][];
  final: BracketMatch | null;
  leftSemiId: string | null;
  rightSemiId: string | null;
}

function collectSubtree(
  rootId: string,
  byId: Map<string, BracketMatch>,
): Set<string> {
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    const match = byId.get(id);
    match?.feeders?.forEach((feederId) => stack.push(feederId));
  }
  return ids;
}

/** Split a knockout tree into left/right halves meeting at the final. */
export function splitBracketHalves(
  rounds: BracketMatch[][],
): SplitBracketHalves {
  const empty: SplitBracketHalves = {
    leftRounds: [],
    rightRounds: [],
    final: null,
    leftSemiId: null,
    rightSemiId: null,
  };

  if (rounds.length === 0) return empty;

  const allMatches = rounds.flat();
  const byId = new Map(allMatches.map((m) => [m.id, m]));

  const finalRound = rounds[rounds.length - 1];
  if (finalRound.length !== 1) return empty;

  const final = finalRound[0];
  const semiIds = final.feeders;
  if (!semiIds || semiIds.length !== 2) return empty;

  const leftIds = collectSubtree(semiIds[0], byId);
  const rightIds = collectSubtree(semiIds[1], byId);

  const penultimate = rounds.slice(0, -1);
  const leftRounds = penultimate.map((round) =>
    round.filter((m) => leftIds.has(m.id)),
  );
  const rightRounds = penultimate.map((round) =>
    round.filter((m) => rightIds.has(m.id)),
  );

  return {
    leftRounds,
    rightRounds,
    final,
    leftSemiId: semiIds[0],
    rightSemiId: semiIds[1],
  };
}

export function halfBracketState(
  source: BracketState,
  rounds: BracketMatch[][],
): BracketState {
  return {
    ...source,
    rounds,
    champion: null,
  };
}

export function canSplitBracket(rounds: BracketMatch[][]): boolean {
  const split = splitBracketHalves(rounds);
  return (
    split.final !== null &&
    split.leftSemiId !== null &&
    split.rightSemiId !== null &&
    split.leftRounds.some((r) => r.length > 0) &&
    split.rightRounds.some((r) => r.length > 0)
  );
}
