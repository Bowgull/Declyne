import { describe, it, expect } from 'vitest';
import {
  buildHabitContext,
  bucketVelocity,
  monthlyFromCadence,
  type HabitMerchantInput,
} from '../lib/habitContext.js';
import type { SubscriptionPrediction } from '../lib/recurring.js';

const merchant = (overrides: Partial<HabitMerchantInput> = {}): HabitMerchantInput => ({
  merchant_id: 'm_x',
  display_name: 'Merchant',
  category_group: 'indulgence',
  sub_category: 'bars',
  sub_category_confirmed: 1,
  spend_30d_cents: 0,
  spend_90d_cents: 0,
  ...overrides,
});

const sub = (overrides: Partial<SubscriptionPrediction> = {}): SubscriptionPrediction => ({
  merchant_id: 'm_netflix',
  merchant_name: 'Netflix',
  amount_cents: 2099,
  category_group: 'lifestyle',
  first_seen: '2026-01-04',
  last_seen: '2026-04-04',
  cadence_days: 30,
  occurrences: 4,
  months_running: 4,
  ...overrides,
});

describe('bucketVelocity', () => {
  it('accelerating when 30d ≥1.05× of 90d/3', () => {
    expect(bucketVelocity(120, 300)).toBe('accelerating'); // 120 / 100 = 1.2
  });
  it('cooling when 30d ≤0.95× of 90d/3', () => {
    expect(bucketVelocity(80, 300)).toBe('cooling'); // 80 / 100 = 0.8
  });
  it('steady inside the ±5% band', () => {
    expect(bucketVelocity(100, 300)).toBe('steady');
    expect(bucketVelocity(102, 300)).toBe('steady');
  });
  it('steady when 90d is zero (no history)', () => {
    expect(bucketVelocity(50, 0)).toBe('steady');
  });
});

describe('monthlyFromCadence', () => {
  it('normalises monthly cadence', () => {
    expect(monthlyFromCadence(2099, 30)).toBe(2099);
  });
  it('weekly cadence is roughly 4.3×', () => {
    expect(monthlyFromCadence(500, 7)).toBe(2143);
  });
  it('zero cadence returns 0 (defensive)', () => {
    expect(monthlyFromCadence(2099, 0)).toBe(0);
  });
});

