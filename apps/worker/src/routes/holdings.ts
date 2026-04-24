import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const holdingsRoutes = new Hono<{ Bindings: Env }>();

const WRAPPERS = new Set(['tfsa', 'fhsa', 'rrsp', 'nonreg']);

type HoldingRow = {
  id: string;
  symbol: string;
  account_wrapper: string;
  units: number;
  avg_cost_cents: number;
  updated_at: string;
};

export type HoldingInput = {
  symbol: string;
  account_wrapper: string;
  units: number;
  avg_cost_cents: number;
};

export type HoldingPatch = Partial<HoldingInput>;

export function parseHoldingInput(raw: unknown): HoldingInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;

  const symbol = typeof b.symbol === 'string' ? b.symbol.trim().toUpperCase() : '';
  if (!symbol) return { error: 'symbol required' };
  if (symbol.length > 20) return { error: 'symbol too long' };

  const wrapper = typeof b.account_wrapper === 'string' ? b.account_wrapper.trim().toLowerCase() : '';
  if (!WRAPPERS.has(wrapper)) return { error: 'account_wrapper must be tfsa|fhsa|rrsp|nonreg' };

  const units = Number(b.units);
  if (!Number.isFinite(units) || units <= 0 || units > 1_000_000_0000) {
    return { error: 'units must be 1..10000000000 (4-decimal scaled int)' };
  }

  const avg = Number(b.avg_cost_cents);
  if (!Number.isFinite(avg) || avg < 0 || avg > 1_000_000_000_00) {
    return { error: 'avg_cost_cents must be 0..100000000000' };
  }

  return {
    symbol,
    account_wrapper: wrapper,
    units: Math.round(units),
    avg_cost_cents: Math.round(avg),
  };
}

export function parseHoldingPatch(raw: unknown): HoldingPatch | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;
  const out: HoldingPatch = {};

  if ('symbol' in b) {
    if (typeof b.symbol !== 'string') return { error: 'symbol must be string' };
    const v = b.symbol.trim().toUpperCase();
    if (!v) return { error: 'symbol required' };
    if (v.length > 20) return { error: 'symbol too long' };
    out.symbol = v;
  }
  if ('account_wrapper' in b) {
    const v = typeof b.account_wrapper === 'string' ? b.account_wrapper.trim().toLowerCase() : '';
    if (!WRAPPERS.has(v)) return { error: 'account_wrapper must be tfsa|fhsa|rrsp|nonreg' };
    out.account_wrapper = v;
  }
  if ('units' in b) {
    const n = Number(b.units);
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_0000) {
      return { error: 'units must be 1..10000000000' };
    }
    out.units = Math.round(n);
  }
  if ('avg_cost_cents' in b) {
    const n = Number(b.avg_cost_cents);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_00) {
      return { error: 'avg_cost_cents must be 0..100000000000' };
    }
    out.avg_cost_cents = Math.round(n);
  }
  return out;
}

holdingsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, symbol, account_wrapper, units, avg_cost_cents, updated_at
     FROM holdings
     ORDER BY symbol ASC, account_wrapper ASC`,
  ).all<HoldingRow>();
  return c.json({ holdings: results });
});

holdingsRoutes.post('/', async (c) => {
  const parsed = parseHoldingInput(await c.req.json().catch(() => null));
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const id = newId('hold');
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO holdings (id, symbol, account_wrapper, units, avg_cost_cents, updated_at)
     VALUES (?,?,?,?,?,?)`,
  )
    .bind(id, parsed.symbol, parsed.account_wrapper, parsed.units, parsed.avg_cost_cents, now)
    .run();

  await writeEditLog(c.env, [
    {
      entity_type: 'holding',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(parsed),
      actor: 'user',
      reason: 'holding_create',
    },
  ]);

  return c.json({ id });
});

holdingsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = parseHoldingPatch(await c.req.json().catch(() => null));
  if ('error' in patch) return c.json({ error: patch.error }, 400);

  const existing = await c.env.DB.prepare(
    `SELECT id, symbol, account_wrapper, units, avg_cost_cents, updated_at FROM holdings WHERE id = ?`,
  )
    .bind(id)
    .first<HoldingRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const logs: Parameters<typeof writeEditLog>[1] = [];

  const fields: Array<keyof HoldingPatch> = ['symbol', 'account_wrapper', 'units', 'avg_cost_cents'];
  for (const f of fields) {
    if (patch[f] === undefined) continue;
    const oldVal = (existing as Record<string, unknown>)[f];
    const newVal = patch[f] as unknown;
    if (oldVal === newVal) continue;
    updates.push(`${f} = ?`);
    values.push(newVal);
    logs.push({
      entity_type: 'holding',
      entity_id: id,
      field: f,
      old_value: oldVal === null ? null : String(oldVal),
      new_value: newVal === null ? null : String(newVal),
      actor: 'user',
      reason: 'holding_update',
    });
  }

  if (!updates.length) return c.json({ ok: true, changed: 0 });

  updates.push('updated_at = ?');
  values.push(nowIso());

  await c.env.DB.prepare(`UPDATE holdings SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  await writeEditLog(c.env, logs);

  return c.json({ ok: true, changed: logs.length });
});

holdingsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    `SELECT id, symbol, account_wrapper, units, avg_cost_cents FROM holdings WHERE id = ?`,
  )
    .bind(id)
    .first<HoldingRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  await c.env.DB.prepare(`DELETE FROM holdings WHERE id = ?`).bind(id).run();
  await writeEditLog(c.env, [
    {
      entity_type: 'holding',
      entity_id: id,
      field: 'delete',
      old_value: JSON.stringify(existing),
      new_value: null,
      actor: 'user',
      reason: 'holding_delete',
    },
  ]);

  return c.json({ ok: true });
});
