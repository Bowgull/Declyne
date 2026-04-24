import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const routingRoutes = new Hono<{ Bindings: Env }>();

interface PlanRow {
  id: string;
  pay_period_id: string;
  target_type: 'account' | 'category' | 'debt';
  target_id: string;
  amount_cents: number;
  executed_at: string | null;
}

routingRoutes.get('/', async (c) => {
  const period = await c.env.DB.prepare(
    `SELECT id, start_date, end_date, paycheque_cents FROM pay_periods ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; start_date: string; end_date: string; paycheque_cents: number }>();
  if (!period) return c.json({ period: null, rows: [] });

  const { results } = await c.env.DB.prepare(
    `SELECT rp.*,
            CASE rp.target_type
              WHEN 'debt' THEN (SELECT name FROM debts WHERE id = rp.target_id)
              WHEN 'account' THEN (SELECT name FROM accounts WHERE id = rp.target_id)
              WHEN 'category' THEN (SELECT name FROM categories WHERE id = rp.target_id)
            END as target_name
     FROM routing_plan rp
     WHERE pay_period_id = ?
     ORDER BY amount_cents DESC`,
  ).bind(period.id).all<PlanRow & { target_name: string | null }>();

  return c.json({ period, rows: results });
});

routingRoutes.post('/generate', async (c) => {
  const period = await c.env.DB.prepare(
    `SELECT id, paycheque_cents FROM pay_periods ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; paycheque_cents: number }>();
  if (!period) return c.json({ error: 'no pay period' }, 400);

  await c.env.DB.prepare(`DELETE FROM routing_plan WHERE pay_period_id = ? AND executed_at IS NULL`)
    .bind(period.id)
    .run();

  const { results: debts } = await c.env.DB.prepare(
    `SELECT id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value
     FROM debts WHERE archived = 0 ORDER BY interest_rate_bps DESC`,
  ).all<{
    id: string;
    name: string;
    principal_cents: number;
    interest_rate_bps: number;
    min_payment_type: 'fixed' | 'percent';
    min_payment_value: number;
  }>();

  let remaining = period.paycheque_cents;
  const inserts: PlanRow[] = [];

  for (const d of debts) {
    const minCents =
      d.min_payment_type === 'fixed'
        ? d.min_payment_value
        : Math.round((d.principal_cents * d.min_payment_value) / 10_000);
    const amount = Math.min(minCents, Math.max(remaining, 0));
    if (amount <= 0) continue;
    inserts.push({
      id: newId('rp'),
      pay_period_id: period.id,
      target_type: 'debt',
      target_id: d.id,
      amount_cents: amount,
      executed_at: null,
    });
    remaining -= amount;
  }

  const topDebt = debts[0];
  if (remaining > 0 && topDebt) {
    inserts.push({
      id: newId('rp'),
      pay_period_id: period.id,
      target_type: 'debt',
      target_id: topDebt.id,
      amount_cents: remaining,
      executed_at: null,
    });
  }

  if (inserts.length > 0) {
    await c.env.DB.batch(
      inserts.map((r) =>
        c.env.DB.prepare(
          `INSERT INTO routing_plan (id, pay_period_id, target_type, target_id, amount_cents, executed_at)
           VALUES (?,?,?,?,?,NULL)`,
        ).bind(r.id, r.pay_period_id, r.target_type, r.target_id, r.amount_cents),
      ),
    );
    await writeEditLog(
      c.env,
      inserts.map((r) => ({
        entity_type: 'routing_plan',
        entity_id: r.id,
        field: 'create',
        old_value: null,
        new_value: JSON.stringify(r),
        actor: 'rules' as const,
        reason: 'routing_generate',
      })),
    );
  }

  return c.json({ period_id: period.id, rows: inserts.length });
});

routingRoutes.post('/:id/execute', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT executed_at FROM routing_plan WHERE id = ?`).bind(id).first<{
    executed_at: string | null;
  }>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  if (existing.executed_at) return c.json({ ok: true });
  const now = nowIso();
  await c.env.DB.prepare(`UPDATE routing_plan SET executed_at = ? WHERE id = ?`).bind(now, id).run();
  await writeEditLog(c.env, [
    {
      entity_type: 'routing_plan',
      entity_id: id,
      field: 'executed_at',
      old_value: null,
      new_value: now,
      actor: 'user',
      reason: 'routing_execute',
    },
  ]);
  return c.json({ ok: true });
});
