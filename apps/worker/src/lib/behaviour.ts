// Deterministic nightly behaviour signals. GPT never does this math.

export interface BehaviourInputs {
  as_of: string;
  vice_spend_cents_30d: number;
  lifestyle_spend_cents_30d: number;
  chequing_balance_cents: number;
  avg_daily_burn_cents: number;
  cc_payoff_streak: number;
  subs_this_month_cents: number;
  subs_3mo_avg_cents: number;
  savings_7d_cents: number;
  savings_prior_7d_cents: number;
  vice_by_weekday_cents: number[]; // length 7, Sunday = 0
  oldest_unresolved_review_created_at: string | null;
  reconciliation_streak: number;
}

export interface BehaviourSnapshot {
  as_of: string;
  vice_ratio_bps: number;
  days_to_zero: number;
  cc_payoff_streak: number;
  subscription_creep_pct_bps: number;
  savings_increased_bool: number;
  vice_peak_day: number;
  review_queue_lag_days: number;
  reconciliation_streak: number;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T00:00:00Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

export function computeBehaviour(i: BehaviourInputs): BehaviourSnapshot {
  const viceDenom = i.vice_spend_cents_30d + i.lifestyle_spend_cents_30d;
  const vice_ratio_bps = viceDenom === 0 ? 0 : Math.round((i.vice_spend_cents_30d / viceDenom) * 10_000);

  const days_to_zero =
    i.avg_daily_burn_cents <= 0 ? 9999 : Math.max(0, Math.floor(i.chequing_balance_cents / i.avg_daily_burn_cents));

  const creep =
    i.subs_3mo_avg_cents <= 0
      ? 0
      : Math.round(((i.subs_this_month_cents - i.subs_3mo_avg_cents) / i.subs_3mo_avg_cents) * 10_000);

  const savings_increased_bool = i.savings_7d_cents > i.savings_prior_7d_cents ? 1 : 0;

  let peakIdx = 0;
  let peakVal = -1;
  for (let d = 0; d < i.vice_by_weekday_cents.length; d++) {
    const v = i.vice_by_weekday_cents[d] ?? 0;
    if (v > peakVal) {
      peakVal = v;
      peakIdx = d;
    }
  }

  const lag = i.oldest_unresolved_review_created_at ? daysBetween(i.oldest_unresolved_review_created_at, i.as_of) : 0;

  return {
    as_of: i.as_of,
    vice_ratio_bps,
    days_to_zero,
    cc_payoff_streak: i.cc_payoff_streak,
    subscription_creep_pct_bps: creep,
    savings_increased_bool,
    vice_peak_day: peakIdx,
    review_queue_lag_days: lag,
    reconciliation_streak: i.reconciliation_streak,
  };
}
