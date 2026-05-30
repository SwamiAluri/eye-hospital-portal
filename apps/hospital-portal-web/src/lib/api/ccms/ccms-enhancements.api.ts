// CCMS – Enhancement Requests API client
import { getCcmsApi } from './ccms-base';

export interface Enhancement {
  id: string;
  coverageCase_Id: string;
  enhancementType: string;
  requestedAmount: number;
  approvedAmount?: number;
  reason?: string;
  status: string;         // active | approved | rejected
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnhancementRequest {
  enhancementType?: 'amount' | 'days' | 'procedure' | 'room_upgrade';
  requestedAmount: number;
  reason?: string;
}

export interface DecideEnhancementRequest {
  approved: boolean;
  approvedAmount: number;
}

export async function getEnhancementsByCaseId(caseId: string): Promise<Enhancement[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/enhancements`);
  return Array.isArray(data) ? data : [];
}

export async function createEnhancement(
  caseId: string,
  req: CreateEnhancementRequest,
): Promise<Enhancement> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/enhancements`,
    req,
  );
  return data;
}

export async function decideEnhancement(
  enhancementId: string,
  req: DecideEnhancementRequest,
): Promise<Enhancement> {
  const { data } = await getCcmsApi().post(
    `/ccms/enhancements/${enhancementId}/decide`,
    req,
  );
  return data;
}
