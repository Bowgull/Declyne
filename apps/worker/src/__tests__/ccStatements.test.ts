import { describe, it, expect } from 'vitest';
import { parseCcStatementInput, parseCcStatementPatch } from '../routes/ccStatements.js';
import { ccPayoffStreakFromStatements, type CcStatementRow } from '../lib/streaks.js';

describe('parseCcStatementInput', () => {
  const base = {
    debt_id: 'debt_visa',
    statement_date: '2026-04-01',
    due_date: '2026-04-21',
    statement_balance_cents: 125000,
    min_payment_cents: 5000,
    paid_in_full: 1,
  };

  it('accepts a valid input', () => {
    const out = parseCcStatementInput(base);
    expect(out).toEqual(base);
  });

  it('coerces paid_in_full truthy variants to 1, everything else 0', () => {
    expect((parseCcStatementInput({ ...base, paid_in_full: true }) as any).paid_in_full).toBe(1);
    expect((parseCcStatementInput({ ...base, paid_in_full: '1' }) as any).paid_in_full).toBe(1);
    expect((parseCcStatementInput({ ...base, paid_in_full: 0 }) as any).paid_in_full).toBe(0);
    expect((parseCcStatementInput({ ...base, paid_in_full: 'yes' }) as any).paid_in_full).toBe(0);
  });

  it('rejects malformed dates', () => {
    expect('error' in parseCcStatementInput({ ...base, statement_date: '04/01/26' })).toBe(true);
    expect('error' in parseCcStatementInput({ ...base, due_date: '' })).toBe(true);
  });

  it('rejects negative balance or min', () => {
    expect('error' in parseCcStatementInput({ ...base, statement_balance_cents: -1 })).toBe(true);
    expect('error' in parseCcStatementInput({ ...base, min_payment_cents: -1 })).toBe(true);
  });

  it('rounds numeric fields', () => {
    const out = parseCcStatementInput({ ...base, statement_balance_cents: 123.6, min_payment_cents: 10.4 });
    if ('error' in out) throw new Error(out.error);
    expect(out.statement_balance_cents).toBe(124);
    expect(out.min_payment_cents).toBe(10);
  });
});

describe('parseCcStatementPatch', () => {
  it('returns only supplied fields', () => {
    const out = parseCcStatementPatch({ paid_in_full: true });
    expect(out).toEqual({ paid_in_full: 1 });
  });

  it('rejects bad individual fields', () => {
    expect('error' in parseCcStatementPatch({ statement_date: 'nope' })).toBe(true);
    expect('error' in parseCcStatementPatch({ statement_balance_cents: -5 })).toBe(true);
    expect('error' in parseCcStatementPatch({ debt_id: '' })).toBe(true);
  });
});

describe('ccPayoffStreakFromStatements', () => {
  const mk = (debt_id: string, date: string, paid: 0 | 1): CcStatementRow => ({
    debt_id,
    statement_date: date,
    paid_in_full: paid,
  });

  it('returns 0 when no CC debts', () => {
    expect(ccPayoffStreakFromStatements([], [])).toBe(0);
  });

  it('counts leading paid_in_full per debt, aggregates with MIN', () => {
    const rows = [
      mk('a', '2026-04-01', 1),
      mk('a', '2026-03-01', 1),
      mk('a', '2026-02-01', 0),
      mk('b', '2026-04-01', 1),
      mk('b', '2026-03-01', 0),
    ];
    // a leading = 2, b leading = 1 -> min = 1
    expect(ccPayoffStreakFromStatements(rows, ['a', 'b'])).toBe(1);
  });

  it('contributes 0 when a debt has no statements', () => {
    const rows = [mk('a', '2026-04-01', 1), mk('a', '2026-03-01', 1)];
    expect(ccPayoffStreakFromStatements(rows, ['a', 'b'])).toBe(0);
  });

  it('single debt leading streak', () => {
    const rows = [
      mk('a', '2026-04-01', 1),
      mk('a', '2026-03-01', 1),
      mk('a', '2026-02-01', 1),
    ];
    expect(ccPayoffStreakFromStatements(rows, ['a'])).toBe(3);
  });
});
