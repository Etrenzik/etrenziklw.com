import type {
  CfbdCalendarWeek,
  CfbdGame,
  CfbdLinesGame,
  CfbdRecord,
  CfbdSPRating,
  CfbdTeam,
} from "../../lib/cfbd/client";
import type { CalendarWeek, RawGame, RawLine, SeasonType, SPRating, Team, TeamRecord } from "../../lib/types";

function toSeasonType(s: string): SeasonType {
  return s === "postseason" ? "postseason" : "regular";
}

export function normalizeTeam(t: CfbdTeam): Team {
  return {
    id: t.id,
    school: t.school,
    mascot: t.mascot,
    abbreviation: t.abbreviation,
    conference: t.conference,
    division: t.division ?? null,
    classification: t.classification,
    color: t.color,
    altColor: t.alt_color ?? t.alternateColor ?? null,
    logo: t.logos?.[0] ?? null,
  };
}

export function normalizeGame(g: CfbdGame): RawGame {
  return {
    id: g.id,
    season: g.season,
    week: g.week,
    seasonType: toSeasonType(g.seasonType),
    startDate: g.startDate,
    completed: g.completed,
    neutralSite: g.neutralSite,
    conferenceGame: g.conferenceGame,
    homeTeam: g.homeTeam,
    homeConference: g.homeConference,
    homePoints: g.homePoints,
    awayTeam: g.awayTeam,
    awayConference: g.awayConference,
    awayPoints: g.awayPoints,
    venue: g.venue ?? null,
    notes: g.notes ?? null,
  };
}

/**
 * CFBD's `spread` follows traditional betting-odds convention: negative
 * means the home team is favored. We normalize once here to our own
 * convention used everywhere else in this codebase: positive = home favored.
 */
export function normalizeLine(g: CfbdLinesGame): RawLine | null {
  if (!g.lines || g.lines.length === 0) return null;

  // Prefer a consensus/major provider if present, else fall back to the first available spread.
  const preferredOrder = ["consensus", "DraftKings", "Bovada", "ESPN Bet", "Caesars"];
  let chosen = g.lines.find((l) => preferredOrder.includes(l.provider) && l.spread !== null);
  if (!chosen) chosen = g.lines.find((l) => l.spread !== null);
  if (!chosen || chosen.spread === null) return null;

  return {
    gameId: g.id,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    spread: -chosen.spread,
    overUnder: chosen.overUnder,
    provider: chosen.provider,
  };
}

export function normalizeRecord(r: CfbdRecord): TeamRecord {
  return {
    team: r.team,
    year: r.year,
    wins: r.total?.wins ?? 0,
    losses: r.total?.losses ?? 0,
    ties: r.total?.ties ?? 0,
    expectedWins: r.expectedWins ?? null,
  };
}

export function normalizeSPRating(r: CfbdSPRating): SPRating {
  return {
    team: r.team,
    year: r.year,
    rating: r.rating,
    ranking: r.ranking ?? null,
    offenseRating: r.offense?.rating ?? null,
    defenseRating: r.defense?.rating ?? null,
    specialTeamsRating: r.specialTeams?.rating ?? null,
  };
}

export function normalizeCalendarWeek(w: CfbdCalendarWeek): CalendarWeek {
  const seasonType = toSeasonType(w.seasonType);
  return {
    season: w.season,
    week: w.week,
    seasonType,
    label: seasonType === "regular" ? `Week ${w.week}` : `Postseason Week ${w.week}`,
    startDate: w.startDate,
    endDate: w.endDate,
    firstGameStart: w.firstGameStart ?? null,
    lastGameStart: w.lastGameStart ?? null,
  };
}
