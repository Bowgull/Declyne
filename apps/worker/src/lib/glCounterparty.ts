import type { Env } from '../env.js';
import { newId, nowIso } from './ids.js';
import { postJournalEntry, type JournalLineInput } from './gl.js';

// ============================================================================
// AR/AP layer over GL. Each counterparty has one signed asset account under
// Assets:Receivable:<Name>. Negative balance = I currently owe them.
//
// Mapping (pure):
//   they_owe split create: DR cp_account / CR Income:Reimbursement
//   i_owe split create:    DR Expenses:Lifestyle / CR cp_account
//   they_owe payment (delta < 0): DR Cash / CR cp_account
//   i_owe payment (delta < 0):    DR cp_account / CR Cash
//   delta > 0 (tab grew): reversed legs of the payment direction
//
// When a split_event is linked to a real transaction, the pre-existing
// transaction JE (from glBackfill) would double-count. The event-posting
// kernel deletes that JE first so the split_event JE owns the cash leg.
// ============================================================================

export type SplitDirection = 'i_owe' | 'they_owe';

export interface SplitCreateInput {
  direction: SplitDirection;
  amount_cents: number;
  cpAccountId: string;
}

// Pure: two-line JE for a freshly-created split.
export function splitCreateLines(args: SplitCreateInput): JournalLineInput[] {
  const mag = Math.abs(Math.trunc(args.amount_cents));
  if (mag === 0) return [];
  if (args.direction === 'they_owe') {
    return [
      { account_id: args.cpAccountId, debit_cents: mag },
      { account_id: 'gla_income_reimburse', credit_cents: mag },
    ];
  }
  return [
    { account_id: 'gla_exp_lifestyle', debit_cents: mag },
    { account_id: args.cpAccountId, credit_cents: mag },
  ];
}

export interface SplitEventInput {
  direction: SplitDirection;
  delta_cents: number; // signed; negative = payment, positive = tab grew
  cpAccountId: string;
  cashAccountId: string;
}

// Pure: two-line JE for a split_event. Returns [] for delta=0.
export function splitEventLines(args: SplitEventInput): JournalLineInput[] {
  const delta = Math.trunc(args.delta_cents);
  if (delta === 0) return [];
  const mag = Math.abs(delta);
  const isPayment = delta < 0;
  // Pre-resolve which side cash takes.
  // they_owe + payment: DR cash, CR cp.
  // i_owe   + payment: DR cp,   CR cash.
  // delta>0 (tab grew): flip.
  const cashDebits =
    (args.direction === 'they_owe' && isPayment) ||
    (args.direction === 'i_owe' && !isPayment);
  return cashDebits
    ? [
        { account_id: args.cashAccountId, debit_cents: mag },
        { account_id: args.cpAccountId, credit_cents: mag },
      ]
    : [
        { account_id: args.cpAccountId, debit_cents: mag },
        { account_id: args.cashAccountId, credit_cents: mag },
      ];
}

// ----- impure helpers ------------------------------------------------------

// Resolves (or creates) the GL account for a counterparty. Returns its id.
// Writes the FK back onto counterparties.account_id when newly created.
export async function resolveCounterpartyGl(env: Env, cpId: string): Promise<string> {
  const row = await env.DB.prepare(
    `SELECT id, name, account_id, created_at FROM counterparties WHERE id = ?`,
  )
    .bind(cpId)
    .first<{ id: string; name: string; account_id: string | null; created_at: string }>();
  if (!row) throw new Error(`counterparty ${cpId} not found`);
  if (row.account_id) return row.account_id;

  const path = `Assets:Receivable:${row.name}`;
  const existing = await env.DB.prepare(`SELECT id FROM gl_accounts WHERE path = ? LIMIT 1`)
    .bind(path)
    .first<{ id: string }>();
  let glaId = existing?.id;
  if (!glaId) {
    glaId = `gla_cp_${cpId}`;
    await env.DB.prepare(
      `INSERT INTO gl_accounts (id, path, name, type, parent_id, created_at) VALUES (?,?,?,?,?,?)`,
    )
      .bind(glaId, path, row.name, 'asset', 'gla_assets_recv', row.created_at || nowIso())
      .run();
  }
  await env.DB.prepare(`UPDATE counterparties SET account_id = ? WHERE id = ?`).bind(glaId, cpId).run();
  return glaId;
}

// Looks up the GL account id for a transaction's bank account.
// Falls back to Equity:Opening Balance if the txn or its account can't be found.
export async function resolveTxnCashGl(env: Env, txnId: string): Promise<string> {
  const row = await env.DB.prepare(
    `SELECT a.id AS bank_id, a.name AS bank_name, a.type AS bank_type
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE t.id = ? LIMIT 1`,
  )
    .bind(txnId)
    .first<{ bank_id: string; bank_name: string; bank_type: 'chequing' | 'savings' | 'credit' | 'loan' }>();
  if (!row) return 'gla_equity_opening';
  const path =
    row.bank_type === 'chequing' || row.bank_type === 'savings'
      ? `Assets:Cash:${row.bank_name}`
      : row.bank_type === 'credit'
        ? `Liabilities:CreditCards:${row.bank_name}`
        : `Liabilities:Loans:${row.bank_name}`;
  const gla = await env.DB.prepare(`SELECT id FROM gl_accounts WHERE path = ? LIMIT 1`)
    .bind(path)
    .first<{ id: string }>();
  return gla?.id ?? 'gla_equity_opening';
}

