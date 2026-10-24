// Central tuning knobs for the prediction model. Nothing here should be a
// "magic number" buried in the computation code — change behavior by editing
// this file only.
//
// Both leagues run the same model; they differ only in the constants below and
// in which power rating feeds the matchup term (SP+ for CFB, a self-computed
// SRS for the NFL — see lib/model/srs.ts).

import type { League } from "../leagues";

export interface MatchupWeights {
  /** Points of margin per point of power-rating difference (SP+ / SRS). */
  powerRating: number;
  /** Secondary cross term: home offense vs away defense, and vice versa. */
  offenseVsDefense: number;
  /** Points per unit (0-1) of last-5 win% difference. */
  recentFormWinPct: number;
  /** Points per point of last-5 average scoring-margin difference. */
  recentFormMargin: number;
  /** Points per (turnovers/game) difference. */
  turnoverMargin: number;
  /** Flat points penalty per adverse rest/travel flag, applied per side. */
  restTravel: number;
  /** Points per point of historical head-to-head average margin difference. */
  headToHead: number;
}

export interface ModelConfig {
  league: League;
  /**
   * Weight given to the market-implied probability in the final blend.
   * (1 - blendMarketWeight) goes to the matchup-strength model.
   */
  blendMarketWeight: number;
  /** Home field advantage, in points added to the home side's implied margin. */
  homeFieldPoints: number;
  /**
   * Home field advantage for a divisional/in-conference rematch, where
   * familiarity measurably erodes the host's edge. NFL only; CFB leaves this
   * equal to homeFieldPoints.
   */
  divisionalHomeFieldPoints: number;
  /**
   * A pick is flagged as an "upset alert" when either the model disagrees with
   * the spread favorite, or it agrees but lands this close to a coin flip.
   * Expressed as a probability (0.05 = 5 percentage points from 50%).
   */
  upsetAlertProbGap: number;
  matchupWeights: MatchupWeights;
  /** Days of rest at or below which a team is on a "short week". */
  shortWeekMaxDays: number;
  /** Days of rest at or above which a team is "off a bye". */
  byeWeekMinDays: number;
  /** Seasons used to fit the market calibration curve and seed the backtest. */
  backtestSeasons: number[];
  /** Display name of the power rating, used in pick explanations. */
  ratingLabel: string;
}

/**
 * College football.
 *
 * blendMarketWeight was 0.6 (the original spec default), chosen against a
 * backtest that fed the model end-of-season SP+ ratings — i.e. ratings that
 * already reflected the games being predicted. Replaying 2022-2024 with
 * prior-season SP+ (what's actually knowable before kickoff), the matchup
 * model alone hit 70-72% vs. 74-77% for simply taking the Vegas favorite, and
 * SU accuracy rose steadily with market weight up to ~0.9, flat beyond. So the
 * market dominates; the matchup model is left as a small nudge for near-pick'em
 * games.
 *
 * Matchup weights are reasoned starting points, not fit against data (only the
 * market logistic slope `k` is empirically calibrated — see
 * data/calibration.json, produced by scripts/calibrate-market.mts):
 *  - powerRating: CFBD's SP+ overall rating is itself scaled in points of
 *    expected margin vs. an average team, so a ~1:1 weight is the natural
 *    starting point.
 *  - offenseVsDefense: a secondary, smaller-weighted cross term that captures
 *    matchup-specific mismatches SP+'s single overall number can wash out.
 *  - recentForm: weighted lightly since SP+ already reflects most of a team's
 *    season-long strength.
 *  - turnoverMargin: high-variance and only weakly predictive game to game.
 *  - headToHead: mostly noise for teams that rarely play, occasionally
 *    meaningful for long-running rivalries.
 */
export const CFB_CONFIG: ModelConfig = {
  league: "cfb",
  blendMarketWeight: 0.9,
  homeFieldPoints: 2.5,
  divisionalHomeFieldPoints: 2.5,
  upsetAlertProbGap: 0.05,
  matchupWeights: {
    powerRating: 1.0,
    offenseVsDefense: 0.35,
    recentFormWinPct: 3.0,
    recentFormMargin: 0.25,
    turnoverMargin: 1.5,
    restTravel: 1.5,
    headToHead: 0.15,
  },
  shortWeekMaxDays: 5,
  byeWeekMinDays: 12,
  backtestSeasons: [2019, 2021, 2022, 2023, 2024],
  ratingLabel: "SP+",
};

/**
 * Pro football.
 *
 * Differences from CFB, and why:
 *  - homeFieldPoints 1.8 rather than 2.5. NFL home-field advantage has eroded
 *    steadily — the ~3 points of received wisdom is a 1990s number. Recent
 *    seasons sit closer to 1.5-2.0, and the calibration fit's intercept `b`
 *    (see data/nfl/calibration.json) is the empirical check on this.
 *  - divisionalHomeFieldPoints 1.4. Division rivals play twice a year with
 *    deep familiarity and short travel, which measurably compresses the host's
 *    edge relative to a non-divisional visitor.
 *  - No offenseVsDefense term. The NFL power rating here is a self-computed
 *    SRS built from scores alone, so there is no offense/defense split to form
 *    a cross term from. The weight is 0 and the feature resolves to null,
 *    dropping out of the sum rather than contributing a guess.
 *  - recentForm weighted slightly higher than CFB. A 17-game NFL season with
 *    heavy roster/injury turnover makes "who is this team right now" a larger
 *    share of the signal than it is across 130+ college programs where talent
 *    gaps are enormous and stable.
 *  - headToHead weighted higher. Division opponents meet twice every season,
 *    so NFL head-to-head history is a real repeated matchup rather than the
 *    sparse, mostly-noise signal it is in college.
 *  - shortWeek 4 days (Thursday Night Football off a Sunday), bye 13 days.
 *    Unlike CFB these come from nflverse's explicit home_rest/away_rest fields
 *    rather than being derived from kickoff dates, so they also correctly
 *    capture byes and international-series scheduling.
 *
 * blendMarketWeight stays at 0.9, matching CFB. If anything the NFL market is
 * sharper than the college market — 16 games a week, enormous liquidity and
 * uniform public attention, versus a college slate where a Tuesday MAC game
 * gets a fraction of the handle. There is no reason to expect a
 * scores-and-schedule model to beat that line more often than SP+ beats the
 * college line; `npm run backtest -- --league=nfl` is the check.
 */
export const NFL_CONFIG: ModelConfig = {
  league: "nfl",
  blendMarketWeight: 0.9,
  homeFieldPoints: 1.8,
  divisionalHomeFieldPoints: 1.4,
  upsetAlertProbGap: 0.05,
  matchupWeights: {
    powerRating: 1.0,
    offenseVsDefense: 0,
    recentFormWinPct: 4.0,
    recentFormMargin: 0.3,
    turnoverMargin: 1.5,
    restTravel: 1.5,
    headToHead: 0.3,
  },
  shortWeekMaxDays: 4,
  byeWeekMinDays: 13,
  backtestSeasons: [2019, 2021, 2022, 2023, 2024],
  ratingLabel: "SRS",
};

const CONFIGS: Record<League, ModelConfig> = {
  cfb: CFB_CONFIG,
  nfl: NFL_CONFIG,
};

export function modelConfigFor(league: League): ModelConfig {
  return CONFIGS[league];
}
