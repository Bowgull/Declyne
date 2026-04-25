import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { computeAndStoreStreaks } from '../lib/streaks.js';

export const ccStatementsRoutes = new Hono<{ Bindings: Env }>();

type CcStatementRow = {
  id: string;
  debt_id: string;
  statement_date: string;
  statement_balance_cents: number;
  min_payment_cents: number;
  due_date: string;
  paid_in_full: number;
  created_at: string;
};

export type CcStatementInput = {
  debt_id: string;
  statement_date: string;
  statement_balance_cents: number;
  min_payment_cents: number;
  due_date: string;
  paid_in_full: number;
};

export type CcStatementPatch = Partial<CcStatementInput>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validateDebtId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 80) return null;
  return s;
}

function validateBalance(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_00) return null;
  return Math.round(n);
}

function validatePaid(v: unknown): number {
  if (v === true || v === 1 || v === '1') return 1;
  return 0;
}

export function parseCcStatementInput(raw: unknown): CcStatementInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;

  const debt_id = validateDebtId(b.debt_id);
  if (!debt_id) return { error: 'debt_id required' };

  const statement_date = typeof b.statement_date === 'string' ? b.statement_date.trim() : '';
  if (!ISO.test(statement_date)) return { error: 'statement_date must be YYYY-MM-DD' };

  const due_date = typeof b.due_date === 'string' ? b.due_date.trim() : '';
  if (!ISO.test(due_date)) return { error: 'due_date must be YYYY-MM-DD' };

  const balance = validateBalance(b.statement_balance_cents);
  if (balance === null) return { error: 'statement_balance_cents must be 0..100000000000' };

  const minPay = validateBalance(b.min_payment_cents);
  if (minPay === null) return { error: 'min_payment_cents must be 0..100000000000' };

  return {
    debt_id,
    statement_date,
    statement_balance_cents: balance,
    min_payment_cents: minPay,
    due_date,
    paid_in_full: validatePaid(b.paid_in_full),
  };
}

export function parseCcStatementPatch(raw: unknown): CcStatementPatch | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;
  const out: CcStatementPatch = {};

  if ('debt_id' in b) {
    const v = validateDebtId(b.debt_id);
    if (!v) return { error: 'debt_id invalid' };
    out.debt_id = v;
  }
  if ('statement_date' in b) {
    const v = typeof b.statement_date === 'string' ? b.statement_date.trim() : '';
    if (!ISO.test(v)) return { error: 'statement_date must be YYYY-MM-DD' };
    out.statement_date = v;
  }
  if ('due_date' in b) {
    const v = typeof b.due_date === 'string' ? b.due_date.trim() : '';
    if (!ISO.test(v)) return { error: 'due_date must be YYYY-MM-DD' };
    out.due_date = v;
  }
  if ('statement_balance_cents' in b) {
    const v = validateBalance(b.statement_balance_cents);
    if (v === null) return { error: 'statement_balance_cents must be 0..100000000000' };
    out.statement_balance_cents = v;
  }
  if ('min_payment_cents' in b) {
    const v = validateBalance(b.min_payment_cents);
    if (v === null) return { error: 'min_payment_cents must be 0..100000000000' };
    out.min_payment_cents = v;
  }
  if ('paid_in_full' in b) {
    out.paid_in_full = validatePaid(b.paid_in_full);
  }
  return out;
}

ccStatementsRoutes.get('/', async (c) => {
  const debt_id = c.req.query('debt_id');
  const limit = Math.min(Number(c.req.query('limit') ?? '100') || 100, 500);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (debt_id) {
    where.push('debt_id = ?');
    binds.push(debt_id);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT id, debt_id, statement_date, statement_balance_cents, min_payment_cents,
                      due_date, paid_in_full, created_at
               FROM cc_statement_snapshots ${whereSql}
               ORDER BY statement_date DESC, id DESC
               LIMIT ?`;
  binds.push(limit);
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<CcStatementRow>();
  return c.json({ snapshots: results });
});

ccStatementsRoutes.post('/', async (c) => {
  const parsed = parseCcStatementInput(await c.req.json().catch(() => null));
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const debt = await c.env.DB.prepare(`SELECT id FROM debts WHERE id = ?`)
    .bind(parsed.debt_id)
    .first<{ id: string }>();
  if (!debt) return c.json({ error: 'debt not found' }, 404);

  const id = newId('ccst');
  await c.env.DB.prepare(
    `INSERT INTO cc_statement_snapshots
       (id, debt_id, statement_date, statement_balance_cents, min_payment_cents, due_date, paid_in_full, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  )
    .bind(
      id,
      parsed.debt_id,
      parsed.statement_date,
      parsed.statement_balance_cents,
      parsed.min_payment_cents,
      parsed.due_date,
      parsed.paid_in_full,
      nowIso(),
    )
    .run();

  await writeEditLog(c.env, [
    {
      entity_type: 'cc_statement_snapshot',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(parsed),
      actor: 'user',
      reason: 'cc_statement_create',
    },
  ]);

  const streaks = await computeAndStoreStreaks(c.env);
  return c.json({ id, streaks: { cc_payoff_streak: streaks.cc_payoff_streak } });
});

ccStatementsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = parseCcStatementPatch(await c.req.json().catch(() => null));
  if ('error' in patch) return c.json({ error: patch.error }, 400);

  const existing = await c.env.DB.prepare(
    `SELECT id, debt_id, statement_date, statement_balance_cents, min_payment_cents, due_date, paid_in_full, created_at
     FROM cc_statement_snapshots WHERE id = ?`,
  )
    .bind(id)
    .first<CcStatementRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const logs: Parameters<typeof writeEditLog>[1] = [];

  const fields: Array<keyof CcStatementPatch> = [
    'debt_id',
    'statement_date',
    'statement_balance_cents',
    'min_payment_cents',
    'due_date',
    'paid_in_full',
  ];
  for (const f of fields) {
    if (patch[f] === undefined) continue;
    const oldVal = (existing as Record<string, unknown>)[f];
    const newVal = patch[f] as unknown;
    if (oldVal === newVal) continue;
    updates.push(`${f} = ?`);
    values.push(newVal);
    logs.push({
      entity_type: 'cc_statement_snapshot',
      entity_id: id,
      field: f,
      old_value: oldVal === null ? null : String(oldVal),
      new_value: newVal === null ? null : String(newVal),
      actor: 'user',
      reason: 'cc_statement_update',
    });
  }

  if (!updates.length) return c.json({ ok: true, changed: 0 });

  await c.env.DB.prepare(`UPDATE cc_statement_snapshots SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  await writeEditLog(c.env, logs);

  const streaks = await computeAndStoreStreaks(c.env);
  return c.json({ ok: true, changed: logs.length, streaks: { cc_payoff_streak: streaks.cc_payoff_streak } });
});

ccStatementsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    `SELECT id, debt_id, statement_date, statement_balance_cents, min_payment_cents, due_date, paid_in_full
     FROM cc_statement_snapshots WHERE id = ?`,
  )
    .bind(id)
    .first<CcStatementRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  await c.env.DB.prepare(`DELETE FROM cc_statement_snapshots WHERE id = ?`).bind(id).run();
  await writeEditLog(c.env, [
    {
      entity_type: 'cc_statement_snapshot',
      entity_id: id,
      field: 'delete',
      old_value: JSON.stringify(existing),
      new_value: null,
      actor: 'user',
      reason: 'cc_statement_delete',
    },
  ]);

  const streaks = await computeAndStoreStreaks(c.env);
  return c.json({ ok: true, streaks: { cc_payoff_streak: streaks.cc_payoff_streak } });
});
