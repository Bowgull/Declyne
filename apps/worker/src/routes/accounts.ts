import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const accountsRoutes = new Hono<{ Bindings: Env }>();

type AccountType = 'chequing' | 'savings' | 'credit' | 'loan';

interface AccountRow {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  currency: string;
  last_import_at: string | null;
  archived: number;
}

accountsRoutes.get('/', async (c) => {
  const includeArchived = c.req.query('archived') === '1';
  const sql = includeArchived
    ? `SELECT * FROM accounts ORDER BY archived ASC, institution ASC, name ASC`
    : `SELECT * FROM accounts WHERE archived = 0 ORDER BY institution ASC, name ASC`;
  const { results } = await c.env.DB.prepare(sql).all<AccountRow>();
  return c.json({ accounts: results });
});

accountsRoutes.post('/', async (c) => {
  const b = (await c.req.json()) as {
    name: string;
    institution: string;
    type: AccountType;
    currency?: string;
  };
  if (!b.name?.trim() || !b.institution?.trim() || !b.type) {
    return c.json({ error: 'name, institution, type required' }, 400);
  }
  const id = newId('acct');
  const currency = b.currency?.trim() || 'CAD';
  await c.env.DB.prepare(
    `INSERT INTO accounts (id, name, institution, type, currency, archived) VALUES (?,?,?,?,?,0)`,
  )
    .bind(id, b.name.trim(), b.institution.trim(), b.type, currency)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'account',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify({ name: b.name, institution: b.institution, type: b.type, currency }),
      actor: 'user',
      reason: 'account_create',
    },
  ]);
  return c.json({ id });
});

accountsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = (await c.req.json()) as Partial<AccountRow>;
  const existing = await c.env.DB.prepare(`SELECT * FROM accounts WHERE id = ?`).bind(id).first<AccountRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const allowed = ['name', 'institution', 'type', 'currency', 'archived'] as const;
  const keys = Object.keys(patch).filter((k): k is typeof allowed[number] => (allowed as readonly string[]).includes(k));
  if (keys.length === 0) return c.json({ ok: true });

  const logs = [];
  const values: (string | number)[] = [];
  for (const k of keys) {
    const next = patch[k] as string | number;
    if (existing[k] !== next) {
      logs.push({
        entity_type: 'account',
        entity_id: id,
        field: k,
        old_value: existing[k] == null ? null : String(existing[k]),
        new_value: next == null ? null : String(next),
        actor: 'user' as const,
        reason: 'account_update',
      });
    }
    values.push(next);
  }
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  await c.env.DB.prepare(`UPDATE accounts SET ${setClause} WHERE id = ?`).bind(...values, id).run();
  await writeEditLog(c.env, logs);
  return c.json({ ok: true });
});

accountsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM accounts WHERE id = ?`).bind(id).first<AccountRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  await c.env.DB.prepare(`UPDATE accounts SET archived = 1 WHERE id = ?`).bind(id).run();
  await writeEditLog(c.env, [
    {
      entity_type: 'account',
      entity_id: id,
      field: 'archived',
      old_value: '0',
      new_value: '1',
      actor: 'user',
      reason: 'account_archive',
    },
  ]);
  return c.json({ ok: true });
});
