import type { Env } from '../env.js';
import { newId, nowIso } from './ids.js';
import { postJournalEntry, type JournalLineInput } from './gl.js';

// ============================================================================
// Liabilities layer over GL. Each debt links to a GL liability account, with
// three resolution paths (see runDebtBackfill).
//
// Pure helpers:
//   - computeInterestAccrued(principal, apr_bps, days)  simple daily interest
//   - splitLoanPaymentLines(...)                         3-line principal/interest JE
//   - statementMismatchCents(gl, stmt)                   diff for reconciliation
// ============================================================================

// Pure: simple-interest daily accrual rounded to cents.
// principal * (apr_bps/10000) * (days/365). Half-up rounding via Math.round.
export function computeInterestAccrued(
  principal_cents: number,
  apr_bps: number,
  days: number,
): number {
  const p = Math.max(0, Math.trunc(principal_cents));
  const a = Math.max(0, Math.trunc(apr_bps));
  const d = Math.max(0, Math.trunc(days));
  if (p === 0 || a === 0 || d === 0) return 0;
  return Math.round((p * a * d) / (10000 * 365));
}

export interface LoanPaymentLineInput {
  totalPaid_cents: number;
  principal_cents: number;
  apr_bps: number;
  daysSinceLast: number;
  debtAccountId: string;
  cashAccountId: string;
}

// Pure: 3-line JE splitting a loan payment into principal + interest.
//   DR debt        principal_portion
//   DR Expenses:Debt Service  interest_portion
//   CR cash        total
// Interest accrued = computeInterestAccrued(...). Principal portion = total − interest,
// floored at 0. If interest >= total, principal portion is 0 and interest fills.
// Returns [] for total <= 0.
export function splitLoanPaymentLines(args: LoanPaymentLineInput): JournalLineInput[] {
  const total = Math.trunc(args.totalPaid_cents);
  if (total <= 0) return [];
  const interest = Math.min(
    total,
    computeInterestAccrued(args.principal_cents, args.apr_bps, args.daysSinceLast),
  );
  const principal = total - interest;
  const lines: JournalLineInput[] = [];
  if (principal > 0) lines.push({ account_id: args.debtAccountId, debit_cents: principal });
  if (interest > 0) lines.push({ account_id: 'gla_exp_debt', debit_cents: interest });
  lines.push({ account_id: args.cashAccountId, credit_cents: total });
  return lines;
}

// Pure: signed cents difference. Positive = GL says we owe more than the
// statement (extra charges in GL not yet on the statement, or missing payments
// on the statement). Negative = statement says more (missing charges in GL).
export function statementMismatchCents(
  glBalance_cents: number,
  statementBalance_cents: number,
): number {
  return Math.trunc(glBalance_cents) - Math.trunc(statementBalance_cents);
}

// ----- impure: backfill ----------------------------------------------------

export interface DebtBackfillResult {
  scanned: number;
  linked_existing_bank: number;
  linked_counterparty: number;
  created_new: number;
  skipped: number;
  opening_balance_je_posted: number;
}

interface DebtRow {
  id: string;
  name: string;
  principal_cents: number;
  account_id_linked: string | null;
  account_id: string | null;
}

interface BankRow {
  id: string;
  name: string;
  type: 'chequing' | 'savings' | 'credit' | 'loan';
}

// Resolves the GL account for a debt. Returns the gl_accounts.id linked.
// Side-effect: writes debts.account_id, may create gl_accounts row, may post
// opening-balance JE for free-standing debts.
async function resolveDebtGl(
  env: Env,
  debt: DebtRow,
  result: DebtBackfillResult,
): Promise<string | null> {
  if (debt.account_id) return debt.account_id;

  // Path 1: linked bank account.
  if (debt.account_id_linked) {
    const bank = await env.DB.prepare(
      `SELECT id, name, type FROM accounts WHERE id = ? LIMIT 1`,
    )
      .bind(debt.account_id_linked)
      .first<BankRow>();
    if (bank) {
      const path =
        bank.type === 'credit'
          ? `Liabilities:CreditCards:${bank.name}`
          : bank.type === 'loan'
            ? `Liabilities:Loans:${bank.name}`
            : null;
      if (path) {
        const existing = await env.DB.prepare(`SELECT id FROM gl_accounts WHERE path = ? LIMIT 1`)
          .bind(path)
          .first<{ id: string }>();
        if (existing) {
          await env.DB.prepare(`UPDATE debts SET account_id = ? WHERE id = ?`)
            .bind(existing.id, debt.id)
            .run();
          result.linked_existing_bank += 1;
          return existing.id;
        }
      }
    }
  }

  // Path 2: matching counterparty.
  const cp = await env.DB.prepare(
    `SELECT account_id FROM counterparties WHERE name = ? AND archived_at IS NULL LIMIT 1`,
  )
    .bind(debt.name)
    .first<{ account_id: string | null }>();
  if (cp?.account_id) {
    await env.DB.prepare(`UPDATE debts SET account_id = ? WHERE id = ?`)
      .bind(cp.account_id, debt.id)
      .run();
    result.linked_counterparty += 1;
    return cp.account_id;
  }

  // Path 3: create a new free-standing Liabilities:Loans:<Name> account and
  // post an opening-balance JE seeding the principal.
  const path = `Liabilities:Loans:${debt.name}`;
  const existingNew = await env.DB.prepare(`SELECT id FROM gl_accounts WHERE path = ? LIMIT 1`)
    .bind(path)
    .first<{ id: string }>();
  let glaId: string;
  if (existingNew) {
    glaId = existingNew.id;
  } else {
    glaId = `gla_debt_${debt.id}`;
    await env.DB.prepare(
      `INSERT INTO gl_accounts (id, path, name, type, parent_id, created_at) VALUES (?,?,?,?,?,?)`,
    )
      .bind(glaId, path, debt.name, 'liability', 'gla_liab_loans', nowIso())
      .run();
  }
  await env.DB.prepare(`UPDATE debts SET account_id = ? WHERE id = ?`).bind(glaId, debt.id).run();
  result.created_new += 1;

  if (debt.principal_cents > 0) {
    const sourceId = `debt_open_${debt.id}`;
    const before = await env.DB.prepare(
      `SELECT id FROM journal_entries WHERE source_type = 'debt_opening' AND source_id = ? LIMIT 1`,
    )
      .bind(sourceId)
      .first<{ id: string }>();
    if (!before) {
      await postJournalEntry(
        env,
        [
          { account_id: 'gla_equity_opening', debit_cents: debt.principal_cents },
          { account_id: glaId, credit_cents: debt.principal_cents },
        ],
        {
          posted_at: nowIso(),
          source_type: 'debt_opening',
          source_id: sourceId,
          memo: `opening balance · ${debt.name}`,
        },
      );
      result.opening_balance_je_posted += 1;
    }
  }

  return glaId;
}

