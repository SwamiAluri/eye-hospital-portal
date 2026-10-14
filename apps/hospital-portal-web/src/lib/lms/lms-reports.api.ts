/**
 * Enterprise LMS Reports — LaboratoryApi client.
 * Draft + Finalize + Release + Assign Report Number (L-REP-03 CUT A)
 * + Official PDF generate/status (L-REP-03 CUT B)
 * + Official PDF staff download (L-REP-03 CUT C).
 * No Pathology dual-write / patient publication.
 */
import { getLaboratoryApi } from '@/lib/api/laboratory-service.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { newLmsIdempotencyKey } from '@/lib/lms/lms-orders.api';

export type LmsReportSourceSnapshotDto = {
  id: string;
  resultId: string;
  resultVersionId: string;
  resultVersionNumber: number;
  orderTestId: string;
  specimenId: string;
  catalogueItemId: string;
  catalogueVersionId: string;
  resultDatatype: string;
  numericValue?: string | null;
  qualitativeValue?: string | null;
  unit?: string | null;
  comment?: string | null;
  resultStatusAtSnapshot: string;
  authorizedByUserId?: string | null;
  authorizedAtUtc?: string | null;
};

export type LmsReportVersionDto = {
  id: string;
  reportId: string;
  versionNumber: number;
  patientId: string;
  orderId: string;
  operatingBranchId: string;
  createdAtUtc: string;
  createdByUserId: string;
  sources: LmsReportSourceSnapshotDto[];
};

export type LmsOfficialPdfArtifactMetadataDto = {
  artifactId: string;
  artifactVersion: number;
  status: string;
  mimeType: string;
  sizeBytes: number;
  contentHash?: string | null;
  canonicalDocumentId?: string | null;
  templateVersionId: string;
  templateVersionNumber: number;
  templateCode: string;
  generatedByUserId: string;
  generatedAtUtc: string;
  failureCode?: string | null;
  failureMessage?: string | null;
};

export type LmsOfficialPdfJobDto = {
  jobId: string;
  reportId: string;
  status: string;
  requestedByUserId: string;
  requestedAtUtc: string;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  attemptCount: number;
  artifactId?: string | null;
  artifact?: LmsOfficialPdfArtifactMetadataDto | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

export type LmsOfficialPdfGenerationResponse = {
  reportId: string;
  reportStatus: string;
  businessReportNumber?: string | null;
  job: LmsOfficialPdfJobDto;
  replayed: boolean;
  existingActiveJob: boolean;
};

export type LmsReportDetailDto = {
  id: string;
  tenantId: string;
  operatingBranchId: string;
  patientId: string;
  orderId: string;
  orderNumber: string;
  status: string;
  currentVersionNumber: number;
  finalizedAtUtc?: string | null;
  finalizedByUserId?: string | null;
  releasedAtUtc?: string | null;
  releasedByUserId?: string | null;
  businessReportNumber?: string | null;
  businessReportNumberAssignedAtUtc?: string | null;
  businessReportNumberAssignedByUserId?: string | null;
  createdAtUtc: string;
  createdByUserId: string;
  updatedAtUtc: string;
  updatedByUserId: string;
  rowVersion: number;
  versions: LmsReportVersionDto[];
  currentOfficialArtifactId?: string | null;
  officialPdfJob?: LmsOfficialPdfJobDto | null;
  currentOfficialArtifact?: LmsOfficialPdfArtifactMetadataDto | null;
};

export type LmsReportListItemDto = {
  id: string;
  operatingBranchId: string;
  patientId: string;
  orderId: string;
  orderNumber: string;
  status: string;
  currentVersionNumber: number;
  finalizedAtUtc?: string | null;
  finalizedByUserId?: string | null;
  releasedAtUtc?: string | null;
  releasedByUserId?: string | null;
  businessReportNumber?: string | null;
  sourceCount: number;
  createdAtUtc: string;
  createdByUserId: string;
  rowVersion: number;
  /** Server-side Official PDF download eligibility (CUT C). Not a security gate. */
  officialPdfDownloadEligible?: boolean;
};

export type LmsReportListPageDto = {
  items: LmsReportListItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type LmsReportEligibleSourceDto = {
  resultId: string;
  authorizedVersionNumber: number;
  orderId: string;
  orderNumber: string;
  orderTestId: string;
  specimenId: string;
  patientId: string;
  patientMrn?: string | null;
  patientName?: string | null;
  testDisplayName: string;
  internalOrderCode: string;
  numericValue?: string | null;
  qualitativeValue?: string | null;
  unit?: string | null;
};

export type LmsReportEligibleSourcesPageDto = {
  items: LmsReportEligibleSourceDto[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type LmsReportsApiError = {
  message: string;
  code?: string;
  status?: number;
};

export function parseLmsReportsApiError(error: unknown, fallback: string): LmsReportsApiError {
  const message = getApiErrorMessage(error, fallback);
  const anyErr = error as { response?: { status?: number; data?: { code?: string } } };
  return {
    message,
    code: anyErr?.response?.data?.code,
    status: anyErr?.response?.status,
  };
}

export async function listLmsReportEligibleSources(params: {
  operatingBranchId: string;
  orderId?: string;
  page?: number;
  pageSize?: number;
}): Promise<LmsReportEligibleSourcesPageDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsReportEligibleSourcesPageDto>('/lms/reports/eligible-sources', {
    params: {
      operatingBranchId: params.operatingBranchId,
      orderId: params.orderId,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    },
  });
  return data;
}

export async function listLmsReports(params: {
  operatingBranchId: string;
  patientId?: string;
  orderId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<LmsReportListPageDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsReportListPageDto>('/lms/reports', {
    params: {
      operatingBranchId: params.operatingBranchId,
      patientId: params.patientId,
      orderId: params.orderId,
      status: params.status,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    },
  });
  return data;
}

export async function getLmsReport(
  reportId: string,
  operatingBranchId: string,
): Promise<LmsReportDetailDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsReportDetailDto>(`/lms/reports/${reportId}`, {
    params: { operatingBranchId },
  });
  return data;
}

export async function getLmsReportVersion(
  reportId: string,
  versionNumber: number,
  operatingBranchId: string,
): Promise<LmsReportVersionDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsReportVersionDto>(
    `/lms/reports/${reportId}/versions/${versionNumber}`,
    { params: { operatingBranchId } },
  );
  return data;
}

export async function createLmsReportDraft(body: {
  operatingBranchId: string;
  sources: Array<{ resultId: string; resultVersionNumber: number }>;
  idempotencyKey?: string;
}): Promise<LmsReportDetailDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey || newLmsIdempotencyKey();
  const { data } = await api.post<LmsReportDetailDto>(
    '/lms/reports',
    {
      operatingBranchId: body.operatingBranchId,
      idempotencyKey: key,
      sources: body.sources,
    },
    { headers: { 'Idempotency-Key': key } },
  );
  return data;
}

export async function finalizeLmsReport(body: {
  reportId: string;
  operatingBranchId: string;
  expectedRowVersion: number;
  idempotencyKey?: string;
}): Promise<LmsReportDetailDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey || newLmsIdempotencyKey();
  const { data } = await api.post<LmsReportDetailDto>(
    `/lms/reports/${body.reportId}/finalize`,
    {
      operatingBranchId: body.operatingBranchId,
      idempotencyKey: key,
      expectedRowVersion: body.expectedRowVersion,
    },
    { headers: { 'Idempotency-Key': key } },
  );
  return data;
}

