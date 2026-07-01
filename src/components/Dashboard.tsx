"use client";

import useSWR from "swr";
import Bracket from "@/components/Bracket";
import ClientErrorBoundary from "@/components/ClientErrorBoundary";
import LiveIndicator from "@/components/LiveIndicator";
import { formatUpcomingRaceMeta } from "@/lib/schedule-label";
import type { BracketApiResponse } from "@/lib/types";

async function fetcher(url: string): Promise<BracketApiResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load bracket (${response.status})`);
  }
  const data = (await response.json()) as BracketApiResponse;
  if (!data?.bracket?.rounds) {
    throw new Error("Invalid bracket response");
  }
  return data;
}

function displayName(
  crew: { name: string; shortName?: string } | null,
): string {
  if (!crew) return "TBD";
  return crew.shortName || crew.name;
}

export default function Dashboard() {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<BracketApiResponse>("/api/bracket", fetcher, {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-[var(--muted)] animate-pulse">
          Loading bracket from Henley Royal Regatta…
        </div>
      </div>
    );
  }

  if (error || !data?.bracket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-[var(--accent)]">
          Failed to load bracket data.
        </p>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 rounded bg-[var(--hrr-blue)] text-white text-sm font-medium hover:bg-[var(--hrr-navy)] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const recentResults = (data.results ?? []).slice(0, 5);
  const nextRaces = (data.upcomingRaces ?? []).slice(0, 6);

  return (
    <ClientErrorBoundary>
      <div className="space-y-6 sm:space-y-8">
        <LiveIndicator
          lastUpdated={data.lastUpdated}
          resultCount={data.resultCount ?? 0}
          isValidating={isValidating}
          onRefresh={() => mutate()}
        />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 sm:gap-8">
          <section className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-[var(--hrr-navy)]">
              Knockout Bracket
            </h2>
            <Bracket bracket={data.bracket} />
          </section>

          <aside className="xl:sticky xl:top-4 xl:self-start space-y-6 sm:space-y-8 min-w-0">
            <div>
              <h2 className="font-display text-lg font-semibold mb-1 text-[var(--hrr-navy)]">
                Next Races
              </h2>
              <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
                Timings from the{" "}
                <a
                  href="https://www.hrr.co.uk/compete/race-timetable/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[var(--hrr-blue)]"
                >
                  official HRR draw
                </a>
                {data.timetableDay ? ` (${data.timetableDay})` : ""}. Published
                around 9pm BST the evening before racing — until then races show
                as Upcoming.
              </p>
              <div className="space-y-3">
                {nextRaces.length === 0 ? (
                  <p className="text-[var(--muted)] text-sm">
                    No upcoming PE races in the draw yet.
                  </p>
                ) : (
                  nextRaces.map((race) => (
                    <div
                      key={race.id}
                      className="bg-[var(--card)] border border-[var(--card-border)] rounded-sm p-3 text-sm shadow-sm"
                    >
                      <div className="text-xs text-[var(--muted)] mb-1 flex justify-between gap-2">
                        <span>{race.roundLabel}</span>
                        <span
                          className={
                            race.raceTime
                              ? "text-[var(--hrr-blue)] font-medium"
                              : "text-[var(--bucks)]"
                          }
                        >
                          {formatUpcomingRaceMeta(
                            race.raceTime,
                            race.raceNumber,
                            race.raceDay,
                          )}
                        </span>
                      </div>
                      <div className="font-medium leading-snug">
                        <span className="text-[var(--berks)]">
                          {displayName(race.berks)}
                        </span>{" "}
                        <span className="text-[var(--muted)] font-normal">vs</span>{" "}
                        <span className="text-[var(--bucks)]">
                          {displayName(race.bucks)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-semibold mb-4 text-[var(--hrr-navy)]">
                Recent Results
              </h2>
              <div className="space-y-3">
                {recentResults.length === 0 ? (
                  <p className="text-[var(--muted)] text-sm">
                    No races completed yet.
                  </p>
                ) : (
                  recentResults.map((result) => (
                    <div
                      key={result.id}
                      className="bg-[var(--card)] border border-[var(--card-border)] rounded-sm p-3 text-sm shadow-sm"
                    >
                      <div className="text-xs text-[var(--muted)] mb-1">
                        Race {result.number} · {result.raceDay} {result.raceTime}
                      </div>
                      <div className="font-medium text-[var(--winner)]">
                        {result.winner?.shortName || result.winner?.name || "—"}
                      </div>
                      <div className="text-[var(--muted)] text-xs">
                        beat{" "}
                        {result.loser?.shortName || result.loser?.name || "—"}
                      </div>
                      {result.verdict && result.finish?.split && (
                        <div className="text-xs text-[var(--muted)] mt-1">
                          {result.verdict} · {result.finish.split}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed mt-4">
                Data sourced from{" "}
                <a
                  href="https://www.hrr.co.uk/results/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[var(--hrr-blue)]"
                >
                  Henley Royal Regatta live results
                </a>
                . Auto-refreshes every 30 seconds.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </ClientErrorBoundary>
  );
}
