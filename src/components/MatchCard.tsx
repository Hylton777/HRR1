"use client";

import { useState } from "react";
import { formatRaceSchedule } from "@/lib/schedule-label";
import { crewsEquivalentForDisplay } from "@/lib/display-consistency";
import { isSeededCrew } from "@/lib/crew-seeds";
import { raceResultFromMatch, type RaceResultDetail } from "@/lib/race-result";
import type { Crew, RaceSplits } from "@/lib/types";
import {
  COMPACT_MATCH_HEIGHT,
  COMPACT_MATCH_WIDTH,
} from "@/lib/bracket-layout";
import RaceResultModal from "./RaceResultModal";
import { useEvent } from "./EventContext";

interface MatchCardProps {
  berks: Crew | null;
  bucks: Crew | null;
  berksPlaceholder?: string;
  bucksPlaceholder?: string;
  winner: Crew | null;
  loser?: Crew | null;
  status: "pending" | "scheduled" | "complete";
  verdict: string | null;
  roundLabel: string;
  raceTime?: string | null;
  raceNumber?: string | null;
  raceDay?: string | null;
  splits?: RaceSplits | null;
  station?: string | null;
  matchId?: string;
  showStations?: boolean;
  compact?: boolean;
}

function displayName(
  crew: { name: string; shortName?: string } | null,
  placeholder?: string,
): string {
  if (!crew) return placeholder ?? "TBD";
  return crew.shortName || crew.name;
}

function buildDetailFromProps(props: MatchCardProps): RaceResultDetail | null {
  if (!props.matchId || props.status !== "complete") return null;
  if (!props.winner || !props.loser || !props.verdict) return null;

  return raceResultFromMatch({
    id: props.matchId,
    roundIndex: 0,
    matchIndex: 0,
    roundLabel: props.roundLabel || "Race",
    berks: props.berks,
    bucks: props.bucks,
    status: props.status,
    winner: props.winner,
    loser: props.loser,
    verdict: props.verdict,
    raceNumber: props.raceNumber ?? null,
    raceTime: props.raceTime ?? null,
    raceDay: props.raceDay ?? null,
    splits: props.splits ?? null,
    station: props.station ?? null,
  });
}

function CrewRow({
  crew,
  side,
  isWinner,
  isLoser,
  showStation,
  compact,
  event,
  placeholder,
}: {
  crew: Crew | null;
  side: "berks" | "bucks";
  isWinner: boolean;
  isLoser: boolean;
  showStation: boolean;
  compact: boolean;
  event: ReturnType<typeof useEvent>;
  placeholder?: string;
}) {
  const stationLabel = side === "berks" ? "B" : "K";
  const stationColor =
    side === "berks" ? "text-[var(--berks)]" : "text-[var(--bucks)]";

  return (
    <div
      data-connector-anchor={side}
      className={`flex items-center gap-1 rounded transition-colors ${
        compact ? "px-2 py-2 sm:py-1.5 text-sm" : "px-2 py-2 sm:py-1.5 text-sm"
      } ${
        isWinner
          ? `bg-emerald-50 text-[var(--winner)] ${isSeededCrew(crew, event) ? "font-bold" : "font-medium"}`
          : isLoser
            ? "text-[var(--loser)] line-through opacity-60"
            : crew
              ? "text-[var(--foreground)]"
              : "text-[var(--muted)] italic"
      }`}
    >
      {showStation && (
        <span
          className={`font-bold shrink-0 text-center ${stationColor} text-xs w-5`}
        >
          {stationLabel}
        </span>
      )}
      <span
        className={`min-w-0 truncate ${isSeededCrew(crew, event) ? "font-bold" : ""}`}
        title={crew?.name}
      >
        {displayName(crew, placeholder)}
      </span>
    </div>
  );
}

function CompactBracketBox({
  berks,
  bucks,
  berksPlaceholder,
  bucksPlaceholder,
  berksWon,
  bucksWon,
  status,
  raceTime,
  verdict,
  onOpenDetail,
  event,
}: {
  berks: MatchCardProps["berks"];
  bucks: MatchCardProps["bucks"];
  berksPlaceholder?: string;
  bucksPlaceholder?: string;
  berksWon: boolean;
  bucksWon: boolean;
  status: MatchCardProps["status"];
  raceTime: string | null;
  verdict: string | null;
  onOpenDetail?: () => void;
  event: ReturnType<typeof useEvent>;
}) {
  const rowClass = (isWinner: boolean, isLoser: boolean, hasCrew: boolean, crew: MatchCardProps["berks"]) => {
    if (isWinner) {
      return `bg-emerald-50/80 text-[var(--winner)] ${isSeededCrew(crew, event) ? "font-bold" : "font-medium"}`;
    }
    if (status === "complete" && isLoser)
      return "text-[var(--loser)] line-through opacity-50";
    if (!hasCrew) return "text-[var(--muted)] italic";
    return isSeededCrew(crew, event)
      ? "text-[var(--foreground)] font-bold"
      : "text-[var(--foreground)]";
  };

  const interactive = status === "complete" && !!onOpenDetail;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onOpenDetail : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenDetail?.();
              }
            }
          : undefined
      }
      onPointerDown={
        interactive
          ? (event) => {
              event.stopPropagation();
            }
          : undefined
      }
      className={`bg-[var(--card)] border rounded-sm overflow-hidden shadow-sm flex flex-col ${
        status === "complete"
          ? "border-emerald-200"
          : status === "scheduled"
            ? "border-[var(--hrr-blue)]/50"
            : "border-[var(--card-border)]"
      } ${interactive ? "cursor-pointer hover:border-[var(--hrr-blue)]/60" : ""}`}
      style={{
        width: COMPACT_MATCH_WIDTH,
        height: COMPACT_MATCH_HEIGHT,
      }}
    >
      {status === "scheduled" && raceTime && (
        <div className="text-[7px] text-[var(--hrr-blue)] text-center bg-[var(--hrr-cream)] border-b border-[var(--card-border)] leading-tight py-px shrink-0">
          {raceTime}
        </div>
      )}
      <div className="flex flex-col flex-1 min-h-0">
        <div
          className={`flex-1 flex items-center px-1.5 min-h-0 border-b border-[var(--card-border)] text-[9px] leading-tight ${rowClass(berksWon, status === "complete" && !berksWon && !!berks, !!berks, berks)}`}
          data-connector-anchor="berks"
        >
          <span
            className={`truncate w-full ${isSeededCrew(berks, event) ? "font-bold" : ""}`}
            title={berks?.name}
          >
            {displayName(berks, berksPlaceholder)}
          </span>
        </div>
        <div
          className={`flex-1 flex items-center px-1.5 min-h-0 text-[9px] leading-tight ${rowClass(bucksWon, status === "complete" && !bucksWon && !!bucks, !!bucks, bucks)}`}
          data-connector-anchor="bucks"
        >
          <span
            className={`truncate w-full ${isSeededCrew(bucks, event) ? "font-bold" : ""}`}
            title={bucks?.name}
          >
            {displayName(bucks, bucksPlaceholder)}
          </span>
        </div>
      </div>
      {status === "complete" && verdict && (
        <div className="text-[8px] font-semibold text-center text-[var(--hrr-navy)] bg-emerald-50 border-t border-emerald-200 leading-tight py-0.5 shrink-0 truncate px-1">
          {verdict}
        </div>
      )}
    </div>
  );
}

