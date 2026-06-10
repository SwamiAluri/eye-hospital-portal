-- =============================================
-- Migration 56: Visit station events + optometry routing columns
-- Purpose: OPD journey audit trail and optometry queue support
-- =============================================

-- Visit routing columns
ALTER TABLE visits ADD COLUMN IF NOT EXISTS active_room_code VARCHAR(50);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS optometry_pass_count INTEGER NOT NULL DEFAULT 0;

-- Station event log
CREATE TABLE IF NOT EXISTS visit_station_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    branch_id           UUID NOT NULL,
    visit_id            UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_id          UUID NOT NULL,
    station             VARCHAR(50) NOT NULL,
    event_type          VARCHAR(30) NOT NULL,
    pass_number         INTEGER NOT NULL DEFAULT 1,
    reason_code         VARCHAR(50),
    reason_notes        TEXT,
    assigned_to_user_id UUID,
    room_code           VARCHAR(50),
    queue_item_id       UUID,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id  UUID
);

CREATE INDEX IF NOT EXISTS idx_vse_visit_station ON visit_station_events (visit_id, station, created_at);
CREATE INDEX IF NOT EXISTS idx_vse_branch_station ON visit_station_events (branch_id, station, created_at);
CREATE INDEX IF NOT EXISTS idx_vse_tenant ON visit_station_events (tenant_id, created_at);

-- Master data: operations group (service rooms + routing reasons)
INSERT INTO master.entity_type_registry (entity_type, group_key, display_name, tab_label, sort_order) VALUES
    ('operations.service_room',   'operations', 'Service Rooms',    'Service Rooms',    1),
    ('operations.routing_reason', 'operations', 'Routing Reasons',  'Routing Reasons',  2),
    ('operations.station',        'operations', 'OPD Stations',     'Stations',         3)
ON CONFLICT (entity_type) DO NOTHING;

-- Seed service rooms and routing reasons for first tenant + first branch
DO $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM public.tenant WHERE deleted_at IS NULL LIMIT 1;
    SELECT id INTO v_branch_id FROM public.branch WHERE deleted_at IS NULL AND tenant_id = v_tenant_id LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'No tenant — skipping operations master seed';
        RETURN;
    END IF;

    PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

    INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
        (v_tenant_id, 'operations', 'operations.routing_reason', 'INITIAL_REFRACTION',       'Initial refraction',       '{}', 1),
        (v_tenant_id, 'operations', 'operations.routing_reason', 'POST_INVESTIGATION',       'Post-investigation',       '{}', 2),
        (v_tenant_id, 'operations', 'operations.routing_reason', 'DOCTOR_REQUESTED',         'Doctor requested',         '{}', 3),
        (v_tenant_id, 'operations', 'operations.routing_reason', 'PRE_SURGERY_MEASUREMENT',  'Pre-surgery measurement',  '{}', 4),
        (v_tenant_id, 'operations', 'operations.routing_reason', 'COUNSELLOR_REFRACTION',    'Counsellor refraction',    '{}', 5),
        (v_tenant_id, 'operations', 'operations.routing_reason', 'OPTICAL_DISPENSING',       'Optical dispensing',       '{}', 6),
        (v_tenant_id, 'operations', 'operations.station', 'reception',   'Reception',   '{}', 1),
        (v_tenant_id, 'operations', 'operations.station', 'optometrist', 'Optometrist', '{}', 2),
        (v_tenant_id, 'operations', 'operations.station', 'doctor',      'Doctor',      '{}', 3),
        (v_tenant_id, 'operations', 'operations.station', 'counselor',   'Counsellor',  '{}', 4),
        (v_tenant_id, 'operations', 'operations.station', 'imaging',     'Imaging',     '{}', 5),
        (v_tenant_id, 'operations', 'operations.station', 'billing',     'Billing',     '{}', 6)
    ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;

    IF v_branch_id IS NOT NULL THEN
        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
            (v_tenant_id, 'operations', 'operations.service_room', 'OPT-1',
             'Optometry Room 1',
             jsonb_build_object('branchId', v_branch_id::text, 'station', 'optometrist', 'roomCode', 'OPT-1', 'tvDisplayLabel', 'Optometry Room 1', 'maxConcurrent', 1, 'isActive', true),
             1),
            (v_tenant_id, 'operations', 'operations.service_room', 'OPT-2',
             'Optometry Room 2',
             jsonb_build_object('branchId', v_branch_id::text, 'station', 'optometrist', 'roomCode', 'OPT-2', 'tvDisplayLabel', 'Optometry Room 2', 'maxConcurrent', 1, 'isActive', true),
             2)
        ON CONFLICT (tenant_id, entity_type, code) DO NOTHING;
    END IF;

    RAISE NOTICE 'Migration 56 complete for tenant %', v_tenant_id;
END $$;
