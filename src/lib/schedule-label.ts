export function formatRaceSchedule(
  raceTime: string | null,
  raceNumber: string | null,
): string {
  if (raceTime) {
    return raceNumber ? `Race ${raceNumber} · ${raceTime}` : raceTime;
  }
  return "Upcoming";
}

export function formatUpcomingRaceMeta(
  raceTime: string | null,
  raceNumber: string | null,
  raceDay: string | null,
): string {
  if (!raceTime) return "Upcoming";

  const parts: string[] = [];
  if (raceNumber) parts.push(`Race ${raceNumber}`);
  if (raceDay) {
    const shortDay = raceDay.split(" ")[0]?.slice(0, 3);
    if (shortDay) parts.push(shortDay);
  }
  parts.push(raceTime);
  return parts.join(" · ");
}
