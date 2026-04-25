-- Add transaction FK columns to splits for payment matching.
-- source_txn_id: the transaction that originated the split (e.g. the dinner bill txn).
-- settlement_txn_id: the transaction that settled it (e.g. the e-transfer received/sent).
-- Both are nullable; settlement_txn_id being set + closed_at being set = fully matched.
ALTER TABLE splits ADD COLUMN source_txn_id TEXT REFERENCES transactions(id);
ALTER TABLE splits ADD COLUMN settlement_txn_id TEXT REFERENCES transactions(id);
