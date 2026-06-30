-- ============================================================================
-- Migration 143: COUNSELLOR_INVESTIGATION_PREOP — optional draft lab values
-- Dependencies: 142_ward_investigation_results.sql
-- Date: 2026-06
-- ============================================================================

BEGIN;

INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     form_code, form_context, display_order, status, item_config)
VALUES
(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_blood_sugar',
 'Blood Sugar', 'Optional FBS/RBS from external lab or patient report.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 10, 'active',
 '{"valueType":"numeric","defaultUnit":"mg/dL","wardTargetKey":"blood_sugar"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_serum_creatinine',
 'Serum Creatinine', 'Optional creatinine from external lab.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 20, 'active',
 '{"valueType":"text","defaultUnit":"","wardTargetKey":"serum_creatinine"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_blood_urea',
 'Blood Urea', 'Optional blood urea from external lab.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 30, 'active',
 '{"valueType":"text","defaultUnit":"","wardTargetKey":"blood_urea"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_hiv_done',
 'HIV', 'Optional HIV serology from external lab.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 40, 'active',
 '{"valueType":"text","defaultUnit":"","wardTargetKey":"hiv_done"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_hba1c_done',
 'HbA1C', 'Optional HbA1C when patient brings report.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 50, 'active',
 '{"valueType":"text","defaultUnit":"","wardTargetKey":"hba1c_done"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_hemoglobin',
 'Hb / Hemoglobin', 'Optional hemoglobin / CBC from external lab.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 60, 'active',
 '{"valueType":"numeric","defaultUnit":"g/dL","wardTargetKey":"hemoglobin"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_ascan_done',
 'A-Scan', 'Optional A-scan biometry notes or values from external centre.',
 'Optometry', 'STD_IMAGING', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 70, 'active',
 '{"valueType":"text","defaultUnit":"mm","wardTargetKey":"ascan_done"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_hbsag_done',
 'HBsAg', 'Optional hepatitis B serology from external lab.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 80, 'active',
 '{"valueType":"text","defaultUnit":"","wardTargetKey":"hbsag_done"}'::jsonb),

(gen_random_uuid(), NULL, 'Counsellor Investigation', 'couns_preop_hcv_done',
 'HCV', 'Optional hepatitis C serology from external lab.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'COUNSELLOR_INVESTIGATION_PREOP', 'counsellor_investigation', 90, 'active',
 '{"valueType":"text","defaultUnit":"","wardTargetKey":"hcv_done"}'::jsonb)

ON CONFLICT (item_key) DO UPDATE SET
    form_code         = EXCLUDED.form_code,
    form_context      = EXCLUDED.form_context,
    category          = EXCLUDED.category,
    item_label        = EXCLUDED.item_label,
    description       = EXCLUDED.description,
    display_order     = EXCLUDED.display_order,
    status            = 'active',
    is_active         = TRUE,
    is_mandatory      = FALSE,
    is_blocking       = FALSE,
    item_config       = EXCLUDED.item_config,
    updated_at        = NOW();

COMMIT;
