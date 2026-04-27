// Session 64 (program session 59): payment plan kernel.
//
// Pure logic. No DB, no env. The hybrid policy:
//
//   Tier 0  Pay every debt's minimum first. Non-negotiable. Protects credit on
//           debts in 'current' status; on already-damaged debts the min still
//           buys time and avoids further marks.
//   Tier 1  Severity-priority. Within priority, smallest balance first so we
//           clear individual collectors / past-due rows fast. Order:
//             in_collections → charged_off → past_due
//   Tier 2  Avalanche. 'current' and 'settled_partial' debts. Highest APR first.
//
// 'settled_partial' is treated as 'current' once a negotiated balance is set.
// Splits never enter the plan (they're personal IOUs, not institutional debt).
// Charge velocity is assumed to continue (no card-freeze toggle in this scope).
// AI does no arithmetic. The kernel produces every dollar figure.

export type DebtSeverity =
  | 'current'
  | 'past_due'
  | 'in_collections'
  | 'charged_off'
  | 'settled_partial';

export interface PlanDebtInput {
  id: string;
  name: string;
  principal_cents: number;
  interest_rate_bps: number; // APR, basis points
  min_payment_type: 'fixed' | 'percent';
  min_payment_value: number;
  severity: DebtSeverity;
}

export interface PlanInput {
  debts: PlanDebtInput[];
  paycheque_cents: number;
  essentials_baseline_cents: number;
  indulgence_allowance_cents: number;
  // Per-debt monthly charge velocity, only applied to 'current' / 'settled_partial'.
  // Keys are debt ids; missing keys default to 0.
  charge_velocity_per_debt_cents: Record<string, number>;
  // Horizon for the projection. Defaults to 60 months.
  horizon_months?: number;
}

export type PlanRole = 'min' | 'priority' | 'avalanche';

export interface PlanAllocation {
  debt_id: string;
  debt_name: string;
  role: PlanRole;
  amount_cents: number;
}

export interface MonthlySchedule {
  month: number; // 0 = current cycle
  balances_cents: Record<string, number>;
  payments_cents: Record<string, number>;
}

export interface PlanOutput {
  next_paycheque_allocations: PlanAllocation[];
  monthly_schedule: MonthlySchedule[];
  payoff_months: Record<string, number | null>; // null = beyond horizon
  total_interest_cents: number;
  baseline_total_interest_cents: number;
  savings_cents: number;
  capacity_cents: number;
}

const SEVERITY_RANK: Record<DebtSeverity, number> = {
  in_collections: 0,
  charged_off: 1,
  past_due: 2,
  settled_partial: 3,
  current: 3,
};

export function isPriority(s: DebtSeverity): boolean {
  return s === 'in_collections' || s === 'charged_off' || s === 'past_due';
}

// Pure: minimum payment given debt def. Mirrors streaks.requiredMinPaymentCents
// with a $10 percent floor; at zero principal the minimum collapses to 0.
export function minPaymentCents(d: PlanDebtInput): number {
  if (d.principal_cents <= 0) return 0;
  // Cap at principal in both branches so we never ask for more than what's owed.
  if (d.min_payment_type === 'fixed') {
    return Math.min(d.principal_cents, Math.max(0, Math.trunc(d.min_payment_value)));
  }
  const pct = Math.round((d.principal_cents * d.min_payment_value) / 10_000);
  return Math.min(d.principal_cents, Math.max(1000, pct));
}

// Pure: monthly interest accrual. APR/12 of the principal.
export function monthlyInterestCents(principal_cents: number, apr_bps: number): number {
  if (principal_cents <= 0 || apr_bps <= 0) return 0;
  return Math.round((principal_cents * apr_bps) / (10_000 * 12));
}

// Pure: comparator for the priority tier (smallest balance first within severity rank).
function comparePriority(a: PlanDebtInput, b: PlanDebtInput): number {
  const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (r !== 0) return r;
  return a.principal_cents - b.principal_cents;
}

// Pure: comparator for the avalanche tier (highest APR first; tiebreak balance).
function compareAvalanche(a: PlanDebtInput, b: PlanDebtInput): number {
  const r = b.interest_rate_bps - a.interest_rate_bps;
  if (r !== 0) return r;
  return b.principal_cents - a.principal_cents;
}

// Pure: order debts the way the kernel pours capacity.
export function planOrder(debts: PlanDebtInput[]): PlanDebtInput[] {
  const pri = debts.filter((d) => isPriority(d.severity)).sort(comparePriority);
  const aval = debts.filter((d) => !isPriority(d.severity)).sort(compareAvalanche);
  return [...pri, ...aval];
}

// Pure: allocate one paycheque's capacity across debts.
export function allocateCapacity(
  debts: PlanDebtInput[],
  capacity_cents: number,
): PlanAllocation[] {
  const cap = Math.max(0, Math.trunc(capacity_cents));
  const allocs: PlanAllocation[] = [];

  // Tier 0: mins.
  const mins = new Map<string, number>();
  for (const d of debts) {
    const m = minPaymentCents(d);
    mins.set(d.id, m);
    if (m > 0) {
      allocs.push({ debt_id: d.id, debt_name: d.name, role: 'min', amount_cents: m });
    }
  }

  // Tier 1 + Tier 2: ordered.
  const ordered = planOrder(debts);
  let remaining = cap;
  for (const d of ordered) {
    if (remaining <= 0) break;
    const m = mins.get(d.id) ?? 0;
    // Headroom = principal − minimum already counted toward this debt.
    const headroom = Math.max(0, d.principal_cents - m);
    if (headroom <= 0) continue;
    const give = Math.min(headroom, remaining);
    if (give <= 0) continue;
    allocs.push({
      debt_id: d.id,
      debt_name: d.name,
      role: isPriority(d.severity) ? 'priority' : 'avalanche',
      amount_cents: give,
    });
    remaining -= give;
  }

  return allocs;
}

