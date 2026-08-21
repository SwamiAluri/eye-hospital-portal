-- ============================================================================
-- Migration 92: Seed Default Pre-Op Section Items
-- Purpose: Inserts ~55 generic default items across 8 checklist categories.
--          tenant_id = NULL means these apply to all tenants.
--          patient_type_filter = NULL means item applies to all payment types.
--          surgery_type_filter = NULL means item applies to all surgery types.
-- Dependencies: pre_op_section_items (91)
-- Date: 2026-03
-- ============================================================================

BEGIN;

INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, is_mandatory, is_blocking, requires_document,
     patient_type_filter, surgery_type_filter, display_order)
VALUES

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 1: Compliance
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Compliance', 'fasting_confirmed',
 'Fasting Confirmed', 'Patient confirms they have been fasting as instructed.',
 'Nursing', TRUE, TRUE, FALSE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Compliance', 'last_food_time',
 'Last Food/Drink Time', 'Date and time of last oral intake (food or liquid).',
 'Nursing', TRUE, TRUE, FALSE, NULL, NULL, 20),

(gen_random_uuid(), NULL, 'Compliance', 'fasting_hours',
 'Fasting Duration (hours)', 'Number of hours since last food intake.',
 'Nursing', TRUE, FALSE, FALSE, NULL, NULL, 30),

(gen_random_uuid(), NULL, 'Compliance', 'medication_adherence',
 'Medication Adherence', 'Patient confirms regular medications taken as prescribed.',
 'Nursing', TRUE, FALSE, FALSE, NULL, NULL, 40),

(gen_random_uuid(), NULL, 'Compliance', 'insulin_dose_managed',
 'Insulin Dose Managed (Diabetics)', 'Insulin dose on surgery day adjusted per anaesthesia protocol.',
 'Nursing', FALSE, FALSE, FALSE, NULL, NULL, 50),

(gen_random_uuid(), NULL, 'Compliance', 'anticoagulants_held',
 'Anticoagulants Held', 'Blood thinners (aspirin, warfarin, clopidogrel) held as instructed.',
 'Nursing', FALSE, FALSE, FALSE, NULL, NULL, 60),

(gen_random_uuid(), NULL, 'Compliance', 'allergy_communicated',
 'Allergies Communicated to Surgical Team', 'Patient allergies confirmed and communicated to surgical team.',
 'Nursing', TRUE, FALSE, FALSE, NULL, NULL, 70),

(gen_random_uuid(), NULL, 'Compliance', 'blood_group_confirmed',
 'Blood Group Confirmed', 'Blood group verified and recorded.',
 'Lab', TRUE, TRUE, FALSE, NULL, NULL, 80),

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 2: Investigations
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Investigations', 'biometry_done',
 'Biometry Done', 'A-Scan biometry for IOL power calculation completed.',
 'Optometry', TRUE, TRUE, FALSE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Investigations', 'oct_done',
 'OCT Done', 'Optical coherence tomography performed.',
 'Optometry', FALSE, FALSE, FALSE, NULL, NULL, 20),

(gen_random_uuid(), NULL, 'Investigations', 'fundus_done',
 'Fundus Examination Done', 'Fundus photography or dilated fundus exam completed.',
 'Optometry', FALSE, FALSE, FALSE, NULL, NULL, 30),

(gen_random_uuid(), NULL, 'Investigations', 'blood_sugar_fbs',
 'Blood Sugar (FBS)', 'Fasting blood sugar test completed.',
 'Lab', FALSE, FALSE, FALSE, NULL, NULL, 40),

(gen_random_uuid(), NULL, 'Investigations', 'blood_sugar_rbs',
 'Blood Sugar (RBS)', 'Random blood sugar test completed.',
 'Lab', FALSE, FALSE, FALSE, NULL, NULL, 50),

(gen_random_uuid(), NULL, 'Investigations', 'bp_checked',
 'Blood Pressure Checked', 'Pre-op blood pressure reading recorded.',
 'Nursing', TRUE, FALSE, FALSE, NULL, NULL, 60),

(gen_random_uuid(), NULL, 'Investigations', 'ecg_done',
 'ECG Done', 'Electrocardiogram performed for cardiac clearance.',
 'Cardiology', FALSE, FALSE, TRUE, NULL, NULL, 70),

(gen_random_uuid(), NULL, 'Investigations', 'hemoglobin',
 'Hemoglobin Level', 'Hemoglobin / CBC blood test completed.',
 'Lab', FALSE, FALSE, FALSE, NULL, NULL, 80),

(gen_random_uuid(), NULL, 'Investigations', 'pt_inr',
 'PT/INR (Coagulation)', 'Prothrombin time / INR test for patients on anticoagulants.',
 'Lab', FALSE, FALSE, FALSE, NULL, NULL, 90),

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 3: Vitals
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Vitals', 'bp_recorded',
 'Blood Pressure Recorded', 'Pre-op BP (systolic/diastolic) entered in vitals.',
 'Nursing', TRUE, TRUE, FALSE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Vitals', 'pulse_recorded',
 'Pulse Rate Recorded', 'Pre-op pulse rate entered in vitals.',
 'Nursing', TRUE, TRUE, FALSE, NULL, NULL, 20),