export default function MatchCard(props: MatchCardProps) {
  const event = useEvent();
  const {
    berks,
    bucks,
    berksPlaceholder,
    bucksPlaceholder,
    winner,
    status,
    verdict,
    roundLabel,
    raceTime = null,
    raceNumber = null,
    showStations = false,
    compact = false,
  } = props;

  const [detail, setDetail] = useState<RaceResultDetail | null>(null);

  const berksWon =
    winner && berks ? crewsEquivalentForDisplay(winner, berks) : false;
  const bucksWon =
    winner && bucks ? crewsEquivalentForDisplay(winner, bucks) : false;

  const openDetail = () => {
    const next = buildDetailFromProps(props);
    if (next) setDetail(next);
  };

  if (compact) {
    return (
      <>
        <CompactBracketBox
          berks={berks}
          bucks={bucks}
          berksPlaceholder={berksPlaceholder}
          bucksPlaceholder={bucksPlaceholder}
          berksWon={berksWon}
          bucksWon={bucksWon}
          status={status}
          raceTime={raceTime}
          verdict={verdict}
          onOpenDetail={status === "complete" ? openDetail : undefined}
          event={event}
        />
        {detail && (
          <RaceResultModal detail={detail} onClose={() => setDetail(null)} />
        )}
      </>
    );
  }

  const interactive = status === "complete" && !!buildDetailFromProps(props);

  return (
    <>
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? openDetail : undefined}
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetail();
                }
              }
            : undefined
        }
        className={`bg-[var(--card)] border rounded-sm overflow-hidden shadow-sm w-full md:w-[220px] ${
          status === "complete"
            ? "border-emerald-200"
            : status === "scheduled"
              ? "border-[var(--hrr-blue)]/40"
              : "border-[var(--card-border)]"
        } ${interactive ? "cursor-pointer hover:border-[var(--hrr-blue)]/50 transition-colors" : ""}`}
      >
        {(roundLabel || status === "scheduled") && (
          <div className="bg-[var(--hrr-cream)] text-[var(--muted)] flex justify-between gap-1 px-3 py-1.5 text-xs">
            {roundLabel ? (
              <span className="truncate">{roundLabel}</span>
            ) : (
              <span />
            )}
            {status === "scheduled" && formatRaceSchedule(raceTime, raceNumber) && (
              <span className="shrink-0 text-[var(--hrr-blue)] font-medium">
                {formatRaceSchedule(raceTime, raceNumber)}
              </span>
            )}
          </div>
        )}
        <div className="p-2 space-y-0.5">
          <CrewRow
            crew={berks}
            side="berks"
            isWinner={berksWon}
            isLoser={status === "complete" && !berksWon && !!berks}
            showStation={showStations}
            compact={false}
            event={event}
            placeholder={berksPlaceholder}
          />
          <div className="text-center text-[10px] text-[var(--muted)] py-0.5">
            vs
          </div>
          <CrewRow
            crew={bucks}
            side="bucks"
            isWinner={bucksWon}
            isLoser={status === "complete" && !bucksWon && !!bucks}
            showStation={showStations}
            compact={false}
            event={event}
            placeholder={bucksPlaceholder}
          />
        </div>
        {status === "complete" && verdict && (
          <div className="px-3 py-2 text-xs text-center border-t border-emerald-200 bg-emerald-50/60 text-[var(--hrr-navy)] font-semibold">
            {verdict}
            {props.splits?.finish?.time ? (
              <span className="text-[var(--muted)] font-normal">
                {" "}
                · {props.splits.finish.time}
              </span>
            ) : null}
          </div>
        )}
        {interactive && (
          <div className="px-3 py-1 text-[10px] text-center text-[var(--muted)] border-t border-[var(--card-border)]">
            Click for split times
          </div>
        )}
      </div>
      {detail && (
        <RaceResultModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
