import { Hono } from 'hono';
import type { Env } from '../env.js';

const PURGE_TABLES = [
  'split_events',
  'splits',
  'counterparties',
  'debt_payments',
  'debts',
  'period_allocations',
  'pay_periods',
  'budgets',
  'transactions',
  'merchants',
  'categories',
  'accounts',
  'holdings',
  'prices',
  'recommendations',
  'tfsa_room',
  'signals',
  'market_snapshots',
  'credit_snapshots',
  'phase_log',
  'behaviour_snapshots',
  'goals',
  'cron_runs',
  'cc_statement_snapshots',
  'review_queue',
  'settings',
] as const;

const CONFIRM_PHRASE = 'DELETE EVERYTHING';

export interface PurgeRequestBody {
  confirm: string;
}

export function isValidPurgeBody(raw: unknown): raw is PurgeRequestBody {
  if (!raw || typeof raw !== 'object') return false;
  const body = raw as Record<string, unknown>;
  return body.confirm === CONFIRM_PHRASE;
}

export const dataPurgeRoutes = new Hono<{ Bindings: Env }>();

dataPurgeRoutes.delete('/', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!isValidPurgeBody(raw)) {
    return c.json(
      { error: 'confirmation_required', confirm_phrase: CONFIRM_PHRASE },
      400,
    );
  }

  const purgedAt = new Date().toISOString();
  const tableCounts: Record<string, number> = {};

  for (const table of PURGE_TABLES) {
    const result = await c.env.DB.prepare(`DELETE FROM ${table}`).run();
    tableCounts[table] = result.meta?.changes ?? 0;
  }

  await c.env.DB.prepare(
    `INSERT INTO edit_log (id, ts, actor, entity_type, entity_id, field, old_value, new_value, reason) VALUES (?, ?, 'user', 'data_purge', 'all', 'all', null, null, 'user_data_purge')`,
  )
    .bind(`edit_purge_${purgedAt}`, purgedAt)
    .run()
    .catch(() => undefined);

  return c.json({
    purged: true,
    purged_at: purgedAt,
    tables: tableCounts,
  });
});