// Idempotent. Walks all non-archived debts, resolves GL accounts, posts opening-
// balance JEs for free-standing debts. Safe to re-run.
export async function runDebtBackfill(env: Env): Promise<DebtBackfillResult> {
  const result: DebtBackfillResult = {
    scanned: 0,
    linked_existing_bank: 0,
    linked_counterparty: 0,
    created_new: 0,
    skipped: 0,
    opening_balance_je_posted: 0,
  };
  const debts = await env.DB.prepare(
    `SELECT id, name, principal_cents, account_id_linked, account_id
     FROM debts WHERE archived = 0 ORDER BY name ASC`,
  ).all<DebtRow>();
  for (const d of debts.results ?? []) {
    result.scanned += 1;
    if (d.account_id) {
      result.skipped += 1;
      continue;
    }
    await resolveDebtGl(env, d, result);
  }
  void newId;
  return result;
}

// ----- statement reconciliation ---------------------------------------------

// Per-debt GL balance for liability accounts.
// Returns sum(credits) - sum(debits) (positive = liability owed).
// Filters journal_lines.posted_at via the parent journal_entry as_of.
export async function glLiabilityBalance(
  env: Env,
  glAccountId: string,
  asOf: string | null,
): Promise<number> {
  const sql = asOf
    ? `SELECT COALESCE(SUM(jl.credit_cents) - SUM(jl.debit_cents), 0) AS bal
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE jl.account_id = ? AND je.posted_at <= ?`
    : `SELECT COALESCE(SUM(jl.credit_cents) - SUM(jl.debit_cents), 0) AS bal
       FROM journal_lines jl
       WHERE jl.account_id = ?`;
  const stmt = asOf ? env.DB.prepare(sql).bind(glAccountId, asOf) : env.DB.prepare(sql).bind(glAccountId);
  const row = await stmt.first<{ bal: number }>();
  return row?.bal ?? 0;
}

export interface StatementReconciliationRow {
  debt_id: string;
  debt_name: string;
  statement_id: string;
  statement_date: string;
  statement_balance_cents: number;
  gl_balance_cents: number;
  mismatch_cents: number;
}

// For each non-archived debt with a linked GL account and a statement snapshot
// in the given window, compute mismatch. Window defaults to last 60 days.
export async function reconcileStatements(
  env: Env,
  windowDays: number = 60,
): Promise<StatementReconciliationRow[]> {
  const rows = await env.DB.prepare(
    `SELECT d.id AS debt_id, d.name AS debt_name, d.account_id AS gl_account_id,
            s.id AS statement_id, s.statement_date, s.statement_balance_cents
     FROM cc_statement_snapshots s
     JOIN debts d ON d.id = s.debt_id
     WHERE d.archived = 0
       AND d.account_id IS NOT NULL
       AND s.statement_date >= date('now', '-' || ? || ' days')
     ORDER BY s.statement_date DESC`,
  )
    .bind(windowDays)
    .all<{
      debt_id: string;
      debt_name: string;
      gl_account_id: string;
      statement_id: string;
      statement_date: string;
      statement_balance_cents: number;
    }>();

  const out: StatementReconciliationRow[] = [];
  for (const r of rows.results ?? []) {
    const gl = await glLiabilityBalance(env, r.gl_account_id, r.statement_date);
    out.push({
      debt_id: r.debt_id,
      debt_name: r.debt_name,
      statement_id: r.statement_id,
      statement_date: r.statement_date,
      statement_balance_cents: r.statement_balance_cents,
      gl_balance_cents: gl,
      mismatch_cents: statementMismatchCents(gl, r.statement_balance_cents),
    });
  }
  return out;
}
