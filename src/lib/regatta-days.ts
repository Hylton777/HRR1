import type { BracketMatch } from "./types";

export interface RegattaDay {
  id: string;
  label: string;
  shortLabel: string;
  /** ISO date YYYY-MM-DD in Europe/London */
  isoDate: string;
  /** Primary PE round index (0–4) for this racing day */
  primaryRoundIndex: number;
}

/** PE races only on these days — Thursday is a rest day for PE */
export const PE_RACE_DAYS: RegattaDay[] = [
  {
    id: "tue",
    label: "Tuesday 30 June",
    shortLabel: "Tue",
    isoDate: "2026-06-30",
    primaryRoundIndex: 0,
  },
  {
    id: "wed",
    label: "Wednesday 1 July",
    shortLabel: "Wed",
    isoDate: "2026-07-01",
    primaryRoundIndex: 1,
  },
  {
    id: "fri",
    label: "Friday 3 July",
    shortLabel: "Fri",
    isoDate: "2026-07-03",
    primaryRoundIndex: 2,
  },
  {
    id: "sat",
    label: "Saturday 4 July",
    shortLabel: "Sat",
    isoDate: "2026-07-04",
    primaryRoundIndex: 3,
  },
  {
    id: "sun",
    label: "Sunday 5 July",
    shortLabel: "Sun",
    isoDate: "2026-07-05",
    primaryRoundIndex: 4,
  },
];

export type BracketViewPreset =
  | "full"
  | "today"
  | "today-tomorrow"
  | `day:${string}`
  | `round:${number}`;

export function getLondonTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getRegattaDayByIso(iso: string): RegattaDay | undefined {
  return PE_RACE_DAYS.find((d) => d.isoDate === iso);
}

export function getRegattaDayById(id: string): RegattaDay | undefined {
  return PE_RACE_DAYS.find((d) => d.id === id);
}

/** Index of the current PE racing day (on rest days, returns the previous race day). */
export function getCurrentPeRaceDayIndex(): number {
  const iso = getLondonTodayIso();
  const exact = PE_RACE_DAYS.findIndex((d) => d.isoDate === iso);
  if (exact >= 0) return exact;

  const nextIdx = PE_RACE_DAYS.findIndex((d) => d.isoDate > iso);
  if (nextIdx > 0) return nextIdx - 1;
  if (nextIdx === 0) return 0;
  return PE_RACE_DAYS.length - 1;
}

function parseRaceDayIso(raceDay: string | null): string | null {
  if (!raceDay) return null;

  const isoMatch = raceDay.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  const dmy = raceDay.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );
  if (dmy) {
    const months: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    const month = months[dmy[2].toLowerCase()];
    if (month) {
      return `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
    }
  }

  for (const day of PE_RACE_DAYS) {
    if (raceDay.toLowerCase().includes(day.label.split(" ")[0].toLowerCase())) {
      return day.isoDate;
    }
  }

  return null;
}

export function getMatchRegattaDay(match: BracketMatch): RegattaDay | null {
  const fromRaceDay = parseRaceDayIso(match.raceDay);
  if (fromRaceDay) {
    return getRegattaDayByIso(fromRaceDay) ?? null;
  }

  return (
    PE_RACE_DAYS.find((d) => d.primaryRoundIndex === match.roundIndex) ??
    null
  );
}

export function matchOnRegattaDay(
  match: BracketMatch,
  day: RegattaDay,
): boolean {
  const matchDay = getMatchRegattaDay(match);
  if (matchDay) return matchDay.isoDate === day.isoDate;

  return match.roundIndex === day.primaryRoundIndex;
}

export function resolveViewPreset(
  preset: BracketViewPreset,
): { days: RegattaDay[]; roundIndices: number[] } {
  if (preset === "full") {
    return { days: [], roundIndices: [] };
  }

  const currentIdx = getCurrentPeRaceDayIndex();

  if (preset === "today") {
    const day = PE_RACE_DAYS[currentIdx];
    return { days: day ? [day] : [], roundIndices: day ? [day.primaryRoundIndex] : [] };
  }

  if (preset === "today-tomorrow") {
    const days = PE_RACE_DAYS.slice(currentIdx, currentIdx + 2);
    const roundIndices = days.map((d) => d.primaryRoundIndex);
    return { days, roundIndices };
  }

  if (preset.startsWith("day:")) {
    const day = getRegattaDayById(preset.slice(4));
    return {
      days: day ? [day] : [],
      roundIndices: day ? [day.primaryRoundIndex] : [],
    };
  }

  if (preset.startsWith("round:")) {
    const roundIndex = parseInt(preset.slice(6), 10);
    return {
      days: [],
      roundIndices: Number.isNaN(roundIndex) ? [] : [roundIndex],
    };
  }

  return { days: [], roundIndices: [] };
}

export function isMatchInView(
  match: BracketMatch,
  preset: BracketViewPreset,
): boolean {
  if (preset === "full") return true;

  const { days, roundIndices } = resolveViewPreset(preset);

  if (roundIndices.length > 0) {
    return roundIndices.includes(match.roundIndex);
  }

  if (days.length === 0) return true;

  return days.some((day) => matchOnRegattaDay(match, day));
}

export function groupMatchesByDay(
  matches: BracketMatch[],
): { day: RegattaDay; matches: BracketMatch[] }[] {
  const groups = new Map<string, BracketMatch[]>();

  for (const match of matches) {
    const day = getMatchRegattaDay(match);
    if (!day) continue;
    const list = groups.get(day.isoDate) ?? [];
    list.push(match);
    groups.set(day.isoDate, list);
  }

  return PE_RACE_DAYS.filter((d) => groups.has(d.isoDate)).map((day) => ({
    day,
    matches: groups.get(day.isoDate) ?? [],
  }));
}

/** Label for the today+tomorrow preset button, e.g. "Wed + Fri" */
export function getTodayTomorrowLabel(): string {
  const idx = getCurrentPeRaceDayIndex();
  const days = PE_RACE_DAYS.slice(idx, idx + 2);
  if (days.length === 0) return "Today + tomorrow";
  if (days.length === 1) return days[0].shortLabel;
  return `${days[0].shortLabel} + ${days[1].shortLabel}`;
}
