-- Realistic Toronto bills for the Today screen's PRINTING AHEAD horizon.
-- Idempotent: stable ids + INSERT OR REPLACE.

-- Move fitness into essentials so Bloor Street Boxing surfaces as a bill.
UPDATE categories SET "group" = 'essentials' WHERE id = 'cat_fitness';

-- Rename Landlord -> Rent + bump to Toronto 1BR ($2,400).
UPDATE merchants SET display_name = 'Rent', normalized_key = 'rent' WHERE id = 'm_landlord';
UPDATE transactions SET amount_cents = -240000 WHERE merchant_id = 'm_landlord';

-- Rename Intact Insurance -> Car insurance + Toronto urban driver rate ($220).
UPDATE merchants SET display_name = 'Car insurance', normalized_key = 'car insurance' WHERE id = 'm_intact';
UPDATE transactions SET amount_cents = -22000 WHERE merchant_id = 'm_intact';

-- Rename Bell -> Fido + mid-tier plan ($72). Add a third occurrence so the
-- detector has the >=3 it needs.
UPDATE merchants SET display_name = 'Fido', normalized_key = 'fido' WHERE id = 'm_bell';
UPDATE transactions SET amount_cents = -7200, description_raw = 'FIDO MOBILE' WHERE merchant_id = 'm_bell';
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_phone_01', 'acc_td_chq', '2026-01-28', -7200, 'FIDO MOBILE', 'm_bell', 'cat_phone', 'h_phone_01', 'csv', '2026-01-28T09:00:00Z');

-- New: Bloor Street Boxing, monthly $165.
INSERT OR REPLACE INTO merchants (id, display_name, normalized_key, category_default_id, verified) VALUES
  ('m_boxing', 'Bloor Street Boxing', 'bloor street boxing', 'cat_fitness', 1);

INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_box_01', 'acc_td_chq', '2026-02-05', -16500, 'BLOOR STREET BOXING',  'm_boxing', 'cat_fitness', 'h_box_01', 'csv', '2026-02-05T09:00:00Z'),
  ('tx_box_02', 'acc_td_chq', '2026-03-05', -16500, 'BLOOR STREET BOXING',  'm_boxing', 'cat_fitness', 'h_box_02', 'csv', '2026-03-05T09:00:00Z'),
  ('tx_box_03', 'acc_td_chq', '2026-04-05', -16500, 'BLOOR STREET BOXING',  'm_boxing', 'cat_fitness', 'h_box_03', 'csv', '2026-04-05T09:00:00Z');
