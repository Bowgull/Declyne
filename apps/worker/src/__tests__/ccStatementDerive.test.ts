import { describe, expect, it } from 'vitest';
import { deriveCcStatements } from '../lib/ccStatementDerive.js';

const debt = {
  debt_id: 'debt_1',
  principal_cents: 100_000,
  statement_day: 5,
  due_day: 28,
  min_payment_type: 'percent' as const,
  min_payment_value: 300,
};

describe('deriveCcStatements', () => {
  it('returns empty when no txns', () => {
    expect(deriveCcStatements(debt, [], [], new Date('2026-04-24'))).toEqual([]);
  });

  it('derives a closed cycle with paid_in_full=1', () => {
    const txns = [
      { posted_at: '2026-02-10', amount_cents: -20_000 },
      { posted_at: '2026-02-20', amount_cents: -30_000 },
      { posted_at: '2026-03-05', amount_cents: -10_000 }, // on statement day, counts this cycle
      { posted_at: '2026-03-20', amount_cents: 60_000 }, // payment before due
    ];
    const out = deriveCcStatements(debt, txns, [], new Date('2026-04-24'));
    const march = out.find((s) => s.statement_date === '2026-03-05');
    expect(march).toBeDefined();
    expect(march?.statement_balance_cents).toBe(60_000);
    expect(march?.paid_in_full).toBe(1);
    expect(march?.due_date).toBe('2026-03-28');
  });

  it('flags unpaid cycle as paid_in_full=0', () => {
    const txns = [
      { posted_at: '2026-02-10', amount_cents: -40_000 },
      { posted_at: '2026-03-05', amount_cents: -10_000 },
      { posted_at: '2026-03-20', amount_cents: 10_000 },
    ];
    const out = deriveCcStatements(debt, txns, [], new Date('2026-04-24'));
    const march = out.find((s) => s.statement_date === '2026-03-05');
    expect(march?.paid_in_full).toBe(0);
    expect(march?.statement_balance_cents).toBe(50_000);
  });

  it('skips cycles whose due_date is in the future', () => {
    const txns = [{ posted_at: '2026-04-10', amount_cents: -5000 }];
    const out = deriveCcStatements(debt, txns, [], new Date('2026-04-24'));
    // April 5 cycle had no charges; May 5 not yet closed.
    expect(out).toEqual([]);
  });

  it('skips statements already existing', () => {
    const txns = [
      { posted_at: '2026-02-10', amount_cents: -20_000 },
      { posted_at: '2026-03-05', amount_cents: -10_000 },
      { posted_at: '2026-03-20', amount_cents: 30_000 },
    ];
    const existing = [{ statement_date: '2026-03-05' }];
    const out = deriveCcStatements(debt, txns, existing, new Date('2026-04-24'));
    expect(out.find((s) => s.statement_date === '2026-03-05')).toBeUndefined();
  });

  it('due_day before statement_day rolls to next month', () => {
    const d = { ...debt, statement_day: 21, due_day: 15 };
    const txns = [
      { posted_at: '2026-02-25', amount_cents: -10_000 },
      { posted_at: '2026-03-10', amount_cents: 10_000 },
    ];
    const out = deriveCcStatements(d, txns, [], new Date('2026-04-24'));
    const mar = out.find((s) => s.statement_date === '2026-03-21');
    expect(mar?.due_date).toBe('2026-04-15');
  });

  it('applies min_payment_cents via percent with floor', () => {
    const txns = [
      { posted_at: '2026-02-10', amount_cents: -50_000 },
      { posted_at: '2026-03-05', amount_cents: -10_000 },
    ];
    const out = deriveCcStatements(debt, txns, [], new Date('2026-04-24'));
    const march = out.find((s) => s.statement_date === '2026-03-05');
    // charges = 60_000, 300 bps = 1_800, floor = 1_000, min = 1_800
    expect(march?.min_payment_cents).toBe(1_800);
  });
});
