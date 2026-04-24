import { describe, it, expect } from 'vitest';
import { buildCoachPayload, COACH_SYSTEM_PROMPT } from '../lib/coach.js';

const snap = {
  as_of: '2026-04-24',
  vice_ratio_bps: 1800,
  days_to_zero: 12,
  cc_payoff_streak: 2,
  subscription_creep_pct_bps: 400,
  savings_increased_bool: 1,
  vice_peak_day: 5,
  review_queue_lag_days: 3,
  reconciliation_streak: 4,
};

describe('coach payload', () => {
  it('includes phase name and snapshot verbatim', () => {
    const p = buildCoachPayload(2, snap);
    expect(p.phase).toBe(2);
    expect(p.phase_name).toBe('Clear Debt');
    expect(p.snapshot).toEqual(snap);
    expect(p.as_of).toBe('2026-04-24');
  });

  it('instructions forbid arithmetic and em dashes', () => {
    const p = buildCoachPayload(1, snap);
    const joined = p.instructions.join(' ');
    expect(joined).toMatch(/No arithmetic/);
    expect(joined).toMatch(/No em dashes/);
  });

  it('system prompt forbids arithmetic', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(/Never do arithmetic/);
    expect(COACH_SYSTEM_PROMPT).not.toMatch(/[\u2013\u2014]/);
  });
});
