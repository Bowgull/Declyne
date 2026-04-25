import { describe, it, expect } from 'vitest';
import { detectRecurring, predictNextPayday, type RecurringTxn } from '../lib/recurring.js';

const mk = (
  merchant_id: string,
  merchant_name: string,
  group: string,
  posted_at: string,
  amount_cents: number,
): RecurringTxn => ({ merchant_id, merchant_name, group, posted_at, amount_cents });

describe('detectRecurring', () => {
  it('returns empty when no merchants meet the minimum occurrence count', () => {
    const out = detectRecurring(
      [
        mk('m1', 'Bell', 'essentials', '2026-03-01', -8400),
        mk('m1', 'Bell', 'essentials', '2026-04-01', -8400),
      ],
      '2026-04-25',
      14,
    );
    expect(out).toEqual([]);
  });

  it('predicts next monthly bill from 3 prior occurrences', () => {
    const out = detectRecurring(
      [
        mk('m1', 'Bell', 'essentials', '2026-02-05', -8400),
        mk('m1', 'Bell', 'essentials', '2026-03-05', -8400),
        mk('m1', 'Bell', 'essentials', '2026-04-05', -8400),
      ],
      '2026-04-25',
      14,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.merchant_name).toBe('Bell');
    expect(out[0]!.amount_cents).toBe(8400);
    expect(out[0]!.next_due).toBe('2026-05-05');
    expect(out[0]!.days_until).toBe(10);
  });

  it('skips merchants whose predicted date falls outside the horizon', () => {
    const out = detectRecurring(
      [
        mk('m1', 'Rogers', 'essentials', '2026-01-01', -11200),
        mk('m1', 'Rogers', 'essentials', '2026-02-01', -11200),
        mk('m1', 'Rogers', 'essentials', '2026-03-01', -11200),
      ],
      '2026-04-25',
      14,
    );
    // Predicted next ~ 2026-03-29, which is in the past => filtered out.
    expect(out).toEqual([]);
  });

  it('ignores indulgence and lifestyle merchants', () => {
    const out = detectRecurring(
      [
        mk('m1', 'Tim Hortons', 'indulgence', '2026-04-05', -540),
        mk('m1', 'Tim Hortons', 'indulgence', '2026-04-12', -540),
        mk('m1', 'Tim Hortons', 'indulgence', '2026-04-19', -540),
      ],
      '2026-04-25',
      14,
    );
    expect(out).toEqual([]);
  });

  it('ignores positive-amount rows (income reversals, refunds)', () => {
    const out = detectRecurring(
      [
        mk('m1', 'Bell', 'essentials', '2026-02-05', 8400),
        mk('m1', 'Bell', 'essentials', '2026-03-05', 8400),
        mk('m1', 'Bell', 'essentials', '2026-04-05', 8400),
      ],
      '2026-04-25',
      14,
    );
    expect(out).toEqual([]);
  });

  it('rejects merchants with cadence outside [5, 35] days', () => {
    const out = detectRecurring(
      [
        mk('m1', 'Coffee', 'essentials', '2026-04-20', -300),
        mk('m1', 'Coffee', 'essentials', '2026-04-22', -300),
        mk('m1', 'Coffee', 'essentials', '2026-04-24', -300),
      ],
      '2026-04-25',
      14,
    );
    expect(out).toEqual([]);
  });

  it('sorts predictions by next_due ascending', () => {
    const out = detectRecurring(
      [
        mk('m1', 'Bell', 'essentials', '2026-02-15', -8400),
        mk('m1', 'Bell', 'essentials', '2026-03-15', -8400),
        mk('m1', 'Bell', 'essentials', '2026-04-15', -8400),
        mk('m2', 'Rogers', 'essentials', '2026-02-05', -11200),
        mk('m2', 'Rogers', 'essentials', '2026-03-05', -11200),
        mk('m2', 'Rogers', 'essentials', '2026-04-05', -11200),
      ],
      '2026-04-25',
      21,
    );
    expect(out.map((r) => r.merchant_name)).toEqual(['Rogers', 'Bell']);
  });
});

describe('predictNextPayday', () => {
  it('returns null when no period available', () => {
    expect(predictNextPayday(null, '2026-04-25', 14)).toBeNull();
  });

  it('predicts next payday as end_date + 1', () => {
    const out = predictNextPayday(
      { end_date: '2026-05-06', paycheque_cents: 240_000 },
      '2026-04-25',
      14,
    );
    expect(out).toEqual({ next_due: '2026-05-07', days_until: 12, amount_cents: 240_000 });
  });

  it('returns null when next payday falls outside the horizon', () => {
    expect(
      predictNextPayday({ end_date: '2026-05-20', paycheque_cents: 240_000 }, '2026-04-25', 14),
    ).toBeNull();
  });
});
