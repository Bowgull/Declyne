import { describe, it, expect } from 'vitest';
import {
  splitsAggregateByCounterparty,
  glReceivableBalancesByCounterparty,
  holdingsCostByWrapper,
  glInvestmentBalancesByWrapper,
  diffMaps,
  type ParitySplit,
  type ParitySplitEvent,
  type ParityHolding,
} from '../lib/parity.js';

// Fixtures derived from apps/worker/drizzle/seed_test.sql. Keep these in
// sync when seed splits/events/holdings change. The test asserts the GL-vs-
// legacy invariants documented in lib/parity.ts.

const SEED_SPLITS: ParitySplit[] = [
  {
    id: 'split_bowgull_mexico',
    counterparty_id: 'cp_bowgull',
    direction: 'i_owe',
    original_cents: 40000,
    remaining_cents: 10000,
  },
  {
    id: 'split_marcus_brunch',
    counterparty_id: 'cp_marcus',
    direction: 'they_owe',
    original_cents: 3500,
    remaining_cents: 3500,
  },
  {
    id: 'split_priya_drinks',
    counterparty_id: 'cp_priya',
    direction: 'i_owe',
    original_cents: 5500,
    remaining_cents: 5500,
  },
  {
    id: 'split_diego_lunch',
    counterparty_id: 'cp_diego',
    direction: 'they_owe',
    original_cents: 2800,
    remaining_cents: 2800,
  },
];

const SEED_EVENTS: ParitySplitEvent[] = [
  { split_id: 'split_bowgull_mexico', delta_cents: -10000 },
  { split_id: 'split_bowgull_mexico', delta_cents: -10000 },
  { split_id: 'split_bowgull_mexico', delta_cents: -10000 },
];

const SEED_HOLDINGS: ParityHolding[] = [
  { symbol: 'XIU.TO', account_wrapper: 'tfsa', units: 100000, avg_cost_cents: 2850 },
];

describe('splitsAggregateByCounterparty (legacy)', () => {
  it('signs remaining by direction', () => {
    const m = splitsAggregateByCounterparty(SEED_SPLITS);
    expect(m.get('cp_bowgull')).toBe(-10000); // i_owe 100 remaining
    expect(m.get('cp_marcus')).toBe(3500); // they_owe 35
    expect(m.get('cp_priya')).toBe(-5500); // i_owe 55
    expect(m.get('cp_diego')).toBe(2800); // they_owe 28
  });
  it('empty input returns empty map', () => {
    expect(splitsAggregateByCounterparty([]).size).toBe(0);
  });
  it('aggregates multiple splits per counterparty', () => {
    const m = splitsAggregateByCounterparty([
      ...SEED_SPLITS,
      {
        id: 'extra_marcus',
        counterparty_id: 'cp_marcus',
        direction: 'i_owe',
        original_cents: 1000,
        remaining_cents: 1000,
      },
    ]);
    expect(m.get('cp_marcus')).toBe(2500); // 3500 - 1000
  });
});

describe('glReceivableBalancesByCounterparty (replayed JEs)', () => {
  it('matches legacy aggregate on seed', () => {
    const legacy = splitsAggregateByCounterparty(SEED_SPLITS);
    const gl = glReceivableBalancesByCounterparty(SEED_SPLITS, SEED_EVENTS);
    expect(diffMaps(legacy, gl)).toEqual([]);
  });
  it('zero remaining still reconciles to zero', () => {
    const splits: ParitySplit[] = [
      {
        id: 's1',
        counterparty_id: 'cp_x',
        direction: 'they_owe',
        original_cents: 1000,
        remaining_cents: 0,
      },
    ];
    const events: ParitySplitEvent[] = [{ split_id: 's1', delta_cents: -1000 }];
    const gl = glReceivableBalancesByCounterparty(splits, events);
    expect(gl.get('cp_x')).toBe(0);
  });
  it('orphan event (no matching split) is ignored', () => {
    const gl = glReceivableBalancesByCounterparty(
      [SEED_SPLITS[0]!],
      [{ split_id: 'does_not_exist', delta_cents: -500 }],
    );
    // Only the split create line was replayed (orphan event skipped).
    // i_owe 40000 original → cp balance = -40000.
    expect(gl.get('cp_bowgull')).toBe(-40000);
  });
});

describe('PARITY: counterparties (legacy splits.remaining_cents == GL receivable balance)', () => {
  it('every counterparty matches on seed', () => {
    const legacy = splitsAggregateByCounterparty(SEED_SPLITS);
    const gl = glReceivableBalancesByCounterparty(SEED_SPLITS, SEED_EVENTS);
    const drift = diffMaps(legacy, gl);
    if (drift.length > 0) {
      throw new Error(
        `parity drift: ${drift
          .map((d) => `${String(d.key)}: legacy=${d.a} gl=${d.b} delta=${d.delta}`)
          .join(' · ')}`,
      );
    }
    expect(drift).toEqual([]);
  });
});

describe('holdingsCostByWrapper (legacy)', () => {
  it('aggregates cost basis per wrapper', () => {
    const m = holdingsCostByWrapper(SEED_HOLDINGS);
    // 100000 units (=10 actual) × 2850 cents avg cost / 10000 = 28500 cents = $285.00
    expect(m.get('tfsa')).toBe(28500);
  });
  it('multi-wrapper aggregation', () => {
    const m = holdingsCostByWrapper([
      ...SEED_HOLDINGS,
      { symbol: 'SPY', account_wrapper: 'rrsp', units: 50000, avg_cost_cents: 50000 },
    ]);
    expect(m.get('tfsa')).toBe(28500);
    expect(m.get('rrsp')).toBe(250000);
  });
  it('empty input returns empty map', () => {
    expect(holdingsCostByWrapper([]).size).toBe(0);
  });
});

describe('PARITY: holdings (cost basis == GL Assets:Investments:Wrapper:* balance)', () => {
  it('every wrapper matches on seed', () => {
    const legacy = holdingsCostByWrapper(SEED_HOLDINGS);
    const gl = glInvestmentBalancesByWrapper(SEED_HOLDINGS);
    const drift = diffMaps(legacy, gl);
    if (drift.length > 0) {
      throw new Error(
        `parity drift: ${drift
          .map((d) => `${String(d.key)}: legacy=${d.a} gl=${d.b} delta=${d.delta}`)
          .join(' · ')}`,
      );
    }
    expect(drift).toEqual([]);
  });
  it('zero-cost holdings drop from GL but legacy keeps them at zero', () => {
    const zero: ParityHolding[] = [
      { symbol: 'XYZ', account_wrapper: 'tfsa', units: 0, avg_cost_cents: 1000 },
    ];
    const legacy = holdingsCostByWrapper(zero);
    const gl = glInvestmentBalancesByWrapper(zero);
    expect(legacy.get('tfsa')).toBe(0);
    expect(gl.get('tfsa')).toBeUndefined();
    // both effectively zero: diffMaps treats undefined as 0
    expect(diffMaps(legacy, gl)).toEqual([]);
  });
});
