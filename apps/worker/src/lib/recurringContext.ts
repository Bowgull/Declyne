// Per-request recurring detector cache. The recurring SQL fans out to four+
// callers on a typical Today render (today.ts, periodIntelligence,
// forecast, budget/subscriptions, notifications, master queue). Same SQL,
// same data, four runs, four chances for window math to drift.
//
// loadRecurringContext runs the heavy SQL once (180d window covers both the
// 90d bill detector and the 180d subscription detector), caches the
// subscriptions output (horizon-free), and memoises the bill detector output
// per horizonDays. Routes pass the context down instead of re-querying.

import type { Env } from '../env.js';
import {
  detectRecurring,
  detectSubscriptions,
  type RecurringPrediction,
  type RecurringTxn,
  type SubscriptionPrediction,
} from './recurring.js';

const MS_PER_DAY = 86_400_000;

export type RecurringContext = {
  today: string;
  // Negative-amount, merchant-tagged charges from the past 90 days. Matches
  // what detectRecurring filters internally; we keep both signs out at load
  // time so the array is ready to feed the detector or to look up groups by
  // merchant_id.
  txns_90d: RecurringTxn[];
  // Same shape, 180d window. detectSubscriptions filters internally; we keep
  // negatives only because no caller wants positives here.
  txns_180d: RecurringTxn[];
  // Eager — subscriptions detector takes no horizon arg.
  subscriptions: SubscriptionPrediction[];
  // Memoised per horizonDays. Callers that share a horizon hit the cache.
  getRecurring(horizonDays: number): RecurringPrediction[];
};

function shiftIso(today: string, deltaDays: number): string {
  const t = new Date(Date.parse(today) + deltaDays * MS_PER_DAY);
  return t.toISOString().slice(0, 10);
}

export async function loadRecurringContext(
  env: Env,
  today: string,
): Promise<RecurringContext> {
  const { results } = await env.DB.prepare(
    `SELECT t.posted_at as posted_at,
            t.amount_cents as amount_cents,
            t.merchant_id as merchant_id,
            m.display_name as merchant_name,
            c."group" as "group"
     FROM transactions t
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now', '-180 days')
       AND t.amount_cents < 0
       AND t.merchant_id IS NOT NULL`,
  ).all<RecurringTxn>();

  const txns_180d = results ?? [];
  const cutoff90 = shiftIso(today, -90);
  const txns_90d = txns_180d.filter((t) => t.posted_at >= cutoff90);

  return buildRecurringContext({ today, txns_90d, txns_180d });
}

// Pure assembly so tests can hand in fixture txns without hitting D1.
export function buildRecurringContext(input: {
  today: string;
  txns_90d: RecurringTxn[];
  txns_180d: RecurringTxn[];
}): RecurringContext {
  const subscriptions = detectSubscriptions(input.txns_180d);
  const cache = new Map<number, RecurringPrediction[]>();
  return {
    today: input.today,
    txns_90d: input.txns_90d,
    txns_180d: input.txns_180d,
    subscriptions,
    getRecurring(horizonDays) {
      const hit = cache.get(horizonDays);
      if (hit) return hit;
      const out = detectRecurring(input.txns_90d, input.today, horizonDays);
      cache.set(horizonDays, out);
      return out;
    },
  };
}
