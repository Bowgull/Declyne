# Connect plan

The Declyne audit (session 99) found that surfaces compute the same facts independently, queue items live in five places that don't talk to each other, and habit data is collected but never feeds the math that's supposed to use it. The promise of "collect habits, surface ways to save, help pay off debt" is half built. The collection works. The feedback loop doesn't exist.

This plan closes those gaps session by session. Every session lands green per the ritual: tests + typecheck + build + memory + CLAUDE.md update + commit. No flag days. No half migrations. Each session ships independently and the app stays usable in between.

## The invariant we're building toward

Every fact lives in one place. Every surface derives from that fact. The Today queue, the sub-category queue, the review queue, the tabs-to-match queue, the uncleared lines, the pending subscription verdicts are slices of one master queue, never separate sources. Reconciliation closes when the master queue is empty (or each item is explicitly acknowledged outstanding). The GL is the only read source for balances. Habits feed the plan AI, the goal projections, and the recommendations that show up on Today.

When that invariant holds, "I kept the receipts" means the books are actually closed. Until it holds, reconciliation is a button click.

## Session sequencing

10 sessions. Foundation first, then connect, then optimize. The order is load bearing because later sessions assume the substrate from earlier ones.

---

### Session 1. Master queue substrate

Build the route and the type that becomes the single source of "what needs your attention."

`GET /api/queue` returns one shape:

```ts
{
  items: QueueItem[];
  total: number;
  by_kind: Record<QueueKind, number>;
}
```

`QueueKind` covers every open-loop today: `bill`, `payday`, `plan_installment`, `reconcile`, `review_uncategorized`, `sub_category_unconfirmed`, `sub_category_stale`, `tab_to_match`, `uncleared_line`, `subscription_pending_verdict`, `statement_mismatch`, `counterparty_stale`.

Each item carries `kind`, `id`, `label`, `meta`, `due_date | null`, `tier` (0 ritual, 1 bill, 2 plan, 3 payday, 4 admin), `href`, optional `amount_cents`.

Pure helpers: `buildMasterQueue(inputs, today)` takes everything the route already loads (recurring detector output, plan, debts, splits, journal lines, sub-cat queue rows, review rows, subscription verdicts) and returns the unified list. No new SQL, no new tables. Just composition.

Done condition: route returns the right items. 15+ tests on `buildMasterQueue` covering every kind. Today.tsx and Reconciliation.tsx still work unchanged because they don't read it yet.

### Session 2. Today reads the master queue

Today.tsx stops stitching its own queue. It calls `/api/queue`, sorts by tier+date, shows top 3 with "+ N more" expand. Sub-category unconfirmed rows surface here too (tap routes to `/books?view=patterns#sub-categories` and scrolls to the queue).

Up Next becomes truthful. If the user has 14 sub-cat unconfirmed and 2 stale, that's 16 rows of "now" tier work that show up on Today, not buried two taps deep.

Done condition: Today queue size matches `/api/queue` total. The 5-cap and "see all in paycheque" overflow still works, but "see all" routes to a new `/queue` page (full list, no truncation) instead of `/paycheque`.

### Session 3. Reconciliation seal blocks until master queue is empty

`POST /api/reconciliation/complete` already checks uncleared journal lines. Extend it to check master queue: if `total > 0` and the user hasn't passed `acknowledge_outstanding: true`, return 409 with the breakdown by kind.

Reconciliation.tsx surfaces the master queue above the existing Tabs to match section. Each kind renders as a tappable row with count and direct link. Sealing while items remain writes per-kind `reconciliation_seal_outstanding` edit_log rows so the audit trail records what was acknowledged.

Done condition: cannot seal a clean week with 16 sub-cat unconfirmed rows without explicitly acknowledging. If acknowledged, the count is preserved in edit_log so we can show "you sealed Apr 26 with 16 sub-cat items still open" later.

### Session 4. Batch approve UX fix

Three small changes, one session.

1. The inline tray editor opens regardless of `picked.size`. Touching it doesn't exit stack mode. Override applies to that one row.
2. `allConfirmable` becomes `someConfirmable`. Approve stack processes rows that have a sub (guess or override), reports skipped count for the rest. The button stays enabled as long as one row is approvable.
3. After approve, skipped rows stay picked so the user sees what's left.

Also: when the queue surfaces a row with no detector guess, the row label shows `unrecognized` in sienna so the user knows it needs manual input before it can be approved.

Done condition: 5-row stack with 2 unrecognized approves the 3 with guesses, leaves 2 picked, message reads `3 approved, 2 need a sub-category`.

### Session 5. Single recurring detector pass per request

`detectRecurring` runs four times per typical Today render: today.ts, periodIntelligence.ts, forecast.ts, budget.ts/subscriptions. Same SQL, same data, four runs, four chances for the window math to drift.

New: `apps/worker/src/lib/recurringContext.ts`. One async function `loadRecurringContext(env, today, horizonDays)` that runs the SQL once, runs the detector once, returns `{ recurring, subscriptions, bills_in_window, savings_in_window }`. Routes that need it accept it as an arg. Cached per request via Hono's `c.get('recurring')` if the same request needs it twice.

Done condition: every detector caller goes through `recurringContext`. SQL runs once per request. Detector runs once per (today, horizonDays) pair.

### Session 6. Habit context substrate

The thing the plan AI and goal projections will both read from.

