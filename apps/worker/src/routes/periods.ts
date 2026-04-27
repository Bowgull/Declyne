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
