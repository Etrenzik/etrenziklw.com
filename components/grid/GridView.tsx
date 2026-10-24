"use client";

import { Fragment, useMemo, useState } from "react";
import type { GamePick, SeasonGrid } from "@/lib/types";
import {
  buildGameIndex,
  cellColorClasses,
  groupTeamsByConference,
  opponentLabel,
  pickLabel,
  spreadLabel,
  type TeamGameCell,
} from "./gridUtils";
import { MatchupDetailModal } from "./MatchupDetailModal";
import { TiebreakerPredictor } from "./TiebreakerPredictor";
import { useMyPicks } from "./useMyPicks";

const WEEKLY_PICK_TARGET = 15;

interface WinLoss {
  right: number;
  wrong: number;
}

function emptyRecord(): WinLoss {
  return { right: 0, wrong: 0 };
}

function pctOf(r: WinLoss): number | null {
  const n = r.right + r.wrong;
  return n === 0 ? null : (100 * r.right) / n;
}

function RecordBadge({
  record,
  className = "",
  neutral = false,
}: {
  record: WinLoss;
  className?: string;
  /** Skip the straight-up color thresholds (e.g. for ATS, where ~52% is normal). */
  neutral?: boolean;
}) {
  const pct = pctOf(record);
  if (pct === null) return null;
  const tone = neutral
    ? "text-neutral-300"
    : pct >= 75
      ? "text-emerald-400"
      : pct >= 60
        ? "text-neutral-300"
        : "text-rose-400";
  return (
    <span className={`tabular-nums ${className}`}>
      <span className="text-neutral-500">
        {record.right}-{record.wrong}
      </span>{" "}
      <span className={`font-semibold ${tone}`}>{Math.round(pct)}%</span>
    </span>
  );
}

