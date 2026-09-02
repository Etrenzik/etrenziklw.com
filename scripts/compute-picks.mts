// Runs the prediction model over the current season's raw CFBD snapshot
// (written by scripts/fetch-data.mts) and produces the two JSON files the
// app reads at build time:
//   data/picks/<year>.json      - full season grid (every game + pick)
//   data/dashboard/<year>.json  - accuracy breakdowns for the dashboard
//
// Usage: npm run compute

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { BACKTEST_SEASONS } from "../lib/model/config";
import { computeSeasonAccuracy } from "../lib/model/accuracy";
import { buildGridColumns } from "../lib/data/columns";
import { currentSeasonYear } from "../lib/data/season";
import type { CalibrationFit, SeasonGrid } from "../lib/types";
import { hasRawData, readSeasonRawData } from "./lib/fetchSeason";
import { simulateSeason } from "./lib/simulateSeason";

function loadCalibration(): CalibrationFit {
  const p = path.join(process.cwd(), "data", "calibration.json");
  if (!fs.existsSync(p)) {
    throw new Error(
      "data/calibration.json not found. Run `npm run calibrate` first to fit the market model against prior seasons."
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const year = currentSeasonYear();
  if (!hasRawData(year)) {
    throw new Error(`No raw data for ${year} on disk. Run \`npm run fetch\` first.`);
  }

  const fit = loadCalibration();
  const raw = readSeasonRawData(year);

  const headToHeadGames = [...raw.games];
  for (const backtestYear of BACKTEST_SEASONS) {
    if (backtestYear === year) continue;
    if (hasRawData(backtestYear)) {
      headToHeadGames.push(...readSeasonRawData(backtestYear).games);
    }
  }

  const picks = simulateSeason({ raw, fit, headToHeadGames });
  const columns = buildGridColumns(raw.games);

  const grid: SeasonGrid = {
    season: year,
    generatedAt: new Date().toISOString(),
    columns,
    teams: raw.teams,
    games: picks,
  };

  const picksDir = path.join(process.cwd(), "data", "picks");
  fs.mkdirSync(picksDir, { recursive: true });
  fs.writeFileSync(path.join(picksDir, `${year}.json`), JSON.stringify(grid, null, 2));
  console.log(`[compute-picks] wrote data/picks/${year}.json (${picks.length} games)`);

  const accuracy = computeSeasonAccuracy(year, picks, raw.teams);
  const dashboardDir = path.join(process.cwd(), "data", "dashboard");
  fs.mkdirSync(dashboardDir, { recursive: true });
  fs.writeFileSync(path.join(dashboardDir, `${year}.json`), JSON.stringify(accuracy, null, 2));
  console.log(
    `[compute-picks] wrote data/dashboard/${year}.json (${accuracy.n} decided games, SU ${accuracy.suWins}-${accuracy.suLosses})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
