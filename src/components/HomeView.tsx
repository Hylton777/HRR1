"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  EVENT_LIST,
  EVENTS,
  isEventId,
  type EventId,
} from "@/config/events";
import Dashboard from "@/components/Dashboard";
import EventTabs from "@/components/EventTabs";

function eventIdFromParams(params: URLSearchParams): EventId {
  const value = params.get("event");
  if (value && isEventId(value)) return value;
  return "pe";
}

export default function HomeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = useMemo(
    () => eventIdFromParams(searchParams),
    [searchParams],
  );
  const event = EVENTS[eventId];

  const handleEventChange = useCallback(
    (id: string) => {
      if (!isEventId(id)) return;
      const params = new URLSearchParams(searchParams.toString());
      if (id === "pe") {
        params.delete("event");
      } else {
        params.set("event", id);
      }
      const query = params.toString();
      router.replace(query ? `?${query}` : "/", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <>
      <div className="hrr-header-bar text-white">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-white/70">
            Henley Royal Regatta 2026
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-1">
            <div>
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold leading-tight">
                {event.displayName}
              </h1>
              <p className="text-xs sm:text-sm text-white/75 mt-1">
                {event.headerSubtitle}
              </p>
            </div>
            <EventTabs
              events={EVENT_LIST}
              activeId={eventId}
              onChange={handleEventChange}
            />
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Dashboard eventId={eventId} />
      </main>
    </>
  );
}
