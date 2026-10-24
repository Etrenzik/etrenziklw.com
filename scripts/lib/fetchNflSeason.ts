import fs from "node:fs";
import path from "node:path";
import * as nfl from "../../lib/nfl/client";
import {
  assertUniqueIds,
  normalizeNflGame,
  normalizeNflLine,
  normalizeNflTeam,
} from "./normalizeNfl";
import type { RawGame, RawLine, Team } from "../../lib/types";
import type { SeasonRawData } from "./fetchSeason";

const DATA_ROOT = path.join(process.cwd(), "data", "nfl", "raw");

/**
 * nflverse ships one CSV covering every season since 1999, so a single
 * download serves the current season, the prior season (needed to seed SRS)
 * and every backtest season at once. `fetchAllNflSeasons` does that download
 * and then slices it per season.
 */
export interface NflFetchResult {
  teams: Team[];
  /** season -> that season's raw data, keyed the same way the CFB pipeline is. */
  bySeason: Map<number, SeasonRawData>;
}

export async function fetchAllNflSeasons(seasons: number[]): Promise<NflFetchResult> {
  console.log(`[fetch-nfl] downloading nflverse games + team metadata...`);
  const [gameRows, teamRows] = await Promise.all([nfl.getAllGames(), nfl.getTeams()]);

  const teams = teamRows.map(normalizeNflTeam);
  const abbrToName = new Map(teams.map((t) => [t.abbreviation as string, t.school]));
  const nameToTeam = new Map(teams.map((t) => [t.school, t]));

  const wanted = new Set(seasons);
  const bySeason = new Map<number, SeasonRawData>();

  for (const season of seasons) {
    const rows = gameRows.filter((r) => Number(r.season) === season);
    if (rows.length === 0) {
      console.warn(`[fetch-nfl] season ${season}: no rows in the feed, skipping`);
      continue;
    }

    const games: RawGame[] = [];
    const lines = new Map<number, RawLine>();
    const usedAbbrs = new Set<string>();

    for (const r of rows) {
      usedAbbrs.add(r.home_team);
      usedAbbrs.add(r.away_team);
      const game = normalizeNflGame(r, abbrToName);
      // Conference is team metadata, not per-game data, so fill it from the
      // team table — the grid and the by-conference breakdown both read it.
      game.homeConference = nameToTeam.get(game.homeTeam)?.conference ?? null;
      game.awayConference = nameToTeam.get(game.awayTeam)?.conference ?? null;
      games.push(game);

      const line = normalizeNflLine(r, game.id, game.homeTeam, game.awayTeam);
      if (line) lines.set(game.id, line);
    }

    assertUniqueIds(games);

    // Only teams that actually appear this season. The team table spans all of
    // league history, so relocated franchises appear under several codes
    // (OAK/LV, SD/LAC, STL/LA) and listing one that played no games would
    // render an empty grid row.
    //
    // This filters by ABBREVIATION, not by name: the Rams have two live codes
    // in the table ("LA" and "LAR") that share the display name
    // "Los Angeles Rams", so a name-based filter keeps both and the grid grows
    // a duplicate Rams row. Games reference exactly one of them.
    const seasonTeams: Team[] = [];
    const seenName = new Set<string>();
    for (const t of teams) {
      if (!t.abbreviation || !usedAbbrs.has(t.abbreviation)) continue;
      if (seenName.has(t.school)) continue;
      seenName.add(t.school);
      seasonTeams.push(t);
    }

    bySeason.set(season, {
      year: season,
      teams: seasonTeams,
      games,
      lines,
      // The NFL model takes none of these: SRS is computed from scores in
      // lib/model/srs.ts, and nflverse's games feed carries no box-score
      // turnover counts, so that feature resolves to null and drops out.
      records: [],
      spRatings: [],
      turnoversCommittedByGameTeam: new Map(),
    });

    const completed = games.filter((g) => g.completed).length;
    console.log(
      `[fetch-nfl] season ${season}: ${games.length} games (${completed} completed), ` +
        `${lines.size} lines, ${seasonTeams.length} teams`
    );
  }

  if (wanted.size !== bySeason.size) {
    console.warn(
      `[fetch-nfl] requested ${wanted.size} season(s), got ${bySeason.size} — ` +
        `missing seasons are likely not yet in the feed.`
    );
  }

  return { teams, bySeason };
}

export function writeNflSeasonRawData(data: SeasonRawData) {
  const dir = path.join(DATA_ROOT, String(data.year));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "teams.json"), JSON.stringify(data.teams, null, 2));
  fs.writeFileSync(path.join(dir, "games.json"), JSON.stringify(data.games, null, 2));
  fs.writeFileSync(
    path.join(dir, "lines.json"),
    JSON.stringify(Array.from(data.lines.entries()), null, 2)
  );
  console.log(`[fetch-nfl] wrote raw snapshots for ${data.year} -> ${dir}`);
}

export function readNflSeasonRawData(year: number): SeasonRawData {
  const dir = path.join(DATA_ROOT, String(year));
  const teams: Team[] = JSON.parse(fs.readFileSync(path.join(dir, "teams.json"), "utf8"));
  const games: RawGame[] = JSON.parse(fs.readFileSync(path.join(dir, "games.json"), "utf8"));
  const linesEntries: [number, RawLine][] = JSON.parse(
    fs.readFileSync(path.join(dir, "lines.json"), "utf8")
  );
  return {
    year,
    teams,
    games,
    lines: new Map(linesEntries),
    records: [],
    spRatings: [],
    turnoversCommittedByGameTeam: new Map(),
  };
}

export function hasNflRawData(year: number): boolean {
  return fs.existsSync(path.join(DATA_ROOT, String(year), "games.json"));
}
