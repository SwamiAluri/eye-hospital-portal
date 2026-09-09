import type { WaitingListStatus } from '@/types/counsellors-desk';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';
import { isWaitingListPreAuthQueue } from '@/lib/counsellors-desk/waiting-list-preauth';

export type WaitingListAttentionLabel =
  | 'CCMS Awaiting'
  | 'Pre-Auth Required'
  | 'Follow-up Due'
  | 'Upgrade Requested'
  | null;

export function resolveWaitingListAttention(input: {
  status: WaitingListStatus;
  patientType?: string | null;
  ccmsState?: string | null;
  hasCcmsCase: boolean;
  ccmsDecision?: string | null;
  followUpDate?: string;
  followUpReason?: string;
  previousPackage?: string;
  newPackage?: string;
  upgradeDiff?: number;
}): WaitingListAttentionLabel {
  if (
    isWaitingListPreAuthQueue({
      patientType: input.patientType,
      ccmsState: input.ccmsState,
      hasCcmsCase: input.hasCcmsCase,
      ccmsDecision: input.ccmsDecision,
    })
  ) {
    return 'CCMS Awaiting';
  }

  if (isCoveragePaymentTypeValue(input.patientType)) {
    return 'Pre-Auth Required';
  }

  if (
    input.status === 'RepeatCounselling' &&
    (Boolean(input.followUpDate) || Boolean(input.followUpReason))
  ) {
    return 'Follow-up Due';
  }

  if (
    input.status === 'AddOnSurgery' &&
    (Boolean(input.previousPackage) ||
      Boolean(input.newPackage) ||
      (typeof input.upgradeDiff === 'number' && input.upgradeDiff !== 0))
  ) {
    return 'Upgrade Requested';
  }

  return null;
}
