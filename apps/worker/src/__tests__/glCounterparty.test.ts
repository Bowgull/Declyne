import { describe, it, expect } from 'vitest';
import { splitCreateLines, splitEventLines } from '../lib/glCounterparty.js';
import { validateLines } from '../lib/gl.js';

describe('splitCreateLines — pure', () => {
  it('they_owe creates DR cp / CR Income:Reimbursement', () => {
    const lines = splitCreateLines({ direction: 'they_owe', amount_cents: 5000, cpAccountId: 'gla_cp_x' });
    expect(lines).toEqual([
      { account_id: 'gla_cp_x', debit_cents: 5000 },
      { account_id: 'gla_income_reimburse', credit_cents: 5000 },
    ]);
  });

  it('i_owe creates DR Expenses:Lifestyle / CR cp', () => {
    const lines = splitCreateLines({ direction: 'i_owe', amount_cents: 8200, cpAccountId: 'gla_cp_priya' });
    expect(lines).toEqual([
      { account_id: 'gla_exp_lifestyle', debit_cents: 8200 },
      { account_id: 'gla_cp_priya', credit_cents: 8200 },
    ]);
  });

  it('feeds validateLines cleanly for both directions', () => {
    expect(() =>
      validateLines(splitCreateLines({ direction: 'they_owe', amount_cents: 100, cpAccountId: 'a' })),
    ).not.toThrow();
    expect(() =>
      validateLines(splitCreateLines({ direction: 'i_owe', amount_cents: 100, cpAccountId: 'a' })),
    ).not.toThrow();
  });

  it('zero amount returns empty array', () => {
    expect(splitCreateLines({ direction: 'they_owe', amount_cents: 0, cpAccountId: 'a' })).toEqual([]);
  });

  it('truncates fractional cents to integers', () => {
    const lines = splitCreateLines({ direction: 'they_owe', amount_cents: 4750.9, cpAccountId: 'a' });
    expect(lines[0]?.debit_cents).toBe(4750);
    expect(lines[1]?.credit_cents).toBe(4750);
  });

  it('takes magnitude — negative amount still produces positive lines', () => {
    const lines = splitCreateLines({ direction: 'they_owe', amount_cents: -5000, cpAccountId: 'a' });
    expect(lines[0]?.debit_cents).toBe(5000);
  });
});

describe('splitEventLines — pure', () => {
  it('they_owe payment (delta<0): DR cash, CR cp', () => {
    const lines = splitEventLines({
      direction: 'they_owe',
      delta_cents: -4750,
      cpAccountId: 'gla_cp_marcus',
      cashAccountId: 'gla_chq',
    });
    expect(lines).toEqual([
      { account_id: 'gla_chq', debit_cents: 4750 },
      { account_id: 'gla_cp_marcus', credit_cents: 4750 },
    ]);
  });

  it('i_owe payment (delta<0): DR cp, CR cash', () => {
    const lines = splitEventLines({
      direction: 'i_owe',
      delta_cents: -8200,
      cpAccountId: 'gla_cp_priya',
      cashAccountId: 'gla_chq',
    });
    expect(lines).toEqual([
      { account_id: 'gla_cp_priya', debit_cents: 8200 },
      { account_id: 'gla_chq', credit_cents: 8200 },
    ]);
  });

  it('they_owe with positive delta (tab grew): DR cp, CR cash (reversed)', () => {
    const lines = splitEventLines({
      direction: 'they_owe',
      delta_cents: 1000,
      cpAccountId: 'a',
      cashAccountId: 'b',
    });
    expect(lines[0]).toEqual({ account_id: 'a', debit_cents: 1000 });
    expect(lines[1]).toEqual({ account_id: 'b', credit_cents: 1000 });
  });

  it('i_owe with positive delta (tab grew): DR cash, CR cp (reversed)', () => {
    const lines = splitEventLines({
      direction: 'i_owe',
      delta_cents: 1000,
      cpAccountId: 'a',
      cashAccountId: 'b',
    });
    expect(lines[0]).toEqual({ account_id: 'b', debit_cents: 1000 });
    expect(lines[1]).toEqual({ account_id: 'a', credit_cents: 1000 });
  });

  it('zero delta returns empty array', () => {
    expect(
      splitEventLines({ direction: 'they_owe', delta_cents: 0, cpAccountId: 'a', cashAccountId: 'b' }),
    ).toEqual([]);
  });

  it('feeds validateLines cleanly', () => {
    const cases: Array<Parameters<typeof splitEventLines>[0]> = [
      { direction: 'they_owe', delta_cents: -5000, cpAccountId: 'a', cashAccountId: 'b' },
      { direction: 'i_owe', delta_cents: -5000, cpAccountId: 'a', cashAccountId: 'b' },
      { direction: 'they_owe', delta_cents: 2500, cpAccountId: 'a', cashAccountId: 'b' },
      { direction: 'i_owe', delta_cents: 2500, cpAccountId: 'a', cashAccountId: 'b' },
    ];
    for (const args of cases) {
      const lines = splitEventLines(args);
      expect(lines).toHaveLength(2);
      expect(() => validateLines(lines)).not.toThrow();
    }
  });
});

describe('NET semantics — full lifecycle balance', () => {
  it('they_owe $50, then $50 paid → cp account net = 0', () => {
    const create = splitCreateLines({ direction: 'they_owe', amount_cents: 5000, cpAccountId: 'cp' });
    const pay = splitEventLines({
      direction: 'they_owe',
      delta_cents: -5000,
      cpAccountId: 'cp',
      cashAccountId: 'cash',
    });
    const all = [...create, ...pay];
    const cpNet = all.reduce((s, l) => {
      if (l.account_id !== 'cp') return s;
      return s + (l.debit_cents ?? 0) - (l.credit_cents ?? 0);
    }, 0);
    expect(cpNet).toBe(0);
  });

  it('i_owe $80, partial $30 paid → cp account net = -50 (I still owe them)', () => {
    const create = splitCreateLines({ direction: 'i_owe', amount_cents: 8000, cpAccountId: 'cp' });
    const pay = splitEventLines({
      direction: 'i_owe',
      delta_cents: -3000,
      cpAccountId: 'cp',
      cashAccountId: 'cash',
    });
    const all = [...create, ...pay];
    const cpNet = all.reduce((s, l) => {
      if (l.account_id !== 'cp') return s;
      return s + (l.debit_cents ?? 0) - (l.credit_cents ?? 0);
    }, 0);
    expect(cpNet).toBe(-5000);
  });

  it('they_owe $50, i_owe $20 to same cp → NET cp account balance = +30', () => {
    const a = splitCreateLines({ direction: 'they_owe', amount_cents: 5000, cpAccountId: 'cp' });
    const b = splitCreateLines({ direction: 'i_owe', amount_cents: 2000, cpAccountId: 'cp' });
    const all = [...a, ...b];
    const cpNet = all.reduce((s, l) => {
      if (l.account_id !== 'cp') return s;
      return s + (l.debit_cents ?? 0) - (l.credit_cents ?? 0);
    }, 0);
    expect(cpNet).toBe(3000);
  });
});
