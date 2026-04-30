import { Hono } from 'hono';
import type { Env } from '../env.js';
import {
  computePlan,
  type PlanDebtInput,
  type DebtSeverity,
  type PlanOutput,
} from '../lib/paymentPlan.js';
import { newId, nowIso } from '../lib/ids.js';
import { redactSensitive } from '../lib/logRedact.js';
import { writeEditLog } from '../lib/editlog.js';
import {
  loadPaycheckInputs,
  computePaycheckCommitments,
  essentialsBaselineForKernel,
  type CommittedLine,
} from '../lib/periodIntelligence.js';
import { maybeUnlockVocabulary } from '../lib/vocabularyMilestone.js';

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

interface PlanInputsBundle {
  debts: PlanDebtInput[];
  paycheque_cents: number;
  essentials_per_paycheque: number;
  indulgence_per_paycheque: number;
  charge_velocity_per_debt_cents: Record<string, number>;
  debt_rows: DebtRow[];
  // Session 72: forward-looking commitment breakdown that fed essentials_per_paycheque.
  // Kept on the bundle so /api/plan can surface it without a second route round-trip.
  commitment_lines: CommittedLine[];
  bills_cents: number;
  savings_cents: number;
  essentials_variable_baseline_cents: number;
  lifestyle_baseline_cents: number;
}

// Rate limit on AI rationale calls. Pure cache reads are free.
const PLAN_REFRESH_LIMIT_PER_HOUR = 10;

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

async function loadPlanInputs(env: Env): Promise<PlanInputsBundle> {
  // Session 72: switched from 90d essentials average to forward-looking
  // commitments via periodIntelligence. The kernel now sees real bills due
  // this paycheque + savings sweeps + lifestyle baseline as its essentials
  // baseline, not a stale rolling average.
  const inputs = await loadPaycheckInputs(env);

  if (!inputs) {
    // Pre-onboarding: no period yet. Fall back to debts + settings only.
    const { results } = await env.DB.prepare(
      `SELECT id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value,
              severity, account_id_linked
       FROM debts WHERE archived = 0 ORDER BY severity, principal_cents`,
    ).all<DebtRow>();
    const debt_rows = (results ?? []) as DebtRow[];
    const debts: PlanDebtInput[] = debt_rows.map((r) => ({
      id: r.id,
      name: r.name,
      principal_cents: r.principal_cents,
      interest_rate_bps: r.interest_rate_bps,
      min_payment_type: r.min_payment_type,
      min_payment_value: r.min_payment_value,
      severity: r.severity,
    }));
    let essentials = await readNumberSetting(env, 'essentials_monthly_cents', 0);
    if (essentials <= 0) essentials = await readNumberSetting(env, 'essentials_monthly_cents_derived', 0);
    const essentials_per_paycheque = Math.round((essentials * 12) / 26);
    const indulgence_monthly = await readNumberSetting(env, 'indulgence_allowance_cents', 0);
    const indulgence_per_paycheque = Math.round((indulgence_monthly * 12) / 26);
    const charge_velocity_per_debt_cents = await computeChargeVelocity(env, debt_rows);
    return {
      debts,
      paycheque_cents: 0,
      essentials_per_paycheque,
      indulgence_per_paycheque,
      charge_velocity_per_debt_cents,
      debt_rows,
      commitment_lines: [],
      bills_cents: 0,
      savings_cents: 0,
      essentials_variable_baseline_cents: 0,
      lifestyle_baseline_cents: 0,
    };
  }

  const debts = inputs.debt_rows.map((r) => r.plan_input);
  const debt_rows = inputs.debt_rows.map(
    ({ id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value, severity, account_id_linked }) => ({
      id,
      name,
      principal_cents,
      interest_rate_bps,
      min_payment_type,
      min_payment_value,
      severity,
      account_id_linked,
    }),
  );

  const committed = computePaycheckCommitments({
    bills: inputs.bills,
    debt_mins: inputs.debt_mins,
    savings_goals: inputs.savings_goals,
    recurring_savings: inputs.recurring_savings,
  });

  const essentials_per_paycheque = essentialsBaselineForKernel({
    bills_cents: committed.bills_cents,
    savings_cents: committed.savings_cents,
    essentials_variable_baseline_cents: inputs.essentials_variable_baseline_cents,
    lifestyle_baseline_cents: inputs.lifestyle_baseline_cents,
  });

  return {
    debts,
    paycheque_cents: inputs.period.paycheque_cents,
    essentials_per_paycheque,
    indulgence_per_paycheque: inputs.indulgence_per_paycheque_cents,
    charge_velocity_per_debt_cents: inputs.charge_velocity_per_debt_cents,
    debt_rows,
    commitment_lines: committed.lines,
    bills_cents: committed.bills_cents,
    savings_cents: committed.savings_cents,
    essentials_variable_baseline_cents: inputs.essentials_variable_baseline_cents,
    lifestyle_baseline_cents: inputs.lifestyle_baseline_cents,
  };
}

