-- Payment links for splits (session 52: e-transfer payment links).
-- One split can have multiple historic links (resends), but only the most
-- recent active one is "live". Links auto-disable when the split settles.
CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL REFERENCES splits(id),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  security_answer TEXT,
  created_at TEXT NOT NULL,
  viewed_at TEXT,
  expires_at TEXT NOT NULL,
  disabled_at TEXT
);
CREATE INDEX IF NOT EXISTS payment_links_token_idx ON payment_links(token);
CREATE INDEX IF NOT EXISTS payment_links_split_idx ON payment_links(split_id);
