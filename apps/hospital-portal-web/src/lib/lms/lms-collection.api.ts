/**
 * Enterprise LMS CollectionTask — LaboratoryApi client (L-COL-01B).
 * No Specimen / Receiving / Pathology APIs.
 */
import { getLaboratoryApi, type LmsPagedResult } from '@/lib/api/laboratory-service.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { newLmsIdempotencyKey } from '@/lib/lms/lms-orders.api';

export const LMS_COLLECTION_TASK_STATUSES = [
  'Planned',
  'Ready',
  'InProgress',
  'Completed',
  'Cancelled',
] as const;

export type LmsCollectionTaskStatus = (typeof LMS_COLLECTION_TASK_STATUSES)[number];

export type LmsCollectionTaskOrderTestDto = {
  id: string;
  orderTestId: string;
  orderId: string;
  sortOrder: number;
  displayNameSnapshot?: string | null;
  internalOrderCodeSnapshot?: string | null;
  orderTestStatus?: string | null;
};

export type LmsCollectionTaskListItemDto = {
  id: string;
  taskNumber: string;
  orderId: string;
  orderNumber: string;
  collectionBranchId: string;
  status: string;
  claimedByUserId?: string | null;
  assignedToUserId?: string | null;
  patientNameSnapshot?: string | null;
  patientMrnSnapshot?: string | null;
  orderTestCount: number;
  createdAt: string;
  rowVersion: number;
};

export type LmsCollectionTaskDetailDto = {
  id: string;
  taskNumber: string;
  orderId: string;
  orderNumber: string;
  collectionBranchId: string;
  locationText?: string | null;
  status: string;
  claimedByUserId?: string | null;
  claimedAt?: string | null;
  assignedToUserId?: string | null;
  assignedAt?: string | null;
  notes?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  rowVersion: number;
  patientNameSnapshot?: string | null;
  patientMrnSnapshot?: string | null;
  patientDateOfBirthSnapshot?: string | null;
  patientId?: string | null;
  visitId?: string | null;
  orderTests: LmsCollectionTaskOrderTestDto[];
};

export type LmsCollectionPlanContextOrderTestDto = {
  orderTestId: string;
  displayNameSnapshot: string;
  internalOrderCodeSnapshot: string;
  status: string;
  sortOrder: number;
  alreadyPlanned: boolean;
};

export type LmsCollectionPlanContextDto = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  operatingBranchId: string;
  patientId: string;
  patientMrnSnapshot?: string | null;
  patientNameSnapshot?: string | null;
  visitId?: string | null;
  orderTests: LmsCollectionPlanContextOrderTestDto[];
};

export type LmsCreateCollectionTaskRequest = {
  orderId: string;
  collectionBranchId: string;
  orderTestIds: string[];
  locationText?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
};

export type LmsCollectionTaskListParams = {
  status?: string;
  collectionBranchId?: string;
  orderId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type LmsCollectionApiError = {
  status: number;
  message: string;
  code?: string | null;
  isConcurrencyConflict: boolean;
  isIdempotencyConflict: boolean;
  isAuditUnavailable: boolean;
  isPermissionDenied: boolean;
  isNotFound: boolean;
};

const cfg = { skipForbiddenRedirect: true } as never;

export { newLmsIdempotencyKey };

export function parseLmsCollectionApiError(
  error: unknown,
  fallback = 'Request failed',
): LmsCollectionApiError {
  const ax = error as {
    response?: { status?: number; data?: { error?: string; message?: string; code?: string } };
    code?: string;
    message?: string;
  };
  const status = ax.response?.status ?? 0;
  const code = ax.response?.data?.code ?? null;
  const message =
    ax.response?.data?.error ??
    ax.response?.data?.message ??
    (status === 0 || ax.code === 'ECONNABORTED' || ax.code === 'ERR_NETWORK'
      ? 'Network unavailable. Check connection and retry.'
      : getApiErrorMessage(error, fallback));

  return {
    status,
    message,
    code,
    isConcurrencyConflict: status === 409 && code === 'concurrency_conflict',
    isIdempotencyConflict:
      status === 409 && (code === 'idempotency_conflict' || code === 'idempotency_in_progress'),
    isAuditUnavailable: status === 503 && (code === 'audit_unavailable' || /audit/i.test(message)),
    isPermissionDenied: status === 403,
    isNotFound: status === 404,
  };
}

export async function listLmsCollectionTasks(
  params: LmsCollectionTaskListParams = {},
): Promise<LmsPagedResult<LmsCollectionTaskListItemDto>> {
  const { data } = await getLaboratoryApi().get<LmsPagedResult<LmsCollectionTaskListItemDto>>(
    '/lms/collection/tasks',
    { params, ...cfg },
  );
  return data;
}

export async function getLmsCollectionTask(id: string): Promise<LmsCollectionTaskDetailDto> {
  const { data } = await getLaboratoryApi().get<LmsCollectionTaskDetailDto>(
    `/lms/collection/tasks/${id}`,
    cfg,
  );
  return data;
}

export async function getLmsCollectionPlanContext(
  orderId: string,
): Promise<LmsCollectionPlanContextDto> {
  const { data } = await getLaboratoryApi().get<LmsCollectionPlanContextDto>(
    `/lms/collection/orders/${orderId}/plan-context`,
    cfg,
  );
  return data;
}

export async function createLmsCollectionTask(
  body: LmsCreateCollectionTaskRequest,
): Promise<LmsCollectionTaskDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCollectionTaskDetailDto>(
    '/lms/collection/tasks',
    body,
    cfg,
  );
  return data;
}

export async function transitionLmsCollectionTask(
  id: string,
  expectedRowVersion: number,
  targetStatus: string,
  reason?: string | null,
  idempotencyKey?: string,
): Promise<LmsCollectionTaskDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCollectionTaskDetailDto>(
    `/lms/collection/tasks/${id}/transition`,
    { expectedRowVersion, targetStatus, reason, idempotencyKey },
    cfg,
  );
  return data;
}

export async function claimLmsCollectionTask(
  id: string,
  expectedRowVersion: number,
  idempotencyKey?: string,
): Promise<LmsCollectionTaskDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCollectionTaskDetailDto>(
    `/lms/collection/tasks/${id}/claim`,
    { expectedRowVersion, idempotencyKey },
    cfg,
  );
  return data;
}

export async function assignLmsCollectionTask(
  id: string,
  expectedRowVersion: number,
  assignToUserId: string,
  idempotencyKey?: string,
): Promise<LmsCollectionTaskDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCollectionTaskDetailDto>(
    `/lms/collection/tasks/${id}/assign`,
    { expectedRowVersion, assignToUserId, idempotencyKey },
    cfg,
  );
  return data;
}

export async function releaseLmsCollectionTask(
  id: string,
  expectedRowVersion: number,
  idempotencyKey?: string,
): Promise<LmsCollectionTaskDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCollectionTaskDetailDto>(
    `/lms/collection/tasks/${id}/release`,
    { expectedRowVersion, idempotencyKey },
    cfg,
  );
  return data;
}
