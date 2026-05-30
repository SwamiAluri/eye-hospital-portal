-- ============================================================
-- Migration 127: CCMS Permission Seed
--   Seeds all ccms.* permissions for the Coverage & Claims
--   Management System module into the auth service permissions
--   table (tenant_id = nil UUID = global system permissions).
-- ============================================================

BEGIN;

-- Nil tenant = global / system permissions
DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN

INSERT INTO permissions (id, tenant_id, code, name, module, action, resource_type, scope,
    description, is_system_permission, department_specific, is_custom, is_active,
    created_at, updated_at)
VALUES
-- ── Coverage Cases ────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.coverage_case.create',
 'Create Coverage Case', 'ccms', 'create', 'coverage_case', 'branch',
 'Open a new CCMS coverage case for a patient session', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.coverage_case.read',
 'View Coverage Case', 'ccms', 'read', 'coverage_case', 'branch',
 'View coverage case details, state and timeline', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.coverage_case.update',
 'Update Coverage Case', 'ccms', 'update', 'coverage_case', 'branch',
 'Edit coverage case fields (payer, policy, notes)', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.coverage_case.delete',
 'Delete Coverage Case', 'ccms', 'delete', 'coverage_case', 'global',
 'Soft-delete a coverage case (admin only)', true, false, false, true, NOW(), NOW()),

-- ── Eligibility ───────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.eligibility.create',
 'Record Eligibility Check', 'ccms', 'create', 'eligibility_check', 'branch',
 'Add an eligibility check result for a case', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.eligibility.read',
 'View Eligibility Checks', 'ccms', 'read', 'eligibility_check', 'branch',
 'View eligibility check history for a case', true, false, false, true, NOW(), NOW()),

-- ── Visit Policies ────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.visit_policy.create',
 'Add Visit Policy', 'ccms', 'create', 'visit_policy', 'branch',
 'Add an insurance policy to a session or case', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.visit_policy.read',
 'View Visit Policies', 'ccms', 'read', 'visit_policy', 'branch',
 'View all policies attached to a session or case', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.visit_policy.update',
 'Edit Visit Policy', 'ccms', 'update', 'visit_policy', 'branch',
 'Edit policy details and set primary', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.visit_policy.delete',
 'Delete Visit Policy', 'ccms', 'delete', 'visit_policy', 'branch',
 'Remove a policy from a session or case', true, false, false, true, NOW(), NOW()),

-- ── Pre-Authorization ─────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.authorization.create',
 'Generate Pre-Authorization', 'ccms', 'create', 'authorization', 'branch',
 'Generate a new pre-authorisation request', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.authorization.read',
 'View Pre-Authorization', 'ccms', 'read', 'authorization', 'branch',
 'View pre-auth details, financial breakdown and TPA responses', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.authorization.submit',
 'Submit Pre-Authorization', 'ccms', 'submit', 'authorization', 'branch',
 'Mark a pre-auth as submitted to TPA / insurer', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.authorization.record_response',
 'Record TPA Response', 'ccms', 'record_response', 'authorization', 'branch',
 'Record approval, partial approval, rejection or clarification from TPA', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.authorization.update_process_status',
 'Update Authorization Process Status', 'ccms', 'update', 'authorization_status', 'branch',
 'Set fine-grained process status on an authorization', true, false, false, true, NOW(), NOW()),

-- ── Clarifications ────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.clarification.create',
 'Add Clarification Query', 'ccms', 'create', 'clarification', 'branch',
 'Record a TPA query against a pre-authorisation', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.clarification.respond',
 'Respond to Clarification', 'ccms', 'respond', 'clarification', 'branch',
 'Provide hospital response to a TPA clarification query', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.clarification.read',
 'View Clarifications', 'ccms', 'read', 'clarification', 'branch',
 'View all clarification queries and responses for an authorization', true, false, false, true, NOW(), NOW()),

-- ── Claims ────────────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.claim.create',
 'Create Claim Packet', 'ccms', 'create', 'claim', 'branch',
 'Create a claim packet for billing', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.claim.read',
 'View Claim', 'ccms', 'read', 'claim', 'branch',
 'View claim packets and their status', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.claim.submit',
 'Submit Claim', 'ccms', 'submit', 'claim', 'branch',
 'Submit claim to TPA or insurer', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.claim.acknowledge',
 'Acknowledge Claim', 'ccms', 'acknowledge', 'claim', 'branch',
 'Record TPA acknowledgement of a claim', true, false, false, true, NOW(), NOW()),

-- ── Settlements ───────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.settlement.create',
 'Record Settlement', 'ccms', 'create', 'settlement', 'branch',
 'Record a payment receipt against a claim', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.settlement.read',
 'View Settlements', 'ccms', 'read', 'settlement', 'branch',
 'View settlement history and amounts', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.settlement.reconcile',
 'Reconcile Settlement', 'ccms', 'reconcile', 'settlement', 'branch',
 'Mark a coverage case as reconciled after full settlement', true, false, false, true, NOW(), NOW()),

-- ── Billing Allocation ────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.billing.allocate',
 'Allocate Bill', 'ccms', 'allocate', 'billing', 'branch',
 'Run insurance vs patient share allocation on a final bill', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.billing.read',
 'View Billing Allocation', 'ccms', 'read', 'billing', 'branch',
 'View billing summary and line-item allocation breakdown', true, false, false, true, NOW(), NOW()),

-- ── Documents ─────────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.document.upload',
 'Upload CCMS Document', 'ccms', 'upload', 'document', 'branch',
 'Upload supporting documents to a coverage case', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.document.read',
 'View CCMS Documents', 'ccms', 'read', 'document', 'branch',
 'View and download coverage case documents', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.document.delete',
 'Delete CCMS Document', 'ccms', 'delete', 'document', 'branch',
 'Remove a document from a coverage case', true, false, false, true, NOW(), NOW()),

-- ── Master Data ───────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.master_data.read',
 'View CCMS Master Data', 'ccms', 'read', 'master_data', 'global',
 'View insurance providers, TPA providers, coverage packages', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.master_data.manage',
 'Manage CCMS Master Data', 'ccms', 'manage', 'master_data', 'global',
 'Create, edit and delete insurance providers, TPA providers, packages', true, false, false, true, NOW(), NOW()),

-- ── Reporting ─────────────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.report.aging',
 'View Aging Report', 'ccms', 'read', 'report_aging', 'global',
 'View claims aging and TAT analysis reports', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.report.dashboard',
 'View CCMS Dashboard', 'ccms', 'read', 'report_dashboard', 'global',
 'View the CCMS analytics dashboard', true, false, false, true, NOW(), NOW()),

-- ── Workflow / Admin ──────────────────────────────────────────────────────
(gen_random_uuid(), sys_tenant, 'ccms.workflow.fire',
 'Fire Workflow Trigger', 'ccms', 'fire', 'workflow', 'branch',
 'Manually fire a workflow state transition on a coverage case', true, false, false, true, NOW(), NOW()),

(gen_random_uuid(), sys_tenant, 'ccms.workflow.admin',
 'CCMS Workflow Admin', 'ccms', 'admin', 'workflow', 'global',
 'Admin access: view all workflow instances, force-override states', true, false, false, true, NOW(), NOW())

ON CONFLICT (tenant_id, code) DO NOTHING;

END$$;

COMMIT;
