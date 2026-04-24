import { Hono } from 'hono';
import type { Env } from '../env.js';
import { nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const reviewRoutes = new Hono<{ Bindings: Env }>();

reviewRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT rq.*, t.description_raw, t.amount_cents, t.posted_at
     FROM review_queue rq JOIN transactions t ON t.id = rq.transaction_id
     WHERE rq.resolved_at IS NULL ORDER BY t.posted_at DESC LIMIT 200`,
  ).all();
  return c.json({ items: results });
});

reviewRoutes.post('/:id/resolve', async (c) => {
  const id = c.req.param('id');
  const b = (await c.req.json()) as { category_id?: string; merchant_id?: string };
  const item = await c.env.DB.prepare(`SELECT transaction_id FROM review_queue WHERE id = ?`).bind(id).first<{ transaction_id: string }>();
  if (!item) return c.json({ error: 'not found' }, 404);

  if (b.category_id) {
    await c.env.DB.prepare(`UPDATE transactions SET category_id = ? WHERE id = ?`).bind(b.category_id, item.transaction_id).run();
  }
  if (b.merchant_id) {
    await c.env.DB.prepare(`UPDATE transactions SET merchant_id = ? WHERE id = ?`).bind(b.merchant_id, item.transaction_id).run();
    if (b.category_id) {
      await c.env.DB.prepare(`UPDATE merchants SET category_default_id = ?, verified = 1 WHERE id = ?`).bind(b.category_id, b.merchant_id).run();
    }
  }
  await c.env.DB.prepare(`UPDATE review_queue SET resolved_at = ? WHERE id = ?`).bind(nowIso(), id).run();

  await writeEditLog(c.env, [
    { entity_type: 'transaction', entity_id: item.transaction_id, field: 'review_resolve', old_value: null, new_value: JSON.stringify(b), actor: 'user', reason: 'manual_recat' },
  ]);

  return c.json({ ok: true });
});