// Deletes any existing transaction-source JE for the given txn id so the
// split_event JE can own the cash leg without double-counting.
async function deleteTxnSourceJe(env: Env, txnId: string): Promise<void> {
  const je = await env.DB.prepare(
    `SELECT id FROM journal_entries WHERE source_type = 'transaction' AND source_id = ? LIMIT 1`,
  )
    .bind(txnId)
    .first<{ id: string }>();
  if (!je) return;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM journal_lines WHERE journal_entry_id = ?`).bind(je.id),
    env.DB.prepare(`DELETE FROM journal_entries WHERE id = ?`).bind(je.id),
  ]);
}

// Posts the create-side JE for a split. Idempotent on source_type='split'/source_id=splitId.
export async function postSplitCreateJe(
  env: Env,
  split: { id: string; counterparty_id: string; direction: SplitDirection; original_cents: number; reason: string; created_at: string },
): Promise<string | null> {
  const existing = await env.DB.prepare(
    `SELECT id FROM journal_entries WHERE source_type = 'split' AND source_id = ? LIMIT 1`,
  )
    .bind(split.id)
    .first<{ id: string }>();
  if (existing) return existing.id;
  const cpAccountId = await resolveCounterpartyGl(env, split.counterparty_id);
  const lines = splitCreateLines({ direction: split.direction, amount_cents: split.original_cents, cpAccountId });
  if (lines.length === 0) return null;
  return postJournalEntry(env, lines, {
    posted_at: split.created_at,
    source_type: 'split',
    source_id: split.id,
    memo: `chit · ${split.reason}`,
  });
}

// Posts the event-side JE for a split_event. Idempotent on source_type='split_event'/source_id=eventId.
// If transaction_id is set, the existing transaction JE is replaced.
export async function postSplitEventJe(
  env: Env,
  args: {
    event_id: string;
    split_id: string;
    direction: SplitDirection;
    delta_cents: number;
    transaction_id: string | null;
    posted_at: string;
    note: string | null;
  },
): Promise<string | null> {
  const existing = await env.DB.prepare(
    `SELECT id FROM journal_entries WHERE source_type = 'split_event' AND source_id = ? LIMIT 1`,
  )
    .bind(args.event_id)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const split = await env.DB.prepare(
    `SELECT counterparty_id FROM splits WHERE id = ?`,
  )
    .bind(args.split_id)
    .first<{ counterparty_id: string }>();
  if (!split) return null;
  const cpAccountId = await resolveCounterpartyGl(env, split.counterparty_id);

  const cashAccountId = args.transaction_id
    ? await resolveTxnCashGl(env, args.transaction_id)
    : 'gla_equity_opening';

  if (args.transaction_id) {
    await deleteTxnSourceJe(env, args.transaction_id);
  }

  const lines = splitEventLines({
    direction: args.direction,
    delta_cents: args.delta_cents,
    cpAccountId,
    cashAccountId,
  });
  if (lines.length === 0) return null;
  return postJournalEntry(env, lines, {
    posted_at: args.posted_at,
    source_type: 'split_event',
    source_id: args.event_id,
    memo: args.note ?? null,
  });
}

// ----- backfill ------------------------------------------------------------

export interface ArApBackfillResult {
  splits_scanned: number;
  splits_posted: number;
  splits_skipped: number;
  events_scanned: number;
  events_posted: number;
  events_skipped: number;
}

// Idempotent. Walks all splits + split_events, posts JEs for any not yet
// recorded. Safe to re-run.
export async function runArApBackfill(env: Env): Promise<ArApBackfillResult> {
  const result: ArApBackfillResult = {
    splits_scanned: 0,
    splits_posted: 0,
    splits_skipped: 0,
    events_scanned: 0,
    events_posted: 0,
    events_skipped: 0,
  };

  const splits = await env.DB.prepare(
    `SELECT id, counterparty_id, direction, original_cents, reason, created_at
     FROM splits ORDER BY created_at ASC`,
  ).all<{
    id: string;
    counterparty_id: string;
    direction: SplitDirection;
    original_cents: number;
    reason: string;
    created_at: string;
  }>();

  for (const s of splits.results ?? []) {
    result.splits_scanned += 1;
    const before = await env.DB.prepare(
      `SELECT id FROM journal_entries WHERE source_type = 'split' AND source_id = ? LIMIT 1`,
    )
      .bind(s.id)
      .first<{ id: string }>();
    if (before) {
      result.splits_skipped += 1;
      continue;
    }
    await postSplitCreateJe(env, s);
    result.splits_posted += 1;
  }

  const events = await env.DB.prepare(
    `SELECT e.id, e.split_id, e.delta_cents, e.transaction_id, e.note, e.created_at,
            s.direction, COALESCE(t.posted_at, e.created_at) AS posted_at
     FROM split_events e
     JOIN splits s ON s.id = e.split_id
     LEFT JOIN transactions t ON t.id = e.transaction_id
     ORDER BY e.created_at ASC`,
  ).all<{
    id: string;
    split_id: string;
    delta_cents: number;
    transaction_id: string | null;
    note: string | null;
    created_at: string;
    direction: SplitDirection;
    posted_at: string;
  }>();

  for (const ev of events.results ?? []) {
    result.events_scanned += 1;
    const before = await env.DB.prepare(
      `SELECT id FROM journal_entries WHERE source_type = 'split_event' AND source_id = ? LIMIT 1`,
    )
      .bind(ev.id)
      .first<{ id: string }>();
    if (before) {
      result.events_skipped += 1;
      continue;
    }
    await postSplitEventJe(env, {
      event_id: ev.id,
      split_id: ev.split_id,
      direction: ev.direction,
      delta_cents: ev.delta_cents,
      transaction_id: ev.transaction_id,
      posted_at: ev.posted_at,
      note: ev.note,
    });
    result.events_posted += 1;
  }

  // newId import is for symmetry with other lib files; not used here.
  void newId;
  return result;
}
