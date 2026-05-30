import type { CcmsTabKey } from './ccms-next-step';
import { getCcmsNextStep } from './ccms-next-step';
import {
  checkActionPrerequisite,
  type ActionPrerequisiteContext,
} from './ccms-action-prerequisites';
import type { PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import type { ClaimPacket } from '@/lib/api/ccms/ccms-claims.api';
import type { Settlement } from '@/lib/api/ccms/ccms-settlements.api';

export interface TabIndicator {
  pending: boolean;
  isNext: boolean;
}

const WORKFLOW_TABS: CcmsTabKey[] = [
  'authorization', 'billing', 'claims', 'settlement',
];

export function computeTabIndicators(
  ctx: ActionPrerequisiteContext,
  preAuths: PreAuthorization[],
  claims: ClaimPacket[],
  settlements: Settlement[],
): Partial<Record<CcmsTabKey, TabIndicator>> {
  const state = ctx.case_?.currentState ?? '';
  const nextTab = getCcmsNextStep(state)?.tab;

  const intakeStates = new Set([
    'DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED',
  ]);
  const inIntake = intakeStates.has(state);

  const authPending = preAuths.some(pa => {
    const s = pa.status.toUpperCase();
    return s === 'PENDING' || s === 'SENT' || s === 'CLARIFICATION';
  }) || (
    !inIntake && checkActionPrerequisite('generatePreAuth', ctx).allowed
  );

  const billingPending = checkActionPrerequisite('allocateBill', ctx).allowed;

  const claim = claims[0];
  const cs = claim?.status?.toLowerCase() ?? '';
  const claimsPending = !claim
    ? checkActionPrerequisite('generateClaim', ctx).allowed
    : cs === 'draft' || cs === 'ready' || cs === 'submitted';

  const totalClaimed = claim?.claimedAmount ?? 0;
  const totalSettled = settlements.reduce((s, x) => s + x.settledAmount, 0);
  const outstanding = Math.max(totalClaimed - totalSettled, 0);

  const settlementPending =
    (outstanding > 0 && checkActionPrerequisite('recordSettlement', ctx).allowed)
    || checkActionPrerequisite('reconcile', ctx).allowed
    || checkActionPrerequisite('closeCase', ctx).allowed;

  const map: Partial<Record<CcmsTabKey, TabIndicator>> = {};
  for (const key of WORKFLOW_TABS) {
    const pending =
      key === 'authorization' ? authPending :
      key === 'billing' ? billingPending :
      key === 'claims' ? claimsPending :
      settlementPending;
    map[key] = { pending, isNext: nextTab === key };
  }
  return map;
}

const VALID_TABS = new Set<string>([
  'overview', 'communications', 'authorization', 'billing', 'claims', 'settlement', 'events',
]);

export function parseTabParam(value: string | null): CcmsTabKey | null {
  if (!value || !VALID_TABS.has(value)) return null;
  return value as CcmsTabKey;
}
