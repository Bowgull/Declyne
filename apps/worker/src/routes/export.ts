import { Hono } from 'hono';
import type { Env } from '../env.js';

export const exportRoutes = new Hono<{ Bindings: Env }>();

// One sectioned CSV. Sections: accounts, transactions, debts, splits, phase_log, edit_log.
// Header rows between sections. Not a ZIP.
exportRoutes.get('/', async (c) => {
  const sections: Array<[string, string[], Record<string, unknown>[]]> = [];

  const addSection = async (name: string, sql: string, cols: string[]) => {
    const { results } = await c.env.DB.prepare(sql).all<Record<string, unknown>>();
    sections.push([name, cols, results]);
  };

  await addSection('accounts', `SELECT id, name, institution, type, currency, last_import_at, archived FROM accounts`, [
    'id', 'name', 'institution', 'type', 'currency', 'last_import_at', 'archived',
  ]);
  await addSection('transactions', `SELECT id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, source FROM transactions ORDER BY posted_at`, [
    'id', 'account_id', 'posted_at', 'amount_cents', 'description_raw', 'merchant_id', 'category_id', 'source',
  ]);
  await addSection('debts', `SELECT id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value, statement_date, payment_due_date, archived FROM debts`, [
    'id', 'name', 'principal_cents', 'interest_rate_bps', 'min_payment_type', 'min_payment_value', 'statement_date', 'payment_due_date', 'archived',
  ]);
  await addSection('splits', `SELECT s.id, COALESCE(cp.name, '') AS counterparty, s.direction, s.original_cents, s.remaining_cents, s.reason, s.created_at, s.closed_at FROM splits s LEFT JOIN counterparties cp ON cp.id = s.counterparty_id`, [
    'id', 'counterparty', 'direction', 'original_cents', 'remaining_cents', 'reason', 'created_at', 'closed_at',
  ]);
  await addSection('phase_log', `SELECT id, phase, entered_at, trigger_rule, metrics_json FROM phase_log ORDER BY entered_at`, [
    'id', 'phase', 'entered_at', 'trigger_rule', 'metrics_json',
  ]);
  await addSection('edit_log', `SELECT id, entity_type, entity_id, field, old_value, new_value, actor, reason, created_at FROM edit_log ORDER BY created_at`, [
    'id', 'entity_type', 'entity_id', 'field', 'old_value', 'new_value', 'actor', 'reason', 'created_at',
  ]);

  const lines: string[] = [];
  for (const [name, cols, rows] of sections) {
    lines.push(`# ${name}`);
    lines.push(cols.join(','));
    for (const r of rows) {
      lines.push(cols.map((k) => csvCell(r[k])).join(','));
    }
    lines.push('');
  }

  const body = lines.join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="declyne-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
