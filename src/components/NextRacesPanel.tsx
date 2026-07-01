"use client";

import { formatUpcomingRaceMeta } from "@/lib/schedule-label";
import { isSeededCrew } from "@/lib/crew-seeds";
import type { Crew, UpcomingRace } from "@/lib/types";

function displayName(
  crew: Crew | null,
): string {
  if (!crew) return "TBD";
  return crew.shortName || crew.name;
}

function crewClass(crew: Crew | null, colorClass: string): string {
  return `${colorClass} ${isSeededCrew(crew) ? "font-bold" : "font-medium"}`;
}

interface NextRacesPanelProps {
  races: UpcomingRace[];
  timetableDay: string | null;
  /** Compact strip for mobile above bracket */
  compact?: boolean;
}

export default function NextRacesPanel({
  races,
  timetableDay,
  compact = false,
}: NextRacesPanelProps) {
  if (races.length === 0) {
    if (compact) return null;
    return (
      <p className="text-[var(--muted)] text-sm">
        No upcoming PE races in the draw yet.
      </p>
    );
  }

  if (compact) {
    const next = races[0];
    return (
      <div className="rounded-sm border border-[var(--hrr-blue)]/30 bg-[var(--card)] shadow-sm p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-[var(--hrr-navy)]">
            Next Races
          </h2>
          <span className="text-[10px] text-[var(--muted)]">
            {races.length} upcoming
          </span>
        </div>
        <div className="text-sm font-medium leading-snug">
          <span className="text-[10px] text-[var(--muted)] block mb-0.5">
            {next.roundLabel}
            {" · "}
            {formatUpcomingRaceMeta(
              next.raceTime,
              next.raceNumber,
              next.raceDay,
            )}
          </span>
          <span className={crewClass(next.berks, "text-[var(--berks)]")}>
            {displayName(next.berks)}
          </span>
          <span className="text-[var(--muted)] font-normal"> vs </span>
          <span className={crewClass(next.bucks, "text-[var(--bucks)]")}>
            {displayName(next.bucks)}
          </span>
        </div>
        {races.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
            {races.slice(1, 4).map((race) => (
              <div
                key={race.id}
                className="shrink-0 min-w-[140px] rounded-sm border border-[var(--card-border)] bg-[var(--hrr-cream)] px-2 py-1.5 text-[10px]"
              >
                <div className="text-[var(--muted)] mb-0.5 truncate">
                  {race.roundLabel}
                </div>
                <div className="font-medium truncate">
                  {displayName(race.berks)} v {displayName(race.bucks)}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-[var(--muted)] leading-snug">
          Timings from the{" "}
          <a
            href="https://www.hrr.co.uk/compete/race-timetable/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--hrr-blue)]"
          >
            official HRR draw
          </a>
          {timetableDay ? ` (${timetableDay})` : ""}. PE has no racing on
          Thursday — Friday times publish around 9pm BST the evening before.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
        Timings from the{" "}
        <a
          href="https://www.hrr.co.uk/compete/race-timetable/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--hrr-blue)]"
        >
          official HRR draw
        </a>
        {timetableDay ? ` (${timetableDay})` : ""}. Published around 9pm BST
        the evening before racing — until then races show as Upcoming.
      </p>
      <div className="space-y-3">
        {races.map((race) => (
          <div
            key={race.id}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-sm p-3 text-sm shadow-sm"
          >
            <div className="text-xs text-[var(--muted)] mb-1 flex justify-between gap-2">
              <span>{race.roundLabel}</span>
              <span
                className={
                  race.raceTime
                    ? "text-[var(--hrr-blue)] font-medium"
                    : "text-[var(--bucks)]"
                }
              >
                {formatUpcomingRaceMeta(
                  race.raceTime,
                  race.raceNumber,
                  race.raceDay,
                )}
              </span>
            </div>
            <div className="font-medium leading-snug">
              <span className={crewClass(race.berks, "text-[var(--berks)]")}>
                {displayName(race.berks)}
              </span>{" "}
              <span className="text-[var(--muted)] font-normal">vs</span>{" "}
              <span className={crewClass(race.bucks, "text-[var(--bucks)]")}>
                {displayName(race.bucks)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
