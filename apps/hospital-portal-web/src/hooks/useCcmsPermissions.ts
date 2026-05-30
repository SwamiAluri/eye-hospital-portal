import { useAuthStore } from '@/lib/auth-store';

// ─────────────────────────────────────────────────────────────────────────────
// Permission code constants — mirrors 127_ccms_permissions.sql
// ─────────────────────────────────────────────────────────────────────────────

export const CCMS_PERMISSIONS = {
  // Coverage Cases
  CASE_CREATE:               'ccms.coverage_case.create',
  CASE_READ:                 'ccms.coverage_case.read',
  CASE_UPDATE:               'ccms.coverage_case.update',

  // Eligibility
  ELIGIBILITY_CREATE:        'ccms.eligibility.create',
  ELIGIBILITY_READ:          'ccms.eligibility.read',

  // Visit Policies
  POLICY_CREATE:             'ccms.visit_policy.create',
  POLICY_READ:               'ccms.visit_policy.read',
  POLICY_UPDATE:             'ccms.visit_policy.update',
  POLICY_DELETE:             'ccms.visit_policy.delete',

  // Authorization
  AUTH_CREATE:               'ccms.authorization.create',
  AUTH_READ:                 'ccms.authorization.read',
  AUTH_SUBMIT:               'ccms.authorization.submit',
  AUTH_RECORD_RESPONSE:      'ccms.authorization.record_response',
  AUTH_UPDATE_STATUS:        'ccms.authorization.update_process_status',

  // Clarifications
  CLARIFICATION_CREATE:      'ccms.clarification.create',
  CLARIFICATION_RESPOND:     'ccms.clarification.respond',
  CLARIFICATION_READ:        'ccms.clarification.read',

  // Claims
  CLAIM_CREATE:              'ccms.claim.create',
  CLAIM_READ:                'ccms.claim.read',
  CLAIM_SUBMIT:              'ccms.claim.submit',
  CLAIM_ACKNOWLEDGE:         'ccms.claim.acknowledge',

  // Settlements
  SETTLEMENT_CREATE:         'ccms.settlement.create',
  SETTLEMENT_READ:           'ccms.settlement.read',
  SETTLEMENT_RECONCILE:      'ccms.settlement.reconcile',

  // Billing
  BILLING_ALLOCATE:          'ccms.billing.allocate',
  BILLING_READ:              'ccms.billing.read',

  // Documents
  DOCUMENT_UPLOAD:           'ccms.document.upload',
  DOCUMENT_READ:             'ccms.document.read',
  DOCUMENT_DELETE:           'ccms.document.delete',

  // Master Data
  MASTER_DATA_READ:          'ccms.master_data.read',
  MASTER_DATA_MANAGE:        'ccms.master_data.manage',

  // Reporting
  REPORT_DASHBOARD:          'ccms.report.dashboard',
  REPORT_AGING:              'ccms.report.aging',

  // Workflow
  WORKFLOW_FIRE:             'ccms.workflow.fire',
  WORKFLOW_ADMIN:            'ccms.workflow.admin',
} as const;

export type CcmsPermissionCode = (typeof CCMS_PERMISSIONS)[keyof typeof CCMS_PERMISSIONS];

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useCcmsPermissions() {
  const permissions = useAuthStore(s => s.permissions);
  const userPermissions: string[] = permissions ?? [];

  function can(code: CcmsPermissionCode | string): boolean {
    // Super-admins and workflow admins bypass all checks
    if (
      userPermissions.includes('*') ||
      userPermissions.includes('ccms.workflow.admin')
    ) return true;
    return userPermissions.includes(code);
  }

  function canAny(...codes: (CcmsPermissionCode | string)[]): boolean {
    return codes.some(c => can(c));
  }

  function canAll(...codes: (CcmsPermissionCode | string)[]): boolean {
    return codes.every(c => can(c));
  }

  return {
    can,
    canAny,
    canAll,
    // Convenience shorthands
    canCreateCase:         can(CCMS_PERMISSIONS.CASE_CREATE),
    canViewCase:           can(CCMS_PERMISSIONS.CASE_READ),
    canManagePolicies:     can(CCMS_PERMISSIONS.POLICY_CREATE),
    canCreateAuth:         can(CCMS_PERMISSIONS.AUTH_CREATE),
    canSubmitAuth:         can(CCMS_PERMISSIONS.AUTH_SUBMIT),
    canRecordTpaResponse:  can(CCMS_PERMISSIONS.AUTH_RECORD_RESPONSE),
    canAddClarification:   can(CCMS_PERMISSIONS.CLARIFICATION_CREATE),
    canRespondClarification: can(CCMS_PERMISSIONS.CLARIFICATION_RESPOND),
    canCreateClaim:        can(CCMS_PERMISSIONS.CLAIM_CREATE),
    canSubmitClaim:        can(CCMS_PERMISSIONS.CLAIM_SUBMIT),
    canAcknowledgeClaim:   can(CCMS_PERMISSIONS.CLAIM_ACKNOWLEDGE),
    canRecordSettlement:   can(CCMS_PERMISSIONS.SETTLEMENT_CREATE),
    canReconcile:          can(CCMS_PERMISSIONS.SETTLEMENT_RECONCILE),
    canAllocateBill:       can(CCMS_PERMISSIONS.BILLING_ALLOCATE),
    canManageMasterData:   can(CCMS_PERMISSIONS.MASTER_DATA_MANAGE),
    canFireWorkflow:       can(CCMS_PERMISSIONS.WORKFLOW_FIRE),
    isWorkflowAdmin:       can(CCMS_PERMISSIONS.WORKFLOW_ADMIN),
  };
}
