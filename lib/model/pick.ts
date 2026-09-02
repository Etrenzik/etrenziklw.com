import { BLEND_MARKET_WEIGHT, UPSET_ALERT_PROB_GAP } from "./config";
import { marketWinProbability, probabilityToMargin, type LogisticFit } from "./market";
import { matchupImpliedMargin } from "./matchup";
import type { GamePick, MatchupFeatures, RawGame, RawLine, SiteType } from "../types";

export interface ComputePickInput {
  game: RawGame;
  columnId: string;
  line: RawLine | null;
  features: MatchupFeatures;
  fit: LogisticFit;
}

function siteOf(game: RawGame): SiteType {
  return game.neutralSite ? "neutral" : "home";
}

function buildExplanation(params: {
  homeTeam: string;
  awayTeam: string;
  predictedWinner: string;
  confidence: number;
  spread: number | null;
  features: MatchupFeatures;
  pMarket: number | null;
  pMatchup: number;
}): string {
  const { predictedWinner, confidence, spread, features, pMarket, pMatchup } = params;
  const bits: string[] = [];

  if (spread !== null) {
    const favoredTeam = spread >= 0 ? params.homeTeam : params.awayTeam;
    bits.push(
      `the market favors ${favoredTeam} by ${Math.abs(spread).toFixed(1)} (${Math.round(
        (pMarket ?? 0) * 100
      )}% implied)`
    );
  } else {
    bits.push("no market line is available yet");
  }

  if (features.spOverallDiff !== null) {
    const sign = features.spOverallDiff >= 0 ? params.homeTeam : params.awayTeam;
    bits.push(`SP+ favors ${sign} by ${Math.abs(features.spOverallDiff).toFixed(1)} pts`);
  }
  if (features.recentFormMarginDiff !== null && Math.abs(features.recentFormMarginDiff) > 3) {
    const sign = features.recentFormMarginDiff >= 0 ? params.homeTeam : params.awayTeam;
    bits.push(`${sign} has the better recent form`);
  }
  if (features.restTravelPoints !== 0) {
    bits.push(
      features.restTravelPoints > 0
        ? `rest/travel edge favors ${params.homeTeam}`
        : `rest/travel edge favors ${params.awayTeam}`
    );
  }

  return `Picking ${predictedWinner} (${Math.round(confidence)}% confidence): matchup model puts the win probability at ${Math.round(
    pMatchup * 100
  )}%, ${bits.join("; ")}.`;
}

export function computeGamePick(input: ComputePickInput): GamePick {
  const { game, columnId, line, features, fit } = input;

  const spread = line?.spread ?? null; // already normalized: positive = home favored
  const spreadFavorite: "home" | "away" | null =
    spread === null ? null : spread > 0 ? "home" : spread < 0 ? "away" : null;

  const pMarket = spread === null ? null : marketWinProbability(spread, fit);
  const matchupMargin = matchupImpliedMargin(features);
  const pMatchup = marketWinProbability(matchupMargin, fit);

  const pFinal =
    pMarket === null ? pMatchup : BLEND_MARKET_WEIGHT * pMarket + (1 - BLEND_MARKET_WEIGHT) * pMatchup;

  const predictedMarginMarket = spread;
  const predictedMarginMatchup = matchupMargin;
  const predictedMargin =
    predictedMarginMarket === null
      ? predictedMarginMatchup
      : BLEND_MARKET_WEIGHT * predictedMarginMarket + (1 - BLEND_MARKET_WEIGHT) * predictedMarginMatchup;

  const predictedWinner = pFinal >= 0.5 ? game.homeTeam : game.awayTeam;
  const confidence = (pFinal >= 0.5 ? pFinal : 1 - pFinal) * 100;

  let upsetAlert = false;
  let upsetReason: string | null = null;
  if (spreadFavorite !== null) {
    const modelFavorsHome = pFinal >= 0.5;
    const modelFavorite = modelFavorsHome ? "home" : "away";
    if (modelFavorite !== spreadFavorite) {
      upsetAlert = true;
      upsetReason = `Model picks ${predictedWinner} against the spread favorite.`;
    } else if (Math.abs(pFinal - 0.5) < UPSET_ALERT_PROB_GAP) {
      upsetAlert = true;
      upsetReason = "Model agrees with the spread favorite but calls it a near toss-up.";
    }
  }

  const completed = game.completed && game.homePoints !== null && game.awayPoints !== null;
  let actualWinner: string | null = null;
  let actualMargin: number | null = null;
  let suCorrect: boolean | null = null;
  let atsCorrect: boolean | null = null;

  if (completed) {
    const hp = game.homePoints as number;
    const ap = game.awayPoints as number;
    actualMargin = hp - ap;
    actualWinner = hp === ap ? null : hp > ap ? game.homeTeam : game.awayTeam;
    suCorrect = actualWinner === null ? null : actualWinner === predictedWinner;

    if (spread !== null) {
      const homeCoveredMargin = hp - ap - spread; // >0 home covered, <0 away covered, 0 push
      if (homeCoveredMargin === 0) {
        atsCorrect = null; // push
      } else {
        const atsWinnerIsHome = homeCoveredMargin > 0;
        const modelPickedHome = predictedWinner === game.homeTeam;
        atsCorrect = atsWinnerIsHome === modelPickedHome;
      }
    }
  }

  const explanation = buildExplanation({
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    predictedWinner,
    confidence,
    spread,
    features,
    pMarket,
    pMatchup,
  });

  return {
    gameId: game.id,
    season: game.season,
    week: game.week,
    seasonType: game.seasonType,
    columnId,
    startDate: game.startDate,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    site: siteOf(game),
    spread,
    spreadFavorite,
    pMarket,
    pMatchup,
    pFinal,
    predictedMarginMarket,
    predictedMarginMatchup,
    predictedMargin,
    predictedWinner,
    confidence,
    upsetAlert,
    upsetReason,
    explanation,
    features,
    completed,
    homePoints: game.homePoints,
    awayPoints: game.awayPoints,
    actualWinner,
    actualMargin,
    suCorrect,
    atsCorrect,
  };
}

export { probabilityToMargin };
