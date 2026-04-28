# Declyne — Full Behavioral Rebuild Plan

## What This Is

The accounting substrate is complete. GL, plan kernel, AR/AP, period close, severity, holdings — all live. What Declyne does not have yet is *behavior*: the app doesn't drive action, doesn't surface wins, and doesn't route the user toward the most important thing next.

This plan rebuilds the app's behavior from the payment plan outward — then extends it across every screen gap identified in the design audit. Eleven sessions. Every gap addressed. Work session by session; each ends green and deployed.

---

## The Behavioral Spine

The payment plan is the center of the user's financial life in Declyne. Everything else is context.

- **Plan = contract.** Accepting the plan writes installment rows. Schedule is frozen until the user re-accepts.
- **Installment = primary action object.** Surfaces in Today (hero slot), Budget (above the tank), Reconciliation (adherence check), Notifications (3-day warning).
- **Paid installment = win.** PAID stamp in gold. Streak increments. Footer copy changes. App acknowledges it.
- **Early payment = celebrated.** Clearing Capital One before the due date is noticed and marked ahead-of-schedule.
- **Missed installment = honest, not punishing.** Severity bumps. Plan offers to re-accept. Information, not shame.
- **Every win teaches.** First installment paid triggers a one-time toast that names what just happened and why it matters.

---

## UI Rules (Locked)

### Surface Types

Two surfaces. Every screen belongs to one. Do not mix within a screen.

**Cream receipt** — records, rituals, moments. The app showing you what happened or asking you to confirm something. Thermal paper texture, dark ink, perforated sections, mascot sigil + wordmark header.

Use for: Today, Reconciliation, Plan (/budget/plan), individual Counterparty views, Trial Balance, P&L, Forecast (event list view).

**Dark leather ledger** — working surfaces, navigation, planning. The desk you sit at. Dark shell, ledger-section system, `.hero-num-dark`, ledger rows with `.cat-rule` prefixes.

Use for: Budget, Yield, Debts, Settings, Phase Journey, Net Worth trend, Subscriptions audit, Tax year view.

---

### Button Vocabulary (locked session 57, sweep incomplete)

Four types. One per role. No mixing.

| Type | Visual | When to use | Examples |
|------|--------|-------------|---------|
| **Tear-tab** + flanking cut lines | Primary, one per screen max | Committing, submitting, accepting | Accept plan, Import CSV, Draft paycheque |
| **Postage stamp** (tilted, dashed perf) | Ceremony, AI-call, ritual | Refreshing, sealing, sending | Refresh rationale, Seal reconciliation, Send payment link |
| **Ink margin glyph** (mascot purple `▸`) | Inline, contextual | Edit, resolve, pay early | Categorize in review, Pay early on installment |
| **Sticker / appliqué** | Ad-hoc, destructive, export | Things with side effects or no undo | Export CSV, Purge data, Clear token |

**Pages that still need the sweep (Session A):**

- `Counterparty.tsx:185` — "Send link" is `.stamp stamp-purple` → postage
- `Plan.tsx:187` — "Refresh" is `.stamp stamp-square` → postage
- `Review.tsx:138` — categorize is `.stamp stamp-square` → ink glyph `▸`
- `Settings.tsx:330` — Export CSV is `.stamp` → sticker
- `Settings.tsx:346` — Purge / Clear token are `.stamp stamp-danger` → sticker-warn

---

### Win Vocabulary

Wins surface on cream receipt surfaces only. Not intrusive. No confetti. Visual and copy only.

- **PAID stamp** — gold ink, rotated ~1.5deg, animates over the installment row when marked paid. Scale 0 → 1.1 → 1 over 280ms.
- **Streak pill** — existing gold pill. Increments on each plan payment made.
- **Receipt footer evolution** — Today footer changes when a win lands this week. Default: `** still printing **`. After first plan payment this week: `** Capital One — done **`.
- **First-win toast** — one-time only, slides up for 5s. Copy via goodfit. Intent: "That's $1,365 toward getting out. Bookkeepers call it servicing your debt. You just did it." Term enters the UI permanently.
- **Ahead-of-schedule marker** — paid before due date → gold `EARLY` label tag alongside PAID stamp.

