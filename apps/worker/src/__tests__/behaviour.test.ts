import { describe, it, expect } from 'vitest';
import { computeBehaviour } from '../lib/behaviour.js';

const base = {
  as_of: '2026-04-24',
  indulgence_spend_cents_30d: 0,
  lifestyle_spend_cents_30d: 0,
  chequing_balance_cents: 0,
  avg_daily_burn_cents: 0,
  cc_payoff_streak: 0,
  subs_this_month_cents: 0,
  subs_3mo_avg_cents: 0,
  savings_7d_cents: 0,
  savings_prior_7d_cents: 0,
  indulgence_by_weekday_cents: [0, 0, 0, 0, 0, 0, 0],
  oldest_unresolved_review_created_at: null,
  reconciliation_streak: 0,
};

describe('behaviour', () => {
  it('indulgence ratio is bps of indulgence over indulgence+lifestyle', () => {
    const s = computeBehaviour({ ...base, indulgence_spend_cents_30d: 1000, lifestyle_spend_cents_30d: 3000 });
    expect(s.indulgence_ratio_bps).toBe(2500);
  });

  it('indulgence ratio is 0 when there is no spend', () => {
    expect(computeBehaviour(base).indulgence_ratio_bps).toBe(0);
  });

  it('days_to_zero = balance / avg_daily_burn, 9999 when burn is zero', () => {
    expect(computeBehaviour({ ...base, chequing_balance_cents: 100_000, avg_daily_burn_cents: 5000 }).days_to_zero).toBe(20);
    expect(computeBehaviour({ ...base, chequing_balance_cents: 100_000 }).days_to_zero).toBe(9999);
  });

  it('subscription_creep_pct_bps is delta vs 3mo avg', () => {
    const s = computeBehaviour({ ...base, subs_this_month_cents: 12_000, subs_3mo_avg_cents: 10_000 });
    expect(s.subscription_creep_pct_bps).toBe(2000);
  });

  it('indulgence_peak_day picks the weekday with highest indulgence spend', () => {
    const s = computeBehaviour({ ...base, indulgence_by_weekday_cents: [0, 0, 0, 0, 500, 0, 9000] });
    expect(s.indulgence_peak_day).toBe(6);
  });

  it('review_queue_lag_days is days between oldest review and as_of', () => {
    const s = computeBehaviour({ ...base, as_of: '2026-04-24', oldest_unresolved_review_created_at: '2026-04-20' });
    expect(s.review_queue_lag_days).toBe(4);
  });

  it('savings_increased_bool is 1 when 7d exceeds prior 7d', () => {
    expect(computeBehaviour({ ...base, savings_7d_cents: 200, savings_prior_7d_cents: 100 }).savings_increased_bool).toBe(1);
    expect(computeBehaviour({ ...base, savings_7d_cents: 100, savings_prior_7d_cents: 100 }).savings_increased_bool).toBe(0);
  });
});
