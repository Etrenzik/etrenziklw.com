import type { League } from "../leagues";
import type { GridColumn, GridColumnKind, RawGame } from "../types";

/**
 * CFBD doesn't tag games with a clean "conference championship / bowl /
 * CFP round" field, so columns are classified from the game's `notes`
 * text (a human-readable name CFBD includes, e.g. "SEC Championship",
 * "College Football Playoff Quarterfinal at the Rose Bowl"). Confirmed
 * against real 2024 data: conference championship games are tagged
 * `seasonType: "regular"` (the final regular-season week) with
 * "<Conference> Championship" in `notes`, NOT `seasonType: "postseason"`
 * — so this checks notes text first, independent of seasonType, and
 * only falls back to plain "Week N" grouping when nothing matches.
 * Anything postseason that matches no specific pattern falls back to
 * plain "Bowl Season" rather than blocking the grid.
 */
export function classifyGame(
  game: Pick<RawGame, "seasonType" | "notes">,
  league: League = "cfb"
): GridColumnKind {
  const text = (game.notes ?? "").toLowerCase();

  // The NFL postseason is a fixed four-round bracket, and scripts/lib/normalizeNfl.ts
  // writes the round name into `notes`, so classification is an exact lookup
  // rather than the fuzzy text matching college bowl/CFP naming requires.
  if (league === "nfl") {
    if (text.includes("super bowl")) return "nfl-super-bowl";
    if (text.includes("conference championship")) return "nfl-conference";
    if (text.includes("divisional")) return "nfl-divisional";
    if (text.includes("wild card")) return "nfl-wild-card";
    return "week";
  }

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
  if (game.seasonType === "postseason") return "bowl";
  return "week";
}

const KIND_LABELS: Record<GridColumnKind, string> = {
  week: "Week",
  "conf-champ": "Conf Champ",
  bowl: "Bowl Season",
  "cfp-first-round": "CFP First Round",
  "cfp-quarterfinal": "CFP Quarterfinal",
  "cfp-semifinal": "CFP Semifinal",
  "cfp-championship": "CFP Championship",
  "nfl-wild-card": "Wild Card",
  "nfl-divisional": "Divisional",
  "nfl-conference": "Conf Champ",
  "nfl-super-bowl": "Super Bowl",
};

const NON_WEEK_KIND_ORDER: GridColumnKind[] = [
  "conf-champ",
  "bowl",
  "cfp-first-round",
  "cfp-quarterfinal",
  "cfp-semifinal",
  "cfp-championship",
  "nfl-wild-card",
  "nfl-divisional",
  "nfl-conference",
  "nfl-super-bowl",
];

/** Parses a column id (as produced by columnIdFor/buildGridColumns) back into a display label. */
export function labelForColumnId(columnId: string): string {
  const regularMatch = columnId.match(/-week-w(\d+)$/);
  if (regularMatch) {
    const week = Number(regularMatch[1]);
    return week === 0 ? "Week 0" : `Week ${week}`;
  }
  for (const kind of Object.keys(KIND_LABELS) as GridColumnKind[]) {
    if (columnId.endsWith(`-${kind}`) && kind !== "week") return KIND_LABELS[kind];
  }
  return columnId;
}

export function columnIdFor(game: RawGame, league: League = "cfb"): string {
  const kind = classifyGame(game, league);
  if (kind === "week") return `${game.season}-week-w${game.week}`;
  return `${game.season}-${kind}`;
}

/** Builds the ordered set of grid columns present in a set of raw games for one season. */
export function buildGridColumns(games: RawGame[], league: League = "cfb"): GridColumn[] {
  const regularWeeks = new Set<number>();
  const otherKinds = new Set<GridColumnKind>();
  let season = games[0]?.season ?? 0;

  for (const g of games) {
    season = g.season;
    const kind = classifyGame(g, league);
    if (kind === "week") regularWeeks.add(g.week);
    else otherKinds.add(kind);
  }

  const columns: GridColumn[] = [];
  let order = 0;

  for (const week of Array.from(regularWeeks).sort((a, b) => a - b)) {
    columns.push({
      id: `${season}-week-w${week}`,
      kind: "week",
      label: week === 0 ? "Week 0" : `Week ${week}`,
      season,
      seasonType: "regular",
      week,
      order: order++,
    });
  }

  for (const kind of NON_WEEK_KIND_ORDER) {
    if (!otherKinds.has(kind)) continue;
    columns.push({
      id: `${season}-${kind}`,
      kind,
      label: KIND_LABELS[kind],
      season,
      // Conference championships are CFBD seasonType "regular" (the final regular-season
      // week); everything else in this bucket (bowls, CFP rounds) is "postseason".
      // CFB conference championships are CFBD seasonType "regular" (the final
      // regular-season week); every other non-week column in both leagues is
      // genuine postseason.
      seasonType: kind === "conf-champ" ? "regular" : "postseason",
      week: null,
      order: order++,
    });
  }

  return columns;
}
