-- Adds goal_type column to goals table.
-- Locked vocab: emergency / vacation / rrsp / tfsa / fhsa / car / other.
-- Existing rows default to 'other'. Schema is additive — no data backfill needed.

ALTER TABLE goals ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'other'
  CHECK (goal_type IN ('emergency','vacation','rrsp','tfsa','fhsa','car','other'));

CREATE INDEX IF NOT EXISTS goals_type_idx ON goals(goal_type);
