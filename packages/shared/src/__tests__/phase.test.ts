import { describe, it, expect } from 'vitest';
import { evaluatePhase } from '../phase.js';

const base = {
  essentials_covered_streak_periods: 0,
  cc_payoff_streak_periods: 0,
  non_mortgage_debt_ratio_to_phase2_entry: 1,
  missed_min_payment_days_ago: null,
  utilization_under_30_streak_statements: 0,
  on_time_streak_days: 0,
  buffer_months_essentials: 0,
  vice_ratio_trailing_30d: 0.5,
};

describe('evaluatePhase', () => {
  it('stays at phase 1 when rule not met', () => {
    const r = evaluatePhase({ ...base, current_phase: 1 });
    expect(r.next_phase).toBe(1);
    expect(r.rule_triggered).toBeNull();
  });

  it('promotes 1 → 2 when essentials covered 2 periods and CC streak ≥ 1', () => {
    const r = evaluatePhase({
      ...base,
      current_phase: 1,
      essentials_covered_streak_periods: 2,
      cc_payoff_streak_periods: 1,
    });
    expect(r.next_phase).toBe(2);
    expect(r.rule_triggered).toMatch(/p1_to_p2/);
  });

  it('does not demote from 3 even if utilization breaks', () => {
    const r = evaluatePhase({
      ...base,
      current_phase: 3,
      utilization_under_30_streak_statements: 0,
    });
    expect(r.next_phase).toBe(3);
  });

  it('promotes 4 → 5 on buffer and vice thresholds', () => {
    const r = evaluatePhase({
      ...base,
      current_phase: 4,
      buffer_months_essentials: 3,
      vice_ratio_trailing_30d: 0.14,
    });
    expect(r.next_phase).toBe(5);
  });

  it('does not skip phases (phase 1 cannot leapfrog to 3 in one eval)', () => {
    const r = evaluatePhase({
      ...base,
      current_phase: 1,
      essentials_covered_streak_periods: 2,
      cc_payoff_streak_periods: 1,
      utilization_under_30_streak_statements: 99,
      on_time_streak_days: 9999,
    });
    expect(r.next_phase).toBe(2);
  });
});
