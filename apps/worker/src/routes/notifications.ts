import { Hono } from 'hono';
import type { Env } from '../env.js';
import { detectRecurring, predictNextPayday, type RecurringTxn } from '../lib/recurring.js';
import {
  buildNotificationSchedule,
  type BillInput,
  type DebtInput,
  type TankInput,
} from '../lib/notificationSchedule.js';

export const notificationsRoutes = new Hono<{ Bindings: Env }>();

const HORIZON_DAYS = 30;

// GET /api/notifications/schedule — returns dynamic notification rows the
// client should hand to Capacitor LocalNotifications on launch. The two
// fixed weekly receipts (Sun/Tue) stay scheduled separately by the client;
// these are the additive event-driven ones.
notificationsRoutes.get('/schedule', async (c) => {
  const today = new Date().toISOString().slice(0, 10);

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
  const detected = detectRecurring(txnRows, today, HORIZON_DAYS);
  const bills: BillInput[] = detected.map((b) => ({
    merchant_name: b.merchant_name,
    amount_cents: b.amount_cents,
    next_due: b.next_due,
  }));

  const period = await c.env.DB.prepare(
    `SELECT id, end_date, paycheque_cents FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; end_date: string; paycheque_cents: number }>();
  const payday = predictNextPayday(period ?? null, today, HORIZON_DAYS);

  const { results: debtRows } = await c.env.DB.prepare(
    `SELECT id, name, due_day, min_payment_fixed_cents, min_payment_percent_bps, principal_cents
     FROM debts WHERE archived_at IS NULL`,
  ).all<DebtInput>();

  let tank: TankInput | null = null;
  if (period) {
    const totalsRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 AND COALESCE(c."group",'') != 'transfer' THEN -t.amount_cents ELSE 0 END), 0) as spent
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.posted_at >= (SELECT start_date FROM pay_periods WHERE id = ?)
         AND t.posted_at <= (SELECT end_date FROM pay_periods WHERE id = ?)`,
    )
      .bind(period.id, period.id)
      .first<{ spent: number }>();
    const spent = totalsRow?.spent ?? 0;
    const remaining = period.paycheque_cents - spent;
    const daysRem = Math.max(
      0,
      Math.ceil((Date.parse(`${period.end_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000),
    );
    tank = {
      paycheque_cents: period.paycheque_cents,
      remaining_cents: remaining,
      days_remaining: daysRem,
    };
  }

  const notifications = buildNotificationSchedule(
    {
      bills,
      debts: debtRows ?? [],
      payday: { next_payday: payday?.next_due ?? null },
      tank,
    },
    today,
  );

  return c.json({ today, notifications });
});
