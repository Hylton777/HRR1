import type { BracketMatch } from "./types";

export interface RegattaDay {
  id: string;
  label: string;
  shortLabel: string;
  /** ISO date YYYY-MM-DD in Europe/London */
  isoDate: string;
  /** Primary round index for this racing day */
  primaryRoundIndex: number;
}

export type BracketViewPreset =
  | "full"
  | "today"
  | "two-day"
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

export function getRegattaDayByIso(
  iso: string,
  raceDays: RegattaDay[],
): RegattaDay | undefined {
  return raceDays.find((d) => d.isoDate === iso);
}

export function getRegattaDayById(
  id: string,
  raceDays: RegattaDay[],
): RegattaDay | undefined {
  return raceDays.find((d) => d.id === id);
}

/** Index of the current racing day (on rest days, returns the previous race day). */
export function getCurrentRaceDayIndex(raceDays: RegattaDay[]): number {
  const iso = getLondonTodayIso();
  const exact = raceDays.findIndex((d) => d.isoDate === iso);
  if (exact >= 0) return exact;

  const nextIdx = raceDays.findIndex((d) => d.isoDate > iso);
  if (nextIdx > 0) return nextIdx - 1;
  if (nextIdx === 0) return 0;
  return raceDays.length - 1;
}

export function resolveRegattaDayIso(
  raceDay: string | null,
  raceDays: RegattaDay[],
): string | null {
  return parseRaceDayIso(raceDay, raceDays);
}

/** Regatta day a bracket round is scheduled on (from the event schedule). */
export function getScheduledRegattaDayForRound(
  roundIndex: number,
  raceDays: RegattaDay[],
): RegattaDay | undefined {
  return raceDays.find((d) => d.primaryRoundIndex === roundIndex);
}

export function isRoundOnRegattaDay(
  roundIndex: number,
  dayIso: string,
  raceDays: RegattaDay[],
): boolean {
  return getScheduledRegattaDayForRound(roundIndex, raceDays)?.isoDate === dayIso;
}

function parseRaceDayIso(
  raceDay: string | null,
  raceDays: RegattaDay[],
): string | null {
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

  for (const day of raceDays) {
    if (raceDay.toLowerCase().includes(day.label.split(" ")[0].toLowerCase())) {
      return day.isoDate;
    }
  }

  return null;
}

export function getMatchRegattaDay(
  match: BracketMatch,
  raceDays: RegattaDay[],
): RegattaDay | null {
  const fromRaceDay = parseRaceDayIso(match.raceDay, raceDays);
  if (fromRaceDay) {
    return getRegattaDayByIso(fromRaceDay, raceDays) ?? null;
  }

  return (
    raceDays.find((d) => d.primaryRoundIndex === match.roundIndex) ?? null
  );
}

export function matchOnRegattaDay(
  match: BracketMatch,
  day: RegattaDay,
  raceDays: RegattaDay[],
): boolean {
  const matchDay = getMatchRegattaDay(match, raceDays);
  if (matchDay) return matchDay.isoDate === day.isoDate;

  return match.roundIndex === day.primaryRoundIndex;
}

function raceDayIndex(day: RegattaDay, raceDays: RegattaDay[]): number {
  return raceDays.findIndex((d) => d.isoDate === day.isoDate);
}

function isRegattaComplete(matches: BracketMatch[]): boolean {
  if (matches.length === 0) return false;
  const maxRound = Math.max(...matches.map((m) => m.roundIndex));
  const finalRound = matches.filter((m) => m.roundIndex === maxRound);
  return (
    finalRound.length > 0 &&
    finalRound.every((m) => m.status === "complete")
  );
}

function completedRaceDayIndices(
  matches: BracketMatch[],
  raceDays: RegattaDay[],
): number[] {
  const indices = new Set<number>();

  for (const match of matches) {
    if (match.status !== "complete") continue;
    const day = getMatchRegattaDay(match, raceDays);
    if (!day) continue;
    const idx = raceDayIndex(day, raceDays);
    if (idx >= 0) indices.add(idx);
  }

  return [...indices].sort((a, b) => a - b);
}

/**
 * Two-day mobile view: the most recent day with completed racing plus the
 * next scheduled day. Before any results, show the first two days; after
 * the final, show the last two days.
 */
export function getTwoDayWindow(
  raceDays: RegattaDay[],
  matches: BracketMatch[],
): RegattaDay[] {
  if (raceDays.length === 0) return [];
  if (raceDays.length === 1) return [raceDays[0]];

  if (isRegattaComplete(matches)) {
    return raceDays.slice(-2);
  }

  const completed = completedRaceDayIndices(matches, raceDays);
  if (completed.length === 0) {
    return raceDays.slice(0, 2);
  }

  const mostRecentIdx = completed[completed.length - 1];
  const nextIdx = mostRecentIdx + 1;
  if (nextIdx >= raceDays.length) {
    return raceDays.slice(-2);
  }

  return [raceDays[mostRecentIdx], raceDays[nextIdx]];
}

export function resolveViewPreset(
  preset: BracketViewPreset,
  raceDays: RegattaDay[],
  matches: BracketMatch[] = [],
): { days: RegattaDay[]; roundIndices: number[] } {
  if (preset === "full") {
    return { days: [], roundIndices: [] };
  }

  const currentIdx = getCurrentRaceDayIndex(raceDays);

  if (preset === "today") {
    const day = raceDays[currentIdx];
    return { days: day ? [day] : [], roundIndices: day ? [day.primaryRoundIndex] : [] };
  }

  if (preset === "two-day") {
    const days = getTwoDayWindow(raceDays, matches);
    return {
      days,
      roundIndices: days.map((d) => d.primaryRoundIndex),
    };
  }

  if (preset.startsWith("day:")) {
    const day = getRegattaDayById(preset.slice(4), raceDays);
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
  raceDays: RegattaDay[],
  matches: BracketMatch[] = [],
): boolean {
  if (preset === "full") return true;

  const { days, roundIndices } = resolveViewPreset(preset, raceDays, matches);

  if (roundIndices.length > 0) {
    return roundIndices.includes(match.roundIndex);
  }

  if (days.length === 0) return true;

  return days.some((day) => matchOnRegattaDay(match, day, raceDays));
}

export function groupMatchesByDay(
  matches: BracketMatch[],
  raceDays: RegattaDay[],
): { day: RegattaDay; matches: BracketMatch[] }[] {
  const groups = new Map<string, BracketMatch[]>();

  for (const match of matches) {
    const day = getMatchRegattaDay(match, raceDays);
    if (!day) continue;
    const list = groups.get(day.isoDate) ?? [];
    list.push(match);
    groups.set(day.isoDate, list);
  }

  return raceDays.filter((d) => groups.has(d.isoDate)).map((day) => ({
    day,
    matches: groups.get(day.isoDate) ?? [],
  }));
}

/** Short round labels for mobile round filter buttons */
export function getRoundPresetLabels(
  roundLabels: string[],
): { label: string; preset: BracketViewPreset }[] {
  const abbrev: Record<string, string> = {
    "1st Round": "R1",
    "2nd Round": "R2",
    "Quarter-Final": "QF",
    "Semi-Final": "SF",
    Final: "F",
  };

  return roundLabels.map((roundLabel, index) => ({
    label: abbrev[roundLabel] ?? `R${index + 1}`,
    preset: `round:${index}` as BracketViewPreset,
  }));
}
