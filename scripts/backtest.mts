// Backtests the model against several complete prior CFBD seasons and
// reports SU/ATS accuracy. This is what the calibration step fits against,
// and it seeds the history dashboard with real data on day one.
//
// Writes:
//   data/backtest/<year>.json   - per-season accuracy breakdown
//   data/backtest/summary.json  - combined accuracy across all backtest seasons
//
// Usage: npm run backtest

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { BACKTEST_SEASONS } from "../lib/model/config";
import { computeSeasonAccuracy } from "../lib/model/accuracy";
import type { CalibrationFit, GamePick, SeasonAccuracy, Team } from "../lib/types";
import { fetchSeasonRawData, hasRawData, readSeasonRawData, writeSeasonRawData } from "./lib/fetchSeason";
import { simulateSeason } from "./lib/simulateSeason";

function loadCalibration(): CalibrationFit {
  const p = path.join(process.cwd(), "data", "calibration.json");
  if (!fs.existsSync(p)) {
    throw new Error("data/calibration.json not found. Run `npm run calibrate` first.");
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const fit = loadCalibration();
  const outDir = path.join(process.cwd(), "data", "backtest");
  fs.mkdirSync(outDir, { recursive: true });

  const allPicks: GamePick[] = [];
  const allTeamsByName = new Map<string, Team>();
  const perSeason: SeasonAccuracy[] = [];

  // All backtest seasons' games are available for head-to-head lookups regardless
  // of which season is currently being simulated.
  const rawBySeason = new Map<number, Awaited<ReturnType<typeof fetchSeasonRawData>>>();
  for (const year of BACKTEST_SEASONS) {
    const raw = hasRawData(year) ? readSeasonRawData(year) : await fetchSeasonRawData(year);
    if (!hasRawData(year)) writeSeasonRawData(raw);
    rawBySeason.set(year, raw);
  }
  const headToHeadGames = Array.from(rawBySeason.values()).flatMap((r) => r.games);

  for (const year of BACKTEST_SEASONS) {
    const raw = rawBySeason.get(year)!;
    const picks = simulateSeason({ raw, fit, headToHeadGames });
    allPicks.push(...picks);
    for (const t of raw.teams) allTeamsByName.set(t.school, t);

    const accuracy = computeSeasonAccuracy(year, picks, raw.teams);
    perSeason.push(accuracy);
    fs.writeFileSync(path.join(outDir, `${year}.json`), JSON.stringify(accuracy, null, 2));
    console.log(
      `[backtest] ${year}: SU ${accuracy.suWins}-${accuracy.suLosses} (${(
        (accuracy.suWins / Math.max(1, accuracy.suWins + accuracy.suLosses)) *
        100
      ).toFixed(1)}%) | ATS ${accuracy.atsWins}-${accuracy.atsLosses}-${accuracy.atsPushes}`
    );
  }

  const combined = computeSeasonAccuracy(0, allPicks, Array.from(allTeamsByName.values()));
  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify({ seasons: BACKTEST_SEASONS, combined, perSeason }, null, 2)
  );
  console.log(
    `[backtest] combined ${BACKTEST_SEASONS.join(", ")}: SU ${combined.suWins}-${combined.suLosses} | ATS ${combined.atsWins}-${combined.atsLosses}-${combined.atsPushes}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
