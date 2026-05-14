// CCMS – Workflow Engine API client
import { getCcmsApi } from './ccms-base';

export interface WorkflowState {
  entityType: string;
  entityId: string;
  currentState: string;
  stateLabel: string;
  enteredAt: string;
}

export interface WorkflowAction {
  actionCode: string;
  actionLabel: string;
  requiresComment: boolean;
  confirmationRequired: boolean;
}

export interface WorkflowHistoryEntry {
  fromState: string;
  toState: string;
  actionCode: string;
  performedBy: string;
  performedAt: string;
  comment?: string;
}

export interface FireTransitionRequest {
  actionCode: string;
  comment?: string;
}

export async function getWorkflowState(entityType: string, entityId: string): Promise<WorkflowState> {
  const { data } = await getCcmsApi().get(`/ccms/workflow/${entityType}/${entityId}/state`);
  return data;
}

export async function getAvailableActions(entityType: string, entityId: string): Promise<WorkflowAction[]> {
  const { data } = await getCcmsApi().get(`/ccms/workflow/${entityType}/${entityId}/actions`);
  return Array.isArray(data) ? data : [];
}

export async function getWorkflowHistory(entityType: string, entityId: string): Promise<WorkflowHistoryEntry[]> {
  const { data } = await getCcmsApi().get(`/ccms/workflow/${entityType}/${entityId}/history`);
  return Array.isArray(data) ? data : [];
}

export async function fireTransition(
  entityType: string,
  entityId: string,
  req: FireTransitionRequest,
): Promise<WorkflowState> {
  const { data } = await getCcmsApi().post(`/ccms/workflow/${entityType}/${entityId}/transition`, req);
  return data;
}
