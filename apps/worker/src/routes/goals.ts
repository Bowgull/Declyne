import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { projectGoalCompletion } from '../lib/forecast.js';

export const goalsRoutes = new Hono<{ Bindings: Env }>();

type GoalRow = {
  id: string;
  name: string;
  target_cents: number;
  target_date: string;
  linked_account_id: string | null;
  progress_cents: number;
  archived: number;
};

export type GoalInput = {
  name: string;
  target_cents: number;
  target_date: string;
  linked_account_id: string | null;
  progress_cents: number;
};

export type GoalPatch = Partial<GoalInput> & { archived?: 0 | 1 };

function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseGoalInput(raw: unknown): GoalInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { error: 'name required' };
  if (name.length > 120) return { error: 'name too long' };

  const target_cents = Number(b.target_cents);
  if (!Number.isFinite(target_cents) || target_cents <= 0 || target_cents > 1_000_000_00) {
    return { error: 'target_cents must be 1..100000000' };
  }

  if (!isYmd(b.target_date)) return { error: 'target_date must be YYYY-MM-DD' };

  let linked_account_id: string | null = null;
  if (typeof b.linked_account_id === 'string' && b.linked_account_id.trim()) {
    linked_account_id = b.linked_account_id.trim();
  }

  const progressRaw = b.progress_cents === undefined || b.progress_cents === null ? 0 : Number(b.progress_cents);
  if (!Number.isFinite(progressRaw) || progressRaw < 0 || progressRaw > 1_000_000_00) {
    return { error: 'progress_cents must be 0..100000000' };
  }

  return {
    name: name.slice(0, 120),
    target_cents: Math.round(target_cents),
    target_date: b.target_date as string,
    linked_account_id,
    progress_cents: Math.round(progressRaw),
  };
}

export function parseGoalPatch(raw: unknown): GoalPatch | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;
  const out: GoalPatch = {};

  if ('name' in b) {
    if (typeof b.name !== 'string') return { error: 'name must be string' };
    const v = b.name.trim();
    if (!v) return { error: 'name required' };
    if (v.length > 120) return { error: 'name too long' };
    out.name = v;
  }
  if ('target_cents' in b) {
    const n = Number(b.target_cents);
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_00) return { error: 'target_cents must be 1..100000000' };
    out.target_cents = Math.round(n);
  }
  if ('target_date' in b) {
    if (!isYmd(b.target_date)) return { error: 'target_date must be YYYY-MM-DD' };
    out.target_date = b.target_date as string;
  }
  if ('linked_account_id' in b) {
    const v = b.linked_account_id;
    if (v === null || v === '') out.linked_account_id = null;
    else if (typeof v === 'string') out.linked_account_id = v.trim() || null;
    else return { error: 'linked_account_id must be string or null' };
  }
  if ('progress_cents' in b) {
    const n = Number(b.progress_cents);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_00) return { error: 'progress_cents must be 0..100000000' };
    out.progress_cents = Math.round(n);
  }
  if ('archived' in b) {
    out.archived = b.archived === true || b.archived === 1 ? 1 : 0;
  }
  return out;
}

goalsRoutes.get('/', async (c) => {
  const includeArchived = c.req.query('include_archived') === '1';
  const where = includeArchived ? '' : 'WHERE archived = 0';
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, target_cents, target_date, linked_account_id, progress_cents, archived
     FROM goals ${where}
     ORDER BY archived ASC, target_date ASC, name ASC`,
  ).all<GoalRow>();

  // Projection: derive next_payday from latest pay_period (bi-weekly cadence).
  // Per-paycheque allocation = remaining / periods-until-target-date, mirroring
  // the loadActiveGoals heuristic in periodIntelligence.
  const period = await c.env.DB.prepare(
    `SELECT end_date FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ end_date: string }>();
  const next_payday = period
    ? new Date(Date.parse(period.end_date) + 86_400_000).toISOString().slice(0, 10)
    : null;
  const todayMs = Date.now();

  const goals = (results ?? []).map((g) => {
    const remaining = Math.max(0, g.target_cents - g.progress_cents);
    const daysRem = Math.max(14, Math.round((Date.parse(g.target_date) - todayMs) / 86_400_000));
    const periodsRem = Math.max(1, Math.round(daysRem / 14));
    const per_paycheque_cents = Math.ceil(remaining / periodsRem);
    const projected_complete_date = projectGoalCompletion({
      remaining_cents: remaining,
      per_paycheque_cents,
      next_payday,
      cadence_days: 14,
    });
    return {
      ...g,
      per_paycheque_cents,
      projected_complete_date,
    };
  });

  return c.json({ goals });
});

goalsRoutes.post('/', async (c) => {
  const parsed = parseGoalInput(await c.req.json().catch(() => null));
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const id = newId('goal');
  await c.env.DB.prepare(
    `INSERT INTO goals (id, name, target_cents, target_date, linked_account_id, progress_cents, archived)
     VALUES (?,?,?,?,?,?,0)`,
  )
    .bind(id, parsed.name, parsed.target_cents, parsed.target_date, parsed.linked_account_id, parsed.progress_cents)
    .run();

  await writeEditLog(c.env, [
    {
      entity_type: 'goal',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(parsed),
      actor: 'user',
      reason: 'goal_create',
    },
  ]);

  return c.json({ id });
});

goalsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = parseGoalPatch(await c.req.json().catch(() => null));
  if ('error' in patch) return c.json({ error: patch.error }, 400);

  const existing = await c.env.DB.prepare(
    `SELECT id, name, target_cents, target_date, linked_account_id, progress_cents, archived FROM goals WHERE id = ?`,
  )
    .bind(id)
    .first<GoalRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const logs: Parameters<typeof writeEditLog>[1] = [];

  const fields: Array<keyof GoalPatch> = [
    'name',
    'target_cents',
    'target_date',
    'linked_account_id',
    'progress_cents',
    'archived',
  ];
  for (const f of fields) {
    if (patch[f] === undefined) continue;
    const oldVal = (existing as Record<string, unknown>)[f];
    const newVal = patch[f] as unknown;
    if (oldVal === newVal) continue;
    updates.push(`${f} = ?`);
    values.push(newVal);
    logs.push({
      entity_type: 'goal',
      entity_id: id,
      field: f,
      old_value: oldVal === null ? null : String(oldVal),
      new_value: newVal === null ? null : String(newVal),
      actor: 'user',
      reason: 'goal_update',
    });
  }

  if (!updates.length) return c.json({ ok: true, changed: 0 });

  await c.env.DB.prepare(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  await writeEditLog(c.env, logs);

  return c.json({ ok: true, changed: updates.length });
});
