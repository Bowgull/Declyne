// Session 72: unified paycheque snapshot.
//
// Until now the payment-plan kernel computed capacity from a 90-day rolling
// "essentials_monthly_cents" average. That number ignores what's actually
// coming up: Rogers due in 3 days, the savings sweep that fires on Friday,
// the goal contribution. So the kernel happily recommends $1,400 toward debt
// when $400 of that is already spoken for. This module turns the islands
// (recurring detector, debts, goals, lifestyle history) into one honest
// "real available this paycheque" number.
//
// Pure helpers below the impure orchestrator. Orchestrator pulls live data
// from D1; helpers know nothing about D1 and are individually tested.
//
// Vocabulary:
//   bills      = recurring 'essentials' or 'lifestyle' charges due before
//                period.end_date (NOT debt — debt mins are separate; NOT
//                transfer — transfers are savings sweeps).
//   savings    = recurring 'transfer' sweeps in window + goal per-paycheque
//                contributions.
//   debt_mins  = sum of minimum payments from the debts table (kernel input).
//   lifestyle_baseline = last-90d lifestyle spend per paycheque. The squishy
//                middle: groceries, gas, takeout. Without this the kernel
//                pretends the user can live on bills + indulgence alone.
//
// Money for "spending" (the user's framing) = paycheque − committed −
// recommended_debt_extra. The lifestyle baseline + indulgence allowance are
// what the user actually spends out of that bucket.

import type { Env } from '../env.js';
import {
  detectRecurring,
  type RecurringPrediction,
  type RecurringTxn,
} from './recurring.js';
import { minPaymentCents, type PlanDebtInput } from './paymentPlan.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommittedSource =
  | 'bill'
  | 'debt_min'
  | 'savings_goal'
  | 'savings_recurring';

export interface CommittedLine {
  source: CommittedSource;
  label: string;
  amount_cents: number;
  due_date?: string; // YYYY-MM-DD when known
  ref_id?: string; // debt_id / goal_id / merchant_id when applicable
}

export interface CommittedTotals {
  bills_cents: number;
  debt_mins_cents: number;
  savings_cents: number;
  total_cents: number;
}

export interface PaycheckCommitments extends CommittedTotals {
  lines: CommittedLine[];
}

export interface BillForCommitment {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number;
  due_date: string;
  days_until: number;
  category_group: string;
}

export interface DebtMinForCommitment {
  id: string;
  name: string;
  min_cents: number;
}

export interface GoalForCommitment {
  id: string;
  name: string;
  per_paycheque_cents: number;
}

export interface RecurringSavingsForCommitment {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number;
  due_date: string;
}

