import peDraw from "@/data/pe-2026-draw.json";
import powDraw from "@/data/pow-2026-draw.json";
import lpDraw from "@/data/lp-2026-draw.json";
import wyfoldDraw from "@/data/wyfold-2026-draw.json";
import gobletsDraw from "@/data/goblets-2026-draw.json";
import diamondDraw from "@/data/diamond-2026-draw.json";
import type { DrawData } from "@/lib/types";
import type { RegattaDay } from "@/lib/regatta-days";

export type EventId = "pe" | "pow" | "lp" | "wyfold" | "goblets" | "diamond";

export interface EventConfig {
  id: EventId;
  trophySlug: string;
  timetableCodes: string[];
  year: number;
  displayName: string;
  shortLabel: string;
  headerSubtitle: string;
  crewCount: number;
  draw: DrawData;
  raceDays: RegattaDay[];
  roundSizes: readonly number[];
  roundLabels: string[];
  seededCrewNumbers: readonly number[];
  seededCrewNames: readonly string[];
  noRacingNote?: string;
}

const PE_RACE_DAYS: RegattaDay[] = [
  {
    id: "tue",
    label: "Tuesday 30 June",
    shortLabel: "Tue",
    isoDate: "2026-06-30",
    primaryRoundIndex: 0,
  },
  {
    id: "wed",
    label: "Wednesday 1 July",
    shortLabel: "Wed",
    isoDate: "2026-07-01",
    primaryRoundIndex: 1,
  },
  {
    id: "fri",
    label: "Friday 3 July",
    shortLabel: "Fri",
    isoDate: "2026-07-03",
    primaryRoundIndex: 2,
  },
  {
    id: "sat",
    label: "Saturday 4 July",
    shortLabel: "Sat",
    isoDate: "2026-07-04",
    primaryRoundIndex: 3,
  },
  {
    id: "sun",
    label: "Sunday 5 July",
    shortLabel: "Sun",
    isoDate: "2026-07-05",
    primaryRoundIndex: 4,
  },
];

const POW_RACE_DAYS: RegattaDay[] = [
  {
    id: "thu",
    label: "Thursday 2 July",
    shortLabel: "Thu",
    isoDate: "2026-07-02",
    primaryRoundIndex: 0,
  },
  {
    id: "fri",
    label: "Friday 3 July",
    shortLabel: "Fri",
    isoDate: "2026-07-03",
    primaryRoundIndex: 1,
  },
  {
    id: "sat",
    label: "Saturday 4 July",
    shortLabel: "Sat",
    isoDate: "2026-07-04",
    primaryRoundIndex: 2,
  },
  {
    id: "sun",
    label: "Sunday 5 July",
    shortLabel: "Sun",
    isoDate: "2026-07-05",
    primaryRoundIndex: 3,
  },
];

const GOBLETS_RACE_DAYS: RegattaDay[] = [
  {
    id: "fri",
    label: "Friday 3 July",
    shortLabel: "Fri",
    isoDate: "2026-07-03",
    primaryRoundIndex: 0,
  },
  {
    id: "sat",
    label: "Saturday 4 July",
    shortLabel: "Sat",
    isoDate: "2026-07-04",
    primaryRoundIndex: 1,
  },
  {
    id: "sun",
    label: "Sunday 5 July",
    shortLabel: "Sun",
    isoDate: "2026-07-05",
    primaryRoundIndex: 2,
  },
];

const LP_RACE_DAYS: RegattaDay[] = [
  {
    id: "thu",
    label: "Thursday 2 July",
    shortLabel: "Thu",
    isoDate: "2026-07-02",
    primaryRoundIndex: 0,
  },
  {
    id: "fri",
    label: "Friday 3 July",
    shortLabel: "Fri",
    isoDate: "2026-07-03",
    primaryRoundIndex: 1,
  },
  {
    id: "sat",
    label: "Saturday 4 July",
    shortLabel: "Sat",
    isoDate: "2026-07-04",
    primaryRoundIndex: 2,
  },
  {
    id: "sun",
    label: "Sunday 5 July",
    shortLabel: "Sun",
    isoDate: "2026-07-05",
    primaryRoundIndex: 3,
  },
];

