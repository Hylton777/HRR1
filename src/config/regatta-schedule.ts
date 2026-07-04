import type { RegattaDay } from "@/lib/regatta-days";

/**
 * 2026 Henley Royal Regatta racing days per the official programme:
 * https://www.hrr.co.uk/racing-schedule/
 *
 * Each preset lists only days on which that event races. `primaryRoundIndex`
 * is the knockout round chiefly rowed that day (0 = first round in draw JSON).
 */

type DayKey = "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const REGATTA_2026: Record<DayKey, Omit<RegattaDay, "primaryRoundIndex">> = {
  tue: {
    id: "tue",
    label: "Tuesday 30 June",
    shortLabel: "Tue",
    isoDate: "2026-06-30",
  },
  wed: {
    id: "wed",
    label: "Wednesday 1 July",
    shortLabel: "Wed",
    isoDate: "2026-07-01",
  },
  thu: {
    id: "thu",
    label: "Thursday 2 July",
    shortLabel: "Thu",
    isoDate: "2026-07-02",
  },
  fri: {
    id: "fri",
    label: "Friday 3 July",
    shortLabel: "Fri",
    isoDate: "2026-07-03",
  },
  sat: {
    id: "sat",
    label: "Saturday 4 July",
    shortLabel: "Sat",
    isoDate: "2026-07-04",
  },
  sun: {
    id: "sun",
    label: "Sunday 5 July",
    shortLabel: "Sun",
    isoDate: "2026-07-05",
  },
};

function programme(...rounds: [DayKey, number][]): RegattaDay[] {
  return rounds.map(([day, primaryRoundIndex]) => ({
    ...REGATTA_2026[day],
    primaryRoundIndex,
  }));
}

/** Sunday final only (Grand, Remenham, Princess Grace). */
export const SUNDAY_FINAL_DAYS = programme(["sun", 0]);

/** Stewards: Saturday semi-final, Sunday final. */
export const STEWARDS_RACE_DAYS = programme(["sat", 0], ["sun", 1]);

/** Thursday heats → Friday QF → Saturday SF → Sunday final. */
export const THU_SUN_4ROUND_DAYS = programme(
  ["thu", 0],
  ["fri", 1],
  ["sat", 2],
  ["sun", 3],
);

/** Friday QF → Saturday SF → Sunday final. */
export const FRI_SUN_3ROUND_DAYS = programme(
  ["fri", 0],
  ["sat", 1],
  ["sun", 2],
);

/** Tuesday/Wednesday heats, Friday QF (no Thursday), Saturday SF, Sunday final. */
export const TUE_WED_FRI_SUN_5ROUND_DAYS = programme(
  ["tue", 0],
  ["wed", 1],
  ["fri", 2],
  ["sat", 3],
  ["sun", 4],
);

/** Wednesday–Sunday (no Tuesday heats). */
export const WED_SUN_5ROUND_DAYS = programme(
  ["wed", 0],
  ["thu", 1],
  ["fri", 2],
  ["sat", 3],
  ["sun", 4],
);

/** Wargrave / Wyfold: Thursday QF, no Friday. */
export const TUE_WED_THU_SAT_SUN_5ROUND_DAYS = programme(
  ["tue", 0],
  ["wed", 1],
  ["thu", 2],
  ["sat", 3],
  ["sun", 4],
);

/** Fawley / Diamond Jubilee: Tuesday heats, Thursday onward (no Wednesday). */
export const TUE_THU_FRI_SAT_SUN_5ROUND_DAYS = programme(
  ["tue", 0],
  ["thu", 1],
  ["fri", 2],
  ["sat", 3],
  ["sun", 4],
);

/** Britannia / Danesfield: Wednesday heats, Thursday QF, no Friday. */
export const WED_THU_SAT_SUN_4ROUND_DAYS = programme(
  ["wed", 0],
  ["thu", 1],
  ["sat", 2],
  ["sun", 3],
);

/** Queen Victoria: Wednesday heats, Friday QF (no Thursday). */
export const WED_FRI_SAT_SUN_4ROUND_DAYS = programme(
  ["wed", 0],
  ["fri", 1],
  ["sat", 2],
  ["sun", 3],
);

/** Double sculls: Thursday heats, Saturday SF, Sunday final. */
export const THU_SAT_SUN_3ROUND_DAYS = programme(
  ["thu", 0],
  ["sat", 1],
  ["sun", 2],
);

/** Double sculls: Thursday heats, Friday QF, Saturday SF, Sunday final. */
export const THU_FRI_SAT_SUN_4ROUND_DAYS = programme(
  ["thu", 0],
  ["fri", 1],
  ["sat", 2],
  ["sun", 3],
);

/** @deprecated Use TUE_WED_FRI_SUN_5ROUND_DAYS */
export const PE_RACE_DAYS = TUE_WED_FRI_SUN_5ROUND_DAYS;

/** @deprecated Use THU_SUN_4ROUND_DAYS */
export const POW_RACE_DAYS = THU_SUN_4ROUND_DAYS;

/** @deprecated Use THU_SUN_4ROUND_DAYS */
export const LP_RACE_DAYS = THU_SUN_4ROUND_DAYS;

/** @deprecated Use FRI_SUN_3ROUND_DAYS or THU_SUN_4ROUND_DAYS per event */
export const GOBLETS_RACE_DAYS = THU_SUN_4ROUND_DAYS;
