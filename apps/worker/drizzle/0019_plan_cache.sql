-- Session 65 (program session 60): payment plan AI rationale cache.
--
-- One row per (debt set hash, paycheque, capacity) snapshot. The kernel result
-- is recomputed cheap; the AI rationale is the expensive part. We cache the
-- rationale text + observations keyed by a hash of the inputs that materially
-- affect the plan. Refresh writes a new row.

CREATE TABLE IF NOT EXISTS plan_cache (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  inputs_hash TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  rationale_text TEXT,
  observations_json TEXT,
  source TEXT NOT NULL CHECK (source IN ('ai', 'manual', 'pending'))
);

CREATE INDEX IF NOT EXISTS plan_cache_generated_idx ON plan_cache(generated_at DESC);
CREATE INDEX IF NOT EXISTS plan_cache_hash_idx ON plan_cache(inputs_hash);
