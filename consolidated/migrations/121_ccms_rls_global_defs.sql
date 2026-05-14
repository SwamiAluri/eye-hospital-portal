-- ============================================================
-- Migration 121: Fix RLS policies on CCMS workflow definition tables
-- Allows nil-UUID (system tenant) rows to be visible to all tenants.
-- Workflow definitions/states/transitions are global (tenant_id = nil UUID).
-- Instances and history remain strictly tenant-isolated.
-- ============================================================
BEGIN;

DO $$ BEGIN
    -- ccms_workflow_definitions
    DROP POLICY IF EXISTS tenant_isolation ON ccms_workflow_definitions;
    CREATE POLICY tenant_isolation ON ccms_workflow_definitions FOR ALL
        USING (tenant_id::text = current_setting('app.current_tenant_id', true)
               OR tenant_id = '00000000-0000-0000-0000-000000000000');

    -- ccms_workflow_states
    DROP POLICY IF EXISTS tenant_isolation ON ccms_workflow_states;
    CREATE POLICY tenant_isolation ON ccms_workflow_states FOR ALL
        USING (tenant_id::text = current_setting('app.current_tenant_id', true)
               OR tenant_id = '00000000-0000-0000-0000-000000000000');

    -- ccms_workflow_transitions
    DROP POLICY IF EXISTS tenant_isolation ON ccms_workflow_transitions;
    CREATE POLICY tenant_isolation ON ccms_workflow_transitions FOR ALL
        USING (tenant_id::text = current_setting('app.current_tenant_id', true)
               OR tenant_id = '00000000-0000-0000-0000-000000000000');

    -- ccms_workflow_instances and ccms_workflow_history intentionally unchanged:
    -- they always belong to a real tenant.
END $$;

COMMIT;
