import { getBacktestSummary, getDashboard, listPickSeasons } from "@/lib/data/read";
import { currentSeasonYear } from "@/lib/data/season";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const seasons = listPickSeasons();
  const activeYear = seasons[0] ?? currentSeasonYear();
  const current = getDashboard(activeYear);
  const backtest = getBacktestSummary();

  if (!current && !backtest) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold">No data yet</h1>
          <p className="text-neutral-400 text-sm">
            Run <code className="text-neutral-300">npm run calibrate &amp;&amp; npm run backtest</code>{" "}
            and <code className="text-neutral-300">npm run fetch &amp;&amp; npm run compute</code> (with{" "}
            <code className="text-neutral-300">CFBD_API_KEY</code> set) to build the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return <DashboardView currentSeason={activeYear} current={current} backtest={backtest} />;
}
