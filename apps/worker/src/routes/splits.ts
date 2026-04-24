import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const splitsRoutes = new Hono<{ Bindings: Env }>();

splitsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM splits WHERE closed_at IS NULL ORDER BY created_at DESC`,
  ).all();
  return c.json({ splits: results });
});

splitsRoutes.post('/', async (c) => {
  const b = (await c.req.json()) as {
    counterparty: string;
    direction: 'josh_owes' | 'owes_josh';
    amount_cents: number;
    reason: string;
  };
  const id = newId('split');
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO splits (id, counterparty, direction, original_cents, remaining_cents, reason, created_at, closed_at)
     VALUES (?,?,?,?,?,?,?,NULL)`,
  )
    .bind(id, b.counterparty, b.direction, b.amount_cents, b.amount_cents, b.reason, now)
    .run();
  await writeEditLog(c.env, [
    { entity_type: 'split', entity_id: id, field: 'create', old_value: null, new_value: JSON.stringify(b), actor: 'user', reason: 'split_create' },
  ]);
  return c.json({ id });
});

splitsRoutes.post('/:id/event', async (c) => {
  const id = c.req.param('id');
  const b = (await c.req.json()) as { delta_cents: number; transaction_id?: string; note?: string };
  const split = await c.env.DB.prepare(`SELECT remaining_cents FROM splits WHERE id = ?`).bind(id).first<{ remaining_cents: number }>();
  if (!split) return c.json({ error: 'not found' }, 404);
  const newRemaining = split.remaining_cents + b.delta_cents;
  const eventId = newId('se');
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO split_events (id, split_id, delta_cents, transaction_id, note, created_at) VALUES (?,?,?,?,?,?)`,
    ).bind(eventId, id, b.delta_cents, b.transaction_id ?? null, b.note ?? null, now),
    c.env.DB.prepare(`UPDATE splits SET remaining_cents = ?, closed_at = CASE WHEN ? <= 0 THEN ? ELSE NULL END WHERE id = ?`)
      .bind(Math.max(newRemaining, 0), newRemaining, now, id),
  ]);
  await writeEditLog(c.env, [
    {
      entity_type: 'split',
      entity_id: id,
      field: 'remaining_cents',
      old_value: String(split.remaining_cents),
      new_value: String(Math.max(newRemaining, 0)),
      actor: 'user',
      reason: 'split_event',
    },
  ]);
  return c.json({ remaining_cents: Math.max(newRemaining, 0), closed: newRemaining <= 0 });
});
