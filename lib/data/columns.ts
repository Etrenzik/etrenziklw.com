import type { GridColumn, GridColumnKind, RawGame } from "../types";

/**
 * CFBD groups all postseason games under seasonType "postseason" with its own
 * week numbering, which does not map cleanly onto "conference championship /
 * bowl season / CFP round" the way the grid wants to display them. We instead
 * classify each postseason game from its `notes`/name text (CFBD includes a
 * human-readable bowl/game name there, e.g. "Rose Bowl (College Football
 * Playoff Quarterfinal)", "SEC Championship"). Anything that matches no
 * pattern falls back to plain "Bowl Season" rather than blocking the grid.
 */
export function classifyPostseasonGame(notes: string | null): GridColumnKind {
  const text = (notes ?? "").toLowerCase();

  if (text.includes("national championship") || text.includes("cfp championship")) {
    return "cfp-championship";
  }
  if (text.includes("semifinal")) return "cfp-semifinal";
  if (text.includes("quarterfinal")) return "cfp-quarterfinal";
  if (
    (text.includes("playoff") || text.includes("cfp")) &&
    (text.includes("first round") || text.includes("round one"))
  ) {
    return "cfp-first-round";
  }
  if (text.includes("championship")) return "conf-champ"; // e.g. "SEC Championship", "ACC Championship"
  return "bowl";
}

const KIND_LABELS: Record<GridColumnKind, string> = {
  week: "Week",
  "conf-champ": "Conf Champ",
  bowl: "Bowl Season",
  "cfp-first-round": "CFP First Round",
  "cfp-quarterfinal": "CFP Quarterfinal",
  "cfp-semifinal": "CFP Semifinal",
  "cfp-championship": "CFP Championship",
};

const POSTSEASON_KIND_ORDER: GridColumnKind[] = [
  "conf-champ",
  "bowl",
  "cfp-first-round",
  "cfp-quarterfinal",
  "cfp-semifinal",
  "cfp-championship",
];

/** Parses a column id (as produced by columnIdFor/buildGridColumns) back into a display label. */
export function labelForColumnId(columnId: string): string {
  const regularMatch = columnId.match(/-regular-w(\d+)$/);
  if (regularMatch) {
    const week = Number(regularMatch[1]);
    return week === 0 ? "Week 0" : `Week ${week}`;
  }
  for (const kind of Object.keys(KIND_LABELS) as GridColumnKind[]) {
    if (columnId.endsWith(`-postseason-${kind}`)) return KIND_LABELS[kind];
  }
  return columnId;
}

export function columnIdFor(game: RawGame): string {
  if (game.seasonType === "regular") {
    return `${game.season}-regular-w${game.week}`;
  }
  const kind = classifyPostseasonGame(game.notes);
  return `${game.season}-postseason-${kind}`;
}

/** Builds the ordered set of grid columns present in a set of raw games for one season. */
export function buildGridColumns(games: RawGame[]): GridColumn[] {
  const regularWeeks = new Set<number>();
  const postseasonKinds = new Set<GridColumnKind>();
  let season = games[0]?.season ?? 0;

  for (const g of games) {
    season = g.season;
    if (g.seasonType === "regular") {
      regularWeeks.add(g.week);
    } else {
      postseasonKinds.add(classifyPostseasonGame(g.notes));
    }
  }

  const columns: GridColumn[] = [];
  let order = 0;

  for (const week of Array.from(regularWeeks).sort((a, b) => a - b)) {
    columns.push({
      id: `${season}-regular-w${week}`,
      kind: "week",
      label: week === 0 ? "Week 0" : `Week ${week}`,
      season,
      seasonType: "regular",
      week,
      order: order++,
    });
  }

  for (const kind of POSTSEASON_KIND_ORDER) {
    if (!postseasonKinds.has(kind)) continue;
    columns.push({
      id: `${season}-postseason-${kind}`,
      kind,
      label: KIND_LABELS[kind],
      season,
      seasonType: "postseason",
      week: null,
      order: order++,
    });
  }

  return columns;
}
