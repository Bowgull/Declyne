import { describe, it, expect } from 'vitest';
import {
  holdingCostCents,
  holdingGlPath,
  inferCurrency,
  computeAcb,
  buyJeLines,
  sellJeLines,
  mtmDeltaLines,
} from '../lib/glHoldings.js';
import { validateLines } from '../lib/gl.js';

describe('holdingCostCents — pure', () => {
  it('zero units returns 0', () => {
    expect(holdingCostCents(0, 5000)).toBe(0);
  });
  it('zero unit cost returns 0', () => {
    expect(holdingCostCents(500000, 0)).toBe(0);
  });
  it('50 units @ $36.80 = $1,840 (units stored *10_000)', () => {
    // 500000 * 3680 / 10000 = 184_000 cents
    expect(holdingCostCents(500000, 3680)).toBe(184000);
  });
  it('rounds half-up on fractional', () => {
    // 1 unit (10000) * 3 cents / 10000 = 3
    expect(holdingCostCents(10000, 3)).toBe(3);
    // 1.5 units (15000) * 3 cents / 10000 = 4.5 → 5
    expect(holdingCostCents(15000, 3)).toBe(5);
  });
});

describe('holdingGlPath — pure', () => {
  it('formats path with capitalized wrapper + uppercased symbol', () => {
    expect(holdingGlPath('tfsa', 'xiu.to')).toBe('Assets:Investments:TFSA:XIU.TO');
    expect(holdingGlPath('rrsp', 'spy')).toBe('Assets:Investments:RRSP:SPY');
    expect(holdingGlPath('fhsa', 'vfv.to')).toBe('Assets:Investments:FHSA:VFV.TO');
    expect(holdingGlPath('nonreg', 'aapl')).toBe('Assets:Investments:NonReg:AAPL');
  });
});

describe('inferCurrency — pure', () => {
  it('detects CAD on TSX/Venture suffixes', () => {
    expect(inferCurrency('XIU.TO')).toBe('CAD');
    expect(inferCurrency('vfv.to')).toBe('CAD');
    expect(inferCurrency('FOO.V')).toBe('CAD');
    expect(inferCurrency('BAR.CN')).toBe('CAD');
    expect(inferCurrency('BAZ.NE')).toBe('CAD');
  });
  it('defaults to USD for plain symbols', () => {
    expect(inferCurrency('SPY')).toBe('USD');
    expect(inferCurrency('AAPL')).toBe('USD');
  });
});

describe('computeAcb — weighted average', () => {
  it('first buy adopts buy unit cost when no prior position', () => {
    const r = computeAcb({
      existing_units_scaled: 0,
      existing_acb_cents: 0,
      buy_units_scaled: 500000,
      buy_unit_cost_cents: 3500,
    });
    expect(r).toEqual({ units_scaled: 500000, acb_cents: 3500 });
  });
  it('zero buy returns existing untouched', () => {
    const r = computeAcb({
      existing_units_scaled: 500000,
      existing_acb_cents: 3500,
      buy_units_scaled: 0,
      buy_unit_cost_cents: 5000,
    });
    expect(r).toEqual({ units_scaled: 500000, acb_cents: 3500 });
  });
  it('weighted average across two buys at different prices', () => {
    // 50 units @ $35 + 50 units @ $45 → 100 units @ $40 ACB
    const r = computeAcb({
      existing_units_scaled: 500000,
      existing_acb_cents: 3500,
      buy_units_scaled: 500000,
      buy_unit_cost_cents: 4500,
    });
    expect(r.units_scaled).toBe(1000000);
    expect(r.acb_cents).toBe(4000);
  });
  it('three sequential buys converge correctly', () => {
    // 10 @ $10, then 10 @ $20 → 20 units @ $15
    let acc = computeAcb({
      existing_units_scaled: 0,
      existing_acb_cents: 0,
      buy_units_scaled: 100000,
      buy_unit_cost_cents: 1000,
    });
    acc = computeAcb({
      existing_units_scaled: acc.units_scaled,
      existing_acb_cents: acc.acb_cents,
      buy_units_scaled: 100000,
      buy_unit_cost_cents: 2000,
    });
    expect(acc).toEqual({ units_scaled: 200000, acb_cents: 1500 });
    // then 5 @ $30 → 25 units, total cost = 200000*1500 + 50000*3000 = 450M, /250000 = 1800
    acc = computeAcb({
      existing_units_scaled: acc.units_scaled,
      existing_acb_cents: acc.acb_cents,
      buy_units_scaled: 50000,
      buy_unit_cost_cents: 3000,
    });
    expect(acc).toEqual({ units_scaled: 250000, acb_cents: 1800 });
  });
});

