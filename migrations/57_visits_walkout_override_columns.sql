-- =============================================
-- Migration 57: visits walkout / override columns (Module 4 gap fix)
-- Required by Visit entity — fixes optometry queue 500 (override_authorized_by)
-- =============================================

ALTER TABLE visits ADD COLUMN IF NOT EXISTS override_authorized_by UUID;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS override_reason VARCHAR(100);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS walkout_at TIMESTAMPTZ;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS walkout_reason VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_visits_override_authorized_by ON visits (override_authorized_by);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FK_visits_users_override_authorized_by'
    ) THEN
        ALTER TABLE visits
            ADD CONSTRAINT FK_visits_users_override_authorized_by
            FOREIGN KEY (override_authorized_by) REFERENCES users(id);
    END IF;
END $$;
