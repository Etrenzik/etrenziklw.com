/**
 * Both leagues label a season by the calendar year it started in.
 *
 * CFB: games run roughly August through mid-January (the 2025 season's
 * national championship is played in January 2026 but is still `season: 2025`).
 *
 * NFL: Week 1 is early September and the Super Bowl is in February, so the
 * same rule holds — Super Bowl LX in February 2027 belongs to `season: 2026`.
 *
 * In both cases, January through June is still last year's season (or the
 * quiet months just after it), and July onward belongs to the season about to
 * start — by July the upcoming schedule is published, which is what the grid
 * should be showing.
 */
export function currentSeasonYear(now: Date = new Date()): number {
  const month = now.getMonth() + 1; // 1-12
  return month <= 6 ? now.getFullYear() - 1 : now.getFullYear();
}
