// Phase engine. Deterministic. No demotion. No skipping.
// Computed daily or on material change. Every transition writes phase_log.

export type Phase = 1 | 2 | 3 | 4 | 5;

export interface PhaseInputs {
  current_phase: Phase;
  essentials_covered_streak_periods: number;
  cc_payoff_streak_periods: number;
  non_mortgage_debt_ratio_to_phase2_entry: number; // 1.0 = same, 0.8 = 20% down
  missed_min_payment_days_ago: number | null;
  utilization_under_30_streak_statements: number;
  on_time_streak_days: number;
  buffer_months_essentials: number;
  vice_ratio_trailing_30d: number;
}

export interface PhaseEvaluation {
  next_phase: Phase;
  rule_triggered: string | null;
  metrics: Record<string, number | null>;
}

export function evaluatePhase(i: PhaseInputs): PhaseEvaluation {
  const metrics = {
    essentials_streak: i.essentials_covered_streak_periods,
    cc_payoff_streak: i.cc_payoff_streak_periods,
    non_mortgage_ratio: i.non_mortgage_debt_ratio_to_phase2_entry,
    missed_min_days_ago: i.missed_min_payment_days_ago,
    util_streak: i.utilization_under_30_streak_statements,
    on_time_days: i.on_time_streak_days,
    buffer_months: i.buffer_months_essentials,
    vice_ratio: i.vice_ratio_trailing_30d,
  };

  // No demotion.
  const noop: PhaseEvaluation = { next_phase: i.current_phase, rule_triggered: null, metrics };

  if (i.current_phase === 1) {
    if (i.essentials_covered_streak_periods >= 2 && i.cc_payoff_streak_periods >= 1) {
      return { next_phase: 2, rule_triggered: 'p1_to_p2:essentials_2p_and_cc_streak_1p', metrics };
    }
    return noop;
  }

  if (i.current_phase === 2) {
    const paidDown20 = i.non_mortgage_debt_ratio_to_phase2_entry <= 0.8;
    const noMisses = i.missed_min_payment_days_ago === null || i.missed_min_payment_days_ago > 60;
    if (paidDown20 && noMisses) {
      return { next_phase: 3, rule_triggered: 'p2_to_p3:debt_down_20pct_no_miss_60d', metrics };
    }
    return noop;
  }

  if (i.current_phase === 3) {
    if (i.utilization_under_30_streak_statements >= 3 && i.on_time_streak_days >= 90) {
      return { next_phase: 4, rule_triggered: 'p3_to_p4:util_under_30_x3_and_ontime_90d', metrics };
    }
    return noop;
  }

  if (i.current_phase === 4) {
    if (i.buffer_months_essentials >= 3 && i.vice_ratio_trailing_30d < 0.15) {
      return { next_phase: 5, rule_triggered: 'p4_to_p5:buffer_3mo_and_vice_under_15', metrics };
    }
    return noop;
  }

  return noop;
}

export const PHASE_NAMES: Record<Phase, string> = {
  1: 'Stabilize',
  2: 'Clear Debt',
  3: 'Build Credit',
  4: 'Build Buffer',
  5: 'Grow',
};
