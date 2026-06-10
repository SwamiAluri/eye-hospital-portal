-- =============================================
-- Migration 55: Seed Master Data for ALL Existing Tenants
-- Created: April 23, 2026
-- Purpose: Migration 52 only seeded for the first tenant (LIMIT 1).
--          This migration seeds all 65 entity types for EVERY tenant.
--          ON CONFLICT DO NOTHING ensures existing data is never overwritten.
-- =============================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM public.tenant WHERE is_active = true OR is_active IS NULL LOOP
        PERFORM set_config('app.current_tenant_id', rec.id::text, false);
        RAISE NOTICE 'Seeding master data for tenant: %', rec.id;

        -- =============================================
        -- GROUP 1: Patient Setup
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.title', 'MR',     'Mr.',     1),
            (rec.id, 'patient_setup', 'patient.title', 'MRS',    'Mrs.',    2),
            (rec.id, 'patient_setup', 'patient.title', 'MS',     'Ms.',     3),
            (rec.id, 'patient_setup', 'patient.title', 'DR',     'Dr.',     4),
            (rec.id, 'patient_setup', 'patient.title', 'PROF',   'Prof.',   5),
            (rec.id, 'patient_setup', 'patient.title', 'BABY',   'Baby',    6),
            (rec.id, 'patient_setup', 'patient.title', 'MASTER', 'Master',  7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, is_system_locked, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.blood_group', 'A_POS',  'A+',      true, 1),
            (rec.id, 'patient_setup', 'patient.blood_group', 'A_NEG',  'A-',      true, 2),
            (rec.id, 'patient_setup', 'patient.blood_group', 'B_POS',  'B+',      true, 3),
            (rec.id, 'patient_setup', 'patient.blood_group', 'B_NEG',  'B-',      true, 4),
            (rec.id, 'patient_setup', 'patient.blood_group', 'AB_POS', 'AB+',     true, 5),
            (rec.id, 'patient_setup', 'patient.blood_group', 'AB_NEG', 'AB-',     true, 6),
            (rec.id, 'patient_setup', 'patient.blood_group', 'O_POS',  'O+',      true, 7),
            (rec.id, 'patient_setup', 'patient.blood_group', 'O_NEG',  'O-',      true, 8),
            (rec.id, 'patient_setup', 'patient.blood_group', 'UNKNOWN','Unknown', true, 9)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.patient_type', 'CASH',        'Cash',             1),
            (rec.id, 'patient_setup', 'patient.patient_type', 'INSURANCE',   'Insurance',        2),
            (rec.id, 'patient_setup', 'patient.patient_type', 'COPAY',       'Co-Pay',           3),
            (rec.id, 'patient_setup', 'patient.patient_type', 'ESH',         'ESH',              4),
            (rec.id, 'patient_setup', 'patient.patient_type', 'CGHS',        'CGHS',             5),
            (rec.id, 'patient_setup', 'patient.patient_type', 'AROGYASHREE', 'Arogyashree',      6),
            (rec.id, 'patient_setup', 'patient.patient_type', 'SGHS',        'SGHS',             7),
            (rec.id, 'patient_setup', 'patient.patient_type', 'CAMP',        'Camp',             8),
            (rec.id, 'patient_setup', 'patient.patient_type', 'RAILWAY',     'Railway',          9),
            (rec.id, 'patient_setup', 'patient.patient_type', 'FREE',        'Free / Charity',   10),
            (rec.id, 'patient_setup', 'patient.patient_type', 'TPA',         'TPA',              11)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, is_system_locked, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.gender', 'MALE',   'Male',   true, 1),
            (rec.id, 'patient_setup', 'patient.gender', 'FEMALE', 'Female', true, 2),
            (rec.id, 'patient_setup', 'patient.gender', 'OTHER',  'Other',  true, 3)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.marital_status', 'SINGLE',    'Single',    1),
            (rec.id, 'patient_setup', 'patient.marital_status', 'MARRIED',   'Married',   2),
            (rec.id, 'patient_setup', 'patient.marital_status', 'DIVORCED',  'Divorced',  3),
            (rec.id, 'patient_setup', 'patient.marital_status', 'WIDOWED',   'Widowed',   4),
            (rec.id, 'patient_setup', 'patient.marital_status', 'SEPARATED', 'Separated', 5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.religion', 'HINDU',     'Hindu',     1),
            (rec.id, 'patient_setup', 'patient.religion', 'MUSLIM',    'Muslim',    2),
            (rec.id, 'patient_setup', 'patient.religion', 'CHRISTIAN', 'Christian', 3),
            (rec.id, 'patient_setup', 'patient.religion', 'SIKH',      'Sikh',      4),
            (rec.id, 'patient_setup', 'patient.religion', 'BUDDHIST',  'Buddhist',  5),
            (rec.id, 'patient_setup', 'patient.religion', 'JAIN',      'Jain',      6),
            (rec.id, 'patient_setup', 'patient.religion', 'OTHER',     'Other',     7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.id_proof_type', 'AADHAAR',     'Aadhaar Card',    1),
            (rec.id, 'patient_setup', 'patient.id_proof_type', 'PAN',         'PAN Card',        2),
            (rec.id, 'patient_setup', 'patient.id_proof_type', 'PASSPORT',    'Passport',        3),
            (rec.id, 'patient_setup', 'patient.id_proof_type', 'VOTER_ID',    'Voter ID',        4),
            (rec.id, 'patient_setup', 'patient.id_proof_type', 'DL',          'Driving License', 5),
            (rec.id, 'patient_setup', 'patient.id_proof_type', 'EMPLOYEE_ID', 'Employee ID',     6),
            (rec.id, 'patient_setup', 'patient.id_proof_type', 'CGHS_CARD',   'CGHS Card',       7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.relationship', 'SELF',     'Self',     1),
            (rec.id, 'patient_setup', 'patient.relationship', 'SPOUSE',   'Spouse',   2),
            (rec.id, 'patient_setup', 'patient.relationship', 'CHILD',    'Child',    3),
            (rec.id, 'patient_setup', 'patient.relationship', 'PARENT',   'Parent',   4),
            (rec.id, 'patient_setup', 'patient.relationship', 'SIBLING',  'Sibling',  5),
            (rec.id, 'patient_setup', 'patient.relationship', 'GUARDIAN', 'Guardian', 6),
            (rec.id, 'patient_setup', 'patient.relationship', 'OTHER',    'Other',    7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.nationality', 'INDIAN',    'Indian',    1),
            (rec.id, 'patient_setup', 'patient.nationality', 'NRI',       'NRI',       2),
            (rec.id, 'patient_setup', 'patient.nationality', 'FOREIGNER', 'Foreigner', 3)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'patient_setup', 'patient.occupation', 'EMPLOYED',   'Employed',           1),
            (rec.id, 'patient_setup', 'patient.occupation', 'SELF_EMP',   'Self-Employed',      2),
            (rec.id, 'patient_setup', 'patient.occupation', 'BUSINESS',   'Business',           3),
            (rec.id, 'patient_setup', 'patient.occupation', 'STUDENT',    'Student',            4),
            (rec.id, 'patient_setup', 'patient.occupation', 'HOMEMAKER',  'Homemaker',          5),
            (rec.id, 'patient_setup', 'patient.occupation', 'RETIRED',    'Retired',            6),
            (rec.id, 'patient_setup', 'patient.occupation', 'FARMER',     'Farmer',             7),
            (rec.id, 'patient_setup', 'patient.occupation', 'PROFESSIONAL','Professional',      8),
            (rec.id, 'patient_setup', 'patient.occupation', 'UNEMPLOYED', 'Unemployed',         9),
            (rec.id, 'patient_setup', 'patient.occupation', 'OTHER',      'Other',              10)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 2: Clinical
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.surgery_type', 'PHACO',         'Phacoemulsification (Phaco)',    '{"category":"Cataract"}',   1),
            (rec.id, 'clinical', 'clinical.surgery_type', 'SICS',          'SICS',                           '{"category":"Cataract"}',   2),
            (rec.id, 'clinical', 'clinical.surgery_type', 'ECCE',          'ECCE',                           '{"category":"Cataract"}',   3),
            (rec.id, 'clinical', 'clinical.surgery_type', 'TRAB',          'Trabeculectomy',                 '{"category":"Glaucoma"}',   4),
            (rec.id, 'clinical', 'clinical.surgery_type', 'AHMED_VALVE',   'Ahmed Valve Implant',            '{"category":"Glaucoma"}',   5),
            (rec.id, 'clinical', 'clinical.surgery_type', 'VITRECTOMY',    'Vitrectomy',                     '{"category":"Retina"}',     6),
            (rec.id, 'clinical', 'clinical.surgery_type', 'SCLERAL_BUCKLE','Scleral Buckling',               '{"category":"Retina"}',     7),
            (rec.id, 'clinical', 'clinical.surgery_type', 'PKP',           'Penetrating Keratoplasty (PKP)', '{"category":"Cornea"}',     8),
            (rec.id, 'clinical', 'clinical.surgery_type', 'DSEK',          'DSEK',                           '{"category":"Cornea"}',     9),
            (rec.id, 'clinical', 'clinical.surgery_type', 'LASIK',         'LASIK',                          '{"category":"Refractive"}', 10),
            (rec.id, 'clinical', 'clinical.surgery_type', 'PRK',           'PRK',                            '{"category":"Refractive"}', 11),
            (rec.id, 'clinical', 'clinical.surgery_type', 'PTOSIS',        'Ptosis Correction',              '{"category":"Oculoplasty"}',12),
            (rec.id, 'clinical', 'clinical.surgery_type', 'DCR',           'DCR (Dacryocystorhinostomy)',    '{"category":"Oculoplasty"}',13),
            (rec.id, 'clinical', 'clinical.surgery_type', 'SQUINT',        'Squint Correction',              '{"category":"Strabismus"}', 14),
            (rec.id, 'clinical', 'clinical.surgery_type', 'CHALAZION',     'Chalazion Removal',              '{"category":"General"}',    15)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.anesthesia_type', 'TOPICAL',    'Topical',             '{"category":"Topical"}',   1),
            (rec.id, 'clinical', 'clinical.anesthesia_type', 'LOCAL',      'Local Infiltration',  '{"category":"Local"}',     2),
            (rec.id, 'clinical', 'clinical.anesthesia_type', 'PERIBULBAR', 'Peribulbar Block',    '{"category":"Regional"}',  3),
            (rec.id, 'clinical', 'clinical.anesthesia_type', 'RETROBULBAR','Retrobulbar Block',   '{"category":"Regional"}',  4),
            (rec.id, 'clinical', 'clinical.anesthesia_type', 'GENERAL',    'General Anesthesia',  '{"category":"General"}',   5),
            (rec.id, 'clinical', 'clinical.anesthesia_type', 'SEDATION',   'Conscious Sedation',  '{"category":"Combined"}',  6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'PHACO_FOLDABLE', 'Phaco + Foldable IOL',      1),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'PHACO_RIGID',    'Phaco + Rigid IOL',         2),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'SICS_IOL',       'SICS + IOL',                3),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'TRABECULECTOMY', 'Trabeculectomy with MMC',   4),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'VITRECTOMY_23G', '23G Vitrectomy',            5),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'VITRECTOMY_25G', '25G Vitrectomy',            6),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'LASER_ENDO',     'Endolaser Photocoagulation',7),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'SF6_GAS',        'SF6 Gas Tamponade',         8),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'C3F8_GAS',       'C3F8 Gas Tamponade',        9),
            (rec.id, 'clinical', 'clinical.surgical_procedure', 'SILICON_OIL',    'Silicon Oil Injection',     10)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.intraop_finding', 'POSTERIOR_CAP_RUPTURE','Posterior Capsule Rupture',1),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'VITREOUS_LOSS',        'Vitreous Loss',            2),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'DROPPED_NUCLEUS',      'Dropped Nucleus',          3),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'IRIS_PROLAPSE',        'Iris Prolapse',            4),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'CORNEAL_EDEMA',        'Corneal Edema',            5),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'DENSE_NUCLEUS',        'Dense Nucleus',            6),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'ZONULAR_WEAKNESS',     'Zonular Weakness',         7),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'SMALL_PUPIL',          'Small Pupil',              8),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'BLEEDING',             'Intra-op Bleeding',        9),
            (rec.id, 'clinical', 'clinical.intraop_finding', 'NORMAL',               'Normal Procedure',         10)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.complication', 'NONE',            'None',                        1),
            (rec.id, 'clinical', 'clinical.complication', 'ENDOPHTHALMITIS', 'Endophthalmitis',             2),
            (rec.id, 'clinical', 'clinical.complication', 'RETINAL_DETACH',  'Retinal Detachment',          3),
            (rec.id, 'clinical', 'clinical.complication', 'ELEVATED_IOP',    'Elevated IOP',                4),
            (rec.id, 'clinical', 'clinical.complication', 'WOUND_LEAK',      'Wound Leak',                  5),
            (rec.id, 'clinical', 'clinical.complication', 'HYPHEMA',         'Hyphema',                     6),
            (rec.id, 'clinical', 'clinical.complication', 'IOL_DISLOCATION', 'IOL Dislocation',             7),
            (rec.id, 'clinical', 'clinical.complication', 'UVEITIS',         'Post-op Uveitis',             8),
            (rec.id, 'clinical', 'clinical.complication', 'CME',             'Cystoid Macular Edema (CME)', 9),
            (rec.id, 'clinical', 'clinical.complication', 'REFRACTIVE_ERROR','Significant Refractive Error',10)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.anesthesia_technique', 'TOPICAL_ONLY',  'Topical Only',           1),
            (rec.id, 'clinical', 'clinical.anesthesia_technique', 'PERIBULBAR',    'Peribulbar Block',       2),
            (rec.id, 'clinical', 'clinical.anesthesia_technique', 'RETROBULBAR',   'Retrobulbar Block',      3),
            (rec.id, 'clinical', 'clinical.anesthesia_technique', 'GA',            'General Anesthesia',     4),
            (rec.id, 'clinical', 'clinical.anesthesia_technique', 'SEDATION_TOPICAL','Sedation + Topical',   5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.iol_catalog', 'ALCON_SN60WF',  'Alcon AcrySof IQ SN60WF',    '{"manufacturer":"Alcon","model":"SN60WF","lens_type":"spheric","sphere_power_min":0,"sphere_power_max":34}',    1),
            (rec.id, 'clinical', 'clinical.iol_catalog', 'ALCON_SN6AT',   'Alcon AcrySof Toric SN6AT',  '{"manufacturer":"Alcon","model":"SN6AT","lens_type":"toric","sphere_power_min":6,"sphere_power_max":30}',     2),
            (rec.id, 'clinical', 'clinical.iol_catalog', 'J_AND_J_ZEISS', 'J&J Tecnis ZCB00',           '{"manufacturer":"J&J","model":"ZCB00","lens_type":"spheric","sphere_power_min":5,"sphere_power_max":34}',     3),
            (rec.id, 'clinical', 'clinical.iol_catalog', 'BAUSCH_SV25T',  'Bausch & Lomb SofPort SV25T','{"manufacturer":"Bausch & Lomb","model":"SV25T","lens_type":"spheric","sphere_power_min":4,"sphere_power_max":34}', 4),
            (rec.id, 'clinical', 'clinical.iol_catalog', 'HOYA_XY1',      'Hoya Vivinex XY1',           '{"manufacturer":"Hoya","model":"XY1","lens_type":"spheric","sphere_power_min":0,"sphere_power_max":36}',     5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.postop_checklist', 'VITALS_STABLE',   'Vitals Stable',             1),
            (rec.id, 'clinical', 'clinical.postop_checklist', 'EYE_PADDED',      'Eye Padded',                2),
            (rec.id, 'clinical', 'clinical.postop_checklist', 'MEDICATION_GIVEN','Medication Given',          3),
            (rec.id, 'clinical', 'clinical.postop_checklist', 'DIET_ADVISED',    'Diet Advice Given',         4),
            (rec.id, 'clinical', 'clinical.postop_checklist', 'DISCHARGE_NOTE',  'Discharge Note Issued',     5),
            (rec.id, 'clinical', 'clinical.postop_checklist', 'FOLLOW_SCHEDULED','Follow-Up Appointment Set', 6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.preop_clearance', 'FIT_FOR_LA',  'Fit for Local Anesthesia', 1),
            (rec.id, 'clinical', 'clinical.preop_clearance', 'FIT_FOR_GA',  'Fit for General Anesthesia',2),
            (rec.id, 'clinical', 'clinical.preop_clearance', 'CONDITIONAL', 'Conditional Clearance',    3),
            (rec.id, 'clinical', 'clinical.preop_clearance', 'DEFERRED',    'Deferred - Pending Tests', 4),
            (rec.id, 'clinical', 'clinical.preop_clearance', 'NOT_FIT',     'Not Fit for Surgery',      5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, is_system_locked, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.eye_notation', 'OD',    'OD (Right Eye)',  true, 1),
            (rec.id, 'clinical', 'clinical.eye_notation', 'OS',    'OS (Left Eye)',   true, 2),
            (rec.id, 'clinical', 'clinical.eye_notation', 'OU',    'OU (Both Eyes)', true, 3),
            (rec.id, 'clinical', 'clinical.eye_notation', 'OD_OS', 'OD/OS',          true, 4)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'clinical', 'clinical.scan_type', 'OCT',         'OCT (Optical Coherence Tomography)',1),
            (rec.id, 'clinical', 'clinical.scan_type', 'FUNDUS',      'Fundus Photography',                2),
            (rec.id, 'clinical', 'clinical.scan_type', 'FLUORESCEIN', 'Fluorescein Angiography',           3),
            (rec.id, 'clinical', 'clinical.scan_type', 'BIOMETRY',    'Biometry (IOL Master)',             4),
            (rec.id, 'clinical', 'clinical.scan_type', 'TOPOGRAPHY',  'Corneal Topography',                5),
            (rec.id, 'clinical', 'clinical.scan_type', 'ULTRASOUND',  'B-Scan Ultrasound',                 6),
            (rec.id, 'clinical', 'clinical.scan_type', 'VF',          'Visual Field Test',                 7),
            (rec.id, 'clinical', 'clinical.scan_type', 'ERG',         'Electroretinography (ERG)',         8),
            (rec.id, 'clinical', 'clinical.scan_type', 'VEP',         'Visual Evoked Potential (VEP)',     9)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 3: Appointments
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'appointments', 'appointment.type', 'OPD',         'OPD Consultation',  1),
            (rec.id, 'appointments', 'appointment.type', 'REVIEW',      'Review',            2),
            (rec.id, 'appointments', 'appointment.type', 'SURGERY',     'Surgery',           3),
            (rec.id, 'appointments', 'appointment.type', 'CAMP',        'Camp',              4),
            (rec.id, 'appointments', 'appointment.type', 'TELECONSULT', 'Tele-Consultation', 5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'appointments', 'appointment.consultation_type', 'FIRST_VISIT',   'First Visit',    1),
            (rec.id, 'appointments', 'appointment.consultation_type', 'FOLLOW_UP',     'Follow-Up',      2),
            (rec.id, 'appointments', 'appointment.consultation_type', 'POST_OP',       'Post-Op',        3),
            (rec.id, 'appointments', 'appointment.consultation_type', 'EMERGENCY',     'Emergency',      4),
            (rec.id, 'appointments', 'appointment.consultation_type', 'SECOND_OPINION','Second Opinion', 5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'appointments', 'appointment.priority', 'ROUTINE',   'Routine',   1),
            (rec.id, 'appointments', 'appointment.priority', 'URGENT',    'Urgent',    2),
            (rec.id, 'appointments', 'appointment.priority', 'EMERGENCY', 'Emergency', 3)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'appointments', 'appointment.cancel_reason', 'PATIENT_REQUEST', 'Patient Request',       1),
            (rec.id, 'appointments', 'appointment.cancel_reason', 'DOCTOR_UNAVAIL',  'Doctor Unavailable',    2),
            (rec.id, 'appointments', 'appointment.cancel_reason', 'NO_SHOW',         'No Show',               3),
            (rec.id, 'appointments', 'appointment.cancel_reason', 'DUPLICATE',       'Duplicate Appointment', 4),
            (rec.id, 'appointments', 'appointment.cancel_reason', 'RESCHEDULED',     'Rescheduled',           5),
            (rec.id, 'appointments', 'appointment.cancel_reason', 'OTHER',           'Other',                 6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 4: Counsellor
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'counsellor', 'counsellor.session_type', 'INITIAL',   'Initial Counseling',   1),
            (rec.id, 'counsellor', 'counsellor.session_type', 'FOLLOW_UP', 'Follow-Up',            2),
            (rec.id, 'counsellor', 'counsellor.session_type', 'PRE_OP',    'Pre-Op Counseling',    3),
            (rec.id, 'counsellor', 'counsellor.session_type', 'POST_OP',   'Post-Op Counseling',   4),
            (rec.id, 'counsellor', 'counsellor.session_type', 'PACKAGE',   'Package Finalization', 5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'PHACO_STD',    'Phaco Standard',   1),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'PHACO_PREM',   'Phaco Premium',    2),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'LASIK_BASIC',  'LASIK Basic',      3),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'LASIK_ADV',    'LASIK Advanced',   4),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'RETINA_PKG',   'Retina Package',   5),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'CORNEA_PKG',   'Cornea Package',   6),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'GLAUCOMA_PKG', 'Glaucoma Package', 7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'counsellor', 'counsellor.callback_type', 'SCHEDULED', 'Scheduled Callback', 1),
            (rec.id, 'counsellor', 'counsellor.callback_type', 'REMINDER',  'Reminder Call',      2),
            (rec.id, 'counsellor', 'counsellor.callback_type', 'FOLLOW_UP', 'Follow-Up Call',     3),
            (rec.id, 'counsellor', 'counsellor.callback_type', 'NO_SHOW',   'No-Show Follow-Up',  4),
            (rec.id, 'counsellor', 'counsellor.callback_type', 'URGENT',    'Urgent Callback',    5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'counsellor', 'counsellor.reminder_type', 'PRE_OP_DAY',    'Pre-Op Day Reminder',    1),
            (rec.id, 'counsellor', 'counsellor.reminder_type', 'APPOINTMENT',   'Appointment Reminder',   2),
            (rec.id, 'counsellor', 'counsellor.reminder_type', 'FOLLOW_UP',     'Follow-Up Reminder',     3),
            (rec.id, 'counsellor', 'counsellor.reminder_type', 'PAYMENT_DUE',   'Payment Due Reminder',   4),
            (rec.id, 'counsellor', 'counsellor.reminder_type', 'RESULT_READY',  'Result Ready',           5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'counsellor', 'counsellor.comm_channel', 'PHONE',     'Phone Call', 1),
            (rec.id, 'counsellor', 'counsellor.comm_channel', 'SMS',       'SMS',        2),
            (rec.id, 'counsellor', 'counsellor.comm_channel', 'WHATSAPP',  'WhatsApp',   3),
            (rec.id, 'counsellor', 'counsellor.comm_channel', 'EMAIL',     'Email',      4),
            (rec.id, 'counsellor', 'counsellor.comm_channel', 'IN_PERSON', 'In Person',  5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 5: Billing & Finance
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'billing_finance', 'billing.payment_mode', 'CASH',      'Cash',              1),
            (rec.id, 'billing_finance', 'billing.payment_mode', 'CARD',      'Card (Debit/Credit)',2),
            (rec.id, 'billing_finance', 'billing.payment_mode', 'UPI',       'UPI',               3),
            (rec.id, 'billing_finance', 'billing.payment_mode', 'NEFT',      'NEFT/RTGS',         4),
            (rec.id, 'billing_finance', 'billing.payment_mode', 'CHEQUE',    'Cheque',            5),
            (rec.id, 'billing_finance', 'billing.payment_mode', 'INSURANCE', 'Insurance',         6),
            (rec.id, 'billing_finance', 'billing.payment_mode', 'DD',        'Demand Draft',      7),
            (rec.id, 'billing_finance', 'billing.payment_mode', 'ONLINE',    'Online Transfer',   8)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'CONSULTATION','Consultation Fee', 1),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'PROCEDURE',   'Procedure',        2),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'MEDICATION',  'Medication',       3),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'DIAGNOSTIC',  'Diagnostic Test',  4),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'ROOM_CHARGE', 'Room Charge',      5),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'NURSING',     'Nursing Charge',   6),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'SURGICAL',    'Surgical Charge',  7),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'ANESTHESIA',  'Anesthesia Charge',8),
            (rec.id, 'billing_finance', 'billing.bill_item_type', 'MISC',        'Miscellaneous',    9)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'billing_finance', 'billing.transaction_type', 'PAYMENT',  'Payment',   1),
            (rec.id, 'billing_finance', 'billing.transaction_type', 'ADVANCE',  'Advance',   2),
            (rec.id, 'billing_finance', 'billing.transaction_type', 'REFUND',   'Refund',    3),
            (rec.id, 'billing_finance', 'billing.transaction_type', 'DISCOUNT', 'Discount',  4),
            (rec.id, 'billing_finance', 'billing.transaction_type', 'WRITE_OFF','Write-Off', 5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 6: Insurance
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'insurance', 'insurance.provider', 'STAR_HEALTH',   'Star Health Insurance',  '{"type":"private"}', 1),
            (rec.id, 'insurance', 'insurance.provider', 'NEW_INDIA',     'New India Assurance',    '{"type":"public"}',  2),
            (rec.id, 'insurance', 'insurance.provider', 'ICICI_LOMBARD', 'ICICI Lombard',          '{"type":"private"}', 3),
            (rec.id, 'insurance', 'insurance.provider', 'HDFC_ERGO',     'HDFC Ergo',              '{"type":"private"}', 4),
            (rec.id, 'insurance', 'insurance.provider', 'BAJAJ_ALLIANZ', 'Bajaj Allianz',          '{"type":"private"}', 5),
            (rec.id, 'insurance', 'insurance.provider', 'ORIENTAL',      'Oriental Insurance',     '{"type":"public"}',  6),
            (rec.id, 'insurance', 'insurance.provider', 'NATIONAL',      'National Insurance',     '{"type":"public"}',  7),
            (rec.id, 'insurance', 'insurance.provider', 'UNITED_INDIA',  'United India Insurance', '{"type":"public"}',  8)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'insurance', 'insurance.tpa_provider', 'MEDI_ASSIST',  'Medi Assist',       1),
            (rec.id, 'insurance', 'insurance.tpa_provider', 'VIDAL_HEALTH', 'Vidal Health TPA',  2),
            (rec.id, 'insurance', 'insurance.tpa_provider', 'PARAMOUNT',    'Paramount Health',  3),
            (rec.id, 'insurance', 'insurance.tpa_provider', 'GOOD_HEALTH',  'Good Health TPA',   4),
            (rec.id, 'insurance', 'insurance.tpa_provider', 'HEALTH_INDIA', 'Health India TPA',  5),
            (rec.id, 'insurance', 'insurance.tpa_provider', 'FAMILY_HEALTH','Family Health Plan', 6),
            (rec.id, 'insurance', 'insurance.tpa_provider', 'ERICSON',      'Ericson TPA',       7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'insurance', 'insurance.govt_scheme', 'CGHS',         'CGHS',                          1),
            (rec.id, 'insurance', 'insurance.govt_scheme', 'ECHS',         'ECHS (Ex-Servicemen)',          2),
            (rec.id, 'insurance', 'insurance.govt_scheme', 'PMJAY',        'PM-JAY (Ayushman Bharat)',      3),
            (rec.id, 'insurance', 'insurance.govt_scheme', 'ESI',          'ESI Scheme',                    4),
            (rec.id, 'insurance', 'insurance.govt_scheme', 'AROGYASHREE',  'Arogyashree',                   5),
            (rec.id, 'insurance', 'insurance.govt_scheme', 'SGHS',         'State Govt Health Scheme',      6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'insurance', 'insurance.type', 'MEDICLAIM',     'Mediclaim',         '{"isCashless":false}', 1),
            (rec.id, 'insurance', 'insurance.type', 'CASHLESS',      'Cashless',          '{"isCashless":true}',  2),
            (rec.id, 'insurance', 'insurance.type', 'REIMBURSEMENT', 'Reimbursement',     '{"isCashless":false}', 3),
            (rec.id, 'insurance', 'insurance.type', 'COPAY',         'Co-Payment',        '{"isCashless":true}',  4),
            (rec.id, 'insurance', 'insurance.type', 'GOVT',          'Government Scheme', '{"isCashless":true}',  5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 7: Inventory
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'inventory', 'inventory.item_type', 'MEDICINE',   'Medicine',        1),
            (rec.id, 'inventory', 'inventory.item_type', 'SURGICAL',   'Surgical Supply', 2),
            (rec.id, 'inventory', 'inventory.item_type', 'EQUIPMENT',  'Equipment',       3),
            (rec.id, 'inventory', 'inventory.item_type', 'CONSUMABLE', 'Consumable',      4),
            (rec.id, 'inventory', 'inventory.item_type', 'IMPLANT',    'Implant',         5),
            (rec.id, 'inventory', 'inventory.item_type', 'STATIONERY', 'Stationery',      6),
            (rec.id, 'inventory', 'inventory.item_type', 'LINEN',      'Linen',           7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'inventory', 'inventory.uom', 'NOS',    'Nos (Numbers)', 1),
            (rec.id, 'inventory', 'inventory.uom', 'BOX',    'Box',           2),
            (rec.id, 'inventory', 'inventory.uom', 'STRIP',  'Strip',         3),
            (rec.id, 'inventory', 'inventory.uom', 'VIAL',   'Vial',          4),
            (rec.id, 'inventory', 'inventory.uom', 'AMPOULE','Ampoule',       5),
            (rec.id, 'inventory', 'inventory.uom', 'ML',     'ml',            6),
            (rec.id, 'inventory', 'inventory.uom', 'L',      'Litre',         7),
            (rec.id, 'inventory', 'inventory.uom', 'MG',     'mg',            8),
            (rec.id, 'inventory', 'inventory.uom', 'GM',     'gm',            9),
            (rec.id, 'inventory', 'inventory.uom', 'KG',     'kg',            10),
            (rec.id, 'inventory', 'inventory.uom', 'PAIR',   'Pair',          11),
            (rec.id, 'inventory', 'inventory.uom', 'SET',    'Set',           12)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'inventory', 'inventory.purchase_category', 'MEDICINE',   'Medicine',        1),
            (rec.id, 'inventory', 'inventory.purchase_category', 'SURGICAL',   'Surgical',        2),
            (rec.id, 'inventory', 'inventory.purchase_category', 'EQUIPMENT',  'Equipment',       3),
            (rec.id, 'inventory', 'inventory.purchase_category', 'CONSUMABLE', 'Consumable',      4),
            (rec.id, 'inventory', 'inventory.purchase_category', 'STATIONARY', 'Stationary',      5),
            (rec.id, 'inventory', 'inventory.purchase_category', 'MISC',       'Miscellaneous',   6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'inventory', 'inventory.vendor_category', 'PHARMA',     'Pharmaceutical',   1),
            (rec.id, 'inventory', 'inventory.vendor_category', 'SURGICAL',   'Surgical Supplies',2),
            (rec.id, 'inventory', 'inventory.vendor_category', 'EQUIPMENT',  'Equipment',        3),
            (rec.id, 'inventory', 'inventory.vendor_category', 'OPTICAL',    'Optical Supplies', 4),
            (rec.id, 'inventory', 'inventory.vendor_category', 'GENERAL',    'General Supplies', 5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'inventory', 'inventory.gst_rate', 'GST_0',  '0% GST',  '{"rate":0}',   1),
            (rec.id, 'inventory', 'inventory.gst_rate', 'GST_5',  '5% GST',  '{"rate":5}',   2),
            (rec.id, 'inventory', 'inventory.gst_rate', 'GST_12', '12% GST', '{"rate":12}',  3),
            (rec.id, 'inventory', 'inventory.gst_rate', 'GST_18', '18% GST', '{"rate":18}',  4),
            (rec.id, 'inventory', 'inventory.gst_rate', 'GST_28', '28% GST', '{"rate":28}',  5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'inventory', 'inventory.storage_condition', 'ROOM_TEMP',  'Room Temperature (15-25°C)', 1),
            (rec.id, 'inventory', 'inventory.storage_condition', 'COOL',       'Cool (8-15°C)',              2),
            (rec.id, 'inventory', 'inventory.storage_condition', 'REFRIGERATE','Refrigerate (2-8°C)',        3),
            (rec.id, 'inventory', 'inventory.storage_condition', 'FREEZE',     'Freeze (-20°C)',             4),
            (rec.id, 'inventory', 'inventory.storage_condition', 'DRY',        'Dry Place',                 5),
            (rec.id, 'inventory', 'inventory.storage_condition', 'DARK',       'Dark / Light-Protected',    6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'inventory', 'inventory.payment_term', 'IMMEDIATE', 'Immediate (0 days)', '{"days":0}',  1),
            (rec.id, 'inventory', 'inventory.payment_term', 'NET_15',    'Net 15 days',        '{"days":15}', 2),
            (rec.id, 'inventory', 'inventory.payment_term', 'NET_30',    'Net 30 days',        '{"days":30}', 3),
            (rec.id, 'inventory', 'inventory.payment_term', 'NET_45',    'Net 45 days',        '{"days":45}', 4),
            (rec.id, 'inventory', 'inventory.payment_term', 'NET_60',    'Net 60 days',        '{"days":60}', 5),
            (rec.id, 'inventory', 'inventory.payment_term', 'NET_90',    'Net 90 days',        '{"days":90}', 6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 8: Pharmacy
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'TABLET',    'Tablet',     1),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'CAPSULE',   'Capsule',    2),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'SYRUP',     'Syrup',      3),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'DROPS',     'Eye Drops',  4),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'OINTMENT',  'Ointment',   5),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'INJECTION', 'Injection',  6),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'PATCH',     'Patch',      7),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'INHALER',   'Inhaler',    8),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'GEL',       'Gel',        9),
            (rec.id, 'pharmacy', 'pharmacy.drug_form', 'SUSPENSION','Suspension', 10)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'pharmacy', 'pharmacy.drug_route', 'ORAL',        'Oral (PO)',            1),
            (rec.id, 'pharmacy', 'pharmacy.drug_route', 'TOPICAL_EYE', 'Topical - Eye',        2),
            (rec.id, 'pharmacy', 'pharmacy.drug_route', 'INTRAVITREAL','Intravitreal (IVT)',   3),
            (rec.id, 'pharmacy', 'pharmacy.drug_route', 'IV',          'Intravenous (IV)',     4),
            (rec.id, 'pharmacy', 'pharmacy.drug_route', 'IM',          'Intramuscular (IM)',   5),
            (rec.id, 'pharmacy', 'pharmacy.drug_route', 'SC',          'Subcutaneous (SC)',    6),
            (rec.id, 'pharmacy', 'pharmacy.drug_route', 'SUBCONJ',     'Subconjunctival',      7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'OD',     'Once Daily (OD)',        '{"timesPerDay":1}', 1),
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'BD',     'Twice Daily (BD)',        '{"timesPerDay":2}', 2),
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'TDS',    'Three Times Daily (TDS)', '{"timesPerDay":3}', 3),
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'QID',    'Four Times Daily (QID)',  '{"timesPerDay":4}', 4),
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'HS',     'At Bedtime (HS)',         '{"timesPerDay":1}', 5),
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'SOS',    'As Needed (SOS)',         '{"timesPerDay":0}', 6),
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'WEEKLY', 'Weekly',                  '{"timesPerDay":0}', 7),
            (rec.id, 'pharmacy', 'pharmacy.dosage_frequency', 'MONTHLY','Monthly',                 '{"timesPerDay":0}', 8)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'pharmacy', 'pharmacy.drug_schedule', 'H',   'Schedule H (Prescription)', 1),
            (rec.id, 'pharmacy', 'pharmacy.drug_schedule', 'H1',  'Schedule H1 (Controlled)',  2),
            (rec.id, 'pharmacy', 'pharmacy.drug_schedule', 'X',   'Schedule X (Narcotic)',     3),
            (rec.id, 'pharmacy', 'pharmacy.drug_schedule', 'OTC', 'OTC (Over the Counter)',    4),
            (rec.id, 'pharmacy', 'pharmacy.drug_schedule', 'G',   'Schedule G',               5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 9: Lab & Diagnostics
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'lab_diagnostics', 'lab.specimen_type', 'BLOOD',  'Blood',             1),
            (rec.id, 'lab_diagnostics', 'lab.specimen_type', 'URINE',  'Urine',             2),
            (rec.id, 'lab_diagnostics', 'lab.specimen_type', 'TISSUE', 'Tissue Biopsy',     3),
            (rec.id, 'lab_diagnostics', 'lab.specimen_type', 'FLUID',  'Aqueous Fluid',     4),
            (rec.id, 'lab_diagnostics', 'lab.specimen_type', 'SWAB',   'Conjunctival Swab', 5),
            (rec.id, 'lab_diagnostics', 'lab.specimen_type', 'TEARS',  'Tear Sample',       6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'lab_diagnostics', 'lab.imaging_modality', 'OCT',        'OCT',                    1),
            (rec.id, 'lab_diagnostics', 'lab.imaging_modality', 'FUNDUS',     'Fundus Camera',          2),
            (rec.id, 'lab_diagnostics', 'lab.imaging_modality', 'FA',         'Fluorescein Angiography',3),
            (rec.id, 'lab_diagnostics', 'lab.imaging_modality', 'BSCAN',      'B-Scan Ultrasound',      4),
            (rec.id, 'lab_diagnostics', 'lab.imaging_modality', 'TOPOGRAPHY', 'Corneal Topography',     5),
            (rec.id, 'lab_diagnostics', 'lab.imaging_modality', 'PENTACAM',   'Pentacam',               6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'lab_diagnostics', 'lab.ep_type', 'ERG', 'Electroretinography (ERG)',      1),
            (rec.id, 'lab_diagnostics', 'lab.ep_type', 'VEP', 'Visual Evoked Potential (VEP)',  2),
            (rec.id, 'lab_diagnostics', 'lab.ep_type', 'EOG', 'Electro-oculography (EOG)',      3)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 10: Ward & IP
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'ward_ip', 'ward.ward_type', 'GENERAL',      'General Ward',   1),
            (rec.id, 'ward_ip', 'ward.ward_type', 'SEMI_PRIVATE', 'Semi-Private',   2),
            (rec.id, 'ward_ip', 'ward.ward_type', 'PRIVATE',      'Private Room',   3),
            (rec.id, 'ward_ip', 'ward.ward_type', 'ICU',          'ICU',            4),
            (rec.id, 'ward_ip', 'ward.ward_type', 'DAY_CARE',     'Day Care',       5),
            (rec.id, 'ward_ip', 'ward.ward_type', 'PEDIATRIC',    'Pediatric Ward', 6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'ward_ip', 'ward.bed_type', 'REGULAR',   'Regular Bed',    1),
            (rec.id, 'ward_ip', 'ward.bed_type', 'OT',        'OT Table',       2),
            (rec.id, 'ward_ip', 'ward.bed_type', 'RECLINER',  'Recliner Chair', 3),
            (rec.id, 'ward_ip', 'ward.bed_type', 'STRETCHER', 'Stretcher',      4)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'ward_ip', 'ward.admission_type', 'ELECTIVE',  'Elective',  1),
            (rec.id, 'ward_ip', 'ward.admission_type', 'EMERGENCY', 'Emergency', 2),
            (rec.id, 'ward_ip', 'ward.admission_type', 'DAY_CARE',  'Day Care',  3),
            (rec.id, 'ward_ip', 'ward.admission_type', 'REFERRAL',  'Referral',  4)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 11: HR & Staff
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'hr_staff', 'hr.employment_type', 'PERMANENT',  'Permanent',       1),
            (rec.id, 'hr_staff', 'hr.employment_type', 'CONTRACT',   'Contract',        2),
            (rec.id, 'hr_staff', 'hr.employment_type', 'PART_TIME',  'Part-Time',       3),
            (rec.id, 'hr_staff', 'hr.employment_type', 'CONSULTANT', 'Consultant',      4),
            (rec.id, 'hr_staff', 'hr.employment_type', 'INTERN',     'Intern',          5),
            (rec.id, 'hr_staff', 'hr.employment_type', 'VISITING',   'Visiting Doctor', 6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'hr_staff', 'hr.qualification_type', 'MBBS',     'MBBS',                   1),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'MD',       'MD',                     2),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'MS',       'MS',                     3),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'DNB',      'DNB',                    4),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'DO',       'DO (Ophthalmology)',      5),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'PHARM_D',  'Pharm.D',                6),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'BOPTOM',   'BOptom',                 7),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'BSC_NURS', 'B.Sc Nursing',           8),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'GNM',      'GNM',                    9),
            (rec.id, 'hr_staff', 'hr.qualification_type', 'OTHER',    'Other',                  10)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'hr_staff', 'hr.leave_type', 'CASUAL',    'Casual Leave',      1),
            (rec.id, 'hr_staff', 'hr.leave_type', 'SICK',      'Sick Leave',        2),
            (rec.id, 'hr_staff', 'hr.leave_type', 'EARNED',    'Earned Leave',      3),
            (rec.id, 'hr_staff', 'hr.leave_type', 'MATERNITY', 'Maternity Leave',   4),
            (rec.id, 'hr_staff', 'hr.leave_type', 'PATERNITY', 'Paternity Leave',   5),
            (rec.id, 'hr_staff', 'hr.leave_type', 'COMP_OFF',  'Compensatory Off',  6),
            (rec.id, 'hr_staff', 'hr.leave_type', 'LWP',       'Leave Without Pay', 7)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'hr_staff', 'hr.shift_type', 'MORNING',   'Morning Shift',   1),
            (rec.id, 'hr_staff', 'hr.shift_type', 'AFTERNOON', 'Afternoon Shift', 2),
            (rec.id, 'hr_staff', 'hr.shift_type', 'NIGHT',     'Night Shift',     3),
            (rec.id, 'hr_staff', 'hr.shift_type', 'GENERAL',   'General Shift',   4),
            (rec.id, 'hr_staff', 'hr.shift_type', 'SPLIT',     'Split Shift',     5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'hr_staff', 'hr.performance_rating', 'EXCELLENT',    'Excellent (5)',      1),
            (rec.id, 'hr_staff', 'hr.performance_rating', 'GOOD',         'Good (4)',           2),
            (rec.id, 'hr_staff', 'hr.performance_rating', 'SATISFACTORY', 'Satisfactory (3)',   3),
            (rec.id, 'hr_staff', 'hr.performance_rating', 'NEEDS_IMPROV', 'Needs Improvement',  4),
            (rec.id, 'hr_staff', 'hr.performance_rating', 'POOR',         'Poor (1)',           5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'hr_staff', 'hr.credential_type', 'MEDICAL_LICENSE', 'Medical License',     1),
            (rec.id, 'hr_staff', 'hr.credential_type', 'DEA',             'DEA Certificate',     2),
            (rec.id, 'hr_staff', 'hr.credential_type', 'BOARD_CERT',      'Board Certification', 3),
            (rec.id, 'hr_staff', 'hr.credential_type', 'CPR',             'CPR Certification',   4),
            (rec.id, 'hr_staff', 'hr.credential_type', 'HOSPITAL_PRIV',   'Hospital Privileges', 5),
            (rec.id, 'hr_staff', 'hr.credential_type', 'OTHER',           'Other',               6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        -- =============================================
        -- GROUP 12: System
        -- =============================================

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'system', 'system.department', 'ADMISSIONS',  'Admissions',        1),
            (rec.id, 'system', 'system.department', 'BILLING',     'Billing',           2),
            (rec.id, 'system', 'system.department', 'LAB',         'Laboratory',        3),
            (rec.id, 'system', 'system.department', 'OT',          'Operation Theatre', 4),
            (rec.id, 'system', 'system.department', 'PHARMACY',    'Pharmacy',          5),
            (rec.id, 'system', 'system.department', 'RADIOLOGY',   'Radiology',         6),
            (rec.id, 'system', 'system.department', 'NURSING',     'Nursing',           7),
            (rec.id, 'system', 'system.department', 'ANESTHESIA',  'Anesthesia',        8),
            (rec.id, 'system', 'system.department', 'COUNSELLING', 'Counselling',       9),
            (rec.id, 'system', 'system.department', 'OPTICAL',     'Optical',           10),
            (rec.id, 'system', 'system.department', 'HR',          'HR / Admin',        11),
            (rec.id, 'system', 'system.department', 'IT',          'IT',                12)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'system', 'system.timezone', 'IST', 'India Standard Time (IST)',  '{"offset":"+05:30","tz":"Asia/Kolkata"}',       1),
            (rec.id, 'system', 'system.timezone', 'UTC', 'UTC',                        '{"offset":"+00:00","tz":"UTC"}',                2),
            (rec.id, 'system', 'system.timezone', 'EST', 'Eastern Standard Time (EST)','{"offset":"-05:00","tz":"America/New_York"}',   3),
            (rec.id, 'system', 'system.timezone', 'PST', 'Pacific Standard Time (PST)','{"offset":"-08:00","tz":"America/Los_Angeles"}',4),
            (rec.id, 'system', 'system.timezone', 'GST', 'Gulf Standard Time (GST)',   '{"offset":"+04:00","tz":"Asia/Dubai"}',         5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'system', 'system.currency', 'INR', 'Indian Rupee (₹)', '{"symbol":"₹","iso":"INR"}',   1),
            (rec.id, 'system', 'system.currency', 'USD', 'US Dollar ($)',     '{"symbol":"$","iso":"USD"}',   2),
            (rec.id, 'system', 'system.currency', 'AED', 'UAE Dirham (AED)', '{"symbol":"AED","iso":"AED"}', 3)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (rec.id, 'system', 'system.language', 'EN', 'English',   '{"locale":"en"}', 1),
            (rec.id, 'system', 'system.language', 'HI', 'Hindi',     '{"locale":"hi"}', 2),
            (rec.id, 'system', 'system.language', 'TE', 'Telugu',    '{"locale":"te"}', 3),
            (rec.id, 'system', 'system.language', 'TA', 'Tamil',     '{"locale":"ta"}', 4),
            (rec.id, 'system', 'system.language', 'KN', 'Kannada',   '{"locale":"kn"}', 5),
            (rec.id, 'system', 'system.language', 'ML', 'Malayalam', '{"locale":"ml"}', 6)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (rec.id, 'system', 'system.checklist_default', 'CONSENT_SIGNED',   'Consent Form Signed',       1),
            (rec.id, 'system', 'system.checklist_default', 'ID_VERIFIED',      'ID Verified',               2),
            (rec.id, 'system', 'system.checklist_default', 'ALLERGIES_CHECKED','Allergies Checked',         3),
            (rec.id, 'system', 'system.checklist_default', 'VITALS_RECORDED',  'Vitals Recorded',           4),
            (rec.id, 'system', 'system.checklist_default', 'PAYMENT_CLEARED',  'Payment Cleared',           5)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

        RAISE NOTICE 'Seeding complete for tenant: %', rec.id;
    END LOOP;

    RAISE NOTICE 'Migration 55 complete: all tenants seeded with 65 entity types across 12 groups.';
END;
$$;