(gen_random_uuid(), NULL, 'Vitals', 'spo2_recorded',
 'SpO2 Recorded', 'Oxygen saturation recorded.',
 'Nursing', TRUE, TRUE, FALSE, NULL, NULL, 30),

(gen_random_uuid(), NULL, 'Vitals', 'temperature_recorded',
 'Temperature Recorded', 'Body temperature recorded.',
 'Nursing', TRUE, FALSE, FALSE, NULL, NULL, 40),

(gen_random_uuid(), NULL, 'Vitals', 'weight_recorded',
 'Weight Recorded', 'Patient weight recorded (relevant for anaesthesia dosing).',
 'Nursing', FALSE, FALSE, FALSE, NULL, NULL, 50),

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 4: Consent
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Consent', 'surgery_consent_signed',
 'Surgery Consent Signed', 'Patient / guardian has signed the surgical consent form.',
 'Administration', TRUE, TRUE, TRUE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Consent', 'anaesthesia_consent_signed',
 'Anaesthesia Consent Signed', 'Patient / guardian has signed the anaesthesia consent form.',
 'Anaesthesia', TRUE, TRUE, TRUE, NULL, NULL, 20),

(gen_random_uuid(), NULL, 'Consent', 'hospital_policy_consent',
 'Hospital Policies Acknowledged', 'Patient has read and acknowledged hospital policies.',
 'Administration', TRUE, FALSE, FALSE, NULL, NULL, 30),

(gen_random_uuid(), NULL, 'Consent', 'blood_transfusion_consent',
 'Blood Transfusion Consent', 'Consent for blood transfusion if required during surgery.',
 'Administration', FALSE, FALSE, FALSE, NULL, NULL, 40),

(gen_random_uuid(), NULL, 'Consent', 'identity_verified',
 'Identity Verified', 'Patient identity confirmed against ID proof.',
 'Administration', TRUE, TRUE, FALSE, NULL, NULL, 50),

(gen_random_uuid(), NULL, 'Consent', 'surgery_site_marked',
 'Surgery Site Marked', 'Operative eye (OD/OS) confirmed and marked.',
 'Nursing', TRUE, TRUE, FALSE, NULL, NULL, 60),

(gen_random_uuid(), NULL, 'Consent', 'contact_lens_removed',
 'Contact Lens Removed', 'Patient has removed contact lenses (if applicable).',
 'Nursing', FALSE, FALSE, FALSE, NULL, NULL, 70),

(gen_random_uuid(), NULL, 'Consent', 'valuables_removed',
 'Valuables & Jewellery Removed', 'Patient has removed jewellery, hearing aids, implants declared.',
 'Nursing', FALSE, FALSE, FALSE, NULL, NULL, 80),

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 5: Evaluation
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Evaluation', 'doctor_evaluation_completed',
 'Clinical Evaluation Completed', 'Pre-op clinical evaluation by doctor completed.',
 'Administration', TRUE, TRUE, FALSE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Evaluation', 'doctor_evaluation_signed',
 'Doctor Evaluation Signed Off', 'Operating doctor has formally signed off on pre-op evaluation.',
 'Administration', TRUE, TRUE, FALSE, NULL, NULL, 20),

(gen_random_uuid(), NULL, 'Evaluation', 'risk_classification',
 'Risk Classification', 'Patient assigned Low / Medium / High surgical risk.',
 'Administration', TRUE, FALSE, FALSE, NULL, NULL, 30),

(gen_random_uuid(), NULL, 'Evaluation', 'comorbidities_reviewed',
 'Comorbidities Reviewed', 'Diabetes, hypertension, cardiac conditions reviewed with patient.',
 'Administration', TRUE, FALSE, FALSE, NULL, NULL, 40),

(gen_random_uuid(), NULL, 'Evaluation', 'surgical_plan_confirmed',
 'Surgical Plan Confirmed', 'Procedure, IOL type, and operative eye confirmed with patient.',
 'Administration', TRUE, FALSE, FALSE, NULL, NULL, 50),

(gen_random_uuid(), NULL, 'Evaluation', 'patient_counselled',
 'Patient Counselled', 'Patient informed about procedure, risks, and post-op care.',
 'Administration', TRUE, FALSE, FALSE, NULL, NULL, 60),

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 6: Anaesthesia
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Anaesthesia', 'anaesthesia_type_selected',
 'Anaesthesia Type Selected', 'Type of anaesthesia selected: LA / GA / Topical.',
 'Anaesthesia', TRUE, FALSE, FALSE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Anaesthesia', 'anaesthetist_assigned',
 'Anaesthetist Assigned', 'Responsible anaesthetist confirmed and assigned.',
 'Anaesthesia', TRUE, FALSE, FALSE, NULL, NULL, 20),

