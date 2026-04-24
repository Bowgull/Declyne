import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const debtsRoutes = new Hono<{ Bindings: Env }>();

debtsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM debts WHERE archived = 0 ORDER BY interest_rate_bps DESC`).all();
  return c.json({ debts: results });
});

debtsRoutes.post('/', async (c) => {
  const b = (await c.req.json()) as {
    name: string;
    principal_cents: number;
    interest_rate_bps: number;
    min_payment_type: 'fixed' | 'percent';
    min_payment_value: number;
    statement_date: number;
    payment_due_date: number;
    account_id_linked: string | null;
  };
  const id = newId('debt');
  await c.env.DB.prepare(
    `INSERT INTO debts (id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value,
                        statement_date, payment_due_date, account_id_linked, archived)
     VALUES (?,?,?,?,?,?,?,?,?,0)`,
  )
    .bind(
      id,
      b.name,
      b.principal_cents,
      b.interest_rate_bps,
      b.min_payment_type,
      b.min_payment_value,
      b.statement_date,
      b.payment_due_date,
      b.account_id_linked,
    )
    .run();
  await writeEditLog(c.env, [
    { entity_type: 'debt', entity_id: id, field: 'create', old_value: null, new_value: JSON.stringify(b), actor: 'user', reason: 'debt_create' },
  ]);
  return c.json({ id });
});

debtsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = (await c.req.json()) as Record<string, string | number>;
  const existing = await c.env.DB.prepare(`SELECT * FROM debts WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  const logs = [];
  for (const [field, value] of Object.entries(patch)) {
    if (existing[field] !== value) {
      logs.push({
        entity_type: 'debt',
        entity_id: id,
        field,
        old_value: existing[field] == null ? null : String(existing[field]),
        new_value: value == null ? null : String(value),
        actor: 'user' as const,
        reason: 'debt_update',
      });
    }
  }
  const keys = Object.keys(patch);
  if (keys.length > 0) {
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    await c.env.DB.prepare(`UPDATE debts SET ${setClause} WHERE id = ?`).bind(...Object.values(patch), id).run();
  }
  await writeEditLog(c.env, logs);
  return c.json({ ok: true });
});
