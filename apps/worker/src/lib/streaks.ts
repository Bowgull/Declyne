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
  periods_considered: number;
  credit_snapshots_considered: number;
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

  // Persist.
  const prev = {
    essentials_covered_streak_periods: Number(await readSetting(env, 'essentials_covered_streak_periods') ?? '0'),
    utilization_under_30_streak_statements: Number(
      await readSetting(env, 'utilization_under_30_streak_statements') ?? '0',
    ),
    on_time_streak_days: Number(await readSetting(env, 'on_time_streak_days') ?? '0'),
    essentials_monthly_cents: Number(await readSetting(env, 'essentials_monthly_cents') ?? '0'),
  };

  await writeSetting(env, 'essentials_covered_streak_periods', String(essentialsStreak));
  await writeSetting(env, 'utilization_under_30_streak_statements', String(utilStreak));
  await writeSetting(env, 'on_time_streak_days', String(onTimeDays));
  if (!manual) await writeSetting(env, 'essentials_monthly_cents_derived', String(essentialsMonthly));

  const changes: Parameters<typeof writeEditLog>[1] = [];
  const track = (field: string, oldV: number, newV: number) => {
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
  track('essentials_covered_streak_periods', prev.essentials_covered_streak_periods, essentialsStreak);
  track('utilization_under_30_streak_statements', prev.utilization_under_30_streak_statements, utilStreak);
  track('on_time_streak_days', prev.on_time_streak_days, onTimeDays);
  if (changes.length) await writeEditLog(env, changes);

  return {
    essentials_covered_streak_periods: essentialsStreak,
    utilization_under_30_streak_statements: utilStreak,
    on_time_streak_days: onTimeDays,
    essentials_monthly_cents: essentialsMonthly,
    periods_considered: periods.length,
    credit_snapshots_considered: credit.results.length,
  };
}
