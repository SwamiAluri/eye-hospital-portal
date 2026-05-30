// CCMS – Workflow Engine API client
import { getCcmsApi } from './ccms-base';
import { getStateLabel } from './ccms-state-labels';

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
  performedAt: string;
  comment?: string;
}

/** Returns true if a string looks like a bare UUID (36 chars, 8-4-4-4-12 hex groups). */
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Returns true if s looks like a truncated UUID hash e.g. "(8d83a637…)" */
function isHashFragment(s: string): boolean {
  return /^\([0-9a-f]{8}…\)$/.test(s);
}

/**
 * Normalizes a raw state code from the API:
 * - Full UUIDs or truncated hash fragments → "UNKNOWN" so getStateLabel renders "Unknown state"
 * - Everything else is passed through as-is (already a code like ELIGIBILITY_PENDING)
 */
function normalizeStateCode(s: string): string {
  if (!s) return 'DRAFT';
  if (isUuid(s) || isHashFragment(s)) return 'UNKNOWN';
  return s;
}

export interface FireTransitionRequest {
  actionCode: string;
  comment?: string;
}

export async function getWorkflowState(entityType: string, entityId: string): Promise<WorkflowState> {
  const { data } = await getCcmsApi().get(`/ccms/workflow/${entityType}/${entityId}/state`);
  return data;
}

/**
 * Returns available trigger events for a workflow instance.
 * Calls GET /ccms/workflow/instances/{instanceId}/state
 * and maps the availableEvents array to WorkflowAction shape.
 */
/** Maps trigger event codes to the WorkflowAction shape used by the case UI. */
export function mapWorkflowActionsFromEvents(events: string[]): WorkflowAction[] {
  return events.map(e => ({
    actionCode:            e,
    actionLabel:           e.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    requiresComment:       false,
    confirmationRequired:  true,
  }));
}

export async function getAvailableActions(_entityType: string, _entityId: string, workflowInstanceId?: string): Promise<WorkflowAction[]> {
  if (!workflowInstanceId) return [];
  const { data } = await getCcmsApi().get(`/ccms/workflow/instances/${workflowInstanceId}/state`);
  const events: string[] = Array.isArray(data?.availableEvents) ? data.availableEvents : [];
  return mapWorkflowActionsFromEvents(events);
}

/**
 * Returns workflow transition history for a workflow instance.
 * Backend now returns normalized DTO shape. This function also normalizes
 * any raw entity fields that might come through for backwards compatibility.
 */
/** Normalizes workflow history entries from API or workspace BFF. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapWorkflowHistoryFromApi(raw: any): WorkflowHistoryEntry {
  const fromCode = normalizeStateCode(String(raw.fromState ?? raw.fromStateCode ?? raw.fromStateId ?? ''));
  const toCode   = normalizeStateCode(String(raw.toState   ?? raw.toStateCode   ?? raw.toStateId   ?? ''));
  return {
    fromState:   getStateLabel(fromCode),
    toState:     getStateLabel(toCode),
    actionCode:  raw.actionCode  ?? raw.triggerEvent  ?? '',
    performedAt: raw.performedAt ?? raw.transitionedAt ?? raw.createdAt ?? '',
    comment:     raw.comment     ?? raw.notes         ?? undefined,
  };
}

export async function getWorkflowHistory(_entityType: string, _entityId: string, workflowInstanceId?: string): Promise<WorkflowHistoryEntry[]> {
  if (!workflowInstanceId) return [];
  const { data } = await getCcmsApi().get(`/ccms/workflow/instances/${workflowInstanceId}/history`);
  if (!Array.isArray(data)) return [];
  return data.map(mapWorkflowHistoryFromApi);
}

/**
 * Fires a workflow transition for a coverage case.
 * Maps frontend { actionCode, comment } → backend { triggerEvent, notes }
 * Route: POST /ccms/coverage-cases/{entityId}/transition
 */
export async function fireTransition(
  _entityType: string,
  entityId: string,
  req: FireTransitionRequest,
): Promise<WorkflowState> {
  const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${entityId}/transition`, {
    triggerEvent: req.actionCode,
    notes:        req.comment,
  });
  // Normalise backend shape → WorkflowState
  return {
    entityType:   'coverage-case',
    entityId,
    currentState: data?.currentState ?? data?.toState ?? '',
    stateLabel:   data?.currentState ?? data?.toState ?? '',
    enteredAt:    new Date().toISOString(),
  };
}