export interface PaycheckSnapshot {
  period: { id: string; start_date: string; end_date: string };
  paycheque_cents: number;
  committed: PaycheckCommitments;
  // What the kernel can recommend toward debt extras after honest commitments.
  available_for_debt_extra_cents: number;
  // The amount the user actually has to live on after committed + debt extra.
  // (lifestyle baseline + indulgence allowance combined into a single number;
  //  the user can spend this on whatever discretionary categories they want.)
  spending_money_cents: number;
  // Underlying inputs the kernel receives.
  baseline: {
    lifestyle_per_paycheque_cents: number;
    indulgence_per_paycheque_cents: number;
  };
  // Spend already booked this period (existing tank semantics).
  spent_so_far_cents: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

// Categorize a recurring prediction. Bills are essentials/lifestyle outflows
// in window. Debt-group recurring are CC payments (transfer-shaped from the
// chequing side); we ignore them here because the kernel handles debt mins
// from the debts table directly. Transfer recurring become savings sweeps.
export type RecurringBucket = 'bill' | 'savings' | 'debt' | 'skip';

export function bucketRecurring(category_group: string): RecurringBucket {
  if (category_group === 'essentials' || category_group === 'lifestyle') return 'bill';
  if (category_group === 'transfer') return 'savings';
  if (category_group === 'debt') return 'debt';
  return 'skip';
}

// Filter detected recurring → the bills that fall inside [today, period_end].
// Bills outside the window belong to the next paycheque, not this one.
export function billsInWindow(
  recurring: RecurringPrediction[],
  today: string,
  period_end: string,
): BillForCommitment[] {
  if (today > period_end) return [];
  const out: BillForCommitment[] = [];
  for (const r of recurring) {
    if (bucketRecurring(r.category_group) !== 'bill') continue;
    if (r.next_due < today || r.next_due > period_end) continue;
    if (r.amount_cents <= 0) continue;
    out.push({
      merchant_id: r.merchant_id,
      merchant_name: r.merchant_name,
      amount_cents: r.amount_cents,
      due_date: r.next_due,
      days_until: r.days_until,
      category_group: r.category_group,
    });
  }
  return out;
}

// Same window logic for savings sweeps (recurring transfers).
export function recurringSavingsInWindow(
  recurring: RecurringPrediction[],
  today: string,
  period_end: string,
): RecurringSavingsForCommitment[] {
  if (today > period_end) return [];
  const out: RecurringSavingsForCommitment[] = [];
  for (const r of recurring) {
    if (bucketRecurring(r.category_group) !== 'savings') continue;
    if (r.next_due < today || r.next_due > period_end) continue;
    if (r.amount_cents <= 0) continue;
    out.push({
      merchant_id: r.merchant_id,
      merchant_name: r.merchant_name,
      amount_cents: r.amount_cents,
      due_date: r.next_due,
    });
  }
  return out;
}

// Pure: 90 days of lifestyle spend → per-paycheque baseline.
// 90d ≈ 6.5 bi-weekly paycheques (12 paycheques / 26 paycheques per year × 90).
// Round to int cents. Always non-negative.
export function lifestyleBaselinePerPaycheque(lifestyle_90d_cents: number): number {
  if (!Number.isFinite(lifestyle_90d_cents) || lifestyle_90d_cents <= 0) return 0;
  return Math.max(0, Math.round(lifestyle_90d_cents / 6.5));
}

// Pure: monthly setting → per-paycheque (26 paycheques / 12 months).
export function monthlyToPerPaycheque(monthly_cents: number): number {
  if (!Number.isFinite(monthly_cents) || monthly_cents <= 0) return 0;
  return Math.round((monthly_cents * 12) / 26);
}

// Pure: assemble the committed lines from already-filtered inputs.
export function computePaycheckCommitments(input: {
  bills: BillForCommitment[];
  debt_mins: DebtMinForCommitment[];
  savings_goals: GoalForCommitment[];
  recurring_savings: RecurringSavingsForCommitment[];
}): PaycheckCommitments {
  const lines: CommittedLine[] = [];
  let bills = 0;
  let debtMins = 0;
  let savings = 0;

  for (const b of input.bills) {
    if (b.amount_cents <= 0) continue;
    lines.push({
      source: 'bill',
      label: b.merchant_name,
      amount_cents: b.amount_cents,
      due_date: b.due_date,
      ref_id: b.merchant_id,
    });
    bills += b.amount_cents;
  }
  for (const d of input.debt_mins) {
    if (d.min_cents <= 0) continue;
    lines.push({
      source: 'debt_min',
      label: `${d.name} min`,
      amount_cents: d.min_cents,
      ref_id: d.id,
    });
    debtMins += d.min_cents;
  }
  for (const g of input.savings_goals) {
    if (g.per_paycheque_cents <= 0) continue;
    lines.push({
      source: 'savings_goal',
      label: g.name,
      amount_cents: g.per_paycheque_cents,
      ref_id: g.id,
    });
    savings += g.per_paycheque_cents;
  }
  for (const r of input.recurring_savings) {
    if (r.amount_cents <= 0) continue;
    lines.push({
      source: 'savings_recurring',
      label: r.merchant_name,
      amount_cents: r.amount_cents,
      due_date: r.due_date,
      ref_id: r.merchant_id,
    });
    savings += r.amount_cents;
  }

  return {
    bills_cents: bills,
    debt_mins_cents: debtMins,
    savings_cents: savings,
    total_cents: bills + debtMins + savings,
    lines,
  };
}

// Pure: the kernel's view of "fixed cost this paycheque" — bills + savings
// + lifestyle baseline. Debt mins and indulgence are separate kernel inputs
// so they're NOT included here.
export function essentialsBaselineForKernel(args: {
  bills_cents: number;
  savings_cents: number;
  lifestyle_baseline_cents: number;
}): number {
  const v = args.bills_cents + args.savings_cents + args.lifestyle_baseline_cents;
  return Math.max(0, Math.trunc(v));
}

// Pure: how much is left for the kernel to recommend toward debt extras.
// = paycheque − committed_total − lifestyle_baseline − indulgence_allowance
// (committed_total already includes debt mins, so debt mins don't double-count.)
export function computeAvailableForDebtExtra(args: {
  paycheque_cents: number;
  committed_total_cents: number;
  lifestyle_baseline_cents: number;
  indulgence_allowance_cents: number;
}): number {
  const v =
    args.paycheque_cents -
    args.committed_total_cents -
    args.lifestyle_baseline_cents -
    args.indulgence_allowance_cents;
  return Math.max(0, Math.trunc(v));
}

// Pure: spending money = paycheque - committed - debt extra.
// (lifestyle baseline + indulgence are SUB-BUDGETS within this bucket, not
// reductions of it.)
export function computeSpendingMoney(args: {
  paycheque_cents: number;
  committed_total_cents: number;
  recommended_debt_extra_cents: number;
}): number {
  const v =
    args.paycheque_cents -
    args.committed_total_cents -
    args.recommended_debt_extra_cents;
  return Math.max(0, Math.trunc(v));
}

// ---------------------------------------------------------------------------
// Impure orchestrator
// ---------------------------------------------------------------------------

interface CurrentPeriodRow {
  id: string;
  start_date: string;
  end_date: string;
  paycheque_cents: number;
}

async function loadCurrentPeriod(env: Env): Promise<CurrentPeriodRow | null> {
  const r = await env.DB.prepare(
    `SELECT id, start_date, end_date, paycheque_cents FROM pay_periods
     WHERE start_date <= date('now')
     ORDER BY start_date DESC LIMIT 1`,
  ).first<CurrentPeriodRow>();
  return r ?? null;
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`)
    .bind(key)
    .first<{ value: string | null }>();
  return r?.value ?? null;
}

async function readNumberSetting(env: Env, key: string, fallback: number): Promise<number> {
  const v = await readSetting(env, key);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function loadRecurring(env: Env, today: string, horizonDays: number): Promise<RecurringPrediction[]> {
  const { results } = await env.DB.prepare(
    `SELECT t.posted_at as posted_at,
            t.amount_cents as amount_cents,
            t.merchant_id as merchant_id,
            m.display_name as merchant_name,
            c."group" as "group"
     FROM transactions t
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now', '-90 days')
       AND t.amount_cents < 0
       AND t.merchant_id IS NOT NULL`,
  ).all<RecurringTxn>();
  return detectRecurring(results ?? [], today, horizonDays);
}

interface DebtRow {
  id: string;
  name: string;
  principal_cents: number;
  interest_rate_bps: number;
  min_payment_type: 'fixed' | 'percent';
  min_payment_value: number;
  severity: 'current' | 'past_due' | 'in_collections' | 'charged_off' | 'settled_partial';
  account_id_linked: string | null;
}

async function loadDebts(env: Env): Promise<DebtRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value,
            severity, account_id_linked
     FROM debts WHERE archived = 0`,
  ).all<DebtRow>();
  return results ?? [];
}

