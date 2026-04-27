import { Hono } from 'hono';
import type { Env } from '../env.js';
import { computeTrialBalance } from '../lib/gl.js';
import { runGlBackfill } from '../lib/glBackfill.js';
import { runArApBackfill } from '../lib/glCounterparty.js';

export const glRoutes = new Hono<{ Bindings: Env }>();

// GET /api/gl/accounts — chart of accounts. Includes archived if ?include_archived=1.
glRoutes.get('/accounts', async (c) => {
  const includeArchived = c.req.query('include_archived') === '1';
  const sql = includeArchived
    ? `SELECT id, path, name, type, parent_id, archived_at, metadata_json, created_at FROM gl_accounts ORDER BY path`
    : `SELECT id, path, name, type, parent_id, archived_at, metadata_json, created_at FROM gl_accounts WHERE archived_at IS NULL ORDER BY path`;
  const rows = await c.env.DB.prepare(sql).all();
  return c.json({ accounts: rows.results ?? [] });
});

// GET /api/gl/trial-balance?as_of=YYYY-MM-DD
// Returns per-account debit/credit/balance plus totals. Totals must equal.
glRoutes.get('/trial-balance', async (c) => {
  const asOfRaw = c.req.query('as_of');
  const asOf = typeof asOfRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw) ? asOfRaw : null;
  const sql = asOf
    ? `SELECT a.id AS account_id, a.path, a.type,
              COALESCE(SUM(l.debit_cents), 0) AS debit_cents,
              COALESCE(SUM(l.credit_cents), 0) AS credit_cents
       FROM gl_accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id
       LEFT JOIN journal_entries e ON e.id = l.journal_entry_id
       WHERE (e.posted_at IS NULL OR e.posted_at <= ?)
       GROUP BY a.id, a.path, a.type
       ORDER BY a.path`
    : `SELECT a.id AS account_id, a.path, a.type,
              COALESCE(SUM(l.debit_cents), 0) AS debit_cents,
              COALESCE(SUM(l.credit_cents), 0) AS credit_cents
       FROM gl_accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id
       GROUP BY a.id, a.path, a.type
       ORDER BY a.path`;
  const stmt = asOf ? c.env.DB.prepare(sql).bind(`${asOf}T23:59:59.999Z`) : c.env.DB.prepare(sql);
  const rows = await stmt.all<{
    account_id: string;
    path: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    debit_cents: number;
    credit_cents: number;
  }>();
  const tb = computeTrialBalance(rows.results ?? []);
  return c.json({ as_of: asOf, ...tb });
});

// GET /api/gl/journal?account_id=&limit= — recent journal entries (with their
// lines) touching a given account. For audit/debug.
glRoutes.get('/journal', async (c) => {
  const accountId = c.req.query('account_id');
  const limitRaw = Number(c.req.query('limit') ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 50;

  const entries = accountId
    ? await c.env.DB.prepare(
        `SELECT DISTINCT e.id, e.posted_at, e.source_type, e.source_id, e.memo, e.created_at, e.locked_at
         FROM journal_entries e
         JOIN journal_lines l ON l.journal_entry_id = e.id
         WHERE l.account_id = ?
         ORDER BY e.posted_at DESC, e.id DESC
         LIMIT ?`,
      )
        .bind(accountId, limit)
        .all()
    : await c.env.DB.prepare(
        `SELECT id, posted_at, source_type, source_id, memo, created_at, locked_at
         FROM journal_entries
         ORDER BY posted_at DESC, id DESC
         LIMIT ?`,
      )
        .bind(limit)
        .all();

  const ids = (entries.results ?? []).map((r: any) => r.id);
  const linesByEntry = new Map<string, unknown[]>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const lineRows = await c.env.DB.prepare(
      `SELECT l.id, l.journal_entry_id, l.account_id, a.path AS account_path, l.debit_cents, l.credit_cents
       FROM journal_lines l
       JOIN gl_accounts a ON a.id = l.account_id
       WHERE l.journal_entry_id IN (${placeholders})
       ORDER BY l.journal_entry_id, l.id`,
    )
      .bind(...ids)
      .all<{
        id: string;
        journal_entry_id: string;
        account_id: string;
        account_path: string;
        debit_cents: number;
        credit_cents: number;
      }>();
    for (const l of lineRows.results ?? []) {
      const arr = linesByEntry.get(l.journal_entry_id) ?? [];
      arr.push(l);
      linesByEntry.set(l.journal_entry_id, arr);
    }
  }
  const out = (entries.results ?? []).map((e: any) => ({
    ...e,
    lines: linesByEntry.get(e.id) ?? [],
  }));
  return c.json({ entries: out });
});

// POST /api/admin/gl-backfill — one-shot. Idempotent. Re-runnable.
// Mounted under /api/admin (auth-gated) in index.ts.
export const glAdminRoutes = new Hono<{ Bindings: Env }>();
glAdminRoutes.post('/gl-backfill', async (c) => {
  const out = await runGlBackfill(c.env);
  return c.json(out);
});

// POST /api/admin/arap-backfill — idempotent. Posts JEs for splits + split_events.
// Replaces transaction-source JEs for any split_event linked to a real txn.
glAdminRoutes.post('/arap-backfill', async (c) => {
  const out = await runArApBackfill(c.env);
  return c.json(out);
});
