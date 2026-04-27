import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { disableLinksForSplit } from './paymentLinks.js';

export const splitsRoutes = new Hono<{ Bindings: Env }>();

splitsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, cp.name AS counterparty_name
     FROM splits s
     LEFT JOIN counterparties cp ON cp.id = s.counterparty_id
     WHERE s.closed_at IS NULL
     ORDER BY s.created_at DESC`,
  ).all();
  return c.json({ splits: results });
});

export type SplitInput = {
  counterparty_id: string | undefined;
  counterparty_name: string | undefined;
  direction: 'i_owe' | 'they_owe';
  amount_cents: number;
  reason: string;
};

export function parseSplitInput(b: unknown): SplitInput | { error: string } {
  if (!b || typeof b !== 'object') return { error: 'invalid body' };
  const o = b as Record<string, unknown>;
  const direction = o.direction;
  if (direction !== 'i_owe' && direction !== 'they_owe') return { error: 'direction invalid' };
  const amount = Number(o.amount_cents);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return { error: 'amount invalid' };
  const reason = typeof o.reason === 'string' ? o.reason.trim() : '';
  if (!reason) return { error: 'reason required' };
  if (reason.length > 200) return { error: 'reason too long' };
  const counterparty_id = typeof o.counterparty_id === 'string' && o.counterparty_id ? o.counterparty_id : undefined;
  const counterparty_name = typeof o.counterparty_name === 'string' ? o.counterparty_name.trim() : '';
  if (!counterparty_id && !counterparty_name) return { error: 'counterparty_id or counterparty_name required' };
  return {
    counterparty_id,
    counterparty_name: counterparty_name || undefined,
    direction,
    amount_cents: Math.round(amount),
    reason,
  };
}

splitsRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = parseSplitInput(body);
  if ('error' in parsed) return c.json(parsed, 400);

  let counterpartyId = parsed.counterparty_id ?? null;
  let counterpartyName = '';

  if (counterpartyId) {
    const cp = await c.env.DB.prepare(`SELECT name FROM counterparties WHERE id = ?`)
      .bind(counterpartyId)
      .first<{ name: string }>();
    if (!cp) return c.json({ error: 'counterparty not found' }, 404);
    counterpartyName = cp.name;
  } else {
    const name = parsed.counterparty_name!;
    const existing = await c.env.DB.prepare(`SELECT id FROM counterparties WHERE name = ? AND archived_at IS NULL`)
      .bind(name)
      .first<{ id: string }>();
    if (existing) {
      counterpartyId = existing.id;
      counterpartyName = name;
    } else {
      counterpartyId = newId('cp');
      counterpartyName = name;
      await c.env.DB.prepare(
        `INSERT INTO counterparties (id, name, default_settlement_method, archived_at, created_at)
         VALUES (?,?,?,NULL,?)`,
      )
        .bind(counterpartyId, name, 'etransfer', nowIso())
        .run();
      await writeEditLog(c.env, [
        {
          entity_type: 'counterparty',
          entity_id: counterpartyId,
          field: 'create',
          old_value: null,
          new_value: JSON.stringify({ name }),
          actor: 'user',
          reason: 'counterparty_create_inline',
        },
      ]);
    }
  }

  const id = newId('split');
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO splits (id, counterparty_id, direction, original_cents, remaining_cents, reason, created_at, closed_at)
     VALUES (?,?,?,?,?,?,?,NULL)`,
  )
    .bind(id, counterpartyId, parsed.direction, parsed.amount_cents, parsed.amount_cents, parsed.reason, now)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'split',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify({ ...parsed, counterparty_id: counterpartyId, counterparty_name: counterpartyName }),
      actor: 'user',
      reason: 'split_create',
    },
  ]);
  return c.json({ id, counterparty_id: counterpartyId });
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
  if (newRemaining <= 0) {
    await disableLinksForSplit(c.env, id, 'split_settled').catch(() => 0);
  }
  return c.json({ remaining_cents: Math.max(newRemaining, 0), closed: newRemaining <= 0 });
});