---

## Screen-by-Screen Plan

### Today (cream receipt)

**Changes across sessions:**

Hero slot is context-driven (priority order):
1. Plan installment due within 7 days + plan active → installment is the hero. Debt name + amount. Due date + days remaining. Ink glyph `▸ pay early`.
2. Paycheque landed within 24h + plan not yet accepted → hero is "New paycheque. Accept this period's plan." with tear-tab to `/budget/plan`.
3. No active installment, no fresh paycheque → current hero cycling (tank / payday / streak) stays.

Queue stays chronological. Plan installments not in the hero slot appear in queue with a postage glyph prefix (visually distinct from bills — "you initiate this" vs "this happens to you").

**Committed spend signal in queue:** when committed spend (bills within 7 days + pending plan installments) exceeds tank remaining, a sienna warning row appears at the top of the queue: "Committed spend of $X exceeds your $Y remaining."

Footer evolves when a win lands this week.

**What doesn't change:** receipt chrome, mascot, edition plate header, reconciliation prompt on Sunday.

---

### Budget (dark leather)

**New hierarchy:**

When plan is accepted for the current period:
1. **01 Payoff plan** — top section. Total capacity, installment count, total toward debt, progress bar (% of total owed paid since plan first accepted). Link to `/budget/plan`.
2. **02 This paycheque** — the tank. Unchanged. Tank overlay gains a second line: `FREE $X · COMMITTED $Y` where committed = pending installments + bills within 7 days.
3. **02b Budget vs. actual** — new ledger section below tank. Per-category: planned (from allocations) vs. spent (from transactions). Delta column: over/under per category. Surfaced as a collapsible ledger section.
4. **03 Net worth** — unchanged. Link to net worth trend sub-page.
5. **04 Debts** — unchanged. DTI ratio surfaced as a caption: "Debt payments are X% of monthly income."
6. **05 Open tabs** — unchanged.
7. **06 Goals** — existing goals strip, extended with projection: "Vacation Fund — on track for June 15."

When no accepted plan: "01 Payoff plan" shows "No plan accepted" with tear-tab "Draft and accept." Hard to miss.

**What doesn't change:** tank visual, band colors, mini tanks, ledger row system.

---

### Plan (/budget/plan, cream receipt)

**Draft state** (no accepted plan for this period):
- Same hero: capacity, total interest, saves $X vs minimums.
- Same per-debt rows with role tags.
- Same AI rationale section with postage stamp Refresh.
- New: debt payoff timeline section below per-debt rows. A horizontal sequence: "Capital One — Month 8 → TD Visa — Month 14 → Debt free." Plain text, no chart library needed.
- New: "Accept this plan" tear-tab at bottom. Only tear-tab on the page.

**Active state** (plan accepted):
- Header: "Accepted — [paycheque date]" with sage `ACTIVE` label tag.
- Per-debt rows flip to installment rows: debt name + role tag + amount + due date + status badge (PENDING / PAID / MISSED / EARLY). Ink glyph `▸ pay early` on PENDING rows.
- Payoff timeline stays visible in active state.
- AI rationale unchanged.
- Link at top right: "Recalculate ▸" — returns to draft state with fresh kernel output.

**What doesn't change:** receipt chrome, PAYOFF PLAN wordmark, expandable 12-month schedule rows.

---

### Reconciliation (cream receipt)

**New section:** "THIS WEEK'S PLAN" — between Summary and Accounts.

Shows installments due within the current Sun-Sat reconciliation week.

Each row: debt name + planned amount | status: `PAID` (sage, auto-matched) / `PENDING` (ink-muted + `▸ mark paid`) / `MISSED` (sienna).

Summary line: "2 of 3 plan payments confirmed this week."

