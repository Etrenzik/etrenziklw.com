// Backtests the model against several complete prior seasons and reports
// SU/ATS accuracy. This is what the calibration step fits against, and it
// seeds the history dashboard with real data on day one.
//
// Writes:
//   data/backtest/<year>.json       data/nfl/backtest/<year>.json
//   data/backtest/summary.json      data/nfl/backtest/summary.json
//
// Usage: npm run backtest
//        npm run backtest -- --league=nfl

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getSPRatings } from "../lib/cfbd/client";
import { modelConfigFor } from "../lib/model/config";
import { leagueMeta, type League } from "../lib/leagues";
import { computeSeasonAccuracy } from "../lib/model/accuracy";
import type { GamePick, SeasonAccuracy, SPRating, Team } from "../lib/types";
import { normalizeSPRating } from "./lib/normalize";
import { simulateSeason } from "./lib/simulateSeason";
import { dataRootFor, ensureSeasonsRaw, leagueFromArgv, loadCalibration } from "./lib/loadSeason";

/**
 * CFB only. CFBD's /ratings/sp serves end-of-season ratings, which already
 * reflect the games being backtested — feeding those in made the matchup model
 * look ~2-5 points better than it really is. The prior season's final SP+ is
 * what was actually knowable before a season kicked off, so the backtest uses
 * that.
 *
 * The NFL has no equivalent hazard here: its rating is SRS computed inside
 * simulateSeason from only the games that had already finished, so it is
 * lookahead-free by construction.
 */
async function priorSeasonSPRatings(year: number): Promise<SPRating[]> {
  const file = path.join(process.cwd(), "data", "raw", String(year - 1), "sp-ratings.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const ratings = (await getSPRatings(year - 1)).map(normalizeSPRating);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ratings, null, 2));
  return ratings;
}

async function main() {
  const league: League = leagueFromArgv();
  const config = modelConfigFor(league);
  const meta = leagueMeta(league);
  const seasons = config.backtestSeasons;
  const fit = loadCalibration(league);

  const outDir = path.join(dataRootFor(league), "backtest");
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[backtest] league=${meta.shortName} seasons=${seasons.join(", ")}`);

  // The NFL additionally needs each backtest season's PREDECESSOR, to regress
  // early-season SRS toward a prior-season rating rather than rating a 1-0 team
  // off a single result.
  const needed = league === "nfl" ? [...new Set(seasons.flatMap((y) => [y - 1, y]))] : seasons;
  const rawBySeason = await ensureSeasonsRaw(league, needed);

  // Every loaded season's games are available for head-to-head lookups
  // regardless of which season is currently being simulated.
  const headToHeadGames = Array.from(rawBySeason.values()).flatMap((r) => r.games);

  const allPicks: GamePick[] = [];
  const allTeamsByName = new Map<string, Team>();
  const perSeason: SeasonAccuracy[] = [];

  for (const year of seasons) {
    const base = rawBySeason.get(year);
    if (!base) {
      console.warn(`[backtest] ${year}: no data available, skipping`);
      continue;
    }

    const raw =
      league === "cfb" ? { ...base, spRatings: await priorSeasonSPRatings(year) } : base;

    const picks = simulateSeason({
      raw,
      fit,
      config,
      league,
      headToHeadGames,
      priorSeasonGames: rawBySeason.get(year - 1)?.games,
    });
    allPicks.push(...picks);
    for (const t of raw.teams) allTeamsByName.set(t.school, t);

    const accuracy = computeSeasonAccuracy(year, picks, raw.teams, league);
    perSeason.push(accuracy);
    fs.writeFileSync(path.join(outDir, `${year}.json`), JSON.stringify(accuracy, null, 2));
    console.log(
      `[backtest] ${year}: SU ${accuracy.suWins}-${accuracy.suLosses} (${(
        (accuracy.suWins / Math.max(1, accuracy.suWins + accuracy.suLosses)) *
        100
      ).toFixed(1)}%) | ATS ${accuracy.atsWins}-${accuracy.atsLosses}-${accuracy.atsPushes} (${(
        (accuracy.atsWins / Math.max(1, accuracy.atsWins + accuracy.atsLosses)) *
        100
      ).toFixed(1)}%)`
    );
  }

  const combined = computeSeasonAccuracy(0, allPicks, Array.from(allTeamsByName.values()), league);
  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify({ league, seasons, combined, perSeason }, null, 2)
  );
  const atsDecided = combined.atsWins + combined.atsLosses;
  console.log(
    `[backtest] combined ${seasons.join(", ")}: SU ${combined.suWins}-${combined.suLosses} | ` +
      `ATS ${combined.atsWins}-${combined.atsLosses}-${combined.atsPushes} ` +
      `(${((combined.atsWins / Math.max(1, atsDecided)) * 100).toFixed(2)}%, breakeven 52.38%)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
