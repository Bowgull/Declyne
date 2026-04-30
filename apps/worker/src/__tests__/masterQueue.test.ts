import { describe, it, expect } from 'vitest';
import {
  buildMasterQueue,
  summarizeQueue,
  type MasterQueueInputs,
} from '../lib/masterQueue.js';
import type { RecurringPrediction } from '../lib/recurring.js';

const TODAY = '2026-04-26'; // Sunday

function emptyInputs(over: Partial<MasterQueueInputs> = {}): MasterQueueInputs {
  return {
    completed_this_week: true,
    today_dow: 0,
    bills: [],
    plan_installments: [],
    payday: null,
    review_uncategorized: [],
    sub_category_queue: [],
    tabs_to_match: [],
    uncleared_lines: [],
    subscriptions_pending: [],
    statement_mismatches: [],
    counterparty_stale: [],
    ...over,
  };
}

function bill(over: Partial<RecurringPrediction>): RecurringPrediction {
  return {
    merchant_id: 'm1',
    merchant_name: 'Rogers',
    amount_cents: 9500,
    last_seen: '2026-04-01',
    next_due: '2026-05-01',
    days_until: 5,
    cadence_days: 30,
    occurrences: 4,
    category_group: 'essentials',
    ...over,
  };
}

describe('buildMasterQueue', () => {
  it('returns empty list when nothing pending', () => {
    expect(buildMasterQueue(emptyInputs(), TODAY)).toEqual([]);
  });

  it('emits reconcile row only on Sunday and only when not sealed', () => {
    const onSundayUnsealed = buildMasterQueue(
      emptyInputs({ today_dow: 0, completed_this_week: false }),
      TODAY,
    );
    expect(onSundayUnsealed.map((i) => i.kind)).toContain('reconcile');

    const onSundaySealed = buildMasterQueue(
      emptyInputs({ today_dow: 0, completed_this_week: true }),
      TODAY,
    );
    expect(onSundaySealed.map((i) => i.kind)).not.toContain('reconcile');

    const onMonday = buildMasterQueue(
      emptyInputs({ today_dow: 1, completed_this_week: false }),
      TODAY,
    );
    expect(onMonday.map((i) => i.kind)).not.toContain('reconcile');
  });

  it('emits a bill row per recurring prediction', () => {
    const items = buildMasterQueue(
      emptyInputs({ bills: [bill({}), bill({ merchant_id: 'm2', merchant_name: 'Enbridge' })] }),
      TODAY,
    );
    expect(items.filter((i) => i.kind === 'bill')).toHaveLength(2);
    expect(items[0]!.amount_cents).toBe(9500);
    expect(items[0]!.tier).toBe(1);
  });

  it('emits a plan_installment row per committed unstamped allocation', () => {
    const items = buildMasterQueue(
      emptyInputs({
        plan_installments: [
          { id: 'pa1', label: 'TD Visa', amount_cents: 10000, due_date: '2026-05-07', days_until: 11 },
        ],
      }),
      TODAY,
    );
    expect(items.filter((i) => i.kind === 'plan_installment')).toHaveLength(1);
    expect(items[0]!.tier).toBe(2);
    expect(items[0]!.href).toBe('/paycheque/plan');
  });

  it('emits a payday row when payday is non-null', () => {
    const items = buildMasterQueue(
      emptyInputs({ payday: { amount_cents: 425000, next_due: '2026-05-08', days_until: 12 } }),
      TODAY,
    );
    const payday = items.find((i) => i.kind === 'payday');
    expect(payday).toBeDefined();
    expect(payday!.tier).toBe(3);
    expect(payday!.amount_cents).toBe(425000);
  });

  it('emits a review_uncategorized row per open review item', () => {
    const items = buildMasterQueue(
      emptyInputs({
        review_uncategorized: [
          { id: 'rq1', description_raw: 'WEIRD CHARGE', amount_cents: -1234 },
          { id: 'rq2', description_raw: '', amount_cents: -500 },
        ],
      }),
      TODAY,
    );
    const review = items.filter((i) => i.kind === 'review_uncategorized');
    expect(review).toHaveLength(2);
    const byId = new Map(review.map((r) => [r.id, r]));
    expect(byId.get('review-rq1')!.amount_cents).toBe(1234);
    expect(byId.get('review-rq2')!.label).toBe('Uncategorized');
  });

  it('discriminates sub_category_unconfirmed vs sub_category_stale by mismatch flag', () => {
    const items = buildMasterQueue(
      emptyInputs({
        sub_category_queue: [
          { id: 'm1', display_name: 'Tokyo Smoke', spend_90d_cents: 12000, mismatch: false },
          { id: 'm2', display_name: 'Loblaws', spend_90d_cents: 50000, mismatch: true },
        ],
      }),
      TODAY,
    );
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain('sub_category_unconfirmed');
    expect(kinds).toContain('sub_category_stale');
  });

  it('emits tab_to_match rows with candidate count in meta', () => {
    const items = buildMasterQueue(
      emptyInputs({
        tabs_to_match: [
          {
            id: 'sp1',
            counterparty_name: 'Marcus',
            reason: 'brunch',
            remaining_cents: 4750,
            candidate_count: 3,
          },
        ],
      }),
      TODAY,
    );
    const tab = items.find((i) => i.kind === 'tab_to_match');
    expect(tab).toBeDefined();
    expect(tab!.meta).toBe('3 candidates');
    expect(tab!.amount_cents).toBe(4750);
  });

  it('emits uncleared_line rows with absolute amount and posted_at as due_date', () => {
    const items = buildMasterQueue(
      emptyInputs({
        uncleared_lines: [
          {
            id: 'jl1',
            account_path: 'Assets:Cash:TDChq',
            posted_at: '2026-04-25T10:00:00.000Z',
            amount_cents: -1500,
            memo: 'Costco',
          },
        ],
      }),
      TODAY,
    );
    const line = items.find((i) => i.kind === 'uncleared_line');
    expect(line).toBeDefined();
    expect(line!.due_date).toBe('2026-04-25');
    expect(line!.amount_cents).toBe(1500);
    expect(line!.label).toBe('Costco');
  });

  it('falls back uncleared_line label to account path when memo is null', () => {
    const items = buildMasterQueue(
      emptyInputs({
        uncleared_lines: [
          {
            id: 'jl2',
            account_path: 'Liabilities:CreditCards:TDVisa',
            posted_at: '2026-04-25',
            amount_cents: 7500,
            memo: null,
          },
        ],
      }),
      TODAY,
    );
    expect(items[0]!.label).toBe('Liabilities:CreditCards:TDVisa');
  });

  it('emits subscription_pending_verdict rows', () => {
    const items = buildMasterQueue(
      emptyInputs({
        subscriptions_pending: [
          { merchant_id: 'm1', merchant_name: 'Netflix', amount_cents: 2000 },
        ],
      }),
      TODAY,
    );
    expect(items[0]!.kind).toBe('subscription_pending_verdict');
    expect(items[0]!.amount_cents).toBe(2000);
  });

  it('emits statement_mismatch rows with absolute mismatch as amount', () => {
    const items = buildMasterQueue(
      emptyInputs({
        statement_mismatches: [
          {
            statement_id: 's1',
            debt_name: 'TD Visa',
            statement_date: '2026-04-15',
            mismatch_cents: -1999,
          },
        ],
      }),
      TODAY,
    );
    expect(items[0]!.kind).toBe('statement_mismatch');
    expect(items[0]!.amount_cents).toBe(1999);
    expect(items[0]!.due_date).toBe('2026-04-15');
  });

  it('emits counterparty_stale rows with days_open in meta', () => {
    const items = buildMasterQueue(
      emptyInputs({
        counterparty_stale: [
          {
            split_id: 'sp1',
            counterparty_name: 'Marcus',
            direction: 'they_owe',
            remaining_cents: 4750,
            days_open: 45,
          },
        ],
      }),
      TODAY,
    );
    expect(items[0]!.kind).toBe('counterparty_stale');
    expect(items[0]!.meta).toBe('45d open');
  });

  it('sorts by tier ascending then due_date', () => {
    const items = buildMasterQueue(
      emptyInputs({
        today_dow: 0,
        completed_this_week: false,
        bills: [bill({ next_due: '2026-05-10' })],
        plan_installments: [
          { id: 'pa1', label: 'TD Visa', amount_cents: 10000, due_date: '2026-05-07', days_until: 11 },
        ],
        payday: { amount_cents: 425000, next_due: '2026-05-08', days_until: 12 },
      }),
      TODAY,
    );
    const kinds = items.map((i) => i.kind);
    expect(kinds[0]).toBe('reconcile');
    expect(kinds[1]).toBe('bill');
    expect(kinds[2]).toBe('plan_installment');
    expect(kinds[3]).toBe('payday');
  });

  it('within a tier, earlier due_date sorts first', () => {
    const items = buildMasterQueue(
      emptyInputs({
        bills: [
          bill({ merchant_id: 'a', merchant_name: 'A', next_due: '2026-05-10' }),
          bill({ merchant_id: 'b', merchant_name: 'B', next_due: '2026-05-01' }),
        ],
      }),
      TODAY,
    );
    expect(items[0]!.label).toBe('B');
    expect(items[1]!.label).toBe('A');
  });

  it('within a tier, null due_date sorts after dated rows', () => {
    const items = buildMasterQueue(
      emptyInputs({
        review_uncategorized: [
          { id: 'rq1', description_raw: 'NULL DATE', amount_cents: -100 },
        ],
        sub_category_queue: [
          { id: 'm1', display_name: 'Loblaws', spend_90d_cents: 1, mismatch: true },
        ],
        statement_mismatches: [
          {
            statement_id: 's1',
            debt_name: 'TD Visa',
            statement_date: '2026-04-15',
            mismatch_cents: 100,
          },
        ],
      }),
      TODAY,
    );
    // tier 4 with due_date sorts before tier 4 with null due_date
    expect(items[0]!.kind).toBe('statement_mismatch');
  });
});

describe('summarizeQueue', () => {
  it('returns zero counts on empty list', () => {
    const s = summarizeQueue([]);
    expect(s.total).toBe(0);
    expect(s.by_kind.bill).toBe(0);
    expect(s.by_kind.reconcile).toBe(0);
  });

  it('counts items by kind', () => {
    const items = buildMasterQueue(
      emptyInputs({
        bills: [bill({}), bill({ merchant_id: 'm2', merchant_name: 'Bell' })],
        sub_category_queue: [
          { id: 'a', display_name: 'A', spend_90d_cents: 1, mismatch: false },
          { id: 'b', display_name: 'B', spend_90d_cents: 1, mismatch: true },
          { id: 'c', display_name: 'C', spend_90d_cents: 1, mismatch: false },
        ],
      }),
      TODAY,
    );
    const s = summarizeQueue(items);
    expect(s.total).toBe(5);
    expect(s.by_kind.bill).toBe(2);
    expect(s.by_kind.sub_category_unconfirmed).toBe(2);
    expect(s.by_kind.sub_category_stale).toBe(1);
  });
});
