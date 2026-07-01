"use client";

import type { BracketMatch, BracketState } from "@/lib/types";
import MatchCard from "./MatchCard";

interface BracketProps {
  bracket: BracketState;
}

const ROUND_NAMES = [
  "1st Round",
  "2nd Round",
  "Quarter-Final",
  "Semi-Final",
  "Final",
];

function ChampionCard({
  champion,
}: {
  champion: NonNullable<BracketState["champion"]>;
}) {
  return (
    <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] rounded-lg p-4 text-center">
      <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
        2026 Winner
      </div>
      <div className="font-bold text-lg">
        {champion.shortName || champion.name}
      </div>
    </div>
  );
}

function MatchCardWrapper({
  match,
  showStations,
  hideRoundLabel = false,
}: {
  match: BracketMatch;
  showStations: boolean;
  hideRoundLabel?: boolean;
}) {
  return (
    <MatchCard
      berks={match.berks}
      bucks={match.bucks}
      winner={match.winner}
      status={match.status}
      verdict={match.verdict}
      roundLabel={hideRoundLabel ? "" : match.roundLabel}
      raceTime={match.raceTime}
      raceNumber={match.raceNumber}
      showStations={showStations}
    />
  );
}

function BracketMobile({ bracket }: BracketProps) {
  return (
    <div className="space-y-8">
      {bracket.rounds.map((round, roundIndex) => (
        <section key={roundIndex}>
          <h3 className="text-sm font-semibold text-[var(--accent)] mb-3 flex items-baseline justify-between gap-2">
            <span>{ROUND_NAMES[roundIndex] ?? `Round ${roundIndex + 1}`}</span>
            <span className="text-xs font-normal text-[var(--loser)]">
              {round.length} race{round.length !== 1 ? "s" : ""}
            </span>
          </h3>
          <div className="space-y-3">
            {round.map((match) => (
              <MatchCardWrapper
                key={match.id}
                match={match}
                showStations
                hideRoundLabel
              />
            ))}
          </div>
        </section>
      ))}

      {bracket.champion && (
        <section>
          <h3 className="text-sm font-semibold text-[var(--accent)] mb-3 text-center">
            Champion
          </h3>
          <ChampionCard champion={bracket.champion} />
        </section>
      )}
    </div>
  );
}

function BracketTree({ bracket }: BracketProps) {
  const matchHeight = 88;

  return (
    <div className="bracket-scroll overflow-x-auto pb-4 -mx-2 px-2">
      <div className="flex gap-6 min-w-max">
        {bracket.rounds.map((round, roundIndex) => {
          const slotMultiplier = Math.pow(2, roundIndex);

          return (
            <div key={roundIndex} className="flex flex-col shrink-0">
              <h3 className="text-sm font-semibold text-[var(--accent)] mb-4 text-center sticky top-0 bg-[var(--background)] py-1 z-10">
                {ROUND_NAMES[roundIndex] ?? `Round ${roundIndex + 1}`}
                <span className="block text-xs font-normal text-[var(--loser)]">
                  {round.length} race{round.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <div
                className="flex flex-col gap-2"
                style={{ paddingTop: roundIndex > 0 ? matchHeight / 2 : 0 }}
              >
                {round.map((match, matchIndex) => (
                  <div
                    key={match.id}
                    style={{
                      marginTop:
                        roundIndex > 0 && matchIndex > 0
                          ? (matchHeight + 8) * (slotMultiplier - 1)
                          : 0,
                    }}
                  >
                    <MatchCardWrapper
                      match={match}
                      showStations={roundIndex === 0}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {bracket.champion && (
          <div className="flex flex-col justify-center min-w-[160px] shrink-0">
            <h3 className="text-sm font-semibold text-[var(--accent)] mb-4 text-center">
              Champion
            </h3>
            <ChampionCard champion={bracket.champion} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Bracket({ bracket }: BracketProps) {
  return (
    <>
      <div className="md:hidden">
        <BracketMobile bracket={bracket} />
      </div>
      <div className="hidden md:block">
        <BracketTree bracket={bracket} />
      </div>
    </>
  );
}
