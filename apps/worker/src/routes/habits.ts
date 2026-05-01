// GET /api/habits/context — composed habit data for math-side consumers
// (plan AI rationale, goal what-if projections, future Today recommendations).
// Same data the Habits map renders, but packaged for math instead of pixels.

import { Hono } from 'hono';
import type { Env } from '../env.js';
import { buildHabitContext, type HabitMerchantInput, type HabitVerdict } from '../lib/habitContext.js';
import { loadRecurringContext } from '../lib/recurringContext.js';

export const habitsRoutes = new Hono<{ Bindings: Env }>();

habitsRoutes.get('/context', async (c) => {
  const today = new Date().toISOString().slice(0, 10);

  const [ctx, merchantsRes, verdictsRes] = await Promise.all([
    loadRecurringContext(c.env, today),
    c.env.DB.prepare(
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
    c.env.DB.prepare(
      `SELECT merchant_id, verdict FROM subscription_verdicts`,
    ).all<HabitVerdict>(),
  ]);

  const context = buildHabitContext({
    merchants: merchantsRes.results ?? [],
    subscriptions: ctx.subscriptions,
    verdicts: verdictsRes.results ?? [],
  });

  return c.json(context);
});
