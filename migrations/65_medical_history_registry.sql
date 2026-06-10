-- =============================================
-- Migration 65: Medical history master entity types (B8)
-- Registers 9 picklist types in entity_type_registry + seeds all tenants.
-- Aligns Master Data admin tabs with integration-manifest wired entries.
-- Idempotent — ON CONFLICT upserts labels/sort_order.
-- =============================================

INSERT INTO master.entity_type_registry (entity_type, group_key, display_name, tab_label, sort_order) VALUES
    ('medical_history.chronic_condition',   'clinical', 'Chronic Conditions',      'Chronic Conditions',   12),
    ('medical_history.medication',          'clinical', 'Medications (History)',   'Medications',          13),
    ('medical_history.surgery',             'clinical', 'Past Surgeries',          'Past Surgeries',       14),
    ('medical_history.family_condition',    'clinical', 'Family Conditions',       'Family Conditions',    15),
    ('medical_history.immunization',        'clinical', 'Immunizations',           'Immunizations',        16),
    ('medical_history.medication_route',    'clinical', 'Medication Routes',       'Med Routes',           17),
    ('medical_history.family_relationship', 'clinical', 'Family Relationships',    'Family Relations',     18),
    ('medical_history.smoking_status',      'clinical', 'Smoking Status',          'Smoking',              19),
    ('medical_history.alcohol_use',         'clinical', 'Alcohol Use',             'Alcohol',              20)
ON CONFLICT (entity_type) DO UPDATE SET
    group_key = EXCLUDED.group_key,
    display_name = EXCLUDED.display_name,
    tab_label = EXCLUDED.tab_label,
    sort_order = EXCLUDED.sort_order;

DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            -- chronic_condition
            (v_tenant_id, 'clinical', 'medical_history.chronic_condition', 'DM2',     'Diabetes Type 2',        '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.chronic_condition', 'HTN',     'Hypertension',           '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.chronic_condition', 'ASTHMA',  'Asthma',                 '{}', 3),
            (v_tenant_id, 'clinical', 'medical_history.chronic_condition', 'GLAUCOMA', 'Glaucoma',              '{"isEyeRelevant":true}', 4),
            (v_tenant_id, 'clinical', 'medical_history.chronic_condition', 'CATARACT', 'Cataracts',            '{"isEyeRelevant":true}', 5),
            (v_tenant_id, 'clinical', 'medical_history.chronic_condition', 'DR',      'Diabetic Retinopathy',   '{"isEyeRelevant":true}', 6),
            (v_tenant_id, 'clinical', 'medical_history.chronic_condition', 'OTHER',   'Other',                  '{}', 99),

            -- medication
            (v_tenant_id, 'clinical', 'medical_history.medication', 'METFORMIN',     'Metformin',     '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.medication', 'LISINOPRIL',    'Lisinopril',    '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.medication', 'ATORVASTATIN',  'Atorvastatin',  '{}', 3),
            (v_tenant_id, 'clinical', 'medical_history.medication', 'INSULIN',       'Insulin',       '{}', 4),
            (v_tenant_id, 'clinical', 'medical_history.medication', 'OTHER',         'Other',         '{}', 99),

            -- surgery
            (v_tenant_id, 'clinical', 'medical_history.surgery', 'CATARACT',   'Cataract Surgery', '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.surgery', 'LASIK',      'LASIK',            '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.surgery', 'VITRECTOMY', 'Vitrectomy',       '{}', 3),
            (v_tenant_id, 'clinical', 'medical_history.surgery', 'OTHER',      'Other',            '{}', 99),

            -- family_condition
            (v_tenant_id, 'clinical', 'medical_history.family_condition', 'DIABETES', 'Diabetes',   '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.family_condition', 'HTN',      'Hypertension', '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.family_condition', 'GLAUCOMA', 'Glaucoma',   '{"isEyeRelevant":true}', 3),
            (v_tenant_id, 'clinical', 'medical_history.family_condition', 'OTHER',    'Other',      '{}', 99),

            -- immunization
            (v_tenant_id, 'clinical', 'medical_history.immunization', 'COVID19',   'COVID-19',  '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.immunization', 'INFLUENZA', 'Influenza', '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.immunization', 'TETANUS',   'Tetanus',   '{}', 3),
            (v_tenant_id, 'clinical', 'medical_history.immunization', 'OTHER',     'Other',     '{}', 99),

            -- medication_route
            (v_tenant_id, 'clinical', 'medical_history.medication_route', 'ORAL',       'Oral',       '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.medication_route', 'EYE_DROPS',  'Eye Drops',  '{"isEyeRelevant":true}', 2),
            (v_tenant_id, 'clinical', 'medical_history.medication_route', 'TOPICAL',    'Topical',    '{"isEyeRelevant":true}', 3),
            (v_tenant_id, 'clinical', 'medical_history.medication_route', 'OTHER',      'Other',      '{}', 99),

            -- family_relationship
            (v_tenant_id, 'clinical', 'medical_history.family_relationship', 'MOTHER',  'Mother',  '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.family_relationship', 'FATHER',  'Father',  '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.family_relationship', 'SISTER',  'Sister',  '{}', 3),
            (v_tenant_id, 'clinical', 'medical_history.family_relationship', 'BROTHER', 'Brother', '{}', 4),
            (v_tenant_id, 'clinical', 'medical_history.family_relationship', 'OTHER',   'Other',   '{}', 99),

            -- smoking_status
            (v_tenant_id, 'clinical', 'medical_history.smoking_status', 'NEVER',         'Never',                          '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.smoking_status', 'FORMER',        'Former',                         '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.smoking_status', 'CURRENT_LIGHT', 'Current - Light (<10/day)',      '{}', 3),
            (v_tenant_id, 'clinical', 'medical_history.smoking_status', 'CURRENT_MOD',   'Current - Moderate (10-20/day)', '{}', 4),
            (v_tenant_id, 'clinical', 'medical_history.smoking_status', 'CURRENT_HEAVY', 'Current - Heavy (>20/day)',    '{}', 5),

            -- alcohol_use
            (v_tenant_id, 'clinical', 'medical_history.alcohol_use', 'NONE',       'None',                          '{}', 1),
            (v_tenant_id, 'clinical', 'medical_history.alcohol_use', 'OCCASIONAL', 'Occasional (1-2 drinks/week)',  '{}', 2),
            (v_tenant_id, 'clinical', 'medical_history.alcohol_use', 'MODERATE',   'Moderate (3-7 drinks/week)',    '{}', 3),
            (v_tenant_id, 'clinical', 'medical_history.alcohol_use', 'HEAVY',      'Heavy (>7 drinks/week)',        '{}', 4)
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE SET
            label = EXCLUDED.label,
            metadata = EXCLUDED.metadata,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END;
$$;
