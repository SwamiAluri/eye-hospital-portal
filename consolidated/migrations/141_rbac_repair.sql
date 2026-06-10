-- ============================================================================
-- Migration 141: RBAC repair for environments that ran broken lowercase 139/140
-- Re-applies IP checklist permissions on EF schema + role grants.
-- After apply: users must re-login to refresh JWT permission claims.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, v.code, v.name, v.module, v.action, v.resource_type, v.scope,
           v.description, true, false, false, true, NOW(), NOW()
    FROM (VALUES
        ('ward.checklist.edit', 'Edit Ward Checklist', 'ip_management', 'edit', 'ward_checklist', 'branch',
         'Toggle ward pre-operative checklist items'),
        ('ot.safety.sign', 'Sign OT Safety Checklist', 'ip_management', 'sign', 'ot_safety', 'branch',
         'Complete OT surgical safety checklist sections'),
        ('anaesthesia.pac.edit', 'Edit PAC Assessment', 'ip_management', 'edit', 'pac_assessment', 'branch',
         'Complete pre-anaesthesia check-up forms'),
        ('anaesthesia.monitoring.edit', 'Edit Anaesthesia Monitoring', 'ip_management', 'edit', 'anaesthesia_monitoring', 'branch',
         'Record anaesthesia monitoring readings and discharge clearance'),
        ('counsellor.outpatient_checklist.edit', 'Edit Outpatient Safety Checklist', 'counsellor', 'edit', 'outpatient_checklist', 'branch',
         'Complete counsellor outpatient safety checklist items'),
        ('ot.safety.override', 'Override OT WHO Timeout', 'ip_management', 'override', 'ot_safety', 'branch',
         'Supervisor override for incomplete WHO timeout before start surgery'),
        ('ip_management.view', 'View IP Management', 'ip_management', 'view', 'ip_journey', 'branch',
         'View IP journey dashboard and read-only checklist status')
    ) AS v(code, name, module, action, resource_type, scope, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."TenantId" = sys_tenant
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN (
        'ward.checklist.edit', 'ot.safety.sign', 'anaesthesia.pac.edit',
        'anaesthesia.monitoring.edit', 'counsellor.outpatient_checklist.edit',
        'ot.safety.override', 'ip_management.view'
    ) AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'ADMIN'
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('ward.checklist.edit', 'ip_management.view') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('NURSE', 'OT NURSE', 'OTNURSE')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'counsellor.outpatient_checklist.edit' AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('ot.safety.sign', 'ot.safety.override', 'ip_management.view') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('OT NURSE', 'OTNURSE', 'ANAESTHETIST', 'ANESTHETIST', 'SURGEON', 'DOCTOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('anaesthesia.pac.edit', 'anaesthesia.monitoring.edit') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('ANAESTHETIST', 'ANESTHETIST', 'DOCTOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );
END $$;

COMMIT;
