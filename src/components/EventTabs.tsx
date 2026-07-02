"use client";

import type { EventConfig } from "@/config/events";

interface EventTabsProps {
  events: EventConfig[];
  activeId: string;
  onChange: (id: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  "premier-mens-eights": "Premier — Men's",
  "premier-womens-eights": "Premier — Women's",
  "premier-mens-coxless-fours": "Premier — Men's fours",
  "premier-womens-coxless-fours": "Premier — Women's fours",
  "premier-mens-coxless-pairs": "Premier — Men's pairs",
  "premier-mens-doubles": "Premier — Men's doubles",
  "premier-mens-sculls": "Premier — Men's sculls",
  "premier-mens-quads": "Premier — Men's quads",
  "premier-womens-coxless-pairs": "Premier — Women's pairs",
  "premier-womens-doubles": "Premier — Women's doubles",
  "premier-womens-sculls": "Premier — Women's sculls",
  "premier-womens-quads": "Premier — Women's quads",
  "intermediate-mens-eights": "Intermediate — Men's eights",
  "intermediate-mens-coxless-fours": "Intermediate — Men's fours",
  "intermediate-mens-quads": "Intermediate — Men's quads",
  "intermediate-womens-eights": "Intermediate — Women's eights",
  "intermediate-womens-quads": "Intermediate — Women's quads",
  "club-mens-eights": "Club — Men's eights",
  "club-womens-eights": "Club — Women's eights",
  "club-coxed-fours": "Club — Coxed fours",
  "club-coxless-fours": "Club — Coxless fours",
  "club-womens-quads": "Club — Women's quads",
  "womens-eights": "Women's eights",
  "student-mens-eights": "Student — Men's eights",
  "student-womens-eights": "Student — Women's eights",
  "student-mens-coxed-fours": "Student — Men's fours",
  "student-mens-coxless-fours": "Student — Men's coxless fours",
  "student-womens-quads": "Student — Women's quads",
  "junior-mens-eights": "Junior — Men's eights",
  "junior-womens-eights": "Junior — Women's eights",
  "junior-mens-quads": "Junior — Men's quads",
  "junior-womens-quads": "Junior — Women's quads",
};

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
  const grouped = events.reduce<Record<string, EventConfig[]>>((acc, event) => {
    const key = event.category || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});

  const groupOrder = events.map((e) => e.category).filter((c, i, a) => a.indexOf(c) === i);

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
        {groupOrder.map((category) => (
          <optgroup
            key={category}
            label={CATEGORY_LABELS[category] ?? category}
            className="text-[var(--hrr-navy)]"
          >
            {grouped[category]?.map((event) => (
              <option key={event.id} value={event.id} className="text-[var(--hrr-navy)]">
                {event.shortLabel} · {subtitleForEvent(event)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
