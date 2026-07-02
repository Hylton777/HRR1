import type { BracketMatch } from "./types";

function feederMatch(
  match: BracketMatch,
  matchById: Map<string, BracketMatch>,
): BracketMatch | undefined {
  const feederId = match.feeders?.[0];
  if (!feederId) return undefined;
  return matchById.get(feederId);
}

/** Label for the empty station on a single-feeder bye match before the feeder completes. */
export function feederPlaceholderLabel(
  match: BracketMatch,
  side: "berks" | "bucks",
  matchById: Map<string, BracketMatch>,
): string | undefined {
  if (match.feeders?.length !== 1) return undefined;

  const feeder = feederMatch(match, matchById);
  if (!feeder) return undefined;

  const hasBerks = !!match.berks;
  const hasBucks = !!match.bucks;
  const raceNo = feeder.drawRace ?? feeder.matchIndex + 1;
  const label = `Winner of ${feeder.roundLabel} ${raceNo}`;

  if (hasBerks && !hasBucks && side === "bucks") return label;
  if (!hasBerks && hasBucks && side === "berks") return label;
  return undefined;
}
