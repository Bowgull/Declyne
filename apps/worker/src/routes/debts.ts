import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const debtsRoutes = new Hono<{ Bindings: Env }>();

type MinPaymentType = 'fixed' | 'percent';

export const DEBT_SEVERITIES = [
  'current',
  'past_due',
  'in_collections',
  'charged_off',
  'settled_partial',
] as const;
export type DebtSeverityValue = (typeof DEBT_SEVERITIES)[number];

type DebtRow = {
  id: string;
  name: string;
  principal_cents: number;
  interest_rate_bps: number;
  min_payment_type: MinPaymentType;
  min_payment_value: number;
  statement_date: number;
  payment_due_date: number;
  account_id_linked: string | null;
  archived: number;
  severity: DebtSeverityValue;
};

export type DebtPatch = {
  name?: string;
  principal_cents?: number;
  interest_rate_bps?: number;
  min_payment_type?: MinPaymentType;
  min_payment_value?: number;
  statement_date?: number;
  payment_due_date?: number;
  account_id_linked?: string | null;
  archived?: 0 | 1;
  severity?: DebtSeverityValue;
};

const ALLOWED_PATCH_FIELDS: ReadonlyArray<keyof DebtPatch> = [
  'name',
  'principal_cents',
  'interest_rate_bps',
  'min_payment_type',
  'min_payment_value',
  'statement_date',
  'payment_due_date',
  'account_id_linked',
  'archived',
  'severity',
];

export function isDebtSeverity(v: unknown): v is DebtSeverityValue {
  return typeof v === 'string' && (DEBT_SEVERITIES as readonly string[]).includes(v);
}

function isDayOfMonth(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 31 && Math.floor(n) === n;
}

export function parseDebtPatch(raw: unknown): DebtPatch | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;
  const out: DebtPatch = {};

  if ('name' in b) {
    if (typeof b.name !== 'string') return { error: 'name must be string' };
    const v = b.name.trim();
    if (!v) return { error: 'name required' };
    if (v.length > 120) return { error: 'name too long' };
    out.name = v;
  }
  if ('principal_cents' in b) {
    const n = Number(b.principal_cents);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_00) return { error: 'principal_cents must be 0..100000000000' };
    out.principal_cents = Math.round(n);
  }
  if ('interest_rate_bps' in b) {
    const n = Number(b.interest_rate_bps);
    if (!Number.isFinite(n) || n < 0 || n > 50_000) return { error: 'interest_rate_bps must be 0..50000' };
    out.interest_rate_bps = Math.round(n);
  }
  if ('min_payment_type' in b) {
    if (b.min_payment_type !== 'fixed' && b.min_payment_type !== 'percent') {
      return { error: 'min_payment_type must be fixed|percent' };
    }
    out.min_payment_type = b.min_payment_type;
  }
  if ('min_payment_value' in b) {
    const n = Number(b.min_payment_value);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_00) return { error: 'min_payment_value must be 0..100000000000' };
    out.min_payment_value = Math.round(n);
  }
  if ('statement_date' in b) {
    const n = Number(b.statement_date);
    if (!isDayOfMonth(n)) return { error: 'statement_date must be 1..31' };
    out.statement_date = n;
  }
  if ('payment_due_date' in b) {
    const n = Number(b.payment_due_date);
    if (!isDayOfMonth(n)) return { error: 'payment_due_date must be 1..31' };
    out.payment_due_date = n;
  }
  if ('account_id_linked' in b) {
    const v = b.account_id_linked;
    if (v === null || v === '') out.account_id_linked = null;
    else if (typeof v === 'string') out.account_id_linked = v.trim() || null;
    else return { error: 'account_id_linked must be string or null' };
  }
  if ('archived' in b) {
    out.archived = b.archived === true || b.archived === 1 ? 1 : 0;
  }
  if ('severity' in b) {
    if (!isDebtSeverity(b.severity)) return { error: 'severity must be one of ' + DEBT_SEVERITIES.join('|') };
    out.severity = b.severity;
  }
  return out;
}

