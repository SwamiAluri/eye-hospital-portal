-- =============================================
-- Migration 59: Master Data Lookup Permission
-- Purpose: Allow all clinical/front-desk roles to read dropdown values
--          without granting full master_data.view admin access.
-- =============================================

-- Primary tenant used by the Hospital Portal dev environment
DO $$
DECLARE
    v_tenant_id UUID := '155fe198-6ae5-4a01-9254-ead5b427247e';
    v_perm_id   UUID;
    v_role_id   UUID;
    v_roles     TEXT[] := ARRAY[
        'Admin',
        'Receptionist',
        'Counsellor',
        'Doctor', 'Junior Doctor', 'Senior Doctor', 'Consultant',
        'Nurse', 'Senior Nurse', 'Nurse Manager',
        'Billing Clerk',
        'Pharmacist', 'Pharmacy Manager',
        'Lab Technician', 'Lab Manager',
        'Medical Records Officer'
    ];
    v_role      TEXT;
BEGIN
    -- EF permissions table (role_permission FK targets permissions.id)
    INSERT INTO public.permissions (
        id, "TenantId", "Code", "Name", "Description",
        "Module", "Action", "ResourceType", "IsActive", "CreatedAt", "UpdatedAt"
    ) VALUES (
        gen_random_uuid(), v_tenant_id, 'master_data.lookup', 'Master Data Lookup',
        'Read master data dropdown values for forms',
        'master_data', 'lookup', 'master_data', true, NOW(), NOW()
    )
    ON CONFLICT ("TenantId", "Code") DO UPDATE SET
        "Name" = EXCLUDED."Name",
        "Description" = EXCLUDED."Description",
        "IsActive" = true,
        "UpdatedAt" = NOW()
    RETURNING id INTO v_perm_id;

    IF v_perm_id IS NULL THEN
        SELECT id INTO v_perm_id
        FROM public.permissions
        WHERE "TenantId" = v_tenant_id AND "Code" = 'master_data.lookup';
    END IF;

    FOREACH v_role IN ARRAY v_roles
    LOOP
        SELECT id INTO v_role_id FROM public.app_roles WHERE name = v_role LIMIT 1;
        IF v_role_id IS NULL THEN CONTINUE; END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.role_permission
            WHERE "RoleId" = v_role_id AND "PermissionId" = v_perm_id
        ) THEN
            INSERT INTO public.role_permission (id, "RoleId", "PermissionId", "CreatedAt")
            VALUES (gen_random_uuid(), v_role_id, v_perm_id, NOW());
            RAISE NOTICE 'Assigned master_data.lookup to %', v_role;
        END IF;
    END LOOP;

    -- Grant lookup to any role that already has master data admin/view in EF permissions
    INSERT INTO public.role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), rp."RoleId", v_perm_id, NOW()
    FROM public.role_permission rp
    JOIN public.permissions p ON p.id = rp."PermissionId"
    WHERE p."Code" IN ('master_data.view', 'MASTER_DATA_VIEW', 'master_data.manage', 'MASTER_DATA_MANAGE')
      AND NOT EXISTS (
          SELECT 1 FROM public.role_permission x
          WHERE x."RoleId" = rp."RoleId" AND x."PermissionId" = v_perm_id
      );
END;
$$;

-- Legacy permission table (kept in sync for older scripts)
INSERT INTO public.permission (id, code, name, description, module, resource, action, is_active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'master_data.lookup', 'master_data.lookup', 'Read master data dropdown values for forms', 'master_data', 'master_data', 'lookup', true, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = NOW();

-- Align inventory purchase categories and payment modes with UI labels (upsert per tenant)
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order) VALUES
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'PHARMACY',         'Pharmacy',          1),
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'OT_SURGERY',       'OT & Surgery',      2),
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'CONSUMABLES',      'Consumables',       3),
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'OPTICAL',          'Optical',           4),
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'LABORATORY',       'Laboratory',        5),
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'STATIONERY',       'Stationery',        6),
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'EQUIPMENT',        'Equipment',         7),
            (v_tenant_id, 'inventory', 'inventory.purchase_category', 'GENERAL_HOSPITAL', 'General Hospital',  8),
            (v_tenant_id, 'billing_finance', 'billing.payment_mode', 'CREDIT', 'Credit', 2),
            (v_tenant_id, 'billing_finance', 'billing.payment_mode', 'RTGS',   'RTGS',   6)
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE SET
            label = EXCLUDED.label,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END;
$$;
