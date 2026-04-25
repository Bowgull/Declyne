-- Counterparties table (per-person tab grouping for splits).
-- Splits are social IOUs; this table groups multiple chits per person so the
-- UI can show a running balance, drill into history, and long-press to "tear"
-- a new chit prefilled with that counterparty.
--
-- Splits never count toward institutional debt math (phase, routing,
-- non_mortgage_debt, indulgence ratio). They're bookkeeping, not freedom math.

CREATE TABLE IF NOT EXISTS counterparties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_settlement_method TEXT CHECK (default_settlement_method IN ('etransfer','cash','other')) DEFAULT 'etransfer',
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_counterparties_archived ON counterparties(archived_at);

-- Add counterparty_id FK to splits (nullable for now; backfilled below).
ALTER TABLE splits ADD COLUMN counterparty_id TEXT REFERENCES counterparties(id);

-- Backfill: one counterparties row per distinct splits.counterparty string.
INSERT INTO counterparties (id, name, default_settlement_method, archived_at, created_at)
SELECT
  'cp_' || lower(replace(replace(counterparty, ' ', '_'), '.', '')),
  counterparty,
  'etransfer',
  NULL,
  COALESCE(MIN(created_at), datetime('now'))
FROM splits
WHERE counterparty_id IS NULL
GROUP BY counterparty;

-- Wire the FK on existing splits.
UPDATE splits
SET counterparty_id = 'cp_' || lower(replace(replace(counterparty, ' ', '_'), '.', ''))
WHERE counterparty_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_splits_counterparty_id ON splits(counterparty_id);
