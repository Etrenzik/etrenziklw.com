import fs from "node:fs";
import path from "node:path";
import type { SeasonAccuracy, SeasonGrid } from "../types";

const DATA_ROOT = path.join(process.cwd(), "data");

function readJson<T>(relPath: string): T | null {
  const p = path.join(DATA_ROOT, relPath);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

export interface BacktestSummary {
  seasons: number[];
  combined: SeasonAccuracy;
  perSeason: SeasonAccuracy[];
}

export function getSeasonGrid(year: number): SeasonGrid | null {
  return readJson<SeasonGrid>(`picks/${year}.json`);
}

export function getDashboard(year: number): SeasonAccuracy | null {
  return readJson<SeasonAccuracy>(`dashboard/${year}.json`);
}

export function getBacktestSummary(): BacktestSummary | null {
  return readJson<BacktestSummary>("backtest/summary.json");
}

export function listPickSeasons(): number[] {
  const dir = path.join(DATA_ROOT, "picks");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => Number(f.replace(".json", "")))
    .sort((a, b) => b - a);
}
