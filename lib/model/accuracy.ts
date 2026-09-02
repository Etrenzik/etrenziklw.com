import { labelForColumnId } from "../data/columns";
import type { BreakdownStat, ConfidenceBucketStat, GamePick, SeasonAccuracy, Team } from "../types";

function emptyBreakdown(key: string, label: string): BreakdownStat {
  return {
    key,
    label,
    n: 0,
    suWins: 0,
    suLosses: 0,
    suWinPct: 0,
    atsWins: 0,
    atsLosses: 0,
    atsPushes: 0,
    atsWinPct: 0,
  };
}

function tally(b: BreakdownStat, pick: GamePick) {
  b.n++;
  if (pick.suCorrect === true) b.suWins++;
  else if (pick.suCorrect === false) b.suLosses++;
  if (pick.atsCorrect === true) b.atsWins++;
  else if (pick.atsCorrect === false) b.atsLosses++;
  else if (pick.atsCorrect === null && pick.spread !== null && pick.completed) b.atsPushes++;
}

function finalizeBreakdown(b: BreakdownStat): BreakdownStat {
  const suDecided = b.suWins + b.suLosses;
  const atsDecided = b.atsWins + b.atsLosses;
  return {
    ...b,
    suWinPct: suDecided === 0 ? 0 : b.suWins / suDecided,
    atsWinPct: atsDecided === 0 ? 0 : b.atsWins / atsDecided,
  };
}

const CONFIDENCE_BUCKET_EDGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

function bucketKeyFor(confidence: number): string {
  for (let i = 0; i < CONFIDENCE_BUCKET_EDGES.length - 1; i++) {
    const min = CONFIDENCE_BUCKET_EDGES[i];
    const max = CONFIDENCE_BUCKET_EDGES[i + 1];
    if (confidence >= min && (confidence < max || max === 100)) return `${min}-${max}`;
  }
  // Guards against a confidence just under 50 from floating-point rounding at exactly a coin flip.
  return "50-55";
}

