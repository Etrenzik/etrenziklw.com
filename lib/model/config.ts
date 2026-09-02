// Central tuning knobs for the prediction model. Nothing here should be a
// "magic number" buried in the computation code — change behavior by editing
// this file only.

/**
 * Weight given to the market-implied probability in the final blend.
 * (1 - BLEND_MARKET_WEIGHT) goes to the matchup-strength model.
 * Spec default: 60% market / 40% matchup.
 */
export const BLEND_MARKET_WEIGHT = 0.6;

/** Home field advantage, in points added to the home side's implied margin. */
export const HOME_FIELD_POINTS = 2.5;

/**
 * A pick is flagged as an "upset alert" when either:
 *  - the model's pick differs from the spread favorite, or
 *  - the model agrees with the spread favorite but the win probability gap
 *    vs. a coin flip is under this threshold (a real toss-up).
 * Expressed as a probability (0.05 = 5 percentage points from 50%).
 */
export const UPSET_ALERT_PROB_GAP = 0.05;

/**
 * Feature weights for the matchup-strength model. All features are expressed
 * in "points of margin" (home minus away) before being summed and converted
 * to a win probability via the same market-calibrated logistic slope, so
 * units stay consistent and interpretable end to end.
 *
 * Defaults below are reasoned starting points, not fit against data (only
 * the market logistic slope `k` is empirically calibrated — see
 * data/calibration.json, produced by scripts/calibrate-market.mts):
 *  - spOverall: CFBD's SP+ overall rating is itself scaled in points of
 *    expected margin vs. an average team, so a ~1:1 weight is the natural
 *    starting point.
 *  - spOffenseVsDefense: a secondary, smaller-weighted cross term (home
 *    offense rating vs. away defense rating, and vice versa) that captures
 *    matchup-specific mismatches SP+'s single overall number can wash out.
 *  - recentForm: last-5-game win% and scoring margin, weighted lightly
 *    since SP+ already reflects most of a team's season-long strength.
 *  - turnoverMargin: turnovers are high-variance and only weakly
 *    predictive game to game, so this stays a small nudge.
 *  - restTravel: a flat points penalty per adverse flag (short week, long
 *    road trip) rather than a continuous feature.
 *  - headToHead: historical head-to-head margin, very lightly weighted —
 *    mostly noise for teams that rarely play, but occasionally meaningful
 *    for long-running rivalries.
 */
export const MATCHUP_WEIGHTS = {
  spOverall: 1.0,
  spOffenseVsDefense: 0.35,
  recentFormWinPct: 3.0, // points per unit (0-1) win% diff
  recentFormMargin: 0.25, // points per point of avg scoring margin diff
  turnoverMargin: 1.5, // points per (turnovers/game) diff
  restTravel: 1.5, // points penalty per flag, applied per side
  headToHead: 0.15, // points per point of historical avg margin diff
};

/** Seasons used to fit the market calibration curve and to seed the backtest/dashboard. */
export const BACKTEST_SEASONS = [2019, 2021, 2022, 2023, 2024];

/** A "long" road trip flag threshold isn't distance-based (CFBD doesn't give travel miles
 * directly); we approximate using conference mismatch + non-neutral away games as a proxy
 * in lib/model/restTravel.ts. Kept here for visibility/tuning. */
export const SHORT_WEEK_MAX_DAYS = 5;
export const BYE_WEEK_MIN_DAYS = 12;
