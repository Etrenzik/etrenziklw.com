// SRS (Simple Rating System) power ratings for the NFL.
//
// CFB gets its power rating handed to it by CFBD (SP+). There is no equivalent
// free, pre-computed, point-scaled NFL rating in the nflverse feed, so we
// compute one from scores.
//
// SRS is the standard construction: a team's rating is its average scoring
// margin plus the average rating of the opponents it played, solved by
// iteration until the ratings stop moving. The result is expressed in points
// of expected margin against an average team — the same unit SP+ uses, which
// is what lets both leagues share one matchup model and one set of weights.
//
// Two deliberate departures from textbook SRS:
//
//  1. Margins are capped. An uncapped SRS rewards running up the score, and a
//     single 45-point blowout drags a rating for the rest of the year. Capping
//     keeps the rating a measure of "how good", not "how lopsided".
//
//  2. Early-season ratings are regressed toward the prior season. Through the
//     first few weeks a team's own-season SRS is nearly noise — a 2-0 team
//     that beat two bad opponents by 3 is not a +20 team. The blend weight is
//     n / (n + priorWeightGames), so prior-season information fades out as the
//     current season accumulates evidence.
//
// Crucially, callers must only ever pass games that finished BEFORE the game
// being predicted. Feeding this full-season results and then "predicting" those
// same games is the lookahead mistake that made an earlier version of the CFB
// model look far better than it was (see lib/model/config.ts).

export interface SrsGame {
  homeTeam: string;
  awayTeam: string;
  homePoints: number;
  awayPoints: number;
  neutralSite: boolean;
}

export interface SrsOptions {
  /** Points of home-field advantage to remove before measuring margin. */
  homeFieldPoints: number;
  /** Absolute value at which a scoring margin is truncated. */
  marginCap?: number;
  iterations?: number;
  /** Ratings from the prior season, for early-season regression. */
  priorRatings?: Map<string, number> | null;
  /** Games of evidence at which the current season and the prior are weighted equally. */
  priorWeightGames?: number;
}

const DEFAULT_MARGIN_CAP = 24;
const DEFAULT_ITERATIONS = 60;
const DEFAULT_PRIOR_WEIGHT_GAMES = 6;

/**
 * Solves SRS over the supplied completed games.
 *
 * Returns a rating per team, centered on 0 (an average team rates 0, so the
 * difference between two ratings reads directly as an expected neutral-field
 * margin). Teams with no games get no entry — callers treat a missing rating
 * as null and the feature drops out rather than being imputed.
 */
export function computeSrs(games: SrsGame[], opts: SrsOptions): Map<string, number> {
  const cap = opts.marginCap ?? DEFAULT_MARGIN_CAP;
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const priorWeightGames = opts.priorWeightGames ?? DEFAULT_PRIOR_WEIGHT_GAMES;

  // Per team: their capped, home-field-adjusted margins and the opponents faced.
  const margins = new Map<string, number[]>();
  const opponents = new Map<string, string[]>();

  const push = (team: string, margin: number, opponent: string) => {
    const m = margins.get(team) ?? [];
    m.push(margin);
    margins.set(team, m);
    const o = opponents.get(team) ?? [];
    o.push(opponent);
    opponents.set(team, o);
  };

  for (const g of games) {
    // Remove home-field advantage so the margin reflects team quality, not venue.
    const hfa = g.neutralSite ? 0 : opts.homeFieldPoints;
    const rawHomeMargin = g.homePoints - g.awayPoints - hfa;
    const homeMargin = Math.max(-cap, Math.min(cap, rawHomeMargin));
    push(g.homeTeam, homeMargin, g.awayTeam);
    push(g.awayTeam, -homeMargin, g.homeTeam);
  }

  const teams = Array.from(margins.keys());
  if (teams.length === 0) return new Map();

  const avgMargin = new Map<string, number>();
  for (const t of teams) {
    const m = margins.get(t) as number[];
    avgMargin.set(t, m.reduce((a, b) => a + b, 0) / m.length);
  }

  // Iterate rating = own average margin + average opponent rating, until stable.
  let ratings = new Map<string, number>(teams.map((t) => [t, avgMargin.get(t) as number]));
  for (let i = 0; i < iterations; i++) {
    const next = new Map<string, number>();
    for (const t of teams) {
      const opps = opponents.get(t) as string[];
      const sos = opps.reduce((sum, o) => sum + (ratings.get(o) ?? 0), 0) / opps.length;
      next.set(t, (avgMargin.get(t) as number) + sos);
    }
    // Re-center on zero each pass; without this the whole scale can drift.
    const mean = Array.from(next.values()).reduce((a, b) => a + b, 0) / next.size;
    for (const [t, r] of next) next.set(t, r - mean);
    ratings = next;
  }

  if (!opts.priorRatings || opts.priorRatings.size === 0) return ratings;

  // Regress toward the prior season while the current one is still thin.
  const blended = new Map<string, number>();
  for (const t of teams) {
    const n = (margins.get(t) as number[]).length;
    const prior = opts.priorRatings.get(t);
    const current = ratings.get(t) as number;
    if (prior === undefined) {
      blended.set(t, current);
      continue;
    }
    const wCurrent = n / (n + priorWeightGames);
    blended.set(t, wCurrent * current + (1 - wCurrent) * prior);
  }

  // A team with prior-season history but no games yet this season still has a
  // usable rating — carry the prior forward rather than leaving it unrated.
  for (const [t, prior] of opts.priorRatings) {
    if (!blended.has(t)) blended.set(t, prior);
  }

  return blended;
}
