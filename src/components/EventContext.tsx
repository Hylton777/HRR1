"use client";

import { createContext, useContext } from "react";
import type { EventConfig } from "@/config/events";

const EventContext = createContext<EventConfig | null>(null);

export function EventProvider({
  event,
  children,
}: {
  event: EventConfig;
  children: React.ReactNode;
}) {
  return (
    <EventContext.Provider value={event}>{children}</EventContext.Provider>
  );
}

export function useEvent(): EventConfig {
  const event = useContext(EventContext);
  if (!event) {
    throw new Error("useEvent must be used within EventProvider");
  }
  return event;
}
