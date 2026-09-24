import type { WaitingListStatus } from '@/types/counsellors-desk';
import { resolveWaitingListLifecycleAction } from './waiting-list-lifecycle-action';

export type OtReturnedAction =
  | { kind: 'start-counselling'; label: 'Start Counseling' }
  | {
      kind: 'lifecycle';
      label: string;
      lifecycleKind: ReturnType<typeof resolveWaitingListLifecycleAction>['kind'];
      sessionId: string;
    };

/**
 * OT Returned CTA — reuses resolveWaitingListLifecycleAction.
 * No-session only → Start Counseling (certified create). Never invent OT-specific verbs.
 */
export function resolveOtReturnedAction(input: {
  journeyId: string;
  counselingSessionId: string | null | undefined;
  lifecycleStatus?: WaitingListStatus | null;
  counselorId?: string | null;
  currentUserId?: string | null;
  patientType?: string | null;
  canAssign?: boolean;
}): OtReturnedAction {
  const sessionId = input.counselingSessionId?.trim() || null;
  const status = input.lifecycleStatus;

  if (!sessionId || !status) {
    return { kind: 'start-counselling', label: 'Start Counseling' };
  }

  const lifecycle = resolveWaitingListLifecycleAction({
    status,
    counselorId: input.counselorId,
    currentUserId: input.currentUserId,
    activeTab: 'All',
    patientType: input.patientType,
    canAssign: input.canAssign,
  });

  return {
    kind: 'lifecycle',
    label: lifecycle.label,
    lifecycleKind: lifecycle.kind,
    sessionId,
  };
}
