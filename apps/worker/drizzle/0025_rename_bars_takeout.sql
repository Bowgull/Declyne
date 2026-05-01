-- 0025_rename_bars_takeout.sql
--
-- Renames two sub-categories for honesty + scope:
--   bars    → alcohol      (LCBO + bar tabs + wine at dinner all read as one bleed)
--   takeout → restaurants  (covers fast food + sit-down + counter-serve, the
--                           full "food I bought outside the home that wasn't
--                           a delivery app")
--
-- delivery (Uber Eats, DoorDash, Skip) stays untouched.
--
-- Idempotent. Re-running is a no-op once values are mapped.

UPDATE merchants SET sub_category = 'alcohol'     WHERE sub_category = 'bars';
UPDATE merchants SET sub_category = 'restaurants' WHERE sub_category = 'takeout';
