import {
  crewResultMatchesDraw,
  crewsMatch,
  decodeHtmlEntities,
} from "./crew-match";
import type { EventConfig } from "@/config/events";
import type { BracketMatch, Crew, DrawData, HrrResult } from "./types";

export interface CrewRegistry {
  byKey: Map<string, Crew>;
  byNumber: Map<number, Crew>;
  entries: Crew[];
}

const registryByDraw = new WeakMap<DrawData, CrewRegistry>();

function buildRegistryFromDraw(
  draw: DrawData,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
): CrewRegistry {
  const byKey = new Map<string, Crew>();
  const byNumber = new Map<number, Crew>();
  const entries: Crew[] = [];

  const register = (crew: Crew | null) => {
    if (!crew?.name) return;
    const enriched = withSeededFlag(crew, event);
    byKey.set(enriched.name.toLowerCase(), enriched);
    if (enriched.shortName) {
      byKey.set(enriched.shortName.toLowerCase(), enriched);
    }
    if (enriched.number != null && !byNumber.has(enriched.number)) {
      byNumber.set(enriched.number, enriched);
      entries.push(enriched);
    } else if (enriched.number == null) {
      entries.push(enriched);
    }
  };

  for (const round of draw.rounds) {
    for (const match of round) {
      register(match.berks);
      register(match.bucks);
    }
  }

  return { byKey, byNumber, entries };
}

function getEventCrewRegistry(
  event: Pick<EventConfig, "draw" | "seededCrewNumbers" | "seededCrewNames">,
): CrewRegistry {
  let registry = registryByDraw.get(event.draw);
  if (!registry) {
    registry = buildRegistryFromDraw(event.draw, event);
    registryByDraw.set(event.draw, registry);
  }
  return registry;
}

export function getRegistryFromDraw(
  draw: DrawData,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
): CrewRegistry {
  let registry = registryByDraw.get(draw);
  if (!registry) {
    registry = buildRegistryFromDraw(draw, event);
    registryByDraw.set(draw, registry);
  }
  return registry;
}

export function enrichCrewFromEvent(
  crew: Crew | null | undefined,
  event: Pick<EventConfig, "draw" | "seededCrewNumbers" | "seededCrewNames">,
): Crew | null {
  if (!crew) return null;
  const registry = getEventCrewRegistry(event);
  return enrichCrew(crew, event, registry);
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

/** Keep draw identity (number, shortName) when merging an HRR result onto a slot. */
export function mergeDrawWithResult(
  drawCrew: Crew,
  resultCrew: Crew,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
): Crew {
  const decodedName = decodeHtmlEntities(resultCrew.name);
  const decodedShort =
    resultCrew.shortName != null
      ? decodeHtmlEntities(resultCrew.shortName)
      : undefined;

  return withSeededFlag(
    {
      ...drawCrew,
      name: decodedName,
      shortName: drawCrew.shortName ?? decodedShort ?? decodedName,
      number: drawCrew.number,
    },
    event,
  );
}

function findBestRegistryEntry(
  crew: Crew,
  registry: CrewRegistry,
  excludeNumbers?: ReadonlySet<number>,
): Crew | null {
  if (crew.number != null) {
    const byNumber = registry.byNumber.get(crew.number);
    if (byNumber && !excludeNumbers?.has(byNumber.number!)) {
      return byNumber;
    }
  }

  let best: Crew | null = null;
  let bestScore = 0;

  for (const entry of registry.entries) {
    if (entry.number != null && excludeNumbers?.has(entry.number)) continue;

    if (!crewResultMatchesDraw(entry, crew)) continue;

    let score = 10;
    if (entry.number != null && crew.number != null && entry.number === crew.number) {
      score = 100;
    } else if (entry.shortName && crew.shortName && crewsMatch(entry.shortName, crew.shortName)) {
      score = 80;
    } else if (crewsMatch(entry.name, crew.name)) {
      score = 60;
    }

    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }

  return best;
}

export function enrichCrew(
  crew: Crew | null | undefined,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
  registry?: CrewRegistry | Map<string, Crew>,
): Crew | null {
  if (!crew) return null;

  const resolvedRegistry: CrewRegistry | null =
    registry instanceof Map
      ? {
          byKey: registry,
          byNumber: new Map(
            [...registry.values()]
              .filter((c) => c.number != null)
              .map((c) => [c.number!, c]),
          ),
          entries: [...new Set(registry.values())],
        }
      : (registry ?? null);

  if (!resolvedRegistry) {
    return withSeededFlag(crew, event);
  }

  const entry = findBestRegistryEntry(crew, resolvedRegistry);
  if (!entry) {
    return withSeededFlag(
      {
        ...crew,
        name: decodeHtmlEntities(crew.name),
        shortName: crew.shortName
          ? decodeHtmlEntities(crew.shortName)
          : decodeHtmlEntities(crew.name),
      },
      event,
    );
  }

  return mergeDrawWithResult(entry, crew, event);
}

/** Map HRR result winner/loser onto the correct draw slots. */
export function resolveResultForMatch(
  match: Pick<BracketMatch, "berks" | "bucks">,
  result: HrrResult,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
): { winner: Crew; loser: Crew } | null {
  const { berks, bucks } = match;
  if (!berks || !bucks) return null;

  const winnerOnBerks = crewResultMatchesDraw(berks, result.winner);
  const winnerOnBucks = crewResultMatchesDraw(bucks, result.winner);
  const loserOnBerks = crewResultMatchesDraw(berks, result.loser);
  const loserOnBucks = crewResultMatchesDraw(bucks, result.loser);

  if (winnerOnBerks && loserOnBucks) {
    return {
      winner: mergeDrawWithResult(berks, result.winner, event),
      loser: mergeDrawWithResult(bucks, result.loser, event),
    };
  }
  if (winnerOnBucks && loserOnBerks) {
    return {
      winner: mergeDrawWithResult(bucks, result.winner, event),
      loser: mergeDrawWithResult(berks, result.loser, event),
    };
  }
  return null;
}

export function crewNameClass(
  crew: { name: string; shortName?: string; number?: number; seeded?: boolean } | null,
  event: Pick<EventConfig, "seededCrewNumbers" | "seededCrewNames">,
  extra = "",
): string {
  return `${isSeededCrew(crew, event) ? "font-bold" : "font-normal"} ${extra}`.trim();
}
