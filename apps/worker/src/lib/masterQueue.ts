// Master queue substrate (Connect plan, session 1).
//
// One source of "what needs your attention." Surfaces today stitch from five
// different routes (bill predictions, plan installments, the reconciliation
// status flag, the review queue, the sub-cat queue) and never agree on
// counts. This composes them into one shape so Today, Reconciliation, and a
// future /queue page derive from the same fact.
//
// Pure: no DB access. The route loads all inputs and passes them in.

import type { RecurringPrediction } from './recurring.js';

export type QueueKind =
  | 'reconcile'
  | 'bill'
  | 'plan_installment'
  | 'payday'
  | 'review_uncategorized'
  | 'sub_category_unconfirmed'
  | 'sub_category_stale'
  | 'tab_to_match'
  | 'uncleared_line'
  | 'subscription_pending_verdict'
  | 'statement_mismatch'
  | 'counterparty_stale';

// Tier drives sort order. 0 is most urgent. Within a tier, sort by due_date
// (nulls last) then label.
//   0  reconcile  — the Sunday ritual
//   1  bill       — external charge lands soon
//   2  plan       — installment we promised this period
//   3  payday     — news, not action
//   4  admin      — open loops the user has to clear
const TIER_BY_KIND: Record<QueueKind, number> = {
  reconcile: 0,
  bill: 1,
  plan_installment: 2,
  payday: 3,
  review_uncategorized: 4,
  sub_category_unconfirmed: 4,
  sub_category_stale: 4,
  tab_to_match: 4,
  uncleared_line: 4,
  subscription_pending_verdict: 4,
  statement_mismatch: 4,
  counterparty_stale: 4,
};

export interface QueueItem {
  kind: QueueKind;
  id: string;
  label: string;
  meta?: string;
  due_date: string | null; // YYYY-MM-DD
  tier: number;
  href: string;
  amount_cents?: number;
}

// Inputs the route gathers. Keep types loose enough to accept the shapes the
// existing routes already produce; the helper only reads the fields it needs.

export interface PlanInstallmentInput {
  id: string;
  label: string; // already stripped of role suffix when passed in
  amount_cents: number;
  due_date: string; // period.end_date
  days_until: number;
}

export interface PaydayInput {
  amount_cents: number;
  next_due: string;
  days_until: number;
}

export interface ReviewRowInput {
  id: string;
  description_raw: string;
  amount_cents: number;
}

export interface SubCategoryRowInput {
  id: string;
  display_name: string;
  spend_90d_cents: number;
  mismatch: boolean;
}

export interface TabToMatchInput {
  id: string;
  counterparty_name: string;
  reason: string;
  remaining_cents: number;
  candidate_count: number;
}

export interface UnclearedLineInput {
  id: string;
  account_path: string;
  posted_at: string;
  amount_cents: number; // signed
  memo: string | null;
}

export interface SubscriptionPendingInput {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number; // monthly cost
}

export interface StatementMismatchInput {
  statement_id: string;
  debt_name: string;
  statement_date: string;
  mismatch_cents: number; // signed
}

export interface CounterpartyStaleInput {
  split_id: string;
  counterparty_name: string;
  direction: 'they_owe' | 'i_owe';
  remaining_cents: number;
  days_open: number;
}

export interface MasterQueueInputs {
  // Sunday ritual: completed_this_week=true means no reconcile row.
  completed_this_week: boolean;
  // Day-of-week 0=Sun..6=Sat. The reconcile row only surfaces on Sunday.
  // Keeping it tier-0 every day was too noisy; the ritual is weekly.
  // Pass today's day-of-week from the route.
  today_dow: number;

  bills: RecurringPrediction[];
  plan_installments: PlanInstallmentInput[];
  payday: PaydayInput | null;
  review_uncategorized: ReviewRowInput[];
  sub_category_queue: SubCategoryRowInput[];
  tabs_to_match: TabToMatchInput[];
  uncleared_lines: UnclearedLineInput[];
  subscriptions_pending: SubscriptionPendingInput[];
  statement_mismatches: StatementMismatchInput[];
  counterparty_stale: CounterpartyStaleInput[];
}

function compare(a: QueueItem, b: QueueItem): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  // Nulls sort last within a tier.
  if (a.due_date && b.due_date) {
    const cmp = a.due_date.localeCompare(b.due_date);
    if (cmp !== 0) return cmp;
  } else if (a.due_date && !b.due_date) {
    return -1;
  } else if (!a.due_date && b.due_date) {
    return 1;
  }
  return a.label.localeCompare(b.label);
}

