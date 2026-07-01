import { NextResponse } from "next/server";
import { buildBracket, collectUpcomingRaces } from "@/lib/bracket-engine";
import { fetchPeResults, fetchPeTimetable } from "@/lib/hrr-api";
import { validateRoundCounts } from "@/lib/bracket-layout";
import type { BracketApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ results, generated }, timetable] = await Promise.all([
      fetchPeResults("2026"),
      fetchPeTimetable(),
    ]);

    const bracket = buildBracket(results, timetable);
    const roundCounts = bracket.rounds.map((r) => r.length);
    const bracketWarnings = [
      ...validateRoundCounts(bracket.rounds),
    ];

    const response: BracketApiResponse = {
      bracket,
      results: results.sort(
        (a, b) =>
          new Date(b.raceDateTime).getTime() -
          new Date(a.raceDateTime).getTime(),
      ),
      lastUpdated: new Date().toISOString(),
      resultCount: results.length,
      hrrGenerated: generated,
      timetableDay: timetable.raceDay,
      timetablePeRaces: timetable.races.length,
      upcomingRaces: collectUpcomingRaces(bracket.rounds),
      roundCounts,
      bracketWarnings,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Bracket API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bracket data" },
      { status: 500 },
    );
  }
}