Sealing does not require plan confirmation. A missed installment records the miss, bumps severity, appears in seal log.

**What doesn't change:** streak, summary totals, per-account cleared/uncleared lists, seal button.

---

### Counterparty drill-in (cream receipt)

**Addition:** each open chit gains an aging indicator. Days since `created_at` displayed in a muted label tag: `8 DAYS`, `23 DAYS`, `45 DAYS`. Color-shifts at thresholds: ink-muted < 14d, gold 14-30d, sienna > 30d. No new routes needed — `created_at` already in the split response.

---

### Debts (/debts, dark leather)

**Additions:**
- When a debt has a pending installment this period: small postage glyph on the card.
- Debt-to-income ratio surfaced as a header caption above the debt list: "Monthly debt payments: $X — Y% of income." Computed from `SUM(min_payment_cents)` vs. `settings.essentials_monthly_cents` or GL salary average.

---

### Yield — no changes this plan

---

### New sub-pages and surfaces (added as ledger sections or sub-routes)

These are added to existing tab navigation as linked sub-pages. No new top-level tabs.

**`/budget/forecast`** — Forward projection (dark ledger surface)
A 30-day event timeline. Each row: date + event type (PAYCHEQUE / BILL / PLAN PAYMENT) + amount + projected running balance. Computed from: recurring detector predictions + plan installment due dates + paycheque schedule. Shows where the balance goes negative if it does. Linked from Budget below the tank as "04 Next 30 days →".

**`/budget/pl`** — Income statement / P&L (cream receipt)
Plain English for the current period and prior 3 periods. Header: "INCOME STATEMENT" wordmark. Three numbers: Income (salary + any other income category) / Expenses (essentials + lifestyle + indulgence + debt service) / Surplus or Deficit. Below: per-category expense breakdown. Per-period tabs or a simple selector. Computed from GL journal entries grouped by account type. Linked from Budget as "05 Income statement →".

**`/budget/subscriptions`** — Subscription audit (dark ledger)
Recurring charges from the recurring detector, filtered to lifestyle + indulgence categories (discretionary). Each row: merchant name + monthly cost + months running. Sorted by cost descending. No new data — the recurring detector already has this. Linked from Budget or Settings. The user can see forgotten subscriptions.

**`/settings/tax`** — Tax year view (dark ledger)
Canadian-specific. Sections:
- Year-to-date income (from GL salary entries, Jan 1 to today)
- TFSA contributions this year (holdings transactions tagged to TFSA wrapper, summed)
- FHSA contributions this year (same, FHSA wrapper)
- RRSP contributions this year (same, RRSP wrapper)
- Contribution room: hard-coded 2026 annual limits (TFSA $7,000, FHSA $8,000) minus year-to-date. RRSP room requires prior-year income — surfaced as "estimated" only.

No external API. No CRA integration. Numbers are from the GL and holdings tables. A snapshot, not authoritative. Labeled clearly as such.

**Net worth trend** — extended from the existing net worth row on Budget
Tapping the Net Worth row on Budget goes to a sub-page. Currently it goes to `/settings/trial-balance`. Change destination to `/budget/net-worth`. New ledger page: net worth at each period close (computed by querying GL at each `period_close.period_end` date). Displayed as a vertical list of period-end dates with net worth value — the trend is visible by reading down. No chart library. Plain ledger rows.

**Search** — accessible from Settings as "Search transactions" or from a long-press on the Today mascot header
New route: `GET /api/transactions/search?q=&from=&to=&account_id=&category_group=&limit=`.
Query matches against `description_raw`, `description_normalized`, and `merchant_id` (joined merchant display_name).
Client: a bottom sheet with a text input and filter chips (account, category, date range). Results as `.row-tap` lines in the sheet. Cream receipt surface for results. No new page — sheet only.

---

## Schema Changes Required

### New table: `plan_installments`

