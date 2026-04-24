// Phase transition runner. Loads current phase, gathers inputs from stored data
// and settings, runs the shared evaluatePhase, and writes phase_log + edit_log
// when the phase changes. Deterministic. No demotion.

import type { Env } from '../env.js';
import { evaluatePhase, type Phase, type PhaseInputs, type PhaseEvaluation } from '@declyne/shared';
import { newId, nowIso } from './ids.js';
import { writeEditLog } from './editlog.js';

async function readSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

async function readNumberSetting(env: Env, key: string, fallback: number): Promise<number> {
  const v = await readSetting(env, key);
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadCurrentPhase(env: Env): Promise<Phase> {
  const row = await env.DB.prepare(
    `SELECT phase FROM phase_log ORDER BY entered_at DESC LIMIT 1`,
  ).first<{ phase: number }>();
  if (row?.phase) return row.phase as Phase;
  const settingVal = await readNumberSetting(env, 'current_phase', 1);
  const p = Math.min(5, Math.max(1, Math.round(settingVal))) as Phase;
  return p;
}

export async function gatherPhaseInputs(env: Env): Promise<PhaseInputs> {
  const current_phase = await loadCurrentPhase(env);

  const essentials_covered_streak_periods = await readNumberSetting(env, 'essentials_covered_streak_periods', 0);
  const cc_payoff_streak_periods = await readNumberSetting(env, 'cc_payoff_streak', 0);
  const utilization_under_30_streak_statements = await readNumberSetting(env, 'utilization_under_30_streak_statements', 0);
  const on_time_streak_days = await readNumberSetting(env, 'on_time_streak_days', 0);

  const lastMissedIso = await readSetting(env, 'last_missed_min_payment_date');
  let missed_min_payment_days_ago: number | null = null;
  if (lastMissedIso) {
    const then = new Date(`${lastMissedIso.slice(0, 10)}T00:00:00Z`).getTime();
    const now = Date.now();
    missed_min_payment_days_ago = Math.max(0, Math.floor((now - then) / 86_400_000));
  }

  const currentDebtRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(principal_cents), 0) as s FROM debts WHERE archived = 0`,
  ).first<{ s: number }>();
  const currentNonMortgage = currentDebtRow?.s ?? 0;
  const phase2EntryDebt = await readNumberSetting(env, 'phase2_entry_non_mortgage_debt_cents', 0);
  const non_mortgage_debt_ratio_to_phase2_entry =
    phase2EntryDebt <= 0 ? 1.0 : currentNonMortgage / phase2EntryDebt;

  const essentialsMonthly = await readNumberSetting(env, 'essentials_monthly_cents', 0);
  const liquidRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(t.amount_cents), 0) as bal
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.archived = 0 AND (a.type = 'chequing' OR a.type = 'savings')`,
  ).first<{ bal: number }>();
  const liquid = Math.max(0, liquidRow?.bal ?? 0);
  const buffer_months_essentials = essentialsMonthly <= 0 ? 0 : liquid / essentialsMonthly;

  const snapRow = await env.DB.prepare(
    `SELECT vice_ratio_bps FROM behaviour_snapshots ORDER BY as_of DESC LIMIT 1`,
  ).first<{ vice_ratio_bps: number }>();
  const vice_ratio_trailing_30d = snapRow ? (snapRow.vice_ratio_bps ?? 0) / 10_000 : 1.0;

  return {
    current_phase,
    essentials_covered_streak_periods,
    cc_payoff_streak_periods,
    non_mortgage_debt_ratio_to_phase2_entry,
    missed_min_payment_days_ago,
    utilization_under_30_streak_statements,
    on_time_streak_days,
    buffer_months_essentials,
    vice_ratio_trailing_30d,
  };
}

export interface PhaseTransitionResult {
  evaluated: PhaseEvaluation;
  inputs: PhaseInputs;
  transitioned: boolean;
  phase_log_id: string | null;
}

export async function evaluateAndRecordPhase(env: Env): Promise<PhaseTransitionResult> {
  const inputs = await gatherPhaseInputs(env);
  const evaluated = evaluatePhase(inputs);

  if (evaluated.next_phase === inputs.current_phase || !evaluated.rule_triggered) {
    return { evaluated, inputs, transitioned: false, phase_log_id: null };
  }

  const id = newId('ph');
  await env.DB.prepare(
    `INSERT INTO phase_log (id, phase, entered_at, trigger_rule, metrics_json) VALUES (?,?,?,?,?)`,
  )
    .bind(id, evaluated.next_phase, nowIso(), evaluated.rule_triggered, JSON.stringify(evaluated.metrics))
    .run();

  await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('current_phase', ?)`)
    .bind(String(evaluated.next_phase))
    .run();

  if (evaluated.next_phase === 2) {
    const existing = await readSetting(env, 'phase2_entry_non_mortgage_debt_cents');
    if (existing === null) {
      const currentDebtRow = await env.DB.prepare(
        `SELECT COALESCE(SUM(principal_cents), 0) as s FROM debts WHERE archived = 0`,
      ).first<{ s: number }>();
      await env.DB.prepare(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('phase2_entry_non_mortgage_debt_cents', ?)`,
      )
        .bind(String(currentDebtRow?.s ?? 0))
        .run();
    }
  }

  await writeEditLog(env, [
    {
      entity_type: 'phase',
      entity_id: id,
      field: 'phase',
      old_value: String(inputs.current_phase),
      new_value: String(evaluated.next_phase),
      actor: 'rules',
      reason: 'phase_transition_auto',
    },
  ]);

  return { evaluated, inputs, transitioned: true, phase_log_id: id };
}
