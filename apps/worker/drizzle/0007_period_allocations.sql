-- Paycheque allocations rework. Replaces routing_plan with a real allocation
-- plan across all 5 outflow groups. Every dollar in has a home out, with an
-- explicit "Unassigned" remainder shown in the UI (never auto-routed).
--
-- Reconcile both manually (stamp PAID) and via CSV auto-match (unique amount +
-- linked-account + ±3d window auto-stamps; ambiguous matches surface in
-- Reconciliation alongside splits).

DROP TABLE IF EXISTS routing_plan;

CREATE TABLE period_allocations (
  id TEXT PRIMARY KEY,
  pay_period_id TEXT NOT NULL REFERENCES pay_periods(id),
  category_group TEXT NOT NULL CHECK (category_group IN ('essentials','lifestyle','debt','savings','indulgence')),
  label TEXT NOT NULL,
  planned_cents INTEGER NOT NULL,
  matched_txn_id TEXT REFERENCES transactions(id),
  stamped_at TEXT,
  stamped_by TEXT CHECK (stamped_by IN ('user','csv_match')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_period_allocations_period ON period_allocations(pay_period_id);
CREATE INDEX idx_period_allocations_matched ON period_allocations(matched_txn_id);