```sql
CREATE TABLE plan_installments (
  id TEXT PRIMARY KEY,
  pay_period_id TEXT NOT NULL REFERENCES pay_periods(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),
  due_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'missed', 'early')),
  settled_at TEXT,
  settled_txn_id TEXT REFERENCES transactions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX plan_installments_period_idx ON plan_installments(pay_period_id);
CREATE INDEX plan_installments_debt_idx ON plan_installments(debt_id);
CREATE INDEX plan_installments_due_idx ON plan_installments(due_date);
CREATE INDEX plan_installments_status_idx ON plan_installments(status);
```

### `plan_cache` additions

Two nullable columns (additive, no migration drama):
- `accepted_at TEXT` — ISO timestamp when user tapped Accept; NULL = draft
- `accepted_for_period_id TEXT REFERENCES pay_periods(id)`

### No other new tables required.

All new surfaces (P&L, forecast, subscriptions, tax year, net worth trend, search) compute from existing tables: `journal_entries`, `journal_lines`, `gl_accounts`, `transactions`, `recurring` (from detector), `plan_installments`, `holdings`, `period_close`.

---

## Session Breakdown

Sessions are ordered by impact for the target user. Each session ends green: `pnpm test` + `pnpm -r typecheck` + `pnpm --filter @declyne/client build`. Worker redeploys via CI on push. No uncommitted work at handoff.

---

### Session A — Button vocabulary sweep (0.5 sessions)
Fix 5 pages with wrong button types. Verify every screen is on the correct surface (cream vs ledger). No schema changes, no new routes.

Pages: Counterparty, Plan, Review, Settings (export + purge).

---

### Session B1 — Plan commitment: schema + routes (1 session)
- Migration: `plan_installments` table + `plan_cache` two new columns
- `POST /api/plan/accept` — writes installment rows, stamps `accepted_at`
- `PATCH /api/plan/installments/:id` — mark paid / missed / early manually
- `POST /api/plan/installments/auto-match` — link cleared transactions to pending installments (amount + ±3d window)
- `GET /api/plan` extended to return installments array for current period
- 15-20 new tests

---

### Session B2 — Plan commitment: UI + wins (1 session)
- Today: hero slot logic for installment + paycheque-landed states
- Budget: plan section moves above tank; `FREE / COMMITTED` overlay line on tank
- Plan page: draft/active states, payoff timeline, PAID stamp animation, pay-early flow
- Reconciliation: "THIS WEEK'S PLAN" section
- Win vocabulary: PAID stamp CSS, footer copy logic, first-win toast component

---

### Session C — Notifications rebuild (0.5 sessions)
- `GET /api/notifications/schedule` route — returns `{title, body, fire_at}[]` from live data
- Client: on launch, fetch + cancel existing + re-register Capacitor LocalNotifications
- Dynamic: installment due in 3 days, bill due tomorrow, paycheque landed, tank pacing
- Static Sunday + Tuesday stay

Copy via goodfit at implementation. Voice: direct, a bit dark, never cheerleading.

---

### Session D — Progressive vocabulary (1 session)
- `user_vocabulary_level` setting (0–4), initialized to 0
- Milestone hooks in: import route, reconciliation route, plan accept route
- Toast component (cream receipt overlay, 5s, dismissable)
- Four milestone messages via goodfit skill

| Level | Milestone | Trigger |
|-------|-----------|---------|
| 0 | Install | Default |
| 1 | First import | CSV import completes |
| 2 | First reconciliation | `POST /api/reconciliation/complete` |
| 3 | First plan payment | First installment marked paid |
| 4 | 3 consecutive plan periods | Computed at acceptance time |

Terms introduced become permanent UI labels after their toast fires.

---

### Session E — Committed spend + budget vs. actual + zero-based prompt (1 session)

**Committed spend:**
- New pure helper `committedCents(recurringBills, pendingInstallments, daysWindow)` — sums recurring bills due within `daysWindow` + all pending installments for the period
- `GET /api/budget/tank` extended to return `committed_cents` and `truly_free_cents` (remaining - committed, clamped to 0)
- Tank overlay gains `FREE $X · COMMITTED $Y`
- Today queue: sienna warning row if committed exceeds remaining

