import type { BracketMatch } from "./types";

export interface RegattaDay {
  id: string;
  label: string;
  shortLabel: string;
  /** ISO date YYYY-MM-DD in Europe/London */
  isoDate: string;
  /** Typical PE round index (0–4) when raceDay is not yet published */
  primaryRoundIndex: number;
}

/** PE racing days at HRR 2026 (Tue–Sun, regatta 30 Jun – 5 Jul) */
export const PE_REGATTA_DAYS: RegattaDay[] = [
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
    id: "thu",
    label: "Thursday 2 July",
    shortLabel: "Thu",
    isoDate: "2026-07-02",
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
  return PE_REGATTA_DAYS.find((d) => d.isoDate === iso);
}

export function getRegattaDayById(id: string): RegattaDay | undefined {
  return PE_REGATTA_DAYS.find((d) => d.id === id);
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

  for (const day of PE_REGATTA_DAYS) {
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
    PE_REGATTA_DAYS.find((d) => d.primaryRoundIndex === match.roundIndex) ??
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
): { days: RegattaDay[]; roundIndex: number | null } {
  if (preset === "full") {
    return { days: [], roundIndex: null };
  }

  if (preset === "today") {
    const today = getRegattaDayByIso(getLondonTodayIso());
    return { days: today ? [today] : [], roundIndex: null };
  }

  if (preset === "today-tomorrow") {
    const todayIso = getLondonTodayIso();
    const todayIdx = PE_REGATTA_DAYS.findIndex((d) => d.isoDate === todayIso);
    if (todayIdx === -1) return { days: [], roundIndex: null };
    return {
      days: PE_REGATTA_DAYS.slice(todayIdx, todayIdx + 2),
      roundIndex: null,
    };
  }

  if (preset.startsWith("day:")) {
    const day = getRegattaDayById(preset.slice(4));
    return { days: day ? [day] : [], roundIndex: null };
  }

  if (preset.startsWith("round:")) {
    const roundIndex = parseInt(preset.slice(6), 10);
    return {
      days: [],
      roundIndex: Number.isNaN(roundIndex) ? null : roundIndex,
    };
  }

  return { days: [], roundIndex: null };
}

export function isMatchInView(
  match: BracketMatch,
  preset: BracketViewPreset,
): boolean {
  const { days, roundIndex } = resolveViewPreset(preset);

  if (preset === "full") return true;

  if (roundIndex !== null) {
    return match.roundIndex === roundIndex;
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

  return PE_REGATTA_DAYS.filter((d) => groups.has(d.isoDate)).map((day) => ({
    day,
    matches: groups.get(day.isoDate) ?? [],
  }));
}
