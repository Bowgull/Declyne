-- Subscription verdicts.
-- One row per merchant whose recurring detection has been judged by the user.
-- Verdicts:
--   keep        — user explicitly wants this subscription
--   kill        — user wants to cancel; row stays visible until next charge fails
--   not_a_sub   — detector mis-flagged this; drop from standing-orders forever
-- Merchants with no row are "undecided" — the standing-orders surface shows
-- them with both stamps available.

CREATE TABLE IF NOT EXISTS subscription_verdicts (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  verdict TEXT NOT NULL CHECK (verdict IN ('keep', 'kill', 'not_a_sub')),
  set_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS subscription_verdicts_set_at_idx ON subscription_verdicts(set_at);