(gen_random_uuid(), NULL, 'Anaesthesia', 'fitness_assessed',
 'Anaesthesia Fitness Assessed', 'Anaesthetist has completed fitness evaluation.',
 'Anaesthesia', TRUE, FALSE, FALSE, NULL, NULL, 30),

(gen_random_uuid(), NULL, 'Anaesthesia', 'contraindications_reviewed',
 'Contraindications Reviewed', 'Drug allergies and anaesthesia contraindications reviewed.',
 'Anaesthesia', TRUE, FALSE, FALSE, NULL, NULL, 40),

(gen_random_uuid(), NULL, 'Anaesthesia', 'fitness_certificate_uploaded',
 'Fitness Certificate Uploaded', 'Anaesthesia fitness certificate / clearance letter uploaded.',
 'Anaesthesia', FALSE, FALSE, TRUE, NULL, NULL, 50),

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 7: Financial
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Financial', 'payment_mode_confirmed',
 'Payment Mode Confirmed', 'Patient payment mode confirmed by billing desk.',
 'Billing', TRUE, FALSE, FALSE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Financial', 'advance_paid',
 'Advance Payment Received', 'Minimum advance amount collected.',
 'Billing', TRUE, FALSE, FALSE, NULL, NULL, 20),

-- Insurance-specific blocking item
(gen_random_uuid(), NULL, 'Financial', 'insurance_preauth_approved',
 'Insurance Pre-Auth Approved', 'TPA/insurance pre-authorisation approval received.',
 'Billing', TRUE, TRUE, TRUE, 'Insurance', NULL, 30),

-- CGHS-specific
(gen_random_uuid(), NULL, 'Financial', 'cghs_approval_uploaded',
 'CGHS Approval Uploaded', 'CGHS/ECHS medical referral and entitlement card uploaded.',
 'Billing', TRUE, TRUE, TRUE, 'CGHS', NULL, 40),

-- ESI-specific
(gen_random_uuid(), NULL, 'Financial', 'esi_referral_uploaded',
 'ESI Referral Uploaded', 'ESI referral letter uploaded.',
 'Billing', TRUE, TRUE, TRUE, 'ESI', NULL, 50),

-- Camp-specific
(gen_random_uuid(), NULL, 'Financial', 'camp_sponsorship_uploaded',
 'Camp Sponsorship Letter Uploaded', 'Camp organiser sponsorship / approval letter uploaded.',
 'Billing', TRUE, TRUE, TRUE, 'Camp', NULL, 60),

-- Emergency context flag (non-blocking, informational)
(gen_random_uuid(), NULL, 'Financial', 'emergency_fc_confirmed',
 'Emergency FC Status Noted', 'Emergency financial clearance status confirmed and documented.',
 'Billing', FALSE, FALSE, FALSE, NULL, NULL, 70),

-- ────────────────────────────────────────────────────────────────────────────
-- CATEGORY 8: Documents (document upload confirmations)
-- ────────────────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'Documents', 'consent_form_doc',
 'Consent Form Uploaded', 'Signed consent form(s) uploaded.',
 'Administration', TRUE, TRUE, TRUE, NULL, NULL, 10),

(gen_random_uuid(), NULL, 'Documents', 'lab_reports_doc',
 'Lab Reports Uploaded', 'Blood test / lab investigation reports uploaded.',
 'Lab', FALSE, FALSE, TRUE, NULL, NULL, 20),

(gen_random_uuid(), NULL, 'Documents', 'imaging_reports_doc',
 'Imaging Reports Uploaded', 'Biometry, OCT, fundus, ECG reports uploaded.',
 'Optometry', FALSE, FALSE, TRUE, NULL, NULL, 30),

(gen_random_uuid(), NULL, 'Documents', 'insurance_card_doc',
 'Insurance Card Uploaded', 'TPA / insurance card or policy document uploaded.',
 'Billing', TRUE, FALSE, TRUE, 'Insurance', NULL, 40),

(gen_random_uuid(), NULL, 'Documents', 'government_card_doc',
 'Government Entitlement Card Uploaded', 'CGHS / ESI / ECHS card or equivalent uploaded.',
 'Billing', TRUE, FALSE, TRUE, 'CGHS', NULL, 50),

(gen_random_uuid(), NULL, 'Documents', 'fitness_certificate_doc',
 'Fitness Certificate Uploaded', 'Anaesthesia or physician fitness certificate uploaded.',
 'Anaesthesia', FALSE, FALSE, TRUE, NULL, NULL, 60),

(gen_random_uuid(), NULL, 'Documents', 'identity_proof_doc',
 'Identity Proof Uploaded', 'Government-issued photo ID (Aadhaar, passport, etc.) uploaded.',
 'Administration', FALSE, FALSE, TRUE, NULL, NULL, 70)

ON CONFLICT (item_key) DO NOTHING;

COMMENT ON TABLE pre_op_section_items IS
    'Default pre-op checklist items. 55 items seeded in migration 92. '
    'Tenant admins can add custom items by inserting rows with their tenant_id.';

COMMIT;
