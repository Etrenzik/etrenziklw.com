// Fits the market-implied win probability curve p = sigmoid(b + k*homeSpread)
// against several complete prior CFBD seasons, and writes the result to
// data/calibration.json so runtime code never re-fits the model.
//
// Usage: npm run calibrate

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { BACKTEST_SEASONS } from "../lib/model/config";
import { fitMarketLogistic } from "../lib/model/market";
import type { CalibrationFit } from "../lib/types";
import { fetchSeasonRawData, hasRawData, readSeasonRawData, writeSeasonRawData } from "./lib/fetchSeason";

async function main() {
  const samples: { homeSpread: number; homeWon: boolean }[] = [];

  for (const year of BACKTEST_SEASONS) {
    const raw = hasRawData(year) ? readSeasonRawData(year) : await fetchSeasonRawData(year);
    if (!hasRawData(year)) writeSeasonRawData(raw);

    let used = 0;
    for (const game of raw.games) {
      if (!game.completed || game.homePoints === null || game.awayPoints === null) continue;
      if (game.homePoints === game.awayPoints) continue; // ties are effectively nonexistent, skip defensively
      const line = raw.lines.get(game.id);
      if (!line || line.spread === null) continue;
      samples.push({ homeSpread: line.spread, homeWon: game.homePoints > game.awayPoints });
      used++;
    }
    console.log(`[calibrate] ${year}: ${used} games with a closing spread`);
  }

  if (samples.length < 100) {
    throw new Error(
      `[calibrate] only ${samples.length} usable (spread, result) samples found — refusing to fit on too little data. Check that /lines is returning spreads for these seasons.`
    );
  }

  const fitResult = fitMarketLogistic(samples);
  console.log(
    `[calibrate] fit k=${fitResult.k.toFixed(4)} b=${fitResult.b.toFixed(4)} logLoss=${fitResult.logLoss.toFixed(4)} over ${samples.length} games`
  );

  if (fitResult.k < 0.05 || fitResult.k > 0.4) {
    console.warn(
      `[calibrate] WARNING: fitted k=${fitResult.k.toFixed(4)} is well outside the expected ~0.14-0.19 range. Double-check the spread sign convention in scripts/lib/normalize.ts.`
    );
  }

  const calibration: CalibrationFit = {
    fittedAt: new Date().toISOString(),
    seasonsUsed: BACKTEST_SEASONS,
    sampleSize: samples.length,
    k: fitResult.k,
    b: fitResult.b,
    logLoss: fitResult.logLoss,
  };

  const outPath = path.join(process.cwd(), "data", "calibration.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(calibration, null, 2));
  console.log(`[calibrate] wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
