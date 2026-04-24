import { describe, it, expect } from 'vitest';
import { detectPeriods } from '../lib/payperiods.js';

describe('payperiods', () => {
  const cfg = { pattern: 'acme payroll', min_cents: 100_000, fallback_days: 14 };

  it('returns empty when no candidates match', () => {
    expect(
      detectPeriods(
        [{ posted_at: '2026-04-01', amount_cents: 50_000, description_raw: 'ACME PAYROLL' }],
        cfg,
      ),
    ).toEqual([]);
  });

  it('anchors start on deposit date and ends day before next deposit', () => {
    const out = detectPeriods(
      [
        { posted_at: '2026-04-03', amount_cents: 250_000, description_raw: 'ACME PAYROLL DEP' },
        { posted_at: '2026-04-17', amount_cents: 250_000, description_raw: 'ACME PAYROLL DEP' },
      ],
      cfg,
    );
    expect(out).toEqual([
      { start_date: '2026-04-03', end_date: '2026-04-16', paycheque_cents: 250_000 },
      { start_date: '2026-04-17', end_date: '2026-04-30', paycheque_cents: 250_000 },
    ]);
  });

  it('ignores transactions that fail the pattern', () => {
    const out = detectPeriods(
      [
        { posted_at: '2026-04-03', amount_cents: 250_000, description_raw: 'e-Transfer from mom' },
        { posted_at: '2026-04-10', amount_cents: 250_000, description_raw: 'ACME PAYROLL DEP' },
      ],
      cfg,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.start_date).toBe('2026-04-10');
  });

  it('respects min_cents threshold', () => {
    const out = detectPeriods(
      [{ posted_at: '2026-04-03', amount_cents: 99_999, description_raw: 'ACME PAYROLL' }],
      cfg,
    );
    expect(out).toEqual([]);
  });

  it('matches any amount when pattern is empty', () => {
    const out = detectPeriods(
      [{ posted_at: '2026-04-03', amount_cents: 250_000, description_raw: 'whatever' }],
      { ...cfg, pattern: '' },
    );
    expect(out).toHaveLength(1);
  });
});
