-- Phase 3I Slice 8 — CounselorQueue active SessionId uniqueness
-- AuthService/Data/Migrations/20260921110000_CounselorQueueActiveSessionIdUnique.cs
--
-- Before: UNIQUE(session_id) on counselor_queue (blocks soft-delete + new Waiting)
-- After:  UNIQUE(session_id) WHERE deleted_at IS NULL

ALTER TABLE counselor_queue
    DROP CONSTRAINT IF EXISTS counselor_queue_session_id_key;

DROP INDEX IF EXISTS counselor_queue_session_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_counselor_queue_session_id_active
    ON counselor_queue (session_id)
    WHERE deleted_at IS NULL;
