"use client";

import type { BracketState } from "@/lib/types";
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
      className={`bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] rounded-lg text-center ${
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

  return (
    <div
      className={`flex ${compact ? "gap-3" : "gap-6"} min-w-max`}
      data-bracket-root
    >
      {bracket.rounds.map((round, roundIndex) => {
        const slotMultiplier = Math.pow(2, roundIndex);

        return (
          <div
            key={roundIndex}
            className={`flex flex-col shrink-0 ${columnClassName}`}
            data-bracket-region="round"
            data-round-index={roundIndex}
          >
            <h3
              className={`font-semibold text-[var(--accent)] text-center sticky top-0 bg-[var(--background)] z-10 ${
                compact
                  ? "text-[10px] mb-1 py-0.5"
                  : "text-sm mb-4 py-1"
              }`}
            >
              {ROUND_NAMES[roundIndex] ?? `Round ${roundIndex + 1}`}
              <span
                className={`block font-normal text-[var(--loser)] ${
                  compact ? "text-[9px]" : "text-xs"
                }`}
              >
                {round.length} race{round.length !== 1 ? "s" : ""}
              </span>
            </h3>
            <div
              className="flex flex-col"
              style={{
                gap,
                paddingTop: roundIndex > 0 ? matchHeight / 2 : 0,
              }}
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
                    style={{
                      marginTop:
                        roundIndex > 0 && matchIndex > 0
                          ? (matchHeight + gap) * (slotMultiplier - 1)
                          : 0,
                    }}
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
            className={`font-semibold text-[var(--accent)] text-center ${
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
