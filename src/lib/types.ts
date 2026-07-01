export interface Crew {
  name: string;
  shortName?: string;
  number?: number;
}

export interface RaceSplits {
  barrier?: string;
  fawley?: string;
  finish?: string;
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
  timetablePeRaces: number;
  upcomingRaces: UpcomingRace[];
  roundCounts?: number[];
  bracketWarnings?: string[];
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
