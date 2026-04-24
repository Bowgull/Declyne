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
pnpm worker:deploy    # push worker to Cloudflare
pnpm db:push          # push schema to remote D1
pnpm test             # 18 tests, all passing
pnpm cap:run          # build + sync + open Xcode (iOS sideload)
```

## What's built (session 1, 2026-04-24)

- pnpm monorepo: `apps/client`, `apps/worker`, `packages/shared`
- 24-table D1 schema, live and seeded
- All worker routes: import, phase, budget, debts, splits, investment, review, settings, export
- Four-tab client: Today / Budget / Debts / Grow + Settings cog
- Brand system: Tailwind v4 CSS vars, grain, receipt motif, hero card brackets
- CSV pipeline: Web Worker, format autodetect (TD Chequing/Visa, Capital One), merchant normalization
- 3 local notifications: Sunday 9am, Tuesday 9am, Day 6 10am redeploy reminder
- Phase engine + behaviour signals (deterministic, shared package)
- 18 tests passing, all packages typecheck clean, client builds

## What's NOT built yet (next session priorities)

1. **Accounts UI** — no create/manage UI; CSV import is broken without valid account IDs
2. **Debt add/edit UI** — list shows but no entry form
3. **Split add/settle UI** — Lindsay Mexico debt seeded at $0, no entry UI
4. **Review queue resolve UI** — count on Today but no actual resolve flow
5. **Pay period detection** — worker route exists, paycheque-detection logic not written
6. **Routing plan UI** — worker generates it, nothing displays it
7. **Behaviour signals nightly computation** — snapshots table exists, no compute job
8. **Market data fetch routes** — Twelve Data / FMP / BoC not implemented
9. **iOS cap add ios** — iOS project folder doesn't exist yet, `cap:run` will fail
10. **Wrangler v3 → v4** — warnings only, not broken

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
