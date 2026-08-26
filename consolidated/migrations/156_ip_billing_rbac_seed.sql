-- =============================================================================
-- 156_ip_billing_rbac_seed.sql
-- TASK SEC-040 - Seed IP and billing permissions with role bundles.
--
-- Problem this fixes
-- ------------------
-- Every permission code below is already enforced in C# (IpChecklistAuth.cs,
-- OpdBillsController, RefundsController) and referenced by the frontend
-- (ip-role-actions.ts), but none of them exist as rows in `permissions`.
-- Two consequences today:
--
--   1. Clinical access collapses onto `ward.checklist.edit` / `ot.safety.sign`,
--      because every IpChecklistAuth.Require* call falls back to those two
--      codes when the specific code is absent. Least privilege is not real.
--   2. IP billing mutation is denied to every non-wildcard user, because
--      AllowsBillingMutation needs `ip.billing.collect` or `bill.update` and
--      neither exists. `Billing Clerk` holds `billing_revenue.*` codes, which
--      nothing in the IP path checks.
--
-- Safety
-- ------
-- This migration is ADDITIVE ONLY. The code-level fallbacks are untouched, so
-- no user can lose access. Section 3 grandfathers the clinical codes onto the
-- roles that already pass via those fallbacks, so effective clinical access is
-- unchanged on deploy. Tightening (removing the fallbacks) is a separate,
-- reviewed change - do not fold it in here.
--
-- Billing codes are deliberately NOT grandfathered. They are new capability and
-- are granted only to the roles named in section 4.
--
-- Tenancy
-- -------
-- Permissions are seeded into the system tenant 00000000-...-0000, matching
-- 141_rbac_repair.sql. Roles live in the operating tenant. `role_permission`
-- joins by id with no tenant predicate, so cross-tenant grants resolve - this
-- is how `ward.checklist.edit` already works in this database.
--
-- Idempotent: re-running is a no-op. Requires re-login to refresh JWT claims.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant     UUID := '00000000-0000-0000-0000-000000000000';
    target_tenant  UUID;
    v_perms_added  INT;
    v_roles_added  INT;
    v_grants_added INT;
