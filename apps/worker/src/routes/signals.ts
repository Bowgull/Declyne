import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { computeBehaviour, type BehaviourInputs } from '../lib/behaviour.js';

export const signalsRoutes = new Hono<{ Bindings: Env }>();

signalsRoutes.get('/latest', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT * FROM behaviour_snapshots ORDER BY as_of DESC LIMIT 1`,
  ).first();
  return c.json({ snapshot: row ?? null });
});

signalsRoutes.get('/history', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM behaviour_snapshots ORDER BY as_of DESC LIMIT 30`,
  ).all();
  return c.json({ rows: results });
});

export async function computeAndStoreSignals(env: Env): Promise<{ id: string; snapshot: ReturnType<typeof computeBehaviour> }> {
  const asOf = nowIso().slice(0, 10);
  const inputs = await gatherInputs(env, asOf);
  const snap = computeBehaviour(inputs);
  const id = newId('bs');

  await env.DB.prepare(
    `INSERT INTO behaviour_snapshots
     (id, as_of, vice_ratio_bps, days_to_zero, cc_payoff_streak, subscription_creep_pct_bps,
      savings_increased_bool, vice_peak_day, review_queue_lag_days, reconciliation_streak)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      id,
      snap.as_of,
      snap.vice_ratio_bps,
      snap.days_to_zero,
      snap.cc_payoff_streak,
      snap.subscription_creep_pct_bps,
      snap.savings_increased_bool,
      snap.vice_peak_day,
      snap.review_queue_lag_days,
      snap.reconciliation_streak,
    )
    .run();

  await writeEditLog(env, [
    {
      entity_type: 'behaviour_snapshot',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(snap),
      actor: 'system',
      reason: 'behaviour_compute',
    },
  ]);

  return { id, snapshot: snap };
}

async function gatherInputs(env: Env, asOf: string): Promise<BehaviourInputs> {
  const spendByGroup = await env.DB.prepare(
    `SELECT c."group" as g, COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END),0) as s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date(?, '-30 days')
     GROUP BY c."group"`,
  )
    .bind(asOf)
    .all<{ g: string; s: number }>();
  const vice = spendByGroup.results.find((r) => r.g === 'vice')?.s ?? 0;
  const lifestyle = spendByGroup.results.find((r) => r.g === 'lifestyle')?.s ?? 0;

  const chequingRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(t.amount_cents),0) as bal
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.type = 'chequing' AND a.archived = 0`,
  ).first<{ bal: number }>();
  const chequing_balance_cents = chequingRow?.bal ?? 0;

  const burnRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END),0) as s
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.type = 'chequing' AND t.posted_at >= date(?, '-30 days')`,
  )
    .bind(asOf)
    .first<{ s: number }>();
  const avg_daily_burn_cents = Math.round((burnRow?.s ?? 0) / 30);

  const subsRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END),0) as s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c.name = 'subscriptions' AND t.posted_at >= date(?, '-30 days')`,
  )
    .bind(asOf)
    .first<{ s: number }>();
  const subs3Row = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END),0) as s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c.name = 'subscriptions' AND t.posted_at >= date(?, '-120 days') AND t.posted_at < date(?, '-30 days')`,
  )
    .bind(asOf, asOf)
    .first<{ s: number }>();
  const subs_this_month_cents = subsRow?.s ?? 0;
  const subs_3mo_avg_cents = Math.round((subs3Row?.s ?? 0) / 3);

  const sav7 = await env.DB.prepare(
    `SELECT COALESCE(SUM(t.amount_cents),0) as s
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.type = 'savings' AND t.posted_at >= date(?, '-7 days')`,
  )
    .bind(asOf)
    .first<{ s: number }>();
  const savPrior = await env.DB.prepare(
    `SELECT COALESCE(SUM(t.amount_cents),0) as s
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.type = 'savings' AND t.posted_at >= date(?, '-14 days') AND t.posted_at < date(?, '-7 days')`,
  )
    .bind(asOf, asOf)
    .first<{ s: number }>();

  const viceWeekday = await env.DB.prepare(
    `SELECT CAST(strftime('%w', t.posted_at) AS INTEGER) as d,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END),0) as s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'vice' AND t.posted_at >= date(?, '-90 days')
     GROUP BY d`,
  )
    .bind(asOf)
    .all<{ d: number; s: number }>();
  const vice_by_weekday_cents = [0, 0, 0, 0, 0, 0, 0];
  for (const r of viceWeekday.results) vice_by_weekday_cents[r.d] = r.s;

  const reviewRow = await env.DB.prepare(
    `SELECT MIN(t.created_at) as c FROM review_queue rq
     JOIN transactions t ON t.id = rq.transaction_id
     WHERE rq.resolved_at IS NULL`,
  ).first<{ c: string | null }>();

  const streakRow = await env.DB.prepare(
    `SELECT value FROM settings WHERE key = 'reconciliation_streak'`,
  ).first<{ value: string }>();
  const ccStreakRow = await env.DB.prepare(
    `SELECT value FROM settings WHERE key = 'cc_payoff_streak'`,
  ).first<{ value: string }>();

  return {
    as_of: asOf,
    vice_spend_cents_30d: vice,
    lifestyle_spend_cents_30d: lifestyle,
    chequing_balance_cents,
    avg_daily_burn_cents,
    cc_payoff_streak: Number(ccStreakRow?.value ?? '0'),
    subs_this_month_cents,
    subs_3mo_avg_cents,
    savings_7d_cents: sav7?.s ?? 0,
    savings_prior_7d_cents: savPrior?.s ?? 0,
    vice_by_weekday_cents,
    oldest_unresolved_review_created_at: reviewRow?.c ?? null,
    reconciliation_streak: Number(streakRow?.value ?? '0'),
  };
}

signalsRoutes.post('/compute', async (c) => {
  const out = await computeAndStoreSignals(c.env);
  return c.json(out);
});
