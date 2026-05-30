// CCMS – Approval Events API client (append-only event sourcing)
import { getCcmsApi } from './ccms-base';

// ── Normalized shape (mapped from CcmsApprovalEvent entity) ──────────────────

export interface ApprovalEvent {
  id: string;
  caseId: string;
  authorizationId?: string;
  eventType: string;         // maps from backend eventType
  approvalStatus: string;    // APPROVED | PARTIAL | REJECTED | CLARIFICATION
  approvedAmount: number;
  partialApprovalReason?: string;
  rejectionReason?: string;
  tpaReferenceNumber?: string;
  eventSource: string;       // manual | tpa_portal | api
  recordedBy?: string;
  recordedAt: string;        // mapped from backend recordedAt
  // aliases for backwards compat
  performedBy?: string;
  occurredAt: string;
  notes?: string;
}

export interface AppendEventRequest {
  eventType: string;
  approvalStatus?: string;
  approvedAmount?: number;
  tpaReferenceNumber?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface ApprovalSnapshot {
  caseId: string;
  currentState: string;
  totalEvents: number;
  lastEventAt?: string;
  approvedAmount?: number;
  approvedBy?: string;
}

export interface ApprovalQueueItem {
  caseId: string;
  caseNumber: string;
  currentState: string;
  lastEventAt: string;
  pendingAction: string;
  urgencyLevel: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapApprovalEventFromApi(raw: any): ApprovalEvent {
  const recordedAt = raw.recordedAt ?? raw.occurredAt ?? raw.createdAt ?? new Date().toISOString();
  return {
    id:                   raw.id ?? '',
    caseId:               raw.coverageCase_Id ?? raw.coverageCaseId ?? raw.caseId ?? '',
    authorizationId:      raw.authorizationId ?? undefined,
    eventType:            raw.eventType        ?? '',
    approvalStatus:       raw.approvalStatus   ?? '',
    approvedAmount:       Number(raw.approvedAmount ?? 0),
    partialApprovalReason: raw.partialApprovalReason ?? undefined,
    rejectionReason:      raw.rejectionReason  ?? undefined,
    tpaReferenceNumber:   raw.tpaReferenceNumber ?? undefined,
    eventSource:          raw.eventSource      ?? 'manual',
    recordedBy:           raw.recordedByUserId ?? raw.recordedBy ?? undefined,
    recordedAt,
    performedBy:          raw.recordedByUserId ?? raw.recordedBy ?? undefined,
    occurredAt:           recordedAt,
    notes:                raw.responsePayloadJson ?? raw.notes ?? undefined,
  };
}

export async function appendApprovalEvent(caseId: string, req: AppendEventRequest): Promise<ApprovalEvent> {
  const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/approval-events`, req);
  return mapApprovalEventFromApi(data);
}

export async function getEventStream(caseId: string): Promise<ApprovalEvent[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/approval-events`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.isArray(data) ? data.map((r: any) => mapApprovalEventFromApi(r)) : [];
}

// Snapshot derived from latest event in frontend — backend snapshot endpoint not yet implemented
export async function getApprovalSnapshot(caseId: string): Promise<ApprovalSnapshot | null> {
  try {
    const events = await getEventStream(caseId);
    if (!events.length) return null;
    const latest = events[events.length - 1];
    return {
      caseId,
      currentState:  latest.approvalStatus,
      totalEvents:   events.length,
      lastEventAt:   latest.recordedAt,
      approvedAmount: latest.approvedAmount || undefined,
      approvedBy:    latest.recordedBy,
    };
  } catch {
    return null;
  }
}

export async function getApprovalQueue(): Promise<ApprovalQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/approvals/queue');
  return Array.isArray(data) ? data : [];
}
