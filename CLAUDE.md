# Declyne

Personal financial reset system for Josh. Single user. Not a product.
Read `skills/declyne-session.md` first, then the skill for whatever slice you're building.

## Stack

React 19 + Vite 7 + Tailwind v4 · Hono 4 on Cloudflare Workers · D1 + Drizzle · Capacitor 8 iOS sideload

## Live infrastructure

- Worker: `https://declyne-api.bocas-joshua.workers.dev`
- D1 database: `declyne` (`0893ada8-cbdb-4b3c-896c-c93c792023f1`)
- Cloudflare account: `bocas.joshua@gmail.com` (`59b6cf53e5d4cef04586e1deb177093c`)
- Worker secrets set: `API_TOKEN`, `OPENAI_API_KEY`, `TWELVE_DATA_KEY`, `FMP_KEY`

## Repo state (2026-04-24 handoff, end of session 17)

Working tree clean after session 17. Sessions 1-8 squashed in `67b52f2`; sessions 9, 10, 11, 12, 13, 14, 15, 16, 17 each their own commit on top. Multiple commits ahead of `origin/main`, unpushed. Ask before `git push`. Per-session details in memory file `project_declyne.md`. Test data seeded into remote D1 via `apps/worker/drizzle/seed_test.sql` (4 accounts, ~90d transactions, 3 debts, 3 credit snapshots, 2 holdings + prices, market snapshot, goal, review item).

## Key commands

```
pnpm dev              # client on localhost (preview panel)
pnpm dev:worker       # worker on localhost:8787
pnpm --filter @declyne/worker run deploy   # push worker to Cloudflare (pnpm worker:deploy collides with pnpm deploy keyword)
pnpm db:push          # push schema to remote D1
pnpm test             # 42 tests, all passing
pnpm cap:run          # build + sync + open Xcode (iOS sideload)
```