debtsRoutes.get('/', async (c) => {
  // Per-debt GL balance: SUM(credit) - SUM(debit) on the linked liability account
  // (positive = liability owed). Joined left so debts without a GL link still appear.
  const { results } = await c.env.DB.prepare(
    `SELECT d.*,
            COALESCE(
              (SELECT SUM(jl.credit_cents) - SUM(jl.debit_cents)
               FROM journal_lines jl
               WHERE jl.account_id = d.account_id),
              NULL
            ) AS gl_balance_cents
     FROM debts d
     WHERE d.archived = 0
     ORDER BY d.interest_rate_bps DESC`,
  ).all();
  return c.json({ debts: results });
});

debtsRoutes.post('/', async (c) => {
  const b = (await c.req.json()) as {
    name: string;
    principal_cents: number;
    interest_rate_bps: number;
    min_payment_type: MinPaymentType;
    min_payment_value: number;
    statement_date: number;
    payment_due_date: number;
    account_id_linked: string | null;
    severity?: DebtSeverityValue;
  };
  const severity: DebtSeverityValue = isDebtSeverity(b.severity) ? b.severity : 'current';
  const id = newId('debt');
  await c.env.DB.prepare(
    `INSERT INTO debts (id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value,
                        statement_date, payment_due_date, account_id_linked, archived, severity)
     VALUES (?,?,?,?,?,?,?,?,?,0,?)`,
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
      severity,
    )
    .run();
  await writeEditLog(c.env, [
    { entity_type: 'debt', entity_id: id, field: 'create', old_value: null, new_value: JSON.stringify(b), actor: 'user', reason: 'debt_create' },
  ]);
  return c.json({ id });
});

debtsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = parseDebtPatch(await c.req.json().catch(() => null));
  if ('error' in patch) return c.json({ error: patch.error }, 400);

  const existing = await c.env.DB.prepare(`SELECT * FROM debts WHERE id = ?`).bind(id).first<DebtRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const logs: Parameters<typeof writeEditLog>[1] = [];

  for (const f of ALLOWED_PATCH_FIELDS) {
    if (patch[f] === undefined) continue;
    const oldVal = (existing as Record<string, unknown>)[f];
    const newVal = patch[f] as unknown;
    if (oldVal === newVal) continue;
    updates.push(`${f} = ?`);
    values.push(newVal);
    logs.push({
      entity_type: 'debt',
      entity_id: id,
      field: f,
      old_value: oldVal === null ? null : String(oldVal),
      new_value: newVal === null ? null : String(newVal),
      actor: 'user',
      reason: 'debt_update',
    });
  }

  if (!updates.length) return c.json({ ok: true, changed: 0 });

  // Stamp severity_changed_at when severity actually changes.
  if (patch.severity !== undefined && patch.severity !== existing.severity) {
    updates.push('severity_changed_at = ?');
    values.push(nowIso());
  }

  await c.env.DB.prepare(`UPDATE debts SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  await writeEditLog(c.env, logs);

  return c.json({ ok: true, changed: updates.length });
});

// Dedicated severity endpoint. Accepts {severity} body, validates, writes
// edit_log with reason 'debt_severity_change'. Same effect as PATCH but
// surfaces the action distinctly in the audit tape.
debtsRoutes.post('/:id/severity', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { severity?: unknown } | null;
  if (!body || !isDebtSeverity(body.severity)) {
    return c.json({ error: 'severity must be one of ' + DEBT_SEVERITIES.join('|') }, 400);
  }
  const existing = await c.env.DB.prepare(`SELECT * FROM debts WHERE id = ?`).bind(id).first<DebtRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  if (existing.severity === body.severity) return c.json({ ok: true, changed: 0 });

  await c.env.DB.prepare(`UPDATE debts SET severity = ?, severity_changed_at = ? WHERE id = ?`)
    .bind(body.severity, nowIso(), id)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'debt',
      entity_id: id,
      field: 'severity',
      old_value: existing.severity,
      new_value: body.severity,
      actor: 'user',
      reason: 'debt_severity_change',
    },
  ]);
  return c.json({ ok: true, changed: 1 });
});
