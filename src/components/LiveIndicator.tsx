"use client";

interface LiveIndicatorProps {
  lastUpdated: string | null;
  resultCount: number;
  isValidating: boolean;
  onRefresh: () => void;
}

export default function LiveIndicator({
  lastUpdated,
  resultCount,
  isValidating,
  onRefresh,
}: LiveIndicatorProps) {
  const formatted = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isValidating ? "bg-yellow-400 animate-pulse" : "bg-green-500"
          }`}
        />
        <span className="text-[var(--loser)]">
          {isValidating ? "Updating…" : "Live"}
        </span>
      </div>
      <span className="text-[var(--loser)]">
        Updated {formatted} · {resultCount} races
      </span>
      <button
        onClick={onRefresh}
        disabled={isValidating}
        className="px-3 py-1 rounded border border-[var(--card-border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
      >
        Refresh
      </button>
    </div>
  );
}
