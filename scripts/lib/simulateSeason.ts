import { buildMatchupFeatures, recentFormAvgTotal, type TeamSeasonContext } from "../../lib/model/features";
import { computeGamePick } from "../../lib/model/pick";
import { computeSrs, type SrsGame } from "../../lib/model/srs";
import type { ModelConfig } from "../../lib/model/config";
import type { LogisticFit } from "../../lib/model/market";
import { columnIdFor } from "../../lib/data/columns";
import type { League } from "../../lib/leagues";
import type { GamePick, RawGame } from "../../lib/types";
import type { SeasonRawData } from "./fetchSeason";

interface TeamState extends TeamSeasonContext {
  lastGameDate: string | null;
}

function h2hMarginForHome(
  historicalGames: RawGame[],
  homeTeam: string,
  awayTeam: string,
  beforeDate: string
): number | null {
  const beforeTs = new Date(beforeDate).getTime();
  const meetings = historicalGames.filter(
    (g) =>
      g.completed &&
      g.homePoints !== null &&
      g.awayPoints !== null &&
      new Date(g.startDate).getTime() < beforeTs &&
      ((g.homeTeam === homeTeam && g.awayTeam === awayTeam) ||
        (g.homeTeam === awayTeam && g.awayTeam === homeTeam))
  );
  if (meetings.length === 0) return null;
  const margins = meetings.map((g) => {
    const hp = g.homePoints as number;
    const ap = g.awayPoints as number;
    return g.homeTeam === homeTeam ? hp - ap : ap - hp;
  });
  return margins.reduce((a, b) => a + b, 0) / margins.length;
}

function toSrsGame(g: RawGame): SrsGame {
  return {
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homePoints: g.homePoints as number,
    awayPoints: g.awayPoints as number,
    neutralSite: g.neutralSite,
  };
}

export interface SimulateSeasonOptions {
  raw: SeasonRawData;
  fit: LogisticFit;
  config: ModelConfig;
  league: League;
  /** Completed games from any season (including this one), used only for head-to-head lookups. */
  headToHeadGames: RawGame[];
  /**
   * NFL only: the previous season's completed games. Early-season SRS is
   * regressed toward the rating these produce, since two weeks of results is
   * not enough to rate a team. Ignored for CFB, which gets SP+ from CFBD.
   */
  priorSeasonGames?: RawGame[];
}

/**
 * Walks a season's games in chronological order, building each team's
 * "as of this game" context (power rating, last-5-game form, turnover
 * margin, rest days) from state accumulated so far, then computes a pick
 * for every game. Shared by scripts/compute-picks.mts (current season) and
 * scripts/backtest.mts (historical seasons) so both use identical logic.
 *
 * The power rating comes from a different place per league:
 *  - CFB reads CFBD's published SP+ for the season, held fixed all year.
 *  - NFL has no published point-scaled rating in the feed, so SRS is computed
 *    here from results, recomputed at each week boundary from only the games
 *    that had finished by then. Recomputing per week rather than per game is
 *    both cheaper and a more honest model of what a bettor knows on Sunday
 *    morning. It must never see the game it is being used to predict —
 *    that lookahead is what made an earlier CFB model look far stronger than
 *    it was (see lib/model/config.ts).
 */
