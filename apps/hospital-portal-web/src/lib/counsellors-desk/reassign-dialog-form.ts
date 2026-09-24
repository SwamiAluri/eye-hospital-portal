import type { CounselingCounselorOption } from '@/lib/api/counsellors-desk.api';

/** UI-only reassignment reason labels. Sent as the existing `reason: string` API field. */
export const REASSIGN_REASON_OPTIONS = [
  'Workload balancing',
  'Counsellor unavailable',
  'Schedule or availability change',
  'Branch or coverage change',
  'Continuity of care',
  'Patient request',
  'Operational handoff',
  'Incorrect initial assignment',
  'Other',
] as const;

export type ReassignReasonOption = (typeof REASSIGN_REASON_OPTIONS)[number];

export const REASSIGN_OTHER_REASON: ReassignReasonOption = 'Other';

export function excludeCurrentOwnerFromTargets(
  counselors: CounselingCounselorOption[],
  currentOwnerId: string | null | undefined,
): CounselingCounselorOption[] {
  if (!currentOwnerId) return counselors;
  return counselors.filter((c) => c.id !== currentOwnerId);
}

export function resolveReassignReasonPayload(input: {
  reasonChoice: string;
  additionalReason: string;
}): { ok: true; reason: string } | { ok: false } {
  const choice = input.reasonChoice.trim();
  if (!choice) return { ok: false };

  if (choice === REASSIGN_OTHER_REASON) {
    const trimmed = input.additionalReason.trim();
    if (!trimmed) return { ok: false };
    return { ok: true, reason: trimmed };
  }

  return { ok: true, reason: choice };
}

export function canSubmitReassignForm(input: {
  selectedCounselorId: string;
  reasonChoice: string;
  additionalReason: string;
  submitting: boolean;
}): boolean {
  if (input.submitting) return false;
  if (!input.selectedCounselorId.trim()) return false;
  return resolveReassignReasonPayload({
    reasonChoice: input.reasonChoice,
    additionalReason: input.additionalReason,
  }).ok;
}
