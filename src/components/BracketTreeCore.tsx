"use client";

import type { BracketState } from "@/lib/types";
import {
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
  const matchHeight = compact ? 52 : 88;
  const gap = compact ? 4 : 8;
  const offsets = computeMatchOffsets(bracket.rounds, matchHeight, gap);

  return (
    <div
      className={`flex ${compact ? "gap-3" : "gap-6"} min-w-max`}
      data-bracket-root
    >
      {bracket.rounds.map((round, roundIndex) => {
        const margins = getMatchMarginTops(round, offsets, matchHeight);
        const columnHeight = getColumnHeight(round, offsets, matchHeight, gap);

        return (
          <div
            key={roundIndex}
            className={`flex flex-col shrink-0 ${columnClassName}`}
            data-bracket-region="round"
            data-round-index={roundIndex}
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
                    style={{ marginTop: margins[matchIndex] }}
                  >
                    <MatchCard
                      berks={match.berks}
                      bucks={match.bucks}
                      winner={match.winner}
                      status={match.status}
                      verdict={match.verdict}
                      roundLabel={compact ? "" : match.roundLabel}
                      raceTime={match.raceTime}
                      raceNumber={match.raceNumber}
                      showStations={roundIndex === 0 || compact}
                      compact={compact}
                    />
                  </div>
                );
              })}
            </div>
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