BEGIN
    -- Operating tenant = the one that actually owns the roles.
    SELECT r.tenant_id INTO target_tenant
    FROM app_roles r
    GROUP BY r.tenant_id
    ORDER BY count(*) DESC
    LIMIT 1;

    IF target_tenant IS NULL THEN
        RAISE EXCEPTION 'No rows in app_roles; refusing to seed RBAC into an empty role table.';
    END IF;

    RAISE NOTICE 'Seeding IP/billing RBAC. permissions tenant=%, roles tenant=%', sys_tenant, target_tenant;

    -- -------------------------------------------------------------------------
    -- 1. Permission codes
    -- -------------------------------------------------------------------------
    INSERT INTO permissions (
        id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, v.code, v.name, v.module, v.action, v.resource_type, v.scope,
           v.description, true, false, false, true, NOW(), NOW()
    FROM (VALUES
        -- IP clinical lifecycle
        ('ip.view',               'View IP Patients',          'ip_management', 'view',     'patient_journey', 'branch', 'View the inpatient census and patient journeys'),
        ('ip.admit',              'Admit Patient',             'ip_management', 'admit',    'patient_journey', 'branch', 'Admit an expected patient and assign a bed'),
        ('ip.bed.transfer',       'Transfer Bed',              'ip_management', 'transfer', 'bed_inventory',   'branch', 'Move an admitted patient to a different bed'),
        ('ip.ot.mark_ready',      'Mark Ready for OT',         'ip_management', 'update',   'patient_journey', 'branch', 'Mark a patient ready for surgery once pre-op gates pass'),
        ('ip.ot.unmark_ready',    'Revert Ready for OT',       'ip_management', 'update',   'patient_journey', 'branch', 'Reverse an incorrect Ready for OT with a reason'),
        ('ip.ot.send',            'Send Patient to OT',        'ip_management', 'update',   'patient_journey', 'branch', 'Send a ready patient to the operating theatre'),
        ('ip.ot.accept',          'Accept Patient into OT',    'ip_management', 'update',   'patient_journey', 'branch', 'Accept a patient into the theatre'),
        ('ip.surgery.start',      'Start Surgery',             'ip_management', 'update',   'patient_journey', 'branch', 'Record surgery start'),
        ('ip.surgery.complete',   'Complete Surgery',          'ip_management', 'update',   'patient_journey', 'branch', 'Record surgery completion'),
        ('ip.postop.manage',      'Manage Post-Op Recovery',   'ip_management', 'update',   'patient_journey', 'branch', 'Record post-operative recovery and observations'),
        ('ip.discharge',          'Discharge Patient',         'ip_management', 'discharge','patient_journey', 'branch', 'Discharge a patient once clearance gates pass'),
        ('ip.discharge.override', 'Override Discharge Blocks', 'ip_management', 'override', 'patient_journey', 'branch', 'Discharge despite outstanding blockers, with a reason'),
        -- IP-side money (enforced by IpChecklistAuth.AllowsBillingMutation)
        ('ip.billing.collect',    'Collect IP Payment',        'billing',       'create',   'opd_bill',        'branch', 'Collect an advance or payment against an IP bill'),
        ('ip.billing.refund',     'Refund IP Payment',         'billing',       'refund',   'opd_bill',        'branch', 'Raise a refund against an IP bill'),
        ('ip.billing.adjust',     'Adjust IP Bill',            'billing',       'update',   'opd_bill',        'branch', 'Apply a discount or adjustment to an IP bill'),
        -- Billing service codes
        ('bill.view',             'View Bills',                'billing',       'view',     'opd_bill',        'branch', 'View bills and their line items'),
        ('bill.create',           'Create Bill',               'billing',       'create',   'opd_bill',        'branch', 'Create a bill for an admitted patient who has none'),
        ('bill.update',           'Update Bill',               'billing',       'update',   'opd_bill',        'branch', 'Add charges or payments to an existing bill'),
        ('bill.admin',            'Administer Billing Rules',  'billing',       'admin',    'billing_rules',   'tenant', 'Manage billing rules, rates and catalog mapping'),
        ('opd_bill.view',         'View OPD Bill',             'billing',       'view',     'opd_bill',        'branch', 'View OPD and IP bill detail'),
        ('opd_bill.refund',       'Request OPD Bill Refund',   'billing',       'refund',   'opd_bill',        'branch', 'Request a refund on a bill'),
        ('opd_bill.refund.authorize', 'Authorise Bill Refund', 'billing',       'approve',  'opd_bill',        'branch', 'Approve a requested refund (second pair of eyes)')
    ) AS v(code, name, module, action, resource_type, scope, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."TenantId" = sys_tenant
    );

    GET DIAGNOSTICS v_perms_added = ROW_COUNT;
    RAISE NOTICE '  permissions inserted: %', v_perms_added;

    -- -------------------------------------------------------------------------
    -- 2. Roles the bundles need that do not exist yet
    --
    -- RoleNameIndex is UNIQUE on "NormalizedName" ACROSS ALL TENANTS, so each
    -- name can exist only once. Created empty; assign users via user admin.
    -- -------------------------------------------------------------------------
    INSERT INTO app_roles (
        id, tenant_id, name, "NormalizedName", "ConcurrencyStamp", "Description",
        "RoleCode", "RoleType", "RoleLevel", "Priority", "IsSystemRole", "IsActive",
        is_clinical, hierarchy_level, "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), target_tenant, v.name, upper(v.name), gen_random_uuid()::text, v.description,
           v.role_code, v.role_type, v.role_level, v.priority, true, true,
           v.is_clinical, 0, NOW(), NOW()
    FROM (VALUES
        ('Cashier',        'Collects patient advances and payments at the counter', 'CASHIER',        'administrative', 3, 10, false),
        ('IP Coordinator', 'Coordinates the inpatient ward and admission flow',     'IP_COORDINATOR', 'clinical',       3, 10, true),
        ('OT Coordinator', 'Coordinates the operating theatre list and turnover',   'OT_COORDINATOR', 'clinical',       3, 10, true),
        ('Surgeon',        'Operating surgeon',                                     'SURGEON',        'clinical',       2, 20, true),
        ('Finance',        'Finance and revenue integrity, refund authorisation',   'FINANCE',        'administrative', 2, 20, false),
        ('TPA Executive',  'Third-party payer coverage and claims liaison',         'TPA_EXECUTIVE',  'administrative', 3, 10, false)
    ) AS v(name, description, role_code, role_type, role_level, priority, is_clinical)
    WHERE NOT EXISTS (
        SELECT 1 FROM app_roles r WHERE upper(coalesce(r."NormalizedName", r.name, '')) = upper(v.name)
    );

    GET DIAGNOSTICS v_roles_added = ROW_COUNT;
    RAISE NOTICE '  roles created: %', v_roles_added;

    -- -------------------------------------------------------------------------
    -- 3. GRANDFATHER - clinical codes only, no behaviour change
    --
    -- Any role already holding ward.checklist.edit or ot.safety.sign can today
    -- perform every clinical action via the IpChecklistAuth fallbacks. Granting
    -- the explicit codes records that access rather than changing it, so the
    -- fallbacks can be removed later without a lockout.
    --
    -- Billing codes are excluded here on purpose.
    -- -------------------------------------------------------------------------
    -- DISTINCT is load-bearing: a role holding BOTH legacy codes (Admin, Nurse,
    -- Doctor and Counsellor all do) matches this join twice, and the NOT EXISTS
    -- below cannot see rows inserted by its own statement.
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), g.role_id, g.perm_id, NOW()
    FROM (
        SELECT DISTINCT r.id AS role_id, p.id AS perm_id
        FROM app_roles r
        JOIN role_permission legacy ON legacy."RoleId" = r.id
        JOIN permissions lp ON lp.id = legacy."PermissionId"
                           AND lp."Code" IN ('ward.checklist.edit', 'ot.safety.sign')
        JOIN permissions p ON p."TenantId" = sys_tenant
                          AND p."IsActive" = true
                          AND p."Code" IN (
                              'ip.view', 'ip.admit', 'ip.bed.transfer',
                              'ip.ot.mark_ready', 'ip.ot.unmark_ready', 'ip.ot.send', 'ip.ot.accept',
                              'ip.surgery.start', 'ip.surgery.complete',
                              'ip.postop.manage', 'ip.discharge')
        WHERE r."IsActive" = true AND r."DeletedAt" IS NULL
    ) g
    WHERE NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = g.role_id AND rp."PermissionId" = g.perm_id
    );

    GET DIAGNOSTICS v_grants_added = ROW_COUNT;
    RAISE NOTICE '  grandfathered clinical grants: %', v_grants_added;

    -- -------------------------------------------------------------------------
    -- 4. Role bundles
    --
    -- `ip_management.view` is granted alongside `ip.view` wherever a role needs
    -- to open the census: IpChecklistAuth enforces `ip_management.view`, while
    -- `ip.view` is the code the frontend and target architecture use. Granting
    -- only one of the two would leave the role unable to load the screen.
    -- -------------------------------------------------------------------------
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), g.role_id, g.perm_id, NOW()
    FROM (
      SELECT DISTINCT r.id AS role_id, p.id AS perm_id
      FROM (VALUES
        -- Cashier: take money, read the bill, create a bill for an admitted
        -- patient who has none (decision D3). No clinical mutation at all.
        ('CASHIER',        'ip.view'), ('CASHIER',        'ip_management.view'),
        ('CASHIER',        'ip.billing.collect'),
        ('CASHIER',        'bill.view'), ('CASHIER',      'bill.create'), ('CASHIER', 'bill.update'),
        ('CASHIER',        'opd_bill.view'),

        -- Billing Clerk: the role that actually has cashier users today.
        -- Same bundle so the collect path works without reassigning anyone.
        ('BILLING CLERK',  'ip.view'), ('BILLING CLERK',  'ip_management.view'),
        ('BILLING CLERK',  'ip.billing.collect'),
        ('BILLING CLERK',  'bill.view'), ('BILLING CLERK','bill.create'), ('BILLING CLERK', 'bill.update'),
        ('BILLING CLERK',  'opd_bill.view'),

        -- IP Coordinator: full ward flow, no theatre, no money.
        ('IP COORDINATOR', 'ip.view'), ('IP COORDINATOR', 'ip_management.view'),
        ('IP COORDINATOR', 'ip.admit'), ('IP COORDINATOR', 'ip.bed.transfer'),
        ('IP COORDINATOR', 'ip.ot.mark_ready'), ('IP COORDINATOR', 'ip.ot.unmark_ready'),
        ('IP COORDINATOR', 'ip.ot.send'), ('IP COORDINATOR', 'ip.postop.manage'),
        ('IP COORDINATOR', 'ip.discharge'),

        -- OT Coordinator: theatre only.
        ('OT COORDINATOR', 'ip.view'), ('OT COORDINATOR', 'ip_management.view'),
        ('OT COORDINATOR', 'ip.ot.send'), ('OT COORDINATOR', 'ip.ot.accept'),
        ('OT COORDINATOR', 'ip.surgery.start'), ('OT COORDINATOR', 'ip.surgery.complete'),

        -- Surgeon: operate and hand over. No admission, no discharge, no money.
        ('SURGEON',        'ip.view'), ('SURGEON',        'ip_management.view'),
        ('SURGEON',        'ip.surgery.start'), ('SURGEON', 'ip.surgery.complete'),
        ('SURGEON',        'ip.postop.manage'),

        -- Finance: read everything financial, adjust, and authorise refunds.
        -- Deliberately cannot collect - separation of duty from the cashier.
        ('FINANCE',        'ip.view'), ('FINANCE',        'ip_management.view'),
        ('FINANCE',        'bill.view'), ('FINANCE',      'bill.admin'),
        ('FINANCE',        'ip.billing.refund'), ('FINANCE', 'ip.billing.adjust'),
        ('FINANCE',        'opd_bill.view'), ('FINANCE',  'opd_bill.refund'),
        ('FINANCE',        'opd_bill.refund.authorize'),

        -- TPA Executive: read-only on money, for coverage and claims work.
        ('TPA EXECUTIVE',  'ip.view'), ('TPA EXECUTIVE',  'ip_management.view'),
        ('TPA EXECUTIVE',  'bill.view'), ('TPA EXECUTIVE', 'opd_bill.view'),

        -- Nurse: clinical path. Explicitly no refund or adjust.
        ('NURSE',          'ip.view'),
        ('NURSE',          'ip.admit'), ('NURSE',         'ip.bed.transfer'),
        ('NURSE',          'ip.ot.mark_ready'), ('NURSE', 'ip.ot.send'),
        ('NURSE',          'ip.postop.manage'), ('NURSE', 'ip.discharge'),

        -- Doctor: operate, manage recovery, discharge including override.
        ('DOCTOR',         'ip.view'),
        ('DOCTOR',         'ip.surgery.start'), ('DOCTOR', 'ip.surgery.complete'),
        ('DOCTOR',         'ip.postop.manage'), ('DOCTOR', 'ip.discharge'),
        ('DOCTOR',         'ip.discharge.override'),

        -- Counsellor: reads the census and the bill to counsel on cost.
        ('COUNSELLOR',     'ip.view'),
        ('COUNSELLOR',     'bill.view'), ('COUNSELLOR',   'opd_bill.view'),

        -- Admin: full IP and billing surface.
        ('ADMIN',          'ip.view'), ('ADMIN', 'ip.admit'), ('ADMIN', 'ip.bed.transfer'),
        ('ADMIN',          'ip.ot.mark_ready'), ('ADMIN', 'ip.ot.unmark_ready'),
        ('ADMIN',          'ip.ot.send'), ('ADMIN', 'ip.ot.accept'),
        ('ADMIN',          'ip.surgery.start'), ('ADMIN', 'ip.surgery.complete'),
        ('ADMIN',          'ip.postop.manage'), ('ADMIN', 'ip.discharge'),
        ('ADMIN',          'ip.discharge.override'),
        ('ADMIN',          'ip.billing.collect'), ('ADMIN', 'ip.billing.refund'),
        ('ADMIN',          'ip.billing.adjust'),
        ('ADMIN',          'bill.view'), ('ADMIN', 'bill.create'), ('ADMIN', 'bill.update'),
        ('ADMIN',          'bill.admin'),
        ('ADMIN',          'opd_bill.view'), ('ADMIN', 'opd_bill.refund'),
        ('ADMIN',          'opd_bill.refund.authorize')
      ) AS b(role_name, perm_code)
      JOIN app_roles r
        ON upper(coalesce(r."NormalizedName", r.name, '')) = b.role_name
       AND r."IsActive" = true
       AND r."DeletedAt" IS NULL
      JOIN permissions p
        ON p."Code" = b.perm_code
       AND p."IsActive" = true
       AND p."TenantId" = sys_tenant
    ) g
    WHERE NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = g.role_id AND rp."PermissionId" = g.perm_id
    );

    GET DIAGNOSTICS v_grants_added = ROW_COUNT;
    RAISE NOTICE '  bundle grants: %', v_grants_added;
    RAISE NOTICE 'Done. Users must re-login to receive the new JWT permission claims.';
END $$;

COMMIT;