describe('buildHabitContext', () => {
  it('returns empty shape on empty input', () => {
    const ctx = buildHabitContext({ merchants: [], subscriptions: [], verdicts: [] });
    expect(ctx.by_sub_category).toEqual([]);
    expect(ctx.subscription_bleed.monthly_cents).toBe(0);
    expect(ctx.subscription_bleed.annual_cents).toBe(0);
    expect(ctx.subscription_bleed.kill_candidates).toEqual([]);
    expect(ctx.hot_categories).toEqual([]);
    expect(ctx.cold_categories).toEqual([]);
  });

  it('skips unconfirmed merchants', () => {
    const ctx = buildHabitContext({
      merchants: [
        merchant({ sub_category_confirmed: 0, spend_90d_cents: 50000, spend_30d_cents: 20000 }),
      ],
      subscriptions: [],
      verdicts: [],
    });
    expect(ctx.by_sub_category).toEqual([]);
  });

  it('skips merchants with no 90d spend', () => {
    const ctx = buildHabitContext({
      merchants: [merchant({ spend_90d_cents: 0, spend_30d_cents: 0 })],
      subscriptions: [],
      verdicts: [],
    });
    expect(ctx.by_sub_category).toEqual([]);
  });

  it('aggregates merchants by sub-category with monthly burn = 90d/3', () => {
    const ctx = buildHabitContext({
      merchants: [
        merchant({ merchant_id: 'm1', display_name: 'Bar Raval', sub_category: 'bars', spend_30d_cents: 12000, spend_90d_cents: 30000 }),
        merchant({ merchant_id: 'm2', display_name: 'LCBO', sub_category: 'bars', spend_30d_cents: 8000, spend_90d_cents: 21000 }),
      ],
      subscriptions: [],
      verdicts: [],
    });
    expect(ctx.by_sub_category).toHaveLength(1);
    const row = ctx.by_sub_category[0]!;
    expect(row.sub).toBe('bars');
    expect(row.spend_30d_cents).toBe(20000);
    expect(row.spend_90d_cents).toBe(51000);
    expect(row.monthly_burn_cents).toBe(17000);
    expect(row.merchant_count).toBe(2);
    expect(row.top_merchants[0]!.name).toBe('Bar Raval');
  });

  it('top_merchants is capped at 3 and sorted desc by spend', () => {
    const ctx = buildHabitContext({
      merchants: [
        merchant({ merchant_id: 'a', display_name: 'A', sub_category: 'takeout', spend_90d_cents: 10000 }),
        merchant({ merchant_id: 'b', display_name: 'B', sub_category: 'takeout', spend_90d_cents: 30000 }),
        merchant({ merchant_id: 'c', display_name: 'C', sub_category: 'takeout', spend_90d_cents: 20000 }),
        merchant({ merchant_id: 'd', display_name: 'D', sub_category: 'takeout', spend_90d_cents: 5000 }),
      ],
      subscriptions: [],
      verdicts: [],
    });
    const row = ctx.by_sub_category[0]!;
    expect(row.top_merchants.map((m) => m.name)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by_sub_category by 90d spend descending', () => {
    const ctx = buildHabitContext({
      merchants: [
        merchant({ merchant_id: 'a', sub_category: 'bars', spend_90d_cents: 10000 }),
        merchant({ merchant_id: 'b', sub_category: 'takeout', spend_90d_cents: 50000 }),
        merchant({ merchant_id: 'c', sub_category: 'weed', spend_90d_cents: 20000 }),
      ],
      subscriptions: [],
      verdicts: [],
    });
    expect(ctx.by_sub_category.map((r) => r.sub)).toEqual(['takeout', 'weed', 'bars']);
  });

  it('hot/cold categories follow velocity', () => {
    const ctx = buildHabitContext({
      merchants: [
        merchant({ merchant_id: 'a', sub_category: 'bars', spend_30d_cents: 30000, spend_90d_cents: 60000 }), // 30 vs 20 → hot
        merchant({ merchant_id: 'b', sub_category: 'takeout', spend_30d_cents: 10000, spend_90d_cents: 60000 }), // 10 vs 20 → cold
        merchant({ merchant_id: 'c', sub_category: 'weed', spend_30d_cents: 10000, spend_90d_cents: 30000 }), // steady
      ],
      subscriptions: [],
      verdicts: [],
    });
    expect(ctx.hot_categories).toEqual(['bars']);
    expect(ctx.cold_categories).toEqual(['takeout']);
  });

  it('subscription bleed sums monthly + annual = monthly × 12', () => {
    const ctx = buildHabitContext({
      merchants: [],
      subscriptions: [
        sub({ merchant_id: 'm1', amount_cents: 2099, cadence_days: 30 }),
        sub({ merchant_id: 'm2', amount_cents: 1300, cadence_days: 30 }),
      ],
      verdicts: [],
    });
    expect(ctx.subscription_bleed.monthly_cents).toBe(3399);
    expect(ctx.subscription_bleed.annual_cents).toBe(40788);
  });

  it('not_a_sub verdict drops the sub from bleed entirely', () => {
    const ctx = buildHabitContext({
      merchants: [],
      subscriptions: [sub({ merchant_id: 'm1', amount_cents: 2099, cadence_days: 30 })],
      verdicts: [{ merchant_id: 'm1', verdict: 'not_a_sub' }],
    });
    expect(ctx.subscription_bleed.monthly_cents).toBe(0);
    expect(ctx.subscription_bleed.kill_candidates).toEqual([]);
  });

  it('keep/kill verdict still counts toward bleed but is not a kill candidate', () => {
    const ctx = buildHabitContext({
      merchants: [],
      subscriptions: [
        sub({ merchant_id: 'm_keep', merchant_name: 'Spotify', amount_cents: 1300, cadence_days: 30 }),
        sub({ merchant_id: 'm_kill', merchant_name: 'NYT', amount_cents: 1700, cadence_days: 30 }),
      ],
      verdicts: [
        { merchant_id: 'm_keep', verdict: 'keep' },
        { merchant_id: 'm_kill', verdict: 'kill' },
      ],
    });
    expect(ctx.subscription_bleed.monthly_cents).toBe(3000);
    expect(ctx.subscription_bleed.kill_candidates).toEqual([]);
  });

  it('kill candidates are undecided subs ≥ $10/mo, sorted desc', () => {
    const ctx = buildHabitContext({
      merchants: [],
      subscriptions: [
        sub({ merchant_id: 'm_low', merchant_name: 'iCloud', amount_cents: 399, cadence_days: 30 }), // $4 — below threshold
        sub({ merchant_id: 'm_mid', merchant_name: 'Spotify', amount_cents: 1300, cadence_days: 30 }),
        sub({ merchant_id: 'm_hi',  merchant_name: 'Netflix', amount_cents: 2099, cadence_days: 30 }),
      ],
      verdicts: [],
    });
    expect(ctx.subscription_bleed.kill_candidates.map((k) => k.name)).toEqual(['Netflix', 'Spotify']);
    expect(ctx.subscription_bleed.kill_candidates[0]!.monthly_cents).toBe(2099);
    expect(ctx.subscription_bleed.kill_candidates[0]!.reason).toBe('undecided');
  });

  it('killed subs do not appear in kill_candidates even if over $10/mo', () => {
    const ctx = buildHabitContext({
      merchants: [],
      subscriptions: [sub({ merchant_id: 'm1', amount_cents: 2099, cadence_days: 30 })],
      verdicts: [{ merchant_id: 'm1', verdict: 'kill' }],
    });
    expect(ctx.subscription_bleed.kill_candidates).toEqual([]);
  });
});
