import { Hono } from 'hono';
import type { Env } from '../env.js';

export const editLogRoutes = new Hono<{ Bindings: Env }>();

const ALLOWED_ENTITY_TYPES = new Set([
  'account',
  'debt',
  'split',
  'transaction',
  'review_item',
  'settings',
  'phase',
  'routing_plan',
  'goal',
  'merchant',
  'credit_snapshot',
  'holding',
  'cc_statement_snapshot',
  'reconciliation',
]);

export function clampLimit(raw: string | undefined, fallback = 50, max = 500): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function sanitizeEntityType(raw: string | undefined): string | null {
  if (!raw) return null;
  return ALLOWED_ENTITY_TYPES.has(raw) ? raw : null;
}

editLogRoutes.get('/', async (c) => {
  const limit = clampLimit(c.req.query('limit'));
  const entity_type = sanitizeEntityType(c.req.query('entity_type'));
  const entity_id = c.req.query('entity_id') ?? null;

  const where: string[] = [];
  const binds: unknown[] = [];
  if (entity_type) {
    where.push('entity_type = ?');
    binds.push(entity_type);
  }
  if (entity_id) {
    where.push('entity_id = ?');
    binds.push(entity_id);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT id, entity_type, entity_id, field, old_value, new_value, actor, reason, created_at
               FROM edit_log ${whereSql}
               ORDER BY created_at DESC
               LIMIT ?`;
  binds.push(limit);
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ entries: results, limit });
});

editLogRoutes.get('/entity-types', (c) => {
  return c.json({ entity_types: Array.from(ALLOWED_ENTITY_TYPES).sort() });
});
