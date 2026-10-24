"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEAGUES, dashboardPath, gridPath, leagueMeta, type League } from "@/lib/leagues";

/**
 * Header navigation. The league a route belongs to is derived from the path —
 * CFB owns the bare routes (`/`, `/grid`, `/dashboard`) and the NFL lives under
 * `/nfl` — so there is no shared client state to keep in sync, which matters
 * for a static export where every page is prerendered independently.
 */
function leagueForPath(pathname: string): League {
  return pathname === "/nfl" || pathname.startsWith("/nfl/") ? "nfl" : "cfb";
}

export function LeagueNav() {
  const pathname = usePathname() ?? "/";
  const active = leagueForPath(pathname);
  const meta = leagueMeta(active);

  const onDashboard = pathname.endsWith("/dashboard");

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
      <span className="font-semibold tracking-tight text-xl">
        The Spread <span className="text-neutral-500 font-normal">{meta.shortName}</span>
      </span>

      {/* League switcher — keeps you on the same kind of page when switching. */}
      <div
        className="flex items-center rounded-md border border-neutral-700 p-0.5"
        role="group"
        aria-label="League"
      >
        {LEAGUES.map((id) => {
          const m = leagueMeta(id);
          const href = onDashboard ? dashboardPath(id) : gridPath(id);
          const isActive = id === active;
          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {m.shortName}
            </Link>
          );
        })}
      </div>

      <nav className="flex gap-5 text-base">
        <Link
          href={gridPath(active)}
          aria-current={!onDashboard ? "page" : undefined}
          className={
            !onDashboard
              ? "text-white"
              : "text-neutral-300 hover:text-white transition-colors"
          }
        >
          Season Grid
        </Link>
        <Link
          href={dashboardPath(active)}
          aria-current={onDashboard ? "page" : undefined}
          className={
            onDashboard ? "text-white" : "text-neutral-300 hover:text-white transition-colors"
          }
        >
          History &amp; Accuracy
        </Link>
      </nav>
    </div>
  );
}