export async function releaseLmsReport(body: {
  reportId: string;
  operatingBranchId: string;
  expectedRowVersion: number;
  idempotencyKey?: string;
}): Promise<LmsReportDetailDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey || newLmsIdempotencyKey();
  const { data } = await api.post<LmsReportDetailDto>(
    `/lms/reports/${body.reportId}/release`,
    {
      operatingBranchId: body.operatingBranchId,
      idempotencyKey: key,
      expectedRowVersion: body.expectedRowVersion,
    },
    { headers: { 'Idempotency-Key': key } },
  );
  return data;
}

export async function assignLmsReportNumber(body: {
  reportId: string;
  operatingBranchId: string;
  expectedRowVersion: number;
  idempotencyKey?: string;
}): Promise<LmsReportDetailDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey || newLmsIdempotencyKey();
  const { data } = await api.post<LmsReportDetailDto>(
    `/lms/reports/${body.reportId}/assign-number`,
    {
      operatingBranchId: body.operatingBranchId,
      idempotencyKey: key,
      expectedRowVersion: body.expectedRowVersion,
    },
    { headers: { 'Idempotency-Key': key } },
  );
  return data;
}

export async function generateLmsOfficialPdf(body: {
  reportId: string;
  operatingBranchId: string;
  idempotencyKey?: string;
}): Promise<LmsOfficialPdfGenerationResponse> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey || newLmsIdempotencyKey();
  const { data } = await api.post<LmsOfficialPdfGenerationResponse>(
    `/lms/reports/${body.reportId}/official-pdf/generate`,
    {
      operatingBranchId: body.operatingBranchId,
      idempotencyKey: key,
    },
    { headers: { 'Idempotency-Key': key } },
  );
  return data;
}

export async function getLmsOfficialPdfJob(params: {
  reportId: string;
  jobId: string;
  operatingBranchId: string;
}): Promise<LmsOfficialPdfJobDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsOfficialPdfJobDto>(
    `/lms/reports/${params.reportId}/official-pdf/jobs/${params.jobId}`,
    { params: { operatingBranchId: params.operatingBranchId } },
  );
  return data;
}

/** L-REP-03 CUT C — download current Official PDF as Blob (attachment). */
export async function downloadLmsOfficialPdf(params: {
  reportId: string;
  operatingBranchId: string;
}): Promise<Blob> {
  const api = getLaboratoryApi();
  const { data } = await api.get<Blob>(`/lms/reports/${params.reportId}/official-pdf`, {
    params: { operatingBranchId: params.operatingBranchId },
    responseType: 'blob',
  });
  return data;
}

/** L-REP-03 CUT D-B — patient-scoped current Official PDF discovery projection (Option B). */
export type PatientCurrentLmsOfficialPdfDto = {
  reportId: string;
  patientId: string;
  operatingBranchId: string;
  businessReportNumber: string;
  reportStatus: string;
  artifactId: string;
  artifactVersion: number;
  canonicalDocumentId: string;
  mimeType: string;
  sizeBytes: number;
  generatedAtUtc: string;
  sourceDomain: string;
  sourceEntityType: string;
};

export async function listPatientCurrentLmsOfficialPdfs(
  patientId: string,
): Promise<PatientCurrentLmsOfficialPdfDto[]> {
  const api = getLaboratoryApi();
  const { data } = await api.get<PatientCurrentLmsOfficialPdfDto[]>(
    `/lms/patients/${patientId}/current-official-pdfs`,
  );
  return Array.isArray(data) ? data : [];
}

export { newLmsIdempotencyKey };
