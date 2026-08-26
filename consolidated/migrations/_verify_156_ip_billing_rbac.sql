-- =============================================================================
-- _verify_156_ip_billing_rbac.sql
-- Verification for TASK SEC-040 / migration 156. Read-only.
--
--   psql "$DATABASE_URL" -f consolidated/migrations/_verify_156_ip_billing_rbac.sql
--
-- Every check prints PASS or FAIL. Any FAIL means 156 did not fully apply.
-- =============================================================================

\pset pager off

\echo
\echo ===== 1. Every code enforced in IpChecklistAuth.cs / ip-role-actions.ts exists
SELECT v.code,
       CASE WHEN p.id IS NULL THEN 'FAIL - missing' ELSE 'PASS' END AS status
FROM (VALUES
  ('ip.view'),('ip.admit'),('ip.bed.transfer'),('ip.ot.mark_ready'),('ip.ot.unmark_ready'),
  ('ip.ot.send'),('ip.ot.accept'),('ip.surgery.start'),('ip.surgery.complete'),
  ('ip.postop.manage'),('ip.discharge'),('ip.discharge.override'),
  ('ip.billing.collect'),('ip.billing.refund'),('ip.billing.adjust'),
  ('bill.create'),('bill.update'),('bill.view'),('bill.admin'),
  ('opd_bill.view'),('opd_bill.refund'),('opd_bill.refund.authorize')
) AS v(code)
LEFT JOIN permissions p
  ON p."Code" = v.code AND p."TenantId" = '00000000-0000-0000-0000-000000000000'
ORDER BY status, v.code;

\echo
\echo ===== 2. Bundle roles exist
SELECT v.name,
       CASE WHEN r.id IS NULL THEN 'FAIL - missing' ELSE 'PASS' END AS status
FROM (VALUES
  ('CASHIER'),('IP COORDINATOR'),('OT COORDINATOR'),('SURGEON'),('FINANCE'),
  ('TPA EXECUTIVE'),('BILLING CLERK'),('NURSE'),('DOCTOR'),('COUNSELLOR'),('ADMIN')
) AS v(name)
LEFT JOIN app_roles r ON upper(coalesce(r."NormalizedName", r.name, '')) = v.name
ORDER BY status, v.name;

\echo
\echo ===== 3. Cashier CAN collect and CANNOT touch the clinical path
\echo        (expect can_collect=t, and every clinical column f)
SELECT r.name,
       bool_or(p."Code" = 'ip.billing.collect')  AS can_collect,
       bool_or(p."Code" = 'bill.create')         AS can_create_bill,
       bool_or(p."Code" = 'ip_management.view')  AS can_open_census,
       bool_or(p."Code" = 'ip.admit')            AS can_admit,
       bool_or(p."Code" = 'ip.ot.mark_ready')    AS can_mark_ready,
       bool_or(p."Code" = 'ip.ot.send')          AS can_send_ot,
       bool_or(p."Code" = 'ip.discharge')        AS can_discharge
FROM app_roles r
JOIN role_permission rp ON rp."RoleId" = r.id
JOIN permissions p ON p.id = rp."PermissionId"
WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('CASHIER', 'BILLING CLERK')
GROUP BY r.name;

\echo
\echo ===== 4. Nurse CAN run the clinical path and CANNOT refund or adjust
\echo        (expect clinical columns t, can_refund/can_adjust f)
SELECT r.name,
       bool_or(p."Code" = 'ip.admit')            AS can_admit,
       bool_or(p."Code" = 'ip.ot.mark_ready')    AS can_mark_ready,
       bool_or(p."Code" = 'ip.discharge')        AS can_discharge,
       bool_or(p."Code" = 'ip.billing.refund')   AS can_refund,
       bool_or(p."Code" = 'ip.billing.adjust')   AS can_adjust
FROM app_roles r
JOIN role_permission rp ON rp."RoleId" = r.id
JOIN permissions p ON p.id = rp."PermissionId"
WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'NURSE'
GROUP BY r.name;

\echo
\echo ===== 5. Separation of duty: Finance authorises refunds but cannot collect
\echo        (expect can_authorize_refund=t, can_collect=f)
SELECT r.name,
       bool_or(p."Code" = 'opd_bill.refund.authorize') AS can_authorize_refund,
       bool_or(p."Code" = 'bill.admin')                AS can_admin_rules,
       bool_or(p."Code" = 'ip.billing.collect')        AS can_collect
FROM app_roles r
JOIN role_permission rp ON rp."RoleId" = r.id
JOIN permissions p ON p.id = rp."PermissionId"
WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'FINANCE'
GROUP BY r.name;

\echo
\echo ===== 6. Grandfather held: every role with ward.checklist.edit/ot.safety.sign
\echo        now also holds the explicit clinical codes (expect zero rows)
WITH legacy AS (
    SELECT DISTINCT r.id, r.name
    FROM app_roles r
    JOIN role_permission rp ON rp."RoleId" = r.id
    JOIN permissions p ON p.id = rp."PermissionId"
    WHERE p."Code" IN ('ward.checklist.edit', 'ot.safety.sign')
), required AS (
    SELECT unnest(ARRAY['ip.view','ip.admit','ip.bed.transfer','ip.ot.mark_ready',
                        'ip.ot.unmark_ready','ip.ot.send','ip.ot.accept','ip.surgery.start',
                        'ip.surgery.complete','ip.postop.manage','ip.discharge']) AS code
)
SELECT l.name AS role_missing_grandfathered_code, req.code
FROM legacy l
CROSS JOIN required req
WHERE NOT EXISTS (
    SELECT 1 FROM role_permission rp
    JOIN permissions p ON p.id = rp."PermissionId"
    WHERE rp."RoleId" = l.id AND p."Code" = req.code
)
ORDER BY l.name, req.code;

\echo
\echo ===== 7. No orphaned or duplicate grants introduced (expect zero rows)
SELECT rp."RoleId", rp."PermissionId", count(*) AS duplicates
FROM role_permission rp
GROUP BY rp."RoleId", rp."PermissionId"
HAVING count(*) > 1;

\echo
\echo ===== 8. Effective reach: active users per newly granted capability
SELECT p."Code",
       count(DISTINCT ur.user_id) AS active_users
FROM permissions p
JOIN role_permission rp ON rp."PermissionId" = p.id
JOIN app_roles r ON r.id = rp."RoleId"
LEFT JOIN app_user_roles ur ON ur.role_id = r.id AND ur."IsActive"
WHERE p."Code" IN ('ip.billing.collect','bill.update','bill.create','bill.admin',
                   'opd_bill.refund.authorize','ip.discharge.override')
GROUP BY p."Code"
ORDER BY p."Code";
