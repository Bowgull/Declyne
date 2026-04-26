import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const reconciliationRoutes = new Hono<{ Bindings: Env }>();

// Pure helper for split <-> transaction ambiguity detection.
// A split is ambiguous when ≥2 candidate transactions match its expected
// signed amount within ±3 days of created_at.
//
// Sign rule mirrors autoMatchSplits in import.ts:
//   owes_josh   → expected = +remaining_cents (incoming)
//   josh_owes   → expected = -remaining_cents (outgoing)
export type SplitForMatch = {
  id: string;
  direction: 'owes_josh' | 'josh_owes';
  remaining_cents: number;
  created_at: string;
};

export type TxnForMatch = {
  id: string;
  posted_at: string;
  amount_cents: number;
};

export function expectedSignedAmount(direction: 'owes_josh' | 'josh_owes', remaining_cents: number): number {
  return direction === 'owes_josh' ? remaining_cents : -remaining_cents;
}

export function withinThreeDays(a: string, b: string): boolean {
  const da = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
  return Math.abs(da - db) <= 3 * 86_400_000;
}

export function findAmbiguousSplits<S extends SplitForMatch, T extends TxnForMatch>(
  splits: S[],
  txns: T[],
): Array<{ split: S; candidates: T[] }> {
  const out: Array<{ split: S; candidates: T[] }> = [];
  for (const s of splits) {
    const expected = expectedSignedAmount(s.direction, s.remaining_cents);
    const candidates = txns.filter(
      (t) => t.amount_cents === expected && withinThreeDays(t.posted_at, s.created_at),
    );
    if (candidates.length >= 2) out.push({ split: s, candidates });
  }
  return out;
}

export function isCandidateValid(split: SplitForMatch, txn: TxnForMatch): boolean {
  if (txn.amount_cents !== expectedSignedAmount(split.direction, split.remaining_cents)) return false;
  return withinThreeDays(txn.posted_at, split.created_at);
}

