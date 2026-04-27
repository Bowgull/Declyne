// Pure helpers that turn financial state into notification rows the client
// can hand to Capacitor LocalNotifications. Voice stays direct, slightly
// dark, no cheerleading. Each notification carries a stable id so the
// client can cancel + reschedule without piling duplicates.

export type NotificationKind = 'bill_due_tomorrow' | 'paycheque_landed' | 'debt_min_due' | 'tank_low';

export interface NotificationRow {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  // YYYY-MM-DD — the day this should fire at 9am local.
  fire_date: string;
}

// Stable ID ranges keep client cancel/reschedule predictable.
//   1, 2     → existing weekly receipts (Sun/Tue)
//   100-149  → bills due tomorrow (one per upcoming bill)
//   200-249  → debt minimums due in 3 days (one per debt)
//   300      → paycheque landed today
//   400      → tank running low
const BILL_BASE = 100;
const DEBT_BASE = 200;
const PAYCHEQUE_ID = 300;
const TANK_LOW_ID = 400;

export interface BillInput {
  merchant_name: string;
  amount_cents: number;
  next_due: string; // YYYY-MM-DD
}

export interface DebtInput {
  id: string;
  name: string;
  due_day: number | null;
  min_payment_fixed_cents: number | null;
  min_payment_percent_bps: number | null;
  principal_cents: number;
}

export interface PaydayInput {
  next_payday: string | null; // YYYY-MM-DD
}

export interface TankInput {
  paycheque_cents: number;
  remaining_cents: number;
  days_remaining: number;
}

export interface ScheduleInput {
  bills: BillInput[];
  debts: DebtInput[];
  payday: PaydayInput;
  tank: TankInput | null;
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.NaN;
  return Math.round((db - da) / 86_400_000);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns YYYY-MM-DD for the next occurrence of `due_day` in this month or
// next, today-or-later. Handles months with fewer days by clamping.
export function nextDueDate(today: string, due_day: number): string | null {
  if (due_day < 1 || due_day > 31) return null;
  const d = new Date(`${today}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let candidateDay = Math.min(due_day, lastDayOfMonth);
  let candidate = new Date(Date.UTC(year, month, candidateDay));
  if (candidate < d) {
    const lastDayOfNext = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
    candidateDay = Math.min(due_day, lastDayOfNext);
    candidate = new Date(Date.UTC(year, month + 1, candidateDay));
  }
  return candidate.toISOString().slice(0, 10);
}

// Tank is "low" when remaining cash is less than the daily-burn implied
// runway needed to cover the rest of the period. Threshold: remaining /
// days_remaining < paycheque / 14 (assumed ~bi-weekly cadence).
export function isTankLow(tank: TankInput): boolean {
  if (tank.days_remaining <= 0) return false;
  if (tank.paycheque_cents <= 0) return false;
  if (tank.remaining_cents <= 0) return true;
  const burnExpected = tank.paycheque_cents / 14;
  const burnActual = tank.remaining_cents / tank.days_remaining;
  return burnActual < burnExpected * 0.6;
}

export function buildNotificationSchedule(input: ScheduleInput, today: string): NotificationRow[] {
  const out: NotificationRow[] = [];

  // Bills: notify the day before due, capped at 50 entries.
  input.bills.slice(0, 50).forEach((bill, i) => {
    const days = daysBetween(today, bill.next_due);
    if (!Number.isFinite(days) || days < 1 || days > 60) return;
    const fire_date = shiftDate(bill.next_due, -1);
    const dollars = (bill.amount_cents / 100).toFixed(2);
    out.push({
      id: BILL_BASE + i,
      kind: 'bill_due_tomorrow',
      title: `${bill.merchant_name} hits tomorrow.`,
      body: `$${dollars}. Make sure it's there.`,
      fire_date,
    });
  });

  // Debts: notify 3 days before next due_day with the implied minimum.
  input.debts.slice(0, 50).forEach((debt, i) => {
    if (!debt.due_day) return;
    const due = nextDueDate(today, debt.due_day);
    if (!due) return;
    const days = daysBetween(today, due);
    if (!Number.isFinite(days) || days < 3 || days > 60) return;
    const fire_date = shiftDate(due, -3);
    const min =
      debt.min_payment_fixed_cents ??
      Math.max(
        1000,
        Math.round((debt.principal_cents * (debt.min_payment_percent_bps ?? 0)) / 10_000),
      );
    const dollars = (min / 100).toFixed(2);
    out.push({
      id: DEBT_BASE + i,
      kind: 'debt_min_due',
      title: `${debt.name} minimum due in 3 days.`,
      body: `At least $${dollars}. Don't let it slip.`,
      fire_date,
    });
  });

  // Paycheque landing today: only emit if today === predicted next_payday.
  if (input.payday.next_payday) {
    const days = daysBetween(today, input.payday.next_payday);
    if (days === 0) {
      out.push({
        id: PAYCHEQUE_ID,
        kind: 'paycheque_landed',
        title: 'Paycheque should be in.',
        body: 'Open the app, draft the period.',
        fire_date: today,
      });
    }
  }

  // Tank low: fire today if pacing is off.
  if (input.tank && isTankLow(input.tank)) {
    out.push({
      id: TANK_LOW_ID,
      kind: 'tank_low',
      title: 'The tank is running thin.',
      body: 'You have more days left than dollars per day.',
      fire_date: today,
    });
  }

  return out;
}
