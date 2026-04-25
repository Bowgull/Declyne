-- Drop dormant coach_messages table (coach removed end-to-end in session 25).
DROP INDEX IF EXISTS idx_coach_messages_generated;
DROP TABLE IF EXISTS coach_messages;
