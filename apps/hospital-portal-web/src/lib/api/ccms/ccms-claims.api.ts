// CCMS – Claims API client
import { getCcmsApi } from './ccms-base';

export interface ClaimPacket {
  id: string;
  caseId: string;
  claimNumber: string;
  status: string;
  claimedAmount: number;
  submittedAt?: string;
  packetUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClaimRequest {
  caseId: string;
  claimedAmount: number;
  notes?: string;
}

export interface SubmitClaimRequest {
  submissionMethod?: 'Portal' | 'Email' | 'Physical';
  referenceNumber?: string;
  notes?: string;
}

export interface ClaimQueueItem {
  claimId: string;
  claimNumber: string;
  caseId: string;
  caseNumber: string;
  status: string;
  claimedAmount: number;
  submittedAt?: string;
  ageInDays: number;
}

export async function createClaim(req: CreateClaimRequest): Promise<ClaimPacket> {
  const { data } = await getCcmsApi().post('/ccms/claims', req);
  return data;
}

export async function getClaimById(id: string): Promise<ClaimPacket> {
  const { data } = await getCcmsApi().get(`/ccms/claims/${id}`);
  return data;
}

export interface ClaimListResponse {
  claims: unknown[];
  totalCount: number;
  pageNumber?: number;
  pageSize?: number;
}

/** GET /ccms/claims/by-patient/{patientId} */
export async function getClaimsByPatient(
  patientId: string,
  pageNumber = 1,
  pageSize = 20,
): Promise<ClaimListResponse> {
  const { data } = await getCcmsApi().get(`/ccms/claims/by-patient/${patientId}`, {
    params: { pageNumber, pageSize },
  });
  return data;
}

export async function getClaimByCaseId(caseId: string): Promise<ClaimPacket[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/claims`);
  return Array.isArray(data) ? data : [];
}

export async function generateClaimPacket(id: string): Promise<ClaimPacket> {
  const { data } = await getCcmsApi().post(`/ccms/claims/${id}/generate-packet`);
  return data;
}

export async function submitClaim(id: string, req?: SubmitClaimRequest): Promise<ClaimPacket> {
  const { data } = await getCcmsApi().post(`/ccms/claims/${id}/submit`, req ?? {});
  return data;
}

export async function getClaimQueue(): Promise<ClaimQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/claims/queue');
  return Array.isArray(data) ? data : [];
}

export interface AcknowledgeClaimRequest {
  tpaAckReference?: string;
}

export async function acknowledgeClaim(
  id: string,
  req?: AcknowledgeClaimRequest,
): Promise<ClaimPacket> {
  const { data } = await getCcmsApi().post(`/ccms/claims/${id}/acknowledge`, req ?? {});
  return data;
}

export async function raiseClaimQuery(
  id: string,
  query: string,
  additionalInfoRequired = false,
): Promise<ClaimPacket> {
  const { data } = await getCcmsApi().post(`/ccms/claims/${id}/query`, { query, additionalInfoRequired });
  return data;
}

export async function respondClaimQuery(id: string, response: string): Promise<ClaimPacket> {
  const { data } = await getCcmsApi().post(`/ccms/claims/${id}/query-response`, { response });
  return data;
}
