-- Observability + coach narration.

CREATE TABLE cron_runs (
  id TEXT PRIMARY KEY,
  job TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok','error')),
  detail TEXT
);

CREATE INDEX idx_cron_runs_started ON cron_runs(started_at DESC);

CREATE TABLE coach_messages (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  snapshot_id TEXT REFERENCES behaviour_snapshots(id),
  phase INTEGER NOT NULL,
  prompt_hash TEXT NOT NULL,
  response_text TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE INDEX idx_coach_messages_generated ON coach_messages(generated_at DESC);
