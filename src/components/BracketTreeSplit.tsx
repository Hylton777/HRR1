"use client";

import { useRef } from "react";
import type { BracketState } from "@/lib/types";
import {
  canSplitBracket,
  halfBracketState,
  splitBracketHalves,
} from "@/lib/bracket-split";
import BracketCenterConnectors from "./BracketCenterConnectors";
import BracketTreeCore from "./BracketTreeCore";
import MatchCard from "./MatchCard";
import { useEvent } from "./EventContext";
import { feederPlaceholderLabel } from "@/lib/feeder-label";
import { isSeededCrew } from "@/lib/crew-seeds";

export interface BracketTreeSplitProps {
  bracket: BracketState;
  viewPreset?: import("@/lib/regatta-days").BracketViewPreset;
  dimUnfocused?: boolean;
}

function ChampionCard({
  champion,
  event,
}: {
  champion: NonNullable<BracketState["champion"]>;
  event: ReturnType<typeof useEvent>;
}) {
  return (
    <div
      className="bg-gradient-to-br from-[var(--hrr-navy)] to-[var(--hrr-blue)] rounded-sm text-center text-white p-2"
      data-bracket-region="champion"
    >
      <div className="uppercase tracking-wider opacity-80 mb-0.5 text-[9px]">
        2026 Winner
      </div>
      <div
        className={`text-xs ${isSeededCrew(champion, event) ? "font-extrabold" : "font-bold"}`}
      >
        {champion.shortName || champion.name}
      </div>
    </div>
  );
}

export default function BracketTreeSplit({
  bracket,
  viewPreset = "full",
  dimUnfocused = false,
}: BracketTreeSplitProps) {
  const event = useEvent();
  const rootRef = useRef<HTMLDivElement>(null);

  if (!canSplitBracket(bracket.rounds)) {
    return (
      <BracketTreeCore
        bracket={bracket}
        compact
        viewPreset={viewPreset}
        dimUnfocused={dimUnfocused}
        layout="columns"
      />
    );
  }

  const split = splitBracketHalves(bracket.rounds);
  const leftRounds = split.leftRounds.filter((r) => r.length > 0);
  const rightRounds = split.rightRounds.filter((r) => r.length > 0);
  const leftBracket = halfBracketState(bracket, leftRounds);
  const rightBracket = halfBracketState(bracket, rightRounds);
  const final = split.final!;
  const allMatches = bracket.rounds.flat();
  const matchById = new Map(allMatches.map((m) => [m.id, m]));
  const finalRoundIndex = bracket.rounds.length - 1;

  return (
    <div
      ref={rootRef}
      className="relative flex flex-row items-center gap-3 min-w-max"
      data-bracket-root
    >
      <BracketCenterConnectors
        rootRef={rootRef}
        leftSemiId={split.leftSemiId!}
        rightSemiId={split.rightSemiId!}
        finalId={final.id}
      />

      <div className="relative z-10 shrink-0" data-bracket-region="half-left">
        <BracketTreeCore
          bracket={leftBracket}
          compact
          viewPreset={viewPreset}
          dimUnfocused={dimUnfocused}
          layout="columns"
          embedded
        />
      </div>

      <div
        className="relative z-10 flex flex-col justify-center items-center shrink-0 gap-3 px-1"
        data-bracket-region="center-final"
      >
        <div className="flex flex-col items-center shrink-0 min-w-[128px]">
          <h3 className="font-display font-semibold text-[var(--hrr-navy)] text-center text-[10px] mb-1 py-0.5">
            {event.roundLabels[finalRoundIndex] ?? final.roundLabel}
            <span className="block font-sans font-normal text-[var(--muted)] text-[9px]">
              1 race
            </span>
          </h3>
          <div data-bracket-region="match" data-match-id={final.id}>
            <MatchCard
              matchId={final.id}
              berks={final.berks}
              bucks={final.bucks}
              berksPlaceholder={feederPlaceholderLabel(final, "berks", matchById)}
              bucksPlaceholder={feederPlaceholderLabel(final, "bucks", matchById)}
              winner={final.winner}
              loser={final.loser}
              status={final.status}
              verdict={final.verdict}
              roundLabel={final.roundLabel}
              raceTime={final.raceTime}
              raceNumber={final.raceNumber}
              raceDay={final.raceDay}
              splits={final.splits}
              station={final.station}
              compact
            />
          </div>
        </div>

        {bracket.champion && (
          <div
            className="flex flex-col items-center shrink-0 min-w-[72px]"
            data-bracket-region="champion-column"
          >
            <h3 className="font-display font-semibold text-[var(--hrr-navy)] text-center text-[10px] mb-1">
              Champion
            </h3>
            <ChampionCard champion={bracket.champion} event={event} />
          </div>
        )}
      </div>

      <div className="relative z-10 shrink-0" data-bracket-region="half-right">
        <BracketTreeCore
          bracket={rightBracket}
          compact
          viewPreset={viewPreset}
          dimUnfocused={dimUnfocused}
          layout="columns"
          columnFlow="rtl"
          embedded
        />
      </div>
    </div>
  );
}
