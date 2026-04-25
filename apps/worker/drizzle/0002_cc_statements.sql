-- CC statement snapshots: one row per credit-card statement cycle.
-- Used by streaks.ts to compute cc_payoff_streak from real statement data
-- ("paid balance in full"), falling back to pay-period heuristic when empty.

CREATE TABLE cc_statement_snapshots (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id),
  statement_date TEXT NOT NULL,
  statement_balance_cents INTEGER NOT NULL,
  min_payment_cents INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  paid_in_full INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_cc_statements_debt_date ON cc_statement_snapshots(debt_id, statement_date DESC);
CREATE INDEX idx_cc_statements_date ON cc_statement_snapshots(statement_date DESC);
