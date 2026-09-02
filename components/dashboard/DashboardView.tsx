"use client";

import { useMemo, useState } from "react";
import type { SeasonAccuracy } from "@/lib/types";
import type { BacktestSummary } from "@/lib/data/read";
import { CalibrationChart } from "./CalibrationChart";

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`;
}

function Scoreboard({ acc, label }: { acc: SeasonAccuracy; label: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-5">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{label}</div>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <span className="text-3xl font-bold tabular-nums">
            {acc.suWins}-{acc.suLosses}
          </span>
          <span className="ml-2 text-sm text-neutral-400">
            SU ({pct(acc.suWins, acc.suWins + acc.suLosses)})
          </span>
        </div>
        <div>
          <span className="text-3xl font-bold tabular-nums">
            {acc.atsWins}-{acc.atsLosses}
            {acc.atsPushes > 0 ? `-${acc.atsPushes}` : ""}
          </span>
          <span className="ml-2 text-sm text-neutral-400">
            ATS ({pct(acc.atsWins, acc.atsWins + acc.atsLosses)})
          </span>
        </div>
        <div className="text-sm text-neutral-500">{acc.n} games decided</div>
      </div>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  showAts = true,
}: {
  title: string;
  rows: { key: string; label: string; n: number; suWinPct: number; atsWinPct?: number }[];
  showAts?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-800">
      <div className="px-4 py-2 border-b border-neutral-800 text-sm font-medium">{title}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-neutral-500 text-xs">
            <th className="text-left font-normal px-4 py-1.5">Segment</th>
            <th className="text-right font-normal px-4 py-1.5">N</th>
            <th className="text-right font-normal px-4 py-1.5">SU%</th>
            {showAts && <th className="text-right font-normal px-4 py-1.5">ATS%</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-neutral-900">
              <td className="px-4 py-1.5">{r.label}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{r.n}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{(r.suWinPct * 100).toFixed(1)}%</td>
              {showAts && (
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {((r.atsWinPct ?? 0) * 100).toFixed(1)}%
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceBucketTable({ acc }: { acc: SeasonAccuracy }) {
  return (
    <BreakdownTable
      title="Accuracy by confidence bucket"
      showAts={false}
      rows={acc.confidenceBuckets
        .filter((b) => b.n > 0)
        .map((b) => ({ key: b.bucket, label: `${b.bucket}%`, n: b.n, suWinPct: b.suWinPct }))}
    />
  );
}

function WeekLog({ acc }: { acc: SeasonAccuracy }) {
  return (
    <div className="rounded-lg border border-neutral-800">
      <div className="px-4 py-2 border-b border-neutral-800 text-sm font-medium">Week-by-week log</div>
      <div className="max-h-[32rem] overflow-y-auto divide-y divide-neutral-900">
        {acc.weekLog.length === 0 && (
          <div className="px-4 py-3 text-sm text-neutral-500">No completed games yet.</div>
        )}
        {[...acc.weekLog].reverse().map((wk) => (
          <details key={wk.columnId} className="group">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-neutral-900/50">
              <span className="font-medium">{wk.label}</span>
              <span className="text-neutral-400 tabular-nums">
                SU {wk.runningSU} · ATS {wk.runningATS}
              </span>
            </summary>
            <div className="px-4 pb-2 space-y-1">
              {wk.games.map((g) => (
                <div key={g.gameId} className="flex items-center justify-between text-xs py-1">
                  <span className="text-neutral-300">{g.matchup}</span>
                  <span className="text-neutral-500">
                    picked {g.pick} ({Math.round(g.confidence)}%)
                  </span>
                  <span className={g.correct ? "text-emerald-400" : "text-rose-400"}>
                    {g.correct ? "✓" : "✗"} {g.result}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function DashboardView({
  currentSeason,
  current,
  backtest,
}: {
  currentSeason: number;
  current: SeasonAccuracy | null;
  backtest: BacktestSummary | null;
}) {
  const options = useMemo(() => {
    const opts: { key: string; label: string; acc: SeasonAccuracy }[] = [];
    if (current) opts.push({ key: String(currentSeason), label: `${currentSeason} (current)`, acc: current });
    if (backtest) {
      opts.push({ key: "combined", label: `All backtest seasons (${backtest.seasons.join(", ")})`, acc: backtest.combined });
      for (const s of backtest.perSeason) {
        opts.push({ key: String(s.season), label: String(s.season), acc: s });
      }
    }
    return opts;
  }, [current, currentSeason, backtest]);

  const [selected, setSelected] = useState(options[0]?.key ?? "");
  const active = options.find((o) => o.key === selected) ?? options[0];

  if (!active) return null;

  return (
    <div className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">History &amp; Accuracy</h1>
        <select
          value={active.key}
          onChange={(e) => setSelected(e.target.value)}
          className="ml-auto rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <Scoreboard acc={active.acc} label={active.label} />

      <div>
        <h2 className="text-sm font-medium text-neutral-300 mb-2">
          Calibration — predicted probability vs. actual win rate
        </h2>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
          <CalibrationChart buckets={active.acc.confidenceBuckets} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ConfidenceBucketTable acc={active.acc} />
        <BreakdownTable
          title="By favorite vs. underdog pick"
          rows={active.acc.byFavoriteUnderdog.map((r) => ({
            key: r.key,
            label: r.label,
            n: r.n,
            suWinPct: r.suWinPct,
            atsWinPct: r.atsWinPct,
          }))}
        />
        <BreakdownTable
          title="By home / away / neutral"
          rows={active.acc.bySite.map((r) => ({
            key: r.key,
            label: r.label,
            n: r.n,
            suWinPct: r.suWinPct,
            atsWinPct: r.atsWinPct,
          }))}
        />
        <BreakdownTable
          title="By conference (picked team)"
          rows={active.acc.byConference.map((r) => ({
            key: r.key,
            label: r.label,
            n: r.n,
            suWinPct: r.suWinPct,
            atsWinPct: r.atsWinPct,
          }))}
        />
      </div>

      <WeekLog acc={active.acc} />
    </div>
  );
}
