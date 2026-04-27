import { describe, it, expect } from 'vitest';
import {
  computeInterestAccrued,
  splitLoanPaymentLines,
  statementMismatchCents,
} from '../lib/debtGl.js';
import { validateLines } from '../lib/gl.js';

describe('computeInterestAccrued — pure', () => {
  it('zero principal returns 0', () => {
    expect(computeInterestAccrued(0, 1999, 30)).toBe(0);
  });

  it('zero apr returns 0', () => {
    expect(computeInterestAccrued(100000, 0, 30)).toBe(0);
  });

  it('zero days returns 0', () => {
    expect(computeInterestAccrued(100000, 1999, 0)).toBe(0);
  });

  it('30-day accrual on $1000 at 19.99% APR ≈ $16.43', () => {
    // 100000 * 1999 * 30 / (10000 * 365) = 1642.6027... → rounds to 1643
    expect(computeInterestAccrued(100000, 1999, 30)).toBe(1643);
  });

  it('rejects negative inputs by clamping to 0', () => {
    expect(computeInterestAccrued(-1000, 1999, 30)).toBe(0);
    expect(computeInterestAccrued(100000, -1, 30)).toBe(0);
    expect(computeInterestAccrued(100000, 1999, -1)).toBe(0);
  });

  it('truncates fractional inputs', () => {
    expect(computeInterestAccrued(100000.9, 1999.4, 30.7)).toBe(1643);
  });
});

describe('splitLoanPaymentLines — pure', () => {
  it('zero total returns empty', () => {
    expect(
      splitLoanPaymentLines({
        totalPaid_cents: 0,
        principal_cents: 100000,
        apr_bps: 1999,
        daysSinceLast: 30,
        debtAccountId: 'gla_x',
        cashAccountId: 'gla_cash',
      }),
    ).toEqual([]);
  });

  it('zero APR yields all-principal 2-line JE', () => {
    const lines = splitLoanPaymentLines({
      totalPaid_cents: 10000,
      principal_cents: 110000,
      apr_bps: 0,
      daysSinceLast: 30,
      debtAccountId: 'gla_debt_luther',
      cashAccountId: 'gla_cash_chq',
    });
    expect(lines).toEqual([
      { account_id: 'gla_debt_luther', debit_cents: 10000 },
      { account_id: 'gla_cash_chq', credit_cents: 10000 },
    ]);
    expect(() => validateLines(lines)).not.toThrow();
  });

  it('positive APR splits into 3 lines: principal + interest + cash', () => {
    const lines = splitLoanPaymentLines({
      totalPaid_cents: 10000,
      principal_cents: 100000,
      apr_bps: 1999,
      daysSinceLast: 30,
      debtAccountId: 'gla_debt',
      cashAccountId: 'gla_cash',
    });
    // interest = 1643, principal = 8357
    expect(lines).toEqual([
      { account_id: 'gla_debt', debit_cents: 8357 },
      { account_id: 'gla_exp_debt', debit_cents: 1643 },
      { account_id: 'gla_cash', credit_cents: 10000 },
    ]);
    expect(() => validateLines(lines)).not.toThrow();
  });

  it('interest >= total: principal portion drops to 0, interest fills', () => {
    const lines = splitLoanPaymentLines({
      totalPaid_cents: 1000,
      principal_cents: 10000000,
      apr_bps: 9999,
      daysSinceLast: 365,
      debtAccountId: 'gla_debt',
      cashAccountId: 'gla_cash',
    });
    // accrued = 10000000 * 9999 * 365 / (10000 * 365) = 9_999_000 → capped at total=1000
    expect(lines).toEqual([
      { account_id: 'gla_exp_debt', debit_cents: 1000 },
      { account_id: 'gla_cash', credit_cents: 1000 },
    ]);
    expect(() => validateLines(lines)).not.toThrow();
  });

  it('rejects negative total via empty array', () => {
    expect(
      splitLoanPaymentLines({
        totalPaid_cents: -50,
        principal_cents: 100,
        apr_bps: 100,
        daysSinceLast: 1,
        debtAccountId: 'a',
        cashAccountId: 'b',
      }),
    ).toEqual([]);
  });
});

describe('statementMismatchCents — pure', () => {
  it('matching balances yield 0', () => {
    expect(statementMismatchCents(43224, 43224)).toBe(0);
  });

  it('GL > statement returns positive', () => {
    expect(statementMismatchCents(45510, 43224)).toBe(2286);
  });

  it('GL < statement returns negative', () => {
    expect(statementMismatchCents(43224, 45510)).toBe(-2286);
  });

  it('truncates fractional inputs before subtracting', () => {
    expect(statementMismatchCents(43224.7, 43224.4)).toBe(0);
  });
});
