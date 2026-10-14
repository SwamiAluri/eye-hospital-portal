/**
 * Enterprise LMS Testing — LaboratoryApi client (L-TST-01A + L-VER-01 + L-AUTH-01 + L-CRT-01).
 * Manual Result Draft + Technical Verification + Clinical Authorization + Critical events.
 * No Pathology / Final / Released / Reporting / automated thresholds.
 */
import { getLaboratoryApi } from '@/lib/api/laboratory-service.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { newLmsIdempotencyKey } from '@/lib/lms/lms-orders.api';

export type LmsTestingWorkQueueItemDto = {
  orderTestId: string;
  orderId: string;
  orderNumber: string;
  priority?: string | null;
  patientId: string;
  patientMrn?: string | null;
  patientName?: string | null;
  specimenId: string;
  specimenStatus: string;
  accession?: string | null;
  barcodeValue?: string | null;
  receivingBranchId?: string | null;
  collectionBranchId?: string | null;
  receivedAtUtc?: string | null;
  collectedAtUtc?: string | null;
  catalogueItemId: string;
  catalogueVersionId: string;
  catalogueType: string;
  testDisplayName: string;
  internalOrderCode: string;
  resultDatatype?: string | null;
  permittedUnits?: string | null;
  resultId?: string | null;
  resultStatus?: string | null;
  resultRowVersion?: number | null;
  draftUpdatedAtUtc?: string | null;
};

