import fs from "node:fs";
import path from "node:path";
import * as cfbd from "../../lib/cfbd/client";
import {
  normalizeTeam,
  normalizeGame,
  normalizeLine,
  normalizeRecord,
  normalizeSPRating,
} from "./normalize";
import type { RawGame, RawLine, Team, TeamRecord, SPRating } from "../../lib/types";

export interface SeasonRawData {
  year: number;
  teams: Team[];
  games: RawGame[];
  lines: Map<number, RawLine>; // gameId -> line
  records: TeamRecord[];
  spRatings: SPRating[];
  /** `${gameId}:${team}` -> turnovers committed by that team in that game (raw count). */
  turnoversCommittedByGameTeam: Map<string, number>;
}

const DATA_ROOT = path.join(process.cwd(), "data", "raw");

export async function fetchSeasonRawData(year: number): Promise<SeasonRawData> {
  console.log(`[fetch] season ${year}: teams, games, lines, records, SP+ ratings...`);
  const [teamsRaw, gamesRaw, linesRaw, recordsRaw, spRaw] = await Promise.all([
    cfbd.getFbsTeams(year),
    cfbd.getGames({ year, seasonType: "both" }),
    cfbd.getLines({ year, seasonType: "both" }),
    cfbd.getRecords(year),
    cfbd.getSPRatings(year),
  ]);

  const teams = teamsRaw.map(normalizeTeam);

  // CFBD's /games endpoint isn't scoped by classification, so with no team/conference
  // filter it returns every NCAA division's games (FBS, FCS, D2, D3 — several times the
  // ~800-900 actual FBS games per season). Keep only games with at least one FBS side.
  const fbsTeamNames = new Set(teams.map((t) => t.school));
  const games = gamesRaw
    .filter((g) => fbsTeamNames.has(g.homeTeam) || fbsTeamNames.has(g.awayTeam))
    .map(normalizeGame);

  const lines = new Map<number, RawLine>();
  for (const lg of linesRaw) {
    const nl = normalizeLine(lg);
    if (nl) lines.set(lg.id, nl);
  }

  const records = recordsRaw.map(normalizeRecord);
  const spRatings = spRaw.map(normalizeSPRating);

  // /games/teams 400s unless scoped by week (or team/conference), so fetch it one
  // week at a time using the (seasonType, week) pairs that actually occur in this
  // season's schedule, then merge.
  const turnoversCommittedByGameTeam = new Map<string, number>();
  const weekKeys = new Map<string, { seasonType: "regular" | "postseason"; week: number }>();
  for (const g of games) {
    weekKeys.set(`${g.seasonType}:${g.week}`, { seasonType: g.seasonType, week: g.week });
  }

  const gameTeamResults = await Promise.allSettled(
    Array.from(weekKeys.values()).map((wk) =>
      cfbd.getGameTeamStats({ year, seasonType: wk.seasonType, week: wk.week })
    )
  );

  let turnoverFetchFailures = 0;
  for (const result of gameTeamResults) {
    if (result.status === "rejected") {
      turnoverFetchFailures++;
      continue;
    }
    for (const gt of result.value) {
      for (const teamEntry of gt.teams ?? []) {
        const stat = teamEntry.stats?.find((s) => s.category.toLowerCase() === "turnovers");
        if (stat) {
          const n = Number(stat.stat);
          if (!Number.isNaN(n)) turnoversCommittedByGameTeam.set(`${gt.id}:${teamEntry.team}`, n);
        }
      }
    }
  }
  if (turnoverFetchFailures > 0) {
    console.warn(
      `[fetch] game-team stats (turnovers) failed for ${turnoverFetchFailures}/${weekKeys.size} week(s) in ${year}; those games will skip the turnover-margin feature.`
    );
  }

  console.log(
    `[fetch] season ${year}: ${teams.length} teams, ${games.length} games, ${lines.size} lines, ${spRatings.length} SP+ ratings, ${turnoversCommittedByGameTeam.size} turnover entries`
  );

  return { year, teams, games, lines, records, spRatings, turnoversCommittedByGameTeam };
}

export function writeSeasonRawData(data: SeasonRawData) {
  const dir = path.join(DATA_ROOT, String(data.year));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "teams.json"), JSON.stringify(data.teams, null, 2));
  fs.writeFileSync(path.join(dir, "games.json"), JSON.stringify(data.games, null, 2));
  fs.writeFileSync(
    path.join(dir, "lines.json"),
    JSON.stringify(Array.from(data.lines.entries()), null, 2)
  );
  fs.writeFileSync(path.join(dir, "records.json"), JSON.stringify(data.records, null, 2));
  fs.writeFileSync(path.join(dir, "sp-ratings.json"), JSON.stringify(data.spRatings, null, 2));
  fs.writeFileSync(
    path.join(dir, "turnovers.json"),
    JSON.stringify(Array.from(data.turnoversCommittedByGameTeam.entries()), null, 2)
  );
  console.log(`[fetch] wrote raw snapshots for ${data.year} -> ${dir}`);
}

export function readSeasonRawData(year: number): SeasonRawData {
  const dir = path.join(DATA_ROOT, String(year));
  const teams: Team[] = JSON.parse(fs.readFileSync(path.join(dir, "teams.json"), "utf8"));
  const games: RawGame[] = JSON.parse(fs.readFileSync(path.join(dir, "games.json"), "utf8"));
  const linesEntries: [number, RawLine][] = JSON.parse(
    fs.readFileSync(path.join(dir, "lines.json"), "utf8")
  );
  const records: TeamRecord[] = JSON.parse(fs.readFileSync(path.join(dir, "records.json"), "utf8"));
  const spRatings: SPRating[] = JSON.parse(
    fs.readFileSync(path.join(dir, "sp-ratings.json"), "utf8")
  );
  const turnoversEntries: [string, number][] = JSON.parse(
    fs.readFileSync(path.join(dir, "turnovers.json"), "utf8")
  );
  return {
    year,
    teams,
    games,
    lines: new Map(linesEntries),
    records,
    spRatings,
    turnoversCommittedByGameTeam: new Map(turnoversEntries),
  };
}

export function hasRawData(year: number): boolean {
  return fs.existsSync(path.join(DATA_ROOT, String(year), "games.json"));
}