export const EVENTS: Record<EventId, EventConfig> = {
  pe: {
    id: "pe",
    trophySlug: "the-princess-elizabeth-challenge-cup",
    timetableCodes: ["PE", "P Elizabeth"],
    year: 2026,
    displayName: "Princess Elizabeth Challenge Cup",
    shortLabel: "PE",
    headerSubtitle: "Live knockout bracket · 32 crews · Junior men's eights",
    crewCount: 32,
    draw: peDraw as DrawData,
    raceDays: PE_RACE_DAYS,
    roundSizes: [16, 8, 4, 2, 1],
    roundLabels: [
      "1st Round",
      "2nd Round",
      "Quarter-Final",
      "Semi-Final",
      "Final",
    ],
    seededCrewNumbers: [
      256, 263, 270, 273, 281, 282, 283, 284, 286, 288, 290, 300,
    ],
    seededCrewNames: [
      "Bedford School",
      "Deerfield Academy, U.S.A.",
      "Hampton School",
      "King's College School, Wimbledon",
      "Radley College",
      "Reading Blue Coat School",
      "Shiplake College",
      "Shrewsbury School",
      "St. Edward's School",
      "St. Paul's School",
      "Sydney University Boat Club, Australia",
      "Westminster School",
    ],
    noRacingNote:
      "PE has no racing on Thursday — Friday times publish around 9pm BST the evening before.",
  },
  pow: {
    id: "pow",
    trophySlug: "the-prince-of-wales-challenge-cup",
    timetableCodes: ["Pr Wales"],
    year: 2026,
    displayName: "Prince of Wales Challenge Cup",
    shortLabel: "POW",
    headerSubtitle: "Live knockout bracket · 16 crews · Intermediate quads",
    crewCount: 16,
    draw: powDraw as DrawData,
    raceDays: POW_RACE_DAYS,
    roundSizes: [8, 4, 2, 1],
    roundLabels: ["1st Round", "Quarter-Final", "Semi-Final", "Final"],
    seededCrewNumbers: [434, 443, 446, 450],
    seededCrewNames: [
      "Algemene Amsterdamsche Studenten Roeivereniging Skøll 'A', Netherlands",
      "Leander Club",
      "Nautilus Rowing Club and Edinburgh University",
      "Reading University 'A'",
    ],
    noRacingNote:
      "POW races Thu–Sun — times publish around 9pm BST the evening before.",
  },
  lp: {
    id: "lp",
    trophySlug: "the-ladies-challenge-plate",
    timetableCodes: ["Ladies'"],
    year: 2026,
    displayName: "Ladies' Challenge Plate",
    shortLabel: "Ladies",
    headerSubtitle: "Live knockout bracket · 10 crews · Intermediate men's eights",
    crewCount: 10,
    draw: lpDraw as DrawData,
    raceDays: LP_RACE_DAYS,
    roundSizes: [2, 4, 2, 1],
    roundLabels: ["1st Round", "Quarter-Final", "Semi-Final", "Final"],
    seededCrewNumbers: [1, 3, 4, 6],
    seededCrewNames: [
      "Leander Club",
      "Nautilus Rowing Club",
      "University of Washington, U.S.A.",
      "Cambridge University and Harvard University, U.S.A.",
    ],
    noRacingNote:
      "Ladies' races Thu–Sun — times publish around 9pm BST the evening before.",
  },
  wyfold: {
    id: "wyfold",
    trophySlug: "the-wyfold-challenge-cup",
    timetableCodes: ["Wyfold"],
    year: 2026,
    displayName: "Wyfold Challenge Cup",
    shortLabel: "Wyfold",
    headerSubtitle: "Live knockout bracket · 32 crews · Club coxless fours",
    crewCount: 32,
    draw: wyfoldDraw as DrawData,
    raceDays: PE_RACE_DAYS,
    roundSizes: [16, 8, 4, 2, 1],
    roundLabels: [
      "1st Round",
      "2nd Round",
      "Quarter-Final",
      "Semi-Final",
      "Final",
    ],
    seededCrewNumbers: [
      383, 388, 392, 393, 395, 397, 400, 401, 405, 409, 413, 415, 416, 420,
    ],
    seededCrewNames: [
      "Derby Rowing Club 'A'",
      "Haldens Roklub, Norway",
      "Koninklijke Roeivereniging Club Gent, Belgium",
      "London Rowing Club",
      "Marlow Rowing Club",
      "Mercantile Rowing Club, Australia",
      "Molesey Boat Club",
      "Northwich Rowing Club",
      "Quintin Boat Club",
      "St. Andrew Boat Club 'A'",
      "Sydney Rowing Club 'A', Australia",
      "Thames Rowing Club 'A'",
      "Thames Rowing Club 'B'",
      "Vesta Rowing Club",
    ],
    noRacingNote:
      "Heats run Tue–Wed; knockout continues Fri–Sun — times publish around 9pm BST the evening before.",
  },
  goblets: {
    id: "goblets",
    trophySlug: "the-silver-goblets-and-nickalls-challenge-cup",
    timetableCodes: ["Goblets"],
    year: 2026,
    displayName: "Silver Goblets & Nickalls' Challenge Cup",
    shortLabel: "Goblets",
    headerSubtitle: "Live knockout bracket · 8 crews · Premier men's coxless pairs",
    crewCount: 8,
    draw: gobletsDraw as DrawData,
    raceDays: GOBLETS_RACE_DAYS,
    roundSizes: [4, 2, 1],
    roundLabels: ["Quarter-Final", "Semi-Final", "Final"],
    seededCrewNumbers: [749, 751, 759, 761],
    seededCrewNames: [
      "K. Borković & B. Cesarec, H.V.K. Gusar Split, Croatia",
      "R. Corrigan & N. Timoney, Portora Boat Club, Ireland",
      "P.H.R. Martin & S. Achterfeld, Kettwiger Rudergesellschaft e.V. and Renn-Ruder Gemeinschaft Mülheim/Ruhr, Germany",
      "J.N. Wincomb & T.W.K. Digby, Marlow Rowing Club and Leander Club",
    ],
    noRacingNote:
      "Goblets races Fri–Sun — times publish around 9pm BST the evening before.",
  },
  diamond: {
    id: "diamond",
    trophySlug: "the-diamond-challenge-sculls",
    timetableCodes: ["Diamonds"],
    year: 2026,
    displayName: "Diamond Challenge Sculls",
    shortLabel: "Diamond",
    headerSubtitle:
      "Live knockout bracket · 16 crews · Premier men's single sculls",
    crewCount: 16,
    draw: diamondDraw as DrawData,
    raceDays: POW_RACE_DAYS,
    roundSizes: [8, 4, 2, 1],
    roundLabels: ["1st Round", "Quarter-Final", "Semi-Final", "Final"],
    seededCrewNumbers: [813, 818, 819, 820, 830, 831, 832, 840],
    seededCrewNames: [
      "C. Baxter, Rowing South Africa, South Africa",
      "D.M.V. Gonçalves, Real Club Fluvial Portuense, Portugal",
      "T. Gränitz, Berliner Ruderclub, Germany",
      "K. Hultsch, Ruderverein Wiking Linz, Austria",
      "M.Q. Oddershede, Bagsværd Roklub, Denmark",
      "B.C.D. Parsonage, Clydesdale Amateur Rowing Club",
      "J.R. Poulsen, Bagsværd Roklub, Denmark",
      "O. Zeidler, Frankfurter Rudergesellschaft Germania 1869 e.V., Germany",
    ],
    noRacingNote:
      "Diamond races Thu–Sun — times publish around 9pm BST the evening before.",
  },
};

export const EVENT_LIST: EventConfig[] = [
  EVENTS.pe,
  EVENTS.pow,
  EVENTS.lp,
  EVENTS.wyfold,
  EVENTS.goblets,
  EVENTS.diamond,
];

export function getEventConfig(id: string): EventConfig | null {
  if (id in EVENTS) return EVENTS[id as EventId];
  return null;
}

export function isEventId(id: string): id is EventId {
  return id in EVENTS;
}
