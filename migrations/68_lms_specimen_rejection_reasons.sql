-- =============================================
-- Migration 68: L-COL-01D LMS specimen rejection reasons (MasterValue)
-- Entity type: lms.specimen_rejection_reason (lab_diagnostics)
-- Approved MVP codes only — operational receiving reasons, not diagnoses.
-- Idempotent.
-- =============================================

INSERT INTO master.entity_type_registry (entity_type, group_key, display_name, description, tab_label, sort_order)
VALUES (
    'lms.specimen_rejection_reason',
    'lab_diagnostics',
    'LMS Specimen Rejection Reasons',
    'Governed operational reasons for rejecting a Collected specimen at Receiving (L-COL-01D).',
    'Rejection Reasons',
    4
)
ON CONFLICT (entity_type) DO UPDATE SET
    group_key = EXCLUDED.group_key,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
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
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'PATIENT_IDENTITY_MISMATCH', 'Patient identity mismatch', '{}', 1),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'SPECIMEN_MISMATCH', 'Specimen does not match order', '{}', 2),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'SPECIMEN_QUALITY_UNACCEPTABLE', 'Specimen quality unacceptable', '{}', 3),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'INSUFFICIENT_SPECIMEN', 'Insufficient specimen', '{}', 4),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'WRONG_CONTAINER', 'Incorrect specimen container', '{}', 5),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'DAMAGED_CONTAINER', 'Container damaged or compromised', '{}', 6),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'LABELING_ERROR', 'Specimen labeling error', '{}', 7),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'TRANSPORT_CONDITION_FAILURE', 'Transport condition failure', '{}', 8),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'SPECIMEN_CONTAMINATION_SUSPECTED', 'Specimen contamination suspected', '{}', 9),
            (v_tenant_id, 'lab_diagnostics', 'lms.specimen_rejection_reason', 'OTHER_GOVERNED_REASON', 'Other governed rejection reason', '{}', 10)
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE SET
            label = EXCLUDED.label,
            metadata = EXCLUDED.metadata,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END;
$$;
