import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { projectGoalCompletion, projectGoalWithCuts, type GoalWhatIf } from '../lib/forecast.js';
import { loadHabitContext } from './habits.js';

export const goalsRoutes = new Hono<{ Bindings: Env }>();

export const GOAL_TYPES = ['emergency', 'vacation', 'rrsp', 'tfsa', 'fhsa', 'car', 'other'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

function isGoalType(v: unknown): v is GoalType {
  return typeof v === 'string' && (GOAL_TYPES as readonly string[]).includes(v);
}

type GoalRow = {
  id: string;
  name: string;
  target_cents: number;
  target_date: string;
  linked_account_id: string | null;
  progress_cents: number;
  archived: number;
  goal_type: GoalType;
};

export type GoalInput = {
  name: string;
  target_cents: number;
  target_date: string;
  linked_account_id: string | null;
  progress_cents: number;
  goal_type: GoalType;
};

export type GoalPatch = Partial<GoalInput> & { archived?: 0 | 1 };

function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseGoalInput(raw: unknown): GoalInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { error: 'name required' };
  if (name.length > 120) return { error: 'name too long' };

  const target_cents = Number(b.target_cents);
  if (!Number.isFinite(target_cents) || target_cents <= 0 || target_cents > 1_000_000_00) {
    return { error: 'target_cents must be 1..100000000' };
  }

  if (!isYmd(b.target_date)) return { error: 'target_date must be YYYY-MM-DD' };

  let linked_account_id: string | null = null;
  if (typeof b.linked_account_id === 'string' && b.linked_account_id.trim()) {
    linked_account_id = b.linked_account_id.trim();
  }

  const progressRaw = b.progress_cents === undefined || b.progress_cents === null ? 0 : Number(b.progress_cents);
  if (!Number.isFinite(progressRaw) || progressRaw < 0 || progressRaw > 1_000_000_00) {
    return { error: 'progress_cents must be 0..100000000' };
  }

  const goal_type: GoalType = isGoalType(b.goal_type) ? b.goal_type : 'other';

  return {
    name: name.slice(0, 120),
    target_cents: Math.round(target_cents),
    target_date: b.target_date as string,
    linked_account_id,
    progress_cents: Math.round(progressRaw),
    goal_type,
  };
}

export function parseGoalPatch(raw: unknown): GoalPatch | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body required' };
  const b = raw as Record<string, unknown>;
  const out: GoalPatch = {};

  if ('name' in b) {
    if (typeof b.name !== 'string') return { error: 'name must be string' };
    const v = b.name.trim();
    if (!v) return { error: 'name required' };
    if (v.length > 120) return { error: 'name too long' };
    out.name = v;
  }
  if ('target_cents' in b) {
    const n = Number(b.target_cents);
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_00) return { error: 'target_cents must be 1..100000000' };
    out.target_cents = Math.round(n);
  }
  if ('target_date' in b) {
    if (!isYmd(b.target_date)) return { error: 'target_date must be YYYY-MM-DD' };
    out.target_date = b.target_date as string;
  }
  if ('linked_account_id' in b) {
    const v = b.linked_account_id;
    if (v === null || v === '') out.linked_account_id = null;
    else if (typeof v === 'string') out.linked_account_id = v.trim() || null;
    else return { error: 'linked_account_id must be string or null' };
  }
  if ('progress_cents' in b) {
    const n = Number(b.progress_cents);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_00) return { error: 'progress_cents must be 0..100000000' };
    out.progress_cents = Math.round(n);
  }
  if ('archived' in b) {
    out.archived = b.archived === true || b.archived === 1 ? 1 : 0;
  }
  if ('goal_type' in b) {
    if (!isGoalType(b.goal_type)) return { error: 'goal_type invalid' };
    out.goal_type = b.goal_type;
  }
  return out;
}

