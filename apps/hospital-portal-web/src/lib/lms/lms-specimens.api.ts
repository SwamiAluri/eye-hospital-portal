/**
 * Enterprise LMS Specimen — LaboratoryApi client (L-COL-01C / L-COL-01D / L-COL-01E).
 * No Pathology APIs. No scanner / thermal / ZPL.
 */
import { getLaboratoryApi } from '@/lib/api/laboratory-service.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { newLmsIdempotencyKey } from '@/lib/lms/lms-orders.api';

export type LmsSpecimenOrderTestDto = {
  id: string;
  orderTestId: string;
  orderId: string;
  sortOrder: number;
  displayNameSnapshot?: string | null;
  internalOrderCodeSnapshot?: string | null;
  orderTestStatus?: string | null;
};

export type LmsSpecimenDetailDto = {
  id: string;
  status: string;
  collectionTaskId: string;
  collectionTaskNumber?: string | null;
  orderId: string;
  orderNumber: string;
  patientId: string;
  patientMrnSnapshot?: string | null;
  patientNameSnapshot?: string | null;
  patientDateOfBirthSnapshot?: string | null;
  collectionBranchId: string;
  locationText?: string | null;
  collectedByUserId: string;
  collectedAt: string;
  accession?: string | null;
  barcodeValue?: string | null;
  barcodeId?: string | null;
  receivedAtUtc?: string | null;
  receivedByUserId?: string | null;
  receivingBranchId?: string | null;
  receivingLocationText?: string | null;
  rejectionReasonCode?: string | null;
  rejectionReasonLabelSnapshot?: string | null;
  rejectedAtUtc?: string | null;
  rejectedByUserId?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  rowVersion: number;
  orderTests: LmsSpecimenOrderTestDto[];
};

export type LmsSpecimenListItemDto = {
  id: string;
  accession?: string | null;
  barcodeValue?: string | null;
  status: string;
  patientMrnSnapshot?: string | null;
  patientNameSnapshot?: string | null;
  orderId: string;
  orderNumber: string;
  collectedAt: string;
  collectionBranchId: string;
  receivingBranchId?: string | null;
  rowVersion: number;
};

export type LmsSpecimenListResult = {
  items: LmsSpecimenListItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type LmsSpecimenRejectionReasonDto = {
  code: string;
  label: string;
  sortOrder: number;
};

export type LmsSpecimenApiError = {
  status: number;
  message: string;
  code?: string | null;
  isConcurrencyConflict: boolean;
  isIdempotencyConflict: boolean;
  isAlreadyExists: boolean;
  isAuditUnavailable: boolean;
  isPermissionDenied: boolean;
  isNotFound: boolean;
  isInvalidState: boolean;
  isConfigurationFailure: boolean;
};

const cfg = { skipForbiddenRedirect: true } as never;

export { newLmsIdempotencyKey };

export function parseLmsSpecimenApiError(
  error: unknown,
  fallback = 'Request failed',
): LmsSpecimenApiError {
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
    isAlreadyExists: status === 409 && code === 'specimen_already_exists',
    isAuditUnavailable: status === 503 && (code === 'audit_unavailable' || /audit/i.test(message)),
    isPermissionDenied: status === 403,
    isNotFound: status === 404,
    isInvalidState: code === 'invalid_state',
    isConfigurationFailure:
      status === 503 &&
      (code === 'barcode_configuration_missing' ||
        code === 'barcode_configuration_invalid' ||
        code === 'barcode_configuration_ambiguous' ||
        /barcode configuration/i.test(message)),
  };
}

export type LmsSpecimenBarcodeDto = {
  id: string;
  specimenId: string;
  barcodeValue: string;
  formatCode: string;
  symbology: string;
  issuedAtUtc: string;
  issuedByUserId: string;
  isActive: boolean;
  specimenRowVersion: number;
};

export type LmsSpecimenLabelPayloadDto = {
  specimenId: string;
  barcodeId: string;
  barcodeValue: string;
  symbology: string;
  patientMrn: string;
  patientName: string;
  orderNumber: string;
  collectedAtUtc: string;
  accession?: string | null;
  specimenType?: string | null;
  branchName?: string | null;
  printEventId: string;
  printType: string;
  printedAtUtc: string;
  specimenRowVersion: number;
};

