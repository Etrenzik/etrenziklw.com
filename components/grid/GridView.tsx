"use client";

import { useMemo, useState } from "react";
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

export function GridView({ grid }: { grid: SeasonGrid }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedGame, setSelectedGame] = useState<GamePick | null>(null);

  const gameIndex = useMemo(() => buildGameIndex(grid.games), [grid.games]);
  const groups = useMemo(() => groupTeamsByConference(grid), [grid]);

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
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-3">
        <h1 className="text-lg font-semibold">
          {grid.season} Season Grid
        </h1>
        <input
          type="text"
          placeholder="Search team or conference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-64 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
        />
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <LegendSwatch className="bg-emerald-950/70 border border-emerald-800" label="Correct" />
          <LegendSwatch className="bg-rose-950/70 border border-rose-800" label="Wrong" />
          <LegendSwatch className="bg-neutral-900 border-2 border-amber-500" label="Upset alert" />
          <LegendSwatch className="bg-neutral-900/60 border border-neutral-700" label="Not played" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-neutral-950 border-b border-r border-neutral-800 px-3 py-2 text-left w-48 min-w-48">
                Team
              </th>
              {grid.columns.map((col) => (
                <th
                  key={col.id}
                  className="sticky top-0 z-20 bg-neutral-950 border-b border-neutral-800 px-2 py-2 text-center font-medium whitespace-nowrap min-w-32"
                >
                  {col.label}
                </th>
              ))}
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
              />
            ))}
          </tbody>
        </table>
      </div>

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
}: {
  conference: string;
  teams: SeasonGrid["teams"];
  columns: SeasonGrid["columns"];
  gameIndex: Map<string, TeamGameCell>;
  collapsed: boolean;
  onToggle: () => void;
  onSelectGame: (g: GamePick) => void;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={columns.length + 1}
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
              return (
                <td key={col.id} className="border-b border-neutral-900 p-0.5 align-top">
                  {cell ? (
                    <GridCell cell={cell} onSelect={() => onSelectGame(cell.game)} />
                  ) : (
                    <div className="h-full min-h-12" />
                  )}
                </td>
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
      className={`w-full h-full min-h-12 rounded px-1.5 py-1 text-left transition-colors ${cellColorClasses(cell)} ${
        game.upsetAlert ? "ring-2 ring-amber-500 ring-inset" : ""
      }`}
    >
      <div className="truncate font-medium">{opponentLabel(cell)}</div>
      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>{spread ?? "—"}</span>
        <span className={pick.isThisTeam ? "text-neutral-200" : "text-neutral-500"}>
          {Math.round(pick.confidence)}%
        </span>
      </div>
      {game.completed && game.homePoints !== null && game.awayPoints !== null && (
        <div className="text-[11px] text-neutral-400">
          {cell.isHome ? `${game.homePoints}-${game.awayPoints}` : `${game.awayPoints}-${game.homePoints}`}
        </div>
      )}
    </button>
  );
}
