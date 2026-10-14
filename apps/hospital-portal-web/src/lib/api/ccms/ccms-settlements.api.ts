// CCMS – Settlement & Reconciliation API client
import { getCcmsApi } from './ccms-base';

export interface Settlement {
  id: string;
  coverageCase_Id: string;
  claimPacketId?: string;
  settlementNumber: string;
  settlementType: 'full' | 'partial';
  settledAmount: number;
  claimAmount: number;
  outstandingAmount: number;
  paymentMode?: string;
  paymentReference?: string;
  paymentDate?: string;
  bankReference?: string;
  settledAt?: string;
  reconciliationStatus: string;
  reconciliationNotes?: string;
  createdAt: string;
}

export interface RecordSettlementRequest {
  claimPacketId?: string;
  settledAmount: number;
  claimAmount: number;
  paymentMode?: 'NEFT' | 'RTGS' | 'Cheque' | 'IMPS' | 'Cash';
  paymentReference?: string;
  paymentDate?: string;     // ISO date string YYYY-MM-DD
  bankReference?: string;
  remarks?: string;
  lineItems?: SettlementLineItemRequest[];
}

export interface SettlementLineItemRequest {
  lineType: string;
  description: string;
  claimedAmount: number;
  settledAmount: number;
  disallowedReason?: string;
}

export interface ReconcileRequest {
  reconcileNotes?: string;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  totalAmount: number;
}

/** POST /ccms/coverage-cases/{caseId}/settlements */
export async function recordSettlement(
  caseId: string,
  req: RecordSettlementRequest,
): Promise<Settlement> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/settlements`,
    req,
  );
  return data;
}

export async function getSettlementsByCaseId(caseId: string): Promise<Settlement[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/settlements`);
  return Array.isArray(data) ? data : [];
}

/** POST /ccms/coverage-cases/{caseId}/reconcile */
export async function reconcileCase(
  caseId: string,
  req?: ReconcileRequest,
): Promise<void> {
  await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/reconcile`, req ?? {});
}

/** POST /ccms/coverage-cases/{caseId}/close */
export async function closeCase(caseId: string): Promise<void> {
  await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/close`);
}

/** @deprecated Use getSettlementsByCaseId */
export const getSettlementByCaseId = getSettlementsByCaseId;

/** GET /ccms/settlements/aging */
export async function getAgingReport(): Promise<AgingBucket[]> {
  const { data } = await getCcmsApi().get('/ccms/settlements/aging');
  return Array.isArray(data) ? data : [];
}

export interface SettlementListResponse {
  settlements: unknown[];
  totalCount: number;
  pageNumber?: number;
  pageSize?: number;
}

/** GET /ccms/settlements/by-patient/{patientId} */
export async function getSettlementsByPatient(
  patientId: string,
  pageNumber = 1,
  pageSize = 20,
): Promise<SettlementListResponse> {
  const { data } = await getCcmsApi().get(`/ccms/settlements/by-patient/${patientId}`, {
    params: { pageNumber, pageSize },
  });
  return data;
}
