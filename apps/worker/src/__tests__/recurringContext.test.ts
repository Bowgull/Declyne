import { describe, it, expect } from 'vitest';
import { buildRecurringContext } from '../lib/recurringContext.js';
import type { RecurringTxn } from '../lib/recurring.js';

const mk = (
  merchant_id: string,
  merchant_name: string,
  group: string,
  posted_at: string,
  amount_cents: number,
): RecurringTxn => ({ merchant_id, merchant_name, group, posted_at, amount_cents });

const TODAY = '2026-04-25';

// 4 monthly bill charges over the past 4 months.
const billRows: RecurringTxn[] = [
  mk('m_bell', 'Bell', 'essentials', '2026-01-15', -8400),
  mk('m_bell', 'Bell', 'essentials', '2026-02-15', -8400),
  mk('m_bell', 'Bell', 'essentials', '2026-03-15', -8400),
  mk('m_bell', 'Bell', 'essentials', '2026-04-15', -8400),
];

// 4 monthly Netflix charges over the past 4 months (180d window only).
const subRows: RecurringTxn[] = [
  mk('m_netflix', 'Netflix', 'lifestyle', '2026-01-04', -2099),
  mk('m_netflix', 'Netflix', 'lifestyle', '2026-02-04', -2099),
  mk('m_netflix', 'Netflix', 'lifestyle', '2026-03-04', -2099),
  mk('m_netflix', 'Netflix', 'lifestyle', '2026-04-04', -2099),
];

describe('buildRecurringContext', () => {
  it('exposes the txn arrays it was built with', () => {
    const ctx = buildRecurringContext({
      today: TODAY,
      txns_90d: billRows,
      txns_180d: [...billRows, ...subRows],
    });
    expect(ctx.today).toBe(TODAY);
    expect(ctx.txns_90d).toBe(billRows);
    expect(ctx.txns_180d.length).toBe(8);
  });

  it('runs the bill detector on demand and surfaces the prediction', () => {
    const ctx = buildRecurringContext({
      today: TODAY,
      txns_90d: billRows,
      txns_180d: billRows,
    });
    const out = ctx.getRecurring(30);
    expect(out.length).toBe(1);
    expect(out[0]!.merchant_name).toBe('Bell');
    expect(out[0]!.cadence_days).toBeGreaterThanOrEqual(28);
  });

  it('memoises detector output per horizonDays', () => {
    const ctx = buildRecurringContext({
      today: TODAY,
      txns_90d: billRows,
      txns_180d: billRows,
    });
    const a = ctx.getRecurring(30);
    const b = ctx.getRecurring(30);
    expect(a).toBe(b);
  });

  it('runs the detector again for a different horizon', () => {
    const ctx = buildRecurringContext({
      today: TODAY,
      txns_90d: billRows,
      txns_180d: billRows,
    });
    const a = ctx.getRecurring(30);
    const b = ctx.getRecurring(7);
    // Different cache slot — different array even though both find Bell.
    expect(a).not.toBe(b);
    // Bell next-due is 2026-05-15, ~20d out. 30 includes it; 7 excludes it.
    expect(a.length).toBe(1);
    expect(b.length).toBe(0);
  });

  it('detects subscriptions from the 180d window eagerly', () => {
    const ctx = buildRecurringContext({
      today: TODAY,
      txns_90d: subRows.slice(2),
      txns_180d: subRows,
    });
    expect(ctx.subscriptions.length).toBe(1);
    expect(ctx.subscriptions[0]!.merchant_name).toBe('Netflix');
    expect(ctx.subscriptions[0]!.amount_cents).toBe(2099);
  });

  it('returns empty arrays cleanly when given no input', () => {
    const ctx = buildRecurringContext({
      today: TODAY,
      txns_90d: [],
      txns_180d: [],
    });
    expect(ctx.subscriptions).toEqual([]);
    expect(ctx.getRecurring(30)).toEqual([]);
  });

  it('keeps subscriptions independent from bill cache', () => {
    const ctx = buildRecurringContext({
      today: TODAY,
      txns_90d: billRows,
      txns_180d: [...billRows, ...subRows],
    });
    // Bell is essentials → bills detector. Netflix is lifestyle → subs.
    expect(ctx.getRecurring(30).map((r) => r.merchant_name)).toEqual(['Bell']);
    expect(ctx.subscriptions.map((s) => s.merchant_name)).toEqual(['Netflix']);
  });
});
