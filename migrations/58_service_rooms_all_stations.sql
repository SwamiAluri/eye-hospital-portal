-- Migration 58: Service rooms for all OPD stations (branch TV / multi-room displays)
-- Run against hospitalportal database

DO $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM public.tenant WHERE deleted_at IS NULL LIMIT 1;
    SELECT id INTO v_branch_id FROM public.branch WHERE deleted_at IS NULL AND tenant_id = v_tenant_id LIMIT 1;

    IF v_tenant_id IS NULL OR v_branch_id IS NULL THEN
        RAISE NOTICE 'Skipping migration 58 — no tenant/branch';
        RETURN;
    END IF;

    PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

    INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order) VALUES
        (v_tenant_id, 'operations', 'operations.service_room', 'DOC-1', 'Doctor Room 1',
         jsonb_build_object('branchId', v_branch_id::text, 'station', 'doctor', 'roomCode', 'DOC-1', 'tvDisplayLabel', 'Doctor Room 1', 'isActive', true), 10),
        (v_tenant_id, 'operations', 'operations.service_room', 'COUN-1', 'Counseling Room 1',
         jsonb_build_object('branchId', v_branch_id::text, 'station', 'counselor', 'roomCode', 'COUN-1', 'tvDisplayLabel', 'Counseling Room 1', 'isActive', true), 20),
        (v_tenant_id, 'operations', 'operations.service_room', 'IMG-1', 'Imaging Room 1',
         jsonb_build_object('branchId', v_branch_id::text, 'station', 'imaging', 'roomCode', 'IMG-1', 'tvDisplayLabel', 'Imaging Room 1', 'isActive', true), 30),
        (v_tenant_id, 'operations', 'operations.service_room', 'BILL-1', 'Billing Counter 1',
         jsonb_build_object('branchId', v_branch_id::text, 'station', 'billing', 'roomCode', 'BILL-1', 'tvDisplayLabel', 'Billing & Registration', 'isActive', true), 40),
        (v_tenant_id, 'operations', 'operations.service_room', 'FD-1', 'Front Desk 1',
         jsonb_build_object('branchId', v_branch_id::text, 'station', 'reception', 'roomCode', 'FD-1', 'tvDisplayLabel', 'Front Desk', 'isActive', true), 50)
    ON CONFLICT (tenant_id, entity_type, code) DO UPDATE
        SET metadata = EXCLUDED.metadata,
            label = EXCLUDED.label,
            sort_order = EXCLUDED.sort_order;
END $$;
