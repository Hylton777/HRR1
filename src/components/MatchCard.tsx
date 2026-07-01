"use client";

import { formatRaceSchedule } from "@/lib/schedule-label";
import { crewsMatch } from "@/lib/crew-match";
import {
  COMPACT_MATCH_HEIGHT,
  COMPACT_MATCH_WIDTH,
} from "@/lib/bracket-layout";

interface MatchCardProps {
  berks: { name: string; shortName?: string; number?: number } | null;
  bucks: { name: string; shortName?: string; number?: number } | null;
  winner: { name: string; shortName?: string } | null;
  status: "pending" | "scheduled" | "complete";
  verdict: string | null;
  roundLabel: string;
  raceTime?: string | null;
  raceNumber?: string | null;
  showStations?: boolean;
  compact?: boolean;
}

function displayName(
  crew: { name: string; shortName?: string } | null,
): string {
  if (!crew) return "TBD";
  return crew.shortName || crew.name;
}

function CrewRow({
  crew,
  side,
  isWinner,
  isLoser,
  showStation,
  compact,
}: {
  crew: { name: string; shortName?: string; number?: number } | null;
  side: "berks" | "bucks";
  isWinner: boolean;
  isLoser: boolean;
  showStation: boolean;
  compact: boolean;
}) {
  const stationLabel = side === "berks" ? "B" : "K";
  const stationColor =
    side === "berks" ? "text-[var(--berks)]" : "text-[var(--bucks)]";

  return (
    <div
      className={`flex items-center gap-1 rounded transition-colors ${
        compact ? "px-2 py-2 sm:py-1.5 text-sm" : "px-2 py-2 sm:py-1.5 text-sm"
      } ${
        isWinner
          ? "bg-emerald-50 text-[var(--winner)] font-medium"
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
      <span className="min-w-0 truncate" title={crew?.name}>
        {displayName(crew)}
      </span>
    </div>
  );
}

function CompactBracketBox({
  berks,
  bucks,
  berksWon,
  bucksWon,
  status,
  raceTime,
}: {
  berks: MatchCardProps["berks"];
  bucks: MatchCardProps["bucks"];
  berksWon: boolean;
  bucksWon: boolean;
  status: MatchCardProps["status"];
  raceTime: string | null;
}) {
  const rowClass = (isWinner: boolean, isLoser: boolean, hasCrew: boolean) => {
    if (isWinner) return "bg-emerald-50/80 text-[var(--winner)] font-medium";
    if (status === "complete" && isLoser)
      return "text-[var(--loser)] line-through opacity-50";
    if (!hasCrew) return "text-[var(--muted)] italic";
    return "text-[var(--foreground)]";
  };

  return (
    <div
      className={`bg-[var(--card)] border rounded-sm overflow-hidden shadow-sm flex flex-col ${
        status === "complete"
          ? "border-emerald-200"
          : status === "scheduled"
            ? "border-[var(--hrr-blue)]/50"
            : "border-[var(--card-border)]"
      }`}
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
          className={`flex-1 flex items-center px-1.5 min-h-0 border-b border-[var(--card-border)] text-[9px] leading-tight ${rowClass(berksWon, status === "complete" && !berksWon && !!berks, !!berks)}`}
        >
          <span className="truncate w-full" title={berks?.name}>
            {displayName(berks)}
          </span>
        </div>
        <div
          className={`flex-1 flex items-center px-1.5 min-h-0 text-[9px] leading-tight ${rowClass(bucksWon, status === "complete" && !bucksWon && !!bucks, !!bucks)}`}
        >
          <span className="truncate w-full" title={bucks?.name}>
            {displayName(bucks)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MatchCard({
  berks,
  bucks,
  winner,
  status,
  verdict,
  roundLabel,
  raceTime = null,
  raceNumber = null,
  showStations = false,
  compact = false,
}: MatchCardProps) {
  const berksWon =
    winner && berks ? crewsMatch(winner.name, berks.name) : false;
  const bucksWon =
    winner && bucks ? crewsMatch(winner.name, bucks.name) : false;

  if (compact) {
    return (
      <CompactBracketBox
        berks={berks}
        bucks={bucks}
        berksWon={berksWon}
        bucksWon={bucksWon}
        status={status}
        raceTime={raceTime}
      />
    );
  }

  return (
    <div
      className={`bg-[var(--card)] border rounded-sm overflow-hidden shadow-sm w-full md:w-[220px] ${
        status === "complete"
          ? "border-emerald-200"
          : status === "scheduled"
            ? "border-[var(--hrr-blue)]/40"
            : "border-[var(--card-border)]"
      }`}
    >
      {(roundLabel || status === "scheduled") && (
        <div className="bg-[var(--hrr-cream)] text-[var(--muted)] flex justify-between gap-1 px-3 py-1.5 text-xs">
          {roundLabel ? (
            <span className="truncate">{roundLabel}</span>
          ) : (
            <span />
          )}
          {status === "scheduled" && (
            <span
              className={`shrink-0 ${
                raceTime ? "text-[var(--hrr-blue)] font-medium" : "text-[var(--bucks)]"
              }`}
            >
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
        />
      </div>
      {status === "complete" && verdict && (
        <div className="px-3 py-1.5 text-xs text-center border-t border-[var(--card-border)] text-[var(--muted)]">
          {verdict}
        </div>
      )}
    </div>
  );
}