goalsRoutes.get('/', async (c) => {
  const includeArchived = c.req.query('include_archived') === '1';
  const where = includeArchived ? '' : 'WHERE archived = 0';
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, target_cents, target_date, linked_account_id, progress_cents, archived, goal_type
     FROM goals ${where}
     ORDER BY archived ASC, target_date ASC, name ASC`,
  ).all<GoalRow>();

  // Projection: derive next_payday from latest pay_period (bi-weekly cadence).
  // Per-paycheque allocation = remaining / periods-until-target-date, mirroring
  // the loadActiveGoals heuristic in periodIntelligence.
  const period = await c.env.DB.prepare(
    `SELECT end_date FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ end_date: string }>();
  const next_payday = period
    ? new Date(Date.parse(period.end_date) + 86_400_000).toISOString().slice(0, 10)
    : null;
  const todayMs = Date.now();
  const todayIso = new Date(todayMs).toISOString().slice(0, 10);

  // Habit context drives the per-goal what-if cuts. Best-effort: failure
  // leaves what_if = [] on every goal, never breaks the route.
  let acceleratingSubs: { sub: string; monthly_burn_cents: number; velocity: 'accelerating' | 'steady' | 'cooling' }[] = [];
  try {
    const ctx = await loadHabitContext(c.env, todayIso);
    acceleratingSubs = ctx.by_sub_category
      .filter((r) => r.velocity === 'accelerating')
      .map((r) => ({ sub: r.sub, monthly_burn_cents: r.monthly_burn_cents, velocity: r.velocity }));
  } catch {
    acceleratingSubs = [];
  }

  const goals = (results ?? []).map((g) => {
    const remaining = Math.max(0, g.target_cents - g.progress_cents);
    const daysRem = Math.max(14, Math.round((Date.parse(g.target_date) - todayMs) / 86_400_000));
    const periodsRem = Math.max(1, Math.round(daysRem / 14));
    const per_paycheque_cents = Math.ceil(remaining / periodsRem);
    const projected_complete_date = projectGoalCompletion({
      remaining_cents: remaining,
      per_paycheque_cents,
      next_payday,
      cadence_days: 14,
    });
    const what_if: GoalWhatIf[] = g.archived
      ? []
      : projectGoalWithCuts({
          remaining_cents: remaining,
          per_paycheque_cents,
          next_payday,
          cadence_days: 14,
          current_complete_date: projected_complete_date,
          subs: acceleratingSubs,
        });
    return {
      ...g,
      per_paycheque_cents,
      projected_complete_date,
      what_if,
    };
  });

  return c.json({ goals });
});

goalsRoutes.post('/', async (c) => {
  const parsed = parseGoalInput(await c.req.json().catch(() => null));
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const id = newId('goal');
  await c.env.DB.prepare(
    `INSERT INTO goals (id, name, target_cents, target_date, linked_account_id, progress_cents, archived, goal_type)
     VALUES (?,?,?,?,?,?,0,?)`,
  )
    .bind(
      id,
      parsed.name,
      parsed.target_cents,
      parsed.target_date,
      parsed.linked_account_id,
      parsed.progress_cents,
      parsed.goal_type,
    )
    .run();

  await writeEditLog(c.env, [
    {
      entity_type: 'goal',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(parsed),
      actor: 'user',
      reason: 'goal_create',
    },
  ]);

  return c.json({ id });
});

goalsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = parseGoalPatch(await c.req.json().catch(() => null));
  if ('error' in patch) return c.json({ error: patch.error }, 400);

  const existing = await c.env.DB.prepare(
    `SELECT id, name, target_cents, target_date, linked_account_id, progress_cents, archived, goal_type FROM goals WHERE id = ?`,
  )
    .bind(id)
    .first<GoalRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const logs: Parameters<typeof writeEditLog>[1] = [];

  const fields: Array<keyof GoalPatch> = [
    'name',
    'target_cents',
    'target_date',
    'linked_account_id',
    'progress_cents',
    'archived',
    'goal_type',
  ];
  for (const f of fields) {
    if (patch[f] === undefined) continue;
    const oldVal = (existing as Record<string, unknown>)[f];
    const newVal = patch[f] as unknown;
    if (oldVal === newVal) continue;
    updates.push(`${f} = ?`);
    values.push(newVal);
    logs.push({
      entity_type: 'goal',
      entity_id: id,
      field: f,
      old_value: oldVal === null ? null : String(oldVal),
      new_value: newVal === null ? null : String(newVal),
      actor: 'user',
      reason: 'goal_update',
    });
  }

  if (!updates.length) return c.json({ ok: true, changed: 0 });

  await c.env.DB.prepare(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  await writeEditLog(c.env, logs);

  return c.json({ ok: true, changed: updates.length });
});

