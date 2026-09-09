import type { AdmissionValidation } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { getStateLabel } from '@/lib/api/ccms/ccms-state-labels';
import {
  formatCounsellorCoverageStatus,
  isPreAuthSubmittedState,
} from '@/lib/counsellors-desk/session-status-summary';

/** Display helper — machine status title only; backend owns ALLOW/WARN/BLOCK. */
export function formatCounsellingCcmsStatus(v: AdmissionValidation | null): string {
  if (!v) return 'Not started';
  return formatCounsellorCoverageStatus({
    showCoverageWorkflow: true,
    notRequiredPreAuth: false,
    ccmsState: v.coverageState,
    preAuthSubmitted: isPreAuthSubmittedState(v.coverageState),
    admission: v,
  }).label;
}

export function formatCounsellingCcmsStateLabel(code?: string | null): string {
  if (!code) return 'Not started';
  return getStateLabel(code);
}
