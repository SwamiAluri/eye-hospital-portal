-- ============================================================================
-- Migration 146: Payer/payment mode on patient_journey (Financial workflow)
-- Purpose:
--   1. Add patient_journey.payment_mode so the Ward Pre-Op Financial step can
--      seed payer-specific clearance rows (Insurance / CGHS / ESI / Camp) and
--      display the payer. Previously null end-to-end → payer rows never seeded.
--   2. Backfill existing journeys from ot_finalize_schedule.patient_type
--      (the payer category), normalised to the pre_op_section_items
--      patient_type_filter vocabulary.
--   3. Amend the creation trigger so new journeys carry the normalised payer.
-- Dependencies: patient_journey (81), trigger fn (88), ot_finalize_schedule.
-- Note: pre_op_section_items.patient_type_filter uses Insurance|CGHS|ESI|Camp,
--       while master patient_type uses INSURANCE|CGHS|ESH|CAMP|TPA|COPAY|… —
--       hence the normalisation (notably ESH→ESI and TPA/COPAY→Insurance).
-- Date: 2026-06
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Column
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(30);

COMMENT ON COLUMN patient_journey.payment_mode IS
    'Payer category for the journey (Insurance|CGHS|ESI|Camp|Cash|…), normalised '
    'from ot_finalize_schedule.patient_type. Drives payer-specific Financial '
    'clearance rows and the Ward Pre-Op Financial summary.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Shared normalisation helper (master patient_type → pre-op filter token)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_normalize_payer(p_value TEXT)
RETURNS VARCHAR(30) LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN CASE UPPER(COALESCE(NULLIF(TRIM(p_value), ''), 'NULL'))
        WHEN 'INSURANCE' THEN 'Insurance'
        WHEN 'TPA'       THEN 'Insurance'
        WHEN 'COPAY'     THEN 'Insurance'
        WHEN 'CGHS'      THEN 'CGHS'
        WHEN 'ESH'       THEN 'ESI'
        WHEN 'ESI'       THEN 'ESI'
        WHEN 'CAMP'      THEN 'Camp'
        WHEN 'CASH'      THEN 'Cash'
        WHEN 'NULL'      THEN NULL
        ELSE initcap(TRIM(p_value))
    END;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill existing rows from the linked OT schedule's payer
--    (patient_type first; payment_mode only as a fallback)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE patient_journey pj
SET    payment_mode = fn_normalize_payer(COALESCE(ofs.patient_type, ofs.payment_mode))
FROM   ot_finalize_schedule ofs
WHERE  pj.ot_finalize_schedule_id = ofs.id
  AND  pj.payment_mode IS NULL
  AND  fn_normalize_payer(COALESCE(ofs.patient_type, ofs.payment_mode)) IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Amend the journey-creation trigger to set payment_mode going forward
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_create_patient_journey_on_ot_prepared()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_session_id        UUID;
    v_package_amount    DECIMAL(12,2);
    v_procedure_name    VARCHAR(300);
    v_eye_operated      VARCHAR(10);
    v_surgeon_id        UUID;
    v_anaesthesia       VARCHAR(100);
    v_surgery_date      TIMESTAMPTZ;
    v_iol_power         VARCHAR(50);
    v_patient_id        UUID;
    v_uhid              VARCHAR(50);
    v_tenant_id         UUID;
    v_branch_id         UUID;
    v_payment_mode      VARCHAR(30);
BEGIN
    -- Only fire when status transitions TO 'OTPrepared'
    IF NEW.status <> 'OTPrepared' OR OLD.status = 'OTPrepared' THEN
        RETURN NEW;
    END IF;

    -- Skip if a journey already exists for this ot_finalize_schedule_id
    IF EXISTS (
        SELECT 1 FROM patient_journey
        WHERE ot_finalize_schedule_id = NEW.id
          AND deleted_at IS NULL
    ) THEN
        RETURN NEW;
    END IF;

    -- Pull context from ot_finalize_schedule
    v_patient_id     := NEW.patient_id;
    v_tenant_id      := NEW.tenant_id;
    v_branch_id      := NEW.branch_id;
    v_surgeon_id     := NEW.doctor_id;
    v_eye_operated   := CASE NEW.eye
                            WHEN 'RE' THEN 'OD'
                            WHEN 'LE' THEN 'OS'
                            WHEN 'BE' THEN 'OU'
                            ELSE NEW.eye
                        END;
    v_surgery_date   := NEW.start_time;
    v_procedure_name := NEW.surgery_name;
    v_uhid           := NEW.uhid;
    -- Payer category (normalised) — patient_type first, payment_mode fallback
    v_payment_mode   := fn_normalize_payer(COALESCE(NEW.patient_type, NEW.payment_mode));

    -- Get package_amount, iol_power, and anesthesia from the linked counseling session
    v_session_id := NEW.counselling_session_id;
    IF v_session_id IS NOT NULL THEN
        SELECT package_amount, iol_power, anesthesia_type_choice
          INTO v_package_amount, v_iol_power, v_anaesthesia
        FROM counseling_sessions
        WHERE id = v_session_id;
    END IF;

    -- Insert the journey record
    INSERT INTO patient_journey (
        tenant_id, branch_id,
        patient_id, uhid,
        ot_finalize_schedule_id, counseling_session_id,
        procedure_name, eye_operated,
        primary_surgeon_id, anaesthesia_type,
        surgery_scheduled_at, iol_power,
        package_amount, payment_mode,
        clinical_state, ot_state, financial_state, post_op_state,
        created_by_user_id
    ) VALUES (
        v_tenant_id, v_branch_id,
        v_patient_id, v_uhid,
        NEW.id, v_session_id,
        v_procedure_name, v_eye_operated,
        v_surgeon_id, v_anaesthesia,
        v_surgery_date, v_iol_power,
        COALESCE(v_package_amount, 0), v_payment_mode,
        'Expected', 'NotSent', 'NotCreated', 'NotStarted',
        NEW.updated_by_user_id
    );

    RETURN NEW;
END;
$$;

COMMIT;
