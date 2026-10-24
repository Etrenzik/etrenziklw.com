import type { ModelConfig } from "./config";
import type { MatchupFeatures } from "../types";

/**
 * Combines normalized matchup features into an implied point margin
 * (home minus away). All inputs are already in "points" or point-like
 * units; missing signals (nulls, e.g. no head-to-head history, or the
 * offense/defense cross term in the NFL) simply drop out of the sum rather
 * than being imputed with a guess.
 */
export function matchupImpliedMargin(f: MatchupFeatures, config: ModelConfig): number {
  const w = config.matchupWeights;
  let margin = 0;
  if (f.spOverallDiff !== null) margin += w.powerRating * f.spOverallDiff;
  if (f.spOffenseVsDefenseDiff !== null) margin += w.offenseVsDefense * f.spOffenseVsDefenseDiff;
  if (f.recentFormWinPctDiff !== null) margin += w.recentFormWinPct * f.recentFormWinPctDiff;
  if (f.recentFormMarginDiff !== null) margin += w.recentFormMargin * f.recentFormMarginDiff;
  if (f.turnoverMarginDiff !== null) margin += w.turnoverMargin * f.turnoverMarginDiff;
  margin += f.homeFieldPoints;
  margin += f.restTravelPoints;
  if (f.headToHeadMarginDiff !== null) margin += w.headToHead * f.headToHeadMarginDiff;
  return margin;
}