**Budget vs. actual:**
- New route `GET /api/budget/variance` — returns per-category: `planned_cents` (sum of allocation rows by group), `spent_cents` (sum of transactions by group for the current period), `delta_cents`
- New ledger section "02b Budget vs. actual" on Budget below the tank
- Per-category rows: category dot + label + planned + spent + delta (sienna when over, sage when under)

**Zero-based prompt:**
- `GET /api/budget/allocations` already returns `unassigned_cents`
- When `unassigned_cents > 0` after draft, Budget section 01 shows a sienna note: "$X unassigned — give every dollar a job." with ink glyph `▸ allocate` linking to the allocation sheet

---

### Session F — P&L + net worth trend (1 session)

**P&L / income statement:**
- New route `GET /api/gl/pl?period_id=` — from GL, sums: income-type accounts (credit-DR) = income_cents, expense-type accounts (DR-credit) = expense_cents, surplus = income - expense
- New sub-page `/budget/pl` (cream receipt): INCOME STATEMENT wordmark, three hero numbers (Income / Expenses / Surplus or Deficit), per-category expense breakdown, period selector for last 4 periods
- Linked from Budget as a ledger row

**Net worth trend:**
- New route `GET /api/gl/net-worth/history` — queries net worth at each `period_close.period_end` date (already have `GET /api/gl/net-worth?as_of=`, run it per close date)
- Change Budget net worth row link destination from `/settings/trial-balance` to `/budget/net-worth`
- New sub-page `/budget/net-worth` (dark ledger): per-close-date rows showing date + net worth value. The trend is the list. No chart library needed.

---

### Session G — Forward projection + debt payoff timeline + goals projection (1 session)

**Forward projection:**
- New route `GET /api/forecast?days=30` — builds event list from: recurring bills (detector), plan installments (due_date), paycheque schedule (next period start). Each event: `{date, type, label, amount_cents, running_balance_cents}`. Running balance starts from current chequing GL balance.
- New sub-page `/budget/forecast` (dark ledger): 30-day event list, each row: date + type dot + label + signed amount + running balance. Balance turns sienna when it goes negative.
- Linked from Budget as "Next 30 days →"

**Debt payoff timeline:**
- Added to Plan page (both draft and active states)
- Computed from plan kernel's per-debt `payoff_months`. Rendered as a horizontal perforated sequence on the receipt: "Capital One — Month 8 → TD Visa — Month 14 → Debt free — Month 14."
- No new route — plan kernel already returns `payoff_months` per debt

**Goals projection:**
- `GET /api/goals` extended with `projected_complete_date` — computed as: `(target_cents - progress_cents) / savings_allocation_per_period` × paycheque cadence
- Goals section on Budget gains the projection caption per goal

---

### Session H — Search (0.5 sessions)
- New route `GET /api/transactions/search?q=&from=&to=&account_id=&category_group=&limit=` — queries `description_raw`, `description_normalized`, joined `merchants.display_name`
- Client: search sheet (bottom sheet, cream receipt). Text input + filter chips (account, category, date range). Results as `.row-tap` lines with description + date + account + amount.
- Entry point: Settings "Search transactions" row, or long-press on Today header mascot.

---

### Session I — Period-over-period + subscription audit (1 session)

**Period-over-period by category:**
- New route `GET /api/budget/history?periods=6` — returns last N closed periods, per-period spend by category group
- New ledger section on Budget: "Spending history — 6 periods." Collapsible. Per-category rows showing 6 period values inline (monospace, scannable). Lifestyle creep visible by reading across.

