import fs from "node:fs";
import path from "node:path";
import { LEAGUES, leagueMeta, type League } from "../../lib/leagues";
import type { CalibrationFit } from "../../lib/types";
import {
  fetchSeasonRawData,
  hasRawData,
  readSeasonRawData,
  writeSeasonRawData,
  type SeasonRawData,
} from "./fetchSeason";
import { fetchAllNflSeasons, hasNflRawData, readNflSeasonRawData, writeNflSeasonRawData } from "./fetchNflSeason";

/**
 * Reads `--league=nfl` (or `--league nfl`) from argv, defaulting to CFB so the
 * existing `npm run calibrate` / `backtest` / `compute` commands keep behaving
 * exactly as they did before the NFL model was added.
 */
export function leagueFromArgv(argv: string[] = process.argv.slice(2)): League {
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--league=")) value = a.slice("--league=".length);
    else if (a === "--league") value = argv[i + 1];
  }
  if (!value) return "cfb";
  const normalized = value.trim().toLowerCase();
  if (!(LEAGUES as string[]).includes(normalized)) {
    throw new Error(`Unknown --league "${value}". Expected one of: ${LEAGUES.join(", ")}.`);
  }
  return normalized as League;
}

/** Absolute path to a league's data directory (`data/` for CFB, `data/nfl/` for the NFL). */
export function dataRootFor(league: League): string {
  const dir = leagueMeta(league).dataDir;
  return dir ? path.join(process.cwd(), "data", dir) : path.join(process.cwd(), "data");
}

export function calibrationPathFor(league: League): string {
  return path.join(dataRootFor(league), "calibration.json");
}

export function loadCalibration(league: League): CalibrationFit {
  const p = calibrationPathFor(league);
  if (!fs.existsSync(p)) {
    const flag = league === "cfb" ? "" : ` -- --league=${league}`;
    throw new Error(
      `${path.relative(process.cwd(), p)} not found. Run \`npm run calibrate${flag}\` first ` +
        `to fit the market model against prior seasons.`
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Loads only the seasons already cached on disk, skipping the rest silently.
 *
 * Used for the "nice to have" inputs — head-to-head history and the NFL's
 * prior-season SRS seed — which improve a pick but must never turn a routine
 * `npm run compute` into a network fetch. That matters most for CFB, where a
 * fetch needs a CFBD API key and spends monthly quota: the refresh workflow
 * computes from whatever the fetch step already wrote, and a missing backtest
 * season should degrade the model slightly, not fail the build.
 */
export function loadSeasonsIfPresent(league: League, years: number[]): Map<number, SeasonRawData> {
  const out = new Map<number, SeasonRawData>();
  for (const year of years) {
    if (league === "cfb") {
      if (hasRawData(year)) out.set(year, readSeasonRawData(year));
    } else if (hasNflRawData(year)) {
      out.set(year, readNflSeasonRawData(year));
    }
  }
  return out;
}

/**
 * Loads raw data for a set of seasons, fetching and caching to disk anything
 * not already there.
 *
 * The two leagues differ in fetch shape: CFBD is per-season REST calls against
 * a quota, while nflverse is one CSV covering every season at once. Batching
 * through a single entry point means a caller asking for five backtest seasons
 * of NFL data triggers one download rather than five.
 */
export async function ensureSeasonsRaw(
  league: League,
  years: number[]
): Promise<Map<number, SeasonRawData>> {
  const out = new Map<number, SeasonRawData>();

  if (league === "cfb") {
    for (const year of years) {
      if (hasRawData(year)) {
        out.set(year, readSeasonRawData(year));
      } else {
        const raw = await fetchSeasonRawData(year);
        writeSeasonRawData(raw);
        out.set(year, raw);
      }
    }
    return out;
  }

  const missing = years.filter((y) => !hasNflRawData(y));
  for (const y of years) {
    if (hasNflRawData(y)) out.set(y, readNflSeasonRawData(y));
  }
  if (missing.length > 0) {
    const fetched = await fetchAllNflSeasons(missing);
    for (const [year, raw] of fetched.bySeason) {
      writeNflSeasonRawData(raw);
      out.set(year, raw);
    }
  }
  return out;
}
