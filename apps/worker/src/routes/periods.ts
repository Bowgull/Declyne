import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { detectPeriods, type PaycheckCandidate } from '../lib/payperiods.js';

export const periodsRoutes = new Hono<{ Bindings: Env }>();

async function readSettings(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN ('paycheque_source_account_id','paycheque_pattern','paycheque_min_cents','paycheque_fallback_days')`,
  ).all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const r of results) map[r.key] = r.value;
  return {
    source_account_id: map.paycheque_source_account_id ?? null,
    pattern: map.paycheque_pattern ?? '',
    min_cents: Number(map.paycheque_min_cents ?? '100000'),
    fallback_days: Number(map.paycheque_fallback_days ?? '14'),
  };
}

periodsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, start_date, end_date, paycheque_cents, source_account_id
     FROM pay_periods ORDER BY start_date DESC LIMIT 50`,
  ).all();
  return c.json({ rows: results });
});

periodsRoutes.get('/current', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id, start_date, end_date, paycheque_cents, source_account_id
     FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first();
  return c.json({ period: row ?? null });
});

periodsRoutes.post('/detect', async (c) => {
  const cfg = await readSettings(c.env);
  if (!cfg.source_account_id) {
    return c.json({ error: 'paycheque_source_account_id not set' }, 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT posted_at, amount_cents, description_raw FROM transactions
     WHERE account_id = ? AND amount_cents >= ? ORDER BY posted_at ASC`,
  )
    .bind(cfg.source_account_id, cfg.min_cents)
    .all<PaycheckCandidate>();

  const detected = detectPeriods(results, {
    pattern: cfg.pattern,
    min_cents: cfg.min_cents,
    fallback_days: cfg.fallback_days,
  });

  const { results: existingRows } = await c.env.DB.prepare(
    `SELECT start_date FROM pay_periods WHERE source_account_id = ?`,
  )
    .bind(cfg.source_account_id)
    .all<{ start_date: string }>();
  const existing = new Set(existingRows.map((r) => r.start_date));

  const fresh = detected.filter((p) => !existing.has(p.start_date));
  if (fresh.length === 0) {
    return c.json({ detected: detected.length, inserted: 0 });
  }

  const inserts = fresh.map((p) => ({
    id: newId('pp'),
    ...p,
    source_account_id: cfg.source_account_id!,
  }));

  await c.env.DB.batch(
    inserts.map((r) =>
      c.env.DB.prepare(
        `INSERT INTO pay_periods (id, start_date, end_date, paycheque_cents, source_account_id)
         VALUES (?,?,?,?,?)`,
      ).bind(r.id, r.start_date, r.end_date, r.paycheque_cents, r.source_account_id),
    ),
  );

  await writeEditLog(
    c.env,
    inserts.map((r) => ({
      entity_type: 'pay_period',
      entity_id: r.id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(r),
      actor: 'rules' as const,
      reason: 'paycheque_detected',
    })),
  );

  return c.json({ detected: detected.length, inserted: inserts.length });
});

// GET /api/periods/history?limit=N — last N closed pay periods with GL-derived
// income, expense, and surplus. Used for the "Period history" section on Budget.
periodsRoutes.get('/history', async (c) => {
  const limit = Math.min(12, Math.max(1, Number(c.req.query('limit') ?? '8')));
  const { results: periods } = await c.env.DB.prepare(
    `SELECT id, start_date, end_date, paycheque_cents
     FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT ?`,
  ).bind(limit + 1).all<{ id: string; start_date: string; end_date: string; paycheque_cents: number }>();
  // Drop the current (open) period.
  const closed = periods.slice(1);
  if (closed.length === 0) return c.json({ rows: [] });

  const rows: Array<{
    id: string;
    start_date: string;
    end_date: string;
    income_cents: number;
    expense_cents: number;
    surplus_cents: number;
  }> = [];

  for (const p of closed) {
    const glRows = await c.env.DB.prepare(
      `SELECT a.type,
              COALESCE(SUM(l.debit_cents), 0) AS debit_cents,
              COALESCE(SUM(l.credit_cents), 0) AS credit_cents
       FROM gl_accounts a
       JOIN journal_lines l ON l.account_id = a.id
       JOIN journal_entries e ON e.id = l.journal_entry_id
       WHERE a.type IN ('income', 'expense')
         AND date(e.posted_at) >= ?
         AND date(e.posted_at) <= ?
       GROUP BY a.type`,
    ).bind(p.start_date, p.end_date).all<{ type: string; debit_cents: number; credit_cents: number }>();
    let income_cents = 0;
    let expense_cents = 0;
    for (const r of glRows.results) {
      if (r.type === 'income') income_cents += r.credit_cents - r.debit_cents;
      else expense_cents += r.debit_cents - r.credit_cents;
    }
    rows.push({ id: p.id, start_date: p.start_date, end_date: p.end_date, income_cents, expense_cents, surplus_cents: income_cents - expense_cents });
  }
  // Return oldest-first.
  return c.json({ rows: rows.reverse() });
});
