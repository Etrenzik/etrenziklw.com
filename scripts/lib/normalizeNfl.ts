import type { NflGameRow, NflTeamRow } from "../../lib/nfl/client";
import type { RawGame, RawLine, SeasonType, Team } from "../../lib/types";

/** Human label for each nflverse `game_type`, also used to classify grid columns. */
export const NFL_ROUND_LABELS: Record<string, string> = {
  WC: "Wild Card",
  DIV: "Divisional",
  CON: "Conference Championship",
  SB: "Super Bowl",
};

function num(v: string): number | null {
  if (v === undefined || v === null || v.trim() === "" || v.toUpperCase() === "NA") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * nflverse game ids are strings ("2026_07_NE_CHI") but RawGame.id is numeric,
 * so hash to a stable 32-bit integer. FNV-1a is deterministic across runs and
 * machines, which matters because the id ends up persisted in picks JSON and
 * compared run-to-run to decide whether anything changed. The caller asserts
 * global uniqueness — see assertUniqueIds.
 */
export function nflGameIdToNumber(gameId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < gameId.length; i++) {
    hash ^= gameId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function assertUniqueIds(games: RawGame[]): void {
  const seen = new Map<number, string>();
  for (const g of games) {
    const key = `${g.season}:${g.week}:${g.awayTeam}@${g.homeTeam}`;
    const prior = seen.get(g.id);
    if (prior !== undefined && prior !== key) {
      throw new Error(
        `nflGameIdToNumber collision: "${prior}" and "${key}" both hash to ${g.id}. ` +
          `Change the hash in scripts/lib/normalizeNfl.ts.`
      );
    }
    seen.set(g.id, key);
  }
}

export function seasonTypeForGameType(gameType: string): SeasonType {
  return gameType === "REG" ? "regular" : "postseason";
}

export function normalizeNflTeam(t: NflTeamRow): Team {
  return {
    id: nflGameIdToNumber(t.team_abbr),
    school: t.team_name,
    mascot: t.team_nick || null,
    abbreviation: t.team_abbr,
    conference: t.team_conf || null,
    division: t.team_division || null,
    // The grid groups NFL rows by division: 8 groups of 4 is far more readable
    // than 2 groups of 16, and it mirrors how standings are actually presented.
    group: t.team_division || null,
    classification: "nfl",
    color: t.team_color || null,
    altColor: t.team_color2 || null,
    logo: t.team_logo_espn || null,
  };
}

/**
 * nflverse rows carry team ABBREVIATIONS ("KC"); the rest of this codebase
 * keys teams by their display name ("Kansas City Chiefs") because that is what
 * CFBD returns and what the grid renders. `abbrToName` maps between them.
 *
 * Relocated franchises appear under multiple codes across history (OAK→LV,
 * SD→LAC, STL→LA). Unmapped codes fall back to the raw abbreviation rather
 * than dropping the game, so an old season still renders.
 */
export function normalizeNflGame(r: NflGameRow, abbrToName: Map<string, string>): RawGame {
  const seasonType = seasonTypeForGameType(r.game_type);
  const neutral = r.location === "Neutral";
  const homeTeam = abbrToName.get(r.home_team) ?? r.home_team;
  const awayTeam = abbrToName.get(r.away_team) ?? r.away_team;

  return {
    id: nflGameIdToNumber(r.game_id),
    season: Number(r.season),
    week: Number(r.week),
    seasonType,
    startDate: new Date(`${r.gameday}T${r.gametime || "13:00"}:00Z`).toISOString(),
    completed: num(r.home_score) !== null && num(r.away_score) !== null,
    neutralSite: neutral,
    conferenceGame: r.div_game === "1",
    homeTeam,
    homeConference: null, // filled in by the fetcher from team metadata
    homePoints: num(r.home_score),
    awayTeam,
    awayConference: null,
    awayPoints: num(r.away_score),
    venue: r.stadium || null,
    // The round label doubles as the grid-column classifier input, mirroring
    // how CFB classifies bowls and CFP rounds from CFBD's `notes` text.
    notes: NFL_ROUND_LABELS[r.game_type] ?? null,
    homeRestDays: num(r.home_rest),
    awayRestDays: num(r.away_rest),
    divisionGame: r.div_game === "1",
  };
}

/**
 * nflverse's `spread_line` is already expressed the way this codebase expects:
 * POSITIVE means the HOME team is favored. This is the opposite of CFBD, whose
 * `spread` follows the traditional betting-odds convention (negative = home
 * favored) and is negated once in scripts/lib/normalize.ts.
 *
 * Verified empirically against 2015-2025: taking positive as home-favored,
 * favorites win straight up 66.0% of the time and the mean of
 * (home margin - spread_line) is 0.000. Had the sign been inverted those would
 * read ~34% and roughly twice the average margin. Do not "fix" this to match
 * the CFB normalizer.
 */
export function normalizeNflLine(r: NflGameRow, gameId: number, homeTeam: string, awayTeam: string): RawLine | null {
  const spread = num(r.spread_line);
  if (spread === null) return null;
  return {
    gameId,
    homeTeam,
    awayTeam,
    spread,
    overUnder: num(r.total_line),
    provider: "nflverse consensus",
  };
}
