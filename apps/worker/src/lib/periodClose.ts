import type { Env } from '../env.js';
import { newId, nowIso } from './ids.js';
import { computeTrialBalance, postJournalEntry, type JournalLineInput } from './gl.js';
import { writeEditLog } from './editlog.js';

// ============================================================================
// Period close + Net Worth (session 63 / Accounting Upgrade #58).
//
// Closing a week snapshots the trial balance (must equal — close refuses
// otherwise) and stamps locked_at on every journal_entry with
// posted_at <= period_end. Subsequent postJournalEntry calls into that range
// raise period_locked; backdated edits go through reverseJournalEntry, which
// emits an inverse JE in the current period and leaves the locked one intact.
// ============================================================================

export class PeriodLockedError extends Error {
  code = 'period_locked' as const;
  period_end: string;
  constructor(period_end: string) {
    super(`period_locked: posted_at falls inside closed period ending ${period_end}`);
    this.name = 'PeriodLockedError';
    this.period_end = period_end;
  }
}

// Pure: returns the period_end of the latest close that covers the given
// posted_at, or null if none does. closes is the list of period_close rows.
// posted_at is compared as YYYY-MM-DD (we slice to 10 chars before compare so
// timestamps work too).
export function findCoveringClose(
  posted_at: string,
  closes: Array<{ period_end: string }>,
): string | null {
  const day = posted_at.slice(0, 10);
  let latest: string | null = null;
  for (const c of closes) {
    if (day <= c.period_end) {
      if (!latest || c.period_end > latest) latest = c.period_end;
    }
  }
  return latest;
}

// Pure: derived equity from a trial balance.
//   net_worth = assets − liabilities
// (equivalently: equity + (income − expense), but we surface the assets-vs-
// liabilities framing because that's the user-facing number.)
export interface NetWorthInputs {
  assets_cents: number;
  liabilities_cents: number;
  equity_cents: number;
  income_cents: number;
  expense_cents: number;
}

export function netWorthFromTrialBalance(
  rows: Array<{
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    debit_cents: number;
    credit_cents: number;
  }>,
): NetWorthInputs {
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    const debit = r.debit_cents - r.credit_cents; // positive on natural debit side
    const credit = r.credit_cents - r.debit_cents; // positive on natural credit side
    switch (r.type) {
      case 'asset':
        assets += debit;
        break;
      case 'liability':
        liabilities += credit;
        break;
      case 'equity':
        equity += credit;
        break;
      case 'income':
        income += credit;
        break;
      case 'expense':
        expense += debit;
        break;
    }
  }
  return {
    assets_cents: assets,
    liabilities_cents: liabilities,
    equity_cents: equity,
    income_cents: income,
    expense_cents: expense,
  };
}

export interface CloseWeekResult {
  ok: true;
  period_close_id: string;
  period_start: string;
  period_end: string;
  trial_balance_debits_cents: number;
  trial_balance_credits_cents: number;
  journal_entries_locked: number;
  already: boolean;
}