describe('buyJeLines — pure', () => {
  it('zero cost returns empty', () => {
    expect(buyJeLines({ assetAccountId: 'a', cashAccountId: 'c', cost_cents: 0 })).toEqual([]);
  });
  it('positive cost: DR asset / CR cash', () => {
    const lines = buyJeLines({
      assetAccountId: 'gla_hold_x',
      cashAccountId: 'gla_cash_chq',
      cost_cents: 184000,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ account_id: 'gla_hold_x', debit_cents: 184000 });
    expect(lines[1]).toEqual({ account_id: 'gla_cash_chq', credit_cents: 184000 });
    expect(() => validateLines(lines)).not.toThrow();
  });
});

describe('sellJeLines — pure', () => {
  it('zero proceeds returns empty', () => {
    expect(
      sellJeLines({
        assetAccountId: 'a',
        cashAccountId: 'c',
        proceeds_cents: 0,
        costBasis_cents: 100,
      }),
    ).toEqual([]);
  });
  it('break-even: 2-line JE only (DR cash / CR asset)', () => {
    const lines = sellJeLines({
      assetAccountId: 'gla_hold_x',
      cashAccountId: 'gla_cash_chq',
      proceeds_cents: 100000,
      costBasis_cents: 100000,
    });
    expect(lines).toHaveLength(2);
    expect(() => validateLines(lines)).not.toThrow();
  });
  it('realized gain credits Equity:Realized', () => {
    const lines = sellJeLines({
      assetAccountId: 'gla_hold_x',
      cashAccountId: 'gla_cash_chq',
      proceeds_cents: 120000,
      costBasis_cents: 100000,
    });
    expect(lines).toHaveLength(3);
    const realized = lines.find((l) => l.account_id === 'gla_equity_realized');
    expect(realized).toEqual({ account_id: 'gla_equity_realized', credit_cents: 20000 });
    expect(() => validateLines(lines)).not.toThrow();
  });
  it('realized loss debits Equity:Realized', () => {
    const lines = sellJeLines({
      assetAccountId: 'gla_hold_x',
      cashAccountId: 'gla_cash_chq',
      proceeds_cents: 80000,
      costBasis_cents: 100000,
    });
    expect(lines).toHaveLength(3);
    const realized = lines.find((l) => l.account_id === 'gla_equity_realized');
    expect(realized).toEqual({ account_id: 'gla_equity_realized', debit_cents: 20000 });
    expect(() => validateLines(lines)).not.toThrow();
  });
});

describe('mtmDeltaLines — pure', () => {
  it('zero delta returns empty', () => {
    expect(mtmDeltaLines({ assetAccountId: 'a', delta_cents: 0 })).toEqual([]);
  });
  it('unrealized gain: DR asset / CR Equity:Unrealized', () => {
    const lines = mtmDeltaLines({ assetAccountId: 'gla_hold_x', delta_cents: 5000 });
    expect(lines).toEqual([
      { account_id: 'gla_hold_x', debit_cents: 5000 },
      { account_id: 'gla_equity_unrealized', credit_cents: 5000 },
    ]);
    expect(() => validateLines(lines)).not.toThrow();
  });
  it('unrealized loss: DR Equity:Unrealized / CR asset', () => {
    const lines = mtmDeltaLines({ assetAccountId: 'gla_hold_x', delta_cents: -5000 });
    expect(lines).toEqual([
      { account_id: 'gla_equity_unrealized', debit_cents: 5000 },
      { account_id: 'gla_hold_x', credit_cents: 5000 },
    ]);
    expect(() => validateLines(lines)).not.toThrow();
  });
});
