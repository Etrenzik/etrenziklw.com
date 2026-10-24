import fs from "node:fs";
import path from "node:path";
import { leagueMeta, type League } from "../leagues";
import type { SeasonAccuracy, SeasonGrid } from "../types";

const DATA_ROOT = path.join(process.cwd(), "data");

/**
 * CFB is the site's original league and keeps the flat layout it has always
 * had (`data/picks/2026.json`), so adding the NFL moved none of its files and
 * the refresh workflow's commit paths are unchanged. The NFL nests one level
 * deeper under `data/nfl/`.
 */
function leagueRoot(league: League): string {
  const dir = leagueMeta(league).dataDir;
  return dir ? path.join(DATA_ROOT, dir) : DATA_ROOT;
}

function readJson<T>(league: League, relPath: string): T | null {
  const p = path.join(leagueRoot(league), relPath);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

export interface BacktestSummary {
  league: League;
  seasons: number[];
  combined: SeasonAccuracy;
  perSeason: SeasonAccuracy[];
}

export function getSeasonGrid(year: number, league: League = "cfb"): SeasonGrid | null {
  return readJson<SeasonGrid>(league, `picks/${year}.json`);
}

export function getDashboard(year: number, league: League = "cfb"): SeasonAccuracy | null {
  return readJson<SeasonAccuracy>(league, `dashboard/${year}.json`);
}

export function getBacktestSummary(league: League = "cfb"): BacktestSummary | null {
  return readJson<BacktestSummary>(league, "backtest/summary.json");
}

export function listPickSeasons(league: League = "cfb"): number[] {
  const dir = path.join(leagueRoot(league), "picks");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => Number(f.replace(".json", "")))
    .sort((a, b) => b - a);
}

/** Absolute path to a league's data directory, for the write-side scripts. */
export function leagueDataRoot(league: League): string {
  return leagueRoot(league);
}
