-- ============================================================================
-- Migration 136: S2 — Form 4 Pre-op Medication Log + Ward Post-op Checklist
-- Dependencies: 135_s1_ward_checklist.sql
-- Date: 2026-06
-- ============================================================================

BEGIN;

-- ── Journey timestamp / meta columns ─────────────────────────────────────────
ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS xylocaine_sensitivity_result VARCHAR(10),
    ADD COLUMN IF NOT EXISTS sent_to_ot_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS received_from_ot_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ward_checkout_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS medication_log_surgery_notes TEXT,
    ADD COLUMN IF NOT EXISTS ward_postop_iol_checks JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN patient_journey.xylocaine_sensitivity_result IS
    'Xylocaine sensitivity test: +ve, -ve, or NA (optional; shown for Local anaesthesia).';
COMMENT ON COLUMN patient_journey.sent_to_ot_at IS
    'Auto-set when clinical state transitions to SentToOT.';
COMMENT ON COLUMN patient_journey.received_from_ot_at IS
    'Auto-set when clinical state transitions to PostOp.';
COMMENT ON COLUMN patient_journey.ward_checkout_at IS
    'Auto-set when clinical state transitions to Discharged.';
COMMENT ON COLUMN patient_journey.medication_log_surgery_notes IS
    'Free-text surgery notes on Form 4 pre-op medication section.';
COMMENT ON COLUMN patient_journey.ward_postop_iol_checks IS
    'IOL sticker sub-checks: { barcodeScan, stickerInFile, inventoryMatch }.';

-- ── Pre-op medication dose log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pre_op_medication_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(id),
    patient_journey_id      UUID NOT NULL REFERENCES patient_journey(id) ON DELETE CASCADE,
    medication_id           UUID,
    medicine_name           VARCHAR(200) NOT NULL,
    dose_number             INTEGER NOT NULL DEFAULT 1,
    administered_at         TIMESTAMPTZ,
    administered_by_user_id UUID REFERENCES users(id),
    notes                   TEXT,
    display_order           INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT uq_med_log_journey_drug_dose
        UNIQUE (patient_journey_id, medicine_name, dose_number)
);

CREATE INDEX IF NOT EXISTS idx_med_log_journey
    ON pre_op_medication_log(patient_journey_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_med_log_tenant
    ON pre_op_medication_log(tenant_id)
    WHERE deleted_at IS NULL;

ALTER TABLE pre_op_medication_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pre_op_medication_log;
CREATE POLICY tenant_isolation ON pre_op_medication_log
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ── Form 4 post-op 7 items ───────────────────────────────────────────────────
INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     form_code, form_context, display_order, status)
VALUES
(gen_random_uuid(), NULL, 'Ward Post-Op', 'patient_received_from_ot',
 'Patient Received from OT',
 'Patient received back from operation theatre (time recorded automatically).',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP', 'ward_postop', 10, 'active'),

(gen_random_uuid(), NULL, 'Ward Post-Op', 'iol_power_sticker',
 'IOL Power Sticker Attached',
 'IOL power sticker confirmed (barcode scan, in-file, inventory match — all optional).',
 'Nursing', 'STD_NURSE', FALSE, FALSE, FALSE,
 'WARD_POSTOP', 'ward_postop', 20, 'active'),

(gen_random_uuid(), NULL, 'Ward Post-Op', 'postop_medication_prescribed',
 'Post-Operative Medication Prescribed',
 'Post-operative medication prescription documented.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP', 'ward_postop', 30, 'active'),

(gen_random_uuid(), NULL, 'Ward Post-Op', 'treatment_plan_explained',
 'OP Treatment Plan Explained',
 'Outpatient treatment plan explained to patient / attendant.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP', 'ward_postop', 40, 'active'),

(gen_random_uuid(), NULL, 'Ward Post-Op', 'discharge_summary_issued',
 'Discharge Summary Issued',
 'Nurse confirms discharge summary has been issued (separate from summary finalize).',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP', 'ward_postop', 50, 'active'),

(gen_random_uuid(), NULL, 'Ward Post-Op', 'emergency_plan_informed',
 'Private & Emergency Plan of Care Informed',
 'Private and emergency plan of care explained to patient / attendant.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP', 'ward_postop', 60, 'active'),

(gen_random_uuid(), NULL, 'Ward Post-Op', 'ward_checkout_time',
 'Patient Check-out Time from Ward',
 'Ward check-out time recorded (auto-set on discharge).',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP', 'ward_postop', 70, 'active'),

-- Form 1 ward post-op safety (2 items)
(gen_random_uuid(), NULL, 'Ward Post-Op Safety', 'postop_medication_confirmed',
 'Post-Op Medication Confirmed',
 'Post-operative medication instructions confirmed with patient.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP_SAFETY', 'ward_postop', 80, 'active'),

(gen_random_uuid(), NULL, 'Ward Post-Op Safety', 'postop_position_confirmed',
 'Post-Op Position Confirmed',
 'Post-operative positioning instructions confirmed with patient.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_POSTOP_SAFETY', 'ward_postop', 90, 'active')

ON CONFLICT (item_key) DO UPDATE SET
    form_code    = EXCLUDED.form_code,
    form_context = EXCLUDED.form_context,
    category     = EXCLUDED.category,
    item_label   = EXCLUDED.item_label,
    description  = EXCLUDED.description,
    is_blocking  = EXCLUDED.is_blocking,
    display_order = EXCLUDED.display_order,
    updated_at   = NOW();

COMMIT;
