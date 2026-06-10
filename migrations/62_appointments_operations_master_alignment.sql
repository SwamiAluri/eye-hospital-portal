-- =============================================
-- Migration 62: Appointments + operations master alignment (all tenants)
-- Ensures appointment picklists and OPD routing values exist per tenant.
-- =============================================

INSERT INTO master.entity_type_registry (entity_type, group_key, display_name, tab_label, sort_order) VALUES
    ('appointment.type',             'appointments', 'Appointment Types',      'Types',           1),
    ('appointment.consultation_type','appointments', 'Consultation Types',     'Consultation',    2),
    ('appointment.priority',         'appointments', 'Appointment Priorities', 'Priorities',      3),
    ('appointment.cancel_reason',    'appointments', 'Cancel Reasons',         'Cancel Reasons',  4),
    ('operations.service_room',        'operations',   'Service Rooms',          'Service Rooms',   1),
    ('operations.routing_reason',      'operations',   'Routing Reasons',        'Routing Reasons', 2),
    ('operations.station',             'operations',   'OPD Stations',           'Stations',        3)
ON CONFLICT (entity_type) DO NOTHING;

DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (v_tenant_id, 'appointments', 'appointment.type', 'OPD', 'OPD Consultation', '{}', 1),
            (v_tenant_id, 'appointments', 'appointment.type', 'REVIEW', 'Review', '{}', 2),
            (v_tenant_id, 'appointments', 'appointment.type', 'SURGERY', 'Surgery', '{}', 3),
            (v_tenant_id, 'appointments', 'appointment.type', 'CAMP', 'Camp', '{}', 4),
            (v_tenant_id, 'appointments', 'appointment.type', 'TELECONSULT', 'Tele-Consultation', '{}', 5),

            (v_tenant_id, 'appointments', 'appointment.consultation_type', 'FIRST_VISIT', 'First Visit', '{}', 1),
            (v_tenant_id, 'appointments', 'appointment.consultation_type', 'FOLLOW_UP', 'Follow-Up', '{}', 2),
            (v_tenant_id, 'appointments', 'appointment.consultation_type', 'POST_OP', 'Post-Op', '{}', 3),
            (v_tenant_id, 'appointments', 'appointment.consultation_type', 'EMERGENCY', 'Emergency', '{}', 4),
            (v_tenant_id, 'appointments', 'appointment.consultation_type', 'SECOND_OPINION', 'Second Opinion', '{}', 5),

            (v_tenant_id, 'appointments', 'appointment.priority', 'ROUTINE', 'Routine', '{}', 1),
            (v_tenant_id, 'appointments', 'appointment.priority', 'URGENT', 'Urgent', '{}', 2),
            (v_tenant_id, 'appointments', 'appointment.priority', 'EMERGENCY', 'Emergency', '{}', 3),

            (v_tenant_id, 'appointments', 'appointment.cancel_reason', 'PATIENT_REQUEST', 'Patient Request', '{}', 1),
            (v_tenant_id, 'appointments', 'appointment.cancel_reason', 'DOCTOR_UNAVAIL', 'Doctor Unavailable', '{}', 2),
            (v_tenant_id, 'appointments', 'appointment.cancel_reason', 'NO_SHOW', 'No Show', '{}', 3),
            (v_tenant_id, 'appointments', 'appointment.cancel_reason', 'DUPLICATE', 'Duplicate Appointment', '{}', 4),
            (v_tenant_id, 'appointments', 'appointment.cancel_reason', 'RESCHEDULED', 'Rescheduled', '{}', 5),
            (v_tenant_id, 'appointments', 'appointment.cancel_reason', 'OTHER', 'Other', '{}', 6),

            (v_tenant_id, 'operations', 'operations.routing_reason', 'INITIAL_REFRACTION', 'Initial refraction', '{}', 1),
            (v_tenant_id, 'operations', 'operations.routing_reason', 'POST_INVESTIGATION', 'Post-investigation', '{}', 2),
            (v_tenant_id, 'operations', 'operations.routing_reason', 'DOCTOR_REQUESTED', 'Doctor requested', '{}', 3),
            (v_tenant_id, 'operations', 'operations.routing_reason', 'PRE_SURGERY_MEASUREMENT', 'Pre-surgery measurement', '{}', 4),
            (v_tenant_id, 'operations', 'operations.routing_reason', 'COUNSELLOR_REFRACTION', 'Counsellor refraction', '{}', 5),
            (v_tenant_id, 'operations', 'operations.routing_reason', 'OPTICAL_DISPENSING', 'Optical dispensing', '{}', 6),

            (v_tenant_id, 'operations', 'operations.station', 'reception', 'Reception', '{"routableFromFrontdesk":false}', 1),
            (v_tenant_id, 'operations', 'operations.station', 'optometrist', 'Optometrist', '{"routableFromFrontdesk":true}', 2),
            (v_tenant_id, 'operations', 'operations.station', 'doctor', 'Doctor', '{"routableFromFrontdesk":true}', 3),
            (v_tenant_id, 'operations', 'operations.station', 'counselor', 'Counsellor', '{"routableFromFrontdesk":true}', 4),
            (v_tenant_id, 'operations', 'operations.station', 'imaging', 'Imaging', '{"routableFromFrontdesk":false}', 5),
            (v_tenant_id, 'operations', 'operations.station', 'billing', 'Billing', '{"routableFromFrontdesk":false}', 6),
            (v_tenant_id, 'operations', 'operations.station', 'pharmacy', 'Pharmacy', '{"routableFromFrontdesk":false}', 7),
            (v_tenant_id, 'operations', 'operations.station', 'optical', 'Optical', '{"routableFromFrontdesk":false}', 8),
            (v_tenant_id, 'operations', 'operations.station', 'completed', 'Completed', '{"routableFromFrontdesk":false}', 9)
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE SET
            label = EXCLUDED.label,
            metadata = EXCLUDED.metadata,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END;
$$;
