-- Drop legacy splits.counterparty text column.
-- Migration 0006 added counterparty_id (FK to counterparties) and backfilled.
-- All reads/writes now go through the FK; the text column is dead weight.
ALTER TABLE splits DROP COLUMN counterparty;