export function GridView({ grid }: { grid: SeasonGrid }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedGame, setSelectedGame] = useState<GamePick | null>(null);
  const { picks: myPicks, togglePick, clearAll } = useMyPicks(grid.season);

  const gameIndex = useMemo(() => buildGameIndex(grid.games), [grid.games]);
  const groups = useMemo(() => groupTeamsByConference(grid), [grid]);
  const gamesById = useMemo(() => new Map(grid.games.map((g) => [g.gameId, g])), [grid.games]);

  const pickCountByColumn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const gameIdStr of Object.keys(myPicks)) {
      const game = gamesById.get(Number(gameIdStr));
      if (!game) continue;
      counts.set(game.columnId, (counts.get(game.columnId) ?? 0) + 1);
    }
    return counts;
  }, [myPicks, gamesById]);

  const totalPicks = Object.keys(myPicks).length;

  const modelRecords = useMemo(() => {
    const overall = emptyRecord();
    const ats = emptyRecord();
    const byColumn = new Map<string, WinLoss>();
    for (const g of grid.games) {
      if (g.suCorrect === null) continue;
      const col = byColumn.get(g.columnId) ?? emptyRecord();
      if (g.suCorrect) {
        overall.right++;
        col.right++;
      } else {
        overall.wrong++;
        col.wrong++;
      }
      byColumn.set(g.columnId, col);
      if (g.atsCorrect === true) ats.right++;
      else if (g.atsCorrect === false) ats.wrong++;
    }
    return { overall, ats, byColumn };
  }, [grid.games]);

  const myRecords = useMemo(() => {
    const overall = emptyRecord();
    const byColumn = new Map<string, WinLoss>();
    for (const [gameIdStr, pickedTeam] of Object.entries(myPicks)) {
      const g = gamesById.get(Number(gameIdStr));
      if (!g || !g.completed || g.actualWinner === null) continue;
      const col = byColumn.get(g.columnId) ?? emptyRecord();
      if (g.actualWinner === pickedTeam) {
        overall.right++;
        col.right++;
      } else {
        overall.wrong++;
        col.wrong++;
      }
      byColumn.set(g.columnId, col);
    }
    return { overall, byColumn };
  }, [myPicks, gamesById]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        conference: g.conference,
        teams: g.teams.filter(
          (t) => t.school.toLowerCase().includes(q) || g.conference.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.teams.length > 0);
  }, [groups, search]);

  function toggleConference(conference: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(conference)) next.delete(conference);
      else next.add(conference);
      return next;
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-4 border-b border-neutral-800 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">
          {grid.season} Season Grid
        </h1>
        <div className="flex items-center gap-5 text-base">
          <span title="Model's straight-up picks on completed games">
            <span className="text-neutral-400">Model </span>
            <RecordBadge record={modelRecords.overall} />
          </span>
          {pctOf(modelRecords.ats) !== null && (
            <span title="Model's picks against the spread on completed games">
              <span className="text-neutral-500">ATS </span>
              <RecordBadge record={modelRecords.ats} neutral />
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="Search team or conference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-64 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-base outline-none focus:border-neutral-500"
        />
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <LegendSwatch className="bg-emerald-950/70 border border-emerald-800" label="Correct" />
          <LegendSwatch className="bg-rose-950/70 border border-rose-800" label="Wrong" />
          <LegendSwatch className="bg-neutral-900 border-2 border-amber-500" label="Upset alert" />
          <LegendSwatch className="bg-neutral-900/60 border border-neutral-700" label="Not played" />
        </div>
        <div className="flex items-center gap-2 text-sm w-full sm:w-auto">
          <span className="text-amber-400">★ My picks: {totalPicks}</span>
          <RecordBadge record={myRecords.overall} />
          {totalPicks > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Clear all of your saved picks for this season?")) clearAll();
              }}
              className="text-neutral-500 hover:text-neutral-300 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-neutral-950 border-b border-r border-neutral-800 px-3 py-2 text-left w-48 min-w-48">
                Team
              </th>
              {grid.columns.map((col) => {
                const count = pickCountByColumn.get(col.id) ?? 0;
                const modelWeek = modelRecords.byColumn.get(col.id);
                const myWeek = myRecords.byColumn.get(col.id);
                return (
                  <Fragment key={col.id}>
                    <th className="sticky top-0 z-20 bg-neutral-950 border-b border-neutral-800 px-2 py-2 text-center font-medium whitespace-nowrap min-w-32">
                      {col.label}
                      {modelWeek && (
                        <RecordBadge
                          record={modelWeek}
                          className="block text-xs font-normal"
                        />
                      )}
                    </th>
                    <th
                      className="sticky top-0 z-20 bg-neutral-950 border-b border-l border-neutral-800 px-1 py-2 text-center font-medium whitespace-nowrap w-14 min-w-14"
                      title="Your picks for this week (e.g. a CBS Sports Pick'em pool)"
                    >
                      <span className="text-amber-400">★</span>
                      <span
                        className={
                          count === 0
                            ? "block text-neutral-600"
                            : count > WEEKLY_PICK_TARGET
                              ? "block text-rose-400"
                              : count === WEEKLY_PICK_TARGET
                                ? "block text-emerald-400"
                                : "block text-neutral-400"
                        }
                      >
                        {count}/{WEEKLY_PICK_TARGET}
                      </span>
                      {myWeek && (
                        <RecordBadge record={myWeek} className="block text-xs font-normal" />
                      )}
                    </th>
                  </Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => (
              <ConferenceGroup
                key={group.conference}
                conference={group.conference}
                teams={group.teams}
                columns={grid.columns}
                gameIndex={gameIndex}
                collapsed={collapsed.has(group.conference)}
                onToggle={() => toggleConference(group.conference)}
                onSelectGame={setSelectedGame}
                myPicks={myPicks}
                onTogglePick={togglePick}
              />
            ))}
          </tbody>
        </table>
      </div>

      <TiebreakerPredictor games={grid.games} columns={grid.columns} />

      {selectedGame && (
        <MatchupDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function ConferenceGroup({
  conference,
  teams,
  columns,
  gameIndex,
  collapsed,
  onToggle,
  onSelectGame,
  myPicks,
  onTogglePick,
}: {
  conference: string;
  teams: SeasonGrid["teams"];
  columns: SeasonGrid["columns"];
  gameIndex: Map<string, TeamGameCell>;
  collapsed: boolean;
  onToggle: () => void;
  onSelectGame: (g: GamePick) => void;
  myPicks: Record<number, string>;
  onTogglePick: (gameId: number, team: string) => void;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={columns.length * 2 + 1}
          className="sticky left-0 z-10 bg-neutral-900 text-left px-3 py-1.5 border-b border-neutral-800 font-medium text-neutral-300 cursor-pointer select-none"
          onClick={onToggle}
        >
          <span className="inline-block w-3">{collapsed ? "▸" : "▾"}</span> {conference}{" "}
          <span className="text-neutral-500 font-normal">({teams.length})</span>
        </th>
      </tr>
      {!collapsed &&
        teams.map((team) => (
          <tr key={team.id} className="group">
            <td className="sticky left-0 z-10 bg-neutral-950 group-hover:bg-neutral-900 border-r border-b border-neutral-800 px-3 py-1.5 whitespace-nowrap font-medium">
              {team.school}
            </td>
            {columns.map((col) => {
              const cell = gameIndex.get(`${team.school}::${col.id}`);
              const thisTeam = cell ? (cell.isHome ? cell.game.homeTeam : cell.game.awayTeam) : null;
              const isPicked = cell ? myPicks[cell.game.gameId] === thisTeam : false;
              return (
                <Fragment key={col.id}>
                  <td className="border-b border-neutral-900 p-0.5 align-top">
                    {cell ? (
                      <GridCell cell={cell} onSelect={() => onSelectGame(cell.game)} />
                    ) : (
                      <div className="h-full min-h-12" />
                    )}
                  </td>
                  <td className="border-b border-l border-neutral-900 p-0.5 align-top">
                    {cell && thisTeam ? (
                      <button
                        onClick={() => onTogglePick(cell.game.gameId, thisTeam)}
                        title={isPicked ? "Remove from my picks" : "Mark as one of my picks"}
                        className={`w-full h-full min-h-12 flex items-center justify-center rounded text-base transition-colors ${
                          isPicked
                            ? "bg-amber-500/15 text-amber-400 ring-2 ring-amber-500 ring-inset"
                            : "bg-neutral-900/40 text-neutral-700 hover:text-neutral-300 hover:bg-neutral-900"
                        }`}
                      >
                        {isPicked ? "★" : "☆"}
                      </button>
                    ) : (
                      <div className="h-full min-h-12" />
                    )}
                  </td>
                </Fragment>
              );
            })}
          </tr>
        ))}
    </>
  );
}

function GridCell({ cell, onSelect }: { cell: TeamGameCell; onSelect: () => void }) {
  const { game } = cell;
  const pick = pickLabel(cell);
  const spread = spreadLabel(cell);

  return (
    <button
      onClick={onSelect}
      className={`w-full h-full min-h-16 rounded px-2 py-1.5 text-left transition-colors ${cellColorClasses(cell)} ${
        game.upsetAlert ? "ring-2 ring-amber-500 ring-inset" : ""
      }`}
    >
      <div className="truncate font-medium">{opponentLabel(cell)}</div>
      <div className="flex items-center justify-between gap-1 text-sm text-neutral-300">
        <span className="tabular-nums">{spread ?? "—"}</span>
        <span
          className={`font-semibold tabular-nums ${
            pick.isThisTeam ? "text-neutral-100" : "text-neutral-400"
          }`}
        >
          {Math.round(pick.confidence)}%
        </span>
      </div>
      {game.completed && game.homePoints !== null && game.awayPoints !== null && (
        <div className="text-xs text-neutral-400 tabular-nums">
          {cell.isHome ? `${game.homePoints}-${game.awayPoints}` : `${game.awayPoints}-${game.homePoints}`}
        </div>
      )}
    </button>
  );
}
