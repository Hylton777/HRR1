"use client";

import { formatRaceSchedule } from "@/lib/schedule-label";
import { crewsMatch } from "@/lib/hrr-api";

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
        compact ? "px-1 py-0.5 text-[10px]" : "px-2 py-2 sm:py-1.5 text-sm"
      } ${
        isWinner
          ? "bg-green-950/50 text-[var(--winner)] font-medium"
          : isLoser
            ? "text-[var(--loser)] line-through opacity-60"
            : crew
              ? "text-[var(--foreground)]"
              : "text-[var(--loser)] italic"
      }`}
    >
      {showStation && (
        <span
          className={`font-bold shrink-0 text-center ${stationColor} ${
            compact ? "text-[8px] w-3" : "text-xs w-5"
          }`}
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

  return (
    <div
      className={`bg-[var(--card)] border rounded-lg overflow-hidden ${
        compact ? "w-[120px]" : "w-full md:w-[220px]"
      } ${
        status === "complete"
          ? "border-green-800/50"
          : status === "scheduled"
            ? "border-[var(--accent)]/40"
            : "border-[var(--card-border)]"
      }`}
    >
      {(roundLabel || (status === "scheduled" && !compact)) && (
        <div
          className={`bg-[var(--card-border)]/30 text-[var(--loser)] flex justify-between gap-1 ${
            compact ? "px-1 py-0.5 text-[8px]" : "px-3 py-1.5 text-xs"
          }`}
        >
          {roundLabel ? (
            <span className="truncate">{roundLabel}</span>
          ) : (
            <span />
          )}
          {status === "scheduled" && (
            <span
              className={`shrink-0 ${
                raceTime ? "text-[var(--accent)]" : "text-[var(--bucks)]"
              }`}
            >
              {compact && raceTime
                ? raceTime
                : formatRaceSchedule(raceTime, raceNumber)}
            </span>
          )}
        </div>
      )}
      {compact && status === "scheduled" && raceTime && !roundLabel && (
        <div className="px-1 py-0.5 text-[8px] text-[var(--accent)] text-center border-b border-[var(--card-border)]/40">
          {raceTime}
        </div>
      )}
      <div className={compact ? "p-0.5 space-y-0" : "p-2 space-y-0.5"}>
        <CrewRow
          crew={berks}
          side="berks"
          isWinner={berksWon}
          isLoser={status === "complete" && !berksWon && !!berks}
          showStation={showStations}
          compact={compact}
        />
        {!compact && (
          <div className="text-center text-[10px] text-[var(--loser)] py-0.5">
            vs
          </div>
        )}
        <CrewRow
          crew={bucks}
          side="bucks"
          isWinner={bucksWon}
          isLoser={status === "complete" && !bucksWon && !!bucks}
          showStation={showStations}
          compact={compact}
        />
      </div>
      {status === "complete" && verdict && !compact && (
        <div className="px-3 py-1.5 text-xs text-center border-t border-[var(--card-border)] text-[var(--loser)]">
          {verdict}
        </div>
      )}
    </div>
  );
}
