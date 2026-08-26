import type { AdmissionValidation } from '@/lib/api/ccms/ccms-coverage-cases.api';

/** Display helper — does not re-map ALLOW/WARN/BLOCK; backend owns that. */
export function formatCounsellingCcmsStatus(v: AdmissionValidation | null): string {
  if (!v) return 'Coverage status unavailable';
  const parts: string[] = [];
  if (v.coverageState) parts.push(v.coverageState);
  if (v.decision) parts.push(v.decision);
  if (!v.allowed && v.blockReason) parts.push(v.blockReason);
  else if (v.warningMessage) parts.push(v.warningMessage);
  return parts.join(' · ') || (v.allowed ? 'Coverage ready' : 'Coverage not ready');
}
