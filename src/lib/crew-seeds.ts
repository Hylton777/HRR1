import { crewsMatch } from "./crew-match";
import type { Crew } from "./types";

/**
 * Crew numbers shown in italic on the official HRR 2026 draw chart
 * (Henley marks selected/seeded crews on the initial draw sheet).
 */
export const PE_2026_SEEDED_CREW_NUMBERS = new Set([
  256, // Bedford School
  263, // Deerfield Academy, U.S.A.
  270, // Hampton School
  273, // King's College School, Wimbledon
  281, // Radley College
  282, // Reading Blue Coat School
  283, // Shiplake College
  284, // Shrewsbury School
  286, // St. Edward's School
  288, // St. Paul's School
  290, // Sydney University Boat Club, Australia
  300, // Westminster School
]);

const PE_2026_SEEDED_NAMES = [
  "Bedford School",
  "Deerfield Academy, U.S.A.",
  "Hampton School",
  "King's College School, Wimbledon",
  "Radley College",
  "Reading Blue Coat School",
  "Shiplake College",
  "Shrewsbury School",
  "St. Edward's School",
  "St. Paul's School",
  "Sydney University Boat Club, Australia",
  "Westminster School",
] as const;

export function isSeededCrew(
  crew: { name: string; shortName?: string; number?: number; seeded?: boolean } | null,
): boolean {
  if (!crew) return false;
  if (crew.seeded) return true;
  if (crew.number != null && PE_2026_SEEDED_CREW_NUMBERS.has(crew.number)) {
    return true;
  }
  return PE_2026_SEEDED_NAMES.some((name) => crewsMatch(crew.name, name));
}

export function withSeededFlag(crew: Crew): Crew {
  if (!crew?.name) return crew;
  return isSeededCrew(crew) ? { ...crew, seeded: true } : { ...crew, seeded: false };
}

export function enrichCrew(
  crew: Crew | null | undefined,
  registry?: Map<string, Crew>,
): Crew | null {
  if (!crew) return null;

  let merged = crew;
  if (registry) {
    for (const [, entry] of registry) {
      if (crewsMatch(entry.name, crew.name)) {
        merged = {
          ...entry,
          ...crew,
          shortName: crew.shortName ?? entry.shortName,
          number: crew.number ?? entry.number,
        };
        break;
      }
    }
  }

  return withSeededFlag(merged);
}

export function crewNameClass(
  crew: { name: string; shortName?: string; number?: number; seeded?: boolean } | null,
  extra = "",
): string {
  return `${isSeededCrew(crew) ? "font-bold" : "font-normal"} ${extra}`.trim();
}
