import type { Env } from '../env.js';
import { newId, nowIso } from './ids.js';

// ============================================================================
// GL substrate: postJournalEntry + pure validation helpers.
// Strict balance enforcement: every JE must satisfy sum(debits) = sum(credits).
// Every line must have exactly one of debit_cents / credit_cents non-zero.
// ============================================================================

export interface JournalLineInput {
  account_id: string;
  debit_cents?: number;
  credit_cents?: number;
}

export interface JournalEntryMeta {
  posted_at: string;
  source_type: string;
  source_id?: string | null;
  memo?: string | null;
  locked_at?: string | null;
}

export class JournalEntryError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'JournalEntryError';
  }
}

// Pure: validates lines and returns normalized lines (debit_cents/credit_cents
// always integers, exactly one non-zero per line, totals balance).
// Throws JournalEntryError on any violation.
export function validateLines(lines: JournalLineInput[]): Array<{
  account_id: string;
  debit_cents: number;
  credit_cents: number;
}> {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new JournalEntryError('too_few_lines', 'journal entry needs at least 2 lines');
  }
  const out: Array<{ account_id: string; debit_cents: number; credit_cents: number }> = [];
  let sumD = 0;
  let sumC = 0;
  for (const l of lines) {
    if (!l || typeof l.account_id !== 'string' || l.account_id.length === 0) {
      throw new JournalEntryError('bad_account', 'each line needs a non-empty account_id');
    }
    const d = Math.trunc(l.debit_cents ?? 0);
    const c = Math.trunc(l.credit_cents ?? 0);
    if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0) {
      throw new JournalEntryError('bad_amount', `line for ${l.account_id} has invalid amount`);
    }
    if ((d === 0 && c === 0) || (d > 0 && c > 0)) {
      throw new JournalEntryError(
        'single_sided',
        `line for ${l.account_id} must have exactly one of debit_cents / credit_cents non-zero`,
      );
    }
    sumD += d;
    sumC += c;
    out.push({ account_id: l.account_id, debit_cents: d, credit_cents: c });
  }
  if (sumD !== sumC) {
    throw new JournalEntryError(
      'unbalanced',
      `journal entry unbalanced: debits ${sumD} != credits ${sumC}`,
    );
  }
  if (sumD === 0) {
    throw new JournalEntryError('zero_total', 'journal entry total is zero');
  }
  return out;
}

// Posts a balanced JE in a single D1 batch. Returns the entry id.
// Caller is responsible for source_type/source_id idempotency upstream
// (e.g. backfill kernels look up existing rows by source before posting).
export async function postJournalEntry(
  env: Env,
  lines: JournalLineInput[],
  meta: JournalEntryMeta,
): Promise<string> {
  const validated = validateLines(lines);
  const entryId = newId('je');
  const now = nowIso();
  const stmts = [
    env.DB.prepare(
      `INSERT INTO journal_entries (id, posted_at, source_type, source_id, memo, created_at, locked_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(
      entryId,
      meta.posted_at,
      meta.source_type,
      meta.source_id ?? null,
      meta.memo ?? null,
      now,
      meta.locked_at ?? null,
    ),
  ];
  const lineStmt = env.DB.prepare(
    `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_cents, credit_cents, created_at)
     VALUES (?,?,?,?,?,?)`,
  );
  for (const l of validated) {
    stmts.push(lineStmt.bind(newId('jl'), entryId, l.account_id, l.debit_cents, l.credit_cents, now));
  }
  await env.DB.batch(stmts);
  return entryId;
}

// Pure: trial balance = sum(debits) - sum(credits) per account, then
// totalled across asset/liability/equity/income/expense buckets.
// Returns 0 if the books are clean.
export interface TrialBalanceLine {
  account_id: string;
  path: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  debit_cents: number;
  credit_cents: number;
  balance_cents: number; // debit - credit (positive for asset/expense natural side)
}

export function computeTrialBalance(
  rows: Array<{
    account_id: string;
    path: string;
    type: TrialBalanceLine['type'];
    debit_cents: number;
    credit_cents: number;
  }>,
): { lines: TrialBalanceLine[]; totals: { debit_cents: number; credit_cents: number; delta_cents: number } } {
  const lines: TrialBalanceLine[] = rows.map((r) => ({
    account_id: r.account_id,
    path: r.path,
    type: r.type,
    debit_cents: r.debit_cents,
    credit_cents: r.credit_cents,
    balance_cents: r.debit_cents - r.credit_cents,
  }));
  const totals = lines.reduce(
    (acc, l) => {
      acc.debit_cents += l.debit_cents;
      acc.credit_cents += l.credit_cents;
      return acc;
    },
    { debit_cents: 0, credit_cents: 0, delta_cents: 0 },
  );
  totals.delta_cents = totals.debit_cents - totals.credit_cents;
  return { lines, totals };
}
