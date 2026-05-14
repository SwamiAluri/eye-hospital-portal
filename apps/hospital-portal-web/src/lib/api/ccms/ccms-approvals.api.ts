// CCMS – Approval Events API client (append-only event sourcing)
import { getCcmsApi } from './ccms-base';

export interface ApprovalEvent {
  id: string;
  caseId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  performedBy?: string;
  occurredAt: string;
  notes?: string;
}

export interface AppendEventRequest {
  eventType: string;
  eventData?: Record<string, unknown>;
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

export async function appendApprovalEvent(caseId: string, req: AppendEventRequest): Promise<ApprovalEvent> {
  const { data } = await getCcmsApi().post(`/ccms/approvals/cases/${caseId}/events`, req);
  return data;
}

export async function getEventStream(caseId: string): Promise<ApprovalEvent[]> {
  const { data } = await getCcmsApi().get(`/ccms/approvals/cases/${caseId}/events`);
  return Array.isArray(data) ? data : [];
}

export async function getApprovalSnapshot(caseId: string): Promise<ApprovalSnapshot> {
  const { data } = await getCcmsApi().get(`/ccms/approvals/cases/${caseId}/snapshot`);
  return data;
}

export async function getApprovalQueue(): Promise<ApprovalQueueItem[]> {
  const { data } = await getCcmsApi().get('/ccms/approvals/queue');
  return Array.isArray(data) ? data : [];
}
