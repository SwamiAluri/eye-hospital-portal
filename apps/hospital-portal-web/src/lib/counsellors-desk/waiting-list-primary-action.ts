import type { WaitingListStatus } from '@/types/counsellors-desk';
import { resolveWaitingListLifecycleAction } from './waiting-list-lifecycle-action';

/**
 * @deprecated Prefer resolveWaitingListLifecycleAction (owner-aware).
 * Kept for PreAuth override callers that do not yet pass ownership.
 */
export type WaitingListPrimaryActionKind = 'row-navigate' | 'preauth';

export function resolveWaitingListPrimaryAction(input: {
  status: WaitingListStatus;
  activeTab: string;
  patientType?: string | null;
  counselorId?: string | null;
  currentUserId?: string | null;
  canAssign?: boolean;
}): { label: string; kind: WaitingListPrimaryActionKind } {
  const lifecycle = resolveWaitingListLifecycleAction({
    status: input.status,
    activeTab: input.activeTab,
    patientType: input.patientType,
    counselorId: input.counselorId,
    currentUserId: input.currentUserId,
    canAssign: input.canAssign,
  });
  if (lifecycle.kind === 'preauth') {
    return { label: 'Pre-Auth', kind: 'preauth' };
  }
  return { label: lifecycle.label, kind: 'row-navigate' };
}
