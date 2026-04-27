import { describe, it, expect } from 'vitest';
import {
  computePlan,
  computeCapacity,
  allocateCapacity,
  planOrder,
  minPaymentCents,
  monthlyInterestCents,
  isPriority,
  type PlanDebtInput,
} from '../lib/paymentPlan.js';

const baseDebt = (over: Partial<PlanDebtInput> = {}): PlanDebtInput => ({
  id: 'd1',
  name: 'Card',
  principal_cents: 100_000,
  interest_rate_bps: 1999, // 19.99%
  min_payment_type: 'fixed',
  min_payment_value: 5_000,
  severity: 'current',
  ...over,
});

describe('isPriority', () => {
  it('flags collections/charged-off/past-due as priority', () => {
    expect(isPriority('in_collections')).toBe(true);
    expect(isPriority('charged_off')).toBe(true);
    expect(isPriority('past_due')).toBe(true);
    expect(isPriority('current')).toBe(false);
    expect(isPriority('settled_partial')).toBe(false);
  });
});

describe('minPaymentCents', () => {
  it('returns the fixed value for fixed-type debts', () => {
    expect(minPaymentCents(baseDebt({ min_payment_type: 'fixed', min_payment_value: 5000 }))).toBe(5000);
  });
  it('applies the $10 floor on percent-type debts', () => {
    expect(
      minPaymentCents(baseDebt({ min_payment_type: 'percent', min_payment_value: 300, principal_cents: 10_000 })),
    ).toBe(1000);
  });
  it('caps minimum at the principal so we never overpay', () => {
    expect(
      minPaymentCents(baseDebt({ min_payment_type: 'fixed', min_payment_value: 5000, principal_cents: 200 })),
    ).toBe(200);
  });
  it('returns 0 when principal is zero', () => {
    expect(minPaymentCents(baseDebt({ principal_cents: 0 }))).toBe(0);
  });
});

describe('monthlyInterestCents', () => {
  it('computes APR/12 of the principal', () => {
    // 100,000 cents @ 19.99% APR / 12 = ~1665.83 → 1666
    expect(monthlyInterestCents(100_000, 1999)).toBe(1666);
  });
  it('returns 0 for zero principal or APR', () => {
    expect(monthlyInterestCents(0, 1999)).toBe(0);
    expect(monthlyInterestCents(100_000, 0)).toBe(0);
  });
});

describe('planOrder', () => {
  it('puts priority before avalanche', () => {
    const debts: PlanDebtInput[] = [
      baseDebt({ id: 'a', severity: 'current', interest_rate_bps: 2999, principal_cents: 50_000 }),
      baseDebt({ id: 'b', severity: 'in_collections', principal_cents: 80_000 }),
      baseDebt({ id: 'c', severity: 'past_due', principal_cents: 30_000 }),
    ];
    const order = planOrder(debts).map((d) => d.id);
    // collections first (rank 0), past_due (rank 2), then current avalanche
    expect(order).toEqual(['b', 'c', 'a']);
  });
  it('within priority tier, orders smallest balance first', () => {
    const debts: PlanDebtInput[] = [
      baseDebt({ id: 'big', severity: 'in_collections', principal_cents: 500_000 }),
      baseDebt({ id: 'small', severity: 'in_collections', principal_cents: 5_000 }),
    ];
    expect(planOrder(debts).map((d) => d.id)).toEqual(['small', 'big']);
  });
  it('within avalanche tier, orders highest APR first', () => {
    const debts: PlanDebtInput[] = [
      baseDebt({ id: 'low', severity: 'current', interest_rate_bps: 999 }),
      baseDebt({ id: 'high', severity: 'current', interest_rate_bps: 2999 }),
      baseDebt({ id: 'mid', severity: 'settled_partial', interest_rate_bps: 1999 }),
    ];
    expect(planOrder(debts).map((d) => d.id)).toEqual(['high', 'mid', 'low']);
  });
});

