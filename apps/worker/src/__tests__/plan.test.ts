import { describe, it, expect } from 'vitest';
import { hashPlanInputs, validateAiRationale } from '../routes/plan.js';

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
