import { MATCHUP_WEIGHTS, HOME_FIELD_POINTS, SHORT_WEEK_MAX_DAYS, BYE_WEEK_MIN_DAYS } from "./config";
import type { MatchupFeatures } from "../types";

export interface RecentGameResult {
  date: string;
  won: boolean;
  margin: number; // this team's points minus opponent's
  turnoverMargin: number | null; // takeaways minus giveaways, null if unknown
}

export interface TeamSeasonContext {
  spOverall: number | null;
  spOffense: number | null;
  spDefense: number | null;
  /** This team's completed games this season, strictly before the game being evaluated, chronological. */
  priorGames: RecentGameResult[];
  daysSinceLastGame: number | null;
}

function last(n: number, arr: RecentGameResult[]): RecentGameResult[] {
  return arr.slice(Math.max(0, arr.length - n));
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function recentFormWinPct(ctx: TeamSeasonContext, window = 5): number | null {
  const games = last(window, ctx.priorGames);
  if (games.length === 0) return null;
  return games.filter((g) => g.won).length / games.length;
}

export function recentFormAvgMargin(ctx: TeamSeasonContext, window = 5): number | null {
  const games = last(window, ctx.priorGames);
  return avg(games.map((g) => g.margin));
}

export function seasonTurnoverMarginPerGame(ctx: TeamSeasonContext): number | null {
  const known = ctx.priorGames.filter((g) => g.turnoverMargin !== null) as (RecentGameResult & {
    turnoverMargin: number;
  })[];
  if (known.length === 0) return null;
  return avg(known.map((g) => g.turnoverMargin));
}

export function isShortWeek(ctx: TeamSeasonContext): boolean {
  return ctx.daysSinceLastGame !== null && ctx.daysSinceLastGame <= SHORT_WEEK_MAX_DAYS;
}

export function isOffBye(ctx: TeamSeasonContext): boolean {
  return ctx.daysSinceLastGame !== null && ctx.daysSinceLastGame >= BYE_WEEK_MIN_DAYS;
}

export interface BuildFeaturesInput {
  home: TeamSeasonContext;
  away: TeamSeasonContext;
  neutralSite: boolean;
  crossConferenceRoadGame: boolean; // away team on a true road, different-conference trip (mileage proxy)
  headToHeadMarginDiffForHome: number | null; // avg historical margin from home team's perspective
}

export function buildMatchupFeatures(input: BuildFeaturesInput): MatchupFeatures {
  const { home, away } = input;

  const spOverallDiff =
    home.spOverall !== null && away.spOverall !== null ? home.spOverall - away.spOverall : null;

  const spOffenseVsDefenseDiff =
    home.spOffense !== null &&
    home.spDefense !== null &&
    away.spOffense !== null &&
    away.spDefense !== null
      ? home.spOffense - away.spDefense - (away.spOffense - home.spDefense)
      : null;

  const homeWinPct = recentFormWinPct(home);
  const awayWinPct = recentFormWinPct(away);
  const recentFormWinPctDiff = homeWinPct !== null && awayWinPct !== null ? homeWinPct - awayWinPct : null;

  const homeMargin = recentFormAvgMargin(home);
  const awayMargin = recentFormAvgMargin(away);
  const recentFormMarginDiff = homeMargin !== null && awayMargin !== null ? homeMargin - awayMargin : null;

  const homeTO = seasonTurnoverMarginPerGame(home);
  const awayTO = seasonTurnoverMarginPerGame(away);
  const turnoverMarginDiff = homeTO !== null && awayTO !== null ? homeTO - awayTO : null;

  const homeFieldPoints = input.neutralSite ? 0 : HOME_FIELD_POINTS;

  let restTravelPoints = 0;
  const w = MATCHUP_WEIGHTS.restTravel;
  const homeShort = isShortWeek(home);
  const awayShort = isShortWeek(away);
  const homeBye = isOffBye(home);
  const awayBye = isOffBye(away);
  if (homeShort && !awayShort) restTravelPoints -= w;
  if (awayShort && !homeShort) restTravelPoints += w;
  if (homeBye && !awayBye) restTravelPoints += w;
  if (awayBye && !homeBye) restTravelPoints -= w;
  if (input.crossConferenceRoadGame && !input.neutralSite) restTravelPoints += w * 0.5;

  return {
    spOverallDiff,
    spOffenseVsDefenseDiff,
    recentFormWinPctDiff,
    recentFormMarginDiff,
    turnoverMarginDiff,
    homeFieldPoints,
    restTravelPoints,
    headToHeadMarginDiff: input.headToHeadMarginDiffForHome,
  };
}
