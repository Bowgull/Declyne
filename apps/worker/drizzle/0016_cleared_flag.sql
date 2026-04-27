-- Session 62 (Accounting Upgrade Program session 57): bank reconciliation rebuild.
--
-- Adds nullable `cleared_at` to journal_lines so each side of a journal entry
-- can clear independently against the bank statement. Existing data unchanged
-- (everything starts uncleared). The reconciliation page reads cleared/uncleared
-- per asset+liability GL account and seals the week only when uncleared lists
-- are empty (or explicitly acknowledged outstanding).

ALTER TABLE journal_lines ADD COLUMN cleared_at TEXT;
CREATE INDEX IF NOT EXISTS journal_lines_cleared_idx ON journal_lines(cleared_at);
