import * as cheerio from "cheerio";
import type { EventConfig } from "@/config/events";
import { crewsMatch } from "./crew-match";
import type {
  HrrResult,
  HrrResultsResponse,
  TimetableData,
  TimetableRace,
} from "./types";

const HRR_API_BASE = "https://www.hrr.co.uk/wp-json/hrr/v1";
const TIMETABLE_URL = "https://www.hrr.co.uk/compete/race-timetable/";

export { crewsMatch, normalizeCrewName } from "./crew-match";

export async function fetchEventResults(
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

    const response = await fetch(`${HRR_API_BASE}/results?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

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

export async function fetchEventTimetable(
  event: Pick<EventConfig, "timetableCodes">,
): Promise<TimetableData> {
  const empty: TimetableData = { raceDay: null, races: [] };
  const codes = new Set(event.timetableCodes);

  try {
    const response = await fetch(TIMETABLE_URL, {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });

    if (!response.ok) return empty;

    const html = await response.text();
    const $ = cheerio.load(html);
    const races: TimetableRace[] = [];

    $("tr.timetable-row-r").each((_, row) => {
      const trophy = $(row).find(".timetable-field-trophy").text().trim();
      if (!codes.has(trophy)) return;

      const time = $(row).find(".timetable-field-time").text().trim();
      if (!time) return;

      races.push({
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

export function parseTimetableCrew(raw: string): string {
  return raw.replace(/^\d+\s+/, "").trim();
}

export function resultMatchesPair(
  result: HrrResult,
  crewA: string,
  crewB: string,
): boolean {
  const winner = result.winner.name;
  const loser = result.loser.name;
  return (
    (crewsMatch(winner, crewA) && crewsMatch(loser, crewB)) ||
    (crewsMatch(winner, crewB) && crewsMatch(loser, crewA))
  );
}
