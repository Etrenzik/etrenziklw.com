// The site covers two leagues that share one model, one grid and one accuracy
// dashboard. Everything that differs between them — where data lives on disk,
// what a team grouping is called, what the power rating is named — is declared
// here rather than being branched on ad hoc at each call site.

export type League = "cfb" | "nfl";

export const LEAGUES: League[] = ["cfb", "nfl"];

export interface LeagueMeta {
  id: League;
  /** Short label for nav and badges, e.g. "CFB". */
  shortName: string;
  /** Full label for headings, e.g. "College Football". */
  name: string;
  /** How a team is referred to in copy ("school" vs "team"). */
  teamNoun: string;
  /** What the grid's row grouping is called — conferences in CFB, divisions in the NFL. */
  groupNoun: string;
  /** Display name of the matchup model's power rating input. */
  ratingLabel: string;
  /**
   * URL prefix. CFB is the site's original league and keeps the bare routes
   * (`/grid`, `/dashboard`) so existing links and the homepage don't move.
   */
  basePath: string;
  /**
   * Sub-directory under `data/`. CFB predates the NFL model and keeps the
   * original flat layout (`data/picks/...`); NFL nests under `data/nfl/`.
   */
  dataDir: string;
  /** Where this league's upstream data comes from, for UI attribution. */
  sourceName: string;
  sourceUrl: string;
}

export const LEAGUE_META: Record<League, LeagueMeta> = {
  cfb: {
    id: "cfb",
    shortName: "CFB",
    name: "College Football",
    teamNoun: "school",
    groupNoun: "Conference",
    ratingLabel: "SP+",
    basePath: "",
    dataDir: "",
    sourceName: "CollegeFootballData.com",
    sourceUrl: "https://collegefootballdata.com",
  },
  nfl: {
    id: "nfl",
    shortName: "NFL",
    name: "Pro Football",
    teamNoun: "team",
    groupNoun: "Division",
    ratingLabel: "SRS",
    basePath: "/nfl",
    dataDir: "nfl",
    sourceName: "nflverse",
    sourceUrl: "https://github.com/nflverse/nfldata",
  },
};

export function leagueMeta(league: League): LeagueMeta {
  return LEAGUE_META[league];
}

/** Route for a league's season grid. */
export function gridPath(league: League): string {
  return `${LEAGUE_META[league].basePath}/grid`;
}

/** Route for a league's accuracy dashboard. */
export function dashboardPath(league: League): string {
  return `${LEAGUE_META[league].basePath}/dashboard`;
}
