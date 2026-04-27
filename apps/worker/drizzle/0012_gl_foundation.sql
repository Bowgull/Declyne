-- Session 53: GL foundation. Double-entry substrate. No user-visible behavior change.
--
-- Three new tables sit alongside (not replacing) the existing transaction store:
--   gl_accounts    — chart of accounts (separate from bank `accounts` table)
--   journal_entries — header (posted_at, source_type, source_id, memo, locked_at)
--   journal_lines   — debit/credit lines, exactly one side non-zero per row
--
-- Trial balance must equal at all times. `postJournalEntry` enforces this in code;
-- this migration only enforces single-sided lines via CHECK.

CREATE TABLE IF NOT EXISTS gl_accounts (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id TEXT REFERENCES gl_accounts(id),
  archived_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gl_accounts_path_idx ON gl_accounts(path);
CREATE INDEX IF NOT EXISTS gl_accounts_parent_idx ON gl_accounts(parent_id);
CREATE INDEX IF NOT EXISTS gl_accounts_type_idx ON gl_accounts(type);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  posted_at TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  locked_at TEXT
);
CREATE INDEX IF NOT EXISTS journal_entries_posted_idx ON journal_entries(posted_at);
CREATE INDEX IF NOT EXISTS journal_entries_source_idx ON journal_entries(source_type, source_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
  account_id TEXT NOT NULL REFERENCES gl_accounts(id),
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK (debit_cents >= 0),
  CHECK (credit_cents >= 0),
  CHECK ((debit_cents = 0 AND credit_cents > 0) OR (debit_cents > 0 AND credit_cents = 0))
);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines(account_id);

-- Chart of accounts seed. Stable IDs so backfill kernels can look up by path.
INSERT OR IGNORE INTO gl_accounts (id, path, name, type, parent_id, created_at) VALUES
  ('gla_assets',           'Assets',                              'Assets',                  'asset',     NULL,         '2026-04-27T00:00:00.000Z'),
  ('gla_assets_cash',      'Assets:Cash',                         'Cash',                    'asset',     'gla_assets', '2026-04-27T00:00:00.000Z'),
  ('gla_assets_invest',    'Assets:Investments',                  'Investments',             'asset',     'gla_assets', '2026-04-27T00:00:00.000Z'),
  ('gla_assets_recv',      'Assets:Receivable',                   'Receivable',              'asset',     'gla_assets', '2026-04-27T00:00:00.000Z'),

  ('gla_liab',             'Liabilities',                         'Liabilities',             'liability', NULL,         '2026-04-27T00:00:00.000Z'),
  ('gla_liab_cc',          'Liabilities:CreditCards',             'Credit Cards',            'liability', 'gla_liab',   '2026-04-27T00:00:00.000Z'),
  ('gla_liab_loans',       'Liabilities:Loans',                   'Loans',                   'liability', 'gla_liab',   '2026-04-27T00:00:00.000Z'),
  ('gla_liab_pay',         'Liabilities:Payable',                 'Payable',                 'liability', 'gla_liab',   '2026-04-27T00:00:00.000Z'),

  ('gla_equity',           'Equity',                              'Equity',                  'equity',    NULL,         '2026-04-27T00:00:00.000Z'),
  ('gla_equity_opening',   'Equity:Opening Balance',              'Opening Balance',         'equity',    'gla_equity', '2026-04-27T00:00:00.000Z'),
  ('gla_equity_retained',  'Equity:Retained Earnings',            'Retained Earnings',       'equity',    'gla_equity', '2026-04-27T00:00:00.000Z'),
  ('gla_equity_unrealized','Equity:Unrealized Gains/Losses',      'Unrealized Gains/Losses', 'equity',    'gla_equity', '2026-04-27T00:00:00.000Z'),
  ('gla_equity_realized',  'Equity:Realized Gains/Losses',        'Realized Gains/Losses',   'equity',    'gla_equity', '2026-04-27T00:00:00.000Z'),

  ('gla_income',           'Income',                              'Income',                  'income',    NULL,         '2026-04-27T00:00:00.000Z'),
  ('gla_income_salary',    'Income:Salary',                       'Salary',                  'income',    'gla_income', '2026-04-27T00:00:00.000Z'),
  ('gla_income_reimburse', 'Income:Reimbursement',                'Reimbursement',           'income',    'gla_income', '2026-04-27T00:00:00.000Z'),
  ('gla_income_invest',    'Income:Investment',                   'Investment',              'income',    'gla_income', '2026-04-27T00:00:00.000Z'),
  ('gla_income_transfer',  'Income:Transfer',                     'Transfer (clearing)',     'income',    'gla_income', '2026-04-27T00:00:00.000Z'),

  ('gla_expense',          'Expenses',                            'Expenses',                'expense',   NULL,          '2026-04-27T00:00:00.000Z'),
  ('gla_exp_essentials',   'Expenses:Essentials',                 'Essentials',              'expense',   'gla_expense', '2026-04-27T00:00:00.000Z'),
  ('gla_exp_lifestyle',    'Expenses:Lifestyle',                  'Lifestyle',               'expense',   'gla_expense', '2026-04-27T00:00:00.000Z'),
  ('gla_exp_indulgence',   'Expenses:Indulgence',                 'Indulgence',              'expense',   'gla_expense', '2026-04-27T00:00:00.000Z'),
  ('gla_exp_debt',         'Expenses:Debt Service',               'Debt Service',            'expense',   'gla_expense', '2026-04-27T00:00:00.000Z'),
  ('gla_exp_savings',      'Expenses:Savings',                    'Savings',                 'expense',   'gla_expense', '2026-04-27T00:00:00.000Z'),
  ('gla_exp_uncat',        'Expenses:Uncategorized',              'Uncategorized',           'expense',   'gla_expense', '2026-04-27T00:00:00.000Z');
