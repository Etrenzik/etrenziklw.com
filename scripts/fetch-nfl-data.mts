// Pulls NFL schedules, scores and closing lines from nflverse and writes raw
// JSON snapshots to data/nfl/raw/<year>/. The CFB counterpart is
// scripts/fetch-data.mts.
//
// Unlike CFBD this needs no API key and has no monthly call quota — nflverse
// publishes plain CSV from GitHub — so there is no quota-exhaustion path to
// handle and the whole history comes down in one request.
//
// Usage: npm run fetch:nfl

import { currentSeasonYear } from "../lib/data/season";
import { modelConfigFor } from "../lib/model/config";
import { fetchAllNflSeasons, writeNflSeasonRawData } from "./lib/fetchNflSeason";

async function main() {
  const year = currentSeasonYear();
  const config = modelConfigFor("nfl");

  // Refresh the current season every run; also pull the prior season (seeds
  // early-season SRS) and the backtest seasons the first time through. Those
  // are finished and immutable, so re-downloading them costs one HTTP request
  // against a static file and keeps the snapshot self-healing if a file is
  // deleted.
  const seasons = [
    ...new Set([year, year - 1, ...config.backtestSeasons.flatMap((y) => [y - 1, y])]),
  ].sort((a, b) => a - b);

  console.log(`[fetch-nfl] current season resolved to ${year}`);
  const { bySeason } = await fetchAllNflSeasons(seasons);

  if (!bySeason.has(year)) {
    throw new Error(
      `[fetch-nfl] nflverse returned no rows for ${year}. If the season has not been scheduled yet, ` +
        `this is expected — rerun once the schedule is published.`
    );
  }

  for (const raw of bySeason.values()) {
    writeNflSeasonRawData(raw);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
