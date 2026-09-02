/**
 * CFBD labels a season by the calendar year it started in (e.g. the 2025
 * season's national championship is played in January 2026 but still has
 * `season: 2025`). Games run roughly August through mid-January, so from
 * January through June we're still in/just past last year's season.
 */
export function currentSeasonYear(now: Date = new Date()): number {
  const month = now.getMonth() + 1; // 1-12
  return month <= 6 ? now.getFullYear() - 1 : now.getFullYear();
}
