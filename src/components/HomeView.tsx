"use client";

import { useState } from "react";
import { EVENT_LIST, EVENTS, type EventId } from "@/config/events";
import Dashboard from "@/components/Dashboard";
import EventTabs from "@/components/EventTabs";

export default function HomeView() {
  const [eventId, setEventId] = useState<EventId>("pe");
  const event = EVENTS[eventId];

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
              onChange={(id) => setEventId(id as EventId)}
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
