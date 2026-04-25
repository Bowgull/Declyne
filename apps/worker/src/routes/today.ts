import { Hono } from 'hono';
import type { Env } from '../env.js';

export const todayRoutes = new Hono<{ Bindings: Env }>();

// Consolidated extras for the Today screen that aren't covered by existing
// routes: receipt counter (days since earliest activity) and the most recent
// indulgence transaction.
todayRoutes.get('/', async (c) => {
  const earliest = await c.env.DB.prepare(
    `SELECT MIN(posted_at) as d FROM transactions`,
  ).first<{ d: string | null }>();

  let rcpt_days = 0;
  if (earliest?.d) {
    const ms = Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(earliest.d.slice(0, 10));
    rcpt_days = Math.max(0, Math.floor(ms / 86_400_000));
  }

  const lastIndulgence = await c.env.DB.prepare(
    `SELECT t.posted_at as posted_at, t.amount_cents as amount_cents, t.description_raw as description_raw
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'indulgence' AND t.amount_cents < 0
     ORDER BY t.posted_at DESC
     LIMIT 1`,
  ).first<{ posted_at: string; amount_cents: number; description_raw: string }>();

  let last_indulgence: {
    posted_at: string;
    amount_cents: number;
    description_raw: string;
    days_ago: number;
  } | null = null;
  if (lastIndulgence) {
    const ms = Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(lastIndulgence.posted_at.slice(0, 10));
    last_indulgence = {
      ...lastIndulgence,
      amount_cents: Math.abs(lastIndulgence.amount_cents),
      days_ago: Math.max(0, Math.floor(ms / 86_400_000)),
    };
  }

  return c.json({ rcpt_days, last_indulgence });
});
