-- ============================================================================
-- Migration 135: S1 — Ward Checklist (Form 2, 17 items)
-- Purpose: Seed ward pre-operative checklist + journey timestamp columns
-- Dependencies: 134_s0_outpatient_safety_checklist.sql
-- Date: 2026-06
-- ============================================================================

BEGIN;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS ward_check_in_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS informed_ot_team_at TIMESTAMPTZ;

COMMENT ON COLUMN patient_journey.ward_check_in_at IS
    'Set when Ward Checklist item ward_check_in_time is completed.';
COMMENT ON COLUMN patient_journey.informed_ot_team_at IS
    'Set when Ward Checklist item informed_surgeon_anaesthesia_ot is completed.';

INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     form_code, form_context, display_order, status)
VALUES
(gen_random_uuid(), NULL, 'Ward Pre-Op', 'patient_identity_confirmed',
 'Patient Identity Confirmation',
 'Patient identity verified against ID and wrist band.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 10, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'bill_payment_confirmed',
 'Bill Payment Confirmation',
 'Payment / financial clearance confirmed (see IP Management status).',
 'Billing', 'STD_BILLING', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 20, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'ward_check_in_time',
 'Patient Check-in Time Recorded',
 'Ward arrival / check-in time documented.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 30, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'investigation_reports_available',
 'Investigation Reports Available',
 'All required investigation reports available for review.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 40, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'ward_ascan_confirmed',
 'A-Scan Done',
 'A-Scan biometry report available and reviewed.',
 'Optometry', 'STD_IMAGING', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 50, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'toric_iol_icl_marking',
 'Toric IOL / ICL Marking by Surgeon',
 'Toric IOL or ICL marking completed by surgeon (when applicable).',
 'Surgery', 'STD_DOCTOR', FALSE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 60, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'operation_site_marked',
 'Operation Site Identified and Marked',
 'Operative eye/site marked per protocol.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 70, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'consent_patient_signed',
 'Consent Signed by Patient',
 'Surgical consent signed by patient.',
 'Administration', 'STD_COUNSELOR', TRUE, FALSE, TRUE,
 'WARD_CHECKLIST', 'ward', 80, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'consent_witness_signed',
 'Consent Signed by Witness',
 'Witness signature on consent form (optional).',
 'Administration', 'STD_COUNSELOR', FALSE, FALSE, TRUE,
 'WARD_CHECKLIST', 'ward', 90, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'consent_surgeon_signed',
 'Consent Signed by Surgeon',
 'Surgeon has signed the consent form.',
 'Surgery', 'STD_DOCTOR', TRUE, FALSE, TRUE,
 'WARD_CHECKLIST', 'ward', 100, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'vitals_checked',
 'Vitals Checked',
 'Pre-operative vital signs recorded.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 110, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'known_allergies_documented',
 'Known Allergies Documented',
 'Allergy history confirmed and documented.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 120, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'preop_medication_given',
 'Pre-Operative Medication Given',
 'Pre-op medications administered as ordered.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 130, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'preop_slit_lamp_done',
 'Pre-Operative Slit Lamp Examination Done',
 'Slit lamp examination completed before surgery.',
 'Optometry', 'STD_DOCTOR', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 140, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'pac_done_documented',
 'PAC — Pre-Operative Anaesthesia Check-up Done',
 'Pre-anaesthesia check-up completed and documented.',
 'Anaesthesia', 'STD_DOCTOR', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 150, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'ward_dilatation_done',
 'Dilatation Done',
 'Mydriatic / cycloplegic dilatation completed.',
 'Pharmacy', 'STD_PHARMACY', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 160, 'active'),

(gen_random_uuid(), NULL, 'Ward Pre-Op', 'informed_surgeon_anaesthesia_ot',
 'Informed Surgeon / Anaesthesia / OT',
 'Surgeon, anaesthesia, and OT teams notified patient is ready.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_CHECKLIST', 'ward', 170, 'active')

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
