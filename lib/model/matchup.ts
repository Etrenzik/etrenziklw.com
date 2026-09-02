import { MATCHUP_WEIGHTS } from "./config";
import type { MatchupFeatures } from "../types";

/**
 * Combines normalized matchup features into an implied point margin
 * (home minus away). All inputs are already in "points" or point-like
 * units; missing signals (nulls, e.g. no head-to-head history) simply drop
 * out of the sum rather than being imputed with a guess.
 */
export function matchupImpliedMargin(f: MatchupFeatures): number {
  let margin = 0;
  if (f.spOverallDiff !== null) margin += MATCHUP_WEIGHTS.spOverall * f.spOverallDiff;
  if (f.spOffenseVsDefenseDiff !== null)
    margin += MATCHUP_WEIGHTS.spOffenseVsDefense * f.spOffenseVsDefenseDiff;
  if (f.recentFormWinPctDiff !== null)
    margin += MATCHUP_WEIGHTS.recentFormWinPct * f.recentFormWinPctDiff;
  if (f.recentFormMarginDiff !== null)
    margin += MATCHUP_WEIGHTS.recentFormMargin * f.recentFormMarginDiff;
  if (f.turnoverMarginDiff !== null)
    margin += MATCHUP_WEIGHTS.turnoverMargin * f.turnoverMarginDiff;
  margin += f.homeFieldPoints;
  margin += f.restTravelPoints;
  if (f.headToHeadMarginDiff !== null)
    margin += MATCHUP_WEIGHTS.headToHead * f.headToHeadMarginDiff;
  return margin;
}