function runPlan(b: PlanInputsBundle): PlanOutput {
  return computePlan({
    debts: b.debts,
    paycheque_cents: b.paycheque_cents,
    essentials_baseline_cents: b.essentials_per_paycheque,
    indulgence_allowance_cents: b.indulgence_per_paycheque,
    charge_velocity_per_debt_cents: b.charge_velocity_per_debt_cents,
  });
}

// Pure: stable hash of the inputs that affect the plan. Sorted, scalar-only.
export function hashPlanInputs(b: PlanInputsBundle): string {
  const debts = [...b.debts]
    .sort((a, c) => (a.id < c.id ? -1 : 1))
    .map((d) => [d.id, d.principal_cents, d.interest_rate_bps, d.severity, d.min_payment_type, d.min_payment_value].join(':'));
  const vel = Object.keys(b.charge_velocity_per_debt_cents)
    .sort()
    .map((k) => `${k}=${b.charge_velocity_per_debt_cents[k]}`);
  return [
    `pq:${b.paycheque_cents}`,
    `es:${b.essentials_per_paycheque}`,
    `in:${b.indulgence_per_paycheque}`,
    `d:${debts.join('|')}`,
    `v:${vel.join('|')}`,
  ].join(';');
}

interface CacheRow {
  id: string;
  generated_at: string;
  inputs_hash: string;
  plan_json: string;
  rationale_text: string | null;
  observations_json: string | null;
  source: 'ai' | 'manual' | 'pending';
}

