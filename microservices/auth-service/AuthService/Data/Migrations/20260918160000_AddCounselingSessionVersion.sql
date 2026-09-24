ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
UPDATE counseling_sessions SET version = 1 WHERE version IS NULL;
