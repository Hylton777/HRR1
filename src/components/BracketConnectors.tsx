"use client";

import type { BracketMatch } from "@/lib/types";

interface BracketConnectorsProps {
  rounds: BracketMatch[][];
  offsets: Map<string, number>;
  matchHeight: number;
  columnWidth: number;
  columnGap: number;
  headerHeight: number;
  compact?: boolean;
  dimUnfocused?: boolean;
  isMatchFocused?: (match: BracketMatch) => boolean;
}

function matchCenterY(
  matchId: string,
  offsets: Map<string, number>,
  headerHeight: number,
  matchHeight: number,
): number {
  return (offsets.get(matchId) ?? 0) + headerHeight + matchHeight / 2;
}

export default function BracketConnectors({
  rounds,
  offsets,
  matchHeight,
  columnWidth,
  columnGap,
  headerHeight,
  compact = false,
  dimUnfocused = false,
  isMatchFocused,
}: BracketConnectorsProps) {
  const columnLeft = (roundIndex: number) =>
    roundIndex * (columnWidth + columnGap);

  const paths: { d: string; dimmed: boolean }[] = [];

  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const prevLeft = columnLeft(ri - 1);
    const childLeft = columnLeft(ri);
    const midX = prevLeft + columnWidth + columnGap / 2;
    const feederRight = prevLeft + columnWidth;

    for (const match of round) {
      if (!match.feeders || match.feeders.length !== 2) continue;

      const [f0, f1] = match.feeders;
      const y0 = matchCenterY(f0, offsets, headerHeight, matchHeight);
      const y1 = matchCenterY(f1, offsets, headerHeight, matchHeight);
      const childY = matchCenterY(match.id, offsets, headerHeight, matchHeight);
      const childEdge = childLeft;
      const spineTop = Math.min(y0, y1);
      const spineBottom = Math.max(y0, y1);

      const focused =
        !dimUnfocused ||
        !isMatchFocused ||
        isMatchFocused(match) ||
        match.feeders.some((id) => {
          const feeder = rounds[ri - 1]?.find((m) => m.id === id);
          return feeder && isMatchFocused(feeder);
        });

      const dimmed = !focused;

      // Upper feeder → spine
      paths.push({
        d: `M ${feederRight} ${y0} H ${midX}`,
        dimmed,
      });
      // Lower feeder → spine
      paths.push({
        d: `M ${feederRight} ${y1} H ${midX}`,
        dimmed,
      });
      // Vertical spine joining both feeders
      paths.push({
        d: `M ${midX} ${spineTop} V ${spineBottom}`,
        dimmed,
      });
      // Spine → child match
      paths.push({
        d: `M ${midX} ${childY} H ${childEdge}`,
        dimmed,
      });
    }
  }

  if (paths.length === 0) return null;

  const totalWidth =
    rounds.length * columnWidth + Math.max(0, rounds.length - 1) * columnGap;
  let maxBottom = headerHeight;
  for (const [, top] of offsets) {
    maxBottom = Math.max(maxBottom, top + headerHeight + matchHeight);
  }
  const totalHeight = maxBottom + 8;

  const strokeWidth = compact ? 1 : 1.5;
  const strokeColor = "var(--connector-stroke, #c5cdd8)";

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-0"
      width={totalWidth}
      height={totalHeight}
      aria-hidden
    >
      {paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={path.dimmed ? "opacity-20" : "opacity-70"}
        />
      ))}
    </svg>
  );
}
