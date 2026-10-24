// Shared domain types for The Spread — predictor & season grid.
// Both leagues (CFB and NFL) use these same shapes; see lib/leagues.ts.

import type { League } from "./leagues";

export type SeasonType = "regular" | "postseason";

export interface Team {
  id: number;
  /** Team name. CFB: the school ("Ohio State"). NFL: the full club name ("Chicago Bears"). */
  school: string;
  mascot: string | null;
  abbreviation: string | null;
  /** CFB: conference ("SEC"). NFL: "AFC" or "NFC". */
  conference: string | null;
  /** CFB: intra-conference division when one exists. NFL: "AFC East" etc. */
  division: string | null;
  /**
   * Which grid section this team's row belongs under. CFB leaves this null and
   * falls back to `conference`; the NFL sets it to the division, since 8 groups
   * of 4 reads far better in the grid than 2 groups of 16.
   */
  group: string | null;
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

/**
 * A synthetic "week" for grid columns that don't map 1:1 to a numbered
 * calendar week. The first group is college-only (bowls and the CFP), the
 * second is NFL-only (the four playoff rounds).
 */
export type GridColumnKind =
  | "week"
  | "conf-champ"
  | "bowl"
  | "cfp-first-round"
  | "cfp-quarterfinal"
  | "cfp-semifinal"
  | "cfp-championship"
  | "nfl-wild-card"
  | "nfl-divisional"
  | "nfl-conference"
  | "nfl-super-bowl";

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

  /**
   * Days of rest going into this game. nflverse publishes these directly, which
   * is strictly better than deriving them from kickoff dates — it gets byes and
   * international-series scheduling right. CFB leaves them null and
   * scripts/lib/simulateSeason.ts derives rest from the previous game's date.
   */
  homeRestDays?: number | null;
  awayRestDays?: number | null;
  /** NFL: an in-division matchup. CFB leaves this undefined. */
  divisionGame?: boolean;
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
  /**
   * Power-rating difference, home minus away, in points of expected margin.
   * CFB fills this from CFBD's SP+ overall rating; the NFL fills it from the
   * SRS computed in lib/model/srs.ts. The field name predates the NFL model
   * and is kept because it is persisted in data/**\/picks/*.json — see
   * `ratingLabel` on ModelConfig for what to call it in the UI.
   */
  spOverallDiff: number | null;
  /**
   * Cross term (home offense vs away defense, less the reverse). CFB only:
   * the NFL's score-derived SRS has no offense/defense split, so this stays
   * null there and drops out of the margin sum.
   */
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

  overUnder: number | null; // market total (home + away combined points), when a line exists
  predictedTotal: number | null; // combined points estimate used for the tiebreaker predictor
  predictedTotalSource: "market" | "history" | null;
  predictedHomeScore: number | null; // predictedTotal split by predictedMargin
  predictedAwayScore: number | null;

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
  league: League;
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
  league: League;
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
