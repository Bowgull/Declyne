-- One-off seed: insert the 4 counterparties + 3 fictional Toronto splits
-- into live D1. seed_test.sql is the source of truth; this is a delta to bring
-- the running database in sync without re-running the full seed.

INSERT OR REPLACE INTO counterparties (id, name, default_settlement_method, archived_at, created_at) VALUES
  ('cp_bowgull',  'Bowgull',       'etransfer', NULL, '2026-01-15T12:00:00Z'),
  ('cp_marcus',   'Marcus Chen',   'etransfer', NULL, '2026-04-19T12:00:00Z'),
  ('cp_priya',    'Priya Shah',    'etransfer', NULL, '2026-04-15T12:00:00Z'),
  ('cp_diego',    'Diego Alvarez', 'etransfer', NULL, '2026-04-21T12:00:00Z');

-- Re-create the Bowgull Mexico split fresh (prior real-name row was purged earlier).
INSERT OR REPLACE INTO splits (id, counterparty_id, direction, original_cents, remaining_cents, reason, created_at, closed_at) VALUES
  ('split_bowgull_mexico','cp_bowgull','i_owe',150000,120000,'Mexico trip','2026-01-20T12:00:00Z',NULL),
  ('split_marcus_brunch','cp_marcus','they_owe',4750,4750,'Lady Marmalade brunch','2026-04-19T15:30:00Z',NULL),
  ('split_priya_tapas','cp_priya','i_owe',8200,8200,'Bar Raval tapas','2026-04-15T22:10:00Z',NULL),
  ('split_diego_pho','cp_diego','they_owe',3600,3600,'Golden Turtle dinner','2026-04-21T20:45:00Z',NULL);

INSERT OR REPLACE INTO split_events (id, split_id, delta_cents, transaction_id, note, created_at) VALUES
  ('se_bg_01','split_bowgull_mexico',-20000,NULL,'etransfer to Bowgull Feb','2026-02-20T12:00:00Z'),
  ('se_bg_02','split_bowgull_mexico',-10000,NULL,'etransfer to Bowgull Mar','2026-03-19T12:00:00Z');
