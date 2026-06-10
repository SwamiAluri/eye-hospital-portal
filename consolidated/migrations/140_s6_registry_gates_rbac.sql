-- ============================================================================
-- Migration 140: S6 — WARD_INVESTIGATION_PREOP, checklist_phase_status, RBAC
-- Dependencies: 139_s5_ip_checklist_permissions.sql
-- Date: 2026-06
-- ============================================================================

BEGIN;

-- ── Journey phase tracking + WHO supervisor override ─────────────────────────
ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS checklist_phase_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS who_supervisor_override_applied BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS who_supervisor_override_by UUID,
    ADD COLUMN IF NOT EXISTS who_supervisor_override_at TIMESTAMPTZ;

COMMENT ON COLUMN patient_journey.checklist_phase_status IS
    'Parallel checklist progress: pac_completed, who_timeout_complete, ward_postop_complete, etc.';

-- ── Role audit on completions ───────────────────────────────────────────────
ALTER TABLE pre_op_completions
    ADD COLUMN IF NOT EXISTS completed_by_role VARCHAR(80);

ALTER TABLE counsellor_checklist_completions
    ADD COLUMN IF NOT EXISTS completed_by_role VARCHAR(80);

-- ── Form 1 Ward Investigation Pre-op (13 Saijyothi items) ────────────────────
INSERT INTO pre_op_section_items
    (id, tenant_id, category, item_key, item_label, description,
     department_owner, responsible_department_code,
     is_mandatory, is_blocking, requires_document,
     form_code, form_context, surgery_type_filter, display_order, status)
VALUES
(gen_random_uuid(), NULL, 'Ward Investigation', 'blood_sugar',
 'Blood Sugar', 'FBS/RBS blood sugar result available.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 10, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'bp_checked',
 'Blood Pressure', 'Pre-operative blood pressure recorded.',
 'Nursing', 'STD_NURSE', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 20, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'hiv_done',
 'HIV', 'HIV serology result available.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 30, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'blood_urea',
 'Blood Urea', 'Blood urea result available.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 40, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'serum_creatinine',
 'Serum Creatinine', 'Serum creatinine result available.',
 'Lab', 'STD_LABORATORY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 50, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'hba1c_done',
 'HbA1C', 'HbA1C result available (when indicated).',
 'Lab', 'STD_LABORATORY', FALSE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 60, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'ascan_done',
 'A-Scan', 'A-Scan biometry completed and reviewed.',
 'Optometry', 'STD_IMAGING', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 70, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'bscan_done',
 'B-Scan', 'B-scan ultrasound completed when indicated.',
 'Optometry', 'STD_IMAGING', FALSE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 80, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'xray_ga_cases',
 'X-Ray (GA Cases)', 'Chest X-ray for general anaesthesia cases.',
 'Optometry', 'STD_IMAGING', FALSE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', 'General', 90, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'physician_fitness',
 'Physician Fitness', 'Physician / PAC fitness documented.',
 'Cardiology', 'STD_DOCTOR', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 100, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'duct_assessed',
 'Duct Assessment', 'Lacrimal duct assessment completed when indicated.',
 'Nursing', 'STD_NURSE', FALSE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 110, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'dilatation_done',
 'Dilatation Done', 'Mydriatic / cycloplegic dilatation completed.',
 'Pharmacy', 'STD_PHARMACY', TRUE, FALSE, FALSE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 120, 'active'),

(gen_random_uuid(), NULL, 'Ward Investigation', 'consent_confirmed',
 'Consent Confirmed', 'Surgical consent form signed and on file.',
 'Administration', 'STD_COUNSELOR', TRUE, FALSE, TRUE,
 'WARD_INVESTIGATION_PREOP', 'ward_investigation', NULL, 130, 'active')

ON CONFLICT (item_key) DO UPDATE SET
    form_code    = EXCLUDED.form_code,
    form_context = EXCLUDED.form_context,
    category     = EXCLUDED.category,
    item_label   = EXCLUDED.item_label,
    description  = EXCLUDED.description,
    is_blocking  = EXCLUDED.is_blocking,
    display_order = EXCLUDED.display_order,
    surgery_type_filter = EXCLUDED.surgery_type_filter,
    updated_at   = NOW();

-- ── Additional permission: WHO supervisor override + clinical role grants (EF schema) ──
DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, 'ot.safety.override', 'Override OT WHO Timeout', 'ip_management', 'override', 'ot_safety', 'branch',
           'Supervisor override for incomplete WHO timeout before start surgery', true, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = 'ot.safety.override' AND p."TenantId" = sys_tenant
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN (
        'ward.checklist.edit',
        'ot.safety.sign',
        'anaesthesia.pac.edit',
        'anaesthesia.monitoring.edit',
        'counsellor.outpatient_checklist.edit',
        'ot.safety.override',
        'ip_management.view'
    ) AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN (
        'ADMIN', 'NURSE', 'COUNSELLOR', 'COUNSELOR',
        'OT NURSE', 'OTNURSE', 'ANAESTHETIST', 'ANESTHETIST', 'SURGEON', 'DOCTOR'
    )
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'counsellor.outpatient_checklist.edit' AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR', 'ADMIN')
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );

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

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'ward.checklist.edit' AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('NURSE', 'OT NURSE', 'OTNURSE', 'ADMIN')
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );

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

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'ip_management.view' AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN (
        'ADMIN', 'NURSE', 'COUNSELLOR', 'COUNSELOR', 'OT NURSE', 'OTNURSE',
        'ANAESTHETIST', 'ANESTHETIST', 'SURGEON', 'DOCTOR', 'FRONT DESK', 'FRONTDESK'
    )
    AND NOT EXISTS (
        SELECT 1 FROM role_permission rp WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
    );
END $$;

COMMIT;
