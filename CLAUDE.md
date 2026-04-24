# Declyne

Personal financial reset system for Josh. Single user. Not a product.
Read `skills/declyne-session.md` first, then the skill for whatever slice you're building.

## Stack

React 19 + Vite 7 + Tailwind v4 · Hono 4 on Cloudflare Workers · D1 + Drizzle · Capacitor 8 iOS sideload

## Live infrastructure

- Worker: `https://declyne-api.bocas-joshua.workers.dev`
- D1 database: `declyne` (`0893ada8-cbdb-4b3c-896c-c93c792023f1`)
- Cloudflare account: `bocas.joshua@gmail.com` (`59b6cf53e5d4cef04586e1deb177093c`)
- Worker secrets set: `API_TOKEN`, `OPENAI_API_KEY`
- Worker secrets still needed: `TWELVE_DATA_KEY`, `FMP_KEY`

## Key commands

```
pnpm dev              # client on localhost (preview panel)
pnpm dev:worker       # worker on localhost:8787
pnpm --filter @declyne/worker run deploy   # push worker to Cloudflare (pnpm worker:deploy collides with pnpm deploy keyword)
pnpm db:push          # push schema to remote D1
pnpm test             # 33 tests, all passing
pnpm cap:run          # build + sync + open Xcode (iOS sideload)
```

## What's built (through session 6, 2026-04-24)

- pnpm monorepo: `apps/client`, `apps/worker`, `packages/shared`
- 26-table D1 schema, live and seeded
- All worker routes: accounts, import, phase, budget, debts, splits, investment, review, settings, export, categories, routing, periods, signals
- Four-tab client: Today / Budget / Debts / Grow + Settings cog
- Brand system: Tailwind v4 CSS vars, grain, receipt motif with stub perforations (.stub-top/.stub-bottom), .field/.field-label form primitives
- CSV pipeline: Web Worker, format autodetect (TD Chequing/Visa, Capital One), merchant normalization, real account picker sheet (no more window.prompt)
- Accounts UI at /settings/accounts: list + add/edit bottom sheet + archive/restore, receipt-card rendering
- Debts UI: tap-to-edit receipt cards, add/edit bottom sheet (principal, APR, min payment fixed/percent, statement day, due day, optional linked account), archive
- Splits UI in Debts tab: add sheet (counterparty, direction, amount, reason), tap-to-settle sheet (partial or full payment, optional note, posts split_events)
- Review UI at /review: list items with category dropdown resolve; Today card links here
- Routing UI at /budget/routing: shows latest pay period plan, regenerate button (avalanche order: min payments by APR descending, any remainder to highest-APR debt), mark-executed per row
- 3 local notifications: Sunday 9am, Tuesday 9am, Day 6 10am redeploy reminder
- Phase engine + behaviour signals (deterministic, shared package)
- Pay period detection: paycheque-anchored, substring-match + min-cents threshold, auto-runs after CSV import, routes at `/api/periods` (GET, GET /current, POST /detect). Config via settings keys: `paycheque_source_account_id`, `paycheque_pattern`, `paycheque_min_cents`, `paycheque_fallback_days`
- Behaviour signals compute at `/api/signals/compute`: writes `behaviour_snapshots` row with all 8 signals, deterministic SQL inputs, no GPT math
- Nightly cron trigger at `0 8 * * *` UTC runs `computeAndStoreSignals` via `scheduled()` handler in `apps/worker/src/index.ts`. Registered at deploy: `schedule: 0 8 * * *`
- Paycheque detection settings UI on `/settings`: source account dropdown (filters to chequing + unarchived), pattern, min cents, fallback days, Save + Detect-now buttons
- Cron observability: `cron_runs` table logs every scheduled run (started_at, finished_at, status, detail). Scheduled handler wraps `computeAndStoreSignals` in `logCronRun`. Route `GET /api/cron/runs?limit=30` returns recent rows
- AI coach narration: `POST /api/coach/summary` pulls latest `behaviour_snapshots` + current phase, calls GPT-4o-mini with deterministic payload (no math in prompt), strips em dashes from response, persists to `coach_messages` with prompt hash. `GET /api/coach/latest`, `GET /api/coach/history`. System prompt enforces no arithmetic, no em dashes, under 80 words, cite signal verbatim
- Migration `apps/worker/drizzle/0001_cron_coach.sql` applied to remote D1
- Wrangler 4.85.0 at root and worker
- Today tab Coach card: pulls `/api/coach/latest`, Refresh button posts `/api/coach/summary` and invalidates the query. Renders response text, generated_at, model. Shows empty-state copy if no snapshot exists, surfaces error inline on 404
- Settings Cron runs card: pulls `/api/cron/runs?limit=5`, renders started_at, job, detail, status per row. Confirms nightly firing without tailing Worker logs
- Market data fetch: `POST /api/market/fetch` fetches Twelve Data time_series for all holding symbols (FMP fallback), BoC overnight rate (Valet API), USD/CAD + XIU.TO + SPY spot prices. Stores in `prices` + `market_snapshots`, recomputes signals. `GET /api/market/snapshot` returns latest row
- Investment holdings enriched: `GET /api/investment/holdings` now joins with latest price from `prices` and latest row from `signals` (sma50, sma200, rsi14, momentum_30d)
- Grow tab: market snapshot card (BoC rate, USD/CAD, XIU, SPY), holdings with market value, gain/loss, RSI + momentum per holding, total portfolio value, Refresh prices button, Get recommendation button (calls `/api/investment/recommend` with current phase). Stays locked at Phase < 4
- Secrets set in Cloudflare: `TWELVE_DATA_KEY`, `FMP_KEY` (set 2026-04-24)
- 33 tests passing (19 worker, 14 shared), all packages typecheck clean, client build clean, worker deployed (version efb3b052)

## What's NOT built yet (next session priorities)

1. **iOS cap add ios** — iOS project folder doesn't exist yet, `cap:run` will fail. Run `npx cap add ios` from `apps/client` after ensuring `capacitor.config.ts` webDir points to `dist`
2. **Coach refresh prerequisite** — if `behaviour_snapshots` is empty, `POST /api/coach/summary` returns 404 `no_snapshot`. Seed by importing a CSV or calling `POST /api/signals/compute` first
3. **Vice dashboard in Budget tab** — slice described in session plan but not yet built. Should surface vice vs lifestyle spend, ratio trend
4. **Phase transitions** — `phase_log` table exists, no promotion/demotion logic written yet. Phase engine computes current phase but never writes a new row when thresholds cross

## iOS redeploy ritual (free provisioning, no Apple Dev account)

Free provisioning expires every 7 days. Day 6 notification fires at 10am.
When it fires: plug in phone, `pnpm cap:run`, hit play in Xcode. Two minutes.

## Rules (locked, do not change without explicit instruction)

- All money: integer cents. Never floats.
- Every financial mutation writes `edit_log`.
- CSV parsing is client-side only. Worker receives parsed rows, never raw files.
- Dedup key: `SHA256(date|description|amount|accountId)`.
- No em dashes anywhere: copy, comments, code.
- GPT never does arithmetic. All numbers in AI prompts come from our computed signals.
- Four tabs only: Today / Budget / Debts / Grow. No more tabs.
