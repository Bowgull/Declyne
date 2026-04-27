// Recurring-bill detector. Pure helpers; no DB access.
//
// Walks N days of past charges grouped by merchant, finds merchants with a
// stable cadence (median interval), predicts the next occurrence, and returns
// the ones falling inside a forward horizon. Used by /api/today for the NEXT
// and PRINTING AHEAD blocks.

export type RecurringTxn = {
  posted_at: string; // YYYY-MM-DD
  amount_cents: number; // negative = outflow
  merchant_id: string | null;
  merchant_name: string | null;
  group: string | null;
};

export type RecurringPrediction = {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number; // absolute, positive
  last_seen: string;
  next_due: string;
  days_until: number;
  cadence_days: number;
  occurrences: number;
  category_group: string;
};

const MS_PER_DAY = 86_400_000;
// Only treat these category groups as "bills". Indulgence/lifestyle are
// discretionary; income flows the other way.
const BILL_GROUPS = new Set(['essentials', 'debt', 'transfer']);
// Cadence sanity rails: bills are roughly monthly (or biweekly at the
// shortest). Anything tighter is groceries/gas noise, not a "bill".
const MIN_CADENCE_DAYS = 14;
const MAX_CADENCE_DAYS = 35;
const MIN_OCCURRENCES = 3;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  return sorted[mid]!;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
}

function addDays(iso: string, days: number): string {
  const t = new Date(Date.parse(iso) + days * MS_PER_DAY);
  return t.toISOString().slice(0, 10);
}

export function detectRecurring(
  txns: RecurringTxn[],
  today: string,
  horizonDays: number,
): RecurringPrediction[] {
  const todayMs = Date.parse(today);
  const groups = new Map<string, RecurringTxn[]>();
  for (const t of txns) {
    if (!t.merchant_id || !t.merchant_name) continue;
    if (t.amount_cents >= 0) continue; // charges only
    if (!t.group || !BILL_GROUPS.has(t.group)) continue;
    const arr = groups.get(t.merchant_id) ?? [];
    arr.push(t);
    groups.set(t.merchant_id, arr);
  }

  const out: RecurringPrediction[] = [];
  for (const [merchant_id, rows] of groups) {
    if (rows.length < MIN_OCCURRENCES) continue;
    rows.sort((a, b) => a.posted_at.localeCompare(b.posted_at));

    const intervals: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      intervals.push(daysBetween(rows[i - 1]!.posted_at, rows[i]!.posted_at));
    }
    const cadence = median(intervals);
    if (cadence < MIN_CADENCE_DAYS || cadence > MAX_CADENCE_DAYS) continue;

    const amountAbs = median(rows.map((r) => Math.abs(r.amount_cents)));
    const last = rows[rows.length - 1]!.posted_at;
    const next = addDays(last, cadence);
    const daysUntil = Math.round((Date.parse(next) - todayMs) / MS_PER_DAY);
    if (daysUntil < 0 || daysUntil > horizonDays) continue;

    out.push({
      merchant_id,
      merchant_name: rows[0]!.merchant_name!,
      amount_cents: amountAbs,
      last_seen: last,
      next_due: next,
      days_until: daysUntil,
      cadence_days: cadence,
      occurrences: rows.length,
      category_group: rows[rows.length - 1]!.group ?? 'essentials',
    });
  }

  out.sort((a, b) => a.next_due.localeCompare(b.next_due));
  return out;
}

export type PaydayPrediction = {
  next_due: string;
  days_until: number;
  amount_cents: number;
};

// Use the latest pay_period to predict the next payday: end_date is the day
// before the next deposit, so payday = end_date + 1.
export function predictNextPayday(
  latestPeriod: { end_date: string; paycheque_cents: number } | null,
  today: string,
  horizonDays: number,
): PaydayPrediction | null {
  if (!latestPeriod) return null;
  const next = addDays(latestPeriod.end_date, 1);
  const daysUntil = Math.round((Date.parse(next) - Date.parse(today)) / MS_PER_DAY);
  if (daysUntil < 0 || daysUntil > horizonDays) return null;
  return { next_due: next, days_until: daysUntil, amount_cents: latestPeriod.paycheque_cents };
}
