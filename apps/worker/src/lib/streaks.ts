// Phase streak computation. Walks historical pay periods and credit snapshots,
// writes derived streak counts to settings so evaluatePhase can promote.
// Pure helpers below are exported for tests; the DB orchestrator runs nightly.

import type { Env } from '../env.js';
import { writeEditLog } from './editlog.js';

export interface PeriodRow {
  id: string;
  start_date: string;
  end_date: string;
  income_cents: number;
  essentials_spend_cents: number;
}

export interface CreditSnapshotRow {
  as_of: string;
  utilization_bps: number;
  on_time_streak_days: number;
}

export function countLeadingTrue(flags: boolean[]): number {
  let n = 0;
  for (const f of flags) {
    if (!f) break;
    n++;
  }
  return n;
}

export function essentialsCoveredStreak(periods: PeriodRow[]): number {
  // periods ordered newest first. A period counts if income >= essentials spend.
  // Uncovered periods have essentials_spend > 0 and income < essentials_spend.
  return countLeadingTrue(
    periods.map((p) => p.income_cents >= p.essentials_spend_cents),
  );
}

export function utilizationUnder30Streak(snapshots: CreditSnapshotRow[]): number {
  // snapshots ordered newest first. Threshold: utilization_bps < 3000 (30%).
  return countLeadingTrue(snapshots.map((s) => s.utilization_bps < 3000));
}

export function rollingEssentialsMonthlyCents(
  essentials90dSpendCents: number,
): number {
  return Math.round(essentials90dSpendCents / 3);
}

export interface CcPeriodRow {
  paid_cents: number;
  spent_cents: number;
}

export function ccPayoffStreak(periods: CcPeriodRow[]): number {
  // Period counts if paid_cents > 0 and paid_cents >= spent_cents.
  // Dormant periods (no payment, no spend) do not count: a streak requires evidence of payoff behaviour.
  return countLeadingTrue(
    periods.map((p) => p.paid_cents > 0 && p.paid_cents >= p.spent_cents),
  );
}

export interface DebtCycleDef {
  debt_id: string;
  principal_cents: number;
  min_payment_type: 'fixed' | 'percent';
  min_payment_value: number;
  payment_due_date: number;
}

export interface DebtPaymentPoint {
  amount_cents: number;
  posted_at: string;
}

export function requiredMinPaymentCents(d: DebtCycleDef): number {
  if (d.min_payment_type === 'fixed') return Math.max(0, d.min_payment_value);
  const pct = Math.round((d.principal_cents * d.min_payment_value) / 10_000);
  return Math.max(1000, pct);
}

function clampDayOfMonth(year: number, month0: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(Math.max(1, day), lastDay);
}

