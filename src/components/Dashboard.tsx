"use client";

import useSWR from "swr";
import Bracket from "@/components/Bracket";
import LiveIndicator from "@/components/LiveIndicator";
import type { BracketApiResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Dashboard() {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<BracketApiResponse>("/api/bracket", fetcher, {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-[var(--loser)] animate-pulse">
          Loading bracket from Henley Royal Regatta…
        </div>
      </div>
    );
  }

  if (error || !data?.bracket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-red-400">Failed to load bracket data.</p>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 rounded bg-[var(--accent)] text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const recentResults = data.results.slice(0, 5);

  return (
    <div className="space-y-8">
      <LiveIndicator
        lastUpdated={data.lastUpdated}
        resultCount={data.resultCount}
        isValidating={isValidating}
        onRefresh={() => mutate()}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Knockout Bracket</h2>
          <Bracket bracket={data.bracket} />
        </section>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <h2 className="text-lg font-semibold mb-4">Recent Results</h2>
          <div className="space-y-3">
            {recentResults.length === 0 ? (
              <p className="text-[var(--loser)] text-sm">No races completed yet.</p>
            ) : (
              recentResults.map((result) => (
                <div
                  key={result.id}
                  className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-3 text-sm"
                >
                  <div className="text-xs text-[var(--loser)] mb-1">
                    Race {result.number} · {result.raceDay} {result.raceTime}
                  </div>
                  <div className="font-medium text-[var(--winner)]">
                    {result.winner.shortName || result.winner.name}
                  </div>
                  <div className="text-[var(--loser)] text-xs">
                    beat {result.loser.shortName || result.loser.name}
                  </div>
                  <div className="text-xs text-[var(--loser)] mt-1">
                    {result.verdict} · {result.finish.split}
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-[var(--loser)] mt-6 leading-relaxed">
            Data sourced from{" "}
            <a
              href="https://www.hrr.co.uk/results/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--accent)]"
            >
              Henley Royal Regatta live results
            </a>
            . Auto-refreshes every 30 seconds.
          </p>
        </aside>
      </div>
    </div>
  );
}