// Returns the most recent Saturday (the inclusive end of a Sun→Sat week
// containing today). If today is a Saturday, returns today.
export function mostRecentSaturday(today: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('today must be YYYY-MM-DD');
  const d = new Date(`${today}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const back = (dow + 1) % 7; // distance back to Saturday
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function periodStartFromEnd(period_end: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period_end)) throw new Error('period_end must be YYYY-MM-DD');
  const d = new Date(`${period_end}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

// Strict close. Refuses if trial balance is unbalanced. Idempotent on
// (period_end). Stamps locked_at on every JE with posted_at <= period_end.
export async function closeWeek(
  env: Env,
  period_end: string,
  closed_by: 'user' | 'auto' | 'system' = 'user',
): Promise<CloseWeekResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period_end)) {
    throw new Error('period_end must be YYYY-MM-DD');
  }
  const period_start = periodStartFromEnd(period_end);

  const existing = await env.DB.prepare(
    `SELECT id, trial_balance_debits_cents, trial_balance_credits_cents
     FROM period_close WHERE period_end = ?`,
  )
    .bind(period_end)
    .first<{
      id: string;
      trial_balance_debits_cents: number;
      trial_balance_credits_cents: number;
    }>();
  if (existing) {
    return {
      ok: true,
      period_close_id: existing.id,
      period_start,
      period_end,
      trial_balance_debits_cents: existing.trial_balance_debits_cents,
      trial_balance_credits_cents: existing.trial_balance_credits_cents,
      journal_entries_locked: 0,
      already: true,
    };
  }

  const tbRows = await env.DB.prepare(
    `SELECT a.id AS account_id, a.path, a.type,
            COALESCE(SUM(l.debit_cents), 0) AS debit_cents,
            COALESCE(SUM(l.credit_cents), 0) AS credit_cents
     FROM gl_accounts a
     LEFT JOIN journal_lines l ON l.account_id = a.id
     LEFT JOIN journal_entries e ON e.id = l.journal_entry_id
     WHERE (e.posted_at IS NULL OR date(e.posted_at) <= ?)
     GROUP BY a.id, a.path, a.type
     ORDER BY a.path`,
  )
    .bind(period_end)
    .all<{
      account_id: string;
      path: string;
      type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
      debit_cents: number;
      credit_cents: number;
    }>();
  const tb = computeTrialBalance(tbRows.results ?? []);
  if (tb.totals.delta_cents !== 0) {
    throw new Error(
      `unbalanced_books: cannot close period ending ${period_end} — trial balance delta ${tb.totals.delta_cents}`,
    );
  }

  const closeId = newId('pc');
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO period_close
     (id, period_start, period_end, closed_at, closed_by, trial_balance_debits_cents, trial_balance_credits_cents)
     VALUES (?,?,?,?,?,?,?)`,
  )
    .bind(
      closeId,
      period_start,
      period_end,
      now,
      closed_by,
      tb.totals.debit_cents,
      tb.totals.credit_cents,
    )
    .run();

  const lockRes = await env.DB.prepare(
    `UPDATE journal_entries SET locked_at = ?
     WHERE locked_at IS NULL AND date(posted_at) <= ?`,
  )
    .bind(now, period_end)
    .run();
  const locked = (lockRes.meta?.changes as number | undefined) ?? 0;

  await writeEditLog(env, [
    {
      entity_type: 'period_close',
      entity_id: closeId,
      field: 'closed_at',
      old_value: null,
      new_value: now,
      actor: closed_by === 'user' ? 'user' : 'system',
      reason: 'period_close',
    },
  ]);

  return {
    ok: true,
    period_close_id: closeId,
    period_start,
    period_end,
    trial_balance_debits_cents: tb.totals.debit_cents,
    trial_balance_credits_cents: tb.totals.credit_cents,
    journal_entries_locked: locked,
    already: false,
  };
}

// Reverses a journal entry by emitting an inverse JE in the current period.
// The original (locked) entry stays intact. The reversal JE is dated `today`
// (current ISO date) and links back via memo + source_id.
export async function reverseJournalEntry(
  env: Env,
  original_je_id: string,
  reason: string,
  today?: string,
): Promise<{ reversal_je_id: string; original_je_id: string }> {
  const original = await env.DB.prepare(
    `SELECT id, posted_at, source_type, source_id, memo, locked_at FROM journal_entries WHERE id = ?`,
  )
    .bind(original_je_id)
    .first<{
      id: string;
      posted_at: string;
      source_type: string;
      source_id: string | null;
      memo: string | null;
      locked_at: string | null;
    }>();
  if (!original) throw new Error('original journal entry not found');

  const linesRes = await env.DB.prepare(
    `SELECT account_id, debit_cents, credit_cents FROM journal_lines WHERE journal_entry_id = ?`,
  )
    .bind(original_je_id)
    .all<{ account_id: string; debit_cents: number; credit_cents: number }>();
  const lines = linesRes.results ?? [];
  if (lines.length === 0) throw new Error('original entry has no lines');

  const reversed: JournalLineInput[] = lines.map((l) => ({
    account_id: l.account_id,
    debit_cents: l.credit_cents,
    credit_cents: l.debit_cents,
  }));
  const day = (today ?? nowIso()).slice(0, 10);
  const reversalId = await postJournalEntry(env, reversed, {
    posted_at: `${day}T00:00:00.000Z`,
    source_type: 'reversal',
    source_id: original_je_id,
    memo: `reversal of ${original_je_id}: ${reason}`,
  });
  await writeEditLog(env, [
    {
      entity_type: 'journal_entry',
      entity_id: original_je_id,
      field: 'reversed_by',
      old_value: null,
      new_value: reversalId,
      actor: 'user',
      reason,
    },
  ]);
  return { reversal_je_id: reversalId, original_je_id };
}
