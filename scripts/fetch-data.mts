// Pulls the current season's teams/games/lines/ratings from CFBD and writes
// raw JSON snapshots to data/raw/<year>/. Run daily during the season (see
// .github/workflows/refresh-and-deploy.yml); safe to re-run any time.
//
// Usage: npm run fetch

import "dotenv/config";
import { isQuotaExceededError } from "../lib/cfbd/client";
import { currentSeasonYear } from "../lib/data/season";
import { fetchSeasonRawData, hasRawData, readSeasonRawData, writeSeasonRawData } from "./lib/fetchSeason";

async function main() {
  const year = currentSeasonYear();
  console.log(`[fetch-data] current season resolved to ${year}`);
  const previous = hasRawData(year) ? readSeasonRawData(year) : undefined;
  const raw = await fetchSeasonRawData(year, previous);
  writeSeasonRawData(raw);
}

main().catch((err) => {
  if (isQuotaExceededError(err)) {
    // CFBD's monthly call quota is exhausted — this isn't a bug to retry on
    // the next scheduled run, it's a hard wall until CFBD resets it. Exit
    // successfully (skipping this refresh) so the workflow doesn't show a
    // red X — and page/spam attention — on every run for the rest of the
    // month. The site keeps serving the last successfully fetched data.
    console.warn(
      "[fetch-data] CFBD monthly call quota exceeded — skipping this refresh. " +
        "The site will keep serving the last successfully fetched data until the quota resets."
    );
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
