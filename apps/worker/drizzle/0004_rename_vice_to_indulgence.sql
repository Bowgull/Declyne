-- Rename "vice" category group to "indulgence" end-to-end.
-- The brand decision: indulgence is observed, not shamed. Same data, new name.

-- Step 1: rebuild categories table with new CHECK constraint and translate values.
PRAGMA foreign_keys = OFF;

CREATE TABLE categories_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('essentials','lifestyle','indulgence','income','transfer','debt','savings')),
  parent_id TEXT
);

INSERT INTO categories_new (id, name, "group", parent_id)
SELECT id, name,
  CASE WHEN "group" = 'vice' THEN 'indulgence' ELSE "group" END,
  parent_id
FROM categories;

DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;

PRAGMA foreign_keys = ON;

-- Step 2: rename behaviour_snapshots columns.
ALTER TABLE behaviour_snapshots RENAME COLUMN vice_ratio_bps TO indulgence_ratio_bps;
ALTER TABLE behaviour_snapshots RENAME COLUMN vice_peak_day TO indulgence_peak_day;
