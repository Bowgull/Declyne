import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const counterpartiesRoutes = new Hono<{ Bindings: Env }>();

export type CounterpartyInput = {
  name: string;
  default_settlement_method?: 'etransfer' | 'cash' | 'other';
};

export function parseCounterpartyInput(b: unknown): CounterpartyInput | { error: string } {
  if (!b || typeof b !== 'object') return { error: 'invalid body' };
  const o = b as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) return { error: 'name required' };
  if (name.length > 80) return { error: 'name too long' };
  const settle = o.default_settlement_method;
  const allowed = new Set(['etransfer', 'cash', 'other']);
  const default_settlement_method =
    typeof settle === 'string' && allowed.has(settle)
      ? (settle as 'etransfer' | 'cash' | 'other')
      : 'etransfer';
  return { name, default_settlement_method };
}

// GET /api/counterparties
// Returns one row per counterparty with aggregated open-tab balance.
// Direction: net cents (positive = owes_you, negative = you_owe).
counterpartiesRoutes.get('/', async (c) => {
  const includeArchived = c.req.query('include_archived') === '1';
  const where = includeArchived ? '' : 'WHERE cp.archived_at IS NULL';
  const { results } = await c.env.DB.prepare(
    `SELECT
       cp.id,
       cp.name,
       cp.default_settlement_method,
       cp.archived_at,
       cp.created_at,
       COALESCE(SUM(CASE WHEN s.closed_at IS NULL AND s.direction = 'they_owe'
                         THEN s.remaining_cents ELSE 0 END), 0) AS owes_you_cents,
       COALESCE(SUM(CASE WHEN s.closed_at IS NULL AND s.direction = 'i_owe'
                         THEN s.remaining_cents ELSE 0 END), 0) AS you_owe_cents,
       COUNT(CASE WHEN s.closed_at IS NULL THEN 1 END) AS open_tab_count,
       MAX(s.created_at) AS last_tab_at,
       (SELECT s2.id FROM splits s2
         WHERE s2.counterparty_id = cp.id
           AND s2.closed_at IS NULL
           AND s2.direction = 'they_owe'
         ORDER BY s2.remaining_cents DESC, s2.created_at DESC LIMIT 1) AS latest_owes_you_split_id
     FROM counterparties cp
     LEFT JOIN splits s ON s.counterparty_id = cp.id
     ${where}
     GROUP BY cp.id
     ORDER BY (CASE WHEN MAX(s.created_at) IS NULL THEN 1 ELSE 0 END), MAX(s.created_at) DESC, cp.name ASC`,
  ).all<{
    id: string;
    name: string;
    default_settlement_method: string | null;
    archived_at: string | null;
    created_at: string;
    owes_you_cents: number;
    you_owe_cents: number;
    open_tab_count: number;
    last_tab_at: string | null;
    latest_owes_you_split_id: string | null;
  }>();
  const rows = (results ?? []).map((r) => {
    const net = r.owes_you_cents - r.you_owe_cents;
    return {
      ...r,
      net_cents: net,
      direction: net > 0 ? ('owes_you' as const) : net < 0 ? ('you_owe' as const) : ('settled' as const),
    };
  });
  return c.json({ counterparties: rows });
});

// GET /api/counterparties/:id  -- drill-in: counterparty + splits + events + GL balance
counterpartiesRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const cp = await c.env.DB.prepare(`SELECT * FROM counterparties WHERE id = ?`).bind(id).first<{
    id: string;
    name: string;
    default_settlement_method: string | null;
    archived_at: string | null;
    created_at: string;
    account_id: string | null;
  }>();
  if (!cp) return c.json({ error: 'not found' }, 404);

  // GL balance: debits - credits on the cp's GL account. Positive = they owe me,
  // negative = I owe them. Falls back to 0 when account_id is unset.
  let glBalanceCents = 0;
  if (cp.account_id) {
    const row = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(debit_cents), 0) AS d, COALESCE(SUM(credit_cents), 0) AS cr
       FROM journal_lines WHERE account_id = ?`,
    )
      .bind(cp.account_id)
      .first<{ d: number; cr: number }>();
    glBalanceCents = (row?.d ?? 0) - (row?.cr ?? 0);
  }

  const { results: splitRows } = await c.env.DB.prepare(
    `SELECT id, direction, original_cents, remaining_cents, reason, created_at, closed_at
     FROM splits WHERE counterparty_id = ? ORDER BY created_at DESC`,
  )
    .bind(id)
    .all<{
      id: string;
      direction: 'i_owe' | 'they_owe';
      original_cents: number;
      remaining_cents: number;
      reason: string;
      created_at: string;
      closed_at: string | null;
    }>();

  const splitIds = (splitRows ?? []).map((r) => r.id);
  const events =
    splitIds.length === 0
      ? []
      : (
          await c.env.DB.prepare(
            `SELECT id, split_id, delta_cents, transaction_id, note, created_at
             FROM split_events WHERE split_id IN (${splitIds.map(() => '?').join(',')})
             ORDER BY created_at DESC`,
          )
            .bind(...splitIds)
            .all()
        ).results ?? [];

  return c.json({ counterparty: cp, splits: splitRows ?? [], events, gl_balance_cents: glBalanceCents });
});

counterpartiesRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = parseCounterpartyInput(body);
  if ('error' in parsed) return c.json(parsed, 400);
  const id = newId('cp');
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO counterparties (id, name, default_settlement_method, archived_at, created_at)
     VALUES (?,?,?,NULL,?)`,
  )
    .bind(id, parsed.name, parsed.default_settlement_method, now)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'counterparty',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(parsed),
      actor: 'user',
      reason: 'counterparty_create',
    },
  ]);
  return c.json({ id, ...parsed });
});

counterpartiesRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const cp = await c.env.DB.prepare(`SELECT * FROM counterparties WHERE id = ?`).bind(id).first<{
    id: string;
    name: string;
    default_settlement_method: string | null;
    archived_at: string | null;
  }>();
  if (!cp) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: string[] = [];
  const binds: unknown[] = [];
  const logs: Array<{ field: string; old_value: string | null; new_value: string | null }> = [];
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim();
    if (trimmed && trimmed.length <= 80 && trimmed !== cp.name) {
      updates.push('name = ?');
      binds.push(trimmed);
      logs.push({ field: 'name', old_value: cp.name, new_value: trimmed });
    }
  }
  if (typeof body.default_settlement_method === 'string') {
    const allowed = new Set(['etransfer', 'cash', 'other']);
    if (allowed.has(body.default_settlement_method) && body.default_settlement_method !== cp.default_settlement_method) {
      updates.push('default_settlement_method = ?');
      binds.push(body.default_settlement_method);
      logs.push({
        field: 'default_settlement_method',
        old_value: cp.default_settlement_method,
        new_value: body.default_settlement_method,
      });
    }
  }
  if (typeof body.archived === 'boolean') {
    const newArchived = body.archived ? nowIso() : null;
    if ((newArchived === null) !== (cp.archived_at === null)) {
      updates.push('archived_at = ?');
      binds.push(newArchived);
      logs.push({ field: 'archived_at', old_value: cp.archived_at, new_value: newArchived });
    }
  }
  if (updates.length === 0) return c.json({ changed: 0 });
  binds.push(id);
  await c.env.DB.prepare(`UPDATE counterparties SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();
  await writeEditLog(
    c.env,
    logs.map((l) => ({
      entity_type: 'counterparty',
      entity_id: id,
      field: l.field,
      old_value: l.old_value,
      new_value: l.new_value,
      actor: 'user',
      reason: 'counterparty_patch',
    })),
  );
  return c.json({ changed: updates.length });
});
