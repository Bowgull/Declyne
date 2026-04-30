import { describe, it, expect } from 'vitest';
import {
  bucketRecurring,
  billsInWindow,
  recurringSavingsInWindow,
  lifestyleBaselinePerPaycheque,
  essentialsVariableBaselinePerPaycheque,
  monthlyToPerPaycheque,
  computePaycheckCommitments,
  essentialsBaselineForKernel,
  computeAvailableForDebtExtra,
  computeSpendingMoney,
} from '../lib/periodIntelligence.js';
import type { RecurringPrediction } from '../lib/recurring.js';

function makeRecurring(p: Partial<RecurringPrediction>): RecurringPrediction {
  return {
    merchant_id: p.merchant_id ?? 'm1',
    merchant_name: p.merchant_name ?? 'Test',
    amount_cents: p.amount_cents ?? 10_000,
    last_seen: p.last_seen ?? '2026-04-01',
    next_due: p.next_due ?? '2026-05-01',
    days_until: p.days_until ?? 4,
    cadence_days: p.cadence_days ?? 30,
    occurrences: p.occurrences ?? 3,
    category_group: p.category_group ?? 'essentials',
  };
}

describe('bucketRecurring', () => {
  it('classifies essentials as bill', () => expect(bucketRecurring('essentials')).toBe('bill'));
  it('classifies lifestyle as bill', () => expect(bucketRecurring('lifestyle')).toBe('bill'));
  it('classifies transfer as savings', () => expect(bucketRecurring('transfer')).toBe('savings'));
  it('classifies debt as debt', () => expect(bucketRecurring('debt')).toBe('debt'));
  it('classifies indulgence as skip', () => expect(bucketRecurring('indulgence')).toBe('skip'));
  it('classifies income as skip', () => expect(bucketRecurring('income')).toBe('skip'));
  it('classifies unknown as skip', () => expect(bucketRecurring('whatever')).toBe('skip'));
});

describe('billsInWindow', () => {
  it('keeps essentials bills inside the window', () => {
    const r = [
      makeRecurring({ merchant_id: 'rogers', next_due: '2026-04-30', category_group: 'essentials', amount_cents: 9500 }),
      makeRecurring({ merchant_id: 'enbridge', next_due: '2026-05-05', category_group: 'essentials', amount_cents: 10800 }),
    ];
    const out = billsInWindow(r, '2026-04-27', '2026-05-07');
    expect(out).toHaveLength(2);
    expect(out[0]!.merchant_name).toBe('Test');
    expect(out[0]!.amount_cents).toBe(9500);
  });

  it('drops bills outside the window', () => {
    const r = [
      makeRecurring({ next_due: '2026-04-26', category_group: 'essentials' }), // before today
      makeRecurring({ next_due: '2026-05-08', category_group: 'essentials' }), // after period_end
      makeRecurring({ next_due: '2026-04-29', category_group: 'essentials' }), // in window
    ];
    const out = billsInWindow(r, '2026-04-27', '2026-05-07');
    expect(out).toHaveLength(1);
    expect(out[0]!.due_date).toBe('2026-04-29');
  });

  it('drops debt-group recurring (handled by debts table)', () => {
    const r = [
      makeRecurring({ next_due: '2026-04-29', category_group: 'debt', amount_cents: 9000 }),
      makeRecurring({ next_due: '2026-04-30', category_group: 'essentials', amount_cents: 5000 }),
    ];
    const out = billsInWindow(r, '2026-04-27', '2026-05-07');
    expect(out).toHaveLength(1);
    expect(out[0]!.category_group).toBe('essentials');
  });

  it('drops transfer-group recurring (those are savings sweeps)', () => {
    const r = [makeRecurring({ next_due: '2026-04-29', category_group: 'transfer', amount_cents: 5000 })];
    expect(billsInWindow(r, '2026-04-27', '2026-05-07')).toHaveLength(0);
  });

  it('drops zero/negative amounts', () => {
    const r = [makeRecurring({ next_due: '2026-04-29', category_group: 'essentials', amount_cents: 0 })];
    expect(billsInWindow(r, '2026-04-27', '2026-05-07')).toHaveLength(0);
  });

  it('returns empty when today > period_end', () => {
    expect(billsInWindow([], '2026-05-08', '2026-05-07')).toHaveLength(0);
  });
});

