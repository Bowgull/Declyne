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
  const { results } = await env.DB.prepare(
    `SELECT id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value,
            severity, account_id_linked
     FROM debts
     WHERE archived = 0
     ORDER BY severity, principal_cents`,
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

  const period = await env.DB.prepare(
    `SELECT paycheque_cents FROM pay_periods
     WHERE start_date <= date('now')
     ORDER BY start_date DESC LIMIT 1`,
  ).first<{ paycheque_cents: number }>();
  const paycheque_cents = period?.paycheque_cents ?? 0;

  let essentials = await readNumberSetting(env, 'essentials_monthly_cents', 0);
  if (essentials <= 0) essentials = await readNumberSetting(env, 'essentials_monthly_cents_derived', 0);
  const essentials_per_paycheque = Math.round((essentials * 12) / 26);

  const indulgence_monthly = await readNumberSetting(env, 'indulgence_allowance_cents', 0);
  const indulgence_per_paycheque = Math.round((indulgence_monthly * 12) / 26);

  const charge_velocity_per_debt_cents = await computeChargeVelocity(env, debt_rows);

  return {
    debts,
    paycheque_cents,
    essentials_per_paycheque,
    indulgence_per_paycheque,
    charge_velocity_per_debt_cents,
    debt_rows,
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

planRoutes.get('/', async (c) => {
  const b = await loadPlanInputs(c.env);
  const out = runPlan(b);
  const hash = hashPlanInputs(b);
  const cache = await readLatestCache(c.env, hash);

  return c.json({
    plan: out,
    inputs: {
      paycheque_cents: b.paycheque_cents,
      essentials_baseline_cents: b.essentials_per_paycheque,
      indulgence_allowance_cents: b.indulgence_per_paycheque,
      charge_velocity_per_debt_cents: b.charge_velocity_per_debt_cents,
      debt_count: b.debts.length,
    },
    rationale: cache?.rationale_text ?? null,
    observations: cache?.observations_json ? safeParseArray(cache.observations_json) : [],
    rationale_generated_at: cache?.generated_at ?? null,
    rationale_source: cache?.source ?? null,
    inputs_hash: hash,
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
