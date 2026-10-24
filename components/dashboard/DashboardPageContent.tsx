import { getBacktestSummary, getDashboard, listPickSeasons } from "@/lib/data/read";
import { currentSeasonYear } from "@/lib/data/season";
import { leagueMeta, type League } from "@/lib/leagues";
import { DashboardView } from "@/components/dashboard/DashboardView";

export async function DashboardPageContent({ league = "cfb" }: { league?: League }) {
  const meta = leagueMeta(league);
  const seasons = listPickSeasons(league);
  const activeYear = seasons[0] ?? currentSeasonYear();
  const current = getDashboard(activeYear, league);
  const backtest = getBacktestSummary(league);

  if (!current && !backtest) {
    const suffix = league === "cfb" ? "" : " -- --league=nfl";
    const refresh = league === "cfb" ? "npm run refresh" : "npm run refresh:nfl";
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold">No {meta.shortName} data yet</h1>
          <p className="text-neutral-400 text-sm">
            Run{" "}
            <code className="text-neutral-300">
              npm run calibrate{suffix} &amp;&amp; npm run backtest{suffix}
            </code>{" "}
            and <code className="text-neutral-300">{refresh}</code>
            {league === "cfb" ? (
              <>
                {" "}
                (with <code className="text-neutral-300">CFBD_API_KEY</code> set)
              </>
            ) : null}{" "}
            to build the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardView league={league} currentSeason={activeYear} current={current} backtest={backtest} />
  );
}
