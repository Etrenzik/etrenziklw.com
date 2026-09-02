// Pulls the current season's teams/games/lines/ratings from CFBD and writes
// raw JSON snapshots to data/raw/<year>/. Run daily during the season (see
// .github/workflows/refresh-and-deploy.yml); safe to re-run any time.
//
// Usage: npm run fetch

import "dotenv/config";
import { currentSeasonYear } from "../lib/data/season";
import { fetchSeasonRawData, writeSeasonRawData } from "./lib/fetchSeason";

async function main() {
  const year = currentSeasonYear();
  console.log(`[fetch-data] current season resolved to ${year}`);
  const raw = await fetchSeasonRawData(year);
  writeSeasonRawData(raw);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
