"use client";

import type { EventConfig } from "@/config/events";
import { groupEventsForSelector } from "@/config/event-selector-groups";

interface EventTabsProps {
  events: EventConfig[];
  activeId: string;
  onChange: (id: string) => void;
}

function subtitleForEvent(event: EventConfig): string {
  if (event.id === "lp") return "Challenge Plate";
  return event.displayName
    .replace(" Challenge Cup", "")
    .replace(" Challenge Plate", "")
    .replace(" Challenge Trophy", "")
    .replace(" Challenge Sculls", "");
}

export default function EventTabs({
  events,
  activeId,
  onChange,
}: EventTabsProps) {
  const groups = groupEventsForSelector(events);

  return (
    <label className="flex flex-col gap-1 min-w-[12rem] sm:min-w-[16rem]">
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
        Event
      </span>
      <select
        value={activeId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-white/20 bg-white/10 text-white text-sm px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
        aria-label="Select Henley event"
      >
        {groups.map((group) => (
          <optgroup
            key={group.tier}
            label={group.label}
            className="text-[var(--hrr-navy)]"
          >
            {group.events.map((event) => (
              <option
                key={event.id}
                value={event.id}
                className="text-[var(--hrr-navy)]"
              >
                {event.shortLabel} · {subtitleForEvent(event)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
