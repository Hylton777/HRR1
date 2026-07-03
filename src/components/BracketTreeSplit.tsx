"use client";

import { useRef } from "react";
import type { BracketState, BracketMatch } from "@/lib/types";
import {
  computeMatchOffsets,
  computeSplitLayoutMetrics,
  computeViewportSplitDimensions,
  getCompactCardTypography,
} from "@/lib/bracket-layout";
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
  fitViewport?: { width: number; height: number };
}

function ChampionCard({
  champion,
  event,
  matchWidth,
  matchHeight,
}: {
  champion: NonNullable<BracketState["champion"]>;
  event: ReturnType<typeof useEvent>;
  matchWidth: number;
  matchHeight: number;
}) {
  const type = getCompactCardTypography(matchWidth, matchHeight);

  return (
    <div
      className="bg-gradient-to-br from-[var(--hrr-navy)] to-[var(--hrr-blue)] rounded-sm text-center text-white"
      style={{ padding: `${Math.round(type.paddingX * 0.75)}px` }}
      data-bracket-region="champion"
    >
      <div
        className="uppercase tracking-wider opacity-80 mb-0.5"
        style={{ fontSize: type.championLabelFontSize }}
      >
        2026 Winner
      </div>
      <div
        className={isSeededCrew(champion, event) ? "font-extrabold" : "font-bold"}
        style={{ fontSize: type.championNameFontSize }}
      >
        {champion.shortName || champion.name}
      </div>
    </div>
  );
}

function maxRoundSize(rounds: BracketMatch[][]): number {
  return Math.max(1, ...rounds.map((round) => round.length));
}

export default function BracketTreeSplit({
  bracket,
  viewPreset = "full",
  dimUnfocused = false,
  fitViewport = { width: 0, height: 0 },
}: BracketTreeSplitProps) {
  const event = useEvent();
  const rootRef = useRef<HTMLDivElement>(null);

  const split = canSplitBracket(bracket.rounds)
    ? splitBracketHalves(bracket.rounds)
    : null;
  const leftRounds = split
    ? split.leftRounds.filter((r) => r.length > 0)
    : [];
  const rightRounds = split
    ? split.rightRounds.filter((r) => r.length > 0)
    : [];

  const { matchWidth, matchHeight, gap } = split
    ? computeViewportSplitDimensions(
        fitViewport.width,
        fitViewport.height,
        leftRounds.length,
        rightRounds.length,
        Math.max(maxRoundSize(leftRounds), maxRoundSize(rightRounds)),
        !!bracket.champion,
      )
    : computeViewportSplitDimensions(
        fitViewport.width,
        fitViewport.height,
        bracket.rounds.length,
        0,
        maxRoundSize(bracket.rounds),
        !!bracket.champion,
      );

  if (!split) {
    return (
      <BracketTreeCore
        bracket={bracket}
        compact
        viewPreset={viewPreset}
        dimUnfocused={dimUnfocused}
        layout="columns"
        matchWidth={matchWidth}
        matchHeight={matchHeight}
        matchGap={gap}
      />
    );
  }

  const leftBracket = halfBracketState(bracket, leftRounds);
  const rightBracket = halfBracketState(bracket, rightRounds);
  const final = split.final!;
  const allMatches = bracket.rounds.flat();
  const matchById = new Map(allMatches.map((m) => [m.id, m]));
  const finalRoundIndex = bracket.rounds.length - 1;

  const fullOffsets = computeMatchOffsets(
    bracket.rounds,
    matchHeight,
    gap,
  );
  const finalTop = fullOffsets.get(final.id) ?? 0;
  const leftSemiTop = fullOffsets.get(split.leftSemiId!) ?? 0;
  const rightSemiTop = fullOffsets.get(split.rightSemiId!) ?? 0;
  const rawLeftAreaOffsetY = finalTop - leftSemiTop;
  const rawRightAreaOffsetY = finalTop - rightSemiTop;
  const splitMetrics = computeSplitLayoutMetrics(
    leftRounds,
    rightRounds,
    fullOffsets,
    matchHeight,
    gap,
    rawLeftAreaOffsetY,
    rawRightAreaOffsetY,
    finalTop,
  );
  const type = getCompactCardTypography(matchWidth, matchHeight);

  return (
    <div
      ref={rootRef}
      className="relative flex flex-row items-start gap-7 min-w-max"
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
          matchOffsets={fullOffsets}
          matchTreeHeight={splitMetrics.matchAreaHeight}
          matchAreaOffsetY={splitMetrics.leftAreaOffsetY}
          matchWidth={matchWidth}
          matchHeight={matchHeight}
          matchGap={gap}
        />
      </div>

      <div
        className="relative z-10 flex flex-col shrink-0 items-center gap-4"
        data-bracket-region="center-final"
      >
        <div
          className="flex flex-col items-center shrink-0"
          style={{ width: matchWidth }}
        >
          <h3
            className="font-display font-semibold text-[var(--hrr-navy)] text-center mb-1 py-0.5"
            style={{ fontSize: type.roundLabelFontSize }}
          >
            {event.roundLabels[finalRoundIndex] ?? final.roundLabel}
            <span
              className="block font-sans font-normal text-[var(--muted)]"
              style={{ fontSize: type.roundMetaFontSize }}
            >
              1 race
            </span>
          </h3>
          <div
            className="relative w-full"
            style={{ height: splitMetrics.matchAreaHeight }}
          >
            <div
              className="absolute left-0 w-full"
              style={{ top: splitMetrics.finalTop }}
              data-bracket-region="match"
              data-match-id={final.id}
            >
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
                compactWidth={matchWidth}
                compactHeight={matchHeight}
              />
            </div>
          </div>
        </div>

        {bracket.champion && (
          <div
            className="flex flex-col items-center shrink-0"
            style={{ width: matchWidth }}
            data-bracket-region="champion-column"
          >
            <h3
              className="font-display font-semibold text-[var(--hrr-navy)] text-center mb-1"
              style={{ fontSize: type.roundLabelFontSize }}
            >
              Champion
            </h3>
            <ChampionCard
              champion={bracket.champion}
              event={event}
              matchWidth={matchWidth}
              matchHeight={matchHeight}
            />
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
          matchOffsets={fullOffsets}
          matchTreeHeight={splitMetrics.matchAreaHeight}
          matchAreaOffsetY={splitMetrics.rightAreaOffsetY}
          matchWidth={matchWidth}
          matchHeight={matchHeight}
          matchGap={gap}
        />
      </div>
    </div>
  );
}