export type LmsTestingWorkQueuePageDto = {
  items: LmsTestingWorkQueueItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type LmsResultDraftDto = {
  id: string;
  orderTestId: string;
  specimenId: string;
  orderId: string;
  operatingBranchId: string;
  status: string;
  resultDatatype: string;
  numericValue?: string | null;
  qualitativeValue?: string | null;
  unit?: string | null;
  comment?: string | null;
  currentVersionNumber: number;
  createdAtUtc: string;
  createdByUserId: string;
  updatedAtUtc: string;
  updatedByUserId: string;
  rowVersion: number;
  verifiedByUserId?: string | null;
  verifiedAtUtc?: string | null;
  verifiedVersionNumber?: number | null;
  authorizedByUserId?: string | null;
  authorizedAtUtc?: string | null;
  authorizedVersionNumber?: number | null;
};

export type LmsTestingWorkItemDetailDto = {
  orderTestId: string;
  orderId: string;
  orderNumber: string;
  priority?: string | null;
  patientId: string;
  patientMrn?: string | null;
  patientName?: string | null;
  patientDateOfBirth?: string | null;
  specimenId: string;
  specimenStatus: string;
  accession?: string | null;
  barcodeValue?: string | null;
  receivingBranchId?: string | null;
  collectionBranchId?: string | null;
  receivedAtUtc?: string | null;
  collectedAtUtc?: string | null;
  catalogueItemId: string;
  catalogueVersionId: string;
  catalogueType: string;
  classification: string;
  testDisplayName: string;
  internalOrderCode: string;
  resultDatatype?: string | null;
  permittedUnits?: string | null;
  draft?: LmsResultDraftDto | null;
};

export type LmsTestingApiError = {
  status: number;
  message: string;
  code?: string | null;
  isConcurrencyConflict: boolean;
  isIdempotencyConflict: boolean;
  isAuditUnavailable: boolean;
  isPermissionDenied: boolean;
  isNotFound: boolean;
  isUnsupportedDatatype: boolean;
  isIneligible: boolean;
  isAlreadyVerified: boolean;
  isAlreadyAuthorized: boolean;
  isAlreadyCritical: boolean;
  isAlreadyAcknowledged: boolean;
  isInvalidState: boolean;
  isNotificationUnavailable: boolean;
};

const cfg = { skipForbiddenRedirect: true } as never;

export { newLmsIdempotencyKey };

export function parseLmsTestingApiError(
  error: unknown,
  fallback = 'Testing request failed.',
): LmsTestingApiError {
  const status =
    typeof error === 'object' && error && 'response' in error
      ? Number((error as { response?: { status?: number } }).response?.status) || 0
      : 0;
  const data =
    typeof error === 'object' && error && 'response' in error
      ? ((error as { response?: { data?: { code?: string; message?: string; error?: string } } })
          .response?.data ?? null)
      : null;
  const code = data?.code ?? null;
  const message = getApiErrorMessage(error, data?.message || data?.error || fallback);
  return {
    status,
    message,
    code,
    isConcurrencyConflict: status === 409 && code === 'concurrency_conflict',
    isIdempotencyConflict: status === 409 && code === 'idempotency_conflict',
    isAuditUnavailable: status === 503 || code === 'audit_unavailable',
    isPermissionDenied: status === 403,
    isNotFound: status === 404,
    isUnsupportedDatatype: code === 'unsupported_datatype',
    isIneligible:
      code === 'not_eligible' ||
      code === 'specimen_rejected' ||
      code === 'specimen_not_received' ||
      code === 'order_not_submitted',
    isAlreadyVerified: status === 409 && code === 'already_verified',
    isAlreadyAuthorized: status === 409 && code === 'already_authorized',
    isAlreadyCritical: status === 409 && code === 'already_critical',
    isAlreadyAcknowledged: status === 409 && code === 'already_acknowledged',
    isInvalidState: status === 409 && code === 'invalid_state',
    isNotificationUnavailable: status === 503 || code === 'notification_unavailable',
  };
}

export type LmsCriticalEventDto = {
  id: string;
  resultId: string;
  resultVersionNumber: number;
  operatingBranchId: string;
  status: string;
  resultStatus: string;
  classifiedByUserId: string;
  classifiedAtUtc: string;
  acknowledgedByUserId?: string | null;
  acknowledgedAtUtc?: string | null;
  acknowledgementEvidence?: string | null;
  notificationIntentStatus: string;
  notificationIntentDetail?: string | null;
  rowVersion: number;
  orderId: string;
  orderNumber?: string | null;
  orderTestId: string;
  specimenId: string;
  patientId: string;
  patientMrn?: string | null;
  patientName?: string | null;
  testDisplayName?: string | null;
  internalOrderCode?: string | null;
};

export type LmsCriticalWorkQueueItemDto = {
  criticalEventId: string;
  resultId: string;
  resultVersionNumber: number;
  criticalStatus: string;
  resultStatus: string;
  operatingBranchId: string;
  classifiedAtUtc: string;
  classifiedByUserId: string;
  acknowledgedAtUtc?: string | null;
  acknowledgedByUserId?: string | null;
  notificationIntentStatus: string;
  orderId: string;
  orderNumber: string;
  orderTestId: string;
  specimenId: string;
  patientId: string;
  patientMrn?: string | null;
  patientName?: string | null;
  testDisplayName: string;
  internalOrderCode: string;
  rowVersion: number;
};

export type LmsCriticalWorkQueuePageDto = {
  items: LmsCriticalWorkQueueItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export async function listLmsTestingWorkQueue(params: {
  operatingBranchId: string;
  search?: string;
  priority?: string;
  hasDraft?: boolean;
  resultStatus?: string;
  page?: number;
  pageSize?: number;
}): Promise<LmsTestingWorkQueuePageDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsTestingWorkQueuePageDto>('/lms/testing/work-queue', {
    params: {
      operatingBranchId: params.operatingBranchId,
      search: params.search,
      priority: params.priority,
      hasDraft: params.hasDraft,
      resultStatus: params.resultStatus,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
    ...cfg,
  });
  return data;
}

export async function getLmsTestingWorkItem(params: {
  orderTestId: string;
  specimenId: string;
  operatingBranchId: string;
}): Promise<LmsTestingWorkItemDetailDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsTestingWorkItemDetailDto>('/lms/testing/work-items', {
    params,
    ...cfg,
  });
  return data;
}

export async function createLmsResultDraft(body: {
  orderTestId: string;
  specimenId: string;
  operatingBranchId: string;
  numericValue?: string | null;
  qualitativeValue?: string | null;
  unit?: string | null;
  comment?: string | null;
  idempotencyKey?: string;
}): Promise<LmsResultDraftDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey ?? newLmsIdempotencyKey();
  const { data } = await api.post<LmsResultDraftDto>(
    '/lms/testing/results',
    {
      orderTestId: body.orderTestId,
      specimenId: body.specimenId,
      operatingBranchId: body.operatingBranchId,
      numericValue: body.numericValue,
      qualitativeValue: body.qualitativeValue,
      unit: body.unit,
      comment: body.comment,
      idempotencyKey: key,
    },
    {
      headers: { 'Idempotency-Key': key },
      ...cfg,
    },
  );
  return data;
}

