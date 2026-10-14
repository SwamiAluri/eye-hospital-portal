/**
 * Enterprise LMS Order Intake — LaboratoryApi client (L-ORD-01C).
 * Consumes existing /api/lms/orders* and orderables. No Pathology APIs.
 */
import { getLaboratoryApi, type LmsPagedResult } from '@/lib/api/laboratory-service.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';

export const LMS_ORDER_SOURCES = [
  'Clinician',
  'SelfRequested',
  'Referral',
  'Imported',
  'Integration',
] as const;

export const LMS_ORDER_PRIORITIES = ['Routine', 'Urgent', 'STAT'] as const;

export const LMS_ORDER_STATUSES = ['Draft', 'Submitted', 'Cancelled'] as const;

export type LmsOrderSource = (typeof LMS_ORDER_SOURCES)[number];
export type LmsOrderPriority = (typeof LMS_ORDER_PRIORITIES)[number];
export type LmsOrderStatus = (typeof LMS_ORDER_STATUSES)[number];

export type LmsOrderSelectionInput = {
  catalogueItemId: string;
  sortOrder?: number;
};

export type LmsCreateOrderDraftRequest = {
  patientId: string;
  visitId?: string | null;
  orderingProviderUserId: string;
  responsibleClinicianUserId: string;
  operatingBranchId: string;
  orderSource: string;
  priority: string;
  priorityReason?: string | null;
  clinicalIndication: string;
  notes?: string | null;
  selections: LmsOrderSelectionInput[];
  acknowledgementEvidence?: string | null;
  consentReference?: string | null;
  consentTemplateVersionRef?: string | null;
  payerContextRef?: string | null;
  authorizationReference?: string | null;
  financialDispositionRef?: string | null;
  serviceCatalogRef?: string | null;
  idempotencyKey?: string | null;
};

export type LmsUpdateOrderDraftRequest = {
  expectedRowVersion: number;
  patientId: string;
  visitId?: string | null;
  orderingProviderUserId: string;
  responsibleClinicianUserId: string;
  operatingBranchId: string;
  orderSource: string;
  priority: string;
  priorityReason?: string | null;
  clinicalIndication: string;
  notes?: string | null;
  selections: LmsOrderSelectionInput[];
  acknowledgementEvidence?: string | null;
  consentReference?: string | null;
  consentTemplateVersionRef?: string | null;
  payerContextRef?: string | null;
  authorizationReference?: string | null;
  financialDispositionRef?: string | null;
  serviceCatalogRef?: string | null;
};

export type LmsAmendOrderRequest = LmsUpdateOrderDraftRequest & {
  amendmentReason: string;
  idempotencyKey?: string | null;
};

export type LmsOrderSelectionDto = {
  id: string;
  catalogueItemId: string;
  catalogueVersionId?: string | null;
  catalogueType: string;
  sortOrder: number;
  displayNameSnapshot?: string | null;
  internalOrderCodeSnapshot?: string | null;
};

export type LmsOrderTestDto = {
  id: string;
  catalogueItemId: string;
  catalogueVersionId: string;
  catalogueVersionNumber: number;
  catalogueType: string;
  displayNameSnapshot: string;
  internalOrderCodeSnapshot: string;
  status: string;
  sortOrder: number;
  panelCatalogueItemId?: string | null;
  panelCatalogueVersionId?: string | null;
  panelSelectionId?: string | null;
};

export type LmsOrderVersionDto = {
  id: string;
  versionNumber: number;
  patientId: string;
  patientMrnSnapshot?: string | null;
  patientNameSnapshot?: string | null;
  patientDateOfBirthSnapshot?: string | null;
  visitId?: string | null;
  orderingProviderUserId: string;
  orderingProviderNameSnapshot?: string | null;
  responsibleClinicianUserId: string;
  responsibleClinicianNameSnapshot?: string | null;
  operatingBranchId: string;
  performingBranchId: string;
  orderSource: string;
  priority: string;
  priorityReason?: string | null;
  clinicalIndication: string;
  notes?: string | null;
  consentReference?: string | null;
  consentTemplateVersionRef?: string | null;
  acknowledgementEvidence?: string | null;
  payerContextRef?: string | null;
  authorizationReference?: string | null;
  financialDispositionRef?: string | null;
  serviceCatalogRef?: string | null;
  amendmentReason?: string | null;
  createdAt: string;
  createdBy: string;
  submittedAt?: string | null;
  submittedBy?: string | null;
  selections: LmsOrderSelectionDto[];
  tests: LmsOrderTestDto[];
};

export type LmsOrderDetailDto = {
  id: string;
  orderNumber: string;
  status: string;
  currentVersionNumber: number;
  operatingBranchId: string;
  rowVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  currentVersion?: LmsOrderVersionDto | null;
};

export type LmsOrderListItemDto = {
  id: string;
  orderNumber: string;
  status: string;
  patientId: string;
  patientNameSnapshot?: string | null;
  operatingBranchId: string;
  priority: string;
  createdAt: string;
  rowVersion: number;
};

