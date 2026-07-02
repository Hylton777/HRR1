import type { EventConfig } from "@/config/events";

export const EVENT_TIER_ORDER = [
  "premier",
  "intermediate",
  "club",
  "student",
  "junior",
] as const;

export type EventTier = (typeof EVENT_TIER_ORDER)[number];

const TIER_LABELS: Record<EventTier, string> = {
  premier: "Premier",
  intermediate: "Intermediate",
  club: "Club",
  student: "Student",
  junior: "Junior",
};

/** Boat-class order within each tier (Henley programme order). */
const BOAT_CLASS_ORDER: Record<string, number> = {
  "mens-eights": 0,
  "womens-eights": 1,
  "mens-quads": 2,
  "womens-quads": 3,
  "mens-coxless-fours": 4,
  "womens-coxless-fours": 5,
  "coxless-fours": 6,
  "coxed-fours": 7,
  "mens-coxed-fours": 8,
  "mens-doubles": 9,
  "womens-doubles": 10,
  "mens-coxless-pairs": 11,
  "womens-coxless-pairs": 12,
  "mens-sculls": 13,
  "womens-sculls": 14,
};

const BOAT_CLASS_LABELS: Record<string, string> = {
  "mens-eights": "Men's Eight",
  "womens-eights": "Women's Eight",
  "mens-quads": "Men's Quadruple Scull",
  "womens-quads": "Women's Quadruple Scull",
  "mens-coxless-fours": "Men's Coxless Four",
  "womens-coxless-fours": "Women's Coxless Four",
  "coxless-fours": "Men's Coxless Four",
  "coxed-fours": "Coxed Four",
  "mens-coxed-fours": "Men's Coxed Four",
  "mens-doubles": "Men's Double Scull",
  "womens-doubles": "Women's Double Scull",
  "mens-coxless-pairs": "Men's Coxless Pair",
  "womens-coxless-pairs": "Women's Coxless Pair",
  "mens-sculls": "Men's Single Scull",
  "womens-sculls": "Women's Single Scull",
};

export function getEventTier(category: string): EventTier | "other" {
  for (const tier of EVENT_TIER_ORDER) {
    if (category.startsWith(`${tier}-`)) {
      return tier;
    }
  }
  return "other";
}

export function getEventBoatClassRank(category: string): number {
  const tier = getEventTier(category);
  const suffix =
    tier === "other" ? category : category.slice(tier.length + 1);
  return BOAT_CLASS_ORDER[suffix] ?? 99;
}

export function getEventBoatClassLabel(category: string): string {
  const tier = getEventTier(category);
  const suffix =
    tier === "other" ? category : category.slice(tier.length + 1);
  return BOAT_CLASS_LABELS[suffix] ?? suffix.replace(/-/g, " ");
}

export function compareEventsForSelector(a: EventConfig, b: EventConfig): number {
  const tierA = getEventTier(a.category);
  const tierB = getEventTier(b.category);
  const tierIndexA = EVENT_TIER_ORDER.indexOf(tierA as EventTier);
  const tierIndexB = EVENT_TIER_ORDER.indexOf(tierB as EventTier);
  const safeTierA = tierIndexA === -1 ? EVENT_TIER_ORDER.length : tierIndexA;
  const safeTierB = tierIndexB === -1 ? EVENT_TIER_ORDER.length : tierIndexB;

  if (safeTierA !== safeTierB) return safeTierA - safeTierB;

  const boatDiff =
    getEventBoatClassRank(a.category) - getEventBoatClassRank(b.category);
  if (boatDiff !== 0) return boatDiff;

  return a.shortLabel.localeCompare(b.shortLabel);
}

export interface EventSelectorGroup {
  tier: EventTier | "other";
  label: string;
  events: EventConfig[];
}

export function groupEventsForSelector(events: EventConfig[]): EventSelectorGroup[] {
  const sorted = [...events].sort(compareEventsForSelector);
  const groups: EventSelectorGroup[] = [];

  for (const event of sorted) {
    const tier = getEventTier(event.category);
    const label =
      tier === "other" ? "Other" : TIER_LABELS[tier as EventTier];
    const last = groups[groups.length - 1];
    if (last?.tier === tier) {
      last.events.push(event);
    } else {
      groups.push({ tier, label, events: [event] });
    }
  }

  return groups;
}
