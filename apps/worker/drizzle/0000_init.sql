-- Declyne initial schema. 24 tables.
-- Hand-authored to avoid a drizzle-kit generate step at first bootstrap.
-- After installing deps you can regenerate: `pnpm db:generate`.

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  institution TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('chequing','savings','credit','loan')),
  currency TEXT NOT NULL DEFAULT 'CAD',
  last_import_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('essentials','lifestyle','vice','income','transfer','debt')),
  parent_id TEXT
);

CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  normalized_key TEXT NOT NULL UNIQUE,
  category_default_id TEXT REFERENCES categories(id),
  verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  posted_at TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description_raw TEXT NOT NULL,
  merchant_id TEXT REFERENCES merchants(id),
  category_id TEXT REFERENCES categories(id),
  dedup_hash TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('csv','manual')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_tx_account_posted ON transactions(account_id, posted_at DESC);
CREATE INDEX idx_tx_posted ON transactions(posted_at DESC);
CREATE INDEX idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX idx_tx_category ON transactions(category_id);

CREATE TABLE pay_periods (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  paycheque_cents INTEGER NOT NULL,
  source_account_id TEXT NOT NULL REFERENCES accounts(id)
);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES pay_periods(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  allocation_cents INTEGER NOT NULL
);

CREATE TABLE routing_plan (
  id TEXT PRIMARY KEY,
  pay_period_id TEXT NOT NULL REFERENCES pay_periods(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('account','category','debt')),
  target_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  executed_at TEXT
);

CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  principal_cents INTEGER NOT NULL,
  interest_rate_bps INTEGER NOT NULL,
  min_payment_type TEXT NOT NULL CHECK (min_payment_type IN ('fixed','percent')),
  min_payment_value INTEGER NOT NULL,
  statement_date INTEGER NOT NULL,
  payment_due_date INTEGER NOT NULL,
  account_id_linked TEXT REFERENCES accounts(id),
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE debt_payments (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id),
  transaction_id TEXT REFERENCES transactions(id),
  amount_cents INTEGER NOT NULL,
  posted_at TEXT NOT NULL
);

CREATE TABLE splits (
  id TEXT PRIMARY KEY,
  counterparty TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('josh_owes','owes_josh')),
  original_cents INTEGER NOT NULL,
  remaining_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE split_events (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL REFERENCES splits(id),
  delta_cents INTEGER NOT NULL,
  transaction_id TEXT REFERENCES transactions(id),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE edit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  actor TEXT NOT NULL CHECK (actor IN ('system','user','rules','ai')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_edit_log_entity ON edit_log(entity_type, entity_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Investment (6)
CREATE TABLE holdings (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  account_wrapper TEXT NOT NULL CHECK (account_wrapper IN ('tfsa','fhsa','rrsp','nonreg')),
  units INTEGER NOT NULL,
  avg_cost_cents INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE prices (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  close_cents INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (symbol, date)
);

CREATE TABLE signals (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  sma50 INTEGER,
  sma200 INTEGER,
  rsi14 INTEGER,
  momentum_30d INTEGER,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (symbol, date)
);

CREATE TABLE tfsa_room (
  year INTEGER PRIMARY KEY,
  contribution_limit_cents INTEGER NOT NULL,
  used_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recommendations (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  executed_at TEXT
);

CREATE TABLE market_snapshots (
  id TEXT PRIMARY KEY,
  as_of TEXT NOT NULL,
  boc_overnight_bps INTEGER,
  cad_usd INTEGER,
  tsx_close INTEGER,
  sp500_close INTEGER
);

-- Credit & Reset (2)
CREATE TABLE credit_snapshots (
  id TEXT PRIMARY KEY,
  as_of TEXT NOT NULL,
  score INTEGER NOT NULL,
  utilization_bps INTEGER NOT NULL,
  on_time_streak_days INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','equifax'))
);

CREATE TABLE phase_log (
  id TEXT PRIMARY KEY,
  phase INTEGER NOT NULL,
  entered_at TEXT NOT NULL,
  trigger_rule TEXT NOT NULL,
  metrics_json TEXT NOT NULL
);

-- Session (3)
CREATE TABLE behaviour_snapshots (
  id TEXT PRIMARY KEY,
  as_of TEXT NOT NULL,
  vice_ratio_bps INTEGER NOT NULL,
  days_to_zero INTEGER NOT NULL,
  cc_payoff_streak INTEGER NOT NULL,
  subscription_creep_pct_bps INTEGER NOT NULL,
  savings_increased_bool INTEGER NOT NULL,
  vice_peak_day INTEGER NOT NULL,
  review_queue_lag_days INTEGER NOT NULL,
  reconciliation_streak INTEGER NOT NULL
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  target_date TEXT NOT NULL,
  linked_account_id TEXT REFERENCES accounts(id),
  progress_cents INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE review_queue (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  reason TEXT NOT NULL CHECK (reason IN ('uncategorized','new_merchant','unusual_amount','split_candidate')),
  resolved_at TEXT
);
