-- Payment plan commitment layer.
-- Lets a generated plan be "accepted" so its per-paycheque debt allocations
-- become installments — surfaced on Today and checked at reconciliation.
-- Additive only: no data change for existing rows.

ALTER TABLE period_allocations ADD COLUMN plan_id TEXT REFERENCES plan_cache(id);
ALTER TABLE period_allocations ADD COLUMN committed_at TEXT;

CREATE INDEX IF NOT EXISTS period_allocations_plan_idx ON period_allocations(plan_id);
CREATE INDEX IF NOT EXISTS period_allocations_committed_idx ON period_allocations(committed_at);
