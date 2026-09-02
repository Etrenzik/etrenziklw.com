import { buildMatchupFeatures, type TeamSeasonContext } from "../../lib/model/features";
import { computeGamePick } from "../../lib/model/pick";
import type { LogisticFit } from "../../lib/model/market";
import { columnIdFor } from "../../lib/data/columns";
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

export interface SimulateSeasonOptions {
  raw: SeasonRawData;
  fit: LogisticFit;
  /** Completed games from any season (including this one), used only for head-to-head lookups. */
  headToHeadGames: RawGame[];
}

/**
 * Walks a season's games in chronological order, building each team's
 * "as of this game" context (SP+ ratings, last-5-game form, turnover
 * margin, rest days) from state accumulated so far, then computes a pick
 * for every game. Shared by scripts/compute-picks.mts (current season) and
 * scripts/backtest.mts (historical seasons) so both use identical logic.
 */
export function simulateSeason(opts: SimulateSeasonOptions): GamePick[] {
  const { raw, fit, headToHeadGames } = opts;

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
    const homeState = getState(game.homeTeam);
    const awayState = getState(game.awayTeam);

    const gameTs = new Date(game.startDate).getTime();
    const homeDays = homeState.lastGameDate
      ? Math.round((gameTs - new Date(homeState.lastGameDate).getTime()) / 86_400_000)
      : null;
    const awayDays = awayState.lastGameDate
      ? Math.round((gameTs - new Date(awayState.lastGameDate).getTime()) / 86_400_000)
      : null;

    const features = buildMatchupFeatures({
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
      crossConferenceRoadGame: !game.neutralSite && game.homeConference !== game.awayConference,
      headToHeadMarginDiffForHome: h2hMarginForHome(
        headToHeadGames,
        game.homeTeam,
        game.awayTeam,
        game.startDate
      ),
    });

    const line = raw.lines.get(game.id) ?? null;
    const columnId = columnIdFor(game);
    const pick = computeGamePick({ game, columnId, line, features, fit });
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
        turnoverMargin: bothKnown ? (awayTOCommitted as number) - (homeTOCommitted as number) : null,
      });
      awayState.priorGames.push({
        date: game.startDate,
        won: ap > hp,
        margin: ap - hp,
        turnoverMargin: bothKnown ? (homeTOCommitted as number) - (awayTOCommitted as number) : null,
      });
      homeState.lastGameDate = game.startDate;
      awayState.lastGameDate = game.startDate;
    }
  }

  return picks;
}
