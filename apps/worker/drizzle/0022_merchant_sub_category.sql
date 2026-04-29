-- Sub-category on merchants for the Habits map.
-- Locked vocab (lifestyle): food, transit, shopping, home, personal_care, entertainment, health.
-- Locked vocab (indulgence): bars, takeout, fast_food, weed, streaming, gaming, treats.
-- NULL = unconfirmed; the detector writes a guess on import and the user
-- approves it on the Habits queue. Once approved, the merchant becomes
-- sticky and future imports inherit through the existing normalized_key
-- collapse.

ALTER TABLE merchants ADD COLUMN sub_category TEXT;
ALTER TABLE merchants ADD COLUMN sub_category_confirmed INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS merchants_sub_category_idx ON merchants(sub_category);
CREATE INDEX IF NOT EXISTS merchants_sub_category_confirmed_idx ON merchants(sub_category_confirmed);