async function readLatestCache(env: Env, hash: string): Promise<CacheRow | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM plan_cache WHERE inputs_hash = ? ORDER BY generated_at DESC LIMIT 1`,
  ).bind(hash).first<CacheRow>();
  return row ?? null;
}

interface CurrentPeriodRow {
  id: string;
  start_date: string;
  end_date: string;
}

async function loadCurrentPeriod(env: Env): Promise<CurrentPeriodRow | null> {
  const r = await env.DB.prepare(
    `SELECT id, start_date, end_date FROM pay_periods
     WHERE start_date <= date('now')
     ORDER BY start_date DESC LIMIT 1`,
  ).first<CurrentPeriodRow>();
  return r ?? null;
}

interface CommittedRow {
  id: string;
  label: string;
  planned_cents: number;
  stamped_at: string | null;
  committed_at: string;
  plan_id: string;
}

export interface InstallmentRow {
  allocation_id: string;
  debt_name: string;
  amount_cents: number;
  due_date: string;
  status: 'paid' | 'pending';
  stamped_at: string | null;
}

interface CommittedSummary {
  plan_id: string;
  committed_at: string;
  pay_period_id: string;
  period_end_date: string;
  installment_count: number;
  total_cents: number;
  stamped_count: number;
  unstamped_count: number;
  installments: InstallmentRow[];
}

// Pure: strips trailing role label from a period_allocation label so the
// debt name surfaces cleanly (e.g. "Capital One avalanche" → "Capital One").
export function stripRoleSuffix(label: string): string {
  return label.replace(/\s+(priority|avalanche|min)\s*$/i, '').trim();
}

async function loadCommittedForPeriod(
  env: Env,
  periodId: string,
  periodEndDate: string,
): Promise<CommittedSummary | null> {
  const { results } = await env.DB.prepare(
    `SELECT id, label, planned_cents, stamped_at, committed_at, plan_id
     FROM period_allocations
     WHERE pay_period_id = ?
       AND category_group = 'debt'
       AND committed_at IS NOT NULL
       AND plan_id IS NOT NULL`,
  ).bind(periodId).all<CommittedRow>();
  const rows = results ?? [];
  if (rows.length === 0) return null;
  // Most recent commit wins if user re-accepts after a refresh.
  const latest = rows.reduce((acc, r) => (r.committed_at > acc.committed_at ? r : acc), rows[0]!);
  const same = rows.filter((r) => r.plan_id === latest.plan_id);

  const installments: InstallmentRow[] = same.map((r) => ({
    allocation_id: r.id,
    debt_name: stripRoleSuffix(r.label),
    amount_cents: r.planned_cents,
    due_date: periodEndDate,
    status: r.stamped_at != null ? 'paid' : 'pending',
    stamped_at: r.stamped_at,
  }));

  return {
    plan_id: latest.plan_id,
    committed_at: latest.committed_at,
    pay_period_id: periodId,
    period_end_date: periodEndDate,
    installment_count: same.length,
    total_cents: same.reduce((s, r) => s + r.planned_cents, 0),
    stamped_count: same.filter((r) => r.stamped_at != null).length,
    unstamped_count: same.filter((r) => r.stamped_at == null).length,
    installments,
  };
}

planRoutes.get('/', async (c) => {
  const b = await loadPlanInputs(c.env);
  const out = runPlan(b);
  const hash = hashPlanInputs(b);
  const cache = await readLatestCache(c.env, hash);
  const period = await loadCurrentPeriod(c.env);
  const committed = period ? await loadCommittedForPeriod(c.env, period.id, period.end_date) : null;

  return c.json({
    plan: out,
    inputs: {
      paycheque_cents: b.paycheque_cents,
      essentials_baseline_cents: b.essentials_per_paycheque,
      indulgence_allowance_cents: b.indulgence_per_paycheque,
      charge_velocity_per_debt_cents: b.charge_velocity_per_debt_cents,
      debt_count: b.debts.length,
      // Session 72: surface the breakdown so the Plan page (and future
      // Paycheque page) can show why capacity is what it is.
      bills_cents: b.bills_cents,
      savings_cents: b.savings_cents,
      essentials_variable_baseline_cents: b.essentials_variable_baseline_cents,
      lifestyle_baseline_cents: b.lifestyle_baseline_cents,
      commitment_lines: b.commitment_lines,
    },
    rationale: cache?.rationale_text ?? null,
    observations: cache?.observations_json ? safeParseArray(cache.observations_json) : [],
    rationale_generated_at: cache?.generated_at ?? null,
    rationale_source: cache?.source ?? null,
    inputs_hash: hash,
    current_period_id: period?.id ?? null,
    committed,
  });
});

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  } catch {
    /* fall through */
  }
  return [];
}

// Pure: validates the AI response shape. AI must not invent numbers — this
// helper just checks string-only content + bounds. The kernel owns dollars.
export function validateAiRationale(raw: unknown): { rationale: string; observations: string[] } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'shape' };
  const o = raw as Record<string, unknown>;
  const rationale = typeof o.rationale === 'string' ? o.rationale.trim() : '';
  if (!rationale) return { error: 'rationale empty' };
  if (rationale.length > 800) return { error: 'rationale too long' };
  const obsRaw = o.observations;
  const observations: string[] = [];
  if (Array.isArray(obsRaw)) {
    for (const x of obsRaw.slice(0, 3)) {
      if (typeof x === 'string') {
        const t = x.trim();
        if (t && t.length <= 240) observations.push(t);
      }
    }
  }
  return { rationale, observations };
}

planRoutes.post('/refresh', async (c) => {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM plan_cache WHERE generated_at >= ? AND source = 'ai'`,
  ).bind(since).first<{ n: number }>();
  if ((recent?.n ?? 0) >= PLAN_REFRESH_LIMIT_PER_HOUR) {
    return c.json({ error: 'rate_limited', limit: PLAN_REFRESH_LIMIT_PER_HOUR, window: 'hour' }, 429);
  }

  const b = await loadPlanInputs(c.env);
  const out = runPlan(b);
  const hash = hashPlanInputs(b);

  // Build the AI payload. AI sees deterministic numbers we already computed.
  // It writes prose. Every dollar in the response must already be in the input.
  const aiPayload = {
    capacity_cents: out.capacity_cents,
    savings_cents: out.savings_cents,
    total_interest_cents: out.total_interest_cents,
    baseline_total_interest_cents: out.baseline_total_interest_cents,
    debts: b.debts.map((d) => ({
      name: d.name,
      principal_cents: d.principal_cents,
      apr_bps: d.interest_rate_bps,
      severity: d.severity,
      monthly_velocity_cents: b.charge_velocity_per_debt_cents[d.id] ?? 0,
      payoff_months: out.payoff_months[d.id],
      next_paycheque_payment_cents: out.next_paycheque_allocations
        .filter((a) => a.debt_id === d.id)
        .reduce((s, a) => s + a.amount_cents, 0),
    })),
  };

  const systemPrompt = `You write the rationale for Declyne's payment plan. One user.

Rules:
1. You never compute or invent numbers. Every dollar figure you mention must appear in the input payload exactly as given.
2. Output JSON: { "rationale": string (1-3 sentences, under 600 chars), "observations": string[] (0-3 short habit observations, each under 200 chars) }.
3. Tone: dry, direct, observed. No hype, no encouragement, no emojis, no em dashes.
4. Frame priority debts (in_collections, charged_off, past_due) as "we're paying these first because they're already damaged."
5. Frame avalanche debts as "highest APR drains capacity fastest."
6. If a debt has charge velocity > 0, you may note "this card is still being charged ~$X/mo" using the input number.
7. Observations describe habits or patterns from the input. No financial advice. No "you should."
8. If capacity is 0, the rationale is "no overflow this paycheque, mins only." No observations.`;

  const id = newId('pcache');
  const now = nowIso();

  // Pre-write a 'pending' row so a failed OpenAI call still leaves audit trail.
  await c.env.DB.prepare(
    `INSERT INTO plan_cache (id, generated_at, inputs_hash, plan_json, rationale_text, observations_json, source)
     VALUES (?,?,?,?,NULL,NULL,'pending')`,
  ).bind(id, now, hash, JSON.stringify(out)).run();

  let rationale = '';
  let observations: string[] = [];

  if (out.capacity_cents <= 0) {
    rationale = 'No overflow this paycheque. Mins only.';
    observations = [];
  } else {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(aiPayload) },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error('plan_refresh_openai_error', redactSensitive(err));
      return c.json({ error: 'openai_error' }, 502);
    }

    const ai = (await openaiRes.json()) as { choices: Array<{ message: { content: string } }> };
    const content = ai.choices[0]?.message.content ?? '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return c.json({ error: 'ai_bad_json' }, 502);
    }
    const v = validateAiRationale(parsed);
    if ('error' in v) return c.json({ error: 'ai_invalid', detail: v.error }, 502);
    rationale = v.rationale;
    observations = v.observations;
  }

  await c.env.DB.prepare(
    `UPDATE plan_cache SET rationale_text = ?, observations_json = ?, source = 'ai' WHERE id = ?`,
  ).bind(rationale, JSON.stringify(observations), id).run();

  return c.json({
    id,
    generated_at: now,
    plan: out,
    rationale,
    observations,
    inputs_hash: hash,
  });
});

