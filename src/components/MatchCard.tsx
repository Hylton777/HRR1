"use client";

import { crewsMatch } from "@/lib/hrr-api";

interface MatchCardProps {
  berks: { name: string; shortName?: string } | null;
  bucks: { name: string; shortName?: string } | null;
  winner: { name: string; shortName?: string } | null;
  status: "pending" | "scheduled" | "complete";
  verdict: string | null;
  roundLabel: string;
  showStations?: boolean;
  compact?: boolean;
}

function displayName(crew: { name: string; shortName?: string } | null): string {
  if (!crew) return "TBD";
  return crew.shortName || crew.name;
}

function CrewRow({
  crew,
  side,
  isWinner,
  isLoser,
  showStation,
}: {
  crew: { name: string; shortName?: string } | null;
  side: "berks" | "bucks";
  isWinner: boolean;
  isLoser: boolean;
  showStation: boolean;
}) {
  const stationLabel = side === "berks" ? "B" : "K";
  const stationColor = side === "berks" ? "text-[var(--berks)]" : "text-[var(--bucks)]";

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
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
        <span className={`text-xs font-bold w-4 ${stationColor}`}>{stationLabel}</span>
      )}
      <span className="truncate" title={crew?.name}>
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
  showStations = false,
  compact = false,
}: MatchCardProps) {
  const berksWon =
    winner && berks ? crewsMatch(winner.name, berks.name) : false;
  const bucksWon =
    winner && bucks ? crewsMatch(winner.name, bucks.name) : false;

  return (
    <div
      className={`bg-[var(--card)] border rounded-lg overflow-hidden min-w-[180px] ${
        status === "complete"
          ? "border-green-800/50"
          : status === "scheduled"
            ? "border-[var(--accent)]/40"
            : "border-[var(--card-border)]"
      } ${compact ? "text-xs" : ""}`}
    >
      <div className="px-2 py-1 bg-[var(--card-border)]/30 text-xs text-[var(--loser)] flex justify-between">
        <span>{roundLabel}</span>
        {status === "scheduled" && (
          <span className="text-[var(--bucks)]">Upcoming</span>
        )}
      </div>
      <div className="p-1.5 space-y-0.5">
        <CrewRow
          crew={berks}
          side="berks"
          isWinner={berksWon}
          isLoser={status === "complete" && !berksWon && !!berks}
          showStation={showStations}
        />
        <div className="text-center text-[10px] text-[var(--loser)] py-0.5">vs</div>
        <CrewRow
          crew={bucks}
          side="bucks"
          isWinner={bucksWon}
          isLoser={status === "complete" && !bucksWon && !!bucks}
          showStation={showStations}
        />
      </div>
      {status === "complete" && verdict && (
        <div className="px-2 py-1 text-xs text-center border-t border-[var(--card-border)] text-[var(--loser)]">
          {verdict}
        </div>
      )}
    </div>
  );
}
