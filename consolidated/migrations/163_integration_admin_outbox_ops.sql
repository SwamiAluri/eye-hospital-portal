-- =============================================================================
-- 163_integration_admin_outbox_ops.sql
-- TASK OPS-070 - Integration health (S-16): permission + abandon columns.
--
-- Operators need to see Dead outbox rows and requeue them. The permission
-- `integration.admin` is referenced by the architecture and mockup but is not
-- in `permissions`. This migration seeds it and grants it to Admin / IT-style
-- roles only. Additive: no existing grants are removed.
--
-- Abandon (S-17) needs a reason (and a compensating action for financial
-- events). Columns are added to both independent outboxes; status becomes
-- `Abandoned` in application code. Idempotency keys are unchanged.
--
-- Tenancy: permissions go in the system tenant 00000000-...-0000, matching 156.
-- Idempotent: re-running is a no-op. Users must re-login for JWT claims.
-- =============================================================================

BEGIN;

-- ── 1. Abandon columns: IP outbox ───────────────────────────────────────────
ALTER TABLE IF EXISTS integration_outbox_event ADD COLUMN IF NOT EXISTS abandon_reason TEXT NULL;
ALTER TABLE IF EXISTS integration_outbox_event ADD COLUMN IF NOT EXISTS compensating_action TEXT NULL;
ALTER TABLE IF EXISTS integration_outbox_event ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS integration_outbox_event ADD COLUMN IF NOT EXISTS abandoned_by_user_id UUID NULL;

COMMENT ON COLUMN integration_outbox_event.abandon_reason IS
    'OPS-070. Operator reason when Status=Abandoned. Last delivery Error is preserved.';

-- ── 2. Abandon columns: Billing → CCMS outbox ───────────────────────────────
ALTER TABLE IF EXISTS billing_ccms_outbox ADD COLUMN IF NOT EXISTS abandon_reason TEXT NULL;
ALTER TABLE IF EXISTS billing_ccms_outbox ADD COLUMN IF NOT EXISTS compensating_action TEXT NULL;
ALTER TABLE IF EXISTS billing_ccms_outbox ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS billing_ccms_outbox ADD COLUMN IF NOT EXISTS abandoned_by_user_id UUID NULL;

COMMENT ON COLUMN billing_ccms_outbox.abandon_reason IS
    'OPS-070. Operator reason when Status=Abandoned. Last delivery Error is preserved.';

-- ── 3. Permission + Admin/IT grants ─────────────────────────────────────────
DO $$
DECLARE
    sys_tenant     UUID := '00000000-0000-0000-0000-000000000000';
    v_perms_added  INT;
    v_grants_added INT;
BEGIN
    INSERT INTO permissions (
        id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, v.code, v.name, v.module, v.action, v.resource_type, v.scope,
           v.description, true, false, false, true, NOW(), NOW()
    FROM (VALUES
        ('integration.admin', 'Manage Integration Outbox', 'integrations', 'admin', 'outbox', 'tenant',
         'View outbox stats and dead letters, inspect payloads, requeue or abandon events')
    ) AS v(code, name, module, action, resource_type, scope, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."TenantId" = sys_tenant
    );

    GET DIAGNOSTICS v_perms_added = ROW_COUNT;
    RAISE NOTICE '  permissions inserted: %', v_perms_added;

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), g.role_id, g.perm_id, NOW()
    FROM (
      SELECT DISTINCT r.id AS role_id, p.id AS perm_id
      FROM app_roles r
      JOIN permissions p
        ON p."Code" = 'integration.admin'
       AND p."IsActive" = true
       AND p."TenantId" = sys_tenant
      WHERE r."IsActive" = true
        AND r."DeletedAt" IS NULL
        AND upper(coalesce(r."NormalizedName", r.name, '')) IN (
            'ADMIN',
            'SUPER ADMIN',
            'SUPERADMIN',
            'SYSTEM ADMINISTRATOR',
            'IT ADMIN',
            'IT',
            'PLATFORM ADMIN'
        )
    ) g
    WHERE NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = g.role_id AND rp."PermissionId" = g.perm_id
    );

    GET DIAGNOSTICS v_grants_added = ROW_COUNT;
    RAISE NOTICE '  integration.admin grants: %', v_grants_added;
    RAISE NOTICE 'Done. Users must re-login to receive integration.admin in the JWT.';
END $$;

COMMIT;
