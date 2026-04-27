import type { Env } from '../env.js';
import { newId, nowIso } from './ids.js';
import { postJournalEntry } from './gl.js';

// ============================================================================
// GL backfill kernel — walks the existing transactions table newest→oldest,
// emits one balanced JE per transaction. Idempotent: skips transactions that
// already have a JE with source_type='transaction' and source_id=transaction.id.
//
// Mapping (pure):
//   bank account.type:
//     chequing/savings → Assets:Cash:<account name>
//     credit           → Liabilities:CreditCards:<account name>
//     loan             → Liabilities:Loans:<account name>
//   category group → other side:
//     essentials  → Expenses:Essentials
//     lifestyle   → Expenses:Lifestyle
//     indulgence  → Expenses:Indulgence
//     debt        → Expenses:Debt Service
//     income      → Income:Salary
//     transfer    → Income:Transfer (clearing — nets to zero across paired transfers)
//     (no category) → Equity:Opening Balance (option A: post unknowns to opening)
//
// Sign rule (CSV convention: negative = outflow, positive = inflow):
//   For an asset account: cash gets DR on inflow, CR on outflow
//   For a liability account: liability gets DR on payment-in, CR on charge-out
//   The "other side" takes the opposite leg in the same magnitude.
// ============================================================================

export type BankAccountType = 'chequing' | 'savings' | 'credit' | 'loan';
export type CategoryGroup =
  | 'essentials'
  | 'lifestyle'
  | 'indulgence'
  | 'debt'
  | 'income'
  | 'transfer';

export interface BackfillTxn {
  id: string;
  posted_at: string;
  amount_cents: number;
  description_raw: string;
  account_id: string;
  account_name: string;
  account_type: BankAccountType;
  category_group: CategoryGroup | null;
}

export interface AccountSidePath {
  path: string;
  name: string;
  type: 'asset' | 'liability';
  parent_id: string;
}

// Pure: maps a bank account → its GL chart path.
export function bankAccountToGlPath(account: {
  name: string;
  type: BankAccountType;
}): AccountSidePath {
  switch (account.type) {
    case 'chequing':
    case 'savings':
      return { path: `Assets:Cash:${account.name}`, name: account.name, type: 'asset', parent_id: 'gla_assets_cash' };
    case 'credit':
      return { path: `Liabilities:CreditCards:${account.name}`, name: account.name, type: 'liability', parent_id: 'gla_liab_cc' };
    case 'loan':
      return { path: `Liabilities:Loans:${account.name}`, name: account.name, type: 'liability', parent_id: 'gla_liab_loans' };
  }
}

// Pure: maps a category group → its GL chart account id.
// Returns null if the group is unknown (caller falls back to opening balance).
export function categoryGroupToAccountId(group: CategoryGroup | null): string {
  switch (group) {
    case 'essentials':
      return 'gla_exp_essentials';
    case 'lifestyle':
      return 'gla_exp_lifestyle';
    case 'indulgence':
      return 'gla_exp_indulgence';
    case 'debt':
      return 'gla_exp_debt';
    case 'income':
      return 'gla_income_salary';
    case 'transfer':
      return 'gla_income_transfer';
    case null:
    default:
      return 'gla_equity_opening';
  }
}

// Pure: builds the two-line JE for a single transaction given resolved GL ids.
// `cashAccountId` is the per-bank-account GL account id (already created).
// `cashType` is the GL type of that account (asset for chequing/savings, liability for cc/loan).
// `otherAccountId` is the GL account from category mapping.
// Returns { lines } ready to feed postJournalEntry.
export function buildTransactionLines(args: {
  amount_cents: number;
  cashAccountId: string;
  cashType: 'asset' | 'liability';
  otherAccountId: string;
}): Array<{ account_id: string; debit_cents: number; credit_cents: number }> {
  const mag = Math.abs(args.amount_cents);
  const inflow = args.amount_cents > 0;
  // Money in = debit on the cash side regardless of whether that account is an
  // asset (increases) or a liability (decreases). Money out = credit either way.
  // The other leg takes the opposite side automatically.
  const cashDebits = inflow;
  void args.cashType;
  const cashLine = cashDebits
    ? { account_id: args.cashAccountId, debit_cents: mag, credit_cents: 0 }
    : { account_id: args.cashAccountId, debit_cents: 0, credit_cents: mag };
  const otherLine = cashDebits
    ? { account_id: args.otherAccountId, debit_cents: 0, credit_cents: mag }
    : { account_id: args.otherAccountId, debit_cents: mag, credit_cents: 0 };
  return [cashLine, otherLine];
}

// Resolves (or creates) the per-bank-account GL account row. Returns its id.
async function resolveBankAccountGl(
  env: Env,
  account: { id: string; name: string; type: BankAccountType },
  cache: Map<string, string>,
): Promise<string> {
  if (cache.has(account.id)) return cache.get(account.id)!;
  const map = bankAccountToGlPath(account);
  const existing = await env.DB.prepare(`SELECT id FROM gl_accounts WHERE path = ? LIMIT 1`)
    .bind(map.path)
    .first<{ id: string }>();
  if (existing) {
    cache.set(account.id, existing.id);
    return existing.id;
  }
  const id = newId('gla');
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO gl_accounts (id, path, name, type, parent_id, created_at) VALUES (?,?,?,?,?,?)`,
  )
    .bind(id, map.path, map.name, map.type, map.parent_id, now)
    .run();
  cache.set(account.id, id);
  return id;
}

export interface BackfillResult {
  scanned: number;
  inserted: number;
  skipped_existing: number;
}

// Idempotent. Safe to re-run. Skips any transaction whose JE is already posted.
export async function runGlBackfill(env: Env): Promise<BackfillResult> {
  const txns = await env.DB.prepare(
    `SELECT t.id, t.posted_at, t.amount_cents, t.description_raw,
            a.id AS account_id, a.name AS account_name, a.type AS account_type,
            c.\`group\` AS category_group
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     ORDER BY t.posted_at DESC`,
  ).all<{
    id: string;
    posted_at: string;
    amount_cents: number;
    description_raw: string;
    account_id: string;
    account_name: string;
    account_type: BankAccountType;
    category_group: CategoryGroup | null;
  }>();

  const result: BackfillResult = { scanned: 0, inserted: 0, skipped_existing: 0 };
  const accountCache = new Map<string, string>();

  for (const t of txns.results ?? []) {
    result.scanned += 1;
    const existing = await env.DB.prepare(
      `SELECT id FROM journal_entries WHERE source_type = 'transaction' AND source_id = ? LIMIT 1`,
    )
      .bind(t.id)
      .first<{ id: string }>();
    if (existing) {
      result.skipped_existing += 1;
      continue;
    }
    const cashAccountId = await resolveBankAccountGl(
      env,
      { id: t.account_id, name: t.account_name, type: t.account_type },
      accountCache,
    );
    const cashType: 'asset' | 'liability' =
      t.account_type === 'chequing' || t.account_type === 'savings' ? 'asset' : 'liability';
    const otherAccountId = categoryGroupToAccountId(t.category_group);
    const lines = buildTransactionLines({
      amount_cents: t.amount_cents,
      cashAccountId,
      cashType,
      otherAccountId,
    });
    await postJournalEntry(env, lines, {
      posted_at: t.posted_at,
      source_type: 'transaction',
      source_id: t.id,
      memo: t.description_raw,
    });
    result.inserted += 1;
  }
  return result;
}