describe('computeCapacity', () => {
  it('subtracts essentials, indulgence, and minimums from paycheque', () => {
    const cap = computeCapacity({
      debts: [baseDebt({ min_payment_value: 5000 })],
      paycheque_cents: 200_000,
      essentials_baseline_cents: 100_000,
      indulgence_allowance_cents: 10_000,
      charge_velocity_per_debt_cents: {},
    });
    // 200000 - 100000 - 10000 - 5000 = 85000
    expect(cap).toBe(85_000);
  });
  it('clamps to zero when over-allocated', () => {
    const cap = computeCapacity({
      debts: [baseDebt({ min_payment_value: 50_000 })],
      paycheque_cents: 100_000,
      essentials_baseline_cents: 100_000,
      indulgence_allowance_cents: 0,
      charge_velocity_per_debt_cents: {},
    });
    expect(cap).toBe(0);
  });
});

describe('allocateCapacity', () => {
  it('always pays mins first, then pours capacity into priority order', () => {
    const debts: PlanDebtInput[] = [
      baseDebt({ id: 'aval', severity: 'current', principal_cents: 200_000, min_payment_value: 5000 }),
      baseDebt({ id: 'col', severity: 'in_collections', principal_cents: 30_000, min_payment_value: 1000 }),
    ];
    const allocs = allocateCapacity(debts, 25_000);
    // min for both, then the collections debt eats the extra 25000.
    const mins = allocs.filter((a) => a.role === 'min');
    expect(mins).toHaveLength(2);
    const priority = allocs.find((a) => a.role === 'priority');
    expect(priority?.debt_id).toBe('col');
    expect(priority?.amount_cents).toBe(25_000);
    // No avalanche allocation when capacity is fully spent on priority.
    expect(allocs.find((a) => a.role === 'avalanche')).toBeUndefined();
  });

  it('falls through to avalanche only when no priority debts', () => {
    const debts: PlanDebtInput[] = [
      baseDebt({ id: 'low', severity: 'current', interest_rate_bps: 999, min_payment_value: 5000 }),
      baseDebt({ id: 'high', severity: 'current', interest_rate_bps: 2999, min_payment_value: 5000 }),
    ];
    const allocs = allocateCapacity(debts, 20_000);
    const aval = allocs.find((a) => a.role === 'avalanche');
    expect(aval?.debt_id).toBe('high');
    expect(aval?.amount_cents).toBe(20_000);
  });

  it('caps each debt allocation by remaining principal headroom', () => {
    const debts: PlanDebtInput[] = [
      baseDebt({ id: 'tiny', severity: 'in_collections', principal_cents: 8_000, min_payment_value: 1000 }),
      baseDebt({ id: 'big', severity: 'in_collections', principal_cents: 100_000, min_payment_value: 5000 }),
    ];
    const allocs = allocateCapacity(debts, 50_000);
    const tinyExtra = allocs.find((a) => a.debt_id === 'tiny' && a.role === 'priority');
    // tiny's balance is 8000, min already counts 1000, so extra is capped at 7000.
    expect(tinyExtra?.amount_cents).toBe(7_000);
    const bigExtra = allocs.find((a) => a.debt_id === 'big' && a.role === 'priority');
    expect(bigExtra?.amount_cents).toBe(43_000);
  });

  it('returns only mins when capacity is zero', () => {
    const debts = [baseDebt({ severity: 'in_collections', min_payment_value: 1000 })];
    const allocs = allocateCapacity(debts, 0);
    expect(allocs.every((a) => a.role === 'min')).toBe(true);
  });

  it('handles empty debt list', () => {
    expect(allocateCapacity([], 50_000)).toEqual([]);
  });
});

