// CCMS – Pre-Authorization API client
import { getCcmsApi } from './ccms-base';

// ── Normalized frontend shape (mapped from CcmsCoverageAuthorization) ─────────

export interface PreAuthorization {
  id: string;
  caseId: string;
  authorizationType: string;
  preAuthNumber: string | null;
  status: string;         // derived: PENDING | SENT | APPROVED | PARTIAL | REJECTED | CLARIFICATION
  requestedAmount: number;
  approvedAmount: number;
  roomClassRequested?: string;
  roomClassApproved?: string;
  roomTypeRequested?: string;
  validFrom?: string;
  validUntil?: string;    // mapped from validTo
  tpaReferenceNumber?: string;
  submittedAt?: string;
  receivedAt?: string;
  rejectionReason?: string;
  // Migration 124: clinical
  clinicalSummary?: string;
  treatingDoctorName?: string;
  treatingDoctorReg?: string;
  admissionDate?: string;
  expectedDischargeDate?: string;
  actualDischargeDate?: string;
  lengthOfStayDays?: number;
  tpaQueryJson?: string;
  processStatus?: string;
  processStatusUpdatedAt?: string;
  // Migration 124: financial
  estimatedTotalCost: number;
  copayAmount: number;
  deductibleAmount: number;
  serviceTaxAmount: number;
  netPayableByInsurer: number;
  netPayableByPatient: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClarificationItem {
  id: string;
  authorizationId: string;
  clarificationQuery: string;
  clarificationResponse?: string;
  requestedAt: string;
  respondedAt?: string;
  createdByUserId?: string;
}

export interface GeneratePreAuthRequest {
  requestedAmount: number;
  roomClassRequested?: string;
  roomTypeRequested?: string;
  diagnosisJson?: string;
  proceduresJson?: string;
  // Migration 124: clinical
  clinicalSummary?: string;
  treatingDoctorName?: string;
  treatingDoctorReg?: string;
  admissionDate?: string;
  expectedDischargeDate?: string;
  lengthOfStayDays?: number;
  // Migration 124: financial
  estimatedTotalCost?: number;
  copayAmount?: number;
  deductibleAmount?: number;
  serviceTaxAmount?: number;
  netPayableByInsurer?: number;
  netPayableByPatient?: number;
}

export interface SubmitAuthRequest {
  tpaReferenceNumber?: string;
}

export interface TpaResponseRequest {
  actionType: 'Approve' | 'PartiallyApprove' | 'Deny' | 'QueryRaise';
  decision?: 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'CLARIFICATION';
  approvedAmount?: number;
  roomClassApproved?: string;
  tpaReferenceNumber?: string;
  preAuthNumber?: string;
  validFrom?: string;
  validUntil?: string;
  rejectionReason?: string;
  notes?: string;
  eventSource?: string;
}

export interface AuthQueueItem {
  preAuthId: string;
  caseId: string;
  caseNumber: string;
  patientId: string;
  status: string;
  requestedAmount: number;
  ageInHours: number;
}

// ── Map raw CcmsCoverageAuthorization entity → PreAuthorization ───────────────

/** Read camelCase or PascalCase API fields (POST/GET serializers differ). */
function pickField<T>(raw: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const v = raw[key];
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined;
}

function deriveStatus(raw: Record<string, unknown>): string {
  const processStatus = String(raw.processStatus ?? raw.ProcessStatus ?? '').toLowerCase();
  if (processStatus.includes('clarif') || processStatus === 'query_raised') {
    return 'CLARIFICATION';
  }

  const receivedAt = pickField<string>(raw, 'receivedAt', 'ReceivedAt');
  const submittedAt = pickField<string>(raw, 'submittedAt', 'SubmittedAt');

  if (receivedAt) {
    const rejectionReason = pickField<string>(raw, 'rejectionReason', 'RejectionReason');
    if (rejectionReason) return 'REJECTED';
    const approved = Number(raw.approvedAmount ?? raw.ApprovedAmount ?? 0);
    const requested = Number(raw.requestedAmount ?? raw.RequestedAmount ?? 0);
    if (approved > 0 && requested > 0 && approved < requested) return 'PARTIAL';
    if (approved > 0) return 'APPROVED';
    return 'RECEIVED';
  }
  if (submittedAt) return 'SENT';
  return 'PENDING';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPreAuthorizationFromApi(raw: any): PreAuthorization {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid authorization response from CCMS API');
  }

  const r = raw as Record<string, unknown>;
  const id = pickField<string>(r, 'id', 'Id');

  return {
    id:                id ?? '',
    caseId:            pickField<string>(r, 'coverageCase_Id', 'coverageCaseId', 'CoverageCase_Id', 'caseId') ?? '',
    authorizationType: pickField<string>(r, 'authorizationType', 'AuthorizationType') ?? 'preauth',
    preAuthNumber:     pickField<string | null>(r, 'preAuthNumber', 'PreAuthNumber') ?? null,
    status:            deriveStatus(r),
    requestedAmount:   Number(r.requestedAmount ?? r.RequestedAmount ?? 0),
    approvedAmount:    Number(r.approvedAmount ?? r.ApprovedAmount ?? 0),
    roomClassRequested: pickField<string>(r, 'roomClassRequested', 'RoomClassRequested'),
    roomClassApproved:  pickField<string>(r, 'roomClassApproved', 'RoomClassApproved'),
    validFrom:         pickField<string>(r, 'validFrom', 'ValidFrom'),
    validUntil:        pickField<string>(r, 'validTo', 'validUntil', 'ValidTo', 'ValidUntil'),
    tpaReferenceNumber: pickField<string>(r, 'tpaReferenceNumber', 'TpaReferenceNumber'),
    submittedAt:       pickField<string>(r, 'submittedAt', 'SubmittedAt'),
    receivedAt:        pickField<string>(r, 'receivedAt', 'ReceivedAt'),
    rejectionReason:   pickField<string>(r, 'rejectionReason', 'RejectionReason'),
    processStatus:     pickField<string>(r, 'processStatus', 'ProcessStatus'),
    processStatusUpdatedAt: pickField<string>(r, 'processStatusUpdatedAt', 'ProcessStatusUpdatedAt'),
    clinicalSummary:   pickField<string>(r, 'clinicalSummary', 'ClinicalSummary'),
    treatingDoctorName: pickField<string>(r, 'treatingDoctorName', 'TreatingDoctorName'),
    treatingDoctorReg: pickField<string>(r, 'treatingDoctorReg', 'TreatingDoctorReg'),
    admissionDate:     pickField<string>(r, 'admissionDate', 'AdmissionDate'),
    expectedDischargeDate: pickField<string>(r, 'expectedDischargeDate', 'ExpectedDischargeDate'),
    lengthOfStayDays:  pickField<number>(r, 'lengthOfStayDays', 'LengthOfStayDays'),
    roomTypeRequested: pickField<string>(r, 'roomTypeRequested', 'RoomTypeRequested', 'roomClassRequested', 'RoomClassRequested'),
    estimatedTotalCost: Number(r.estimatedTotalCost ?? r.EstimatedTotalCost ?? r.requestedAmount ?? r.RequestedAmount ?? 0),
    copayAmount:       Number(r.copayAmount ?? r.CopayAmount ?? 0),
    deductibleAmount:  Number(r.deductibleAmount ?? r.DeductibleAmount ?? 0),
    serviceTaxAmount:  Number(r.serviceTaxAmount ?? r.ServiceTaxAmount ?? 0),
    netPayableByInsurer: Number(r.netPayableByInsurer ?? r.NetPayableByInsurer ?? 0),
    netPayableByPatient: Number(r.netPayableByPatient ?? r.NetPayableByPatient ?? 0),
    createdAt:         pickField<string>(r, 'createdAt', 'CreatedAt') ?? new Date().toISOString(),
    updatedAt:         pickField<string>(r, 'updatedAt', 'UpdatedAt', 'createdAt', 'CreatedAt') ?? new Date().toISOString(),
  };
}

export async function generatePreAuth(caseId: string, req: GeneratePreAuthRequest): Promise<PreAuthorization> {
  const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/authorization`, req);
  if (data && typeof data === 'object' && 'error' in data && !('id' in data) && !('Id' in data)) {
    throw Object.assign(new Error(String((data as { error: string }).error)), { response: { data } });
  }
  const mapped = mapPreAuthorizationFromApi(data);
  if (!mapped.id?.trim()) {
    throw new Error('CCMS returned an authorization without an id — check API logs');
  }
  return mapped;
}

export async function getPreAuthByCaseId(caseId: string): Promise<PreAuthorization[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/authorization`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.isArray(data) ? data.map((r: any) => mapPreAuthorizationFromApi(r)) : [];
}

export async function submitAuth(authId: string, req: SubmitAuthRequest): Promise<PreAuthorization> {
  const { data } = await getCcmsApi().post(`/ccms/authorizations/${authId}/submit`, {
    tpaReferenceNumber: req.tpaReferenceNumber,
  });
  return mapPreAuthorizationFromApi(data);
}

export async function recordTpaResponse(authId: string, req: TpaResponseRequest): Promise<PreAuthorization> {
  // Map frontend TpaResponseRequest → backend RecordTpaResponseRequest shape
  const decision = (req.decision
    ?? (req.actionType === 'Approve'         ? 'APPROVED'
      : req.actionType === 'PartiallyApprove' ? 'PARTIAL'
      : req.actionType === 'Deny'             ? 'REJECTED'
      : 'CLARIFICATION')) as string;

  const { data } = await getCcmsApi().post(`/ccms/authorizations/${authId}/tpa-response`, {
    decision,
    approvedAmount:     req.approvedAmount     ?? 0,
    roomClassApproved:  req.roomClassApproved  ?? null,
    preAuthNumber:      req.preAuthNumber      ?? req.tpaReferenceNumber ?? null,
    validFrom:          req.validFrom          ?? null,
    validTo:            req.validUntil         ?? null,
    rejectionReason:    req.rejectionReason    ?? req.notes ?? null,
    tpaReferenceNumber: req.tpaReferenceNumber ?? null,
    eventSource:        req.eventSource        ?? 'manual',
    clarificationQuery: decision === 'CLARIFICATION' ? (req.notes ?? req.rejectionReason) : null,
  });
  return mapPreAuthorizationFromApi(data);
}

export async function getAuthQueue(): Promise<AuthQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/authorizations/queue');
  return Array.isArray(data) ? data : [];
}

export async function updateAuthProcessStatus(
  authId: string,
  processStatus: string,
): Promise<PreAuthorization> {
  const { data } = await getCcmsApi().patch(
    `/ccms/authorizations/${authId}/process-status`,
    { processStatus },
  );
  return mapPreAuthorizationFromApi(data);
}

// ── Clarification API ─────────────────────────────────────────────────────────

export async function getClarifications(authId: string): Promise<ClarificationItem[]> {
  const { data } = await getCcmsApi().get(
    `/ccms/authorizations/${authId}/clarifications`,
  );
  return Array.isArray(data) ? data : [];
}

export async function addClarificationQuery(
  authId: string,
  query: string,
): Promise<ClarificationItem> {
  const { data } = await getCcmsApi().post(
    `/ccms/authorizations/${authId}/clarifications`,
    { query },
  );
  return data;
}

export async function respondToClarification(
  itemId: string,
  response: string,
): Promise<ClarificationItem> {
  const { data } = await getCcmsApi().post(
    `/ccms/clarifications/${itemId}/respond`,
    { response },
  );
  return data;
}
