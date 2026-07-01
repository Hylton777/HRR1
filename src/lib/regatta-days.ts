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

export function resolveViewPreset(
  preset: BracketViewPreset,
  raceDays: RegattaDay[],
): { days: RegattaDay[]; roundIndices: number[] } {
  if (preset === "full") {
    return { days: [], roundIndices: [] };
  }

  const currentIdx = getCurrentRaceDayIndex(raceDays);

  if (preset === "today") {
    const day = raceDays[currentIdx];
    return { days: day ? [day] : [], roundIndices: day ? [day.primaryRoundIndex] : [] };
  }

  if (preset === "today-tomorrow") {
    const days = raceDays.slice(currentIdx, currentIdx + 2);
    const roundIndices = days.map((d) => d.primaryRoundIndex);
    return { days, roundIndices };
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
): boolean {
  if (preset === "full") return true;

  const { days, roundIndices } = resolveViewPreset(preset, raceDays);

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

/** Label for the today+tomorrow preset button, e.g. "Wed + Fri" */
export function getTodayTomorrowLabel(raceDays: RegattaDay[]): string {
  const idx = getCurrentRaceDayIndex(raceDays);
  const days = raceDays.slice(idx, idx + 2);
  if (days.length === 0) return "Today + tomorrow";
  if (days.length === 1) return days[0].shortLabel;
  return `${days[0].shortLabel} + ${days[1].shortLabel}`;
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
