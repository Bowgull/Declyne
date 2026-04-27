import { Hono } from 'hono';
import type { Env } from '../env.js';
import {
  computePlan,
  type PlanDebtInput,
  type DebtSeverity,
} from '../lib/paymentPlan.js';

export const planRoutes = new Hono<{ Bindings: Env }>();

interface DebtRow {
  id: string;
  name: string;
  principal_cents: number;
  interest_rate_bps: number;
  min_payment_type: 'fixed' | 'percent';
  min_payment_value: number;
  severity: DebtSeverity;
  account_id_linked: string | null;
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string | null }>();
  return r?.value ?? null;
}

async function readNumberSetting(env: Env, key: string, fallback: number): Promise<number> {
  const v = await readSetting(env, key);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// 90-day average monthly charge velocity per linked account. Charges are
// negative amounts (outflows from the bank account / additions to a CC liability).
// We treat the absolute value as "spend" and divide by 3 for a monthly figure.
async function computeChargeVelocity(env: Env, debts: DebtRow[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const d of debts) {
    if (!d.account_id_linked) {
      out[d.id] = 0;
      continue;
    }
    const r = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS sum_cents
       FROM transactions
       WHERE account_id = ?
         AND amount_cents < 0
         AND posted_at >= date('now', '-90 days')`,
    )
      .bind(d.account_id_linked)
      .first<{ sum_cents: number }>();
    const sum = r?.sum_cents ?? 0;
    out[d.id] = Math.round(Math.abs(sum) / 3);
  }
  return out;
}

planRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value,
            severity, account_id_linked
     FROM debts
     WHERE archived = 0
     ORDER BY severity, principal_cents`,
  ).all<DebtRow>();
  const debts: PlanDebtInput[] = (results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    principal_cents: r.principal_cents,
    interest_rate_bps: r.interest_rate_bps,
    min_payment_type: r.min_payment_type,
    min_payment_value: r.min_payment_value,
    severity: r.severity,
  }));

  // Latest paycheque (most recent past or current period).
  const period = await c.env.DB.prepare(
    `SELECT paycheque_cents FROM pay_periods
     WHERE start_date <= date('now')
     ORDER BY start_date DESC LIMIT 1`,
  ).first<{ paycheque_cents: number }>();
  const paycheque_cents = period?.paycheque_cents ?? 0;

  // Essentials baseline: manual setting first, then derived. Stored monthly;
  // the kernel runs per-month, so we pass it through unchanged.
  let essentials = await readNumberSetting(c.env, 'essentials_monthly_cents', 0);
  if (essentials <= 0) essentials = await readNumberSetting(c.env, 'essentials_monthly_cents_derived', 0);
  // Convert monthly -> per-paycheque (assume bi-weekly: 26 paycheques / 12 months).
  const essentials_per_paycheque = Math.round((essentials * 12) / 26);

  // Indulgence allowance: optional setting, default 0.
  const indulgence_monthly = await readNumberSetting(c.env, 'indulgence_allowance_cents', 0);
  const indulgence_per_paycheque = Math.round((indulgence_monthly * 12) / 26);

  const charge_velocity_per_debt_cents = await computeChargeVelocity(c.env, (results ?? []) as DebtRow[]);

  const out = computePlan({
    debts,
    paycheque_cents,
    essentials_baseline_cents: essentials_per_paycheque,
    indulgence_allowance_cents: indulgence_per_paycheque,
    charge_velocity_per_debt_cents,
  });

  return c.json({
    plan: out,
    inputs: {
      paycheque_cents,
      essentials_baseline_cents: essentials_per_paycheque,
      indulgence_allowance_cents: indulgence_per_paycheque,
      charge_velocity_per_debt_cents,
      debt_count: debts.length,
    },
  });
});
