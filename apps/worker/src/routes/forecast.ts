import { Hono } from 'hono';
import type { Env } from '../env.js';
import {
  buildForecast,
  projectPaydays,
  type ForecastEvent,
  type ForecastEventInput,
} from '../lib/forecast.js';
import { loadRecurringContext } from '../lib/recurringContext.js';
import { stripRoleSuffix } from './today.js';

export const forecastRoutes = new Hono<{ Bindings: Env }>();

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

// GET /api/forecast?days=30 — running-balance projection for the next N days.
// Combines: recurring bills (detector), committed plan installments, projected
// paydays (bi-weekly from latest period), and recurring savings sweeps.
// Starts from the current Assets:Cash GL balance.
forecastRoutes.get('/', async (c) => {
  const daysQ = c.req.query('days');
  const daysParsed = daysQ ? Math.round(Number(daysQ)) : DEFAULT_DAYS;
  const days = Number.isFinite(daysParsed)
    ? Math.max(7, Math.min(MAX_DAYS, daysParsed))
    : DEFAULT_DAYS;

  const today = new Date().toISOString().slice(0, 10);

  // Starting balance: sum of Assets:Cash GL accounts (debit − credit, since
  // assets are natural-debit) up to today.
  const cashRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(l.debit_cents) - SUM(l.credit_cents), 0) AS bal
     FROM gl_accounts a
     JOIN journal_lines l ON l.account_id = a.id
     JOIN journal_entries e ON e.id = l.journal_entry_id
     WHERE a.parent_id = 'gla_assets_cash'
       AND date(e.posted_at) <= ?`,
  )
    .bind(today)
    .first<{ bal: number }>();
  const starting_balance_cents = Math.round(cashRow?.bal ?? 0);

  // Recurring bills + savings sweeps — detector returns one next occurrence
  // per merchant; that's enough resolution for a 30-day window.
  const ctx = await loadRecurringContext(c.env, today);
  const recurring = ctx.getRecurring(days);

  const events: ForecastEventInput[] = [];
  for (const r of recurring) {
    if (r.category_group === 'transfer') {
      events.push({
        date: r.next_due,
        type: 'savings_recurring',
        label: r.merchant_name,
        amount_cents: r.amount_cents,
        category_group: 'savings',
      });
    } else if (r.category_group !== 'debt') {
      events.push({
        date: r.next_due,
        type: 'bill',
        label: r.merchant_name,
        amount_cents: r.amount_cents,
        category_group: r.category_group,
      });
    }
  }

  // Committed (not stamped) plan installments — pull across pay_periods that
  // overlap the window. Use period.end_date as due date (matches Today queue).
  const { results: instRows } = await c.env.DB.prepare(
    `SELECT pa.label as label, pa.planned_cents as planned_cents,
            pp.end_date as due_date
     FROM period_allocations pa
     JOIN pay_periods pp ON pp.id = pa.pay_period_id
     WHERE pa.category_group = 'debt'
       AND pa.committed_at IS NOT NULL
       AND pa.stamped_at IS NULL
       AND pa.planned_cents > 0
       AND pp.end_date >= ?
       AND pp.end_date <= date(?, '+' || ? || ' days')`,
  )
    .bind(today, today, days)
    .all<{ label: string; planned_cents: number; due_date: string }>();
  // Aggregate per debt name + due_date so the user sees one row per debt.
  const byKey = new Map<string, { date: string; label: string; cents: number }>();
  for (const r of instRows ?? []) {
    const name = stripRoleSuffix(r.label);
    const key = `${r.due_date}::${name}`;
    const prev = byKey.get(key);
    if (prev) prev.cents += r.planned_cents;
    else byKey.set(key, { date: r.due_date, label: name, cents: r.planned_cents });
  }
  for (const v of byKey.values()) {
    events.push({
      date: v.date,
      type: 'plan',
      label: v.label,
      amount_cents: v.cents,
      category_group: 'debt',
    });
  }

  // Paydays: predict bi-weekly forward from latest pay_period.
  const period = await c.env.DB.prepare(
    `SELECT end_date, paycheque_cents FROM pay_periods
     WHERE start_date <= date('now')
     ORDER BY start_date DESC LIMIT 1`,
  ).first<{ end_date: string; paycheque_cents: number }>();
  if (period && period.paycheque_cents > 0) {
    const next_due = new Date(Date.parse(period.end_date) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const paydays = projectPaydays({
      next_due,
      amount_cents: period.paycheque_cents,
      cadence_days: 14,
      today,
      days,
    });
    for (const p of paydays) {
      events.push({
        date: p.date,
        type: 'payday',
        label: 'Payday',
        amount_cents: p.amount_cents,
        category_group: 'income',
      });
    }
  }

  const out: ForecastEvent[] = buildForecast({
    today,
    days,
    starting_balance_cents,
    events,
  });

  const min_balance = out.reduce(
    (m, e) => Math.min(m, e.running_balance_cents),
    starting_balance_cents,
  );

  return c.json({
    today,
    days,
    starting_balance_cents,
    min_balance_cents: min_balance,
    events: out,
  });
});