// ----------------------------------------------------------------------------
// Smart suggestion: returns a sensible target + per-paycheque amount + the
// teaching copy that explains why. The user can type over either number — the
// caption stays so they learn what the math means.
// ----------------------------------------------------------------------------

export interface GoalSuggestion {
  goal_type: GoalType;
  name: string;
  target_cents: number;
  per_paycheque_cents: number;
  why_target: string;
  why_paycheque: string;
}

interface SuggestionInputs {
  paycheque_cents: number;        // bi-weekly net pay
  essentials_monthly_cents: number; // 90d-derived or manually set
  tfsa_room_cents: number;          // remaining contribution room this year
  fhsa_room_cents: number;
  rrsp_room_cents: number | null;   // null when prior-year T4 isn't known
}

const PAYCHEQUES_PER_YEAR = 26;

function annualNetIncome(paycheque_cents: number): number {
  return paycheque_cents * PAYCHEQUES_PER_YEAR;
}

export function computeGoalSuggestion(
  type: GoalType,
  inputs: SuggestionInputs,
): GoalSuggestion {
  const pc = inputs.paycheque_cents;
  const essMonthly = inputs.essentials_monthly_cents;
  const annual = annualNetIncome(pc);

  switch (type) {
    case 'emergency': {
      const target = essMonthly * 3;
      const per = Math.round(pc * 0.05);
      return {
        goal_type: type,
        name: 'Emergency Fund',
        target_cents: Math.max(target, 100000),
        per_paycheque_cents: Math.max(per, 1000),
        why_target:
          essMonthly > 0
            ? `three months of your essentials spend (~$${(essMonthly / 100).toFixed(0)}/mo). The cushion you keep so a surprise bill doesn't become a credit card.`
            : `three months of essentials. The cushion you keep so a surprise bill doesn't become a credit card.`,
        why_paycheque:
          pc > 0
            ? `5% of your $${(pc / 100).toFixed(0)} paycheque. Reaches your target in roughly 26 paycheques.`
            : `5% of your paycheque. Reaches your target in roughly 26 paycheques.`,
      };
    }
    case 'vacation':
      return {
        goal_type: type,
        name: 'Vacation',
        target_cents: 300000,
        per_paycheque_cents: Math.max(Math.ceil(300000 / PAYCHEQUES_PER_YEAR), 1000),
        why_target: 'a typical mid-range trip for one. Edit to taste.',
        why_paycheque: 'reaches $3,000 in roughly 26 paycheques. Drop it lower to stretch the timeline.',
      };
    case 'rrsp': {
      const target = Math.round(annual * 0.04);
      const per = Math.round(pc * 0.04);
      return {
        goal_type: type,
        name: 'Retirement (RRSP)',
        target_cents: Math.max(target, 100000),
        per_paycheque_cents: Math.max(per, 2000),
        why_target:
          inputs.rrsp_room_cents !== null
            ? `4% of your income. Your room this year is roughly $${(inputs.rrsp_room_cents / 100).toFixed(0)} (last year's T4).`
            : `4% of your income. A starter contribution that gets you into the habit. Your room is much higher; this is what fits the budget.`,
        why_paycheque:
          'splits the target across 26 paycheques. RRSP contributions reduce your taxable income, so this also lowers your taxes next year.',
      };
    }
    case 'tfsa': {
      const room = inputs.tfsa_room_cents;
      const target = room > 0 ? Math.min(room, Math.round(annual * 0.04)) : Math.round(annual * 0.04);
      const per = Math.max(Math.ceil(target / PAYCHEQUES_PER_YEAR), 2000);
      return {
        goal_type: type,
        name: 'Tax-Free Savings (TFSA)',
        target_cents: Math.max(target, 100000),
        per_paycheque_cents: per,
        why_target:
          room > 0
            ? `your TFSA room this year is $${(room / 100).toFixed(0)}. Money inside grows tax-free.`
            : `4% of your paycheque. Money inside a TFSA grows tax-free and you can pull it out anytime, no tax.`,
        why_paycheque: `every paycheque. Money inside a TFSA grows tax-free and you can pull it out anytime, no tax.`,
      };
    }
    case 'fhsa': {
      const room = inputs.fhsa_room_cents;
      const target = room > 0 ? room : 800000;
      const per = Math.ceil(target / PAYCHEQUES_PER_YEAR);
      return {
        goal_type: type,
        name: 'First Home (FHSA)',
        target_cents: target,
        per_paycheque_cents: per,
        why_target: `your remaining FHSA room. Combines RRSP-style tax deduction with TFSA-style tax-free withdrawal, but only for a first home.`,
        why_paycheque: `fills your room across 26 paycheques. Unused room rolls forward, max $40,000 lifetime.`,
      };
    }
    case 'car':
      return {
        goal_type: type,
        name: 'Car',
        target_cents: 800000,
        per_paycheque_cents: Math.ceil(800000 / PAYCHEQUES_PER_YEAR),
        why_target: `a typical down payment on a used reliable car. Edit for what you're actually shopping for.`,
        why_paycheque: 'reaches $8,000 in roughly 26 paycheques. Lower it if the timeline can stretch.',
      };
    case 'other':
    default:
      return {
        goal_type: 'other',
        name: 'Goal',
        target_cents: 100000,
        per_paycheque_cents: 5000,
        why_target: 'placeholder. Set your own target.',
        why_paycheque: 'placeholder. Set your own contribution.',
      };
  }
}

