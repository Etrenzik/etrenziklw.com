// Thin fetch wrapper around the CollegeFootballData.com REST API.
// Docs: https://api.collegefootballdata.com/api/docs/ (OpenAPI at /api-docs.json)
// Auth: `Authorization: Bearer <CFBD_API_KEY>`

const BASE_URL = "https://api.collegefootballdata.com";

function getApiKey(): string {
  const key = process.env.CFBD_API_KEY;
  if (!key) {
    throw new Error(
      "CFBD_API_KEY is not set. Add it to .env.local for local runs, or as a GitHub Actions secret for CI."
    );
  }
  return key;
}

export class CfbdError extends Error {
  constructor(
    public status: number,
    public path: string,
    body: string
  ) {
    super(`CFBD request failed (${status}) for ${path}: ${body.slice(0, 500)}`);
    this.name = "CfbdError";
  }
}

async function cfbdGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const maxRetries = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          Accept: "application/json",
        },
      });
      if (res.status === 429 && attempt < maxRetries) {
        const wait = 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new CfbdError(res.status, path, body);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && !(err instanceof CfbdError)) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (attempt >= maxRetries) throw err;
    }
  }
  throw lastErr;
}

// ---- Raw CFBD response shapes (subset of fields we use) ----

export interface CfbdTeam {
  id: number;
  school: string;
  mascot: string | null;
  abbreviation: string | null;
  conference: string | null;
  division?: string | null;
  classification: string | null;
  color: string | null;
  alt_color?: string | null;
  alternateColor?: string | null;
  logos: string[] | null;
}

export interface CfbdGame {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  completed: boolean;
  neutralSite: boolean;
  conferenceGame: boolean;
  homeTeam: string;
  homeConference: string | null;
  homePoints: number | null;
  awayTeam: string;
  awayConference: string | null;
  awayPoints: number | null;
  venue?: string | null;
  notes?: string | null;
}

export interface CfbdLineEntry {
  provider: string;
  spread: number | null;
  formattedSpread?: string | null;
  overUnder: number | null;
}

export interface CfbdLinesGame {
  id: number;
  season: number;
  week?: number;
  seasonType?: string;
  homeTeam: string;
  awayTeam: string;
  lines: CfbdLineEntry[];
}

export interface CfbdRecord {
  year: number;
  team: string;
  conference?: string | null;
  total: { games: number; wins: number; losses: number; ties: number };
  expectedWins?: number | null;
}

export interface CfbdSPRating {
  year: number;
  team: string;
  conference?: string | null;
  rating: number | null;
  ranking?: number | null;
  offense?: { rating: number | null } | null;
  defense?: { rating: number | null } | null;
  specialTeams?: { rating: number | null } | null;
}

export interface CfbdGameTeamStat {
  category: string;
  stat: string;
}

export interface CfbdGameTeamEntry {
  team: string;
  conference?: string | null;
  homeAway: string;
  points?: number | null;
  stats?: CfbdGameTeamStat[];
}

export interface CfbdGameTeams {
  id: number;
  teams: CfbdGameTeamEntry[];
}

export interface CfbdCalendarWeek {
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  endDate: string;
  firstGameStart?: string | null;
  lastGameStart?: string | null;
}

// ---- Endpoint helpers ----

export function getFbsTeams(year: number) {
  return cfbdGet<CfbdTeam[]>("/teams/fbs", { year });
}

export function getGames(params: {
  year: number;
  seasonType?: "regular" | "postseason" | "both";
  week?: number;
}) {
  return cfbdGet<CfbdGame[]>("/games", {
    year: params.year,
    seasonType: params.seasonType ?? "both",
    week: params.week,
  });
}

export function getLines(params: {
  year: number;
  seasonType?: "regular" | "postseason" | "both";
  week?: number;
}) {
  return cfbdGet<CfbdLinesGame[]>("/lines", {
    year: params.year,
    seasonType: params.seasonType ?? "both",
    week: params.week,
  });
}

export function getRecords(year: number) {
  return cfbdGet<CfbdRecord[]>("/records", { year });
}

export function getSPRatings(year: number) {
  return cfbdGet<CfbdSPRating[]>("/ratings/sp", { year });
}

export function getCalendar(year: number) {
  return cfbdGet<CfbdCalendarWeek[]>("/calendar", { year });
}

/**
 * Per-team, per-game box score stats (used to derive turnover margin).
 * Best-effort: callers should tolerate an empty/unexpected shape gracefully,
 * since turnover margin is a small-weight, optional model feature.
 */
export function getGameTeamStats(params: {
  year: number;
  seasonType?: "regular" | "postseason" | "both";
  week?: number;
}) {
  return cfbdGet<CfbdGameTeams[]>("/games/teams", {
    year: params.year,
    seasonType: params.seasonType ?? "both",
    week: params.week,
  });
}