// Returns the most recent Sunday (>= today's day-of-week walks back).
// `today` must be YYYY-MM-DD. Output YYYY-MM-DD. Sunday counts as itself.
export function mostRecentSunday(today: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('today must be YYYY-MM-DD');
  const d = new Date(`${today}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function isCompletedThisWeek(lastAt: string | null, today: string): boolean {
  if (!lastAt) return false;
  const sunday = mostRecentSunday(today);
  // lastAt is ISO timestamp; compare against start of Sunday UTC.
  return lastAt >= `${sunday}T00:00:00.000Z`;
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function writeSetting(env: Env, key: string, value: string): Promise<string | null> {
  const prev = await readSetting(env, key);
  await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
    .bind(key, value)
    .run();
  return prev;
}

reconciliationRoutes.get('/week', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = mostRecentSunday(today);

  const txnsRes = await c.env.DB.prepare(
    `SELECT t.id, t.posted_at, t.amount_cents, t.description_raw,
            COALESCE(m.display_name, t.description_raw) as merchant_name,
            a.name as account_name,
            c.name as category_name,
            c."group" as category_group
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE date(t.posted_at) >= ? AND date(t.posted_at) <= ?
     ORDER BY t.posted_at ASC, t.id ASC`,
  )
    .bind(weekStart, today)
    .all<{
      id: string;
      posted_at: string;
      amount_cents: number;
      description_raw: string;
      merchant_name: string;
      account_name: string;
      category_name: string | null;
      category_group: string | null;
    }>();

  const txns = txnsRes.results ?? [];
  const totals = {
    income_cents: 0,
    essentials_cents: 0,
    lifestyle_cents: 0,
    indulgence_cents: 0,
    debt_cents: 0,
    transfer_cents: 0,
    uncategorized_cents: 0,
    count: txns.length,
  };
  for (const t of txns) {
    if (t.category_group === 'income' && t.amount_cents > 0) {
      totals.income_cents += t.amount_cents;
      continue;
    }
    if (t.amount_cents >= 0) continue;
    const spend = -t.amount_cents;
    switch (t.category_group) {
      case 'essentials':
        totals.essentials_cents += spend;
        break;
      case 'lifestyle':
        totals.lifestyle_cents += spend;
        break;
      case 'indulgence':
        totals.indulgence_cents += spend;
        break;
      case 'debt':
        totals.debt_cents += spend;
        break;
      case 'transfer':
        totals.transfer_cents += spend;
        break;
      default:
        totals.uncategorized_cents += spend;
    }
  }

  const last_at = await readSetting(c.env, 'last_reconciliation_at');
  const streakRaw = await readSetting(c.env, 'reconciliation_streak');
  const streak = Number(streakRaw ?? '0') || 0;

  return c.json({
    week_starts_on: weekStart,
    today,
    completed_this_week: isCompletedThisWeek(last_at, today),
    last_reconciliation_at: last_at,
    reconciliation_streak: streak,
    totals,
    transactions: txns,
  });
});

reconciliationRoutes.get('/status', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const last_at = await readSetting(c.env, 'last_reconciliation_at');
  const streakRaw = await readSetting(c.env, 'reconciliation_streak');
  const streak = Number(streakRaw ?? '0') || 0;
  return c.json({
    last_reconciliation_at: last_at,
    reconciliation_streak: streak,
    completed_this_week: isCompletedThisWeek(last_at, today),
    week_starts_on: mostRecentSunday(today),
  });
});

reconciliationRoutes.post('/complete', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const last_at = await readSetting(c.env, 'last_reconciliation_at');
  if (isCompletedThisWeek(last_at, today)) {
    const streakRaw = await readSetting(c.env, 'reconciliation_streak');
    return c.json({
      ok: true,
      already: true,
      reconciliation_streak: Number(streakRaw ?? '0') || 0,
      last_reconciliation_at: last_at,
    });
  }

  const now = nowIso();
  const prevStreakRaw = await readSetting(c.env, 'reconciliation_streak');
  const prevStreak = Number(prevStreakRaw ?? '0') || 0;
  const nextStreak = prevStreak + 1;

  const prevLast = await writeSetting(c.env, 'last_reconciliation_at', now);
  await writeSetting(c.env, 'reconciliation_streak', String(nextStreak));

  const eventId = newId('rec');
  await writeEditLog(c.env, [
    {
      entity_type: 'reconciliation',
      entity_id: eventId,
      field: 'last_reconciliation_at',
      old_value: prevLast,
      new_value: now,
      actor: 'user',
      reason: 'reconciliation_complete',
    },
    {
      entity_type: 'reconciliation',
      entity_id: eventId,
      field: 'reconciliation_streak',
      old_value: String(prevStreak),
      new_value: String(nextStreak),
      actor: 'user',
      reason: 'reconciliation_complete',
    },
  ]);

  return c.json({
    ok: true,
    already: false,
    reconciliation_streak: nextStreak,
    last_reconciliation_at: now,
  });
});

// Surfaces open splits that the import auto-matcher skipped because ≥2 transactions
// matched their amount + ±3d window. Josh picks the right one in Reconciliation.
reconciliationRoutes.get('/tabs-to-match', async (c) => {
  const { results: openSplits } = await c.env.DB.prepare(
    `SELECT s.id, s.direction, s.remaining_cents, s.created_at, s.reason,
            COALESCE(cp.name, s.counterparty) AS counterparty_name
     FROM splits s
     LEFT JOIN counterparties cp ON cp.id = s.counterparty_id
     WHERE s.closed_at IS NULL AND s.settlement_txn_id IS NULL AND s.remaining_cents > 0
     ORDER BY s.created_at DESC`,
  ).all<{
    id: string;
    direction: 'owes_josh' | 'josh_owes';
    remaining_cents: number;
    created_at: string;
    reason: string;
    counterparty_name: string;
  }>();

  if (openSplits.length === 0) return c.json({ tabs: [] });

  const tabs: Array<{
    split: typeof openSplits[number];
    candidates: Array<{
      id: string;
      posted_at: string;
      amount_cents: number;
      description_raw: string;
      account_name: string;
    }>;
  }> = [];

  for (const s of openSplits) {
    const expected = expectedSignedAmount(s.direction, s.remaining_cents);
    const day = s.created_at.slice(0, 10);
    const { results: candidates } = await c.env.DB.prepare(
      `SELECT t.id, t.posted_at, t.amount_cents, t.description_raw,
              a.name AS account_name
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE t.amount_cents = ?
         AND t.posted_at >= date(?, '-3 days')
         AND t.posted_at <= date(?, '+3 days')
       ORDER BY t.posted_at ASC`,
    )
      .bind(expected, day, day)
      .all<{
        id: string;
        posted_at: string;
        amount_cents: number;
        description_raw: string;
        account_name: string;
      }>();

    if (candidates.length >= 2) tabs.push({ split: s, candidates });
  }

  return c.json({ tabs });
});

reconciliationRoutes.post('/tabs-to-match/:split_id/match', async (c) => {
  const splitId = c.req.param('split_id');
  const body = (await c.req.json().catch(() => null)) as { transaction_id?: unknown } | null;
  const txId = typeof body?.transaction_id === 'string' ? body.transaction_id : '';
  if (!txId) return c.json({ error: 'transaction_id required' }, 400);

  const split = await c.env.DB.prepare(
    `SELECT id, direction, remaining_cents, created_at, closed_at, settlement_txn_id
     FROM splits WHERE id = ?`,
  )
    .bind(splitId)
    .first<{
      id: string;
      direction: 'owes_josh' | 'josh_owes';
      remaining_cents: number;
      created_at: string;
      closed_at: string | null;
      settlement_txn_id: string | null;
    }>();
  if (!split) return c.json({ error: 'split not found' }, 404);
  if (split.closed_at || split.settlement_txn_id) return c.json({ error: 'split already closed' }, 409);
  if (split.remaining_cents <= 0) return c.json({ error: 'split already settled' }, 409);

  const txn = await c.env.DB.prepare(
    `SELECT id, posted_at, amount_cents FROM transactions WHERE id = ?`,
  )
    .bind(txId)
    .first<{ id: string; posted_at: string; amount_cents: number }>();
  if (!txn) return c.json({ error: 'transaction not found' }, 404);

  if (!isCandidateValid(split, txn)) {
    return c.json({ error: 'transaction does not match split (amount or ±3d window)' }, 400);
  }

  const now = nowIso();
  const eventId = newId('se');
  const delta = -split.remaining_cents;

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE splits SET settlement_txn_id = ?, remaining_cents = 0, closed_at = ? WHERE id = ?`,
    ).bind(txn.id, now, split.id),
    c.env.DB.prepare(
      `INSERT INTO split_events (id, split_id, delta_cents, transaction_id, note, created_at)
       VALUES (?,?,?,?,?,?)`,
    ).bind(eventId, split.id, delta, txn.id, 'matched in reconciliation', now),
  ]);

  await writeEditLog(c.env, [
    {
      entity_type: 'split',
      entity_id: split.id,
      field: 'settlement_txn_id',
      old_value: null,
      new_value: txn.id,
      actor: 'user',
      reason: 'split_user_matched',
    },
  ]);

  return c.json({ ok: true, split_id: split.id, transaction_id: txn.id });
});