describe('computePlan', () => {
  it('reports payoff months and savings vs minimums-only baseline', () => {
    const out = computePlan({
      debts: [baseDebt({ principal_cents: 100_000, min_payment_value: 3_000 })],
      paycheque_cents: 200_000,
      essentials_baseline_cents: 0,
      indulgence_allowance_cents: 0,
      charge_velocity_per_debt_cents: {},
      horizon_months: 60,
    });
    // The plan throws extra capacity at the debt so it pays off faster.
    const planMonths = out.payoff_months.d1;
    expect(planMonths).not.toBeNull();
    // The plan ends sooner (or at worst equal) and has savings >= 0.
    expect(out.savings_cents).toBeGreaterThanOrEqual(0);
    // With the full capacity (200k - 3k min = 197k extra), the debt clears in a single cycle.
    expect(planMonths).toBe(0);
  });

  it('priority debts get cleared before avalanche even at higher APR elsewhere', () => {
    // Collections debt at 0% APR should still come before a 25% APR current debt.
    const out = computePlan({
      debts: [
        baseDebt({
          id: 'col',
          name: 'Collections',
          severity: 'in_collections',
          interest_rate_bps: 0,
          principal_cents: 50_000,
          min_payment_value: 1_000,
        }),
        baseDebt({
          id: 'highapr',
          name: 'Current',
          severity: 'current',
          interest_rate_bps: 2500,
          principal_cents: 100_000,
          min_payment_value: 5_000,
        }),
      ],
      paycheque_cents: 60_000,
      essentials_baseline_cents: 0,
      indulgence_allowance_cents: 0,
      charge_velocity_per_debt_cents: {},
    });
    const colExtra = out.next_paycheque_allocations.find(
      (a) => a.debt_id === 'col' && a.role === 'priority',
    );
    expect(colExtra).toBeDefined();
    const avalExtra = out.next_paycheque_allocations.find((a) => a.role === 'avalanche');
    // Capacity = 60000 - 1000 - 5000 = 54000, all goes to collections (49000 headroom),
    // then 5000 spillover to avalanche.
    expect(colExtra?.amount_cents).toBe(49_000);
    expect(avalExtra?.amount_cents).toBe(5_000);
  });

  it('charge velocity does not apply to priority debts', () => {
    const out = computePlan({
      debts: [
        baseDebt({ id: 'col', severity: 'in_collections', principal_cents: 30_000, min_payment_value: 1_000, interest_rate_bps: 0 }),
      ],
      paycheque_cents: 5_000,
      essentials_baseline_cents: 0,
      indulgence_allowance_cents: 0,
      charge_velocity_per_debt_cents: { col: 50_000 }, // ignored because priority
      horizon_months: 60,
    });
    // Only 4000 capacity per cycle (5000 - 1000 min). 30000/5000 = 6 cycles roughly.
    // Should pay off well within horizon since velocity is ignored.
    expect(out.payoff_months.col).not.toBeNull();
    expect(out.payoff_months.col!).toBeLessThan(60);
  });

  it('charge velocity continuing on current debts can keep a debt unpaid in horizon', () => {
    const out = computePlan({
      debts: [
        baseDebt({
          id: 'cur',
          severity: 'current',
          principal_cents: 50_000,
          min_payment_value: 2_000,
          interest_rate_bps: 1999,
        }),
      ],
      paycheque_cents: 2_000, // capacity = 0
      essentials_baseline_cents: 0,
      indulgence_allowance_cents: 0,
      charge_velocity_per_debt_cents: { cur: 10_000 },
      horizon_months: 12,
    });
    // Velocity 10k/month + interest, only paying 2k mins → balance grows, never clears.
    expect(out.payoff_months.cur).toBeNull();
  });

  it('handles empty debts cleanly', () => {
    const out = computePlan({
      debts: [],
      paycheque_cents: 100_000,
      essentials_baseline_cents: 50_000,
      indulgence_allowance_cents: 5_000,
      charge_velocity_per_debt_cents: {},
    });
    expect(out.next_paycheque_allocations).toEqual([]);
    expect(out.total_interest_cents).toBe(0);
    expect(out.baseline_total_interest_cents).toBe(0);
    expect(out.savings_cents).toBe(0);
    expect(out.capacity_cents).toBe(45_000);
  });

  it('settled_partial behaves like current (avalanche tier)', () => {
    const out = computePlan({
      debts: [
        baseDebt({
          id: 'sp',
          severity: 'settled_partial',
          interest_rate_bps: 0,
          principal_cents: 25_000,
          min_payment_value: 1_000,
        }),
        baseDebt({
          id: 'cur',
          severity: 'current',
          interest_rate_bps: 1999,
          principal_cents: 50_000,
          min_payment_value: 2_000,
        }),
      ],
      paycheque_cents: 10_000,
      essentials_baseline_cents: 0,
      indulgence_allowance_cents: 0,
      charge_velocity_per_debt_cents: {},
    });
    // Both go into avalanche tier; the higher-APR `cur` gets the extra capacity.
    const avalRows = out.next_paycheque_allocations.filter((a) => a.role === 'avalanche');
    expect(avalRows[0]?.debt_id).toBe('cur');
  });
});
