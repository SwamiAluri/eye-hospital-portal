import type { WaitingListStatus } from '@/types/counsellors-desk';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';

export type WaitingListPrimaryActionKind = 'row-navigate' | 'preauth';

const STATUS_PRIMARY_ACTION: Record<
  WaitingListStatus,
  { label: string; kind: WaitingListPrimaryActionKind }
> = {
  Pending: { label: 'Start', kind: 'row-navigate' },
  Processed: { label: 'Continue', kind: 'row-navigate' },
  Done: { label: 'View', kind: 'row-navigate' },
  RepeatCounselling: { label: 'Open', kind: 'row-navigate' },
  AddOnSurgery: { label: 'Open', kind: 'row-navigate' },
  SurgeryDone: { label: 'View', kind: 'row-navigate' },
};

export function resolveWaitingListPrimaryAction(input: {
  status: WaitingListStatus;
  activeTab: string;
  patientType?: string | null;
}): { label: string; kind: WaitingListPrimaryActionKind } {
  if (input.activeTab === 'PreAuthQueue' && isCoveragePaymentTypeValue(input.patientType)) {
    return { label: 'Pre-Auth', kind: 'preauth' };
  }

  return STATUS_PRIMARY_ACTION[input.status];
}
