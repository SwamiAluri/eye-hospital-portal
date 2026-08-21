// CCMS – Enhancement Requests API client (Phase 4 Workstream C)
import { getCcmsApi } from './ccms-base';

export interface Enhancement {
  id: string;
  coverageCase_Id: string;
  enhancementType: string;
  requestedAmount: number;
  approvedAmount?: number;
  reason?: string;
  status: string; // active | submitted | approved | rejected
  submittedAt?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnhancementListItem {
  enhancement: Enhancement;
  caseNumber: string;
  patientName?: string;
  caseApprovedAmount: number;
  journeyId?: string;
  sessionId?: string;
}

export interface EnhancementGapEvaluation {
  needsEnhancement: boolean;
  gapAmount: number;
  approvedCoverageAmount: number;
  eligibleAmount: number;
  hasOpenEnhancement: boolean;
  recommendation: 'none' | 'request_enhancement' | 'await_open_enhancement' | string;
}

export interface CreateEnhancementRequest {
  enhancementType?: 'amount' | 'days' | 'procedure' | 'room_upgrade';
  requestedAmount: number;
  reason?: string;
  source?: string;
}

export interface SubmitEnhancementRequest {
  tpaReferenceNumber?: string;
  notes?: string;
}

export interface DecideEnhancementRequest {
  approved: boolean;
  approvedAmount: number;
  tpaReferenceNumber?: string;
  hospitalOverride?: boolean;
  overrideReason?: string;
}

function normalizeEnhancement(raw: Record<string, unknown>): Enhancement {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    coverageCase_Id: String(raw.coverageCase_Id ?? raw.CoverageCase_Id ?? ''),
    enhancementType: String(raw.enhancementType ?? raw.EnhancementType ?? 'amount'),
    requestedAmount: Number(raw.requestedAmount ?? raw.RequestedAmount ?? 0),
    approvedAmount: raw.approvedAmount != null || raw.ApprovedAmount != null
      ? Number(raw.approvedAmount ?? raw.ApprovedAmount)
      : undefined,
    reason: (raw.reason ?? raw.Reason) as string | undefined,
    status: String(raw.status ?? raw.Status ?? 'active'),
    submittedAt: (raw.submittedAt ?? raw.SubmittedAt) as string | undefined,
    decidedAt: (raw.decidedAt ?? raw.DecidedAt) as string | undefined,
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.UpdatedAt ?? ''),
  };
}

export async function listEnhancements(params?: {
  status?: string;
  take?: number;
}): Promise<EnhancementListItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.take) qs.set('take', String(params.take));
  const { data } = await getCcmsApi().get(`/ccms/enhancements?${qs.toString()}`);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: Record<string, unknown>) => {
    const enh = (r.enhancement ?? r.Enhancement ?? r) as Record<string, unknown>;
    return {
      enhancement: normalizeEnhancement(enh),
      caseNumber: String(r.caseNumber ?? r.CaseNumber ?? ''),
      patientName: (r.patientName ?? r.PatientName) as string | undefined,
      caseApprovedAmount: Number(r.caseApprovedAmount ?? r.CaseApprovedAmount ?? 0),
      journeyId: (r.journeyId ?? r.JourneyId) as string | undefined,
      sessionId: (r.sessionId ?? r.SessionId) as string | undefined,
    };
  });
}

export async function getEnhancementGap(
  caseId: string,
  eligibleAmount: number,
): Promise<EnhancementGapEvaluation> {
  const { data } = await getCcmsApi().get(
    `/ccms/coverage-cases/${caseId}/enhancement-gap`,
    { params: { eligibleAmount } },
  );
  const d = data as Record<string, unknown>;
  return {
    needsEnhancement: Boolean(d.needsEnhancement ?? d.NeedsEnhancement),
    gapAmount: Number(d.gapAmount ?? d.GapAmount ?? 0),
    approvedCoverageAmount: Number(d.approvedCoverageAmount ?? d.ApprovedCoverageAmount ?? 0),
    eligibleAmount: Number(d.eligibleAmount ?? d.EligibleAmount ?? eligibleAmount),
    hasOpenEnhancement: Boolean(d.hasOpenEnhancement ?? d.HasOpenEnhancement),
    recommendation: String(d.recommendation ?? d.Recommendation ?? 'none'),
  };
}

export async function getEnhancementsByCaseId(caseId: string): Promise<Enhancement[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/enhancements`);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: Record<string, unknown>) => normalizeEnhancement(r));
}

export async function createEnhancement(
  caseId: string,
  req: CreateEnhancementRequest,
): Promise<Enhancement> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/enhancements`,
    req,
  );
  return normalizeEnhancement(data as Record<string, unknown>);
}

export async function submitEnhancement(
  enhancementId: string,
  req: SubmitEnhancementRequest = {},
): Promise<Enhancement> {
  const { data } = await getCcmsApi().post(
    `/ccms/enhancements/${enhancementId}/submit`,
    req,
  );
  return normalizeEnhancement(data as Record<string, unknown>);
}

export async function decideEnhancement(
  enhancementId: string,
  req: DecideEnhancementRequest,
): Promise<Enhancement> {
  const { data } = await getCcmsApi().post(
    `/ccms/enhancements/${enhancementId}/decide`,
    req,
  );
  return normalizeEnhancement(data as Record<string, unknown>);
}
