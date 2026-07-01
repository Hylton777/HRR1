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
  crew: { name: string; shortName?: string; number?: number } | null,
): string {
  if (!crew) return "TBD";
  if (crew.number) return `${crew.number} ${crew.shortName || crew.name}`;
  return crew.shortName || crew.name;
}

function CrewRow({
  crew,
  side,
  isWinner,
  isLoser,
  showStation,
}: {
  crew: { name: string; shortName?: string; number?: number } | null;
  side: "berks" | "bucks";
  isWinner: boolean;
  isLoser: boolean;
  showStation: boolean;
}) {
  const stationLabel = side === "berks" ? "B" : "K";
  const stationColor =
    side === "berks" ? "text-[var(--berks)]" : "text-[var(--bucks)]";

  return (
    <div
      className={`flex items-center gap-2 px-2 py-2 sm:py-1.5 rounded text-sm transition-colors ${
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
          className={`text-xs font-bold w-5 shrink-0 text-center ${stationColor}`}
        >
          {stationLabel}
        </span>
      )}
      <span className="min-w-0 break-words" title={crew?.name}>
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
      className={`bg-[var(--card)] border rounded-lg overflow-hidden w-full md:w-[220px] ${
        status === "complete"
          ? "border-green-800/50"
          : status === "scheduled"
            ? "border-[var(--accent)]/40"
            : "border-[var(--card-border)]"
      } ${compact ? "text-xs" : ""}`}
    >
      {(roundLabel || status === "scheduled") && (
        <div className="px-3 py-1.5 bg-[var(--card-border)]/30 text-xs text-[var(--loser)] flex justify-between gap-2">
          {roundLabel ? <span className="truncate">{roundLabel}</span> : <span />}
          {status === "scheduled" && (
            <span
              className={`shrink-0 ${
                raceTime ? "text-[var(--accent)]" : "text-[var(--bucks)]"
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
        />
        <div className="text-center text-[10px] text-[var(--loser)] py-0.5">
          vs
        </div>
        <CrewRow
          crew={bucks}
          side="bucks"
          isWinner={bucksWon}
          isLoser={status === "complete" && !bucksWon && !!bucks}
          showStation={showStations}
        />
      </div>
      {status === "complete" && verdict && (
        <div className="px-3 py-1.5 text-xs text-center border-t border-[var(--card-border)] text-[var(--loser)]">
          {verdict}
        </div>
      )}
    </div>
  );
}
