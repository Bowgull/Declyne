// Derive cc_statement_snapshots rows from CC account transactions.
// Pure helper: given a CC-linked debt and its linked-account txns, walk each
// closed statement cycle and emit a snapshot row (charges proxy for balance,
// payments vs charges for paid_in_full). Existing snapshots are skipped.

import { requiredMinPaymentCents } from './streaks.js';

export interface CcDebtInfo {
  debt_id: string;
  principal_cents: number;
  statement_day: number;
  due_day: number;
  min_payment_type: 'fixed' | 'percent';
  min_payment_value: number;
}

export interface CcTxnPoint {
  posted_at: string;
  amount_cents: number;
}

export interface ExistingCcStatement {
  statement_date: string;
}

export interface DerivedCcStatement {
  debt_id: string;
  statement_date: string;
  statement_balance_cents: number;
  min_payment_cents: number;
  due_date: string;
  paid_in_full: 0 | 1;
}

function clampDay(year: number, month0: number, day: number): number {
  const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(Math.max(1, day), last);
}

function iso(year: number, month0: number, day: number): string {
  const d = clampDay(year, month0, day);
  return `${year.toString().padStart(4, '0')}-${(month0 + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

function dueFor(statementIso: string, dueDay: number): string {
  const y = Number(statementIso.slice(0, 4));
  const m = Number(statementIso.slice(5, 7)) - 1;
  const sd = Number(statementIso.slice(8, 10));
  if (dueDay > sd) return iso(y, m, dueDay);
  const nextM = m === 11 ? 0 : m + 1;
  const nextY = m === 11 ? y + 1 : y;
  return iso(nextY, nextM, dueDay);
}

export function deriveCcStatements(
  debt: CcDebtInfo,
  txns: CcTxnPoint[],
  existing: ExistingCcStatement[],
  today: Date,
): DerivedCcStatement[] {
  if (txns.length === 0) return [];
  const sorted = txns.slice().sort((a, b) => (a.posted_at < b.posted_at ? -1 : 1));
  const first = sorted[0];
  if (!first) return [];
  const firstIso = first.posted_at.slice(0, 10);
  const firstY = Number(firstIso.slice(0, 4));
  const firstM = Number(firstIso.slice(5, 7)) - 1;

  const todayIso = today.toISOString().slice(0, 10);
  const tY = Number(todayIso.slice(0, 4));
  const tM = Number(todayIso.slice(5, 7)) - 1;

  const statementDates: string[] = [];
  let y = firstY;
  let m = firstM;
  while (y < tY || (y === tY && m <= tM + 1)) {
    statementDates.push(iso(y, m, debt.statement_day));
    if (m === 11) {
      m = 0;
      y++;
    } else {
      m++;
    }
  }

  const existingSet = new Set(existing.map((e) => e.statement_date));
  const out: DerivedCcStatement[] = [];

  for (let i = 0; i < statementDates.length; i++) {
    const stmt = statementDates[i]!;
    const prev = i === 0 ? null : statementDates[i - 1]!;
    const due = dueFor(stmt, debt.due_day);
    if (due > todayIso) continue;
    if (existingSet.has(stmt)) continue;

    let charges = 0;
    let payments = 0;
    for (const t of sorted) {
      const d = t.posted_at.slice(0, 10);
      if (prev !== null && d <= prev) continue;
      if (d <= stmt) {
        if (t.amount_cents < 0) charges += -t.amount_cents;
      } else if (d <= due) {
        if (t.amount_cents > 0) payments += t.amount_cents;
      }
    }

    if (charges <= 0) continue;

    const minCents = requiredMinPaymentCents({
      debt_id: debt.debt_id,
      principal_cents: charges,
      min_payment_type: debt.min_payment_type,
      min_payment_value: debt.min_payment_value,
      payment_due_date: debt.due_day,
    });

    out.push({
      debt_id: debt.debt_id,
      statement_date: stmt,
      statement_balance_cents: charges,
      min_payment_cents: minCents,
      due_date: due,
      paid_in_full: payments >= charges ? 1 : 0,
    });
  }

  return out;
}
