-- ============================================================================
-- Migration 144: Ward Pre-Op Workspace v2 — catalog dedupe + derived-tick layer
-- Purpose (Phase 2 of the Ward Pre-Op redesign — see
--   apps/hospital-portal-web/docs/ward-preop-redesign-phase0-mapping.md §9):
--   1. ADD `blood_group` writer to §1 Investigations (Q2)
--   2. Tag §1 rows with `item_config.captureMode`; imaging report optional (Q-imaging)
--   3. Mark BP / §2 / §3 duplicates as DERIVE (item_config.derivedFrom + nonEditable)
--   4. RE-HOME `consent_confirmed` (keep key+data) and bedside prep items (uiStep)
--   5. DEACTIVATE the Documents category (docs attach to owning facts) (D14)
--   6. ACTIVATE Pharmacy / OT Preparation sets; OT blocking, Pharmacy non-blocking (Q4)
--
-- Notes:
--   * Catalog-only. Auto-tick wiring (WardChecklistAutoSyncService) is Phase 8;
--     this migration only records the single-writer config the UI/service read.
--   * Reversible — rows are DEACTIVATED, never hard-deleted (preserves history/audit).
--   * Idempotent — safe to re-run (ON CONFLICT + jsonb merge + guarded UPDATEs).
--   * `derivedFrom` values use the canonical writer's item_key when it is a checklist
--     item, or a logical source token (vitals, pac.allergies, pac.complete, pac.plan,
--     financialState, medlog.dilatation, investigations) when the writer is an entity.
-- Dependencies: 142_ward_investigation_results.sql (item_config column),
--               135_s1_ward_checklist.sql, 93_preop_section_expansion.sql, 92 seed
-- Date: 2026-06
--
-- Rollback (manual — run only if reverting 144):
--   UPDATE pre_op_section_items SET status='active', is_active=true
--     WHERE tenant_id IS NULL AND category='Documents';
--   UPDATE pre_op_section_items SET status='inactive', is_active=false
--     WHERE item_key='blood_group';
--   -- Strip added item_config keys (captureMode/derivedFrom/nonEditable/uiStep/role)
--   -- by re-running migrations 142/93 configs, or reset to '{}'::jsonb as appropriate.
-- ============================================================================

BEGIN;

-- ── 1. ADD `blood_group` writer to §1 Investigations (Q2) ────────────────────
INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     form_code, form_context, display_order, status, item_config)
VALUES
(gen_random_uuid(), NULL, 'Ward Investigation', 'blood_group',
 'Blood Group', 'ABO/Rh blood group. Auto-populated from patient demographics; ward enters/verifies when missing.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', 125, 'active',
 '{"captureMode":"select","valueType":"select","isCritical":false,'
 '"masterList":"patient.blood_group","autoPopulateFrom":"patient.blood_group",'
 '"options":["A+","A-","B+","B-","AB+","AB-","O+","O-"]}'::jsonb)
ON CONFLICT (item_key) DO UPDATE SET
    form_code     = EXCLUDED.form_code,
    form_context  = EXCLUDED.form_context,
    category      = EXCLUDED.category,
    item_label    = EXCLUDED.item_label,
    description   = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    status        = 'active',
    is_active     = TRUE,
    item_config   = COALESCE(pre_op_section_items.item_config, '{}'::jsonb) || EXCLUDED.item_config,
    updated_at    = NOW();

-- ── 2. §1 capture-mode model + imaging report optional (Q-imaging) ────────────
-- Merge `captureMode` (and clear requiresReport on imaging/cardiac rows).

UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb) || '{"captureMode":"value"}'::jsonb,
    updated_at = NOW()
WHERE form_code = 'WARD_INVESTIGATION_PREOP'
  AND item_key IN ('blood_sugar', 'blood_urea', 'serum_creatinine', 'hba1c_done', 'hemoglobin', 'pt_inr');

UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb) || '{"captureMode":"result-text"}'::jsonb,
    updated_at = NOW()
WHERE form_code = 'WARD_INVESTIGATION_PREOP'
  AND item_key IN ('hiv_done', 'hbsag_done', 'hcv_done');

UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb) || '{"captureMode":"attestation"}'::jsonb,
    updated_at = NOW()
WHERE form_code = 'WARD_INVESTIGATION_PREOP'
  AND item_key IN ('physician_fitness', 'duct_assessed');

-- Imaging / cardiac: value+report but report upload is OPTIONAL (value completes the row)
UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb) || '{"captureMode":"value+report","requiresReport":false}'::jsonb,
    updated_at = NOW()
WHERE form_code = 'WARD_INVESTIGATION_PREOP'
  AND item_key IN ('ascan_done', 'bscan_done', 'ecg_done');

