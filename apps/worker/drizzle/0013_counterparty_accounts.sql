-- Session 54: AR/AP migration. Each counterparty becomes a NET GL account.
-- One account per person, type=asset under Assets:Receivable. A negative balance
-- means I currently owe them (the receivable flipped). No separate AP sub-tree
-- per person — flips are signed, not structural.

ALTER TABLE counterparties ADD COLUMN account_id TEXT REFERENCES gl_accounts(id);

-- Per-counterparty GL account, one row each. Stable id `gla_cp_<cp_id>`.
INSERT OR IGNORE INTO gl_accounts (id, path, name, type, parent_id, created_at)
SELECT
  'gla_cp_' || id,
  'Assets:Receivable:' || name,
  name,
  'asset',
  'gla_assets_recv',
  created_at
FROM counterparties;

UPDATE counterparties
SET account_id = 'gla_cp_' || id
WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS counterparties_account_idx ON counterparties(account_id);
