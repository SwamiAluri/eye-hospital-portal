-- SUPERSEDED: RBAC content merged into 139_s5 and 140_s6 (EF schema). Kept for environments that ran 140 before the fix.
BEGIN;

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- S5 permissions (idempotent)
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
         'Supervisor override for incomplete WHO timeout before start surgery')
    ) AS v(code, name, module, action, resource_type, scope, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."TenantId" = sys_tenant
    );

    -- Grant all ip checklist permissions to clinical roles
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN (
        'ward.checklist.edit',
        'ot.safety.sign',
        'anaesthesia.pac.edit',
        'anaesthesia.monitoring.edit',
        'counsellor.outpatient_checklist.edit',
        'ot.safety.override'
    ) AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN (
        'ADMIN', 'NURSE', 'COUNSELLOR', 'COUNSELOR',
        'OT NURSE', 'OTNURSE', 'ANAESTHETIST', 'ANESTHETIST', 'SURGEON', 'DOCTOR'
    )
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );

    -- Counsellor edit: counsellor roles only (re-grant narrowly if needed)
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'counsellor.outpatient_checklist.edit' AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR', 'ADMIN')
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );

    -- OT safety: OT clinical roles
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('ot.safety.sign', 'ot.safety.override') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN (
        'OT NURSE', 'OTNURSE', 'ANAESTHETIST', 'ANESTHETIST', 'SURGEON', 'DOCTOR', 'ADMIN'
    )
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );

    -- Ward checklist: nursing
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'ward.checklist.edit' AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('NURSE', 'OT NURSE', 'OTNURSE', 'ADMIN')
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );

    -- PAC + monitoring: anaesthesia
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('anaesthesia.pac.edit', 'anaesthesia.monitoring.edit') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN (
        'ANAESTHETIST', 'ANESTHETIST', 'DOCTOR', 'ADMIN'
    )
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );
END $$;

COMMIT;
