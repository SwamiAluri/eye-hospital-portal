-- Ensure Anaesthetist IAM role exists and is assigned to clinical staff
-- so GET /api/Users/anesthetists has an authoritative directory (no UI mocks).

DO $$
DECLARE
  v_tenant uuid := '155fe198-6ae5-4a01-9254-ead5b427247e';
  v_branch uuid := '74c014cf-9570-4824-bdf9-b369ea11a8f4';
  v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id
  FROM app_roles
  WHERE tenant_id = v_tenant
    AND ("NormalizedName" IN ('ANAESTHETIST', 'ANESTHETIST')
         OR name ILIKE 'Anaesthetist'
         OR name ILIKE 'Anesthetist')
  LIMIT 1;

  IF v_role_id IS NULL THEN
    v_role_id := gen_random_uuid();
    INSERT INTO app_roles (
      id, name, "NormalizedName", tenant_id,
      "IsActive", "IsSystemRole", "Priority", "RoleLevel",
      "RoleCode", "CreatedAt", "UpdatedAt"
    ) VALUES (
      v_role_id, 'Anaesthetist', 'ANAESTHETIST', v_tenant,
      TRUE, TRUE, 50, 3,
      'ANAESTHETIST', NOW(), NOW()
    );
  END IF;

  INSERT INTO app_user_roles (user_id, role_id, branch_id, "IsActive", "AssignedAt")
  SELECT u.id, v_role_id, v_branch, TRUE, NOW()
  FROM users u
  WHERE u."DeletedAt" IS NULL
    AND u."UserStatus" = 'active'
    AND u.tenant_id = v_tenant
    AND (
      u."EmployeeId" IN ('DOC001', 'DOC002')
      OR u.email IN ('john.smith@hospital.com', 'emily.chen@hospital.com')
    )
  ON CONFLICT (user_id, role_id) DO UPDATE
    SET "IsActive" = TRUE,
        branch_id = COALESCE(app_user_roles.branch_id, EXCLUDED.branch_id);
END $$;
