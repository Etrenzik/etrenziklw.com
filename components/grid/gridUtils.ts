import type { GamePick, SeasonGrid } from "@/lib/types";

export interface TeamGameCell {
  game: GamePick;
  isHome: boolean;
}

/** `${team}::${columnId}` -> the team's game in that column, if any. */
export function buildGameIndex(games: GamePick[]): Map<string, TeamGameCell> {
  const idx = new Map<string, TeamGameCell>();
  for (const game of games) {
    idx.set(`${game.homeTeam}::${game.columnId}`, { game, isHome: true });
    idx.set(`${game.awayTeam}::${game.columnId}`, { game, isHome: false });
  }
  return idx;
}

export function groupTeamsByConference(grid: SeasonGrid) {
  const groups = new Map<string, SeasonGrid["teams"]>();
  for (const team of grid.teams) {
    const key = team.conference ?? "Independents";
    const list = groups.get(key) ?? [];
    list.push(team);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.school.localeCompare(b.school));
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a === "Independents" ? 1 : b === "Independents" ? -1 : a.localeCompare(b)))
    .map(([conference, teams]) => ({ conference, teams }));
}

export function opponentLabel(cell: TeamGameCell): string {
  const { game, isHome } = cell;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  if (game.site === "neutral") return `vs ${opponent} (N)`;
  return isHome ? `vs ${opponent}` : `@ ${opponent}`;
}

export function spreadLabel(cell: TeamGameCell): string | null {
  const { game, isHome } = cell;
  if (game.spread === null) return null;
  // game.spread is positive when the HOME team is favored; flip sign for the away team's perspective.
  const teamSpread = isHome ? game.spread : -game.spread;
  if (Math.abs(teamSpread) < 0.25) return "PK";
  return teamSpread > 0 ? `-${teamSpread.toFixed(1)}` : `+${Math.abs(teamSpread).toFixed(1)}`;
}

export function pickLabel(cell: TeamGameCell): { team: string; confidence: number; isThisTeam: boolean } {
  const { game, isHome } = cell;
  const isThisTeam = game.predictedWinner === (isHome ? game.homeTeam : game.awayTeam);
  return { team: game.predictedWinner, confidence: game.confidence, isThisTeam };
}

export function cellColorClasses(cell: TeamGameCell): string {
  const { game } = cell;
  if (!game.completed) return "bg-neutral-900/60 text-neutral-500";
  if (game.suCorrect === null) return "bg-neutral-900/60 text-neutral-500"; // tie, effectively never happens
  return game.suCorrect
    ? "bg-emerald-950/70 text-emerald-200 hover:bg-emerald-900/70"
    : "bg-rose-950/70 text-rose-200 hover:bg-rose-900/70";
}
