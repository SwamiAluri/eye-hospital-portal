-- ============================================================================
-- Migration 180: OPD diagnosis snapshot onto patient_journey (Phase 20 / FR-1.1)
-- Purpose:
--   Persist counselling/OPD diagnosis onto patient_journey at OTPrepared create.
--   Source order: active patient_diagnosis + diagnosis_code (primary first),
--   else counseling_sessions.clinical_summary.diagnosis, else latest
--   clinical_examination.diagnosis. Procedure name is not a diagnosis.
--   Existing journey for the schedule is still skipped (no blanking / no dupes).
-- Semantics: fill-if-null snapshot. Explicit refresh-from-OPD is the HTTP path.
-- Date: 2026-08
-- ============================================================================

BEGIN;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS opd_diagnosis TEXT;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS opd_diagnosis_json JSONB;

COMMENT ON COLUMN patient_journey.opd_diagnosis IS
    'FR-1.1 OPD diagnosis summary snapshot written at onboard or Refresh from OPD. Not a live MPI reference.';
COMMENT ON COLUMN patient_journey.opd_diagnosis_json IS
    'FR-1.1 structured OPD diagnosis snapshot (icd10, description, laterality, diagnosisType, isPrimary).';

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
    v_clinical_summary  TEXT;
    v_session_dx        TEXT;
    v_dx_summary        TEXT;
    v_dx_json           JSONB;
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
               NULLIF(TRIM(surgery_tentative_eye), ''),
               clinical_summary::text
          INTO v_package_amount, v_session_iol, v_anaesthesia,
               v_branch_id, v_session_surgery, v_session_eye,
               v_clinical_summary
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

    -- OPD diagnosis snapshot (never from procedure / surgery name)
    SELECT COALESCE(jsonb_agg(src.obj ORDER BY src.pri, src.diagnosed_at), NULL)
      INTO v_dx_json
    FROM (
        SELECT jsonb_build_object(
                   'icd10', dc.code,
                   'description', dc.description,
                   'laterality', NULLIF(TRIM(COALESCE(pd.eye_specificity, dc.laterality)), ''),
                   'diagnosisType', pd.diagnosis_type,
                   'isPrimary', COALESCE(LOWER(pd.diagnosis_type) = 'primary', false)
               ) AS obj,
               CASE WHEN LOWER(COALESCE(pd.diagnosis_type, '')) = 'primary' THEN 0 ELSE 1 END AS pri,
               pd.diagnosed_at
          FROM patient_diagnosis pd
          JOIN diagnosis_code dc ON dc.id = pd.diagnosis_code_id
         WHERE pd.patient_id = NEW.patient_id
           AND pd.tenant_id = NEW.tenant_id
           AND pd.deleted_at IS NULL
           AND COALESCE(pd.status, 'active') = 'active'
           AND dc.deleted_at IS NULL
    ) src;

    IF v_dx_json IS NOT NULL THEN
        SELECT string_agg(
                   CASE
                       WHEN NULLIF(TRIM(elem->>'icd10'), '') IS NOT NULL
                           THEN TRIM(elem->>'icd10') || ' — ' || COALESCE(elem->>'description', '')
                       ELSE COALESCE(elem->>'description', '')
                   END
                   || CASE
                          WHEN NULLIF(TRIM(elem->>'laterality'), '') IS NOT NULL
                              THEN ' (' || TRIM(elem->>'laterality') || ')'
                          ELSE ''
                      END,
                   '; '
                   ORDER BY CASE WHEN (elem->>'isPrimary') = 'true' THEN 0 ELSE 1 END
               )
          INTO v_dx_summary
        FROM jsonb_array_elements(v_dx_json) elem;
    END IF;

    IF v_dx_summary IS NULL AND v_clinical_summary IS NOT NULL THEN
        BEGIN
            v_session_dx := NULLIF(TRIM((v_clinical_summary::json)->>'diagnosis'), '');
        EXCEPTION WHEN others THEN
            v_session_dx := NULL;
        END;
        IF v_session_dx IS NOT NULL THEN
            v_dx_summary := v_session_dx;
            v_dx_json := jsonb_build_array(jsonb_build_object(
                'description', v_session_dx,
                'isPrimary', true
            ));
        END IF;
    END IF;

    IF v_dx_summary IS NULL THEN
        SELECT NULLIF(TRIM(diagnosis), '')
          INTO v_dx_summary
        FROM clinical_examination
        WHERE patient_id = NEW.patient_id
          AND tenant_id = NEW.tenant_id
          AND NULLIF(TRIM(diagnosis), '') IS NOT NULL
        ORDER BY is_signed DESC, examination_date DESC
        LIMIT 1;

        IF v_dx_summary IS NOT NULL THEN
            v_dx_json := jsonb_build_array(jsonb_build_object(
                'description', v_dx_summary,
                'isPrimary', true
            ));
        END IF;
    END IF;

    INSERT INTO patient_journey (
        tenant_id, branch_id,
        patient_id, uhid,
        ot_finalize_schedule_id, counseling_session_id,
        procedure_name, eye_operated,
        opd_diagnosis, opd_diagnosis_json,
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
        v_dx_summary, v_dx_json,
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
    'biometry for that eye. Copies OPD diagnosis from patient_diagnosis, else '
    'clinical_summary.diagnosis, else clinical_examination. Existing journey for '
    'the schedule is skipped (no blanking).';

COMMIT;