export function findLastMissedMinPayment(
  debts: Array<DebtCycleDef & { payments: DebtPaymentPoint[] }>,
  today: Date,
  lookbackMonths = 6,
): string | null {
  let latest: string | null = null;
  const todayMs = today.getTime();
  for (const d of debts) {
    const req = requiredMinPaymentCents(d);
    if (req <= 0) continue;
    for (let i = lookbackMonths; i >= 1; i--) {
      const anchor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      const y = anchor.getUTCFullYear();
      const m = anchor.getUTCMonth();
      const day = clampDayOfMonth(y, m, d.payment_due_date);
      const dueMs = Date.UTC(y, m, day);
      if (dueMs > todayMs) continue;
      const windowStart = dueMs - 35 * 86_400_000;
      let paid = 0;
      for (const p of d.payments) {
        const iso = p.posted_at.slice(0, 10);
        const t = Date.UTC(
          Number(iso.slice(0, 4)),
          Number(iso.slice(5, 7)) - 1,
          Number(iso.slice(8, 10)),
        );
        if (t >= windowStart && t <= dueMs) paid += p.amount_cents;
      }
      if (paid < req) {
        const iso = new Date(dueMs).toISOString().slice(0, 10);
        if (!latest || iso > latest) latest = iso;
      }
    }
  }
  return latest;
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

async function writeSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)`).bind(key, value).run();
}

export interface StreakComputeResult {
  essentials_covered_streak_periods: number;
  utilization_under_30_streak_statements: number;
  on_time_streak_days: number;
  essentials_monthly_cents: number;
  cc_payoff_streak: number;
  last_missed_min_payment_date: string | null;
  periods_considered: number;
  credit_snapshots_considered: number;
  cc_debts_considered: number;
}

export async function computeAndStoreStreaks(env: Env): Promise<StreakComputeResult> {
  // Essentials streak: walk pay_periods newest to oldest.
  const periodRows = await env.DB.prepare(
    `SELECT id, start_date, end_date FROM pay_periods ORDER BY end_date DESC LIMIT 24`,
  ).all<{ id: string; start_date: string; end_date: string }>();

  const periods: PeriodRow[] = [];
  for (const p of periodRows.results) {
    const income = await env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0) as s
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.type = 'chequing' AND a.archived = 0
         AND t.posted_at >= ? AND t.posted_at <= ?`,
    )
      .bind(p.start_date, p.end_date)
      .first<{ s: number }>();

    const essentials = await env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE c."group" = 'essentials'
         AND t.posted_at >= ? AND t.posted_at <= ?`,
    )
      .bind(p.start_date, p.end_date)
      .first<{ s: number }>();

    periods.push({
      id: p.id,
      start_date: p.start_date,
      end_date: p.end_date,
      income_cents: income?.s ?? 0,
      essentials_spend_cents: essentials?.s ?? 0,
    });
  }

  const essentialsStreak = essentialsCoveredStreak(periods);

  // Utilization + on-time streaks: credit_snapshots, newest first.
  const credit = await env.DB.prepare(
    `SELECT as_of, utilization_bps, on_time_streak_days
     FROM credit_snapshots ORDER BY as_of DESC LIMIT 24`,
  ).all<CreditSnapshotRow>();

  const utilStreak = utilizationUnder30Streak(credit.results);
  const onTimeDays = credit.results[0]?.on_time_streak_days ?? 0;

  // Essentials monthly cents: keep manual setting if present, else rolling 90d / 3.
  const manual = await readSetting(env, 'essentials_monthly_cents');
  let essentialsMonthly = manual ? Number(manual) : 0;
  if (!manual) {
    const row = await env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE c."group" = 'essentials' AND t.posted_at >= date('now', '-90 days')`,
    ).first<{ s: number }>();
    essentialsMonthly = rollingEssentialsMonthlyCents(row?.s ?? 0);
  }

  // CC payoff streak: per period, compare debt_payments to CC-linked debts vs CC-account spend.
  const ccDebts = await env.DB.prepare(
    `SELECT d.id as debt_id, d.account_id_linked as account_id
     FROM debts d JOIN accounts a ON a.id = d.account_id_linked
     WHERE d.archived = 0 AND a.type = 'credit'`,
  ).all<{ debt_id: string; account_id: string }>();
  const ccDebtIds = ccDebts.results.map((r) => r.debt_id);
  const ccAccountIds = ccDebts.results.map((r) => r.account_id);

  const ccPeriods: CcPeriodRow[] = [];
  for (const p of periods) {
    let paid = 0;
    if (ccDebtIds.length) {
      const placeholders = ccDebtIds.map(() => '?').join(',');
      const row = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as s FROM debt_payments
         WHERE debt_id IN (${placeholders}) AND posted_at >= ? AND posted_at <= ?`,
      )
        .bind(...ccDebtIds, p.start_date, p.end_date)
        .first<{ s: number }>();
      paid = row?.s ?? 0;
    }
    let spent = 0;
    if (ccAccountIds.length) {
      const placeholders = ccAccountIds.map(() => '?').join(',');
      const row = await env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0) as s
         FROM transactions WHERE account_id IN (${placeholders})
           AND posted_at >= ? AND posted_at <= ?`,
      )
        .bind(...ccAccountIds, p.start_date, p.end_date)
        .first<{ s: number }>();
      spent = row?.s ?? 0;
    }
    ccPeriods.push({ paid_cents: paid, spent_cents: spent });
  }
  const ccStreak = ccPayoffStreak(ccPeriods);

  // Missed min payment: walk last 6 cycles per debt.
  const debtsRows = await env.DB.prepare(
    `SELECT id as debt_id, principal_cents, min_payment_type, min_payment_value, payment_due_date
     FROM debts WHERE archived = 0`,
  ).all<DebtCycleDef>();
  const debtsForMiss: Array<DebtCycleDef & { payments: DebtPaymentPoint[] }> = [];
  for (const d of debtsRows.results) {
    const rows = await env.DB.prepare(
      `SELECT amount_cents, posted_at FROM debt_payments
       WHERE debt_id = ? AND posted_at >= date('now', '-220 days')
       ORDER BY posted_at`,
    )
      .bind(d.debt_id)
      .all<DebtPaymentPoint>();
    debtsForMiss.push({ ...d, payments: rows.results });
  }
  const lastMiss = findLastMissedMinPayment(debtsForMiss, new Date(), 6);

  // Persist.
  const prev = {
    essentials_covered_streak_periods: Number(await readSetting(env, 'essentials_covered_streak_periods') ?? '0'),
    utilization_under_30_streak_statements: Number(
      await readSetting(env, 'utilization_under_30_streak_statements') ?? '0',
    ),
    on_time_streak_days: Number(await readSetting(env, 'on_time_streak_days') ?? '0'),
    essentials_monthly_cents: Number(await readSetting(env, 'essentials_monthly_cents') ?? '0'),
    cc_payoff_streak: Number(await readSetting(env, 'cc_payoff_streak') ?? '0'),
    last_missed_min_payment_date: await readSetting(env, 'last_missed_min_payment_date'),
  };

  await writeSetting(env, 'essentials_covered_streak_periods', String(essentialsStreak));
  await writeSetting(env, 'utilization_under_30_streak_statements', String(utilStreak));
  await writeSetting(env, 'on_time_streak_days', String(onTimeDays));
  await writeSetting(env, 'cc_payoff_streak', String(ccStreak));
  if (!manual) await writeSetting(env, 'essentials_monthly_cents_derived', String(essentialsMonthly));
  if (lastMiss) {
    await writeSetting(env, 'last_missed_min_payment_date', lastMiss);
  } else if (prev.last_missed_min_payment_date) {
    await env.DB.prepare(`DELETE FROM settings WHERE key = 'last_missed_min_payment_date'`).run();
  }

  const changes: Parameters<typeof writeEditLog>[1] = [];
  const trackNum = (field: string, oldV: number, newV: number) => {
    if (oldV !== newV) {
      changes.push({
        entity_type: 'settings',
        entity_id: field,
        field,
        old_value: String(oldV),
        new_value: String(newV),
        actor: 'system',
        reason: 'streak_recompute',
      });
    }
  };
  trackNum('essentials_covered_streak_periods', prev.essentials_covered_streak_periods, essentialsStreak);
  trackNum('utilization_under_30_streak_statements', prev.utilization_under_30_streak_statements, utilStreak);
  trackNum('on_time_streak_days', prev.on_time_streak_days, onTimeDays);
  trackNum('cc_payoff_streak', prev.cc_payoff_streak, ccStreak);
  if ((prev.last_missed_min_payment_date ?? null) !== (lastMiss ?? null)) {
    changes.push({
      entity_type: 'settings',
      entity_id: 'last_missed_min_payment_date',
      field: 'last_missed_min_payment_date',
      old_value: prev.last_missed_min_payment_date ?? null,
      new_value: lastMiss ?? null,
      actor: 'system',
      reason: 'streak_recompute',
    });
  }
  if (changes.length) await writeEditLog(env, changes);

  return {
    essentials_covered_streak_periods: essentialsStreak,
    utilization_under_30_streak_statements: utilStreak,
    on_time_streak_days: onTimeDays,
    essentials_monthly_cents: essentialsMonthly,
    cc_payoff_streak: ccStreak,
    last_missed_min_payment_date: lastMiss,
    periods_considered: periods.length,
    credit_snapshots_considered: credit.results.length,
    cc_debts_considered: ccDebts.results.length,
  };
}
