// CCMS – Pre-Authorization API client
import { getCcmsApi } from './ccms-base';

export interface PreAuthorization {
  id: string;
  caseId: string;
  preAuthNumber: string;
  status: string;
  requestedAmount: number;
  approvedAmount?: number;
  validFrom?: string;
  validUntil?: string;
  tpaReferenceNumber?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePreAuthRequest {
  requestedAmount: number;
  estimatedSurgeryDate?: string;
  diagnosisCodes?: string[];
  procedureCodes?: string[];
  clinicalNotes?: string;
}

export interface SubmitAuthRequest {
  tpaContact?: string;
  urgencyLevel?: 'Low' | 'Normal' | 'High' | 'Critical';
  notes?: string;
}

export interface TpaResponseRequest {
  actionType: 'Approve' | 'PartiallyApprove' | 'Deny' | 'QueryRaise';
  approvedAmount?: number;
  tpaReferenceNumber?: string;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
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

export async function generatePreAuth(caseId: string, req: GeneratePreAuthRequest): Promise<PreAuthorization> {
  const { data } = await getCcmsApi().post(`/ccms/authorizations/cases/${caseId}/generate`, req);
  return data;
}

export async function getPreAuthByCaseId(caseId: string): Promise<PreAuthorization[]> {
  const { data } = await getCcmsApi().get(`/ccms/authorizations/cases/${caseId}`);
  return Array.isArray(data) ? data : [];
}

export async function submitAuth(authId: string, req: SubmitAuthRequest): Promise<PreAuthorization> {
  const { data } = await getCcmsApi().post(`/ccms/authorizations/${authId}/submit`, req);
  return data;
}

export async function recordTpaResponse(authId: string, req: TpaResponseRequest): Promise<PreAuthorization> {
  const { data } = await getCcmsApi().post(`/ccms/authorizations/${authId}/tpa-response`, req);
  return data;
}

export async function getAuthQueue(): Promise<AuthQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/authorizations/queue');
  return Array.isArray(data) ? data : [];
}
