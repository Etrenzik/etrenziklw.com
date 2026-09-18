"use client";

import { useMemo, useState } from "react";
import type { GamePick, GridColumn } from "@/lib/types";

function fmtScore(n: number | null): string {
  return n === null ? "—" : Math.round(n).toString();
}

function defaultColumnId(columns: GridColumn[], games: GamePick[]): string {
  const gamesByColumn = new Map<string, GamePick[]>();
  for (const g of games) {
    const list = gamesByColumn.get(g.columnId) ?? [];
    list.push(g);
    gamesByColumn.set(g.columnId, list);
  }
  const ordered = [...columns].sort((a, b) => a.order - b.order);
  const upcoming = ordered.find((c) => (gamesByColumn.get(c.id) ?? []).some((g) => !g.completed));
  return (upcoming ?? ordered[ordered.length - 1])?.id ?? columns[0]?.id ?? "";
}

export function TiebreakerPredictor({
  games,
  columns,
}: {
  games: GamePick[];
  columns: GridColumn[];
}) {
  const orderedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);
  const [columnId, setColumnId] = useState(() => defaultColumnId(columns, games));

  const gamesInColumn = useMemo(
    () =>
      games
        .filter((g) => g.columnId === columnId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [games, columnId]
  );

  const [gameId, setGameId] = useState<number | undefined>(gamesInColumn[0]?.gameId);
  const selectedGame = gamesInColumn.find((g) => g.gameId === gameId) ?? gamesInColumn[0] ?? null;

  function handleColumnChange(newColumnId: string) {
    setColumnId(newColumnId);
    const firstGame = games
      .filter((g) => g.columnId === newColumnId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    setGameId(firstGame?.gameId);
  }

  return (
    <div className="border-t border-neutral-800 px-4 py-5">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-base font-semibold mb-1">Tiebreaker Predictor</h2>
        <p className="text-xs text-neutral-500 mb-3">
          Pick a game to see the model&apos;s predicted combined score — handy for a pool&apos;s
          total-points tiebreaker (e.g. CBS Sports Pick&apos;em).
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <select
            value={columnId}
            onChange={(e) => handleColumnChange(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
          >
            {orderedColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={selectedGame?.gameId ?? ""}
            onChange={(e) => setGameId(Number(e.target.value))}
            className="flex-1 min-w-64 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
          >
            {gamesInColumn.length === 0 && <option value="">No games this week</option>}
            {gamesInColumn.map((g) => (
              <option key={g.gameId} value={g.gameId}>
                {g.awayTeam} @ {g.homeTeam}
                {g.completed ? " (final)" : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedGame ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4">
            <div className="text-sm text-neutral-400 mb-3">
              {selectedGame.awayTeam} @ {selectedGame.homeTeam}
              {selectedGame.site === "neutral" ? " (neutral site)" : ""}
            </div>

            {selectedGame.predictedTotal === null ? (
              <p className="text-sm text-neutral-500">
                No market total or scoring history yet for this game — check back closer to kickoff.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-center gap-6 mb-3">
                  <div className="text-center">
                    <div className="text-xs text-neutral-500">{selectedGame.awayTeam}</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {fmtScore(selectedGame.predictedAwayScore)}
                    </div>
                  </div>
                  <div className="text-neutral-600">–</div>
                  <div className="text-center">
                    <div className="text-xs text-neutral-500">{selectedGame.homeTeam}</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {fmtScore(selectedGame.predictedHomeScore)}
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm text-neutral-300">
                    Predicted combined total:{" "}
                    <span className="font-semibold text-amber-400">
                      {Math.round(selectedGame.predictedTotal)} points
                    </span>
                  </span>
                  <div className="text-xs text-neutral-500 mt-1">
                    {selectedGame.predictedTotalSource === "market"
                      ? `Vegas over/under: ${selectedGame.overUnder}`
                      : "Estimated from both teams' recent scoring (no market total posted yet)"}
                  </div>
                </div>
                {selectedGame.completed &&
                  selectedGame.homePoints !== null &&
                  selectedGame.awayPoints !== null && (
                    <div className="text-center text-xs text-neutral-500 mt-3 pt-3 border-t border-neutral-800">
                      Actual final: {selectedGame.awayTeam} {selectedGame.awayPoints} –{" "}
                      {selectedGame.homeTeam} {selectedGame.homePoints} (combined{" "}
                      {selectedGame.homePoints + selectedGame.awayPoints})
                    </div>
                  )}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No games found for this week.</p>
        )}
      </div>
    </div>
  );
}
