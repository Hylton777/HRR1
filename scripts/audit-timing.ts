import { EVENT_LIST } from "../src/config/events";
import { buildBracket } from "../src/lib/bracket-engine";
import { fetchEventResults, fetchEventTimetable } from "../src/lib/hrr-api";
import {
  getLondonTodayIso,
  getScheduledRegattaDayForRound,
  resolveRegattaDayIso,
} from "../src/lib/regatta-days";

function parseRaceTimeMinutes(raceTime: string | null): number | null {
  if (!raceTime) return null;
  const m = raceTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function getLondonNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  return hour * 60 + minute;
}

async function main() {
  const today = getLondonTodayIso();
  const now = getLondonNowMinutes();
  const missing: string[] = [];
  const early: string[] = [];

  for (const event of EVENT_LIST) {
    const [{ results }, timetable] = await Promise.all([
      fetchEventResults(event),
      fetchEventTimetable(event),
    ]);
    const bracket = buildBracket(event, results, timetable);

    for (const match of bracket.rounds.flat()) {
      if (!match.berks?.name || !match.bucks?.name) continue;

      const scheduledDay = getScheduledRegattaDayForRound(
        match.roundIndex,
        event.raceDays,
      );
      const resultDayIso = match.raceDay
        ? resolveRegattaDayIso(match.raceDay, event.raceDays)
        : null;
      const scheduleDayIso = scheduledDay?.isoDate ?? null;

      const raceMinutes = parseRaceTimeMinutes(match.raceTime);

      if (raceMinutes != null && resultDayIso) {
        const due =
          resultDayIso < today ||
          (resultDayIso === today && now >= raceMinutes + 20);
        if (due && match.status !== "complete") {
          missing.push(
            `${event.id} ${match.id} ${match.roundLabel} @ ${match.raceTime} (${match.berks.shortName} vs ${match.bucks.shortName})`,
          );
        }
      }

      if (match.status === "complete" && scheduleDayIso && scheduleDayIso > today) {
        early.push(
          `${event.id} ${match.id} scheduled ${scheduleDayIso} but has result (raceDay ${match.raceDay ?? "-"})`,
        );
      }
    }
  }

  console.log(`Timing audit London ${today} ${Math.floor(now / 60)}:${String(now % 60).padStart(2, "0")}\n`);
  console.log(`Missing results (${missing.length}):`);
  for (const line of missing) console.log(" ", line);
  console.log(`\nResults before scheduled day (${early.length}):`);
  for (const line of early) console.log(" ", line);
}

main();
