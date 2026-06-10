-- =============================================
-- Migration 60: Patient Type workflow metadata in master_value
-- Migrates rules from patient_type_configurations → patient.patient_type metadata
-- =============================================

DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'CASH', 'Cash',
             '{"legacyPatientType":"Cash","description":"Direct payment by patient","category":"direct","requiresAdvancePayment":true,"advancePercentage":50,"requiredDocuments":["ID Proof","Address Proof"],"zeroAdvancePayment":false}'::jsonb, 1),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'INSURANCE', 'Insurance',
             '{"legacyPatientType":"Insurance","description":"Insurance company cashless treatment","category":"direct","requiresPreApproval":true,"requiredDocuments":["Insurance Card","Policy Document","ID Proof","Employer Letter"],"zeroAdvancePayment":true}'::jsonb, 2),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'COPAY', 'Co-Pay',
             '{"legacyPatientType":"CoPay","description":"Insurance with patient co-payment","category":"direct","requiresPreApproval":true,"requiredDocuments":["Insurance Card","ID Proof"],"zeroAdvancePayment":false}'::jsonb, 3),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'ESH', 'ESH',
             '{"legacyPatientType":"ESH","description":"ESH government scheme","category":"government","requiresPreApproval":true,"requiredDocuments":["ESH Card","Employee ID","Salary Slip"],"zeroAdvancePayment":true}'::jsonb, 4),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'CGHS', 'CGHS',
             '{"legacyPatientType":"CGHS","description":"CGHS government scheme","category":"government","requiresPreApproval":true,"requiredDocuments":["CGHS Card","Referral from CGHS Dispensary"],"zeroAdvancePayment":true}'::jsonb, 5),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'AROGYASHREE', 'Arogyashree',
             '{"legacyPatientType":"Arograshree","description":"Karnataka state health scheme for BPL families","category":"government","requiresPreApproval":true,"requiredDocuments":["Income Certificate","Ration Card","ID Proof"],"zeroAdvancePayment":true}'::jsonb, 6),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'SGHS', 'SGHS',
             '{"legacyPatientType":"SGHS","description":"State government employee health scheme","category":"government","requiresPreApproval":true,"requiredDocuments":["SGHS Card","Employee ID"],"zeroAdvancePayment":true}'::jsonb, 7),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'CAMP', 'Camp',
             '{"legacyPatientType":"Camp","description":"Free surgery camp sponsored by NGO/CSR","category":"special","requiredDocuments":["Camp Registration Form","Income Certificate"],"zeroAdvancePayment":true}'::jsonb, 8),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'RAILWAY', 'Railway',
             '{"legacyPatientType":"Railway","description":"Railway employee health scheme (RELHS)","category":"government","requiredDocuments":[],"zeroAdvancePayment":true}'::jsonb, 9),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'FREE', 'Free / Charity',
             '{"legacyPatientType":"Free","description":"Free treatment — charity or sponsored case","category":"special","requiredDocuments":[],"zeroAdvancePayment":true}'::jsonb, 10),
            (v_tenant_id, 'patient_setup', 'patient.patient_type', 'TPA', 'TPA',
             '{"legacyPatientType":"TPA","description":"Third-party administrator cashless","category":"direct","requiresPreApproval":true,"requiredDocuments":["Insurance Card","ID Proof"],"zeroAdvancePayment":true}'::jsonb, 11)
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE SET
            label = EXCLUDED.label,
            metadata = EXCLUDED.metadata,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END;
$$;