describe('recurringSavingsInWindow', () => {
  it('keeps transfer-group recurring in window', () => {
    const r = [makeRecurring({ next_due: '2026-04-29', category_group: 'transfer', amount_cents: 25000 })];
    const out = recurringSavingsInWindow(r, '2026-04-27', '2026-05-07');
    expect(out).toHaveLength(1);
    expect(out[0]!.amount_cents).toBe(25000);
  });

  it('drops non-transfer recurring', () => {
    const r = [
      makeRecurring({ next_due: '2026-04-29', category_group: 'essentials' }),
      makeRecurring({ next_due: '2026-04-30', category_group: 'lifestyle' }),
      makeRecurring({ next_due: '2026-05-01', category_group: 'transfer', amount_cents: 5000 }),
    ];
    const out = recurringSavingsInWindow(r, '2026-04-27', '2026-05-07');
    expect(out).toHaveLength(1);
    expect(out[0]!.merchant_name).toBe('Test');
  });
});

describe('lifestyleBaselinePerPaycheque', () => {
  it('zero or negative input returns 0', () => {
    expect(lifestyleBaselinePerPaycheque(0)).toBe(0);
    expect(lifestyleBaselinePerPaycheque(-100)).toBe(0);
  });

  it('divides 90d total by ~6.5 paycheques', () => {
    // $1300 over 90d → $200 per paycheque
    expect(lifestyleBaselinePerPaycheque(130_000)).toBe(20_000);
  });

  it('rounds to int cents', () => {
    expect(lifestyleBaselinePerPaycheque(100)).toBe(15); // 100/6.5 = 15.38
  });

  it('handles non-finite input', () => {
    expect(lifestyleBaselinePerPaycheque(NaN)).toBe(0);
  });
});

describe('essentialsVariableBaselinePerPaycheque', () => {
  it('zero or negative input returns 0', () => {
    expect(essentialsVariableBaselinePerPaycheque(0)).toBe(0);
    expect(essentialsVariableBaselinePerPaycheque(-1000)).toBe(0);
  });

  it('divides 90d total by ~6.5 paycheques (same divisor as lifestyle)', () => {
    // $1950 of groceries+gas over 90d → $300 per paycheque
    expect(essentialsVariableBaselinePerPaycheque(195_000)).toBe(30_000);
  });

  it('rounds to int cents', () => {
    expect(essentialsVariableBaselinePerPaycheque(100)).toBe(15); // 100/6.5 = 15.38
  });

  it('handles non-finite input', () => {
    expect(essentialsVariableBaselinePerPaycheque(NaN)).toBe(0);
  });
});

describe('monthlyToPerPaycheque', () => {
  it('zero or negative returns 0', () => {
    expect(monthlyToPerPaycheque(0)).toBe(0);
    expect(monthlyToPerPaycheque(-1000)).toBe(0);
  });

  it('uses 26 paycheques / 12 months', () => {
    // $260/month × 12 / 26 = $120 per paycheque
    expect(monthlyToPerPaycheque(26_000)).toBe(12_000);
  });
});

