import { PHASE_NAMES, type Phase } from '@declyne/shared';

export interface CoachSnapshot {
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

export interface CoachPayload {
  as_of: string;
  phase: number;
  phase_name: string;
  snapshot: CoachSnapshot;
  instructions: string[];
}

export function buildCoachPayload(phase: Phase, snap: CoachSnapshot): CoachPayload {
  return {
    as_of: snap.as_of,
    phase,
    phase_name: PHASE_NAMES[phase],
    snapshot: snap,
    instructions: [
      'Summarize Josh\'s week in 2 to 4 short sentences.',
      'Cite at least one signal verbatim from the snapshot.',
      'No arithmetic. Do not invent numbers not in the snapshot.',
      'Dry, direct, slightly dark. No cheerleading. No shaming.',
      'No em dashes. Periods, colons, commas only.',
      'Under 80 words total.',
    ],
  };
}

export const COACH_SYSTEM_PROMPT = `You are Declyne's coach for one user, Josh.

Rules:
1. Never do arithmetic. Every number you cite must come from the input payload's snapshot.
2. Respect the current phase. Do not suggest phase-skipping behaviour.
3. Voice: dry, direct, slightly dark. Never cheerleading. Never shaming.
4. No em dashes. Periods, colons, commas only.
5. Under 80 words. Plain prose. No bullet points. No markdown.
6. Cite at least one specific signal name and its value from the snapshot.
7. If snapshot fields look flat or uninformative, say so plainly. Do not fabricate drama.`;
