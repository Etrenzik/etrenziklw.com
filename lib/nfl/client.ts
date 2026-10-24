// Thin fetch layer over nflverse's published CSV datasets.
//
// Unlike CFBD this needs no API key and has no call quota — the data is plain
// CSV served from GitHub — so the NFL refresh has none of the quota-dodging
// machinery the CFB fetcher carries.
//
// Two files are used:
//   games.csv              one row per game, 1999-present, including the
//                          closing spread, total, rest days and division flag
//   teams_colors_logos.csv team metadata (conference, division, colors, logo)
//
// Docs: https://github.com/nflverse/nfldata

const GAMES_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
const TEAMS_URL =
  "https://raw.githubusercontent.com/nflverse/nflfastR-data/master/teams_colors_logos.csv";

export class NflDataError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body: string
  ) {
    super(`nflverse request failed (${status}) for ${url}: ${body.slice(0, 300)}`);
    this.name = "NflDataError";
  }
}

async function fetchText(url: string): Promise<string> {
  const maxRetries = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "text/csv" } });
      if (!res.ok) {
        const body = await res.text();
        throw new NflDataError(res.status, url, body);
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      // A 404 means the dataset moved; retrying can't fix that.
      if (err instanceof NflDataError && err.status === 404) throw err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
    }
  }
  throw lastErr;
}

/**
 * Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes and
 * embedded commas/newlines. Stadium names in this feed contain commas, so a
 * naive split(",") silently corrupts every column after it.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length > 1)
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, i) => (o[h] = r[i] ?? ""));
      return o;
    });
}

// ---- Raw nflverse row shapes (the subset of columns we use) ----

export interface NflGameRow {
  game_id: string;
  season: string;
  game_type: string; // REG | WC | DIV | CON | SB
  week: string;
  gameday: string;
  gametime: string;
  away_team: string;
  away_score: string;
  home_team: string;
  home_score: string;
  location: string; // "Home" | "Neutral"
  spread_line: string; // positive = HOME favored (see normalizeNflLine)
  total_line: string;
  away_rest: string;
  home_rest: string;
  div_game: string; // "0" | "1"
  stadium: string;
}

export interface NflTeamRow {
  team_abbr: string;
  team_name: string;
  team_nick: string;
  team_conf: string; // AFC | NFC
  team_division: string; // e.g. "AFC East"
  team_color: string;
  team_color2: string;
  team_logo_espn: string;
}

export async function getAllGames(): Promise<NflGameRow[]> {
  const text = await fetchText(GAMES_URL);
  return parseCsv(text) as unknown as NflGameRow[];
}

export async function getTeams(): Promise<NflTeamRow[]> {
  const text = await fetchText(TEAMS_URL);
  return parseCsv(text) as unknown as NflTeamRow[];
}
