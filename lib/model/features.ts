import type { ModelConfig } from "./config";
import type { MatchupFeatures } from "../types";

export interface RecentGameResult {
  date: string;
  won: boolean;
  margin: number; // this team's points minus opponent's
  totalPoints: number; // this team's points plus opponent's (for the total-points/tiebreaker predictor)
  turnoverMargin: number | null; // takeaways minus giveaways, null if unknown
}

export interface TeamSeasonContext {
  /** Power rating: SP+ overall for CFB, SRS for the NFL. */
  spOverall: number | null;
  /** CFB only — the NFL's score-derived SRS has no offense/defense split. */
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

/** Average combined (both teams') points per game over the window — used as a
 * total-points fallback when no market over/under exists yet. */
export function recentFormAvgTotal(ctx: TeamSeasonContext, window = 5): number | null {
  const games = last(window, ctx.priorGames);
  return avg(games.map((g) => g.totalPoints));
}

export function seasonTurnoverMarginPerGame(ctx: TeamSeasonContext): number | null {
  const known = ctx.priorGames.filter((g) => g.turnoverMargin !== null) as (RecentGameResult & {
    turnoverMargin: number;
  })[];
  if (known.length === 0) return null;
  return avg(known.map((g) => g.turnoverMargin));
}

export function isShortWeek(ctx: TeamSeasonContext, config: ModelConfig): boolean {
  return ctx.daysSinceLastGame !== null && ctx.daysSinceLastGame <= config.shortWeekMaxDays;
}

export function isOffBye(ctx: TeamSeasonContext, config: ModelConfig): boolean {
  return ctx.daysSinceLastGame !== null && ctx.daysSinceLastGame >= config.byeWeekMinDays;
}

export interface BuildFeaturesInput {
  home: TeamSeasonContext;
  away: TeamSeasonContext;
  neutralSite: boolean;
  /** Away team on a true road, different-conference trip (a mileage proxy for CFB). */
  crossConferenceRoadGame: boolean;
  /** NFL: an in-division matchup, which carries a reduced home-field edge. */
  divisionGame?: boolean;
  headToHeadMarginDiffForHome: number | null; // avg historical margin from home team's perspective
}

export function buildMatchupFeatures(
  input: BuildFeaturesInput,
  config: ModelConfig
): MatchupFeatures {
  const { home, away } = input;

  const spOverallDiff =
    home.spOverall !== null && away.spOverall !== null ? home.spOverall - away.spOverall : null;

  // Only meaningful when the league's rating carries an offense/defense split
  // (CFB's SP+). With the weight at 0 the term would cancel anyway, but
  // returning null keeps the persisted feature honest about being absent.
  const spOffenseVsDefenseDiff =
    config.matchupWeights.offenseVsDefense !== 0 &&
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

  const homeFieldPoints = input.neutralSite
    ? 0
    : input.divisionGame
      ? config.divisionalHomeFieldPoints
      : config.homeFieldPoints;

  let restTravelPoints = 0;
  const w = config.matchupWeights.restTravel;
  const homeShort = isShortWeek(home, config);
  const awayShort = isShortWeek(away, config);
  const homeBye = isOffBye(home, config);
  const awayBye = isOffBye(away, config);
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
