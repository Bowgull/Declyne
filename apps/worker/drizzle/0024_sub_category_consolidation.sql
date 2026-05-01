-- 0024_sub_category_consolidation.sql
--
-- Folds three sub-categories that turned out to be redundant:
--   gaming → entertainment   (gaming is just entertainment that costs money)
--   home   → shopping        (home goods are shopping)
--   health → personal_care   (pharmacy/dental/physio belong with body upkeep)
--
-- Also catches the session 98 rename leftovers that never had a migration:
--   fast_food → takeout      (renamed: takeout now means in-person quick-serve)
--   food      → groceries    (renamed: groceries is the new word)
--
-- We do NOT remap old `takeout` → `delivery` because the value is now ambiguous
-- (post-session-98 confirmations use takeout in the new sense). Any merchant
-- still mismatched will surface in the queue for the user to re-pick.
--
-- Idempotent: re-running is a no-op once values are mapped.

UPDATE merchants SET sub_category = 'entertainment' WHERE sub_category = 'gaming';
UPDATE merchants SET sub_category = 'shopping'      WHERE sub_category = 'home';
UPDATE merchants SET sub_category = 'personal_care' WHERE sub_category = 'health';
UPDATE merchants SET sub_category = 'takeout'       WHERE sub_category = 'fast_food';
UPDATE merchants SET sub_category = 'groceries'     WHERE sub_category = 'food';
