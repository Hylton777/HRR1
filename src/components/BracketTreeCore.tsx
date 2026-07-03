"use client";

import { useRef, type CSSProperties } from "react";
import type { BracketState } from "@/lib/types";
import {
  COMPACT_MATCH_GAP,
  COMPACT_MATCH_HEIGHT,
  COMPACT_MATCH_WIDTH,
  DESKTOP_MATCH_GAP,
  DESKTOP_MATCH_HEIGHT,
  computeMatchOffsets,
  computeRowMatchOffsets,
  getColumnHeight,
  getMatchMarginTops,
  getRowWidth,
} from "@/lib/bracket-layout";
import { isMatchInView, type BracketViewPreset } from "@/lib/regatta-days";
import BracketConnectors from "./BracketConnectors";
import MatchCard from "./MatchCard";
import { useEvent } from "./EventContext";
import { isSeededCrew } from "@/lib/crew-seeds";
import { feederPlaceholderLabel } from "@/lib/feeder-label";

export interface BracketTreeCoreProps {
  bracket: BracketState;
  compact?: boolean;
  viewPreset?: BracketViewPreset;
  dimUnfocused?: boolean;
  columnClassName?: string;
  /** columns = left-to-right rounds; rows = bottom-up rounds for laptop */
  layout?: "columns" | "rows";
  /** Omit root marker when nested inside a split bracket */
  embedded?: boolean;
  /** ltr = rounds flow left-to-right; rtl = rounds flow right-to-left toward center */
  columnFlow?: "ltr" | "rtl";
}

