import * as cheerio from "cheerio";
import type {
  HrrResult,
  HrrResultsResponse,
  TimetableData,
  TimetableRace,
} from "./types";

const HRR_API_BASE = "https://www.hrr.co.uk/wp-json/hrr/v1";
const PE_TROPHY_SLUG = "the-princess-elizabeth-challenge-cup";
const TIMETABLE_URL = "https://www.hrr.co.uk/compete/race-timetable/";

export function normalizeCrewName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\./g, "")
    .replace(/,\s*u\.s\.a\.?/gi, "")
    .replace(/,\s*australia/gi, "")
    .replace(/,\s*france/gi, "")
    .replace(/\s+(rowing club|boat club|school|college)\.?$/gi, "")
    .replace(/\s+(r\.c|b\.c|sch|coll)\.?$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function crewsMatch(a: string, b: string): boolean {
  const na = normalizeCrewName(a);
  const nb = normalizeCrewName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const core = (s: string) =>
    s
      .replace(/^(the|st|st\.)\s+/i, "")
      .replace(/\s+(sch|school|coll|college|bc|rc|b\.c|r\.c)\.?$/i, "")
      .trim();

  const ca = core(na);
  const cb = core(nb);
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

export async function fetchPeResults(year = "2026"): Promise<{
  results: HrrResult[];
  generated: string | null;
}> {
  const accumulated = new Map<number, HrrResult>();
  let resultPage = 1;
  let lastPage = 1;
  let generated: string | null = null;

  // HRR uses "result-page" (not "page") for pagination — see hrr.co.uk app.js
  while (resultPage <= lastPage) {
    const params = new URLSearchParams({
      trophy: PE_TROPHY_SLUG,
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

const PE_TROPHY_CODES = new Set(["PE", "P Elizabeth"]);

function parseTimetableRaceDay(html: string): string | null {
  const match = html.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\s+\w+\s+\d{4}/i,
  );
  return match?.[0]?.trim() ?? null;
}

export async function fetchPeTimetable(): Promise<TimetableData> {
  const empty: TimetableData = { raceDay: null, races: [] };

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
      if (!PE_TROPHY_CODES.has(trophy)) return;

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