async function loadActiveGoals(env: Env): Promise<GoalForCommitment[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, target_cents, target_date, progress_cents
     FROM goals WHERE archived = 0`,
  ).all<{ id: string; name: string; target_cents: number; target_date: string; progress_cents: number }>();
  const today = Date.now();
  return (results ?? []).map((g) => {
    const daysRem = Math.max(14, Math.round((Date.parse(g.target_date) - today) / 86_400_000));
    const periodsRem = Math.max(1, Math.round(daysRem / 14));
    const remaining = Math.max(0, g.target_cents - g.progress_cents);
    return {
      id: g.id,
      name: g.name,
      per_paycheque_cents: Math.ceil(remaining / periodsRem),
    };
  });
}

async function loadLifestyle90d(env: Env): Promise<number> {
  const r = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'lifestyle' AND t.posted_at >= date('now', '-90 days')`,
  ).first<{ s: number }>();
  return r?.s ?? 0;
}

async function loadSpentSoFar(env: Env, periodStart: string, periodEnd: string): Promise<number> {
  // Same shape as /api/budget/tank: count outflows excluding transfer.
  const r = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at BETWEEN ? AND ?
       AND COALESCE(c."group", 'uncategorized') != 'transfer'`,
  )
    .bind(periodStart, periodEnd)
    .first<{ s: number }>();
  return r?.s ?? 0;
}

// Public: snapshot inputs (everything except the kernel run). Returned
// separately so callers that ONLY need the kernel's essentials baseline
// (plan.ts, allocations.draftForPeriod) can skip the snapshot wrapper.
export interface PaycheckInputs {
  period: CurrentPeriodRow;
  today: string;
  recurring: RecurringPrediction[];
  bills: BillForCommitment[];
  recurring_savings: RecurringSavingsForCommitment[];
  debt_mins: DebtMinForCommitment[];
  debt_rows: Array<DebtRow & { plan_input: PlanDebtInput }>;
  savings_goals: GoalForCommitment[];
  lifestyle_baseline_cents: number;
  indulgence_per_paycheque_cents: number;
  charge_velocity_per_debt_cents: Record<string, number>;
}

async function loadChargeVelocity(env: Env, debts: DebtRow[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const d of debts) {
    if (!d.account_id_linked) {
      out[d.id] = 0;
      continue;
    }
    const r = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS s
       FROM transactions
       WHERE account_id = ? AND amount_cents < 0
         AND posted_at >= date('now', '-90 days')`,
    )
      .bind(d.account_id_linked)
      .first<{ s: number }>();
    out[d.id] = Math.round(Math.abs(r?.s ?? 0) / 3);
  }
  return out;
}

