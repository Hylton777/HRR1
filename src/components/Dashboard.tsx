"use client";

import useSWR from "swr";
import Bracket from "@/components/Bracket";
import ClientErrorBoundary from "@/components/ClientErrorBoundary";
import DisplayConsistencyBanner from "@/components/DisplayConsistencyBanner";
import { EventProvider } from "@/components/EventContext";
import LiveIndicator from "@/components/LiveIndicator";
import NextRacesPanel from "@/components/NextRacesPanel";
import RecentResultsPanel from "@/components/RecentResultsPanel";
import ResultAuditBanner from "@/components/ResultAuditBanner";
import { EVENTS, type EventId } from "@/config/events";
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

interface DashboardProps {
  eventId: EventId;
}

export default function Dashboard({ eventId }: DashboardProps) {
  const event = EVENTS[eventId];

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<BracketApiResponse>(`/api/bracket/${eventId}`, fetcher, {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-[var(--muted)] animate-pulse">
          Loading {event.shortLabel} bracket from Henley Royal Regatta…
        </div>
      </div>
    );
  }

  if (error || !data?.bracket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-[var(--accent)]">
          Failed to load {event.shortLabel} bracket data.
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

  const nextRaces = (data.upcomingRaces ?? []).slice(0, 6);

  return (
    <EventProvider event={event}>
      <ClientErrorBoundary>
        <div className="space-y-6 sm:space-y-8 md:space-y-0">
          <div className="md:fixed md:top-[4.25rem] md:right-4 md:z-50 md:max-w-md">
            <LiveIndicator
              lastUpdated={data.lastUpdated}
              resultCount={data.resultCount ?? 0}
              isValidating={isValidating}
              onRefresh={() => mutate()}
            />
          </div>

          <div className="space-y-6 sm:space-y-8 md:space-y-0">
            <section className="min-w-0 md:-mx-4 lg:-mx-6">
              <h2 className="font-display text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-[var(--hrr-navy)] md:sr-only">
                Knockout Bracket
              </h2>
              <div className="md:hidden mb-4">
                <NextRacesPanel
                  races={nextRaces}
                  timetableDay={data.timetableDay}
                  compact
                />
              </div>
              <Bracket bracket={data.bracket} />
              <div className="md:hidden mt-6">
                <RecentResultsPanel
                  results={data.results ?? []}
                  rounds={data.bracket.rounds}
                />
              </div>
            </section>

            <section className="hidden md:grid md:grid-cols-2 gap-6 lg:gap-8 min-w-0">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold mb-3 text-[var(--hrr-navy)]">
                  Next Races
                </h2>
                <NextRacesPanel
                  races={nextRaces}
                  timetableDay={data.timetableDay}
                />
              </div>
              <div className="min-w-0">
                <RecentResultsPanel
                  results={data.results ?? []}
                  rounds={data.bracket.rounds}
                />
              </div>
            </section>
          </div>

          <ResultAuditBanner audit={data.resultAudit} />
          <DisplayConsistencyBanner audit={data.displayAudit} />

          <p className="text-xs text-[var(--muted)] text-center pt-4 border-t border-[var(--card-border)]">
            Auto-refreshes every 30 seconds. Produced by Hylton.
          </p>
        </div>
      </ClientErrorBoundary>
    </EventProvider>
  );
}