export function simulateSeason(opts: SimulateSeasonOptions): GamePick[] {
  const { raw, fit, config, league, headToHeadGames } = opts;

  // NFL: prior-season ratings, computed once, used to regress early-season SRS.
  const priorRatings =
    league === "nfl" && opts.priorSeasonGames?.length
      ? computeSrs(
          opts.priorSeasonGames.filter((g) => g.completed && g.homePoints !== null).map(toSrsGame),
          { homeFieldPoints: config.homeFieldPoints }
        )
      : null;

  // NFL: ratings as of the current week, refreshed when the week rolls over.
  let srsRatings: Map<string, number> = priorRatings ?? new Map();
  const completedSoFar: RawGame[] = [];
  let ratingsWeekKey: string | null = null;

  const teamState = new Map<string, TeamState>();
  function getState(team: string): TeamState {
    let state = teamState.get(team);
    if (!state) {
      const sp = raw.spRatings.find((r) => r.team === team) ?? null;
      state = {
        spOverall: sp?.rating ?? null,
        spOffense: sp?.offenseRating ?? null,
        spDefense: sp?.defenseRating ?? null,
        priorGames: [],
        daysSinceLastGame: null,
        lastGameDate: null,
      };
      teamState.set(team, state);
    }
    return state;
  }

  const sortedGames = [...raw.games].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const picks: GamePick[] = [];

  for (const game of sortedGames) {
    if (league === "nfl") {
      const weekKey = `${game.seasonType}:${game.week}`;
      if (weekKey !== ratingsWeekKey) {
        srsRatings = computeSrs(completedSoFar.map(toSrsGame), {
          homeFieldPoints: config.homeFieldPoints,
          priorRatings,
        });
        ratingsWeekKey = weekKey;
      }
    }

    const homeState = getState(game.homeTeam);
    const awayState = getState(game.awayTeam);

    if (league === "nfl") {
      homeState.spOverall = srsRatings.get(game.homeTeam) ?? null;
      awayState.spOverall = srsRatings.get(game.awayTeam) ?? null;
    }

    const gameTs = new Date(game.startDate).getTime();
    // nflverse publishes rest days directly, which correctly handles byes and
    // international scheduling; CFB derives them from the previous kickoff.
    const homeDays =
      game.homeRestDays ??
      (homeState.lastGameDate
        ? Math.round((gameTs - new Date(homeState.lastGameDate).getTime()) / 86_400_000)
        : null);
    const awayDays =
      game.awayRestDays ??
      (awayState.lastGameDate
        ? Math.round((gameTs - new Date(awayState.lastGameDate).getTime()) / 86_400_000)
        : null);

    const features = buildMatchupFeatures(
      {
        home: {
          spOverall: homeState.spOverall,
          spOffense: homeState.spOffense,
          spDefense: homeState.spDefense,
          priorGames: homeState.priorGames,
          daysSinceLastGame: homeDays,
        },
        away: {
          spOverall: awayState.spOverall,
          spOffense: awayState.spOffense,
          spDefense: awayState.spDefense,
          priorGames: awayState.priorGames,
          daysSinceLastGame: awayDays,
        },
        neutralSite: game.neutralSite,
        // CFB uses a cross-conference road trip as a travel-distance proxy.
        // The NFL has no equivalent (every trip is a flight), so this stays off
        // and divisional familiarity is modeled through home-field instead.
        crossConferenceRoadGame:
          league === "cfb" && !game.neutralSite && game.homeConference !== game.awayConference,
        divisionGame: game.divisionGame ?? false,
        headToHeadMarginDiffForHome: h2hMarginForHome(
          headToHeadGames,
          game.homeTeam,
          game.awayTeam,
          game.startDate
        ),
      },
      config
    );

    const line = raw.lines.get(game.id) ?? null;
    const columnId = columnIdFor(game, league);

    const homeAvgTotal = recentFormAvgTotal(homeState);
    const awayAvgTotal = recentFormAvgTotal(awayState);
    const fallbackTotal =
      homeAvgTotal !== null && awayAvgTotal !== null
        ? (homeAvgTotal + awayAvgTotal) / 2
        : (homeAvgTotal ?? awayAvgTotal);

    const pick = computeGamePick({ game, columnId, line, features, fit, config, fallbackTotal });
    picks.push(pick);

    if (game.completed && game.homePoints !== null && game.awayPoints !== null) {
      const hp = game.homePoints;
      const ap = game.awayPoints;
      const homeTOCommitted = raw.turnoversCommittedByGameTeam.get(`${game.id}:${game.homeTeam}`);
      const awayTOCommitted = raw.turnoversCommittedByGameTeam.get(`${game.id}:${game.awayTeam}`);
      const bothKnown = homeTOCommitted !== undefined && awayTOCommitted !== undefined;

      homeState.priorGames.push({
        date: game.startDate,
        won: hp > ap,
        margin: hp - ap,
        totalPoints: hp + ap,
        turnoverMargin: bothKnown ? (awayTOCommitted as number) - (homeTOCommitted as number) : null,
      });
      awayState.priorGames.push({
        date: game.startDate,
        won: ap > hp,
        margin: ap - hp,
        totalPoints: hp + ap,
        turnoverMargin: bothKnown ? (homeTOCommitted as number) - (awayTOCommitted as number) : null,
      });
      homeState.lastGameDate = game.startDate;
      awayState.lastGameDate = game.startDate;
      completedSoFar.push(game);
    }
  }

  return picks;
}
