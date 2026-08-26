-- ============================================================================
-- Migration 175: OPD clinical copy into patient_journey (W-01 / FR-1.1)
-- Purpose:
--   On OTPrepared journey create, copy procedure / laterality / planned IOL
--   from the OT schedule, then counselling session, then latest biometry for
--   that eye. Empty biometry leaves iol_power null (OT warns, does not block).
--   Second prepare for an existing schedule still skips insert (no blanking).
-- Also restores branch_id fallback from migration 94 (session → tenant first
--   branch) which 146 dropped when it rewrote this function, and keeps the
--   payment_mode copy from 146.
-- Dependencies: 146 (fn_normalize_payer, payment_mode), 94 (branch fallback),
--   biometry_records.calculated_iol, counseling_sessions.
-- Date: 2026-08
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_create_patient_journey_on_ot_prepared()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_session_id        UUID;
    v_package_amount    DECIMAL(12,2);
    v_procedure_name    VARCHAR(300);
    v_eye_operated      VARCHAR(10);
    v_eye_raw           TEXT;
    v_surgeon_id        UUID;
    v_anaesthesia       VARCHAR(100);
    v_surgery_date      TIMESTAMPTZ;
    v_iol_power         VARCHAR(50);
    v_session_iol       VARCHAR(50);
    v_session_surgery   VARCHAR(300);
    v_session_eye       VARCHAR(20);
    v_bio_iol           DECIMAL(6,2);
    v_bio_eye           VARCHAR(2);
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
    -- (second finalize / re-prepare must not insert and must not blank fields)
    IF EXISTS (
        SELECT 1 FROM patient_journey
        WHERE ot_finalize_schedule_id = NEW.id
          AND deleted_at IS NULL
    ) THEN
        RETURN NEW;
    END IF;

    v_patient_id     := NEW.patient_id;
    v_tenant_id      := NEW.tenant_id;
    v_branch_id      := NEW.branch_id;
    v_surgeon_id     := NEW.doctor_id;
    v_surgery_date   := NEW.start_time;
    v_uhid           := NEW.uhid;
    v_payment_mode   := fn_normalize_payer(COALESCE(NEW.patient_type, NEW.payment_mode));

    v_session_id := NEW.counselling_session_id;
    IF v_session_id IS NOT NULL THEN
        SELECT package_amount,
               NULLIF(TRIM(iol_power), ''),
               anesthesia_type_choice,
               branch_id,
               NULLIF(TRIM(recommended_surgery), ''),
               NULLIF(TRIM(surgery_tentative_eye), '')
          INTO v_package_amount, v_session_iol, v_anaesthesia,
               v_branch_id, v_session_surgery, v_session_eye
        FROM counseling_sessions
        WHERE id = v_session_id;

        IF NEW.branch_id IS NOT NULL THEN
            v_branch_id := NEW.branch_id;
        END IF;
    END IF;

    IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id
        FROM branch
        WHERE tenant_id = v_tenant_id
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    v_procedure_name := COALESCE(NULLIF(TRIM(NEW.surgery_name), ''), v_session_surgery);

    v_eye_raw := COALESCE(NULLIF(TRIM(NEW.eye), ''), v_session_eye);
    v_eye_operated := CASE UPPER(COALESCE(v_eye_raw, ''))
                          WHEN 'RE' THEN 'OD'
                          WHEN 'OD' THEN 'OD'
                          WHEN 'RIGHT' THEN 'OD'
                          WHEN 'LE' THEN 'OS'
                          WHEN 'OS' THEN 'OS'
                          WHEN 'LEFT' THEN 'OS'
                          WHEN 'BE' THEN 'OU'
                          WHEN 'OU' THEN 'OU'
                          WHEN 'BOTH' THEN 'OU'
                          ELSE NULLIF(TRIM(v_eye_raw), '')
                      END;

    v_iol_power := COALESCE(NULLIF(TRIM(NEW.iol_power), ''), v_session_iol);

    -- Latest biometry for a single operating eye only (OU/BE stays empty)
    IF v_iol_power IS NULL AND v_eye_operated IN ('OD', 'OS') THEN
        v_bio_eye := v_eye_operated;
        SELECT calculated_iol
          INTO v_bio_iol
        FROM biometry_records
        WHERE patient_id = NEW.patient_id
          AND tenant_id = NEW.tenant_id
          AND deleted_at IS NULL
          AND status = 'active'
          AND UPPER(eye) = v_bio_eye
          AND calculated_iol IS NOT NULL
        ORDER BY examination_date DESC, updated_at DESC
        LIMIT 1;

        IF v_bio_iol IS NOT NULL THEN
            v_iol_power := CASE
                WHEN v_bio_iol >= 0 THEN '+'
                ELSE ''
            END || TRIM(TO_CHAR(ROUND(v_bio_iol, 2), 'FM999990.00')) || ' D';
        END IF;
    END IF;

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

COMMENT ON FUNCTION fn_create_patient_journey_on_ot_prepared() IS
    'Auto-creates patient_journey (Expected) when ot_finalize_schedule → OTPrepared. '
    'Copies procedure / eye / iol_power from OT row, counselling session, then latest '
    'biometry for that eye. Empty biometry leaves iol_power null. Existing journey for '
    'the schedule is skipped (no blanking). branch_id: schedule → session → tenant first branch.';

COMMIT;
