import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import type { BillingWithAllocations } from '@/lib/api/ccms/ccms-billing.api';
import type { ClaimPacket } from '@/lib/api/ccms/ccms-claims.api';
import type { Settlement } from '@/lib/api/ccms/ccms-settlements.api';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import { hasDbPrimaryVisitPolicy, PRIMARY_VISIT_POLICY_HINT } from '@/lib/ccms/ccms-visit-policy-prereq';

export type CcmsTabAction =
  | 'generatePreAuth'
  | 'allocateBill'
  | 'generateClaim'
  | 'recordSettlement'
  | 'reconcile'
  | 'closeCase';

export interface ActionPrerequisiteContext {
  case_: CoverageCase | null;
  policies: VisitPolicy[];
  preAuths: PreAuthorization[];
  billing: BillingWithAllocations | null;
  claims: ClaimPacket[];
  settlements: Settlement[];
}

export interface ActionPrerequisiteResult {
  allowed: boolean;
  reason?: string;
}

function hasPrimaryPolicy(ctx: ActionPrerequisiteContext): boolean {
  return hasDbPrimaryVisitPolicy(ctx.policies);
}

function resolvedApprovedAmount(ctx: ActionPrerequisiteContext): number {
  const fromCase = Number(ctx.case_?.approvedAmount ?? 0);
  if (fromCase > 0) return fromCase;
  const fromAuth = ctx.preAuths.reduce(
    (max, pa) => Math.max(max, Number(pa.approvedAmount ?? 0)),
    0,
  );
  return fromAuth;
}

const PREAUTH_STATES = new Set([
  'POLICY_CAPTURED',
  'ELIGIBILITY_VERIFIED',
  'AUTHORIZATION_REQUIRED',
  'CLARIFICATION_REQUIRED',
  'REJECTED',
]);

export function checkActionPrerequisite(
  action: CcmsTabAction,
  ctx: ActionPrerequisiteContext,
): ActionPrerequisiteResult {
  if (!ctx.case_) return { allowed: false, reason: 'Case not loaded.' };

  switch (action) {
    case 'generatePreAuth': {
      if (!PREAUTH_STATES.has(ctx.case_.currentState)) {
        return { allowed: false, reason: 'Pre-auth is not available in the current workflow state.' };
      }
      if (!hasPrimaryPolicy(ctx)) {
        return {
          allowed: false,
          reason: PRIMARY_VISIT_POLICY_HINT,
        };
      }
      return { allowed: true };
    }

    case 'allocateBill': {
      if (resolvedApprovedAmount(ctx) <= 0) {
        return {
          allowed: false,
          reason: 'Record TPA approval with an approved amount before allocating the bill.',
        };
      }
      return { allowed: true };
    }

    case 'generateClaim': {
      if (!ctx.billing) {
        return { allowed: false, reason: 'Allocate the bill on the Billing tab before generating a claim.' };
      }
      return { allowed: true };
    }

    case 'recordSettlement': {
      if (ctx.claims.length === 0) {
        return { allowed: false, reason: 'Generate a claim packet before recording settlement.' };
      }
      if (ctx.case_.currentState === 'RECONCILED' || ctx.case_.currentState === 'CLOSED') {
        return { allowed: false, reason: 'Case is already reconciled or closed.' };
      }
      return { allowed: true };
    }

    case 'reconcile': {
      if (ctx.settlements.length === 0) {
        return { allowed: false, reason: 'Record at least one settlement payment before reconciling.' };
      }
      if (ctx.case_.currentState === 'RECONCILED' || ctx.case_.currentState === 'CLOSED') {
        return { allowed: false, reason: 'Case is already reconciled or closed.' };
      }
      return { allowed: true };
    }

    case 'closeCase': {
      if (ctx.case_.currentState !== 'RECONCILED') {
        return { allowed: false, reason: 'Reconcile settlement first, then close the case.' };
      }
      return { allowed: true };
    }

    default:
      return { allowed: true };
  }
}
