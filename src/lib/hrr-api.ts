import * as cheerio from "cheerio";
import type { HrrResult, HrrResultsResponse, TimetableRace } from "./types";

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
    .replace(/\s+/g, " ")
    .trim();
}

export function crewsMatch(a: string, b: string): boolean {
  const na = normalizeCrewName(a);
  const nb = normalizeCrewName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const stripSuffix = (s: string) =>
    s
      .replace(/\s+(sch|school|coll|college|bc|rc|b\.c|r\.c)\.?$/i, "")
      .trim();
  const sa = stripSuffix(na);
  const sb = stripSuffix(nb);
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

export async function fetchPeResults(year = "2026"): Promise<{
  results: HrrResult[];
  generated: string | null;
}> {
  const accumulated = new Map<number, HrrResult>();
  let page = 1;
  let lastPage = 1;
  let generated: string | null = null;

  while (page <= lastPage) {
    const url = `${HRR_API_BASE}/results?trophy=${PE_TROPHY_SLUG}&page=${page}`;
    const response = await fetch(url, {
      next: { revalidate: 0 },
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
    const nextPage = data.pagination?.nextPage;
    if (!nextPage || nextPage === page) break;
    page = nextPage;
  }

  const results = Array.from(accumulated.values()).sort(
    (a, b) =>
      new Date(a.raceDateTime).getTime() - new Date(b.raceDateTime).getTime(),
  );

  return { results, generated };
}

export async function fetchPeTimetable(): Promise<TimetableRace[]> {
  try {
    const response = await fetch(TIMETABLE_URL, {
      next: { revalidate: 300 },
      headers: { Accept: "text/html" },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const races: TimetableRace[] = [];

    $("tr.timetable-row-r").each((_, row) => {
      const trophy = $(row).find(".timetable-field-trophy").text().trim();
      if (trophy !== "PE" && trophy !== "P Elizabeth") return;

      races.push({
        raceNumber: $(row).find(".timetable-field-race").text().trim(),
        time: $(row).find(".timetable-field-time").text().trim(),
        berks: $(row).find(".timetable-field-berks").text().trim(),
        bucks: $(row).find(".timetable-field-bucks").text().trim(),
      });
    });

    return races;
  } catch {
    return [];
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
