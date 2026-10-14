/**
 * L-REP-03 CUT D-B — Patient 360 Documents → Laboratory LMS Official PDF projection.
 * Discovery only; bytes via CUT C downloadLmsOfficialPdf (lms.reports.download).
 */
import {
  listPatientCurrentLmsOfficialPdfs,
  type PatientCurrentLmsOfficialPdfDto,
} from '@/lib/lms/lms-reports.api';
import {
  classifyReadError,
  type ClinicalListResult,
  type ReadState,
} from '@/lib/patients/patient-360-clinical';

export const LMS_OFFICIAL_PDF_SOURCE_LABEL = 'Enterprise LMS Laboratory';
export const LMS_OFFICIAL_PDF_TYPE_LABEL = 'LMS Official PDF';

export type LmsOfficialPdfDocumentRow = {
  reportId: string;
  operatingBranchId: string;
  businessReportNumber: string;
  reportStatus: string;
  artifactId: string;
  artifactVersion: number;
  canonicalDocumentId: string;
  mimeType: string;
  sizeBytes: number;
  generatedAtUtc: string | null;
  fileName: string;
  sourceDomain: string;
  sourceEntityType: string;
};

export type LmsOfficialPdfListResult = ClinicalListResult<LmsOfficialPdfDocumentRow>;

export function mapPatientCurrentLmsOfficialPdf(
  raw: PatientCurrentLmsOfficialPdfDto | Record<string, unknown>,
): LmsOfficialPdfDocumentRow | null {
  const reportId = text((raw as PatientCurrentLmsOfficialPdfDto).reportId ?? (raw as Record<string, unknown>).reportId);
  const operatingBranchId = text(
    (raw as PatientCurrentLmsOfficialPdfDto).operatingBranchId ??
      (raw as Record<string, unknown>).operatingBranchId,
  );
  const businessReportNumber = text(
    (raw as PatientCurrentLmsOfficialPdfDto).businessReportNumber ??
      (raw as Record<string, unknown>).businessReportNumber,
  );
  const canonicalDocumentId = text(
    (raw as PatientCurrentLmsOfficialPdfDto).canonicalDocumentId ??
      (raw as Record<string, unknown>).canonicalDocumentId,
  );
  const artifactId = text(
    (raw as PatientCurrentLmsOfficialPdfDto).artifactId ?? (raw as Record<string, unknown>).artifactId,
  );
  if (!reportId || !operatingBranchId || !businessReportNumber || !canonicalDocumentId || !artifactId) {
    return null;
  }

  const mimeType =
    text((raw as PatientCurrentLmsOfficialPdfDto).mimeType ?? (raw as Record<string, unknown>).mimeType) ||
    'application/pdf';
  const generatedAtUtc = text(
    (raw as PatientCurrentLmsOfficialPdfDto).generatedAtUtc ??
      (raw as Record<string, unknown>).generatedAtUtc,
  );
  const artifactVersionRaw =
    (raw as PatientCurrentLmsOfficialPdfDto).artifactVersion ??
    (raw as Record<string, unknown>).artifactVersion;
  const artifactVersion =
    typeof artifactVersionRaw === 'number' && Number.isFinite(artifactVersionRaw)
      ? artifactVersionRaw
      : Number(artifactVersionRaw) || 0;
  const sizeBytesRaw =
    (raw as PatientCurrentLmsOfficialPdfDto).sizeBytes ?? (raw as Record<string, unknown>).sizeBytes;
  const sizeBytes =
    typeof sizeBytesRaw === 'number' && Number.isFinite(sizeBytesRaw) ? sizeBytesRaw : Number(sizeBytesRaw) || 0;

  return {
    reportId,
    operatingBranchId,
    businessReportNumber,
    reportStatus:
      text((raw as PatientCurrentLmsOfficialPdfDto).reportStatus ?? (raw as Record<string, unknown>).reportStatus) ||
      'Released',
    artifactId,
    artifactVersion,
    canonicalDocumentId,
    mimeType,
    sizeBytes,
    generatedAtUtc: generatedAtUtc || null,
    fileName: `${businessReportNumber}.pdf`,
    sourceDomain:
      text((raw as PatientCurrentLmsOfficialPdfDto).sourceDomain ?? (raw as Record<string, unknown>).sourceDomain) ||
      'enterprise_lms',
    sourceEntityType:
      text(
        (raw as PatientCurrentLmsOfficialPdfDto).sourceEntityType ??
          (raw as Record<string, unknown>).sourceEntityType,
      ) || 'LmsReportOfficialPdfArtifact',
  };
}

export async function loadPatient360LmsOfficialPdfs(
  patientId: string,
): Promise<LmsOfficialPdfListResult> {
  try {
    const data = await listPatientCurrentLmsOfficialPdfs(patientId);
    const rows = data
      .map((item) => mapPatientCurrentLmsOfficialPdf(item))
      .filter((row): row is LmsOfficialPdfDocumentRow => row != null);
    return { state: 'ready', rows };
  } catch (error) {
    return { state: classifyReadError(error), rows: [] };
  }
}

export function lmsOfficialPdfUnauthorizedMessage(): string {
  return 'Enterprise LMS Official PDFs are not available to this sign-in.';
}

export function lmsOfficialPdfUnavailableMessage(): string {
  return 'Enterprise LMS Official PDFs are not available in Patient 360.';
}

/** Empty laboratory filter copy when Pathology + LMS both contribute no rows. */
export function laboratoryDocumentsCombinedEmpty(
  pathologyState: ReadState | undefined,
  lmsState: ReadState | undefined,
  pathologyCount: number,
  lmsCount: number,
): string | null {
  if (pathologyCount > 0 || lmsCount > 0) return null;
  if (pathologyState == null || lmsState == null) return 'Loading laboratory documents.';
  if (pathologyState === 'unauthorized' && lmsState === 'unauthorized') {
    return 'Laboratory reports are not available to this sign-in.';
  }
  if (pathologyState === 'unavailable' && lmsState === 'unavailable') {
    return 'Laboratory reports are not available in Patient 360.';
  }
  if (pathologyState === 'unauthorized' && lmsState === 'ready' && lmsCount === 0) {
    return 'Laboratory reports are not available to this sign-in.';
  }
  if (lmsState === 'unauthorized' && pathologyState === 'ready' && pathologyCount === 0) {
    return lmsOfficialPdfUnauthorizedMessage();
  }
  if (pathologyState === 'unavailable' && lmsState === 'ready' && lmsCount === 0) {
    return 'Laboratory reports are not available in Patient 360.';
  }
  if (lmsState === 'unavailable' && pathologyState === 'ready' && pathologyCount === 0) {
    return lmsOfficialPdfUnavailableMessage();
  }
  return 'No laboratory documents available.';
}

/**
 * When Pathology rows already populate Laboratory, LMS projection failures must still
 * surface honesty instead of looking like a successful empty LMS discovery.
 */
export function laboratoryLmsHonestyAlongsidePathology(
  lmsState: ReadState | undefined,
  canReadLms: boolean,
  pathologyCount: number,
  lmsCount: number,
): string | null {
  if (!canReadLms || pathologyCount === 0 || lmsCount > 0) return null;
  if (lmsState === 'unauthorized') return lmsOfficialPdfUnauthorizedMessage();
  if (lmsState === 'unavailable') return lmsOfficialPdfUnavailableMessage();
  return null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
