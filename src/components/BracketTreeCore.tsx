"use client";

import type { BracketState } from "@/lib/types";
import {
  COMPACT_MATCH_GAP,
  COMPACT_MATCH_HEIGHT,
  COMPACT_MATCH_WIDTH,
  DESKTOP_MATCH_GAP,
  DESKTOP_MATCH_HEIGHT,
  computeMatchOffsets,
  getColumnHeight,
  getMatchMarginTops,
} from "@/lib/bracket-layout";
import { isMatchInView, type BracketViewPreset } from "@/lib/regatta-days";
import MatchCard from "./MatchCard";

const ROUND_NAMES = [
  "1st Round",
  "2nd Round",
  "Quarter-Final",
  "Semi-Final",
  "Final",
];

export interface BracketTreeCoreProps {
  bracket: BracketState;
  compact?: boolean;
  viewPreset?: BracketViewPreset;
  dimUnfocused?: boolean;
  columnClassName?: string;
}

function ChampionCard({
  champion,
  compact,
}: {
  champion: NonNullable<BracketState["champion"]>;
  compact?: boolean;
}) {
  return (
    <div
      className={`bg-gradient-to-br from-[var(--hrr-navy)] to-[var(--hrr-blue)] rounded-sm text-center text-white ${
        compact ? "p-2" : "p-4"
      }`}
      data-bracket-region="champion"
    >
      <div
        className={`uppercase tracking-wider opacity-80 mb-0.5 ${
          compact ? "text-[9px]" : "text-xs"
        }`}
      >
        2026 Winner
      </div>
      <div className={`font-bold ${compact ? "text-xs" : "text-lg"}`}>
        {champion.shortName || champion.name}
      </div>
    </div>
  );
}

export default function BracketTreeCore({
  bracket,
  compact = false,
  viewPreset = "full",
  dimUnfocused = false,
  columnClassName = "",
}: BracketTreeCoreProps) {
  const matchHeight = compact ? COMPACT_MATCH_HEIGHT : DESKTOP_MATCH_HEIGHT;
  const gap = compact ? COMPACT_MATCH_GAP : DESKTOP_MATCH_GAP;
  const columnWidth = compact ? COMPACT_MATCH_WIDTH : 220;
  const offsets = computeMatchOffsets(bracket.rounds, matchHeight, gap);

  return (
    <div
      className={`flex ${compact ? "gap-3" : "gap-6"} min-w-max`}
      data-bracket-root
    >
      {bracket.rounds.map((round, roundIndex) => {
        const columnHeight = getColumnHeight(round, offsets, matchHeight, gap);
        const margins = compact
          ? null
          : getMatchMarginTops(round, offsets, matchHeight);

        return (
          <div
            key={roundIndex}
            className={`flex flex-col shrink-0 ${columnClassName}`}
            data-bracket-region="round"
            data-round-index={roundIndex}
            style={compact ? { width: columnWidth } : undefined}
          >
            <h3
              className={`font-display font-semibold text-[var(--hrr-navy)] text-center sticky top-0 bg-[var(--background)] z-10 ${
                compact
                  ? "text-[10px] mb-1 py-0.5"
                  : "text-sm mb-4 py-1"
              }`}
            >
              {ROUND_NAMES[roundIndex] ?? `Round ${roundIndex + 1}`}
              <span
                className={`block font-sans font-normal text-[var(--muted)] ${
                  compact ? "text-[9px]" : "text-xs"
                }`}
              >
                {round.length} race{round.length !== 1 ? "s" : ""}
              </span>
            </h3>
            {compact ? (
              <div
                className="relative"
                style={{ height: columnHeight, width: columnWidth }}
              >
                {round.map((match) => {
                  const focused = isMatchInView(match, viewPreset);
                  const top = offsets.get(match.id) ?? 0;

                  return (
                    <div
                      key={match.id}
                      data-bracket-region="match"
                      data-match-id={match.id}
                      data-round-index={roundIndex}
                      data-focused={focused ? "true" : "false"}
                      className={`absolute left-0 transition-opacity duration-200 ${
                        dimUnfocused && !focused ? "opacity-25" : "opacity-100"
                      }`}
                      style={{ top, width: columnWidth }}
                    >
                      <MatchCard
                        berks={match.berks}
                        bucks={match.bucks}
                        winner={match.winner}
                        status={match.status}
                        verdict={match.verdict}
                        roundLabel=""
                        raceTime={match.raceTime}
                        raceNumber={match.raceNumber}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="flex flex-col"
                style={{ gap: 0, minHeight: columnHeight }}
              >
                {round.map((match, matchIndex) => {
                  const focused = isMatchInView(match, viewPreset);

                  return (
                    <div
                      key={match.id}
                      data-bracket-region="match"
                      data-match-id={match.id}
                      data-round-index={roundIndex}
                      data-focused={focused ? "true" : "false"}
                      className={`transition-opacity duration-200 ${
                        dimUnfocused && !focused ? "opacity-25" : "opacity-100"
                      }`}
                      style={{ marginTop: margins?.[matchIndex] ?? 0 }}
                    >
                      <MatchCard
                        berks={match.berks}
                        bucks={match.bucks}
                        winner={match.winner}
                        status={match.status}
                        verdict={match.verdict}
                        roundLabel={match.roundLabel}
                        raceTime={match.raceTime}
                        raceNumber={match.raceNumber}
                        showStations={roundIndex === 0}
                        compact={false}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {bracket.champion && (
        <div
          className={`flex flex-col justify-center shrink-0 ${
            compact ? "min-w-[72px]" : "min-w-[160px]"
          }`}
          data-bracket-region="champion-column"
        >
          <h3
            className={`font-display font-semibold text-[var(--hrr-navy)] text-center ${
              compact ? "text-[10px] mb-1" : "text-sm mb-4"
            }`}
          >
            Champion
          </h3>
          <ChampionCard champion={bracket.champion} compact={compact} />
        </div>
      )}
    </div>
  );
}