**Subscription audit:**
- The recurring detector already runs on import. Filter its output to `lifestyle` + `indulgence` categories.
- New route `GET /api/budget/subscriptions` — returns recurring charges in discretionary categories with: merchant, predicted monthly cost, months running (first_seen to now ÷ cadence)
- New sub-page `/budget/subscriptions` (dark ledger): SUBSCRIPTIONS kicker, per-merchant rows sorted by cost. Amount per month on the right. Months running as hint. No cancel button — this is an audit, not a management surface.
- Linked from Budget or Settings.

---

### Session J — Counterparty aging + DTI + CC mismatch (1 session)

**Counterparty aging:**
- No new routes. `created_at` already returned in split responses.
- Counterparty drill-in: each open chit gains a label tag showing days open. Color by age bucket (ink-muted < 14d, gold 14-30d, sienna > 30d).
- Counterparties list on Budget "Open tabs" section: add age of oldest open tab per person as a hint.

**Debt-to-income ratio:**
- New pure helper `debtToIncome(monthlyDebtPayments, monthlyIncome)` — returns bps
- Surfaced as a caption on the Debts page header: "Monthly minimums: $X — Y% of income. Stress threshold: 36%."
- Computed from `SUM(min_payment_cents)` on non-archived debts vs. `essentials_monthly_cents_derived` or GL salary average.

**CC statement vs. GL mismatch:**
- `reconcileStatements` helper already exists in `debtGl.ts`. No new logic.
- New route `GET /api/gl/statement-reconcile` already exists. Just needs a surface.
- New row in Debts page per linked CC debt: "GL says $X · Statement says $Y · Gap $Z" in muted caption when gap != 0. Tapping it goes to the CC Statements sub-page.

---

### Session K — Tax year view + merchant spend + period surplus/deficit (1 session)

**Tax year view:**
- New route `GET /api/settings/tax-year?year=` — returns: income YTD (GL salary entries Jan 1 to today), holdings contribution totals per wrapper this year (from holdings + any holding-tagged transactions), annual limits hard-coded for 2026 (TFSA $7,000, FHSA $8,000).
- New sub-page `/settings/tax` (dark ledger): TAX YEAR kicker, year selector, income section, TFSA / FHSA / RRSP contribution sections each with used / limit / remaining. RRSP labeled "estimated — based on prior income."
- Linked from Settings "Data" section.

**Merchant spend totals:**
- `GET /api/merchants` extended to include `spend_90d_cents` — SUM of transaction amounts for that merchant in the last 90 days.
- Merchants page: add spend total to each row. Sort option: by spend (default) vs. by name.

**Period surplus/deficit history:**
- New route `GET /api/periods/history?limit=8` — per closed period: income_cents, expense_cents, surplus_cents (income - expense), computed from GL
- New collapsible section on Budget or Phase Journey: "08 Period history." Per-period row: date range + surplus/deficit amount. Sage for surplus, sienna for deficit. The user can see whether they're consistently running a surplus.

---

## What Does Not Change

- Three tabs: Today / Budget / Yield
- Receipt motif and ledger desk CSS system — no new surface types
- GL, journal entries, period close, locked JEs
- AR/AP, splits, counterparties, reconciliation streak
- Severity system, plan kernel math, AI rationale
- workers.dev URL — no domain, ever
- `plan_cache` rationale caching — stays, gains two columns
- Auto-close on reconciliation seal
- Backfill admin routes

---

## Definition of Done

Each session ends green: `pnpm test` + `pnpm -r typecheck` + `pnpm --filter @declyne/client build` all pass. Worker redeploys via CI on push. No uncommitted work at handoff.

The app is complete when:
- Accepting a plan writes installments visible everywhere
- A paid installment stamps PAID in gold and the footer knows about it
- Paying early is possible and acknowledged
- Today tells you what to do, not just what happened
- The committed vs. free distinction is always visible
- The phone speaks up before things go wrong
- Forward projection shows where the balance goes
- Search finds any transaction in seconds
- The debt timeline shows the light at the end
- Every accounting term introduces itself when earned
- Tax year and contribution room are a tap away
- Lifestyle creep is visible in the period history
- Forgotten subscriptions can be audited