// Pure: compute paycheque capacity (overflow above mins/essentials/indulgence).
export function computeCapacity(input: PlanInput): number {
  const minsTotal = input.debts.reduce((s, d) => s + minPaymentCents(d), 0);
  const cap =
    input.paycheque_cents -
    Math.max(0, input.essentials_baseline_cents) -
    Math.max(0, input.indulgence_allowance_cents) -
    minsTotal;
  return Math.max(0, Math.trunc(cap));
}

// Pure: simulate forward N months under either the kernel plan or a mins-only
// baseline. Each month: accrue interest, charge velocity (if non-priority),
// then pay (mins + extra capacity per ordering). Returns total interest paid.
function simulate(
  input: PlanInput,
  mode: 'plan' | 'baseline',
): { months: MonthlySchedule[]; payoff: Record<string, number | null>; interest: number } {
  const horizon = Math.max(1, Math.trunc(input.horizon_months ?? 60));
  const balances = new Map<string, number>();
  const aprs = new Map<string, number>();
  const charge = new Map<string, number>();
  for (const d of input.debts) {
    balances.set(d.id, Math.max(0, d.principal_cents));
    aprs.set(d.id, Math.max(0, d.interest_rate_bps));
    const v = isPriority(d.severity)
      ? 0
      : Math.max(0, Math.trunc(input.charge_velocity_per_debt_cents[d.id] ?? 0));
    charge.set(d.id, v);
  }

  const months: MonthlySchedule[] = [];
  const payoff: Record<string, number | null> = {};
  for (const d of input.debts) payoff[d.id] = null;
  let totalInterest = 0;

  for (let m = 0; m < horizon; m++) {
    const monthDebts = input.debts.map((d) => ({
      ...d,
      principal_cents: balances.get(d.id) ?? 0,
    }));

    // Accrue interest.
    for (const d of monthDebts) {
      const bal = balances.get(d.id) ?? 0;
      if (bal <= 0) continue;
      const i = monthlyInterestCents(bal, aprs.get(d.id) ?? 0);
      balances.set(d.id, bal + i);
      totalInterest += i;
    }

    // Charge velocity (only on non-priority, only while open).
    for (const d of monthDebts) {
      const bal = balances.get(d.id) ?? 0;
      if (bal <= 0) continue;
      const c = charge.get(d.id) ?? 0;
      if (c > 0) balances.set(d.id, bal + c);
    }

    // Refresh principals before allocation.
    const live = input.debts
      .map((d) => ({ ...d, principal_cents: balances.get(d.id) ?? 0 }))
      .filter((d) => d.principal_cents > 0);

    let allocs: PlanAllocation[];
    if (mode === 'plan') {
      // Use the live capacity each month — same paycheque, mins recomputed from
      // live balances (smaller balances → smaller percent mins).
      const cap = computeCapacity({ ...input, debts: live });
      allocs = allocateCapacity(live, cap);
    } else {
      // Baseline: mins only, no extra capacity.
      allocs = live.map((d) => ({
        debt_id: d.id,
        debt_name: d.name,
        role: 'min' as PlanRole,
        amount_cents: minPaymentCents(d),
      }));
    }

    // Apply payments. Per-debt sum across roles.
    const paid = new Map<string, number>();
    for (const a of allocs) {
      paid.set(a.debt_id, (paid.get(a.debt_id) ?? 0) + a.amount_cents);
    }
    const monthPayments: Record<string, number> = {};
    for (const d of input.debts) {
      const bal = balances.get(d.id) ?? 0;
      const want = paid.get(d.id) ?? 0;
      const apply = Math.min(bal, want);
      if (apply > 0) {
        balances.set(d.id, bal - apply);
        monthPayments[d.id] = apply;
      }
      const newBal = balances.get(d.id) ?? 0;
      if (newBal <= 0 && payoff[d.id] === null && (d.principal_cents > 0 || apply > 0)) {
        payoff[d.id] = m;
      }
    }

    const monthBalances: Record<string, number> = {};
    for (const d of input.debts) monthBalances[d.id] = balances.get(d.id) ?? 0;
    months.push({ month: m, balances_cents: monthBalances, payments_cents: monthPayments });

    if (input.debts.every((d) => (balances.get(d.id) ?? 0) <= 0)) break;
  }

  return { months, payoff, interest: totalInterest };
}

export function computePlan(input: PlanInput): PlanOutput {
  const capacity_cents = computeCapacity(input);
  const next_paycheque_allocations = allocateCapacity(input.debts, capacity_cents);

  const planRun = simulate(input, 'plan');
  const baselineRun = simulate(input, 'baseline');

  return {
    next_paycheque_allocations,
    monthly_schedule: planRun.months,
    payoff_months: planRun.payoff,
    total_interest_cents: planRun.interest,
    baseline_total_interest_cents: baselineRun.interest,
    savings_cents: Math.max(0, baselineRun.interest - planRun.interest),
    capacity_cents,
  };
}
