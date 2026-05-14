// CCMS – Settlement & Reconciliation API client
import { getCcmsApi } from './ccms-base';

export interface Settlement {
  id: string;
  caseId: string;
  settlementNumber: string;
  status: string;
  settledAmount: number;
  deductionAmount: number;
  netReceivedAmount: number;
  settledAt?: string;
  reconciledAt?: string;
  paymentMode?: string;
  utrNumber?: string;
  createdAt: string;
}

export interface RecordSettlementRequest {
  caseId: string;
  settledAmount: number;
  deductionAmount?: number;
  paymentMode?: 'NEFT' | 'RTGS' | 'Cheque' | 'IMPS';
  utrNumber?: string;
  paymentDate?: string;
  notes?: string;
}

export interface ReconcileRequest {
  reconcileNotes?: string;
  discrepancyAmount?: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  totalAmount: number;
}

export async function recordSettlement(req: RecordSettlementRequest): Promise<Settlement> {
  const { data } = await getCcmsApi().post('/ccms/settlements', req);
  return data;
}

export async function getSettlementByCaseId(caseId: string): Promise<Settlement[]> {
  const { data } = await getCcmsApi().get(`/ccms/settlements/cases/${caseId}`);
  return Array.isArray(data) ? data : [];
}

export async function getSettlementById(id: string): Promise<Settlement> {
  const { data } = await getCcmsApi().get(`/ccms/settlements/${id}`);
  return data;
}

export async function reconcileSettlement(id: string, req?: ReconcileRequest): Promise<Settlement> {
  const { data } = await getCcmsApi().post(`/ccms/settlements/${id}/reconcile`, req ?? {});
  return data;
}

export async function getAgingReport(): Promise<AgingBucket[]> {
  const { data } = await getCcmsApi().get('/ccms/settlements/aging');
  return Array.isArray(data) ? data : [];
}