export async function listLmsSpecimens(params: {
  status?: string;
  collectionBranchId?: string;
  receivingBranchId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<LmsSpecimenListResult> {
  const { data } = await getLaboratoryApi().get<LmsSpecimenListResult>('/lms/specimens', {
    ...cfg,
    params: {
      status: params.status || undefined,
      collectionBranchId: params.collectionBranchId || undefined,
      receivingBranchId: params.receivingBranchId || undefined,
      search: params.search || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
  });
  return data;
}

export async function listLmsSpecimenRejectionReasons(): Promise<LmsSpecimenRejectionReasonDto[]> {
  const { data } = await getLaboratoryApi().get<LmsSpecimenRejectionReasonDto[]>(
    '/lms/specimens/rejection-reasons',
    cfg,
  );
  return data;
}

export async function getLmsSpecimen(id: string): Promise<LmsSpecimenDetailDto> {
  const { data } = await getLaboratoryApi().get<LmsSpecimenDetailDto>(
    `/lms/specimens/${id}`,
    cfg,
  );
  return data;
}

export async function getLmsSpecimenByCollectionTask(
  collectionTaskId: string,
): Promise<LmsSpecimenDetailDto | null> {
  try {
    const { data } = await getLaboratoryApi().get<LmsSpecimenDetailDto>(
      `/lms/specimens/by-collection-task/${collectionTaskId}`,
      cfg,
    );
    return data;
  } catch (e) {
    const err = parseLmsSpecimenApiError(e);
    if (err.isNotFound) return null;
    throw e;
  }
}

export async function completeLmsCollection(
  collectionTaskId: string,
  expectedCollectionTaskRowVersion: number,
  patientIdentityConfirmed: boolean,
  idempotencyKey?: string,
): Promise<LmsSpecimenDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsSpecimenDetailDto>(
    `/lms/collection/tasks/${collectionTaskId}/complete-collection`,
    {
      expectedCollectionTaskRowVersion,
      patientIdentityConfirmed,
      idempotencyKey,
    },
    cfg,
  );
  return data;
}

export async function receiveLmsSpecimen(
  specimenId: string,
  body: {
    expectedRowVersion: number;
    receivingBranchId: string;
    patientIdentityConfirmed: boolean;
    confirmedMrn: string;
    confirmedPatientName: string;
    confirmedDateOfBirth: string;
    receivingLocationText?: string | null;
    idempotencyKey?: string;
  },
): Promise<LmsSpecimenDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsSpecimenDetailDto>(
    `/lms/specimens/${specimenId}/receive`,
    body,
    cfg,
  );
  return data;
}

export async function rejectLmsSpecimen(
  specimenId: string,
  body: {
    expectedRowVersion: number;
    operatingBranchId: string;
    rejectionReasonCode: string;
    patientIdentityConfirmed: boolean;
    confirmedMrn: string;
    confirmedPatientName: string;
    confirmedDateOfBirth: string;
    idempotencyKey?: string;
  },
): Promise<LmsSpecimenDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsSpecimenDetailDto>(
    `/lms/specimens/${specimenId}/reject`,
    body,
    cfg,
  );
  return data;
}

export async function getLmsSpecimenBarcode(
  specimenId: string,
): Promise<LmsSpecimenBarcodeDto | null> {
  try {
    const { data } = await getLaboratoryApi().get<LmsSpecimenBarcodeDto>(
      `/lms/specimens/${specimenId}/barcode`,
      cfg,
    );
    return data;
  } catch (e) {
    const err = parseLmsSpecimenApiError(e);
    if (err.isNotFound) return null;
    throw e;
  }
}

export async function assignLmsSpecimenBarcode(
  specimenId: string,
  body: {
    expectedRowVersion: number;
    operatingBranchId: string;
    idempotencyKey?: string;
  },
): Promise<LmsSpecimenBarcodeDto> {
  const { data } = await getLaboratoryApi().post<LmsSpecimenBarcodeDto>(
    `/lms/specimens/${specimenId}/barcode`,
    body,
    cfg,
  );
  return data;
}

export async function printLmsSpecimenLabel(
  specimenId: string,
  body: {
    expectedRowVersion: number;
    operatingBranchId: string;
    idempotencyKey?: string;
  },
): Promise<LmsSpecimenLabelPayloadDto> {
  const { data } = await getLaboratoryApi().post<LmsSpecimenLabelPayloadDto>(
    `/lms/specimens/${specimenId}/label/print`,
    body,
    cfg,
  );
  return data;
}

export async function reprintLmsSpecimenLabel(
  specimenId: string,
  body: {
    expectedRowVersion: number;
    operatingBranchId: string;
    reason: string;
    idempotencyKey?: string;
  },
): Promise<LmsSpecimenLabelPayloadDto> {
  const { data } = await getLaboratoryApi().post<LmsSpecimenLabelPayloadDto>(
    `/lms/specimens/${specimenId}/label/reprint`,
    body,
    cfg,
  );
  return data;
}
