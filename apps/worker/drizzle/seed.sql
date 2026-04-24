-- Seed data: default categories, TFSA room table, initial phase, merchant norm version.

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('merchant_norm_version', '1'),
  ('current_phase', '1'),
  ('tfsa_eligibility_year', '2009'),
  ('reconciliation_streak', '0');

-- TFSA annual limits (cents). 2026 value persists from settings at launch; update when CRA publishes.
INSERT OR IGNORE INTO tfsa_room (year, contribution_limit_cents, used_cents) VALUES
  (2009, 500000, 0), (2010, 500000, 0), (2011, 500000, 0), (2012, 500000, 0),
  (2013, 550000, 0), (2014, 550000, 0),
  (2015, 1000000, 0),
  (2016, 550000, 0), (2017, 550000, 0), (2018, 550000, 0),
  (2019, 600000, 0), (2020, 600000, 0), (2021, 600000, 0), (2022, 600000, 0),
  (2023, 650000, 0),
  (2024, 700000, 0), (2025, 700000, 0),
  (2026, 700000, 0); -- placeholder until CRA publishes

-- Default categories. IDs are stable slugs.
INSERT OR IGNORE INTO categories (id, name, "group", parent_id) VALUES
  ('cat_rent', 'Rent', 'essentials', NULL),
  ('cat_utilities', 'Utilities', 'essentials', NULL),
  ('cat_groceries', 'Groceries', 'essentials', NULL),
  ('cat_transit', 'Transit', 'essentials', NULL),
  ('cat_insurance', 'Insurance', 'essentials', NULL),
  ('cat_phone', 'Phone', 'essentials', NULL),
  ('cat_internet', 'Internet', 'essentials', NULL),
  ('cat_medical', 'Medical', 'essentials', NULL),

  ('cat_dining', 'Dining', 'lifestyle', NULL),
  ('cat_shopping', 'Shopping', 'lifestyle', NULL),
  ('cat_entertainment', 'Entertainment', 'lifestyle', NULL),
  ('cat_subscriptions', 'Subscriptions', 'lifestyle', NULL),
  ('cat_travel', 'Travel', 'lifestyle', NULL),
  ('cat_fitness', 'Fitness', 'lifestyle', NULL),

  ('cat_alcohol', 'Alcohol', 'vice', NULL),
  ('cat_cannabis', 'Cannabis', 'vice', NULL),
  ('cat_tobacco', 'Tobacco', 'vice', NULL),
  ('cat_gambling', 'Gambling', 'vice', NULL),
  ('cat_fastfood', 'Fast food', 'vice', NULL),

  ('cat_paycheque', 'Paycheque', 'income', NULL),
  ('cat_side_income', 'Side income', 'income', NULL),
  ('cat_refund', 'Refund', 'income', NULL),

  ('cat_transfer', 'Transfer', 'transfer', NULL),

  ('cat_cc_payment', 'CC Payment', 'debt', NULL),
  ('cat_loan_payment', 'Loan Payment', 'debt', NULL);

-- Bootstrap phase_log if empty.
INSERT OR IGNORE INTO phase_log (id, phase, entered_at, trigger_rule, metrics_json)
  VALUES ('phase_init', 1, datetime('now'), 'bootstrap', '{}');

-- Lindsay split (Mexico). Directional per locked decisions.
INSERT OR IGNORE INTO splits (id, counterparty, direction, original_cents, remaining_cents, reason, created_at)
  VALUES ('split_lindsay_mexico', 'Lindsay', 'josh_owes', 0, 0, 'Mexico trip', datetime('now'));