export async function updateLmsResultDraft(
  resultId: string,
  body: {
    operatingBranchId: string;
    expectedRowVersion: number;
    numericValue?: string | null;
    qualitativeValue?: string | null;
    unit?: string | null;
    comment?: string | null;
    idempotencyKey?: string;
  },
): Promise<LmsResultDraftDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey ?? newLmsIdempotencyKey();
  const { data } = await api.put<LmsResultDraftDto>(
    `/lms/testing/results/${resultId}`,
    {
      operatingBranchId: body.operatingBranchId,
      expectedRowVersion: body.expectedRowVersion,
      numericValue: body.numericValue,
      qualitativeValue: body.qualitativeValue,
      unit: body.unit,
      comment: body.comment,
      idempotencyKey: key,
    },
    {
      headers: { 'Idempotency-Key': key },
      ...cfg,
    },
  );
  return data;
}

export async function verifyLmsResult(
  resultId: string,
  body: {
    operatingBranchId: string;
    expectedRowVersion: number;
    expectedCurrentVersionNumber?: number | null;
    idempotencyKey?: string;
  },
): Promise<LmsResultDraftDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey ?? newLmsIdempotencyKey();
  const { data } = await api.post<LmsResultDraftDto>(
    `/lms/testing/results/${resultId}/verify`,
    {
      operatingBranchId: body.operatingBranchId,
      expectedRowVersion: body.expectedRowVersion,
      expectedCurrentVersionNumber: body.expectedCurrentVersionNumber,
      idempotencyKey: key,
    },
    {
      headers: { 'Idempotency-Key': key },
      ...cfg,
    },
  );
  return data;
}

export async function authorizeLmsResult(
  resultId: string,
  body: {
    operatingBranchId: string;
    expectedRowVersion: number;
    expectedCurrentVersionNumber?: number | null;
    idempotencyKey?: string;
  },
): Promise<LmsResultDraftDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey ?? newLmsIdempotencyKey();
  const { data } = await api.post<LmsResultDraftDto>(
    `/lms/testing/results/${resultId}/authorize`,
    {
      operatingBranchId: body.operatingBranchId,
      expectedRowVersion: body.expectedRowVersion,
      expectedCurrentVersionNumber: body.expectedCurrentVersionNumber,
      idempotencyKey: key,
    },
    {
      headers: { 'Idempotency-Key': key },
      ...cfg,
    },
  );
  return data;
}

export async function listLmsCriticalWorkQueue(params: {
  operatingBranchId: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<LmsCriticalWorkQueuePageDto> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsCriticalWorkQueuePageDto>('/lms/testing/critical-work-queue', {
    params: {
      operatingBranchId: params.operatingBranchId,
      status: params.status || undefined,
      search: params.search || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
    ...cfg,
  });
  return data;
}

export async function listLmsCriticalEventsForResult(
  resultId: string,
  operatingBranchId: string,
): Promise<LmsCriticalEventDto[]> {
  const api = getLaboratoryApi();
  const { data } = await api.get<LmsCriticalEventDto[]>(`/lms/testing/results/${resultId}/critical`, {
    params: { operatingBranchId },
    ...cfg,
  });
  return data;
}

export async function createLmsCriticalEvent(
  resultId: string,
  body: {
    operatingBranchId: string;
    expectedResultVersionNumber?: number | null;
    idempotencyKey?: string;
  },
): Promise<LmsCriticalEventDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey ?? newLmsIdempotencyKey();
  const { data } = await api.post<LmsCriticalEventDto>(
    `/lms/testing/results/${resultId}/critical`,
    {
      operatingBranchId: body.operatingBranchId,
      expectedResultVersionNumber: body.expectedResultVersionNumber,
      idempotencyKey: key,
    },
    {
      headers: { 'Idempotency-Key': key },
      ...cfg,
    },
  );
  return data;
}

export async function acknowledgeLmsCriticalEvent(
  resultId: string,
  criticalEventId: string,
  body: {
    operatingBranchId: string;
    expectedRowVersion: number;
    acknowledgementEvidence: string;
    idempotencyKey?: string;
  },
): Promise<LmsCriticalEventDto> {
  const api = getLaboratoryApi();
  const key = body.idempotencyKey ?? newLmsIdempotencyKey();
  const { data } = await api.post<LmsCriticalEventDto>(
    `/lms/testing/results/${resultId}/critical/${criticalEventId}/acknowledge`,
    {
      operatingBranchId: body.operatingBranchId,
      expectedRowVersion: body.expectedRowVersion,
      acknowledgementEvidence: body.acknowledgementEvidence,
      idempotencyKey: key,
    },
    {
      headers: { 'Idempotency-Key': key },
      ...cfg,
    },
  );
  return data;
}