goalsRoutes.get('/suggest', async (c) => {
  const t = c.req.query('type');
  if (!isGoalType(t)) return c.json({ error: 'type invalid' }, 400);

  // Latest pay-period for paycheque amount.
  const period = await c.env.DB.prepare(
    `SELECT paycheque_cents FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ paycheque_cents: number }>();
  const paycheque_cents = period?.paycheque_cents ?? 0;

  // Essentials monthly: prefer manual setting, fall back to derived.
  const essRow = await c.env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN ('essentials_monthly_cents','essentials_monthly_cents_derived')`,
  ).all<{ key: string; value: string }>();
  const essMap = new Map<string, string>();
  (essRow.results ?? []).forEach((r) => essMap.set(r.key, r.value));
  const essRaw = essMap.get('essentials_monthly_cents') ?? essMap.get('essentials_monthly_cents_derived') ?? '0';
  const essentials_monthly_cents = Number(essRaw) || 0;

  // Tax-year room (CAD limits 2026 — keep in sync with taxYear.ts).
  const TFSA_LIMIT = 700000;
  const FHSA_LIMIT = 800000;
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const contribRows = await c.env.DB.prepare(
    `SELECT a.path AS path, COALESCE(SUM(jl.debit_cents - jl.credit_cents),0) AS contrib
     FROM gl_accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE (a.path LIKE 'Assets:Investments:TFSA:%'
         OR a.path LIKE 'Assets:Investments:FHSA:%')
       AND (je.posted_at IS NULL OR je.posted_at >= ?)
     GROUP BY a.path`,
  )
    .bind(yearStart)
    .all<{ path: string; contrib: number }>();
  let tfsaContrib = 0;
  let fhsaContrib = 0;
  (contribRows.results ?? []).forEach((r) => {
    if (r.path?.startsWith('Assets:Investments:TFSA:')) tfsaContrib += r.contrib;
    else if (r.path?.startsWith('Assets:Investments:FHSA:')) fhsaContrib += r.contrib;
  });
  const tfsa_room_cents = Math.max(0, TFSA_LIMIT - tfsaContrib);
  const fhsa_room_cents = Math.max(0, FHSA_LIMIT - fhsaContrib);

  const suggestion = computeGoalSuggestion(t, {
    paycheque_cents,
    essentials_monthly_cents,
    tfsa_room_cents,
    fhsa_room_cents,
    rrsp_room_cents: null,
  });

  return c.json({ suggestion, inputs: {
    paycheque_cents,
    essentials_monthly_cents,
    tfsa_room_cents,
    fhsa_room_cents,
  } });
});
