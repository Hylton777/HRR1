import { crewsMatch } from "./crew-match";
import type { EventConfig } from "@/config/events";
import type { Crew } from "./types";

export function isSeededCrew(
  crew: { name: string; shortName?: string; number?: number; seeded?: boolean } | null,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
): boolean {
  if (!crew) return false;
  if (crew.seeded) return true;
  if (crew.number != null) {
    return event.seededCrewNumbers.includes(crew.number);
  }
  return event.seededCrewNames.some((name) => crewsMatch(crew.name, name));
}

export function withSeededFlag(
  crew: Crew,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
): Crew {
  if (!crew?.name) return crew;
  return isSeededCrew(crew, event)
    ? { ...crew, seeded: true }
    : { ...crew, seeded: false };
}

export function enrichCrew(
  crew: Crew | null | undefined,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
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

  return withSeededFlag(merged, event);
}

export function crewNameClass(
  crew: { name: string; shortName?: string; number?: number; seeded?: boolean } | null,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
  extra = "",
): string {
  return `${isSeededCrew(crew, event) ? "font-bold" : "font-normal"} ${extra}`.trim();
}
