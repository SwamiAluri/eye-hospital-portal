-- ============================================================================
-- Migration 134: S0 — Outpatient Safety Checklist (Counsellor Desk)
-- Purpose:
--   1. Add form_code / form_context to pre_op_section_items catalog
--   2. Seed 12 Saijyothi outpatient safety items (Form 1 — Outpatient section)
--   3. Create counsellor_checklist_completions (pre-journey, keyed by session)
--   4. Add copy-tracking columns on pre_op_completions for counsellor → ward sync
-- Dependencies: pre_op_section_items (91), pre_op_completions (91), tenant
-- Date: 2026-06
-- ============================================================================

BEGIN;

-- ── 1. Relax category constraint & add form metadata ─────────────────────────
ALTER TABLE pre_op_section_items DROP CONSTRAINT IF EXISTS pre_op_section_items_category_check;

ALTER TABLE pre_op_section_items
    ADD COLUMN IF NOT EXISTS form_code    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS form_context VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_preop_items_form
    ON pre_op_section_items(form_code, form_context)
    WHERE deleted_at IS NULL;

-- ── 2. Counsellor completions (pre-journey) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS counsellor_checklist_completions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(id),
    counseling_session_id   UUID NOT NULL,
    item_id                 UUID NOT NULL REFERENCES pre_op_section_items(id),

    is_completed            BOOLEAN NOT NULL DEFAULT FALSE,
    is_bypassed             BOOLEAN NOT NULL DEFAULT FALSE,
    bypass_reason           TEXT,
    notes                   TEXT,

    completed_by_user_id    UUID,
    completed_at            TIMESTAMPTZ,

    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT uq_counsellor_completion UNIQUE (counseling_session_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_ccc_session
    ON counsellor_checklist_completions(counseling_session_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ccc_tenant
    ON counsellor_checklist_completions(tenant_id);

ALTER TABLE counsellor_checklist_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON counsellor_checklist_completions;
CREATE POLICY tenant_isolation ON counsellor_checklist_completions
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ── 3. Copy-tracking on ward completions ─────────────────────────────────────
ALTER TABLE pre_op_completions
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'ward',
    ADD COLUMN IF NOT EXISTS copied_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS counsellor_completion_id UUID;

-- ── 4. Seed 12 outpatient safety items (none blocking) ───────────────────────
INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     form_code, form_context, display_order, status)
VALUES
(gen_random_uuid(), NULL, 'Outpatient', 'mo_advice_confirmed',
 'Medical Officer Advice Confirmed',
 'Patient confirms medical officer advice has been received.',
 'Administration', 'STD_DOCTOR', TRUE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 10, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'outpatient_informed_consent',
 'Informed Consent',
 'Patient has been informed and consented to the procedure.',
 'Administration', 'STD_COUNSELOR', TRUE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 20, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'outpatient_serology_blood_tests',
 'Serology / Blood Tests',
 'HIV, HBsAg, RBS, serum creatinine / blood urea completed.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 30, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'physician_cardiac_fitness',
 'Physician Opinion / Fitness / Cardiac Fit',
 'Physician clearance and cardiac fitness obtained where required.',
 'Cardiology', 'STD_DOCTOR', TRUE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 40, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'outpatient_ascan_confirmed',
 'A-Scan Done',
 'A-Scan biometry completed and available.',
 'Optometry', 'STD_IMAGING', TRUE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 50, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'fellow_workup_done',
 'Fellow Work-Up (Evening Before Surgery)',
 'Fellow / junior doctor work-up completed on the evening before surgery.',
 'Administration', 'STD_DOCTOR', FALSE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 60, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'other_eye_fundus_seen',
 'Other Eye Fundus Seen',
 'Fundus of the fellow eye examined and documented.',
 'Optometry', 'STD_IMAGING', FALSE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 70, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'conj_culture_done',
 'Eye Congestion / Conjunctival Culture',
 'Conjunctival culture taken when clinically indicated.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 80, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'one_eye_culture',
 'One Eye Culture',
 'Culture for one-eyed status or as clinically indicated.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 90, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'preop_hygiene_instructions',
 'Pre-Op Hygiene Instructions Given',
 'Shaving, bathing, nail cutting, removing jewellery instructions given.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 100, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'anticoagulant_stopped',
 'Anticoagulant Stopped (Post Physician Opinion)',
 'Anticoagulant held as per physician advice.',
 'Nursing', 'STD_NURSE', FALSE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 110, 'active'),

(gen_random_uuid(), NULL, 'Outpatient', 'patient_risk_labels',
 'Patient Risk Labels Applied',
 'Labelled with systemic condition, allergy, one-eyed status, etc.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'OUTPATIENT_SAFETY', 'counsellor', 120, 'active')

ON CONFLICT (item_key) DO UPDATE SET
    form_code    = EXCLUDED.form_code,
    form_context = EXCLUDED.form_context,
    category     = EXCLUDED.category,
    item_label   = EXCLUDED.item_label,
    description  = EXCLUDED.description,
    is_blocking  = EXCLUDED.is_blocking,
    display_order = EXCLUDED.display_order,
    updated_at   = NOW();

COMMENT ON TABLE counsellor_checklist_completions IS
    'Pre-journey outpatient safety checklist completions keyed by counseling_session_id. '
    'Copied to pre_op_completions when ward pre-op clearance is initialised.';

COMMIT;
