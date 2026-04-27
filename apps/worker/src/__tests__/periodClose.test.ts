import { describe, it, expect } from 'vitest';
import {
  findCoveringClose,
  netWorthFromTrialBalance,
  mostRecentSaturday,
  periodStartFromEnd,
} from '../lib/periodClose.js';

describe('mostRecentSaturday', () => {
  it('Saturday returns itself', () => {
    expect(mostRecentSaturday('2026-04-25')).toBe('2026-04-25');
  });
  it('Sunday walks back six days', () => {
    expect(mostRecentSaturday('2026-04-26')).toBe('2026-04-25');
  });
  it('Monday → previous Saturday', () => {
    expect(mostRecentSaturday('2026-04-27')).toBe('2026-04-25');
  });
  it('Friday → most recent Saturday is six days back', () => {
    expect(mostRecentSaturday('2026-05-01')).toBe('2026-04-25');
  });
  it('rejects malformed today', () => {
    expect(() => mostRecentSaturday('today')).toThrow();
  });
});

describe('periodStartFromEnd', () => {
  it('Saturday end → previous Sunday start', () => {
    expect(periodStartFromEnd('2026-04-25')).toBe('2026-04-19');
  });
  it('rejects malformed period_end', () => {
    expect(() => periodStartFromEnd('nope')).toThrow();
  });
});

describe('findCoveringClose', () => {
  const closes = [{ period_end: '2026-03-28' }, { period_end: '2026-04-04' }, { period_end: '2026-04-25' }];

  it('returns latest covering close for a backdated post', () => {
    expect(findCoveringClose('2026-04-20', closes)).toBe('2026-04-25');
  });
  it('returns the latest close, not the earliest, when multiple cover', () => {
    // 2026-03-15 is <= all three period_ends; all "cover" it. The latest is binding.
    expect(findCoveringClose('2026-03-15', closes)).toBe('2026-04-25');
  });
  it('null when post is after every close', () => {
    expect(findCoveringClose('2026-04-26', closes)).toBeNull();
  });
  it('boundary: posted_at on period_end is locked', () => {
    expect(findCoveringClose('2026-04-25', closes)).toBe('2026-04-25');
  });
  it('handles ISO timestamp by slicing', () => {
    expect(findCoveringClose('2026-04-20T15:00:00.000Z', closes)).toBe('2026-04-25');
  });
});

describe('netWorthFromTrialBalance', () => {
  it('books a clean balance: assets - liabilities = equity + net income', () => {
    const nw = netWorthFromTrialBalance([
      { type: 'asset', debit_cents: 10_000, credit_cents: 0 },
      { type: 'liability', debit_cents: 0, credit_cents: 3_000 },
      { type: 'equity', debit_cents: 0, credit_cents: 5_000 },
      { type: 'income', debit_cents: 0, credit_cents: 4_000 },
      { type: 'expense', debit_cents: 2_000, credit_cents: 0 },
    ]);
    expect(nw.assets_cents).toBe(10_000);
    expect(nw.liabilities_cents).toBe(3_000);
    expect(nw.equity_cents).toBe(5_000);
    expect(nw.income_cents).toBe(4_000);
    expect(nw.expense_cents).toBe(2_000);
    // assets − liabilities = equity + (income − expense)
    expect(nw.assets_cents - nw.liabilities_cents).toBe(nw.equity_cents + nw.income_cents - nw.expense_cents);
  });

  it('zero rows produces all zeros', () => {
    const nw = netWorthFromTrialBalance([]);
    expect(nw).toEqual({
      assets_cents: 0,
      liabilities_cents: 0,
      equity_cents: 0,
      income_cents: 0,
      expense_cents: 0,
    });
  });

  it('signed cleanup: an asset with credits > debits goes negative', () => {
    const nw = netWorthFromTrialBalance([
      { type: 'asset', debit_cents: 100, credit_cents: 500 },
    ]);
    expect(nw.assets_cents).toBe(-400);
  });

  it('liability with debits > credits goes negative (overpaid)', () => {
    const nw = netWorthFromTrialBalance([
      { type: 'liability', debit_cents: 600, credit_cents: 100 },
    ]);
    expect(nw.liabilities_cents).toBe(-500);
  });
});
