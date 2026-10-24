import { getSeasonGrid, listPickSeasons } from "@/lib/data/read";
import { currentSeasonYear } from "@/lib/data/season";
import { leagueMeta, type League } from "@/lib/leagues";
import { GridView } from "@/components/grid/GridView";

// Static export prerenders this once at build time, so there is no per-request
// season query param to read — the grid always shows the most recent season
// that has data on disk (i.e. the current season once the GitHub Action has run).
export async function GridPageContent({ league = "cfb" }: { league?: League }) {
  const meta = leagueMeta(league);
  const seasons = listPickSeasons(league);
  const season = seasons[0] ?? currentSeasonYear();
  const grid = getSeasonGrid(season, league);

  if (!grid) {
    const refresh = league === "cfb" ? "npm run refresh" : "npm run refresh:nfl";
    const needsKey = league === "cfb";
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold">No {meta.shortName} data yet</h1>
          <p className="text-neutral-400 text-sm">
            No season grid has been generated for {season}. Run{" "}
            <code className="text-neutral-300">{refresh}</code>
            {needsKey ? (
              <>
                {" "}
                (with <code className="text-neutral-300">CFBD_API_KEY</code> set)
              </>
            ) : null}{" "}
            to build it, or wait for the scheduled GitHub Action to populate it.
          </p>
        </div>
      </div>
    );
  }

  return <GridView grid={grid} />;
}