// Accept the current plan: stamps every debt allocation in the current
// pay period with the plan's cache id + a committed_at timestamp. Idempotent
// on (period, hash) — re-accepting after a refresh just rewrites the plan_id.
planRoutes.post('/accept', async (c) => {
  const period = await loadCurrentPeriod(c.env);
  if (!period) return c.json({ error: 'no_current_period' }, 400);

  const b = await loadPlanInputs(c.env);
  const out = runPlan(b);
  const hash = hashPlanInputs(b);
  const now = nowIso();

  // Reuse a matching cache row when one exists; otherwise snapshot.
  let cache = await readLatestCache(c.env, hash);
  if (!cache) {
    const id = newId('pcache');
    await c.env.DB.prepare(
      `INSERT INTO plan_cache (id, generated_at, inputs_hash, plan_json, rationale_text, observations_json, source)
       VALUES (?,?,?,?,NULL,NULL,'manual')`,
    ).bind(id, now, hash, JSON.stringify(out)).run();
    cache = { id, generated_at: now, inputs_hash: hash, plan_json: JSON.stringify(out), rationale_text: null, observations_json: null, source: 'manual' };
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, plan_id, committed_at FROM period_allocations
     WHERE pay_period_id = ? AND category_group = 'debt'`,
  ).bind(period.id).all<{ id: string; plan_id: string | null; committed_at: string | null }>();
  const rows = results ?? [];
  if (rows.length === 0) return c.json({ error: 'no_debt_allocations', period_id: period.id }, 400);

  await c.env.DB.batch(
    rows.map((r) =>
      c.env.DB.prepare(
        `UPDATE period_allocations SET plan_id = ?, committed_at = ? WHERE id = ?`,
      ).bind(cache.id, now, r.id),
    ),
  );

  await writeEditLog(
    c.env,
    rows.map((r) => ({
      entity_type: 'period_allocation',
      entity_id: r.id,
      field: 'committed_at',
      old_value: r.committed_at,
      new_value: now,
      actor: 'user' as const,
      reason: 'plan_accept',
    })),
  );

  const vocabularyUnlock = await maybeUnlockVocabulary(c.env, 4).catch(() => null);

  return c.json({
    plan_id: cache.id,
    committed_at: now,
    pay_period_id: period.id,
    installments_committed: rows.length,
    ...(vocabularyUnlock ? { vocabulary_unlock: vocabularyUnlock } : {}),
  });
});

// Release the current commitment for this period. Clears plan_id +
// committed_at on every debt allocation. Already-stamped rows (paid) keep
// their stamped_at; releasing only undoes the commitment, not the payment.
planRoutes.post('/release', async (c) => {
  const period = await loadCurrentPeriod(c.env);
  if (!period) return c.json({ error: 'no_current_period' }, 400);

  const { results } = await c.env.DB.prepare(
    `SELECT id, plan_id, committed_at FROM period_allocations
     WHERE pay_period_id = ? AND category_group = 'debt' AND committed_at IS NOT NULL`,
  ).bind(period.id).all<{ id: string; plan_id: string | null; committed_at: string }>();
  const rows = results ?? [];
  if (rows.length === 0) return c.json({ released: 0, pay_period_id: period.id });

  await c.env.DB.batch(
    rows.map((r) =>
      c.env.DB.prepare(
        `UPDATE period_allocations SET plan_id = NULL, committed_at = NULL WHERE id = ?`,
      ).bind(r.id),
    ),
  );

  await writeEditLog(
    c.env,
    rows.map((r) => ({
      entity_type: 'period_allocation',
      entity_id: r.id,
      field: 'committed_at',
      old_value: r.committed_at,
      new_value: null,
      actor: 'user' as const,
      reason: 'plan_release',
    })),
  );

  return c.json({ released: rows.length, pay_period_id: period.id });
});
