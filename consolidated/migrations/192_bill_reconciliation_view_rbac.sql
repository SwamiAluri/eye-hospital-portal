-- ============================================================================
-- Migration 192: bill.reconciliation.view — Charge Reconciliation permission split
--
-- Separates CR operational access from broad bill.view so Counsellor can retain
-- bill.view (cost counselling / bill read) without CR board access.
--
-- Grants: ADMIN, FINANCE, CASHIER, BILLING CLERK, TPA EXECUTIVE
-- Does NOT grant COUNSELLOR / COUNSELOR
-- Does NOT remove bill.view from any role
-- Completeness endpoint remains bill.view (OPD desk) — controller change is code-only
--
-- After apply: affected users must re-login to refresh JWT claims.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, 'bill.reconciliation.view', 'View Charge Reconciliation',
           'billing', 'view', 'charge_reconciliation', 'branch',
           'Access Charge Reconciliation operational reports (implant/stock/charge exceptions and wastage)',
           true, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = 'bill.reconciliation.view' AND p."IsActive" = true
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'bill.reconciliation.view' AND p."IsActive" = true
    WHERE upper(replace(coalesce(r."NormalizedName", r.name, ''), '_', ' ')) IN (
        'ADMIN',
        'FINANCE',
        'CASHIER',
        'BILLING CLERK',
        'TPA EXECUTIVE'
    )
      AND upper(coalesce(r."NormalizedName", r.name, '')) NOT IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    RAISE NOTICE 'bill.reconciliation.view catalog + operational role grants ensured';
END $$;

COMMIT;
