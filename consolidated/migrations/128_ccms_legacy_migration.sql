-- Migration 128: CCMS Legacy Pre-Auth → Coverage Cases Migration
-- Migrates existing insurance_pre_authorizations to ccms_coverage_cases
-- Run once after CCMS is fully adopted. Safe to re-run (idempotent via ON CONFLICT DO NOTHING).
-- Author: CCMS Implementation
-- Date: 2026-05-23

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add linkage column on ccms_coverage_cases for legacy pre-auth ID
--    (already added in migration 122 as legacy_preauth_id, just confirm)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ccms_coverage_cases'
          AND column_name = 'legacy_preauth_id'
    ) THEN
        ALTER TABLE ccms_coverage_cases
            ADD COLUMN legacy_preauth_id UUID REFERENCES insurance_pre_authorizations(id);
        COMMENT ON COLUMN ccms_coverage_cases.legacy_preauth_id IS 'Legacy pre-auth reference for migrated cases';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create migration audit log table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ccms_migration_log (
    id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id        UUID    NOT NULL,
    pre_auth_id      UUID    NOT NULL REFERENCES insurance_pre_authorizations(id),
    coverage_case_id UUID    REFERENCES ccms_coverage_cases(id),
    migrated_at      TIMESTAMPTZ DEFAULT now(),
    status           TEXT    NOT NULL DEFAULT 'success',    -- success | skipped | failed
    notes            TEXT,
    UNIQUE (tenant_id, pre_auth_id)
);

COMMENT ON TABLE ccms_migration_log IS 'Audit trail for legacy insurance_pre_authorizations → CCMS coverage cases migration';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Migration function: inserts a CCMS coverage case for each legacy pre-auth
--    that does not already have a CCMS case.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION migrate_legacy_preauths_to_ccms(
    p_tenant_id UUID,
    p_actor_user_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
    pre_auth_id      UUID,
    pre_auth_number  TEXT,
    coverage_case_id UUID,
    status           TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_rec        RECORD;
    v_case_id    UUID;
    v_fy_id      UUID;
    v_case_num   TEXT;
    v_counter    INT;
BEGIN
    -- Resolve active financial year for this tenant
    SELECT id INTO v_fy_id
    FROM financial_years
    WHERE tenant_id = p_tenant_id
      AND status = 'active'
    ORDER BY start_date DESC
    LIMIT 1;

    v_counter := 0;

    FOR v_rec IN
        SELECT p.*
        FROM insurance_pre_authorizations p
        LEFT JOIN ccms_coverage_cases c ON c.legacy_preauth_id = p.id
        WHERE p.tenant_id = p_tenant_id
          AND p.deleted_at IS NULL
          AND c.id IS NULL                 -- no CCMS case yet
          AND p.status NOT IN ('Deleted', 'Cancelled')
        ORDER BY p.created_at
    LOOP
        v_counter := v_counter + 1;
        v_case_num := 'CCMS-MIGR-' || lpad(v_counter::text, 6, '0');
        v_case_id  := gen_random_uuid();

        IF NOT p_dry_run THEN
            -- Insert the coverage case
            INSERT INTO ccms_coverage_cases (
                id, tenant_id, case_number,
                patient_id, patient_name,
                session_id, financial_year_id,
                payer_type, payment_type,
                insurance_provider_id,
                current_state,
                approved_amount,
                pre_auth_number,
                legacy_preauth_id,
                is_draft,
                created_at, updated_at,
                created_by_user_id, updated_by_user_id,
                status, row_version
            ) VALUES (
                v_case_id,
                p_tenant_id,
                v_case_num,
                v_rec.patient_id,
                v_rec.patient_name,
                v_rec.session_id,
                v_fy_id,
                COALESCE(v_rec.insurance_type, 'Insurance'),
                COALESCE(v_rec.insurance_type, 'Insurance'),
                v_rec.insurance_company_id,
                CASE v_rec.status
                    WHEN 'Approved'  THEN 'APPROVED'
                    WHEN 'Rejected'  THEN 'REJECTED'
                    WHEN 'Submitted' THEN 'WAITING_APPROVAL'
                    ELSE 'DRAFT'
                END,
                COALESCE(v_rec.approved_amount, 0),
                v_rec.pre_auth_number,
                v_rec.id,
                false,
                v_rec.created_at,
                now(),
                COALESCE(p_actor_user_id, v_rec.created_by_user_id),
                COALESCE(p_actor_user_id, v_rec.created_by_user_id),
                'active',
                1
            )
            ON CONFLICT (tenant_id, case_number) DO NOTHING;

            -- Log migration
            INSERT INTO ccms_migration_log (tenant_id, pre_auth_id, coverage_case_id, status)
            VALUES (p_tenant_id, v_rec.id, v_case_id, 'success')
            ON CONFLICT (tenant_id, pre_auth_id) DO NOTHING;
        END IF;

        pre_auth_id      := v_rec.id;
        pre_auth_number  := v_rec.pre_auth_number;
        coverage_case_id := v_case_id;
        status           := CASE WHEN p_dry_run THEN 'dry_run' ELSE 'migrated' END;
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION migrate_legacy_preauths_to_ccms IS
    'Migrates insurance_pre_authorizations to ccms_coverage_cases. '
    'Call with p_dry_run=true first to preview. '
    'Example: SELECT * FROM migrate_legacy_preauths_to_ccms(''<tenant-id>'', NULL, false);';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Sync primary policy → patient_insurance table helper
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_ccms_primary_policy_to_patient_insurance(
    p_case_id UUID
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_policy RECORD;
    v_case   RECORD;
BEGIN
    SELECT * INTO v_case FROM ccms_coverage_cases WHERE id = p_case_id;
    IF NOT FOUND THEN RETURN; END IF;

    SELECT * INTO v_policy
    FROM ccms_visit_insurance_policies
    WHERE coverage_case_id = p_case_id
      AND is_primary = true
      AND deleted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    -- Upsert into patient_insurance (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_insurance') THEN
        INSERT INTO patient_insurance (
            patient_id, tenant_id, policy_number,
            insurance_provider_id, tpa_provider_id,
            member_name, coverage_case_id, is_active,
            created_at, updated_at
        )
        VALUES (
            v_case.patient_id, v_case.tenant_id, v_policy.policy_number,
            v_policy.insurance_provider_id, v_policy.tpa_provider_id,
            v_policy.insured_name, p_case_id, true,
            now(), now()
        )
        ON CONFLICT (patient_id, tenant_id, policy_number) DO UPDATE
          SET insurance_provider_id = EXCLUDED.insurance_provider_id,
              tpa_provider_id       = EXCLUDED.tpa_provider_id,
              member_name           = EXCLUDED.member_name,
              coverage_case_id      = EXCLUDED.coverage_case_id,
              updated_at            = now();
    END IF;
END;
$$;

COMMENT ON FUNCTION sync_ccms_primary_policy_to_patient_insurance IS
    'Syncs the primary CCMS visit policy back to the patient_insurance lookup table. '
    'Called after setPrimaryPolicy in the application layer.';