function ChampionCard({
  champion,
  compact,
  event,
}: {
  champion: NonNullable<BracketState["champion"]>;
  compact?: boolean;
  event: ReturnType<typeof useEvent>;
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
      <div className={`${compact ? "text-xs" : "text-lg"} ${isSeededCrew(champion, event) ? "font-extrabold" : "font-bold"}`}>
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
  layout = "columns",
  embedded = false,
  columnFlow = "ltr",
}: BracketTreeCoreProps) {
  const event = useEvent();
  const rootRef = useRef<HTMLDivElement>(null);
  const matchHeight = compact ? COMPACT_MATCH_HEIGHT : DESKTOP_MATCH_HEIGHT;
  const matchWidth = compact ? COMPACT_MATCH_WIDTH : 220;
  const gap = compact ? COMPACT_MATCH_GAP : DESKTOP_MATCH_GAP;
  const columnWidth = matchWidth;
  const offsets =
    layout === "rows"
      ? computeRowMatchOffsets(bracket.rounds, matchWidth, gap)
      : computeMatchOffsets(bracket.rounds, matchHeight, gap);
  const allMatches = bracket.rounds.flat();
  const matchById = new Map(allMatches.map((match) => [match.id, match]));

  const roundIndices =
    layout === "rows"
      ? [...bracket.rounds.keys()].reverse()
      : columnFlow === "rtl"
        ? [...bracket.rounds.keys()].reverse()
        : [...bracket.rounds.keys()];

  const renderMatchCard = (
    match: (typeof allMatches)[number],
    roundIndex: number,
    options?: { style?: CSSProperties; className?: string },
  ) => {
    const focused = isMatchInView(
      match,
      viewPreset,
      event.raceDays,
      allMatches,
    );

    return (
      <div
        key={match.id}
        data-bracket-region="match"
        data-match-id={match.id}
        data-round-index={roundIndex}
        data-focused={focused ? "true" : "false"}
        className={`transition-opacity duration-200 ${
          dimUnfocused && !focused ? "opacity-25" : "opacity-100"
        } ${options?.className ?? ""}`}
        style={options?.style}
      >
        <MatchCard
          matchId={match.id}
          berks={match.berks}
          bucks={match.bucks}
          berksPlaceholder={feederPlaceholderLabel(match, "berks", matchById)}
          bucksPlaceholder={feederPlaceholderLabel(match, "bucks", matchById)}
          winner={match.winner}
          loser={match.loser}
          status={match.status}
          verdict={match.verdict}
          roundLabel={
            event.roundLabels[roundIndex] ?? match.roundLabel
          }
          raceTime={match.raceTime}
          raceNumber={match.raceNumber}
          raceDay={match.raceDay}
          splits={match.splits}
          station={match.station}
          showStations={layout === "columns" ? roundIndex === 0 : false}
          compact={layout === "rows" ? true : compact}
        />
      </div>
    );
  };

  if (layout === "rows") {
    const ROW_LABEL_WIDTH = 72;
    const maxRowWidth = Math.max(
      ...bracket.rounds.map((round) =>
        getRowWidth(round, offsets, matchWidth, gap),
      ),
      matchWidth,
    );

    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const finalMatch = finalRound?.[0];
    const championLeft =
      bracket.champion && finalMatch
        ? (offsets.get(finalMatch.id) ?? 0)
        : 0;

    return (
      <div
        ref={rootRef}
        className="relative min-w-max"
        {...(!embedded ? { "data-bracket-root": true } : {})}
      >
        <BracketConnectors
          rootRef={rootRef}
          rounds={bracket.rounds}
          compact
          dimUnfocused={dimUnfocused}
          viewPreset={viewPreset}
          allMatches={allMatches}
          layout="rows"
        />
        <div className="relative z-10 flex flex-col gap-3 min-w-max">
          {bracket.champion && (
            <div
              className="flex flex-row gap-3 items-center shrink-0"
              data-bracket-region="champion-column"
            >
              <h3
                className="font-display font-semibold text-[var(--hrr-navy)] text-right text-[10px] shrink-0"
                style={{ width: ROW_LABEL_WIDTH }}
              >
                Champion
              </h3>
              <div
                className="relative shrink-0"
                style={{ width: maxRowWidth, height: matchHeight }}
              >
                <div
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: championLeft, width: matchWidth }}
                >
                  <ChampionCard
                    champion={bracket.champion}
                    compact
                    event={event}
                  />
                </div>
              </div>
            </div>
          )}

          {roundIndices.map((roundIndex) => {
            const round = bracket.rounds[roundIndex];

            return (
              <div
                key={roundIndex}
                className="flex flex-row gap-3 items-center shrink-0"
                data-bracket-region="round"
                data-round-index={roundIndex}
              >
                <h3
                  className="font-display font-semibold text-[var(--hrr-navy)] text-right text-[10px] py-0.5 shrink-0"
                  style={{ width: ROW_LABEL_WIDTH }}
                >
                  {event.roundLabels[roundIndex] ?? `Round ${roundIndex + 1}`}
                  <span className="block font-sans font-normal text-[var(--muted)] text-[9px]">
                    {round.length} race{round.length !== 1 ? "s" : ""}
                  </span>
                </h3>
                <div
                  className="relative shrink-0"
                  style={{ width: maxRowWidth, height: matchHeight }}
                >
                  {round.map((match) => {
                    const left = offsets.get(match.id) ?? 0;
                    return renderMatchCard(match, roundIndex, {
                      className: "absolute top-0",
                      style: { left, width: matchWidth },
                    });
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative min-w-max"
      {...(!embedded ? { "data-bracket-root": true } : {})}
    >
      <BracketConnectors
        rootRef={rootRef}
        rounds={bracket.rounds}
        compact={compact}
        dimUnfocused={dimUnfocused}
        viewPreset={viewPreset}
        allMatches={allMatches}
        layout="columns"
        columnFlow={columnFlow}
      />
      <div
        className={`relative z-10 flex ${compact ? "gap-3" : "gap-6"} min-w-max`}
      >
      {roundIndices.map((roundIndex) => {
        const round = bracket.rounds[roundIndex];
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
              {event.roundLabels[roundIndex] ?? `Round ${roundIndex + 1}`}
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
                  const focused = isMatchInView(
                    match,
                    viewPreset,
                    event.raceDays,
                    allMatches,
                  );
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
                        matchId={match.id}
                        berks={match.berks}
                        bucks={match.bucks}
                        berksPlaceholder={feederPlaceholderLabel(match, "berks", matchById)}
                        bucksPlaceholder={feederPlaceholderLabel(match, "bucks", matchById)}
                        winner={match.winner}
                        loser={match.loser}
                        status={match.status}
                        verdict={match.verdict}
                        roundLabel={event.roundLabels[roundIndex] ?? match.roundLabel}
                        raceTime={match.raceTime}
                        raceNumber={match.raceNumber}
                        raceDay={match.raceDay}
                        splits={match.splits}
                        station={match.station}
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
                  const focused = isMatchInView(
                    match,
                    viewPreset,
                    event.raceDays,
                    allMatches,
                  );

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
                        matchId={match.id}
                        berks={match.berks}
                        bucks={match.bucks}
                        berksPlaceholder={feederPlaceholderLabel(match, "berks", matchById)}
                        bucksPlaceholder={feederPlaceholderLabel(match, "bucks", matchById)}
                        winner={match.winner}
                        loser={match.loser}
                        status={match.status}
                        verdict={match.verdict}
                        roundLabel={match.roundLabel}
                        raceTime={match.raceTime}
                        raceNumber={match.raceNumber}
                        raceDay={match.raceDay}
                        splits={match.splits}
                        station={match.station}
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
          <ChampionCard champion={bracket.champion} compact={compact} event={event} />
        </div>
      )}
      </div>
    </div>
  );
}
