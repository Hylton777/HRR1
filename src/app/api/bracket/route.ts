import { NextResponse } from "next/server";
import { buildBracket } from "@/lib/bracket-engine";
import { fetchPeResults, fetchPeTimetable } from "@/lib/hrr-api";
import type { BracketApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ results, generated }, timetable] = await Promise.all([
      fetchPeResults("2026"),
      fetchPeTimetable(),
    ]);

    const bracket = buildBracket(results, timetable);

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
