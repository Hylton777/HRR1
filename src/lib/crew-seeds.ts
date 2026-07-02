import { crewsMatch } from "./crew-match";
import type { EventConfig } from "@/config/events";
import type { Crew, DrawData } from "./types";

const registryByDraw = new WeakMap<DrawData, Map<string, Crew>>();

function buildRegistryFromDraw(
  draw: DrawData,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
): Map<string, Crew> {
  const registry = new Map<string, Crew>();

  const register = (crew: Crew | null) => {
    if (!crew?.name) return;
    const enriched = withSeededFlag(crew, event);
    registry.set(enriched.name.toLowerCase(), enriched);
    if (enriched.shortName) {
      registry.set(enriched.shortName.toLowerCase(), enriched);
    }
  };

  for (const round of draw.rounds) {
    for (const match of round) {
      register(match.berks);
      register(match.bucks);
    }
  }

  return registry;
}

function getEventCrewRegistry(
  event: Pick<EventConfig, "draw" | "seededCrewNumbers" | "seededCrewNames">,
): Map<string, Crew> {
  let registry = registryByDraw.get(event.draw);
  if (!registry) {
    registry = buildRegistryFromDraw(event.draw, event);
    registryByDraw.set(event.draw, registry);
  }
  return registry;
}

export function enrichCrewFromEvent(
  crew: Crew | null | undefined,
  event: Pick<EventConfig, "draw" | "seededCrewNumbers" | "seededCrewNames">,
): Crew | null {
  if (!crew) return null;
  return enrichCrew(crew, event, getEventCrewRegistry(event));
}

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
    if (crew.number != null) {
      for (const [, entry] of registry) {
        if (entry.number != null && entry.number === crew.number) {
          merged = {
            ...entry,
            ...crew,
            shortName: crew.shortName ?? entry.shortName,
            number: crew.number,
          };
          break;
        }
      }
    }

    if (merged === crew) {
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
