import { NextResponse } from "next/server";
import { getEventConfig, isEventId } from "@/config/events";
import { buildBracket, collectUpcomingRaces } from "@/lib/bracket-engine";
import { fetchEventResults, fetchEventTimetable } from "@/lib/hrr-api";
import { validateRoundCounts } from "@/lib/bracket-layout";
import { auditResultCompleteness } from "@/lib/result-audit";
import type { BracketApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ event: string }> },
) {
  const { event: eventId } = await params;

  if (!isEventId(eventId)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  }

  const event = getEventConfig(eventId)!;

  try {
    const [{ results, generated }, timetable] = await Promise.all([
      fetchEventResults(event),
      fetchEventTimetable(event),
    ]);

    const bracket = buildBracket(event, results, timetable);
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
      upcomingRaces: collectUpcomingRaces(bracket.rounds),
      roundCounts,
      bracketWarnings,
      resultAudit,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(`Bracket API error (${eventId}):`, error);
    return NextResponse.json(
      { error: "Failed to fetch bracket data" },
      { status: 500 },
    );
  }
}