New `apps/worker/src/lib/habitContext.ts`. Pure helper `buildHabitContext({ merchants, subscriptions, lifestyle_baseline, indulgence_baseline })` returns:

```ts
{
  by_sub_category: Array<{
    sub: string;        // 'bars', 'takeout', 'weed', etc
    spend_30d_cents: number;
    spend_90d_cents: number;
    monthly_burn_cents: number;
    velocity: 'accelerating' | 'steady' | 'cooling';
    merchant_count: number;
    top_merchants: Array<{ name, spend_90d_cents }>;  // top 3
  }>;
  subscription_bleed: {
    monthly_cents: number;
    annual_cents: number;
    kill_candidates: Array<{ name, monthly_cents, reason }>;  // verdict=null + over $10/mo
  };
  hot_categories: string[];  // accelerating subs sorted by spend
  cold_categories: string[]; // cooling subs sorted by spend
}
```

This is the same data the Habits map already shows, but composed for math instead of pixels. No DB schema changes. New route `GET /api/habits/context` for client and AI to read.

Done condition: route returns the shape. 12+ tests on `buildHabitContext` covering empty, single sub, multi-sub, velocity bucketing, kill-candidate threshold.

### Session 7. Habit context into the plan AI rationale

`POST /api/plan/refresh` payload extended with `habit_context: HabitContext`. System prompt extended:

> 9. You may cite specific sub-category spend (e.g. "bars at $400/month") when explaining where capacity could grow. Numbers must come from `habit_context.by_sub_category`.
> 10. You may cite kill candidates (e.g. "Spotify at $13/mo is undecided") only if `habit_context.subscription_bleed.kill_candidates` lists them.
> 11. Observations may name 1-2 specific subs as drag on capacity. No advice. No "you should." Just the observation.

Plan rationale now reads:
> "Capital One is past due so it's first. Bars at $387 last 30 days are accelerating; if that cools, capacity grows. Capital One clears in 4 months at the current rate."

Done condition: rationale cites at least one sub-category dollar figure when capacity > 0 and habit_context has data. Mock test verifies prompt includes the context.

### Session 8. Habit context into goal projections

`GET /api/goals` already returns `projected_complete_date`. Extend to return `what_if`:

```ts
{
  ...goal,
  projected_complete_date: '2026-12-15',
  what_if: Array<{
    sub: 'takeout',
    cut_pct: 50,
    monthly_freed_cents: 12000,
    new_complete_date: '2026-10-22',
    months_saved: 2,
  }>;  // top 3 cuts ranked by months_saved
}
```

Pure helper `projectGoalWithCuts(goal, habit_context)` runs the projection once with current pace, then for each top-spend sub simulates a 50% cut redirected to the goal. Top 3 by `months_saved` returned.

Goals page renders below each goal: "cut takeout 50% → finishes 2 months sooner."

Done condition: goals route returns what_if for each active goal where habit_context has accelerating subs. 8+ tests on `projectGoalWithCuts`.

### Session 9. Yield and Counterparties read from GL

Two parallel migrations, one session.

Yield: `GET /api/investment/holdings` switches `SELECT * FROM holdings` to `SELECT * FROM gl_accounts WHERE path LIKE 'Assets:Investments:%'` joined to holdings for ACB metadata. Holdings table stays as the lot ledger; GL becomes the balance source. Yield page math derives from GL.

Counterparties: `GET /api/counterparties` aggregates `gl_balance_cents` from `Assets:Receivable:<Name>` instead of summing `splits.remaining_cents`. List view becomes truthful against the GL.

Done condition: trial balance still equal. Yield total matches what `/api/gl/net-worth` reports for the investment subtree. Counterparties drill-in matches list aggregate matches GL balance for every counterparty.

### Session 10. Parity tests + seed tune

Two GL-vs-legacy parity checks added to the test suite that run on real seed data:

1. For every counterparty, `splits.remaining_cents` aggregate equals `gl_accounts` receivable balance.
2. For every holding wrapper, `holdings.units * latest_price` equals `gl_accounts` Assets:Investments:Wrapper:* balance (within rounding).

If either drifts, tests fail loud. Drift means the GL or the legacy table is wrong; either way we want to know on every push.

Seed adjustment: shift one or two recurring bill `last_seen` dates so at least one bill falls inside the current paycheque window. The Money map's BILLS hub renders on the seed.

Done condition: parity tests green on seed. Money map shows BILLS hub. Both run on every CI build.

---

## What this plan does not include

- Splitting the receivable layer into AR-only or merging splits into journal entries directly. Two systems, one parity check, drift visible.
- Removing the review queue in favor of the master queue. Review is one kind in the master queue; the legacy `/review` page is the kind-filter view.
- Animation, new tabs, new top-level navigation, new screens. Net Worth, Trial Balance, /budget/plan, /queue (new this plan) are sub-pages of existing tabs.
- Multi-user, demo mode, or the Phases 2-6 showcase work. Separate program.

## Done state

After session 10:

- One queue. Every open loop surfaces in `/api/queue`. Today reads it. Reconciliation seals on it.
- Habit data feeds the plan AI and the goal projections. Sub-category confirmation has consequences.
- GL is the read source for receivables and investments. Two parity tests prevent silent drift.
- Bills appear on the Money map when they belong to the current paycheque.
- Trial balance equal, books closed when sealed, sealed weeks recorded with what was acknowledged outstanding.

That's the connected version. The version where reconciliation is the point and habits actually drive what the app recommends.