export type LmsOrderListParams = {
  status?: string;
  patientId?: string;
  operatingBranchId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type LmsOrderableItemDto = {
  catalogueItemId: string;
  catalogueVersionId: string;
  versionNumber: number;
  catalogueType: string;
  internalOrderCode: string;
  displayName: string;
  synonyms?: string | null;
  discipline: string;
  classification: string;
  orderable: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  preparationInstruction?: string | null;
  specimenTypeRef?: string | null;
  expectedTatConfigRef?: string | null;
  referralPartnerRef?: string | null;
  serviceCatalogRef?: string | null;
  branchIds: string[];
  isTenantWide: boolean;
};

export type LmsOrderablesParams = {
  operatingBranchId: string;
  search?: string;
  catalogueType?: string;
  discipline?: string;
  classification?: string;
  page?: number;
  pageSize?: number;
};

export type LmsOrderApiError = {
  status: number;
  message: string;
  code?: string | null;
  isConcurrencyConflict: boolean;
  isIdempotencyConflict: boolean;
  isAuditUnavailable: boolean;
  isPermissionDenied: boolean;
  isNotFound: boolean;
};

const orderRequestConfig = { skipForbiddenRedirect: true } as never;

export function newLmsIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseLmsOrderApiError(error: unknown, fallback = 'Request failed'): LmsOrderApiError {
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
    isIdempotencyConflict: status === 409 && (code === 'idempotency_conflict' || code === 'idempotency_in_progress'),
    isAuditUnavailable: status === 503 && (code === 'audit_unavailable' || /audit/i.test(message)),
    isPermissionDenied: status === 403,
    isNotFound: status === 404,
  };
}

export function priorityRequiresReason(priority: string): boolean {
  return priority === 'Urgent' || priority === 'STAT';
}

export function validateOrderComposerClient(input: {
  patientId?: string | null;
  orderingProviderUserId?: string | null;
  responsibleClinicianUserId?: string | null;
  operatingBranchId?: string | null;
  orderSource?: string | null;
  priority?: string | null;
  priorityReason?: string | null;
  clinicalIndication?: string | null;
  acknowledgementEvidence?: string | null;
  selections?: LmsOrderSelectionInput[] | null;
}): string | null {
  if (!input.patientId) return 'Select a patient.';
  if (!input.orderingProviderUserId) return 'Select an ordering provider.';
  if (!input.responsibleClinicianUserId) return 'Select a responsible clinician.';
  if (!input.operatingBranchId) return 'Operating branch is required.';
  if (!input.orderSource || !(LMS_ORDER_SOURCES as readonly string[]).includes(input.orderSource)) {
    return 'Select a valid order source.';
  }
  if (!input.priority || !(LMS_ORDER_PRIORITIES as readonly string[]).includes(input.priority)) {
    return 'Select a valid priority.';
  }
  if (priorityRequiresReason(input.priority) && !input.priorityReason?.trim()) {
    return 'Priority reason is required for Urgent and STAT.';
  }
  if (!input.clinicalIndication?.trim()) return 'Clinical indication is required.';
  if (input.orderSource === 'SelfRequested' && !input.acknowledgementEvidence?.trim()) {
    return 'Acknowledgement evidence is required for SelfRequested orders.';
  }
  if (!input.selections?.length) return 'Add at least one test or panel.';
  return null;
}

export async function listLmsOrders(
  params: LmsOrderListParams = {},
): Promise<LmsPagedResult<LmsOrderListItemDto>> {
  const { data } = await getLaboratoryApi().get<LmsPagedResult<LmsOrderListItemDto>>('/lms/orders', {
    params,
    ...orderRequestConfig,
  });
  return data;
}

export async function getLmsOrder(id: string): Promise<LmsOrderDetailDto> {
  const { data } = await getLaboratoryApi().get<LmsOrderDetailDto>(`/lms/orders/${id}`, orderRequestConfig);
  return data;
}

export async function getLmsOrderVersions(id: string): Promise<LmsOrderVersionDto[]> {
  const { data } = await getLaboratoryApi().get<LmsOrderVersionDto[]>(
    `/lms/orders/${id}/versions`,
    orderRequestConfig,
  );
  return data;
}

export async function createLmsOrderDraft(
  body: LmsCreateOrderDraftRequest,
): Promise<LmsOrderDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsOrderDetailDto>('/lms/orders', body, orderRequestConfig);
  return data;
}

export async function updateLmsOrderDraft(
  id: string,
  body: LmsUpdateOrderDraftRequest,
): Promise<LmsOrderDetailDto> {
  const { data } = await getLaboratoryApi().put<LmsOrderDetailDto>(
    `/lms/orders/${id}/draft`,
    body,
    orderRequestConfig,
  );
  return data;
}

export async function submitLmsOrder(
  id: string,
  expectedRowVersion: number,
  idempotencyKey: string,
): Promise<LmsOrderDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsOrderDetailDto>(
    `/lms/orders/${id}/submit`,
    { expectedRowVersion, idempotencyKey },
    orderRequestConfig,
  );
  return data;
}

export async function amendLmsOrder(id: string, body: LmsAmendOrderRequest): Promise<LmsOrderDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsOrderDetailDto>(
    `/lms/orders/${id}/amend`,
    body,
    orderRequestConfig,
  );
  return data;
}

export async function cancelLmsOrder(
  id: string,
  expectedRowVersion: number,
  reason: string,
  idempotencyKey: string,
): Promise<LmsOrderDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsOrderDetailDto>(
    `/lms/orders/${id}/cancel`,
    { expectedRowVersion, reason, idempotencyKey },
    orderRequestConfig,
  );
  return data;
}

export async function listLmsOrderables(
  params: LmsOrderablesParams,
): Promise<LmsPagedResult<LmsOrderableItemDto>> {
  const { data } = await getLaboratoryApi().get<LmsPagedResult<LmsOrderableItemDto>>(
    '/lms/catalogue/orderables',
    {
      params: {
        operatingBranchId: params.operatingBranchId,
        search: params.search,
        catalogueType: params.catalogueType,
        discipline: params.discipline,
        classification: params.classification,
        page: params.page,
        pageSize: params.pageSize,
      },
      ...orderRequestConfig,
    },
  );
  return data;
}
