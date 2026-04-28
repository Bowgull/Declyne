import { Hono } from 'hono';
import type { Env } from '../env.js';

export const transactionsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/transactions/search?q=&from=&to=&account_id=&category_group=&limit=
// Searches description_raw + description_normalized + joined merchant display_name.
// Filters narrow by date range, account, and category group.
transactionsRoutes.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const from = c.req.query('from');
  const to = c.req.query('to');
  const accountId = c.req.query('account_id');
  const categoryGroup = c.req.query('category_group');
  const limitRaw = Number(c.req.query('limit') ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 50;

  const where: string[] = [];
  const binds: unknown[] = [];

  if (q.length > 0) {
    const like = `%${q.toLowerCase()}%`;
    where.push(
      `(LOWER(t.description_raw) LIKE ? OR LOWER(COALESCE(m.display_name, '')) LIKE ?)`,
    );
    binds.push(like, like);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push(`date(t.posted_at) >= ?`);
    binds.push(from);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push(`date(t.posted_at) <= ?`);
    binds.push(to);
  }
  if (accountId) {
    where.push(`t.account_id = ?`);
    binds.push(accountId);
  }
  if (categoryGroup) {
    where.push(`c."group" = ?`);
    binds.push(categoryGroup);
  }

  const sql = `SELECT t.id, t.posted_at, t.description_raw, t.amount_cents,
                      t.account_id, a.name AS account_name,
                      t.category_id, c.name AS category_name, c."group" AS category_group,
                      m.display_name AS merchant_name
               FROM transactions t
               LEFT JOIN accounts a ON a.id = t.account_id
               LEFT JOIN categories c ON c.id = t.category_id
               LEFT JOIN merchants m ON m.id = t.merchant_id
               ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY t.posted_at DESC, t.id DESC
               LIMIT ?`;
  binds.push(limit);

  const rows = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ rows: rows.results ?? [], limit });
});
