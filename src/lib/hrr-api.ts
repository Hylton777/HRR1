import * as cheerio from "cheerio";
import type { EventConfig } from "@/config/events";
import {
  cachedFetch,
  HRR_FETCH_TIMEOUT_MS,
  RESULTS_TTL_MS,
  TIMETABLE_TTL_MS,
} from "./hrr-cache";
import { crewResultMatchesDraw, crewsMatch } from "./crew-match";
import type {
  Crew,
  HrrResult,
  HrrResultsResponse,
  TimetableData,
  TimetableRace,
} from "./types";

const HRR_API_BASE = "https://www.hrr.co.uk/wp-json/hrr/v1";
const TIMETABLE_URL = "https://www.hrr.co.uk/compete/race-timetable/";

export { crewsMatch, normalizeCrewName } from "./crew-match";

type ParsedTimetableRace = TimetableRace & { trophy: string };

type ParsedTimetable = {
  raceDay: string | null;
  races: ParsedTimetableRace[];
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(HRR_FETCH_TIMEOUT_MS),
  });
}

async function fetchEventResultsUncached(
  event: Pick<EventConfig, "trophySlug" | "year">,
): Promise<{
  results: HrrResult[];
  generated: string | null;
}> {
  const year = String(event.year);
  const accumulated = new Map<number, HrrResult>();
  let resultPage = 1;
  let lastPage = 1;
  let generated: string | null = null;

  while (resultPage <= lastPage) {
    const params = new URLSearchParams({
      trophy: event.trophySlug,
      "race-year": year,
      "result-page": String(resultPage),
    });

    const response = await fetchWithTimeout(
      `${HRR_API_BASE}/results?${params}`,
      {
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`HRR API error: ${response.status}`);
    }

    const data = (await response.json()) as HrrResultsResponse;

    if (data.generated?.date) {
      generated = data.generated.date;
    }

    for (const result of data.results) {
      if (result.raceYear === year) {
        accumulated.set(result.id, result);
      }
    }

    lastPage = data.pagination?.lastPage ?? 1;
    resultPage += 1;
  }

  const results = Array.from(accumulated.values()).sort(
    (a, b) =>
      new Date(a.raceDateTime).getTime() - new Date(b.raceDateTime).getTime(),
  );

  return { results, generated };
}

function parseTimetableRaceDay(html: string): string | null {
  const match = html.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\s+\w+\s+\d{4}/i,
  );
  return match?.[0]?.trim() ?? null;
}

function parseTimetableHtml(html: string): ParsedTimetable {
  const $ = cheerio.load(html);
  const races: ParsedTimetableRace[] = [];

  $("tr.timetable-row-r").each((_, row) => {
    const trophy = $(row).find(".timetable-field-trophy").text().trim();
    const time = $(row).find(".timetable-field-time").text().trim();
    if (!trophy || !time) return;

    races.push({
      trophy,
      raceNumber: $(row).find(".timetable-field-race").text().trim(),
      time,
      berks: $(row).find(".timetable-field-berks").text().trim(),
      bucks: $(row).find(".timetable-field-bucks").text().trim(),
    });
  });

  return {
    raceDay: parseTimetableRaceDay(html),
    races,
  };
}

async function fetchTimetableUncached(): Promise<ParsedTimetable> {
  const response = await fetchWithTimeout(TIMETABLE_URL, {
    headers: { Accept: "text/html" },
  });

  if (!response.ok) {
    throw new Error(`HRR timetable error: ${response.status}`);
  }

  const html = await response.text();
  return parseTimetableHtml(html);
}

function filterTimetableForEvent(
  parsed: ParsedTimetable,
  timetableCodes: string[],
): TimetableData {
  const codes = new Set(timetableCodes);
  return {
    raceDay: parsed.raceDay,
    races: parsed.races
      .filter((race) => codes.has(race.trophy))
      .map((race) => ({
        raceNumber: race.raceNumber,
        time: race.time,
        berks: race.berks,
        bucks: race.bucks,
      })),
  };
}

export async function fetchEventResults(
  event: Pick<EventConfig, "trophySlug" | "year">,
): Promise<{
  results: HrrResult[];
  generated: string | null;
}> {
  return cachedFetch(
    `results:${event.trophySlug}:${event.year}`,
    RESULTS_TTL_MS,
    () => fetchEventResultsUncached(event),
  );
}

export async function fetchEventTimetable(
  event: Pick<EventConfig, "timetableCodes">,
): Promise<TimetableData> {
  const empty: TimetableData = { raceDay: null, races: [] };

  try {
    const parsed = await cachedFetch("timetable:global", TIMETABLE_TTL_MS, () =>
      fetchTimetableUncached(),
    );
    return filterTimetableForEvent(parsed, event.timetableCodes);
  } catch {
    return empty;
  }
}

/** @deprecated Use fetchEventResults */
export async function fetchPeResults(year = "2026") {
  return fetchEventResults({
    trophySlug: "the-princess-elizabeth-challenge-cup",
    year: Number(year),
  });
}

/** @deprecated Use fetchEventTimetable */
export async function fetchPeTimetable() {
  return fetchEventTimetable({
    timetableCodes: ["PE", "P Elizabeth"],
  });
}

export function parseTimetableCrewNumber(raw: string): number | null {
  const match = raw.match(/^(\d+)\s+/);
  return match ? parseInt(match[1], 10) : null;
}

export function parseTimetableCrew(raw: string): string {
  return raw.replace(/^\d+\s+/, "").trim();
}

function resultNameVariants(crew: HrrResult["winner"]): string[] {
  const names = [crew.name];
  if (crew.shortName && crew.shortName !== crew.name) {
    names.push(crew.shortName);
  }
  return names;
}

export function resultMatchesPair(
  result: HrrResult,
  crewA: string,
  crewB: string,
): boolean {
  for (const winner of resultNameVariants(result.winner)) {
    for (const loser of resultNameVariants(result.loser)) {
      if (
        (crewsMatch(winner, crewA) && crewsMatch(loser, crewB)) ||
        (crewsMatch(winner, crewB) && crewsMatch(loser, crewA))
      ) {
        return true;
      }
    }
  }
  return false;
}

export function resultMatchesDrawPair(
  result: HrrResult,
  berks: Crew,
  bucks: Crew,
): boolean {
  return (
    (crewResultMatchesDraw(berks, result.winner) &&
      crewResultMatchesDraw(bucks, result.loser)) ||
    (crewResultMatchesDraw(bucks, result.winner) &&
      crewResultMatchesDraw(berks, result.loser))
  );
}
