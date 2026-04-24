import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { computeAndStoreStreaks } from '../lib/streaks.js';

export const creditRoutes = new Hono<{ Bindings: Env }>();

type CreditRow = {
  id: string;
  as_of: string;
  score: number;
  utilization_bps: number;
  on_time_streak_days: number;
  source: 'manual' | 'equifax';
};

export type CreditInput = {
  as_of: string;
  score: number;
  utilization_bps: number;
  on_time_streak_days: number;
  source: 'manual' | 'equifax';
};

export function parseCreditInput(raw: unknown): CreditInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;

  const as_of = typeof b.as_of === 'string' ? b.as_of.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(as_of)) return { error: 'as_of must be YYYY-MM-DD' };

  const score = Number(b.score);
  if (!Number.isFinite(score) || score < 300 || score > 900) {
    return { error: 'score must be 300..900' };
  }

  const utilization_bps = Number(b.utilization_bps);
  if (!Number.isFinite(utilization_bps) || utilization_bps < 0 || utilization_bps > 10000) {
    return { error: 'utilization_bps must be 0..10000' };
  }

  const on_time_streak_days = Number(b.on_time_streak_days);
  if (!Number.isFinite(on_time_streak_days) || on_time_streak_days < 0 || on_time_streak_days > 100000) {
    return { error: 'on_time_streak_days must be 0..100000' };
  }

  const source = b.source === 'equifax' ? 'equifax' : 'manual';

  return {
    as_of,
    score: Math.round(score),
    utilization_bps: Math.round(utilization_bps),
    on_time_streak_days: Math.round(on_time_streak_days),
    source,
  };
}

creditRoutes.get('/snapshots', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '50') || 50, 500);
  const { results } = await c.env.DB.prepare(
    `SELECT id, as_of, score, utilization_bps, on_time_streak_days, source
     FROM credit_snapshots
     ORDER BY as_of DESC, id DESC
     LIMIT ?`,
  )
    .bind(limit)
    .all<CreditRow>();
  return c.json({ snapshots: results });
});

creditRoutes.post('/snapshots', async (c) => {
  const parsed = parseCreditInput(await c.req.json().catch(() => null));
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const id = newId('credit');
  await c.env.DB.prepare(
    `INSERT INTO credit_snapshots (id, as_of, score, utilization_bps, on_time_streak_days, source)
     VALUES (?,?,?,?,?,?)`,
  )
    .bind(id, parsed.as_of, parsed.score, parsed.utilization_bps, parsed.on_time_streak_days, parsed.source)
    .run();

  await writeEditLog(c.env, [
    {
      entity_type: 'credit_snapshot',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(parsed),
      actor: 'user',
      reason: 'credit_snapshot_create',
    },
  ]);

  const streaks = await computeAndStoreStreaks(c.env);
  return c.json({
    id,
    streaks: {
      utilization_under_30_streak_statements: streaks.utilization_under_30_streak_statements,
      on_time_streak_days: streaks.on_time_streak_days,
    },
  });
});

creditRoutes.delete('/snapshots/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM credit_snapshots WHERE id = ?`)
    .bind(id)
    .first<CreditRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  await c.env.DB.prepare(`DELETE FROM credit_snapshots WHERE id = ?`).bind(id).run();
  await writeEditLog(c.env, [
    {
      entity_type: 'credit_snapshot',
      entity_id: id,
      field: 'delete',
      old_value: JSON.stringify(existing),
      new_value: null,
      actor: 'user',
      reason: 'credit_snapshot_delete',
    },
  ]);

  const streaks = await computeAndStoreStreaks(c.env);
  return c.json({
    ok: true,
    streaks: {
      utilization_under_30_streak_statements: streaks.utilization_under_30_streak_statements,
      on_time_streak_days: streaks.on_time_streak_days,
    },
  });
});
