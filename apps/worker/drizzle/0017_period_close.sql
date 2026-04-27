-- Session 63 (Accounting Upgrade Program session 58): Period close + Net Worth.
--
-- period_close records each closed week. period_end is the last day of the
-- closed period (Saturday for Sun→Sat weeks). When a period is closed, every
-- journal_entry with posted_at <= period_end gets locked_at stamped, and
-- subsequent postJournalEntry calls inside that range return error
-- `period_locked`. Backdated edits go through reversing entries instead.
--
-- The trial balance is snapshotted at close time (must equal — close fails
-- otherwise) so post-close audits can prove the books were equal at seal.

CREATE TABLE IF NOT EXISTS period_close (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  closed_at TEXT NOT NULL,
  closed_by TEXT NOT NULL CHECK (closed_by IN ('user', 'auto', 'system')),
  trial_balance_debits_cents INTEGER NOT NULL,
  trial_balance_credits_cents INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS period_close_period_end_idx ON period_close(period_end);
CREATE INDEX IF NOT EXISTS journal_entries_locked_idx ON journal_entries(locked_at);
