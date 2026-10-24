// Runs the prediction model over the current season's raw snapshot (written by
// scripts/fetch-data.mts for CFB, scripts/fetch-nfl-data.mts for the NFL) and
// produces the two JSON files the app reads at build time:
//   data/picks/<year>.json          data/nfl/picks/<year>.json
//   data/dashboard/<year>.json      data/nfl/dashboard/<year>.json
//
// Usage: npm run compute
//        npm run compute -- --league=nfl

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { modelConfigFor } from "../lib/model/config";
import { leagueMeta } from "../lib/leagues";
import { computeSeasonAccuracy } from "../lib/model/accuracy";
import { buildGridColumns } from "../lib/data/columns";
import { currentSeasonYear } from "../lib/data/season";
import type { SeasonGrid } from "../lib/types";
import { simulateSeason } from "./lib/simulateSeason";
import { dataRootFor, leagueFromArgv, loadCalibration, loadSeasonsIfPresent } from "./lib/loadSeason";

/**
 * Writes the grid only if something besides `generatedAt` actually changed.
 * Without this, `generatedAt` ticks every run even when the fetch step found
 * nothing new (e.g. skipped due to a CFBD quota), which turns every run into
 * a spurious commit + rebuild + redeploy.
 */
function writeGridIfChanged(filePath: string, grid: SeasonGrid) {
  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as SeasonGrid;
      const existingWithNewTimestamp = { ...existing, generatedAt: grid.generatedAt };
      if (JSON.stringify(existingWithNewTimestamp) === JSON.stringify(grid)) {
        console.log(`[compute-picks] ${path.relative(process.cwd(), filePath)} unchanged, leaving it as-is`);
        return;
      }
    } catch {
      // Existing file is missing/corrupt — fall through and write a fresh one.
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(grid, null, 2));
  console.log(
    `[compute-picks] wrote ${path.relative(process.cwd(), filePath)} (${grid.games.length} games)`
  );
}

async function main() {
  const league = leagueFromArgv();
  const config = modelConfigFor(league);
  const meta = leagueMeta(league);
  const year = currentSeasonYear();

  console.log(`[compute-picks] league=${meta.shortName} season=${year}`);

  const fit = loadCalibration(league);

  // The current season, plus (where already cached) the prior season — which
  // seeds the NFL's early-season SRS — and the backtest seasons, which widen
  // the head-to-head history. Only the current season is required; this reads
  // what is on disk and never fetches, so computing stays offline and, for
  // CFB, spends no CFBD quota.
  const wanted = [...new Set([year, year - 1, ...config.backtestSeasons.filter((y) => y !== year)])];
  const rawBySeason = loadSeasonsIfPresent(league, wanted);

  const raw = rawBySeason.get(year);
  if (!raw) {
    const cmd = league === "cfb" ? "npm run fetch" : "npm run fetch:nfl";
    throw new Error(`No raw data for ${year} on disk. Run \`${cmd}\` first.`);
  }
  const missing = wanted.filter((y) => y !== year && !rawBySeason.has(y));
  if (missing.length > 0) {
    console.log(`[compute-picks] no cached raw data for ${missing.join(", ")} — continuing without`);
  }

  const headToHeadGames = Array.from(rawBySeason.values()).flatMap((r) => r.games);

  const picks = simulateSeason({
    raw,
    fit,
    config,
    league,
    headToHeadGames,
    priorSeasonGames: rawBySeason.get(year - 1)?.games,
  });
  const columns = buildGridColumns(raw.games, league);

  const grid: SeasonGrid = {
    league,
    season: year,
    generatedAt: new Date().toISOString(),
    columns,
    teams: raw.teams,
    games: picks,
  };

  const root = dataRootFor(league);
  const picksDir = path.join(root, "picks");
  fs.mkdirSync(picksDir, { recursive: true });
  writeGridIfChanged(path.join(picksDir, `${year}.json`), grid);

  const accuracy = computeSeasonAccuracy(year, picks, raw.teams, league);
  const dashboardDir = path.join(root, "dashboard");
  fs.mkdirSync(dashboardDir, { recursive: true });
  fs.writeFileSync(path.join(dashboardDir, `${year}.json`), JSON.stringify(accuracy, null, 2));
  console.log(
    `[compute-picks] wrote ${path.relative(process.cwd(), path.join(dashboardDir, `${year}.json`))} ` +
      `(${accuracy.n} decided games, SU ${accuracy.suWins}-${accuracy.suLosses}, ` +
      `ATS ${accuracy.atsWins}-${accuracy.atsLosses})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
