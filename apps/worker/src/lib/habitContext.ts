// Habit context — composed view of discretionary spend by sub-category plus
// the subscription bleed. The same data the Habits map renders, packaged for
// math (plan AI rationale, goal what-if projections) instead of pixels.
//
// Pure helper; no DB access. The route loads merchants + subscriptions +
// verdicts and hands them in.

import type { SubscriptionPrediction } from './recurring.js';

export type HabitVelocity = 'accelerating' | 'steady' | 'cooling';

export type HabitMerchantInput = {
  merchant_id: string;
  display_name: string;
  category_group: string | null;
  sub_category: string | null;
  sub_category_confirmed: number;
  spend_30d_cents: number;
  spend_90d_cents: number;
};

export type HabitVerdict = {
  merchant_id: string;
  verdict: 'keep' | 'kill' | 'not_a_sub';
};

export type HabitSubCategoryRow = {
  sub: string;
  spend_30d_cents: number;
  spend_90d_cents: number;
  monthly_burn_cents: number;
  velocity: HabitVelocity;
  merchant_count: number;
  top_merchants: Array<{ name: string; spend_90d_cents: number }>;
};

export type HabitKillCandidate = {
  merchant_id: string;
  name: string;
  monthly_cents: number;
  reason: string;
};

export type HabitContext = {
  by_sub_category: HabitSubCategoryRow[];
  subscription_bleed: {
    monthly_cents: number;
    annual_cents: number;
    kill_candidates: HabitKillCandidate[];
  };
  hot_categories: string[];
  cold_categories: string[];
};

// Mirror of the client's deriveSpendVelocity logic, bucketed.
//
//   ratio = spend30 / (spend90 / 3)   // current 30d vs trailing 30d average
//   ≥1.05 = accelerating, ≤0.95 = cooling, else steady.
//
// Spec-mapped: `accelerating` matches the Habits map's "▲" velocity badge,
// `cooling` matches "▼", `steady` covers everything in the ±5% band including
// the "no 90d history" edge case.
export function bucketVelocity(spend_30d: number, spend_90d: number): HabitVelocity {
  if (spend_90d <= 0) return 'steady';
  const steadyMonthly = spend_90d / 3;
  if (steadyMonthly <= 0) return 'steady';
  const ratio = spend_30d / steadyMonthly;
  if (ratio >= 1.05) return 'accelerating';
  if (ratio <= 0.95) return 'cooling';
  return 'steady';
}

// Subscriptions detector reports cadence in days; normalise to a per-month
// cents figure so the AI rationale + Goals what-if can sum across cadences.
export function monthlyFromCadence(amount_cents: number, cadence_days: number): number {
  if (cadence_days <= 0) return 0;
  return Math.round((amount_cents * 30) / cadence_days);
}

// $10/month threshold from CONNECT_PLAN session 6: "verdict=null + over $10/mo".
// Below that the bleed is small enough that flagging it as a kill candidate
// would just be noise.
const KILL_CANDIDATE_MONTHLY_CENTS = 1000;

export function buildHabitContext(input: {
  merchants: HabitMerchantInput[];
  subscriptions: SubscriptionPrediction[];
  verdicts: HabitVerdict[];
}): HabitContext {
  const verdictByMerchant = new Map<string, HabitVerdict['verdict']>();
  for (const v of input.verdicts) verdictByMerchant.set(v.merchant_id, v.verdict);

  // Group merchants by confirmed sub-category. Unconfirmed merchants are
  // intentionally dropped — habit context is the math layer, and we don't
  // want guesses driving plan rationale or goal projections.
  const bySub = new Map<string, HabitMerchantInput[]>();
  for (const m of input.merchants) {
    if (m.sub_category_confirmed !== 1) continue;
    if (!m.sub_category) continue;
    if (m.spend_90d_cents <= 0) continue;
    const arr = bySub.get(m.sub_category) ?? [];
    arr.push(m);
    bySub.set(m.sub_category, arr);
  }

  const by_sub_category: HabitSubCategoryRow[] = [];
  for (const [sub, list] of bySub) {
    const spend_30d_cents = list.reduce((s, m) => s + (m.spend_30d_cents ?? 0), 0);
    const spend_90d_cents = list.reduce((s, m) => s + m.spend_90d_cents, 0);
    const monthly_burn_cents = Math.round(spend_90d_cents / 3);
    const velocity = bucketVelocity(spend_30d_cents, spend_90d_cents);
    const top_merchants = [...list]
      .sort((a, b) => b.spend_90d_cents - a.spend_90d_cents)
      .slice(0, 3)
      .map((m) => ({ name: m.display_name, spend_90d_cents: m.spend_90d_cents }));
    by_sub_category.push({
      sub,
      spend_30d_cents,
      spend_90d_cents,
      monthly_burn_cents,
      velocity,
      merchant_count: list.length,
      top_merchants,
    });
  }
  by_sub_category.sort((a, b) => b.spend_90d_cents - a.spend_90d_cents);

  // Subscription bleed counts every detected subscription that hasn't been
  // marked not_a_sub. Killed subs still count toward bleed until the next
  // charge fails to land — same model the Subscriptions ledger uses.
  let monthly_cents = 0;
  const kill_candidates: HabitKillCandidate[] = [];
  for (const s of input.subscriptions) {
    const verdict = verdictByMerchant.get(s.merchant_id) ?? null;
    if (verdict === 'not_a_sub') continue;
    const m = monthlyFromCadence(s.amount_cents, s.cadence_days);
    monthly_cents += m;
    if (verdict === null && m >= KILL_CANDIDATE_MONTHLY_CENTS) {
      kill_candidates.push({
        merchant_id: s.merchant_id,
        name: s.merchant_name,
        monthly_cents: m,
        reason: 'undecided',
      });
    }
  }
  kill_candidates.sort((a, b) => b.monthly_cents - a.monthly_cents);
  const annual_cents = monthly_cents * 12;

  const hot_categories = by_sub_category
    .filter((r) => r.velocity === 'accelerating')
    .map((r) => r.sub);
  const cold_categories = by_sub_category
    .filter((r) => r.velocity === 'cooling')
    .map((r) => r.sub);

  return {
    by_sub_category,
    subscription_bleed: { monthly_cents, annual_cents, kill_candidates },
    hot_categories,
    cold_categories,
  };
}