-- X-Ray (GA only): upload-driven; report optional
UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb) || '{"captureMode":"report","requiresReport":false}'::jsonb,
    updated_at = NOW()
WHERE form_code = 'WARD_INVESTIGATION_PREOP'
  AND item_key = 'xray_ga_cases';

-- bp_checked (§1) becomes a read-only reflection of Vitals (Q1, D10)
UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb)
        || '{"captureMode":"derived","derivedFrom":"vitals","nonEditable":true}'::jsonb,
    updated_at = NOW()
WHERE form_code = 'WARD_INVESTIGATION_PREOP'
  AND item_key = 'bp_checked';

-- ── 3. Convert duplicates to DERIVE (read-only reflections) ───────────────────
-- §3 Ward Safety (WARD_CHECKLIST)
UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb)
        || jsonb_build_object('derivedFrom', src.writer, 'nonEditable', true),
    updated_at = NOW()
FROM (VALUES
    ('patient_identity_confirmed',     'identity_verified'),
    ('operation_site_marked',          'surgery_site_marked'),
    ('consent_patient_signed',         'surgery_consent_signed'),
    ('consent_witness_signed',         'surgery_consent_signed'),
    ('consent_surgeon_signed',         'surgery_consent_signed'),
    ('investigation_reports_available','investigations'),
    ('ward_ascan_confirmed',           'ascan_done'),
    ('vitals_checked',                 'vitals'),
    ('known_allergies_documented',     'pac.allergies'),
    ('bill_payment_confirmed',         'financialState'),
    ('pac_done_documented',            'pac.complete')
) AS src(item_key, writer)
WHERE pre_op_section_items.item_key = src.item_key
  AND pre_op_section_items.form_code = 'WARD_CHECKLIST';

-- §2 Department Clearance derives (Compliance + Anaesthesia)
UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb)
        || jsonb_build_object('derivedFrom', src.writer, 'nonEditable', true),
    updated_at = NOW()
FROM (VALUES
    ('fasting_hours',            'last_food_time'),
    ('fasting_confirmed',        'last_food_time'),
    ('allergy_communicated',     'pac.allergies'),
    ('blood_group_confirmed',    'blood_group'),
    ('anaesthesia_type_selected','pac.plan'),
    ('fitness_assessed',         'pac.complete')
) AS src(item_key, writer)
WHERE pre_op_section_items.item_key = src.item_key
  AND pre_op_section_items.tenant_id IS NULL
  AND COALESCE(pre_op_section_items.form_code, '') NOT IN ('WARD_INVESTIGATION_PREOP', 'WARD_CHECKLIST');

-- ── 4. RE-HOME (keep key + data, change UI step) ──────────────────────────────
-- consent_confirmed (§1): NOT a real investigation. Remove from §1 UI but KEEP the
-- key + completion data (counsellor→ward copy target). Surface in ④ Consent as a
-- counsellor-sourced draft pre-fill for surgery_consent_signed. Do NOT deactivate. (Q3)
UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb)
        || '{"uiStep":"consent","role":"counsellor_draft"}'::jsonb,
    updated_at = NOW()
WHERE item_key = 'consent_confirmed'
  AND form_code = 'WARD_INVESTIGATION_PREOP';

-- Bedside prep items mis-filed under Consent → render in ⑦ Bedside Safety (D15)
UPDATE pre_op_section_items SET
    item_config = COALESCE(item_config, '{}'::jsonb) || '{"uiStep":"bedside"}'::jsonb,
    updated_at = NOW()
WHERE tenant_id IS NULL
  AND category = 'Consent'
  AND item_key IN ('contact_lens_removed', 'valuables_removed');

-- ── 5. DEACTIVATE Documents category (D14) ────────────────────────────────────
-- Each document now uploads against its owning fact; no separate "uploaded?" tick.
UPDATE pre_op_section_items SET
    status = 'inactive',
    is_active = FALSE,
    updated_at = NOW()
WHERE tenant_id IS NULL
  AND item_key IN (
      'consent_form_doc', 'lab_reports_doc', 'imaging_reports_doc',
      'fitness_certificate_doc', 'identity_proof_doc',
      'insurance_card_doc', 'government_card_doc'
  );

-- ── 6. ACTIVATE Pharmacy / OT Preparation (Q4) ────────────────────────────────
-- Re-seed (idempotent) so this works whether or not migration 93 ran in this env.
-- Pharmacy = non-blocking; OT = blocking for Send to OT. Overlap rows carry derivedFrom.
INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     display_order, status, item_config)
VALUES
-- Pharmacy Preparation (STD_PHARMACY) — non-blocking
(gen_random_uuid(), NULL, 'Pharmacy Preparation', 'dilation_drops_administered',
 'Dilation Drops Administered',
 'Mydriatic/cycloplegic drops administered as per surgeon protocol.',
 'STD_PHARMACY', 'STD_PHARMACY', TRUE, FALSE, FALSE, 10, 'active',
 '{"derivedFrom":"medlog.dilatation","nonEditable":true}'::jsonb),

