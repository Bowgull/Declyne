// GET /api/habits/context — composed habit data for math-side consumers
// (plan AI rationale, goal what-if projections, future Today recommendations).
// Same data the Habits map renders, but packaged for math instead of pixels.

import { Hono } from 'hono';
import type { Env } from '../env.js';
import {
  buildHabitContext,
  type HabitContext,
  type HabitMerchantInput,
  type HabitVerdict,
} from '../lib/habitContext.js';
import { loadRecurringContext, type RecurringContext } from '../lib/recurringContext.js';

export const habitsRoutes = new Hono<{ Bindings: Env }>();

// Shared loader so /api/habits/context and the plan AI rationale read from the
// same SQL. Pass an existing recurring context to avoid re-running the detector.
export async function loadHabitContext(env: Env, today: string, ctx?: RecurringContext): Promise<HabitContext> {
  const recurringPromise = ctx ? Promise.resolve(ctx) : loadRecurringContext(env, today);
  const [recurring, merchantsRes, verdictsRes] = await Promise.all([
    recurringPromise,
    env.DB.prepare(
      `SELECT m.id AS merchant_id,
              m.display_name,
              m.sub_category,
              m.sub_category_confirmed,
              c.\`group\` AS category_group,
              COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-90 days') AND t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS spend_90d_cents,
              COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-30 days') AND t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS spend_30d_cents
       FROM merchants m
       LEFT JOIN transactions t ON t.merchant_id = m.id
       LEFT JOIN categories c ON c.id = m.category_default_id
       WHERE c.\`group\` IN ('lifestyle', 'indulgence', 'essentials')
       GROUP BY m.id
       HAVING spend_90d_cents > 0`,
    ).all<HabitMerchantInput>(),
    env.DB.prepare(
      `SELECT merchant_id, verdict FROM subscription_verdicts`,
    ).all<HabitVerdict>(),
  ]);

  return buildHabitContext({
    merchants: merchantsRes.results ?? [],
    subscriptions: recurring.subscriptions,
    verdicts: verdictsRes.results ?? [],
  });
}

habitsRoutes.get('/context', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const context = await loadHabitContext(c.env, today);
  return c.json(context);
});