export async function loadPaycheckInputs(env: Env): Promise<PaycheckInputs | null> {
  const period = await loadCurrentPeriod(env);
  if (!period) return null;
  const today = new Date().toISOString().slice(0, 10);

  // Forward window: today through period end. Capped at 31 days for the
  // detector horizon (longer cadences fall outside reasonable bill prediction).
  const horizon = Math.max(1, Math.min(31, Math.round((Date.parse(period.end_date) - Date.parse(today)) / 86_400_000) + 1));
  const recurring = await loadRecurring(env, today, horizon);
  const bills = billsInWindow(recurring, today, period.end_date);
  const recurring_savings = recurringSavingsInWindow(recurring, today, period.end_date);

  const debts = await loadDebts(env);
  const debt_mins: DebtMinForCommitment[] = debts.map((d) => {
    const plan_input: PlanDebtInput = {
      id: d.id,
      name: d.name,
      principal_cents: d.principal_cents,
      interest_rate_bps: d.interest_rate_bps,
      min_payment_type: d.min_payment_type,
      min_payment_value: d.min_payment_value,
      severity: d.severity,
    };
    return { id: d.id, name: d.name, min_cents: minPaymentCents(plan_input) };
  });

  const savings_goals = await loadActiveGoals(env);
  const lifestyle_90d = await loadLifestyle90d(env);
  const lifestyle_baseline_cents = lifestyleBaselinePerPaycheque(lifestyle_90d);
  const indulgence_monthly = await readNumberSetting(env, 'indulgence_allowance_cents', 0);
  const indulgence_per_paycheque_cents = monthlyToPerPaycheque(indulgence_monthly);
  const charge_velocity_per_debt_cents = await loadChargeVelocity(env, debts);

  const debt_rows = debts.map((d) => ({
    ...d,
    plan_input: {
      id: d.id,
      name: d.name,
      principal_cents: d.principal_cents,
      interest_rate_bps: d.interest_rate_bps,
      min_payment_type: d.min_payment_type,
      min_payment_value: d.min_payment_value,
      severity: d.severity,
    } as PlanDebtInput,
  }));

  return {
    period,
    today,
    recurring,
    bills,
    recurring_savings,
    debt_mins,
    debt_rows,
    savings_goals,
    lifestyle_baseline_cents,
    indulgence_per_paycheque_cents,
    charge_velocity_per_debt_cents,
  };
}

// Public: the snapshot the /api/paycheque route returns and the future
// Paycheque page consumes. Includes the recommended_debt_extra computed
// from the kernel-style available number (NOT a kernel run — the route can
// run the kernel separately if it wants the per-debt allocations).
export async function loadPaycheckSnapshot(env: Env): Promise<PaycheckSnapshot | null> {
  const inputs = await loadPaycheckInputs(env);
  if (!inputs) return null;

  const committed = computePaycheckCommitments({
    bills: inputs.bills,
    debt_mins: inputs.debt_mins,
    savings_goals: inputs.savings_goals,
    recurring_savings: inputs.recurring_savings,
  });
  const available_for_debt_extra_cents = computeAvailableForDebtExtra({
    paycheque_cents: inputs.period.paycheque_cents,
    committed_total_cents: committed.total_cents,
    lifestyle_baseline_cents: inputs.lifestyle_baseline_cents,
    indulgence_allowance_cents: inputs.indulgence_per_paycheque_cents,
  });
  const spending_money_cents = computeSpendingMoney({
    paycheque_cents: inputs.period.paycheque_cents,
    committed_total_cents: committed.total_cents,
    recommended_debt_extra_cents: available_for_debt_extra_cents,
  });
  const spent_so_far_cents = await loadSpentSoFar(env, inputs.period.start_date, inputs.period.end_date);

  return {
    period: {
      id: inputs.period.id,
      start_date: inputs.period.start_date,
      end_date: inputs.period.end_date,
    },
    paycheque_cents: inputs.period.paycheque_cents,
    committed,
    available_for_debt_extra_cents,
    spending_money_cents,
    baseline: {
      lifestyle_per_paycheque_cents: inputs.lifestyle_baseline_cents,
      indulgence_per_paycheque_cents: inputs.indulgence_per_paycheque_cents,
    },
    spent_so_far_cents,
  };
}
