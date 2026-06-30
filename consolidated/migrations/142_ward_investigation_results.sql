-- ============================================================================
-- Migration 142: Ward Investigation Results — value, verification, catalog dedup
-- Purpose:
--   1. Extend pre_op_completions with structured investigation result fields
--   2. Extend counsellor_checklist_completions for optional draft values (Phase 9)
--   3. Add item_config JSONB on pre_op_section_items catalog
--   4. Deactivate duplicate clearance items; remove Form 1 dilatation row
--   5. Seed missing Form 1 items (Hb, ECG, PT/INR, HBsAg, HCV)
--   6. RBAC: ward.investigation.enter, ward.investigation.verify
-- Dependencies: 140_s6 (Form 1 items), 134 (counsellor completions), 141 (RBAC pattern)
-- Date: 2026-06
--
-- Rollback (manual — run only if reverting 142):
--   ALTER TABLE pre_op_completions DROP COLUMN IF EXISTS result_value, ...;
--   ALTER TABLE counsellor_checklist_completions DROP COLUMN IF EXISTS result_value, ...;
--   ALTER TABLE pre_op_section_items DROP COLUMN IF EXISTS item_config;
--   UPDATE pre_op_section_items SET status = 'active', is_active = true
--     WHERE item_key IN ('dilatation_done', 'blood_sugar_fbs', ...);
--   DELETE FROM permissions WHERE "Code" IN ('ward.investigation.enter','ward.investigation.verify');
-- ============================================================================

BEGIN;

-- ── 1. pre_op_completions — investigation result + verification ───────────────

ALTER TABLE pre_op_completions
    ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES pre_op_documents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS result_value VARCHAR(200),
    ADD COLUMN IF NOT EXISTS result_unit VARCHAR(50),
    ADD COLUMN IF NOT EXISTS reference_range VARCHAR(100),
    ADD COLUMN IF NOT EXISTS result_flag VARCHAR(20),
    ADD COLUMN IF NOT EXISTS result_source VARCHAR(30),
    ADD COLUMN IF NOT EXISTS entry_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS entered_by_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS entered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS external_report_note TEXT;

COMMENT ON COLUMN pre_op_completions.result_value IS
    'Canonical investigation result (numeric or text). Required for Form 1 completion in workspace v2.';
COMMENT ON COLUMN pre_op_completions.entry_status IS
    'draft | entered | verified — counsellor copies arrive as draft until ward verifies.';
COMMENT ON COLUMN pre_op_completions.result_source IS
    'internal_lab | external_hospital | counsellor | manual_ward | integration';
COMMENT ON COLUMN pre_op_completions.document_id IS
    'Optional linked report in pre_op_documents; upload not required when result_value present.';

-- Backfill from legacy value column (migration 91) when present on this environment
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pre_op_completions'
          AND column_name = 'value'
    ) THEN
        UPDATE pre_op_completions
        SET result_value = TRIM(value),
            entry_status = CASE
                WHEN TRIM(value) <> '' AND entry_status = 'draft' THEN 'entered'
                ELSE entry_status
            END,
            updated_at = NOW()
        WHERE result_value IS NULL
          AND value IS NOT NULL
          AND TRIM(value) <> '';
    END IF;
END $$;

-- Existing completed rows with a result → entered (verification is a new step)
UPDATE pre_op_completions
SET entry_status = 'entered',
    updated_at = NOW()