## What's built (through session 17, 2026-04-24)

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
- 2 local notifications: Sunday 9am reconciliation, Tuesday 9am follow-up (anti-scope: no third notification)
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
- Phase transitions (auto): `apps/worker/src/lib/phase.ts` gathers inputs from settings, behaviour_snapshots, debts, and accounts, runs shared `evaluatePhase`, and writes `phase_log` + `edit_log` + updates `settings.current_phase` on change. On first promotion to phase 2 it snapshots the then-current non-mortgage debt into `phase2_entry_non_mortgage_debt_cents`. Routes: `POST /api/phase/recompute`, `GET /api/phase/inputs`. Nightly cron now runs signals.compute then phase.recompute, both logged in `cron_runs`
- Vice dashboard in Budget tab: expanded Vice card shows 30d ratio, week-over-week delta, 8-week trend bars, peak weekday (over 90d), and top 5 vice categories (30d). New `GET /api/budget/vice/trend` backs it
- Phase streak computation: `apps/worker/src/lib/streaks.ts` walks pay_periods + transactions to count trailing periods where chequing income ≥ essentials spend (`essentials_covered_streak_periods`), reads `credit_snapshots` newest-first for `utilization_under_30_streak_statements` (threshold 3000 bps) and `on_time_streak_days`, and derives a fallback `essentials_monthly_cents_derived` from rolling 90d essentials / 3 when the manual setting is absent. Writes results to settings, logs changes to `edit_log`. `phase.ts` now falls back to the derived value if manual unset. Route: `POST /api/phase/streaks/recompute`. Nightly cron runs `streaks.recompute` between signals and phase, wrapped in `logCronRun`
- CC payoff + missed-payment streaks (auto): `streaks.ts` extended with `ccPayoffStreak` (per pay_period, compares `debt_payments` to CC-linked debts vs CC-account spend; period counts when paid > 0 AND paid >= spent) and `findLastMissedMinPayment` (walks last 6 cycles per non-archived debt, sums payments in a 35-day pre-due window against `requiredMinPaymentCents` which honors fixed vs percent-of-principal with a $10 floor). Persists `cc_payoff_streak` and `last_missed_min_payment_date` to settings, deletes the miss key when no miss found, logs changes to `edit_log`. Wired into same nightly cron (signals → streaks → phase). `POST /api/phase/streaks/recompute` now returns both new fields plus `cc_debts_considered`
- Test data seed: `apps/worker/drizzle/seed_test.sql` populates remote D1 with 4 accounts (TD Chq/Sav/Visa, Capital One), 90 days of paycheque + bill + vice + CC payment transactions, 3 debts (TD Visa percent-min, Capital One fixed-min, Lindsay Mexico split), 3 credit snapshots, 2 holdings with seeded prices, market snapshot, goal, one uncategorized review row. Verified end-to-end: periods/detect → 7 periods, signals/compute → vice_ratio_bps=6584, streaks/recompute → essentials_streak=2 cc_payoff_streak=1 last_miss=2026-03-21, phase/recompute auto-promoted 1→2 (`essentials_2p_and_cc_streak_1p`)
- Edit log viewer: new `GET /api/edit-log?entity_type=&entity_id=&limit=` route (`apps/worker/src/routes/editLog.ts`) with entity type allowlist + `GET /api/edit-log/entity-types`. Client page at `/settings/edit-log` with entity-type filter dropdown and last-100 entries; linked from Settings "Audit" card. `merchant` added to the entity-type allowlist in session 16
- Merchant review UI: new `apps/worker/src/routes/merchants.ts` with `GET /api/merchants?status=unverified|all|verified&q=&limit=` (joins txn count, last_seen, uncategorized count, category name) and `PATCH /api/merchants/:id` (updates display_name, category_default_id, verified; `apply_to_uncategorized: true` backfills category on this merchant's null-category txns + resolves matching review_queue rows; all diffs logged to edit_log). Pure helper `parseMerchantPatch` exported for tests. Client page `apps/client/src/pages/Merchants.tsx` at `/settings/merchants` with status filter buttons (unverified/all/verified), search box, tap-to-edit sheet (display name, grouped category picker by group, verified toggle, backfill checkbox that auto-checks when there are uncategorized txns). Linked from Settings "Data" card
- Credit snapshot entry UI: new `apps/worker/src/routes/credit.ts` with `GET /api/credit/snapshots?limit=` (newest first) and `POST /api/credit/snapshots` (validates `as_of` YYYY-MM-DD, `score` 300..900, `utilization_bps` 0..10000, `on_time_streak_days` 0..100000, `source` manual|equifax; writes edit_log; triggers `computeAndStoreStreaks` so utilization + on-time streaks refresh immediately). `DELETE /api/credit/snapshots/:id` also recomputes streaks. Pure helper `parseCreditInput` exported for tests. `credit_snapshot` added to edit-log allowlist. Client page `apps/client/src/pages/Credit.tsx` at `/settings/credit` — lists snapshots (date, score, util %, on-time days, source) with Delete per row and an Add sheet (date picker, score, utilization %, on-time days, source select). Linked from Settings "Data" card. Verified end-to-end in preview: 3 seeded rows render, Add flow rounds 3→4, Delete rounds back to 3
- 57 tests passing (43 worker, 14 shared), all packages typecheck clean, client build clean, worker deployed (version 46f30a5a)

## What's NOT built yet (next session priorities)

1. **iOS cap add ios** — iOS project folder doesn't exist yet, `cap:run` will fail. Run `npx cap add ios` from `apps/client` after ensuring `capacitor.config.ts` webDir points to `dist`
2. **Local notifications wiring** — 2 notifications (Sun 9am, Tue 9am) coded in `apps/client/src/native/notifications.ts` but not yet wired to Capacitor LocalNotifications plugin on iOS
3. **Onboarding flow** — not built
5. **CC statement snapshots** — the `cc_payoff_streak` now derives from txn/payment flows per pay period, not from actual CC statement balance history. If later we want "paid statement balance in full within cycle" semantics, we need a new `cc_statement_snapshots` table tracking balance/min-due per cycle

## iOS redeploy ritual (free provisioning, no Apple Dev account)

Free provisioning expires every 7 days. Set a calendar reminder or notice when the app stops launching.
When it expires: plug in phone, `pnpm cap:run`, hit play in Xcode. Two minutes.

## Session-end ritual (mandatory, every session)

Every session must end with three steps, in order:
1. **Memory update** — append a new session entry to `project_declyne.md` in the auto-memory dir with what shipped, files touched, commit hash, deploy version.
2. **CLAUDE.md update** — move anything new from "NOT built" to "What's built", bump the session number in the heading, update any infra/version strings.
3. **Debug pass** — `pnpm test`, `pnpm -r typecheck`, `pnpm --filter @declyne/client build`. All three must be green. Worker redeploy only if worker code changed. Commit the result. Do not hand off a session with red tests or uncommitted work.

## Rules (locked, do not change without explicit instruction)

- All money: integer cents. Never floats.
- Every financial mutation writes `edit_log`.
- CSV parsing is client-side only. Worker receives parsed rows, never raw files.
- Dedup key: `SHA256(date|description|amount|accountId)`.
- No em dashes anywhere: copy, comments, code.
- GPT never does arithmetic. All numbers in AI prompts come from our computed signals.
- Four tabs only: Today / Budget / Debts / Grow. No more tabs.
