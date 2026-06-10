-- =============================================
-- Migration 64: F2.3 master entity types (all tenants)
-- Seeds:
--   appointment.status
--   counsellor.patient_intention
--   insurance.accommodation_class
-- Idempotent — ON CONFLICT upserts labels/metadata/sort_order.
-- =============================================

INSERT INTO master.entity_type_registry (entity_type, group_key, display_name, tab_label, sort_order) VALUES
    ('appointment.status',              'appointments', 'Appointment Statuses',   'Statuses',           5),
    ('counsellor.patient_intention',    'counsellor', 'Patient Intentions',     'Patient Intentions',   6),
    ('insurance.accommodation_class',   'insurance',  'Accommodation Classes',  'Room Classes',       5)
ON CONFLICT (entity_type) DO NOTHING;

DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            -- appointment.status (codes match OPD appointment.status strings)
            (v_tenant_id, 'appointments', 'appointment.status', 'scheduled',   'Scheduled',   '{"color":"blue"}',   1),
            (v_tenant_id, 'appointments', 'appointment.status', 'confirmed',   'Confirmed',   '{"color":"green"}',  2),
            (v_tenant_id, 'appointments', 'appointment.status', 'in-progress', 'In Progress', '{"color":"yellow"}', 3),
            (v_tenant_id, 'appointments', 'appointment.status', 'completed',   'Completed',   '{"color":"gray"}',   4),
            (v_tenant_id, 'appointments', 'appointment.status', 'cancelled',   'Cancelled',   '{"color":"red"}',    5),
            (v_tenant_id, 'appointments', 'appointment.status', 'no-show',     'No Show',     '{"color":"red"}',    6),

            -- counsellor.patient_intention (PatientDecisionWidget API codes)
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WillingNow',           'Ready Now — Schedule Today', '{"category":"willing"}',    1),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WillingWeek',          'Within 1 Week',              '{"category":"willing"}',    2),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WillingTwoWeeks',      'Within 2 Weeks',             '{"category":"willing"}',    3),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WillingMonth',         'Within 1 Month',             '{"category":"willing"}',    4),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WillingQuarter',       'Within 3 Months',            '{"category":"willing"}',    5),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WillingSixMonths',     'After 6 Months',             '{"category":"willing"}',    6),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WillingCallToConfirm', 'Will Call to Confirm',       '{"category":"willing"}',    7),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'Undecided',            'Undecided',                  '{"category":"not_ready"}',  8),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WaitingFinancial',     'Financial Hold',             '{"category":"not_ready"}',  9),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'WaitingFear',          'Fear / Hesitant',            '{"category":"not_ready"}', 10),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'SecondOpinion',        'Second Opinion',             '{"category":"not_ready"}', 11),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'Declined',             'Declined Surgery',           '{"category":"not_ready"}', 12),
            (v_tenant_id, 'counsellor', 'counsellor.patient_intention', 'ReferredElsewhere',    'Referred Elsewhere',         '{"category":"not_ready"}', 13),

            -- insurance.accommodation_class (VisitPolicyForm AccommodationClass)
            (v_tenant_id, 'insurance', 'insurance.accommodation_class', 'general',      'General',      '{}', 1),
            (v_tenant_id, 'insurance', 'insurance.accommodation_class', 'semi-private', 'Semi-Private', '{}', 2),
            (v_tenant_id, 'insurance', 'insurance.accommodation_class', 'private',      'Private',      '{}', 3),
            (v_tenant_id, 'insurance', 'insurance.accommodation_class', 'icu',          'ICU',          '{}', 4)
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE SET
            label = EXCLUDED.label,
            metadata = EXCLUDED.metadata,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END;
$$;
