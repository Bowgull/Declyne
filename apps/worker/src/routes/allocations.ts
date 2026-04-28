import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { detectRecurring, type RecurringTxn } from '../lib/recurring.js';
import {
  draftAllocations,
  diffDraft,
  type DraftAllocation,
  type DraftDebt,
  type DraftGoal,
  type DraftRecurring,
  type DraftPlanDebt,
} from '../lib/allocationSeed.js';
import {
  computePlan,
  type PlanDebtInput,
  type DebtSeverity,
  type PlanRole,
} from '../lib/paymentPlan.js';
import {
  loadPaycheckInputs,
  computePaycheckCommitments,
  essentialsBaselineForKernel,
} from '../lib/periodIntelligence.js';
import { maybeUnlockVocabulary } from '../lib/vocabularyMilestone.js';

export const allocationsRoutes = new Hono<{ Bindings: Env }>();

const GROUPS = new Set(['essentials', 'lifestyle', 'debt', 'savings', 'indulgence']);

async function readNumberSettingFromAlloc(env: Env, key: string, fallback: number): Promise<number> {
  const r = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string | null }>();
  if (!r?.value) return fallback;
  const n = Number(r.value);
  return Number.isFinite(n) ? n : fallback;
}

type AllocRow = {
  id: string;
  pay_period_id: string;
  category_group: string;
  label: string;
  planned_cents: number;
  matched_txn_id: string | null;
  stamped_at: string | null;
  stamped_by: string | null;
  created_at: string;
};

export type AllocInput = { category_group: string; label: string; planned_cents: number };
export type AllocPatch = Partial<AllocInput>;

export function parseAllocInput(raw: unknown): AllocInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;
  const g = typeof b.category_group === 'string' ? b.category_group : '';
  if (!GROUPS.has(g)) return { error: 'category_group invalid' };
  const label = typeof b.label === 'string' ? b.label.trim() : '';
  if (!label) return { error: 'label required' };
  if (label.length > 80) return { error: 'label too long' };
  const planned = Number(b.planned_cents);
  if (!Number.isFinite(planned) || planned < 0 || planned > 1_000_000_00) {
    return { error: 'planned_cents must be 0..100000000' };
  }
  return { category_group: g, label, planned_cents: Math.round(planned) };
}

export function parseAllocPatch(raw: unknown): AllocPatch | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;
  const out: AllocPatch = {};
  if ('category_group' in b) {
    if (typeof b.category_group !== 'string' || !GROUPS.has(b.category_group)) {
      return { error: 'category_group invalid' };
    }
    out.category_group = b.category_group;
  }
  if ('label' in b) {
    if (typeof b.label !== 'string') return { error: 'label must be string' };
    const v = b.label.trim();
    if (!v) return { error: 'label required' };
    if (v.length > 80) return { error: 'label too long' };
    out.label = v;
  }
  if ('planned_cents' in b) {
    const n = Number(b.planned_cents);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_00) return { error: 'planned_cents invalid' };
    out.planned_cents = Math.round(n);
  }
  return out;
}

allocationsRoutes.get('/', async (c) => {
  const periodId = c.req.query('pay_period_id');
  let period: { id: string; start_date: string; end_date: string; paycheque_cents: number } | null;
  if (periodId) {
    period = await c.env.DB.prepare(
      `SELECT id, start_date, end_date, paycheque_cents FROM pay_periods WHERE id = ?`,
    )
      .bind(periodId)
      .first();
  } else {
    period = await c.env.DB.prepare(
      `SELECT id, start_date, end_date, paycheque_cents FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
    ).first();
  }
  if (!period) return c.json({ period: null, rows: [], totals: null });

  const { results } = await c.env.DB.prepare(
    `SELECT id, pay_period_id, category_group, label, planned_cents, matched_txn_id, stamped_at, stamped_by, created_at
     FROM period_allocations WHERE pay_period_id = ? ORDER BY category_group, planned_cents DESC`,
  )
    .bind(period.id)
    .all<AllocRow>();

  const assigned = results.reduce((s, r) => s + r.planned_cents, 0);
  const stamped = results.filter((r) => r.stamped_at).reduce((s, r) => s + r.planned_cents, 0);
  const unassigned = period.paycheque_cents - assigned;

  return c.json({
    period,
    rows: results,
    totals: {
      paycheque_cents: period.paycheque_cents,
      assigned_cents: assigned,
      unassigned_cents: unassigned,
      stamped_cents: stamped,
    },
  });
});

allocationsRoutes.post('/', async (c) => {
  const periodId = c.req.query('pay_period_id');
  const period = periodId
    ? await c.env.DB.prepare(`SELECT id FROM pay_periods WHERE id = ?`).bind(periodId).first<{ id: string }>()
    : await c.env.DB.prepare(`SELECT id FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`).first<{ id: string }>();
  if (!period) return c.json({ error: 'no pay period' }, 400);

  const parsed = parseAllocInput(await c.req.json().catch(() => null));
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const id = newId('alloc');
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO period_allocations (id, pay_period_id, category_group, label, planned_cents, matched_txn_id, stamped_at, stamped_by, created_at)
     VALUES (?,?,?,?,?,NULL,NULL,NULL,?)`,
  )
    .bind(id, period.id, parsed.category_group, parsed.label, parsed.planned_cents, now)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'period_allocation',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify({ pay_period_id: period.id, ...parsed }),
      actor: 'user',
      reason: 'allocation_create',
    },
  ]);
  return c.json({ id });
});