export function computeSeasonAccuracy(
  season: number,
  allPicks: GamePick[],
  teams: Team[]
): SeasonAccuracy {
  const played = allPicks.filter((p) => p.completed && p.suCorrect !== null);
  const teamConference = new Map(teams.map((t) => [t.school, t.conference]));

  let suWins = 0;
  let suLosses = 0;
  let atsWins = 0;
  let atsLosses = 0;
  let atsPushes = 0;

  const bucketStats = new Map<string, ConfidenceBucketStat>();
  for (let i = 0; i < CONFIDENCE_BUCKET_EDGES.length - 1; i++) {
    const min = CONFIDENCE_BUCKET_EDGES[i];
    const max = CONFIDENCE_BUCKET_EDGES[i + 1];
    const label = `${min}-${max}`;
    bucketStats.set(label, {
      bucket: label,
      min,
      max,
      n: 0,
      suWins: 0,
      suLosses: 0,
      suWinPct: 0,
      avgPredictedProb: 0,
      actualWinRate: 0,
    });
  }

  const byConference = new Map<string, BreakdownStat>();
  const byFavoriteUnderdog = new Map<string, BreakdownStat>();
  const bySite = new Map<string, BreakdownStat>();

  let probSumByBucket = new Map<string, number>();

  for (const pick of played) {
    if (pick.suCorrect) suWins++;
    else suLosses++;
    if (pick.atsCorrect === true) atsWins++;
    else if (pick.atsCorrect === false) atsLosses++;
    else if (pick.spread !== null) atsPushes++;

    const key = bucketKeyFor(pick.confidence);
    const bucket = bucketStats.get(key)!;
    bucket.n++;
    if (pick.suCorrect) bucket.suWins++;
    else bucket.suLosses++;
    probSumByBucket.set(key, (probSumByBucket.get(key) ?? 0) + pick.confidence);

    const conf = teamConference.get(pick.predictedWinner) ?? "Unknown";
    const confBucket = byConference.get(conf) ?? emptyBreakdown(conf, conf);
    tally(confBucket, pick);
    byConference.set(conf, confBucket);

    if (pick.spreadFavorite !== null) {
      const modelSide = pick.pFinal >= 0.5 ? "home" : "away";
      const key = modelSide === pick.spreadFavorite ? "favorite" : "underdog";
      const label = key === "favorite" ? "Picked the favorite" : "Picked the underdog";
      const bucket = byFavoriteUnderdog.get(key) ?? emptyBreakdown(key, label);
      tally(bucket, pick);
      byFavoriteUnderdog.set(key, bucket);
    }

    const siteKey =
      pick.site === "neutral" ? "neutral" : pick.predictedWinner === pick.homeTeam ? "home" : "away";
    const siteLabel =
      siteKey === "neutral" ? "Neutral site" : siteKey === "home" ? "Picked home team" : "Picked away team";
    const siteBucket = bySite.get(siteKey) ?? emptyBreakdown(siteKey, siteLabel);
    tally(siteBucket, pick);
    bySite.set(siteKey, siteBucket);
  }

  const confidenceBuckets = Array.from(bucketStats.values()).map((b) => {
    const decided = b.suWins + b.suLosses;
    const probSum = probSumByBucket.get(b.bucket) ?? 0;
    return {
      ...b,
      suWinPct: decided === 0 ? 0 : b.suWins / decided,
      avgPredictedProb: b.n === 0 ? 0 : probSum / b.n,
      actualWinRate: decided === 0 ? 0 : b.suWins / decided,
    };
  });

  // Week-by-week log, ordered by first-occurrence of each column in chronological
  // (start date) order, with a running record.
  const columnOrder = new Map<string, number>();
  {
    const seen = new Set<string>();
    const ordered = [...allPicks].sort((a, b) => a.startDate.localeCompare(b.startDate));
    let order = 0;
    for (const p of ordered) {
      if (seen.has(p.columnId)) continue;
      seen.add(p.columnId);
      columnOrder.set(p.columnId, order++);
    }
  }

  const gamesByColumn = new Map<string, GamePick[]>();
  for (const pick of allPicks) {
    if (!pick.completed) continue;
    const list = gamesByColumn.get(pick.columnId) ?? [];
    list.push(pick);
    gamesByColumn.set(pick.columnId, list);
  }

  const orderedColumnIds = Array.from(gamesByColumn.keys()).sort(
    (a, b) => (columnOrder.get(a) ?? 0) - (columnOrder.get(b) ?? 0)
  );

  let runningSuW = 0;
  let runningSuL = 0;
  let runningAtsW = 0;
  let runningAtsL = 0;

  const weekLog = orderedColumnIds.map((columnId) => {
    const games = gamesByColumn.get(columnId)!.sort((a, b) => a.startDate.localeCompare(b.startDate));
    const entries = games.map((pick) => {
      if (pick.suCorrect !== null) {
        if (pick.suCorrect) runningSuW++;
        else runningSuL++;
      }
      if (pick.atsCorrect === true) runningAtsW++;
      else if (pick.atsCorrect === false) runningAtsL++;

      return {
        gameId: pick.gameId,
        matchup: `${pick.awayTeam} @ ${pick.homeTeam}`,
        pick: pick.predictedWinner,
        confidence: pick.confidence,
        result:
          pick.homePoints !== null && pick.awayPoints !== null
            ? `${pick.homeTeam} ${pick.homePoints}-${pick.awayPoints} ${pick.awayTeam}`
            : null,
        correct: pick.suCorrect,
      };
    });

    return {
      columnId,
      label: labelForColumnId(columnId),
      runningSU: `${runningSuW}-${runningSuL}`,
      runningATS: `${runningAtsW}-${runningAtsL}`,
      games: entries,
    };
  });

  return {
    season,
    n: played.length,
    suWins,
    suLosses,
    atsWins,
    atsLosses,
    atsPushes,
    confidenceBuckets,
    byConference: Array.from(byConference.values()).map(finalizeBreakdown).sort((a, b) => b.n - a.n),
    byFavoriteUnderdog: Array.from(byFavoriteUnderdog.values()).map(finalizeBreakdown),
    bySite: Array.from(bySite.values()).map(finalizeBreakdown),
    weekLog,
  };
}