describe('computePaycheckCommitments', () => {
  it('aggregates bills, debt mins, savings into totals', () => {
    const out = computePaycheckCommitments({
      bills: [
        { merchant_id: 'r', merchant_name: 'Rogers', amount_cents: 9500, due_date: '2026-04-30', days_until: 3, category_group: 'essentials' },
        { merchant_id: 'e', merchant_name: 'Enbridge', amount_cents: 10800, due_date: '2026-05-02', days_until: 5, category_group: 'essentials' },
      ],
      debt_mins: [
        { id: 'd1', name: 'TD Visa', min_cents: 8940 },
        { id: 'd2', name: 'Capital One', min_cents: 5000 },
      ],
      savings_goals: [{ id: 'g1', name: 'Vacation', per_paycheque_cents: 10000 }],
      recurring_savings: [{ merchant_id: 't1', merchant_name: 'Auto-sweep', amount_cents: 25000, due_date: '2026-04-30' }],
    });
    expect(out.bills_cents).toBe(20300);
    expect(out.debt_mins_cents).toBe(13940);
    expect(out.savings_cents).toBe(35000);
    expect(out.total_cents).toBe(69240);
    expect(out.lines).toHaveLength(6);
  });

  it('skips zero-amount lines', () => {
    const out = computePaycheckCommitments({
      bills: [{ merchant_id: 'a', merchant_name: 'A', amount_cents: 0, due_date: '2026-04-30', days_until: 3, category_group: 'essentials' }],
      debt_mins: [{ id: 'd', name: 'd', min_cents: 0 }],
      savings_goals: [{ id: 'g', name: 'g', per_paycheque_cents: 0 }],
      recurring_savings: [{ merchant_id: 't', merchant_name: 't', amount_cents: 0, due_date: '2026-04-30' }],
    });
    expect(out.lines).toHaveLength(0);
    expect(out.total_cents).toBe(0);
  });

  it('preserves source labels and ref ids on each line', () => {
    const out = computePaycheckCommitments({
      bills: [{ merchant_id: 'rogers', merchant_name: 'Rogers', amount_cents: 9500, due_date: '2026-04-30', days_until: 3, category_group: 'essentials' }],
      debt_mins: [{ id: 'debt_td', name: 'TD Visa', min_cents: 8940 }],
      savings_goals: [],
      recurring_savings: [],
    });
    expect(out.lines[0]!.source).toBe('bill');
    expect(out.lines[0]!.ref_id).toBe('rogers');
    expect(out.lines[1]!.source).toBe('debt_min');
    expect(out.lines[1]!.label).toBe('TD Visa min');
    expect(out.lines[1]!.ref_id).toBe('debt_td');
  });
});

describe('essentialsBaselineForKernel', () => {
  it('sums bills + savings + variable essentials + lifestyle baseline', () => {
    expect(
      essentialsBaselineForKernel({
        bills_cents: 20000,
        savings_cents: 35000,
        essentials_variable_baseline_cents: 45000,
        lifestyle_baseline_cents: 60000,
      }),
    ).toBe(160000);
  });

  it('clamps negative inputs to 0 sum', () => {
    expect(
      essentialsBaselineForKernel({
        bills_cents: -100,
        savings_cents: -100,
        essentials_variable_baseline_cents: -100,
        lifestyle_baseline_cents: -100,
      }),
    ).toBe(0);
  });
});

describe('computeAvailableForDebtExtra', () => {
  it('subtracts committed + variable essentials + lifestyle + indulgence from paycheque', () => {
    const v = computeAvailableForDebtExtra({
      paycheque_cents: 425_000,
      committed_total_cents: 100_000, // bills + mins + savings
      essentials_variable_baseline_cents: 45_000,
      lifestyle_baseline_cents: 60_000,
      indulgence_allowance_cents: 30_000,
    });
    // 425k - 100k - 45k - 60k - 30k = 190k
    expect(v).toBe(190_000);
  });

  it('clamps to 0 when committed exceeds paycheque', () => {
    const v = computeAvailableForDebtExtra({
      paycheque_cents: 100_000,
      committed_total_cents: 200_000,
      essentials_variable_baseline_cents: 0,
      lifestyle_baseline_cents: 0,
      indulgence_allowance_cents: 0,
    });
    expect(v).toBe(0);
  });

  it('floors to int cents', () => {
    const v = computeAvailableForDebtExtra({
      paycheque_cents: 100,
      committed_total_cents: 0,
      essentials_variable_baseline_cents: 0,
      lifestyle_baseline_cents: 0,
      indulgence_allowance_cents: 0,
    });
    expect(v).toBe(100);
  });
});

describe('computeSpendingMoney', () => {
  it('= paycheque - committed - debt extra', () => {
    const v = computeSpendingMoney({
      paycheque_cents: 425_000,
      committed_total_cents: 100_000,
      recommended_debt_extra_cents: 235_000,
    });
    // 425k - 100k - 235k = 90k (covers lifestyle + indulgence)
    expect(v).toBe(90_000);
  });

  it('clamps to 0 when commitments + extra exceed paycheque', () => {
    const v = computeSpendingMoney({
      paycheque_cents: 100_000,
      committed_total_cents: 80_000,
      recommended_debt_extra_cents: 50_000,
    });
    expect(v).toBe(0);
  });
});
