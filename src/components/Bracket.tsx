"use client";

import type { BracketState } from "@/lib/types";
import MatchCard from "./MatchCard";

interface BracketProps {
  bracket: BracketState;
}

const ROUND_NAMES = ["1st Round", "2nd Round", "Quarter-Final", "Semi-Final", "Final"];

export default function Bracket({ bracket }: BracketProps) {
  const matchHeight = 88;

  return (
    <div className="bracket-scroll overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max px-2">
        {bracket.rounds.map((round, roundIndex) => {
          const slotMultiplier = Math.pow(2, roundIndex);
          const paddingTop = (matchHeight + 8) * (slotMultiplier - 1);

          return (
            <div key={roundIndex} className="flex flex-col">
              <h3 className="text-sm font-semibold text-[var(--accent)] mb-4 text-center sticky top-0 bg-[var(--background)] py-1 z-10">
                {ROUND_NAMES[roundIndex] ?? `Round ${roundIndex + 1}`}
                <span className="block text-xs font-normal text-[var(--loser)]">
                  {round.length} race{round.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <div
                className="flex flex-col gap-2"
                style={{ paddingTop: roundIndex > 0 ? paddingTop / 2 : 0 }}
              >
                {round.map((match, matchIndex) => (
                  <div
                    key={match.id}
                    style={{
                      marginTop:
                        roundIndex > 0
                          ? matchIndex > 0
                            ? (matchHeight + 8) * (slotMultiplier - 1)
                            : 0
                          : 0,
                    }}
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
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {bracket.champion && (
          <div className="flex flex-col justify-center min-w-[160px]">
            <h3 className="text-sm font-semibold text-[var(--accent)] mb-4 text-center">
              Champion
            </h3>
            <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] rounded-lg p-4 text-center">
              <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
                2026 Winner
              </div>
              <div className="font-bold text-lg">
                {bracket.champion.shortName || bracket.champion.name}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
