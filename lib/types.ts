// Shared domain types for The Spread — CFB predictor & season grid.

export type SeasonType = "regular" | "postseason";

export interface Team {
  id: number;
  school: string;
  mascot: string | null;
  abbreviation: string | null;
  conference: string | null;
  division: string | null;
  classification: string | null;
  color: string | null;
  altColor: string | null;
  logo: string | null;
}

export interface TeamRecord {
  team: string;
  year: number;
  wins: number;
  losses: number;
  ties: number;
  expectedWins: number | null;
}

export interface SPRating {
  team: string;
  year: number;
  rating: number | null;
  ranking: number | null;
  offenseRating: number | null;
  defenseRating: number | null;
  specialTeamsRating: number | null;
}

export interface CalendarWeek {
  season: number;
  week: number;
  seasonType: SeasonType;
  label: string;
  startDate: string;
  endDate: string;
  firstGameStart: string | null;
  lastGameStart: string | null;
}

/** A synthetic "week" for grid columns that don't map 1:1 to a CFBD calendar week. */
export type GridColumnKind =
  | "week"
  | "conf-champ"
  | "bowl"
  | "cfp-first-round"
  | "cfp-quarterfinal"
  | "cfp-semifinal"
  | "cfp-championship";

export interface GridColumn {
  id: string; // e.g. "2026-regular-1", "2026-postseason-cfp-semifinal"
  kind: GridColumnKind;
  label: string; // e.g. "Week 1", "Conf Champ", "CFP QF"
  season: number;
  seasonType: SeasonType;
  week: number | null;
  order: number;
}

export type SiteType = "home" | "away" | "neutral";

export interface RawGame {
  id: number;
  season: number;
  week: number;
  seasonType: SeasonType;
  startDate: string;
  completed: boolean;
  neutralSite: boolean;
  conferenceGame: boolean;
  homeTeam: string;
  homeConference: string | null;
  homePoints: number | null;
  awayTeam: string;
  awayConference: string | null;
  awayPoints: number | null;
  venue: string | null;
  notes: string | null;
}

export interface RawLine {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  spread: number | null; // normalized: positive = home favored by N points
  overUnder: number | null;
  provider: string | null;
}

export interface RestTravelFlags {
  homeShortWeek: boolean;
  awayShortWeek: boolean;
  homeOffBye: boolean;
  awayOffBye: boolean;
  homeLongRoadTrip: boolean;
  awayLongRoadTrip: boolean;
}

export interface MatchupFeatures {
  spOverallDiff: number | null; // home - away
  spOffenseVsDefenseDiff: number | null;
  recentFormWinPctDiff: number | null;
  recentFormMarginDiff: number | null;
  turnoverMarginDiff: number | null;
  homeFieldPoints: number; // 0 if neutral site
  restTravelPoints: number; // signed adjustment, home perspective
  headToHeadMarginDiff: number | null;
}

export interface GamePick {
  gameId: number;
  season: number;
  week: number;
  seasonType: SeasonType;
  columnId: string;
  startDate: string;
  homeTeam: string;
  awayTeam: string;
  site: SiteType;
  spread: number | null; // positive = home favored
  spreadFavorite: "home" | "away" | null;

  pMarket: number | null; // home win probability implied by market
  pMatchup: number; // home win probability implied by matchup model
  pFinal: number; // blended home win probability

  predictedMarginMarket: number | null; // positive = home favored by N
  predictedMarginMatchup: number;
  predictedMargin: number; // blended, positive = home favored

  predictedWinner: string; // team name
  confidence: number; // 0-100, winner-perspective probability
  upsetAlert: boolean;
  upsetReason: string | null;
  explanation: string;

  features: MatchupFeatures;

  completed: boolean;
  homePoints: number | null;
  awayPoints: number | null;
  actualWinner: string | null;
  actualMargin: number | null;
  suCorrect: boolean | null; // straight-up
  atsCorrect: boolean | null; // against the spread
}

export interface SeasonGrid {
  season: number;
  generatedAt: string;
  columns: GridColumn[];
  teams: Team[];
  games: GamePick[];
}

export interface CalibrationFit {
  fittedAt: string;
  seasonsUsed: number[];
  sampleSize: number;
  k: number;
  b: number;
  logLoss: number;
}

export interface ConfidenceBucketStat {
  bucket: string; // e.g. "50-55"
  min: number;
  max: number;
  n: number;
  suWins: number;
  suLosses: number;
  suWinPct: number;
  avgPredictedProb: number;
  actualWinRate: number;
}

export interface BreakdownStat {
  key: string;
  label: string;
  n: number;
  suWins: number;
  suLosses: number;
  suWinPct: number;
  atsWins: number;
  atsLosses: number;
  atsPushes: number;
  atsWinPct: number;
}

export interface SeasonAccuracy {
  season: number;
  n: number;
  suWins: number;
  suLosses: number;
  atsWins: number;
  atsLosses: number;
  atsPushes: number;
  confidenceBuckets: ConfidenceBucketStat[];
  byConference: BreakdownStat[];
  byFavoriteUnderdog: BreakdownStat[];
  bySite: BreakdownStat[];
  weekLog: {
    columnId: string;
    label: string;
    runningSU: string; // e.g. "12-4"
    runningATS: string;
    games: {
      gameId: number;
      matchup: string;
      pick: string;
      confidence: number;
      result: string | null;
      correct: boolean | null;
    }[];
  }[];
}