WHERE is_completed = TRUE
  AND entry_status = 'draft'
  AND result_value IS NOT NULL
  AND TRIM(result_value) <> '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pre_op_completions_entry_status_check'
    ) THEN
        ALTER TABLE pre_op_completions
            ADD CONSTRAINT pre_op_completions_entry_status_check
            CHECK (entry_status IN ('draft', 'entered', 'verified'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pre_op_completions_result_flag_check'
    ) THEN
        ALTER TABLE pre_op_completions
            ADD CONSTRAINT pre_op_completions_result_flag_check
            CHECK (result_flag IS NULL OR result_flag IN ('Normal', 'High', 'Low', 'Critical'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pre_op_completions_result_source_check'
    ) THEN
        ALTER TABLE pre_op_completions
            ADD CONSTRAINT pre_op_completions_result_source_check
            CHECK (result_source IS NULL OR result_source IN (
                'internal_lab', 'external_hospital', 'counsellor', 'manual_ward', 'integration'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_preop_completions_entry_status
    ON pre_op_completions(clearance_id, entry_status)
    WHERE deleted_at IS NULL;

-- ── 2. counsellor_checklist_completions — optional draft values ───────────────

ALTER TABLE counsellor_checklist_completions
    ADD COLUMN IF NOT EXISTS result_value VARCHAR(200),
    ADD COLUMN IF NOT EXISTS result_unit VARCHAR(50),
    ADD COLUMN IF NOT EXISTS entry_status VARCHAR(20) NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN counsellor_checklist_completions.result_value IS
    'Optional pre-op investigation value entered at counselling; copies to ward as draft.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'counsellor_checklist_completions_entry_status_check'
    ) THEN
        ALTER TABLE counsellor_checklist_completions
            ADD CONSTRAINT counsellor_checklist_completions_entry_status_check
            CHECK (entry_status IN ('draft', 'entered', 'verified'));
    END IF;
END $$;

-- ── 3. pre_op_section_items — item_config for units / critical flags ──────────

ALTER TABLE pre_op_section_items
    ADD COLUMN IF NOT EXISTS item_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN pre_op_section_items.item_config IS
    'Per-item UI/validation: valueType, defaultUnit, requiresReport, isCritical, glucoseTypes, etc.';

-- Apply configs to active Form 1 investigation items
UPDATE pre_op_section_items SET item_config = jsonb_build_object(
    'valueType', 'numeric', 'defaultUnit', 'mg/dL', 'isCritical', false, 'allowGlucoseType', true
), updated_at = NOW()
WHERE item_key = 'blood_sugar' AND form_code = 'WARD_INVESTIGATION_PREOP';

UPDATE pre_op_section_items SET item_config = jsonb_build_object(
    'valueType', 'text', 'defaultUnit', 'mmHg', 'isCritical', false, 'placeholder', '120/80'
), updated_at = NOW()
WHERE item_key = 'bp_checked' AND form_code = 'WARD_INVESTIGATION_PREOP';

UPDATE pre_op_section_items SET item_config = jsonb_build_object(
    'valueType', 'text', 'defaultUnit', '', 'isCritical', true
), updated_at = NOW()
WHERE item_key IN ('hiv_done', 'serum_creatinine', 'blood_urea', 'hba1c_done')
  AND form_code = 'WARD_INVESTIGATION_PREOP';

UPDATE pre_op_section_items SET item_config = jsonb_build_object(
    'valueType', 'text', 'defaultUnit', 'mm', 'isCritical', false, 'requiresReport', true
), updated_at = NOW()
WHERE item_key IN ('ascan_done', 'bscan_done')
  AND form_code = 'WARD_INVESTIGATION_PREOP';

UPDATE pre_op_section_items SET item_config = jsonb_build_object(
    'valueType', 'text', 'defaultUnit', '', 'isCritical', false, 'requiresReport', true
), updated_at = NOW()
WHERE item_key = 'xray_ga_cases' AND form_code = 'WARD_INVESTIGATION_PREOP';

UPDATE pre_op_section_items SET item_config = jsonb_build_object(
    'valueType', 'text', 'defaultUnit', '', 'isCritical', false
), updated_at = NOW()
WHERE item_key IN ('physician_fitness', 'duct_assessed', 'consent_confirmed')
  AND form_code = 'WARD_INVESTIGATION_PREOP';

-- ── 4. Deactivate duplicate clearance / Form 1 items ──────────────────────────

-- Dilatation belongs on Ward Checklist (Form 2) + Med Log only
UPDATE pre_op_section_items
SET status = 'inactive',
    is_active = FALSE,
    updated_at = NOW()
WHERE item_key = 'dilatation_done'
  AND form_code = 'WARD_INVESTIGATION_PREOP';

-- Clearance catalog duplicates superseded by Form 1 canonical rows
UPDATE pre_op_section_items
SET status = 'inactive',
    is_active = FALSE,
    updated_at = NOW()
WHERE tenant_id IS NULL
  AND COALESCE(form_code, '') <> 'WARD_INVESTIGATION_PREOP'
  AND item_key IN (
      'blood_sugar_fbs',
      'blood_sugar_rbs',
      'biometry_done',
      'hemoglobin',
      'ecg_done',
      'pt_inr',
      'bp_checked'
  );

-- ── 5. Seed missing Form 1 items (canonical §1 Investigations) ────────────────

INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     form_code, form_context, display_order, status, item_config)
VALUES
(gen_random_uuid(), NULL, 'Ward Investigation', 'hemoglobin',
 'Hb / Hemoglobin', 'Hemoglobin / CBC result available.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', 135, 'active',
 '{"valueType":"numeric","defaultUnit":"g/dL","isCritical":true}'::jsonb),

(gen_random_uuid(), NULL, 'Ward Investigation', 'ecg_done',
 'ECG', 'Electrocardiogram result available when indicated.',
 'Cardiology', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', 145, 'active',
 '{"valueType":"text","defaultUnit":"","isCritical":true,"requiresReport":true}'::jsonb),

(gen_random_uuid(), NULL, 'Ward Investigation', 'pt_inr',
 'PT / INR', 'Coagulation profile when on anticoagulants.',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', 155, 'active',
 '{"valueType":"numeric","defaultUnit":"","isCritical":false}'::jsonb),

(gen_random_uuid(), NULL, 'Ward Investigation', 'hbsag_done',
 'HBsAg', 'Hepatitis B surface antigen result.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', 165, 'active',
 '{"valueType":"text","defaultUnit":"","isCritical":true}'::jsonb),

(gen_random_uuid(), NULL, 'Ward Investigation', 'hcv_done',
 'HCV', 'Hepatitis C serology result.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', 175, 'active',
 '{"valueType":"text","defaultUnit":"","isCritical":true}'::jsonb)

ON CONFLICT (item_key) DO UPDATE SET
    form_code         = EXCLUDED.form_code,
    form_context      = EXCLUDED.form_context,
    category          = EXCLUDED.category,
    item_label        = EXCLUDED.item_label,
    description       = EXCLUDED.description,
    display_order     = EXCLUDED.display_order,
    status            = 'active',
    is_active         = TRUE,
    item_config       = EXCLUDED.item_config,
    updated_at        = NOW();

-- Ensure newly consolidated keys are active on Form 1 even if row pre-existed as clearance item
UPDATE pre_op_section_items
SET form_code    = 'WARD_INVESTIGATION_PREOP',
    form_context = 'ward_investigation',
    category     = 'Ward Investigation',
    status       = 'active',
    is_active    = TRUE,
    updated_at   = NOW()
WHERE item_key IN ('hemoglobin', 'ecg_done', 'pt_inr')
  AND tenant_id IS NULL;

-- ── 6. RBAC — investigation enter / verify ────────────────────────────────────

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
        ('ward.investigation.enter', 'Enter Ward Investigation Results', 'ip_management', 'edit', 'ward_investigation', 'branch',
         'Enter pre-op investigation result values on ward checklist'),
        ('ward.investigation.verify', 'Verify Ward Investigation Results', 'ip_management', 'verify', 'ward_investigation', 'branch',
         'Verify pre-op investigation results before PAC')
    ) AS v(code, name, module, action, resource_type, scope, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."TenantId" = sys_tenant
    );

    -- Admin: both
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('ward.investigation.enter', 'ward.investigation.verify') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'ADMIN'
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    -- Nurse / OT nurse: enter + verify
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('ward.investigation.enter', 'ward.investigation.verify') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('NURSE', 'OT NURSE', 'OTNURSE')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    -- Doctor / Surgeon: enter + verify
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('ward.investigation.enter', 'ward.investigation.verify') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('DOCTOR', 'SURGEON')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    -- Counsellor: enter + verify (optional values at counselling)
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('ward.investigation.enter', 'ward.investigation.verify') AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    -- Front desk: enter only
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'ward.investigation.enter' AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('FRONT DESK', 'FRONTDESK')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );
END $$;

COMMIT;