export function buildMasterQueue(inputs: MasterQueueInputs, today: string): QueueItem[] {
  const out: QueueItem[] = [];

  // Reconcile — only on Sunday and only when not yet sealed this week.
  if (inputs.today_dow === 0 && !inputs.completed_this_week) {
    out.push({
      kind: 'reconcile',
      id: `reconcile-${today}`,
      label: 'Reconcile this week',
      due_date: today,
      tier: TIER_BY_KIND.reconcile,
      href: '/reconcile',
    });
  }

  for (const b of inputs.bills) {
    out.push({
      kind: 'bill',
      id: `bill-${b.merchant_id}`,
      label: b.merchant_name,
      meta: b.category_group,
      due_date: b.next_due,
      tier: TIER_BY_KIND.bill,
      href: '/today',
      amount_cents: b.amount_cents,
    });
  }

  for (const p of inputs.plan_installments) {
    out.push({
      kind: 'plan_installment',
      id: `plan-${p.id}`,
      label: p.label,
      due_date: p.due_date,
      tier: TIER_BY_KIND.plan_installment,
      href: '/paycheque/plan',
      amount_cents: p.amount_cents,
    });
  }

  if (inputs.payday) {
    out.push({
      kind: 'payday',
      id: `payday-${inputs.payday.next_due}`,
      label: 'Payday',
      due_date: inputs.payday.next_due,
      tier: TIER_BY_KIND.payday,
      href: '/paycheque',
      amount_cents: inputs.payday.amount_cents,
    });
  }

  for (const r of inputs.review_uncategorized) {
    out.push({
      kind: 'review_uncategorized',
      id: `review-${r.id}`,
      label: r.description_raw || 'Uncategorized',
      due_date: null,
      tier: TIER_BY_KIND.review_uncategorized,
      href: '/review',
      amount_cents: Math.abs(r.amount_cents),
    });
  }

  for (const s of inputs.sub_category_queue) {
    out.push({
      kind: s.mismatch ? 'sub_category_stale' : 'sub_category_unconfirmed',
      id: `sub-${s.id}`,
      label: s.display_name,
      meta: s.mismatch ? 'stale' : 'unconfirmed',
      due_date: null,
      tier: s.mismatch ? TIER_BY_KIND.sub_category_stale : TIER_BY_KIND.sub_category_unconfirmed,
      href: '/books?view=patterns',
      amount_cents: s.spend_90d_cents,
    });
  }

  for (const t of inputs.tabs_to_match) {
    out.push({
      kind: 'tab_to_match',
      id: `tab-${t.id}`,
      label: t.counterparty_name || t.reason,
      meta: `${t.candidate_count} candidates`,
      due_date: null,
      tier: TIER_BY_KIND.tab_to_match,
      href: '/reconcile',
      amount_cents: t.remaining_cents,
    });
  }

  for (const l of inputs.uncleared_lines) {
    out.push({
      kind: 'uncleared_line',
      id: `line-${l.id}`,
      label: l.memo || l.account_path,
      meta: l.account_path,
      due_date: l.posted_at.slice(0, 10),
      tier: TIER_BY_KIND.uncleared_line,
      href: '/reconcile',
      amount_cents: Math.abs(l.amount_cents),
    });
  }

  for (const s of inputs.subscriptions_pending) {
    out.push({
      kind: 'subscription_pending_verdict',
      id: `sub-pending-${s.merchant_id}`,
      label: s.merchant_name,
      due_date: null,
      tier: TIER_BY_KIND.subscription_pending_verdict,
      href: '/books?view=patterns',
      amount_cents: s.amount_cents,
    });
  }

  for (const m of inputs.statement_mismatches) {
    out.push({
      kind: 'statement_mismatch',
      id: `stmt-${m.statement_id}`,
      label: m.debt_name,
      meta: m.statement_date,
      due_date: m.statement_date,
      tier: TIER_BY_KIND.statement_mismatch,
      href: '/settings/cc-statements',
      amount_cents: Math.abs(m.mismatch_cents),
    });
  }

  for (const c of inputs.counterparty_stale) {
    out.push({
      kind: 'counterparty_stale',
      id: `cp-stale-${c.split_id}`,
      label: c.counterparty_name,
      meta: `${c.days_open}d open`,
      due_date: null,
      tier: TIER_BY_KIND.counterparty_stale,
      href: '/paycheque',
      amount_cents: c.remaining_cents,
    });
  }

  out.sort(compare);
  return out;
}

export function summarizeQueue(items: QueueItem[]): {
  total: number;
  by_kind: Record<QueueKind, number>;
} {
  const by_kind = {
    reconcile: 0,
    bill: 0,
    plan_installment: 0,
    payday: 0,
    review_uncategorized: 0,
    sub_category_unconfirmed: 0,
    sub_category_stale: 0,
    tab_to_match: 0,
    uncleared_line: 0,
    subscription_pending_verdict: 0,
    statement_mismatch: 0,
    counterparty_stale: 0,
  } as Record<QueueKind, number>;
  for (const it of items) by_kind[it.kind] += 1;
  return { total: items.length, by_kind };
}
