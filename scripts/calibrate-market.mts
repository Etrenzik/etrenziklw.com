// Fits the market-implied win probability curve p = sigmoid(b + k*homeSpread)
// against several complete prior seasons, and writes the result so runtime
// code never re-fits the model.
//
// Writes:
//   data/calibration.json      (CFB)
//   data/nfl/calibration.json  (NFL)
//
// Usage: npm run calibrate
//        npm run calibrate -- --league=nfl

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { modelConfigFor } from "../lib/model/config";
import { leagueMeta } from "../lib/leagues";
import { fitMarketLogistic } from "../lib/model/market";
import type { CalibrationFit } from "../lib/types";
import { calibrationPathFor, ensureSeasonsRaw, leagueFromArgv } from "./lib/loadSeason";

async function main() {
  const league = leagueFromArgv();
  const config = modelConfigFor(league);
  const meta = leagueMeta(league);
  const seasons = config.backtestSeasons;

  console.log(`[calibrate] league=${meta.shortName} seasons=${seasons.join(", ")}`);

  const rawBySeason = await ensureSeasonsRaw(league, seasons);
  const samples: { homeSpread: number; homeWon: boolean }[] = [];

  for (const year of seasons) {
    const raw = rawBySeason.get(year);
    if (!raw) {
      console.warn(`[calibrate] ${year}: no data available, skipping`);
      continue;
    }

    let used = 0;
    for (const game of raw.games) {
      if (!game.completed || game.homePoints === null || game.awayPoints === null) continue;
      if (game.homePoints === game.awayPoints) continue; // ties are rare; skip defensively
      const line = raw.lines.get(game.id);
      if (!line || line.spread === null) continue;
      samples.push({ homeSpread: line.spread, homeWon: game.homePoints > game.awayPoints });
      used++;
    }
    console.log(`[calibrate] ${year}: ${used} games with a closing spread`);
  }

  if (samples.length < 100) {
    throw new Error(
      `[calibrate] only ${samples.length} usable (spread, result) samples found — refusing to fit on too little data.`
    );
  }

  const fitResult = fitMarketLogistic(samples);
  console.log(
    `[calibrate] fit k=${fitResult.k.toFixed(4)} b=${fitResult.b.toFixed(4)} logLoss=${fitResult.logLoss.toFixed(4)} over ${samples.length} games`
  );

  // k is the logistic slope in probability-per-point-of-spread. A badly wrong
  // sign convention upstream shows up here first, as a negative or absurd k.
  if (fitResult.k < 0.05 || fitResult.k > 0.4) {
    const normalizer = league === "cfb" ? "scripts/lib/normalize.ts" : "scripts/lib/normalizeNfl.ts";
    console.warn(
      `[calibrate] WARNING: fitted k=${fitResult.k.toFixed(4)} is well outside the expected ~0.14-0.19 range. ` +
        `Double-check the spread sign convention in ${normalizer}.`
    );
  }
  // b is the intercept: the home team's edge at a pick'em line, in logit units.
  // For the NFL it is the empirical check on homeFieldPoints in lib/model/config.ts.
  console.log(
    `[calibrate] implied home-field edge at a pick'em line: ${(fitResult.b / fitResult.k).toFixed(2)} pts`
  );

  const calibration: CalibrationFit = {
    fittedAt: new Date().toISOString(),
    seasonsUsed: seasons,
    sampleSize: samples.length,
    k: fitResult.k,
    b: fitResult.b,
    logLoss: fitResult.logLoss,
  };

  const outPath = calibrationPathFor(league);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(calibration, null, 2));
  console.log(`[calibrate] wrote ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