(gen_random_uuid(), NULL, 'Pharmacy Preparation', 'antibiotic_drops_given',
 'Antibiotic Eye Drops Given',
 'Pre-operative antibiotic drops given (e.g. Ofloxacin/Moxifloxacin) as per protocol.',
 'STD_PHARMACY', 'STD_PHARMACY', TRUE, FALSE, FALSE, 20, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'Pharmacy Preparation', 'anaesthetic_drops_ready',
 'Anaesthetic / NSAID Drops Ready',
 'Topical anaesthetic drops and NSAID drops (if required) prepared and verified.',
 'STD_PHARMACY', 'STD_PHARMACY', TRUE, FALSE, FALSE, 30, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'Pharmacy Preparation', 'iv_access_established',
 'IV Access Established (if required)',
 'Peripheral IV cannula inserted and patency confirmed for GA / IV sedation cases.',
 'STD_PHARMACY', 'STD_PHARMACY', FALSE, FALSE, FALSE, 40, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'Pharmacy Preparation', 'medication_reconciliation',
 'Medication Reconciliation Completed',
 'All current medications reviewed; contraindicated drugs held; substitutions documented.',
 'STD_PHARMACY', 'STD_PHARMACY', TRUE, FALSE, FALSE, 50, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'Pharmacy Preparation', 'drug_allergy_reconfirmed',
 'Drug Allergy History Reconfirmed',
 'Known drug allergies verbally reconfirmed with patient before dispensing.',
 'STD_PHARMACY', 'STD_PHARMACY', TRUE, FALSE, FALSE, 60, 'active',
 '{"derivedFrom":"pac.allergies","nonEditable":true}'::jsonb),

-- OT Preparation (STD_INVENTORY) — blocking for Send to OT
(gen_random_uuid(), NULL, 'OT Preparation', 'iol_power_confirmed',
 'IOL Power Confirmed',
 'IOL power calculation verified from biometry report and confirmed by surgeon.',
 'STD_INVENTORY', 'STD_INVENTORY', TRUE, TRUE, FALSE, 10, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'OT Preparation', 'iol_available_in_stock',
 'IOL Available in Stock',
 'Required IOL model and power confirmed available and reserved in inventory.',
 'STD_INVENTORY', 'STD_INVENTORY', TRUE, TRUE, FALSE, 20, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'OT Preparation', 'iol_barcode_verified',
 'IOL Barcode Scanned & Verified',
 'IOL barcode scanned and matched to patient record. Label retained in file.',
 'STD_INVENTORY', 'STD_INVENTORY', TRUE, TRUE, TRUE, 30, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'OT Preparation', 'instrument_pack_sterilized',
 'Instrument Pack Sterilized',
 'Phaco/MSICS/LASIK instrument pack sterilized and sterility indicator checked.',
 'STD_INVENTORY', 'STD_INVENTORY', TRUE, TRUE, FALSE, 40, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'OT Preparation', 'ot_slot_confirmed',
 'OT Slot Confirmed',
 'Patient allotted a specific OT room and slot time; OT schedule updated.',
 'STD_INVENTORY', 'STD_INVENTORY', TRUE, TRUE, FALSE, 50, 'active', '{}'::jsonb),

(gen_random_uuid(), NULL, 'OT Preparation', 'surgical_supplies_ready',
 'Surgical Supplies Ready',
 'Viscoelastic, BSS, sutures, drapes, and consumables checked and laid out.',
 'STD_INVENTORY', 'STD_INVENTORY', TRUE, TRUE, FALSE, 60, 'active', '{}'::jsonb)

ON CONFLICT (item_key) DO UPDATE SET
    category      = EXCLUDED.category,
    item_label    = EXCLUDED.item_label,
    description   = EXCLUDED.description,
    department_owner = EXCLUDED.department_owner,
    responsible_department_code = EXCLUDED.responsible_department_code,
    is_mandatory  = EXCLUDED.is_mandatory,
    is_blocking   = EXCLUDED.is_blocking,
    requires_document = EXCLUDED.requires_document,
    display_order = EXCLUDED.display_order,
    status        = 'active',
    is_active     = TRUE,
    item_config   = COALESCE(pre_op_section_items.item_config, '{}'::jsonb) || EXCLUDED.item_config,
    updated_at    = NOW();

DO $$
BEGIN
    RAISE NOTICE 'Migration 144 complete: blood_group added; §1 capture modes set; '
        '§2/§3/bp_checked derives flagged; consent_confirmed re-homed; Documents '
        'deactivated; Pharmacy/OT Preparation activated (OT blocking).';
END $$;

COMMIT;
