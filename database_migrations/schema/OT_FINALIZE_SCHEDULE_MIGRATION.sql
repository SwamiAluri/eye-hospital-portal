-- =============================================================================
-- OT FINALIZE SCHEDULE MIGRATION
-- Created: 2026-03-26
-- Purpose: OT scheduling state machine (Counsellor → OT finalization)
--          NotConfirmed → Confirmed → Finalised → OTPrepared (locked)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. OT FINALIZE SCHEDULE TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ot_finalize_schedule (
    -- Primary identity
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    branch_id               UUID,

    -- Patient (denormalized for display performance)
    patient_id              UUID NOT NULL,
    uhid                    TEXT,
    patient_name            TEXT NOT NULL,
    surgery_name            TEXT NOT NULL,
    eye                     TEXT,                            -- RE | LE | BE
    patient_type            TEXT,
    payment_mode            TEXT,

    -- Team
    doctor_id               UUID,                           -- FK → AspNetUsers
    doctor_name             TEXT,
    theatre_id              UUID,                           -- FK → ot_theaters
    theatre_name            TEXT,

    -- Timing
    start_time              TIMESTAMPTZ,
    end_time                TIMESTAMPTZ,

    -- State machine
    status                  TEXT NOT NULL DEFAULT 'NotConfirmed'
                                CONSTRAINT chk_ot_finalize_status
                                CHECK (status IN (
                                    'NotConfirmed',
                                    'Confirmed',
                                    'Finalised',
                                    'OTPrepared',
                                    'Cancelled',
                                    'SurgeryDone'
                                )),

    -- OT Prepare data
    sequence_no             INT,
    is_locked               BOOLEAN NOT NULL DEFAULT FALSE,
    prepared_at             TIMESTAMPTZ,
    prepared_by             TEXT,

    -- Optimistic versioning
    version                 INT NOT NULL DEFAULT 1,

    -- Link back to counselling session
    counselling_session_id  UUID,

    -- Standard audit columns (HIPAA)
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ                     -- soft delete
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. UNIQUE PARTIAL INDEX — one active OT record per patient
--    Prevents duplicate entries when counsellor marks Done + Schedule multiple times
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_finalize_patient_active
    ON ot_finalize_schedule(patient_id)
    WHERE status NOT IN ('Cancelled', 'SurgeryDone')
      AND deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REMOVED — ux_ot_finalize_prepared_date (one OTPrepared per tenant/date)
--    Legacy unique partial index conflicted with multi-patient PrepareOtListAsync.
--    Dropped by AuthService migration 20260923183000_DropOtFinalizePreparedDateUniqueIndex
--    / Database/20260923183000_drop_ot_finalize_prepared_date_unique.sql (FS-G-13).
--    Do NOT recreate on fresh installs.
-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_finalize_prepared_date
--     ON ot_finalize_schedule(DATE(start_time AT TIME ZONE 'UTC'), tenant_id)
--     WHERE status = 'OTPrepared'
--       AND deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. OT FINALIZE AUDIT LOG TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ot_finalize_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES ot_finalize_schedule(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,                          -- Confirm | Finalise | Cancel | Reopen | Prepare | EditSlot | Upsert | BackSync
    old_status      TEXT,
    new_status      TEXT,
    old_value       JSONB,                                  -- snapshot before change
    new_value       JSONB,                                  -- snapshot after change
    changed_by      TEXT,
    changed_by_id   UUID,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW-LEVEL SECURITY (tenant isolation)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ot_finalize_schedule    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_finalize_audit_log   ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS (for migrations and admin ops)
CREATE POLICY ot_finalize_schedule_tenant_isolation
    ON ot_finalize_schedule
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Audit logs accessible when the parent schedule is accessible
CREATE POLICY ot_finalize_audit_log_tenant_isolation
    ON ot_finalize_audit_log
    FOR ALL
    USING (
        schedule_id IN (
            SELECT id FROM ot_finalize_schedule
            WHERE tenant_id::text = current_setting('app.current_tenant_id', true)
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INDEXES FOR QUERY PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ot_finalize_tenant    ON ot_finalize_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ot_finalize_status    ON ot_finalize_schedule(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ot_finalize_date      ON ot_finalize_schedule(DATE(start_time AT TIME ZONE 'UTC'));
CREATE INDEX IF NOT EXISTS idx_ot_finalize_patient   ON ot_finalize_schedule(patient_id);
CREATE INDEX IF NOT EXISTS idx_ot_finalize_session   ON ot_finalize_schedule(counselling_session_id) WHERE counselling_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ot_audit_schedule     ON ot_finalize_audit_log(schedule_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SEED DATA (sample records for development / demo)
--    Uses a well-known test tenant UUID matching the seeded tenant in the system
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_tenant    UUID := '11111111-1111-1111-1111-111111111111';
    v_patient1  UUID;
    v_patient2  UUID;
    v_patient3  UUID;
BEGIN
    -- Resolve real patient UUIDs for the seed tenant (any 3 active patients).
    -- Falls back to gen_random_uuid() only when no patients exist at all.
    SELECT id INTO v_patient1 FROM patient
        WHERE tenant_id = v_tenant AND deleted_at IS NULL ORDER BY created_at LIMIT 1 OFFSET 0;
    SELECT id INTO v_patient2 FROM patient
        WHERE tenant_id = v_tenant AND deleted_at IS NULL ORDER BY created_at LIMIT 1 OFFSET 1;
    SELECT id INTO v_patient3 FROM patient
        WHERE tenant_id = v_tenant AND deleted_at IS NULL ORDER BY created_at LIMIT 1 OFFSET 2;

    -- If the seed tenant has no patients, try the primary real tenant
    IF v_patient1 IS NULL THEN
        SELECT id INTO v_patient1 FROM patient WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1 OFFSET 0;
        SELECT id INTO v_patient2 FROM patient WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1 OFFSET 1;
        SELECT id INTO v_patient3 FROM patient WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1 OFFSET 2;
    END IF;

    -- Still null — use random UUIDs as last resort
    v_patient1 := COALESCE(v_patient1, gen_random_uuid());
    v_patient2 := COALESCE(v_patient2, gen_random_uuid());
    v_patient3 := COALESCE(v_patient3, gen_random_uuid());

    -- Only seed if table is empty for this tenant
    IF NOT EXISTS (SELECT 1 FROM ot_finalize_schedule WHERE tenant_id = v_tenant) THEN

        INSERT INTO ot_finalize_schedule (
            tenant_id, patient_id, uhid, patient_name, surgery_name, eye,
            patient_type, payment_mode,
            doctor_name, theatre_name,
            start_time, end_time,
            status, version
        ) VALUES
        (
            v_tenant,
            v_patient1, 'UHID001', 'Ravi Kumar', 'Phacoemulsification', 'RE',
            'General', 'Cash',
            'Dr. Sharma', 'OT-1',
            NOW() + INTERVAL '1 day' + INTERVAL '9 hours',
            NOW() + INTERVAL '1 day' + INTERVAL '9 hours 45 minutes',
            'NotConfirmed', 1
        ),
        (
            v_tenant,
            v_patient2, 'UHID002', 'Meena Devi', 'LASIK', 'BE',
            'Insurance', 'TPA',
            'Dr. Verma', 'OT-2',
            NOW() + INTERVAL '1 day' + INTERVAL '10 hours',
            NOW() + INTERVAL '1 day' + INTERVAL '10 hours 30 minutes',
            'Confirmed', 1
        ),
        (
            v_tenant,
            v_patient3, 'UHID003', 'Arjun Patel', 'Vitrectomy', 'LE',
            'General', 'Cash',
            'Dr. Nair', 'OT-3',
            NOW() + INTERVAL '1 day' + INTERVAL '11 hours',
            NOW() + INTERVAL '1 day' + INTERVAL '11 hours 45 minutes',
            'Finalised', 1
        );

    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run to validate after applying migration)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT tablename FROM pg_tables WHERE tablename IN ('ot_finalize_schedule', 'ot_finalize_audit_log');
-- SELECT indexname FROM pg_indexes WHERE tablename = 'ot_finalize_schedule';
-- SELECT status, COUNT(*) FROM ot_finalize_schedule GROUP BY status;
