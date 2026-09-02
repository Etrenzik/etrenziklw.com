"use client";

import { useEffect } from "react";
import type { GamePick } from "@/lib/types";

function StatRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 border-b border-neutral-800/60 text-sm">
      <span className="text-right tabular-nums">{away}</span>
      <span className="text-center text-neutral-500 text-xs uppercase tracking-wide self-center">
        {label}
      </span>
      <span className="tabular-nums">{home}</span>
    </div>
  );
}

function fmt(n: number | null, digits = 1): string {
  return n === null ? "—" : n.toFixed(digits);
}

export function MatchupDetailModal({ game, onClose }: { game: GamePick; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const f = game.features;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-neutral-700 bg-neutral-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-800">
          <div>
            <div className="text-sm text-neutral-400">
              {new Date(game.startDate).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {game.site === "neutral" ? " · Neutral site" : ""}
            </div>
            <h2 className="text-lg font-semibold">
              {game.awayTeam} @ {game.homeTeam}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between rounded-md bg-neutral-900 px-4 py-3">
            <div>
              <div className="text-xs text-neutral-400">Model pick</div>
              <div className="text-base font-semibold">{game.predictedWinner}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-400">Confidence</div>
              <div className="text-base font-semibold">{Math.round(game.confidence)}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-400">Predicted margin</div>
              <div className="text-base font-semibold">{fmt(Math.abs(game.predictedMargin))}</div>
            </div>
          </div>

          {game.upsetAlert && (
            <div className="rounded-md border border-amber-700 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
              ⚠ Upset alert — {game.upsetReason}
            </div>
          )}

          {game.completed && game.homePoints !== null && game.awayPoints !== null && (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                game.suCorrect ? "bg-emerald-950/50 text-emerald-200" : "bg-rose-950/50 text-rose-200"
              }`}
            >
              Final: {game.homeTeam} {game.homePoints} – {game.awayPoints} {game.awayTeam} · Model was{" "}
              {game.suCorrect ? "correct" : "incorrect"} straight-up
              {game.atsCorrect !== null && (
                <> · {game.atsCorrect ? "covered" : "did not cover"} the spread</>
              )}
            </div>
          )}

          <div>
            <div className="text-xs text-neutral-500 mb-1 flex justify-between">
              <span>{game.awayTeam}</span>
              <span>{game.homeTeam}</span>
            </div>
            <StatRow
              label="SP+ overall edge (home − away)"
              away="—"
              home={f.spOverallDiff === null ? "—" : fmt(f.spOverallDiff)}
            />
            <StatRow
              label="Win prob (market)"
              away={game.pMarket === null ? "—" : `${Math.round((1 - game.pMarket) * 100)}%`}
              home={game.pMarket === null ? "—" : `${Math.round(game.pMarket * 100)}%`}
            />
            <StatRow
              label="Win prob (matchup model)"
              away={`${Math.round((1 - game.pMatchup) * 100)}%`}
              home={`${Math.round(game.pMatchup * 100)}%`}
            />
            <StatRow
              label="Spread"
              away={game.spread === null ? "—" : fmt(-game.spread)}
              home={game.spread === null ? "—" : fmt(game.spread)}
            />
            <StatRow
              label="Recent form (win% diff)"
              away="—"
              home={f.recentFormWinPctDiff === null ? "—" : fmt(f.recentFormWinPctDiff * 100, 0) + "%"}
            />
            <StatRow
              label="Turnover margin diff"
              away="—"
              home={f.turnoverMarginDiff === null ? "—" : fmt(f.turnoverMarginDiff)}
            />
            <StatRow
              label="Home field"
              away="—"
              home={fmt(f.homeFieldPoints)}
            />
            <StatRow
              label="Rest/travel"
              away="—"
              home={fmt(f.restTravelPoints)}
            />
          </div>

          <div className="rounded-md bg-neutral-900/60 px-3 py-2 text-sm text-neutral-300">
            {game.explanation}
          </div>
        </div>
      </div>
    </div>
  );
}
