import { NextResponse } from "next/server";
import { EVENTS } from "@/config/events";
import { buildBracket, collectUpcomingRaces } from "@/lib/bracket-engine";
import { fetchEventResults, fetchEventTimetable } from "@/lib/hrr-api";
import { validateRoundCounts } from "@/lib/bracket-layout";
import { auditDisplayConsistency } from "@/lib/display-consistency";
import { auditResultCompleteness } from "@/lib/result-audit";
import { BRACKET_API_CACHE_CONTROL } from "@/lib/api-cache";
import type { BracketApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Legacy PE-only endpoint — prefer /api/bracket/pe */
export async function GET() {
  const event = EVENTS.pe;

  try {
    const [{ results, generated }, timetable] = await Promise.all([
      fetchEventResults(event),
      fetchEventTimetable(event),
    ]);

    const bracket = buildBracket(event, results, timetable);
    const upcomingRaces = collectUpcomingRaces(bracket.rounds);
    const roundCounts = bracket.rounds.map((r) => r.length);
    const bracketWarnings = validateRoundCounts(
      bracket.rounds,
      event.roundSizes,
    );
    const resultAudit = auditResultCompleteness(
      bracket.rounds,
      results,
      event,
    );
    const displayAudit = auditDisplayConsistency(
      bracket.rounds,
      results,
      upcomingRaces,
      event,
    );

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
      timetableRaceCount: timetable.races.length,
      eventId: event.id,
      upcomingRaces,
      roundCounts,
      bracketWarnings,
      resultAudit,
      displayAudit,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": BRACKET_API_CACHE_CONTROL,
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
