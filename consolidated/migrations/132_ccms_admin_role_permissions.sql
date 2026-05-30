-- ============================================================
-- Migration 132: Grant all ccms.* permissions to Admin roles
-- Ensures CCMS tab actions work for non-wildcard users assigned
-- the Admin role (Verify Eligibility, Pre-Auth, etc.).
-- Idempotent — safe to re-run.
-- ============================================================

BEGIN;

DO $$
BEGIN
    -- PascalCase schema (EF / auth-service default)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'permissions' AND column_name = 'Code'
    ) THEN
        INSERT INTO role_permissions (id, "RoleId", "PermissionId", "CreatedAt")
        SELECT gen_random_uuid(), r.id, p.id, NOW()
        FROM roles r
        JOIN permissions p ON p."Code" LIKE 'ccms.%' AND p."IsActive" = true
        WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'ADMIN'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
          );
    END IF;

    -- snake_case schema (consolidated migration 127 style)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'permissions' AND column_name = 'code'
    ) THEN
        INSERT INTO role_permissions (id, "RoleId", "PermissionId", "CreatedAt")
        SELECT gen_random_uuid(), r.id, p.id, NOW()
        FROM roles r
        JOIN permissions p ON p.code LIKE 'ccms.%' AND p.is_active = true
        WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'ADMIN'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
          );
    END IF;
END $$;

COMMIT;
