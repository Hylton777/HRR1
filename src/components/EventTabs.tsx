"use client";

import type { EventConfig } from "@/config/events";

interface EventTabsProps {
  events: EventConfig[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function EventTabs({
  events,
  activeId,
  onChange,
}: EventTabsProps) {
  return (
    <div
      className="flex gap-1 p-1 bg-white/10 rounded-sm w-fit max-w-full overflow-x-auto"
      role="tablist"
      aria-label="Henley events"
    >
      {events.map((event) => {
        const active = event.id === activeId;
        return (
          <button
            key={event.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(event.id)}
            className={`px-3 sm:px-4 py-1.5 rounded-sm text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-white text-[var(--hrr-navy)] shadow-sm"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            {event.shortLabel}
            <span className="hidden sm:inline text-current/70 font-normal">
              {" "}
              ·{" "}
              {event.displayName
                .replace(" Challenge Cup", "")
                .replace(" Challenge Plate", "")
                .replace(" Challenge Trophy", "")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