const ALLOC_PATCH_FIELDS: ReadonlyArray<keyof AllocPatch> = ['category_group', 'label', 'planned_cents'];

allocationsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = parseAllocPatch(await c.req.json().catch(() => null));
  if ('error' in patch) return c.json({ error: patch.error }, 400);
  const existing = await c.env.DB.prepare(
    `SELECT * FROM period_allocations WHERE id = ?`,
  )
    .bind(id)
    .first<AllocRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const logs: Parameters<typeof writeEditLog>[1] = [];
  for (const f of ALLOC_PATCH_FIELDS) {
    if (patch[f] === undefined) continue;
    const oldVal = (existing as Record<string, unknown>)[f];
    const newVal = patch[f] as unknown;
    if (oldVal === newVal) continue;
    updates.push(`${f} = ?`);
    values.push(newVal);
    logs.push({
      entity_type: 'period_allocation',
      entity_id: id,
      field: f,
      old_value: String(oldVal ?? ''),
      new_value: String(newVal ?? ''),
      actor: 'user',
      reason: 'allocation_update',
    });
  }
  if (!updates.length) return c.json({ ok: true, changed: 0 });
  await c.env.DB.prepare(`UPDATE period_allocations SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  await writeEditLog(c.env, logs);
  return c.json({ ok: true, changed: updates.length });
});

allocationsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM period_allocations WHERE id = ?`)
    .bind(id)
    .first<AllocRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  await c.env.DB.prepare(`DELETE FROM period_allocations WHERE id = ?`).bind(id).run();
  await writeEditLog(c.env, [
    {
      entity_type: 'period_allocation',
      entity_id: id,
      field: 'delete',
      old_value: JSON.stringify(existing),
      new_value: null,
      actor: 'user',
      reason: 'allocation_delete',
    },
  ]);
  return c.json({ ok: true });
});

// Stamp paid (manual). Idempotent — second stamp is a no-op.
allocationsRoutes.post('/:id/stamp', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { matched_txn_id?: string | null };
  const existing = await c.env.DB.prepare(`SELECT * FROM period_allocations WHERE id = ?`)
    .bind(id)
    .first<AllocRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  if (existing.stamped_at) return c.json({ ok: true, already: true });
  const now = nowIso();
  const matched = body.matched_txn_id ?? null;
  await c.env.DB.prepare(
    `UPDATE period_allocations SET stamped_at = ?, stamped_by = 'user', matched_txn_id = ? WHERE id = ?`,
  )
    .bind(now, matched, id)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'period_allocation',
      entity_id: id,
      field: 'stamped_at',
      old_value: null,
      new_value: now,
      actor: 'user',
      reason: 'allocation_stamp',
    },
  ]);
  const vocabularyUnlock =
    existing.category_group === 'debt'
      ? await maybeUnlockVocabulary(c.env, 3).catch(() => null)
      : null;
  return c.json({ ok: true, ...(vocabularyUnlock ? { vocabulary_unlock: vocabularyUnlock } : {}) });
});

