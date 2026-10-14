import type { LmsReportDetailDto } from '@/lib/lms/lms-reports.api';

/**
 * Frontend eligibility for Official PDF Preview / Download affordances.
 * Server Download path remains authoritative for authorization and current-artifact resolution.
 */
export function isLmsOfficialPdfPreviewEligible(
  detail: Pick<
    LmsReportDetailDto,
    'status' | 'businessReportNumber' | 'currentOfficialArtifactId' | 'currentOfficialArtifact'
  > | null,
): boolean {
  if (!detail) return false;
  return (
    detail.status === 'Released' &&
    !!detail.businessReportNumber &&
    !!detail.currentOfficialArtifactId &&
    detail.currentOfficialArtifact?.status === 'Succeeded'
  );
}
