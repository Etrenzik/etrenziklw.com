# The Spread — CFB & NFL Predictor & Season Grid

Personal college and pro football win-probability models, season grids, and
accuracy dashboards. Built to support a CBS Sports Pick'em confidence pool
("The Spread") — this app does **not** scrape or automate
picks.cbssports.com. It's a standalone predictor backed by
[CollegeFootballData.com](https://collegefootballdata.com) (CFBD) for college
and [nflverse](https://github.com/nflverse/nfldata) for the NFL.

## Two leagues, one model

Both leagues run the same blending model, grid and dashboard; see
[`lib/leagues.ts`](lib/leagues.ts) for everything that differs.

| | CFB | NFL |
| --- | --- | --- |
| Routes | `/`, `/grid`, `/dashboard` | `/nfl`, `/nfl/grid`, `/nfl/dashboard` |
| Data on disk | `data/` | `data/nfl/` |
| Source | CFBD (API key, monthly quota) | nflverse CSV (no key, no quota) |
| Power rating | SP+, published by CFBD | SRS, computed from scores ([`lib/model/srs.ts`](lib/model/srs.ts)) |
| Grid row groups | Conference | Division |
| Home field | 2.5 pts | 1.8 pts (1.4 in division) |
| Postseason columns | Conf champs, bowls, CFP rounds | Wild Card → Super Bowl |

One sign-convention trap worth knowing: this codebase uses **positive =
home favored** throughout. CFBD publishes the opposite (negative = home
favored) and is negated once in
[`scripts/lib/normalize.ts`](scripts/lib/normalize.ts); nflverse's
`spread_line` already matches and must **not** be negated. See the comment
on `normalizeNflLine` for the empirical check.

## What it does

1. **Prediction model** — for every FBS and NFL game, blends a market-calibrated
   win probability (from the closing spread) with a matchup-strength model
   (SP+ ratings, recent form, turnover margin, home field, rest/travel,
   head-to-head) into one win probability, predicted margin, and an
   "upset alert" flag. See [`lib/model`](lib/model).
2. **Season grid** — every team × every week (CFB: Week 0 through bowls and
   the CFP championship; NFL: Week 1 through the Super Bowl), with the pick,
   spread, and result per cell. See
   [`app/grid`](app/grid) and [`components/grid`](components/grid).
3. **History dashboard** — straight-up (SU) and against-the-spread (ATS)
   accuracy, broken out by confidence bucket, conference/division, favorite/underdog,
   and site, plus a calibration chart and week-by-week log. See
   [`app/dashboard`](app/dashboard) and [`components/dashboard`](components/dashboard).

## How the model works

- **Market probability**: `p = sigmoid(b + k * homeSpread)`, where `k`/`b`
  are fit via logistic regression against several prior CFBD seasons
  (`npm run calibrate` → `data/calibration.json`), not hardcoded.
- **Matchup probability**: a weighted sum of point-margin features (SP+
  differential, recent form, turnover margin, home field, rest/travel,
  head-to-head), converted to a probability with the same calibrated
  slope. Weights live in one place: [`lib/model/config.ts`](lib/model/config.ts).
- **Blend**: `BLEND_MARKET_WEIGHT` (default 0.6) of market + the rest
  matchup, also in `lib/model/config.ts`.
- **Backtest**: `npm run backtest` runs the full model against
  `BACKTEST_SEASONS` and writes `data/backtest/*.json`, which seeds the
  dashboard with real history on day one.

## Data pipeline

Raw CFBD pulls and computed picks are committed as JSON under `data/` (no
database) so the static export always has something to render:

```
data/raw/<year>/          # normalized CFBD snapshots (teams, games, lines, sp-ratings, records, turnovers)
data/calibration.json     # fitted market logistic (k, b)
data/picks/<year>.json    # full season grid: every game + pick
data/dashboard/<year>.json# current-season accuracy breakdown
data/backtest/<year>.json # per-season backtest accuracy
data/backtest/summary.json# combined backtest accuracy across all seasons

data/nfl/                 # the same tree again for the NFL
data/nfl/raw/<year>/      # normalized nflverse snapshots (teams, games, lines)
data/nfl/calibration.json
data/nfl/picks/<year>.json
data/nfl/dashboard/<year>.json
data/nfl/backtest/
```

Scripts (run with `tsx`, see `package.json`):

| Command | What it does |
| --- | --- |
| `npm run calibrate` | Fits `k`/`b` against `BACKTEST_SEASONS`, writes `data/calibration.json` |
| `npm run backtest` | Runs the model against `BACKTEST_SEASONS`, writes `data/backtest/*` |
| `npm run fetch` | Pulls the current season from CFBD into `data/raw/<year>/` |
| `npm run compute` | Runs the model over the current season, writes `data/picks` + `data/dashboard` |
| `npm run refresh` | `fetch` + `compute` (what the scheduled job runs) |
| `npm run calibrate:nfl` | NFL calibration → `data/nfl/calibration.json` |
| `npm run backtest:nfl` | NFL backtest → `data/nfl/backtest/*` |
| `npm run fetch:nfl` | Pulls every needed season from nflverse into `data/nfl/raw/<year>/` |
| `npm run compute:nfl` | Scores the current NFL season |
| `npm run refresh:nfl` | `fetch:nfl` + `compute:nfl` |
| `npm run refresh:all` | Both leagues |

Every shared script takes `-- --league=nfl`; the `:nfl` entries above are
just shorthand. With no flag they default to CFB, so the original commands
behave exactly as they did before the NFL model was added.

## Local development

```bash
cp .env.example .env.local   # then paste your CFBD_API_KEY (get one free at collegefootballdata.com/key)
npm install
npm run calibrate && npm run backtest   # one-time, seeds calibration + history
npm run fetch && npm run compute        # pulls + scores the current season

npm run calibrate:nfl && npm run backtest:nfl   # same, for the NFL
npm run refresh:nfl                             # pulls + scores the current NFL season

npm run dev
```

`CFBD_API_KEY` is never committed — it's read from `.env.local` locally
and from a GitHub Actions secret in CI. The NFL pipeline needs no key at
all, so `npm run refresh:nfl` works on a fresh clone.

## Deploy

- **Data refresh**: [`.github/workflows/refresh-and-deploy.yml`](.github/workflows/refresh-and-deploy.yml)
  runs daily during the season / weekly off-season (or on demand via
  `workflow_dispatch`), commits refreshed `data/` files, builds the static
  export, and deploys it to Cloudflare Pages. Uses a CFBD Tier 2 key
  (30,000 calls/month) — see the schedule comment in that file for the
  quota incident that shaped the cadence and the incremental turnover-stats
  fetch in `scripts/lib/fetchSeason.ts`.
- **Hosting**: Next.js static export (`output: "export"`, see
  `next.config.ts`) → `out/` → Cloudflare Pages, project name
  `the-spread-cfb`, custom domain `EtrenzikLW.com`.
- **Secrets** (GitHub Actions → repo secrets): `CFBD_API_KEY`,
  `CLOUDFLARE_API_TOKEN` (Pages:Edit scope), `CLOUDFLARE_ACCOUNT_ID`.

## Tech

Next.js (App Router) + TypeScript + Tailwind CSS, static-exported. No
server/database — everything is precomputed JSON regenerated by CI.
