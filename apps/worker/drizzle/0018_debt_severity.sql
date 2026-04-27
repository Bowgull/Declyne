-- Session 64 (program session 59): debt severity column.
--
-- Severity drives the payment plan kernel's hybrid ordering:
--   in_collections → charged_off → past_due (Tier 1, smallest-balance-first)
--   current / settled_partial → Tier 2 avalanche (highest APR first)
-- Mins are always paid first regardless of severity.
--
-- Manual only — no automatic inference. Default 'current' on backfill.

ALTER TABLE debts ADD COLUMN severity TEXT NOT NULL DEFAULT 'current'
  CHECK (severity IN ('current', 'past_due', 'in_collections', 'charged_off', 'settled_partial'));

ALTER TABLE debts ADD COLUMN severity_changed_at TEXT;

CREATE INDEX IF NOT EXISTS debts_severity_idx ON debts(severity);
