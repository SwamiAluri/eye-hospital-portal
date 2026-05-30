// CCMS – Operations API client (pre-auth queue, ops actions)
import { getCcmsApi } from './ccms-base';
import axios from 'axios';

export interface PreAuthQueueItem {
  authId: string;
  caseCaseId: string;
  sessionId?: string;            // populated by BE; used for session-summary enrichment
  caseNumber?: string;
  caseState?: string;
  preAuthNumber?: string;
  status: string;
  processStatus?: string;
  requestedAmount: number;
  approvedAmount?: number;
  tpaReferenceNumber?: string;
  submittedAt?: string;
  tpaResponseAt?: string;
  daysWaiting: number;
  insurerName?: string;
  patientName?: string;
  // enriched from auth-service session-summaries
  mobileNumber?: string;
  procedureName?: string;
  counsellorName?: string;
  /** Inbound email with parse draft ready for Record Response */
  hasInboundDraft?: boolean;
}

export interface SessionSummary {
  sessionId: string;
  patientName?: string;
  mobile?: string;
  procedureName?: string;
  counsellorName?: string;
}

/** Batch-fetch session summaries from auth-service and merge into queue items. */
export async function enrichPreAuthQueueWithSessions(
  items: PreAuthQueueItem[],
): Promise<PreAuthQueueItem[]> {
  const ids = items.map(i => i.sessionId).filter(Boolean) as string[];
  if (ids.length === 0) return items;

  try {
    const { data } = await axios.get<SessionSummary[]>(
      `/api/insurance/ccms/session-summaries?ids=${ids.join(',')}`,
    );
    const byId = Object.fromEntries((data ?? []).map(s => [s.sessionId, s]));
    return items.map(item => {
      if (!item.sessionId) return item;
      const s = byId[item.sessionId];
      if (!s) return item;
      return {
        ...item,
        mobileNumber:  s.mobile        ?? item.mobileNumber,
        procedureName: s.procedureName ?? item.procedureName,
        counsellorName: s.counsellorName ?? item.counsellorName,
        patientName:   s.patientName    ?? item.patientName,
      };
    });
  } catch {
    return items;   // graceful degradation
  }
}

export interface PreAuthQueueSummary {
  total: number;
  byStatus: { status: string; count: number }[];
  waitingApproval: number;
  clarificationDue: number;
  inboundToReview?: number;
}

export async function getPreAuthQueue(): Promise<PreAuthQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/operations/preauth-queue');
  return Array.isArray(data) ? data : [];
}

export async function getPreAuthQueueSummary(): Promise<PreAuthQueueSummary> {
  const { data } = await getCcmsApi().get('/ccms/operations/preauth-queue/summary');
  return data;
}

// ── Claims queue ──────────────────────────────────────────────────────────────

export interface ClaimsQueueItem {
  claimId: string;
  claimNumber: string;
  caseId: string;
  caseNumber?: string;
  patientName?: string;
  insurerName?: string;
  caseState?: string;
  status: string;
  claimedAmount: number;
  submittedAt?: string;
  ageInDays: number;
}

export async function getClaimsQueue(): Promise<ClaimsQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/operations/claims-queue');
  return Array.isArray(data) ? data : [];
}

// ── Settlement queue ──────────────────────────────────────────────────────────

export interface SettlementQueueItem {
  caseId: string;
  caseNumber?: string;
  patientName?: string;
  insurerName?: string;
  caseState?: string;
  claimId?: string;
  claimNumber?: string;
  claimedAmount: number;
  settledAmount: number;
  outstanding: number;
  submittedAt?: string;
  ageInDays: number;
}

export async function getSettlementQueue(): Promise<SettlementQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/operations/settlement-queue');
  return Array.isArray(data) ? data : [];
}
