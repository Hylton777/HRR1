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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm border border-[var(--card-border)] bg-[var(--card)] rounded-sm px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isValidating ? "bg-[var(--hrr-gold)] animate-pulse" : "bg-[var(--winner)]"
          }`}
        />
        <span className="text-[var(--muted)] font-medium">
          {isValidating ? "Updating…" : "Live"}
        </span>
      </div>
      <span className="text-[var(--muted)]">
        Updated {formatted} · {resultCount} races
      </span>
      <button
        onClick={onRefresh}
        disabled={isValidating}
        className="px-3 py-1 rounded-sm border border-[var(--card-border)] text-[var(--hrr-blue)] hover:border-[var(--hrr-blue)] hover:bg-[var(--hrr-blue)]/5 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        Refresh
      </button>
    </div>
  );
}
