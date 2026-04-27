-- Rename splits.direction enum from josh_owes/owes_josh to i_owe/they_owe.
-- First-person relative terms decouple the schema from the dev identity.
-- Required before multi-user/demo work.
--
-- splits.direction was created with a CHECK (direction IN ('josh_owes','owes_josh'))
-- in 0000_init.sql. SQLite cannot ALTER a CHECK, so we rebuild splits.
-- split_events.split_id has an FK to splits(id); D1 enforces FKs and disallows
-- DROP TABLE splits while child rows reference it. We rebuild split_events too,
-- preserving data, with FK pointed at the new splits table.

CREATE TABLE splits_new (
  id TEXT PRIMARY KEY,
  counterparty_id TEXT REFERENCES counterparties(id),
  direction TEXT NOT NULL CHECK (direction IN ('i_owe','they_owe')),
  original_cents INTEGER NOT NULL,
  remaining_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  source_txn_id TEXT REFERENCES transactions(id),
  settlement_txn_id TEXT REFERENCES transactions(id)
);

INSERT INTO splits_new (id, counterparty_id, direction, original_cents, remaining_cents, reason, created_at, closed_at, source_txn_id, settlement_txn_id)
SELECT id, counterparty_id,
  CASE direction WHEN 'josh_owes' THEN 'i_owe' WHEN 'owes_josh' THEN 'they_owe' END,
  original_cents, remaining_cents, reason, created_at, closed_at, source_txn_id, settlement_txn_id
FROM splits;

CREATE TABLE split_events_new (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL REFERENCES splits_new(id),
  delta_cents INTEGER NOT NULL,
  transaction_id TEXT REFERENCES transactions(id),
  note TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO split_events_new SELECT id, split_id, delta_cents, transaction_id, note, created_at FROM split_events;

DROP TABLE split_events;
DROP TABLE splits;

ALTER TABLE splits_new RENAME TO splits;
ALTER TABLE split_events_new RENAME TO split_events;
