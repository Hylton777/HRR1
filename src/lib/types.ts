export interface Crew {
  name: string;
  shortName?: string;
  number?: number;
  /** Seeded/selected crew on the official Henley draw chart */
  seeded?: boolean;
}

export interface SplitTiming {
  time: string;
  loserLeading?: boolean;
}

export interface RaceSplits {
  barrier?: SplitTiming;
  fawley?: SplitTiming;
  finish?: SplitTiming;
}

export interface HrrResult {
  id: number;
  number: string;
  round: string;
  winner: Crew;
  loser: Crew;
  withdrawn: boolean;
  station: string;
  barrier: { split: string; loserLeading: boolean };
  fawley: { split: string; loserLeading: boolean };
  finish: { split: string };
  verdict: string;
  raceDateTime: string;
  raceDay: string;
  raceYear: string;
  raceTime: string;
}

export interface HrrResultsResponse {
  results: HrrResult[];
  pagination?: {
    currentPage: number;
    lastPage: number;
    nextPage: number | null;
  };
  generated?: { date: string };
}

export interface DrawMatch {
  id: string;
  /** Race number within this round on the official Henley draw chart (1-based) */
  drawRace?: number;
  berks: Crew | null;
  bucks: Crew | null;
  /** Parent match ids in the official draw (Henley steward pairings) */
  feeders?: string[];
}

export interface DrawData {
  event: string;
  year: number;
  rounds: DrawMatch[][];
}

export type MatchStatus = "pending" | "scheduled" | "complete";

export interface BracketMatch {
  id: string;
  roundIndex: number;
  matchIndex: number;
  drawRace?: number;
  roundLabel: string;
  feeders?: string[];
  berks: Crew | null;
  bucks: Crew | null;
  status: MatchStatus;
  winner: Crew | null;
  loser: Crew | null;
  verdict: string | null;
  raceNumber: string | null;
  raceTime: string | null;
  raceDay: string | null;
  splits: RaceSplits | null;
  station: string | null;
}

export interface BracketState {
  event: string;
  year: number;
  rounds: BracketMatch[][];
  champion: Crew | null;
}

export interface BracketApiResponse {
  bracket: BracketState;
  results: HrrResult[];
  lastUpdated: string;
  resultCount: number;
  hrrGenerated: string | null;
  timetableDay: string | null;
  timetableRaceCount: number;
  eventId: string;
  upcomingRaces: UpcomingRace[];
  roundCounts?: number[];
  bracketWarnings?: string[];
  resultAudit?: ResultAudit;
}

export interface MissingResultMatch {
  matchId: string;
  roundLabel: string;
  raceDay: string | null;
  raceNumber: string | null;
  raceTime: string | null;
  berks: string;
  bucks: string;
  reason: "same_day_partial" | "past_race_time";
}

export interface UnmatchedHrrResultSummary {
  id: number;
  number: string;
  raceDay: string;
  raceTime: string;
  winner: string;
  loser: string;
}

export interface ResultAudit {
  isComplete: boolean;
  completeCount: number;
  expectedRacedCount: number;
  fetchedResultCount: number;
  unmatchedResultCount: number;
  missingResults: MissingResultMatch[];
  unmatchedResults: UnmatchedHrrResultSummary[];
  incompleteDays: {
    raceDay: string;
    isoDate: string;
    complete: number;
    missing: number;
  }[];
  warnings: string[];
}

export interface TimetableRace {
  raceNumber: string;
  time: string;
  berks: string;
  bucks: string;
}

export interface TimetableData {
  raceDay: string | null;
  races: TimetableRace[];
}

export interface UpcomingRace {
  id: string;
  roundLabel: string;
  berks: Crew | null;
  bucks: Crew | null;
  raceNumber: string | null;
  raceTime: string | null;
  raceDay: string | null;
}