// Unstamp (mistake recovery).
allocationsRoutes.post('/:id/unstamp', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM period_allocations WHERE id = ?`)
    .bind(id)
    .first<AllocRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  if (!existing.stamped_at) return c.json({ ok: true, already: true });
  await c.env.DB.prepare(
    `UPDATE period_allocations SET stamped_at = NULL, stamped_by = NULL, matched_txn_id = NULL WHERE id = ?`,
  )
    .bind(id)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'period_allocation',
      entity_id: id,
      field: 'stamped_at',
      old_value: existing.stamped_at,
      new_value: null,
      actor: 'user',
      reason: 'allocation_unstamp',
    },
  ]);
  return c.json({ ok: true });
});

// Draft: additive (never overwrites stamped/edited rows). Idempotent — same
// inputs produce zero new rows on second call.
allocationsRoutes.post('/draft', async (c) => {
  const period = await c.env.DB.prepare(
    `SELECT id, start_date, end_date FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; start_date: string; end_date: string }>();
  if (!period) return c.json({ error: 'no pay period' }, 400);

  const inserted = await draftForPeriod(c.env, period.id);
  return c.json({ pay_period_id: period.id, inserted });
});

// Auto-match: scan unmatched outflows in the period, find unique
// (label-by-amount + linked-account where applicable + ±3d window) matches
// against unstamped rows. Ambiguous matches are skipped (surface in
// Reconciliation later). Idempotent.
allocationsRoutes.post('/auto-match', async (c) => {
  const period = await c.env.DB.prepare(
    `SELECT id, start_date, end_date FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; start_date: string; end_date: string }>();
  if (!period) return c.json({ matched: 0 });
  const matched = await autoMatchAllocations(c.env, period.id);
  return c.json({ matched });
});

// ---- helpers used by import.ts and routes above ----

export async function draftForPeriod(env: Env, periodId: string): Promise<number> {
  // Existing rows for diffing.
  const { results: existing } = await env.DB.prepare(
    `SELECT category_group, label, stamped_at FROM period_allocations WHERE pay_period_id = ?`,
  )
    .bind(periodId)
    .all<{ category_group: string; label: string; stamped_at: string | null }>();

  // Recurring bills from past 90d using the same detector as Today.
  const { results: txns } = await env.DB.prepare(
    `SELECT t.posted_at, t.amount_cents, t.merchant_id, m.display_name as merchant_name, c."group" as "group"
     FROM transactions t
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now','-90 days')`,
  ).all<RecurringTxn>();
  const today = new Date().toISOString().slice(0, 10);
  const recurring = detectRecurring(txns, today, 31);
  const recurringInputs: DraftRecurring[] = recurring
    .filter((r) => r.merchant_name)
    .map((r) => {
      const raw = txns.find((t) => t.merchant_id === r.merchant_id);
      const grp = (raw?.group ?? 'essentials') as DraftRecurring['group'];
      return {
        merchant_id: r.merchant_id,
        merchant_name: r.merchant_name,
        amount_cents: r.amount_cents,
        group: grp === 'essentials' || grp === 'lifestyle' || grp === 'debt' || grp === 'transfer' ? grp : 'essentials',
      };
    });

  // Debt allocations come from the plan kernel: mins + priority/avalanche extras.
  const { results: debts } = await env.DB.prepare(
    `SELECT id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value, severity, account_id_linked
     FROM debts WHERE archived = 0`,
  ).all<{
    id: string;
    name: string;
    principal_cents: number;
    interest_rate_bps: number;
    min_payment_type: 'fixed' | 'percent';
    min_payment_value: number;
    severity: DebtSeverity;
    account_id_linked: string | null;
  }>();
  const planDebtInputs: PlanDebtInput[] = debts.map((d) => ({
    id: d.id,
    name: d.name,
    principal_cents: d.principal_cents,
    interest_rate_bps: d.interest_rate_bps,
    min_payment_type: d.min_payment_type,
    min_payment_value: d.min_payment_value,
    severity: d.severity,
  }));
  // Fall-through: if no debts, leave debt rows empty.
  let planDebts: DraftPlanDebt[] = [];
  if (planDebtInputs.length > 0) {
    // Session 72: kernel now sees real upcoming bills + savings + lifestyle
    // baseline as essentials, not a 90d rolling average. Same intelligence
    // that powers /api/paycheque so the drafter and the plan view agree.
    const inputs = await loadPaycheckInputs(env);
    let paycheque_cents = 0;
    let essentials_per_paycheque = 0;
    let indulgence_per_paycheque = 0;
    let velocity: Record<string, number> = {};
    if (inputs && inputs.period.id === periodId) {
      const committed = computePaycheckCommitments({
        bills: inputs.bills,
        debt_mins: inputs.debt_mins,
        savings_goals: inputs.savings_goals,
        recurring_savings: inputs.recurring_savings,
      });
      paycheque_cents = inputs.period.paycheque_cents;
      essentials_per_paycheque = essentialsBaselineForKernel({
        bills_cents: committed.bills_cents,
        savings_cents: committed.savings_cents,
        lifestyle_baseline_cents: inputs.lifestyle_baseline_cents,
      });
      indulgence_per_paycheque = inputs.indulgence_per_paycheque_cents;
      velocity = inputs.charge_velocity_per_debt_cents;
    } else {
      // Drafting for a non-current period (rare): fall back to the legacy
      // settings-based essentials so the kernel still has plausible inputs.
      const periodRow = await env.DB.prepare(
        `SELECT paycheque_cents FROM pay_periods WHERE id = ?`,
      ).bind(periodId).first<{ paycheque_cents: number }>();
      paycheque_cents = periodRow?.paycheque_cents ?? 0;
      let essMonthly = await readNumberSettingFromAlloc(env, 'essentials_monthly_cents', 0);
      if (essMonthly <= 0) essMonthly = await readNumberSettingFromAlloc(env, 'essentials_monthly_cents_derived', 0);
      essentials_per_paycheque = Math.round((essMonthly * 12) / 26);
      const indMonthly = await readNumberSettingFromAlloc(env, 'indulgence_allowance_cents', 0);
      indulgence_per_paycheque = Math.round((indMonthly * 12) / 26);
      for (const d of debts) {
        if (!d.account_id_linked) { velocity[d.id] = 0; continue; }
        const r = await env.DB.prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) AS s FROM transactions
           WHERE account_id = ? AND amount_cents < 0 AND posted_at >= date('now','-90 days')`,
        ).bind(d.account_id_linked).first<{ s: number }>();
        velocity[d.id] = Math.round(Math.abs(r?.s ?? 0) / 3);
      }
    }

    const out = computePlan({
      debts: planDebtInputs,
      paycheque_cents,
      essentials_baseline_cents: essentials_per_paycheque,
      indulgence_allowance_cents: indulgence_per_paycheque,
      charge_velocity_per_debt_cents: velocity,
    });

    // Aggregate per-debt: sum amount across roles, pick the dominant non-min
    // role to label the row. ('priority' beats 'avalanche' if both somehow appear.)
    const sumPerDebt = new Map<string, { name: string; total: number; role: PlanRole }>();
    for (const a of out.next_paycheque_allocations) {
      const cur = sumPerDebt.get(a.debt_id);
      if (!cur) {
        sumPerDebt.set(a.debt_id, { name: a.debt_name, total: a.amount_cents, role: a.role });
      } else {
        cur.total += a.amount_cents;
        // Promote role: priority > avalanche > min
        const rank = (r: PlanRole) => (r === 'priority' ? 2 : r === 'avalanche' ? 1 : 0);
        if (rank(a.role) > rank(cur.role)) cur.role = a.role;
      }
    }
    planDebts = Array.from(sumPerDebt.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      total_cents: v.total,
      role: v.role,
    }));
  }
  // Legacy DraftDebt list kept for the fall-back branch (empty here since plan_debts is set).
  const debtInputs: DraftDebt[] = [];

  // Goals: contribution_per_period = (target - progress) spread across remaining
  // pay periods until target_date. Approximate periods as days_remaining / 14.
  const { results: goals } = await env.DB.prepare(
    `SELECT id, name, target_cents, target_date, progress_cents FROM goals WHERE archived = 0`,
  ).all<{ id: string; name: string; target_cents: number; target_date: string; progress_cents: number }>();
  const goalInputs: DraftGoal[] = goals.map((g) => {
    const daysRem = Math.max(14, Math.round((Date.parse(g.target_date) - Date.now()) / 86_400_000));
    const periodsRem = Math.max(1, Math.round(daysRem / 14));
    const remaining = Math.max(0, g.target_cents - g.progress_cents);
    return { id: g.id, name: g.name, monthly_contribution_cents: Math.ceil(remaining / periodsRem) };
  });

  // Last period's actual indulgence as buffer carry-forward.
  const prev = await env.DB.prepare(
    `SELECT start_date, end_date FROM pay_periods WHERE id != ? ORDER BY start_date DESC LIMIT 1`,
  )
    .bind(periodId)
    .first<{ start_date: string; end_date: string }>();
  let lastIndulgence = 0;
  if (prev) {
    const r = await env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE c."group" = 'indulgence' AND t.posted_at BETWEEN ? AND ?`,
    )
      .bind(prev.start_date, prev.end_date)
      .first<{ s: number }>();
    lastIndulgence = r?.s ?? 0;
  }

  const draft = draftAllocations({
    debts: debtInputs,
    goals: goalInputs,
    recurring: recurringInputs,
    last_period_indulgence_cents: lastIndulgence,
    plan_debts: planDebts,
  });
  const fresh = diffDraft(existing, draft);
  if (fresh.length === 0) return 0;

  const now = nowIso();
  const inserts = fresh.map((d) => ({ id: newId('alloc'), ...d }));
  await env.DB.batch(
    inserts.map((r) =>
      env.DB.prepare(
        `INSERT INTO period_allocations (id, pay_period_id, category_group, label, planned_cents, matched_txn_id, stamped_at, stamped_by, created_at)
         VALUES (?,?,?,?,?,NULL,NULL,NULL,?)`,
      ).bind(r.id, periodId, r.category_group, r.label, r.planned_cents, now),
    ),
  );
  await writeEditLog(
    env,
    inserts.map((r) => ({
      entity_type: 'period_allocation',
      entity_id: r.id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify({ pay_period_id: periodId, ...r }),
      actor: 'rules' as const,
      reason: 'allocation_draft',
    })),
  );
  return inserts.length;
}

export async function autoMatchAllocations(env: Env, periodId: string): Promise<number> {
  const period = await env.DB.prepare(
    `SELECT id, start_date, end_date FROM pay_periods WHERE id = ?`,
  )
    .bind(periodId)
    .first<{ id: string; start_date: string; end_date: string }>();
  if (!period) return 0;

  const { results: rows } = await env.DB.prepare(
    `SELECT id, category_group, label, planned_cents FROM period_allocations
     WHERE pay_period_id = ? AND stamped_at IS NULL`,
  )
    .bind(periodId)
    .all<{ id: string; category_group: string; label: string; planned_cents: number }>();
  if (rows.length === 0) return 0;

  const startMs = Date.parse(period.start_date);
  const endMs = Date.parse(period.end_date) + 86_400_000;
  const winStart = new Date(startMs - 3 * 86_400_000).toISOString().slice(0, 10);
  const winEnd = new Date(endMs + 3 * 86_400_000).toISOString().slice(0, 10);

  const { results: txns } = await env.DB.prepare(
    `SELECT t.id, t.posted_at, t.amount_cents, m.display_name as merchant_name
     FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id
     WHERE t.posted_at BETWEEN ? AND ? AND t.amount_cents < 0
       AND t.id NOT IN (SELECT matched_txn_id FROM period_allocations WHERE matched_txn_id IS NOT NULL)`,
  )
    .bind(winStart, winEnd)
    .all<{ id: string; posted_at: string; amount_cents: number; merchant_name: string | null }>();

  let matched = 0;
  const now = nowIso();
  const usedTxn = new Set<string>();

  for (const r of rows) {
    const candidates = txns.filter(
      (t) => !usedTxn.has(t.id) && Math.abs(t.amount_cents) === r.planned_cents,
    );
    if (candidates.length !== 1) continue;
    const t = candidates[0]!;
    usedTxn.add(t.id);
    await env.DB.prepare(
      `UPDATE period_allocations SET stamped_at = ?, stamped_by = 'csv_match', matched_txn_id = ? WHERE id = ?`,
    )
      .bind(now, t.id, r.id)
      .run();
    await writeEditLog(env, [
      {
        entity_type: 'period_allocation',
        entity_id: r.id,
        field: 'stamped_at',
        old_value: null,
        new_value: now,
        actor: 'rules',
        reason: 'allocation_auto_match',
      },
    ]);
    matched++;
  }
  return matched;
}
