import { describe, it, expect } from 'vitest';
import { hashPlanInputs, trimHabitContextForAi, validateAiRationale } from '../routes/plan.js';
import type { HabitContext } from '../lib/habitContext.js';

const baseDebts = [
  {
    id: 'd1',
    name: 'Visa',
    principal_cents: 100_000,
    interest_rate_bps: 1999,
    min_payment_type: 'percent' as const,
    min_payment_value: 200,
    severity: 'current' as const,
  },
];

const baseBundle = {
  debts: baseDebts,
  paycheque_cents: 425_000,
  essentials_per_paycheque: 100_000,
  indulgence_per_paycheque: 0,
  charge_velocity_per_debt_cents: { d1: 50_000 },
  debt_rows: [],
  commitment_lines: [],
  bills_cents: 0,
  savings_cents: 0,
  essentials_variable_baseline_cents: 0,
  lifestyle_baseline_cents: 0,
};

describe('hashPlanInputs', () => {
  it('produces a stable string for identical inputs', () => {
    expect(hashPlanInputs(baseBundle)).toBe(hashPlanInputs(baseBundle));
  });

  it('changes when paycheque changes', () => {
    const a = hashPlanInputs(baseBundle);
    const b = hashPlanInputs({ ...baseBundle, paycheque_cents: 500_000 });
    expect(a).not.toBe(b);
  });

  it('changes when severity changes', () => {
    const a = hashPlanInputs(baseBundle);
    const b = hashPlanInputs({
      ...baseBundle,
      debts: [{ ...baseDebts[0]!, severity: 'past_due' as const }],
    });
    expect(a).not.toBe(b);
  });

  it('changes when charge velocity changes', () => {
    const a = hashPlanInputs(baseBundle);
    const b = hashPlanInputs({
      ...baseBundle,
      charge_velocity_per_debt_cents: { d1: 99_999 },
    });
    expect(a).not.toBe(b);
  });

  it('order-independent across debt list', () => {
    const a = hashPlanInputs({
      ...baseBundle,
      debts: [
        { ...baseDebts[0]! },
        { ...baseDebts[0]!, id: 'd2', name: 'Other', principal_cents: 5000 },
      ],
    });
    const b = hashPlanInputs({
      ...baseBundle,
      debts: [
        { ...baseDebts[0]!, id: 'd2', name: 'Other', principal_cents: 5000 },
        { ...baseDebts[0]! },
      ],
    });
    expect(a).toBe(b);
  });
});

describe('validateAiRationale', () => {
  it('accepts a clean rationale + observations', () => {
    const v = validateAiRationale({
      rationale: 'Capital One first, in collections.',
      observations: ['groceries up 12% last 30d'],
    });
    expect(v).toEqual({
      rationale: 'Capital One first, in collections.',
      observations: ['groceries up 12% last 30d'],
    });
  });

  it('rejects empty rationale', () => {
    const v = validateAiRationale({ rationale: '   ', observations: [] });
    expect('error' in v).toBe(true);
  });

  it('rejects non-object input', () => {
    expect('error' in validateAiRationale('nope')).toBe(true);
    expect('error' in validateAiRationale(null)).toBe(true);
  });

  it('caps observations at 3 and skips non-strings', () => {
    const v = validateAiRationale({
      rationale: 'ok',
      observations: ['a', 'b', 'c', 'd', 42],
    });
    if ('error' in v) throw new Error('should pass');
    expect(v.observations).toEqual(['a', 'b', 'c']);
  });

  it('rejects rationale over 800 chars', () => {
    const v = validateAiRationale({
      rationale: 'x'.repeat(900),
      observations: [],
    });
    expect('error' in v).toBe(true);
  });

  it('skips overlong observations', () => {
    const v = validateAiRationale({
      rationale: 'ok',
      observations: ['short', 'x'.repeat(300)],
    });
    if ('error' in v) throw new Error('should pass');
    expect(v.observations).toEqual(['short']);
  });

  it('handles missing observations gracefully', () => {
    const v = validateAiRationale({ rationale: 'fine' });
    if ('error' in v) throw new Error('should pass');
    expect(v.observations).toEqual([]);
  });
});

describe('trimHabitContextForAi', () => {
  const fullCtx: HabitContext = {
    by_sub_category: [
      {
        sub: 'bars',
        spend_30d_cents: 40_000,
        spend_90d_cents: 90_000,
        monthly_burn_cents: 30_000,
        velocity: 'accelerating',
        merchant_count: 2,
        top_merchants: [
          { name: 'LCBO', spend_90d_cents: 60_000 },
          { name: 'Beer Store', spend_90d_cents: 30_000 },
        ],
      },
    ],
    subscription_bleed: {
      monthly_cents: 4_500,
      annual_cents: 54_000,
      kill_candidates: [
        { merchant_id: 'm_spotify', name: 'Spotify', monthly_cents: 1_300, reason: 'undecided' },
      ],
    },
    hot_categories: ['bars'],
    cold_categories: [],
  };

  it('drops top_merchants from sub-category rows', () => {
    const t = trimHabitContextForAi(fullCtx);
    expect(t.by_sub_category[0]).toEqual({
      sub: 'bars',
      monthly_burn_cents: 30_000,
      velocity: 'accelerating',
    });
    expect((t.by_sub_category[0] as Record<string, unknown>).top_merchants).toBeUndefined();
  });

  it('drops merchant_id and reason from kill_candidates', () => {
    const t = trimHabitContextForAi(fullCtx);
    expect(t.subscription_bleed.kill_candidates).toEqual([
      { name: 'Spotify', monthly_cents: 1_300 },
    ]);
  });

  it('preserves bleed totals + hot/cold lists', () => {
    const t = trimHabitContextForAi(fullCtx);
    expect(t.subscription_bleed.monthly_cents).toBe(4_500);
    expect(t.subscription_bleed.annual_cents).toBe(54_000);
    expect(t.hot_categories).toEqual(['bars']);
    expect(t.cold_categories).toEqual([]);
  });

  it('handles empty context', () => {
    const empty: HabitContext = {
      by_sub_category: [],
      subscription_bleed: { monthly_cents: 0, annual_cents: 0, kill_candidates: [] },
      hot_categories: [],
      cold_categories: [],
    };
    const t = trimHabitContextForAi(empty);
    expect(t.by_sub_category).toEqual([]);
    expect(t.subscription_bleed.kill_candidates).toEqual([]);
  });
});
