import { Hono } from 'hono';
import type { Env } from '../env.js';
import {
  detectRecurring,
  predictNextPayday,
  type RecurringTxn,
} from '../lib/recurring.js';

export const todayRoutes = new Hono<{ Bindings: Env }>();

const HORIZON_DAYS = 14;

// Consolidated extras for the Today screen that aren't covered by existing
// routes: receipt counter (days since earliest activity), most recent
// indulgence transaction, predicted upcoming bills + next payday.
todayRoutes.get('/', async (c) => {
  const earliest = await c.env.DB.prepare(
    `SELECT MIN(posted_at) as d FROM transactions`,
  ).first<{ d: string | null }>();

  const today = new Date().toISOString().slice(0, 10);
  let rcpt_days = 0;
  if (earliest?.d) {
    const ms = Date.parse(today) - Date.parse(earliest.d.slice(0, 10));
    rcpt_days = Math.max(0, Math.floor(ms / 86_400_000));
  }

  const lastIndulgence = await c.env.DB.prepare(
    `SELECT t.posted_at as posted_at, t.amount_cents as amount_cents, t.description_raw as description_raw
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'indulgence' AND t.amount_cents < 0
     ORDER BY t.posted_at DESC
     LIMIT 1`,
  ).first<{ posted_at: string; amount_cents: number; description_raw: string }>();

  let last_indulgence: {
    posted_at: string;
    amount_cents: number;
    description_raw: string;
    days_ago: number;
  } | null = null;
  if (lastIndulgence) {
    const ms = Date.parse(today) - Date.parse(lastIndulgence.posted_at.slice(0, 10));
    last_indulgence = {
      ...lastIndulgence,
      amount_cents: Math.abs(lastIndulgence.amount_cents),
      days_ago: Math.max(0, Math.floor(ms / 86_400_000)),
    };
  }

  // Pull last 90d of merchant-tagged charges with category group for the
  // recurring detector.
  const { results: txnRows } = await c.env.DB.prepare(
    `SELECT t.posted_at as posted_at,
            t.amount_cents as amount_cents,
            t.merchant_id as merchant_id,
            m.display_name as merchant_name,
            c."group" as "group"
     FROM transactions t
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now', '-90 days')
       AND t.amount_cents < 0
       AND t.merchant_id IS NOT NULL`,
  ).all<RecurringTxn>();

  const bills = detectRecurring(txnRows, today, HORIZON_DAYS);

  const period = await c.env.DB.prepare(
    `SELECT end_date, paycheque_cents FROM pay_periods ORDER BY start_date DESC LIMIT 1`,
  ).first<{ end_date: string; paycheque_cents: number }>();
  const payday = predictNextPayday(period ?? null, today, HORIZON_DAYS);

  // Stitch bills + payday into a single "printing ahead" feed sorted by date.
  type Item = {
    kind: 'bill' | 'payday';
    label: string;
    amount_cents: number;
    due_date: string;
    days_until: number;
  };
  const printing_ahead: Item[] = [
    ...bills.map<Item>((b) => ({
      kind: 'bill',
      label: b.merchant_name,
      amount_cents: b.amount_cents,
      due_date: b.next_due,
      days_until: b.days_until,
    })),
    ...(payday
      ? [
          {
            kind: 'payday' as const,
            label: 'Payday',
            amount_cents: payday.amount_cents,
            due_date: payday.next_due,
            days_until: payday.days_until,
          },
        ]
      : []),
  ].sort((a, b) => a.due_date.localeCompare(b.due_date));

  const next_bill = bills[0] ?? null;

  return c.json({ rcpt_days, last_indulgence, next_bill, printing_ahead });
});
