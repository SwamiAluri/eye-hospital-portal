import type { DecisionType, ScheduleData } from '@/types/counsellors-desk';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { findCounsellorVariant } from '@/lib/master-data/clinical-catalog-master';
import { COVERAGE_PAYMENT_TYPES, isCoveragePaymentTypeValue, requiresInsuranceCompany } from '@/lib/counsellors-desk/session-utils';

export type CounsellingPhase = 'estimate' | 'decision' | 'wrapup';

export const COUNSELLING_PHASE_ORDER: CounsellingPhase[] = ['estimate', 'decision', 'wrapup'];

export interface CounsellingPhaseDefinition {
  id: CounsellingPhase;
  label: string;
  shortLabel: string;
  description: string;
  testId: string;
}

export const COUNSELLING_PHASES: CounsellingPhaseDefinition[] = [
  {
    id: 'estimate',
    label: counsellingCopy.buildQuote,
    shortLabel: 'Quote',
    description: 'Procedure, package & investigations',
    testId: counsellingTestIds.phase('estimate'),
  },
  {
    id: 'decision',
    label: counsellingCopy.patientDecision,
    shortLabel: 'Decision',
    description: 'Payment, decision & schedule',
    testId: counsellingTestIds.phase('decision'),
  },
  {
    id: 'wrapup',
    label: counsellingCopy.sessionNotes,
    shortLabel: 'Notes',
    description: 'Notes & session options',
    testId: counsellingTestIds.phase('wrapup'),
  },
];

export interface CounsellingPhaseInput {
  selectedVariantId: string | null;
  hasActiveTemplate: boolean;
  selectedIolId: string | null;
  variantSubOption: string | null;
  iolOptionCount: number;
  paymentType: string;
  insuranceCompany: string;
  decision: DecisionType | '';
  schedule: ScheduleData | null;
  followUpReason: string;
  followUpDate: string;
  counsellorNotes: string;
  patientRemarks: string;
  wantToSeeDoctor: boolean;
  interestedToUpgrade: boolean;
  notRequiredPreAuth: boolean;
}

export interface CounsellingPhaseValidationContext extends CounsellingPhaseInput {
  procedureVariants: CounsellorProcedureVariant[];
}

export type CounsellingPhaseCompletion = Record<CounsellingPhase, boolean>;

/** True when the phase passes the same rules as Footer Next / Complete Session gates. */
export function isPhaseComplete(
  phase: CounsellingPhase,
  ctx: CounsellingPhaseValidationContext,
): boolean {
  return validatePhase(phase, ctx) === null;
}

export function computePhaseCompletion(
  ctx: CounsellingPhaseValidationContext,
): CounsellingPhaseCompletion {
  const estimateComplete = isPhaseComplete('estimate', ctx);
  const decisionComplete = isPhaseComplete('decision', ctx);

  return {
    estimate: estimateComplete,
    decision: decisionComplete,
    wrapup: decisionComplete,
  };
}

export function validateEstimatePhase(ctx: CounsellingPhaseValidationContext): string | null {
  if (!ctx.selectedVariantId && !ctx.hasActiveTemplate) {
    return 'Select a procedure or package to continue';
  }
  if (!ctx.selectedVariantId) return null;

  const variant = findCounsellorVariant(ctx.procedureVariants, ctx.selectedVariantId);
  if (!variant) return null;

  if (variant.subOptions?.length && !ctx.variantSubOption) {
    return 'Please select a sub-type for the selected procedure';
  }
  if (
    variant.hasIolOptions &&
    !(variant.subOptions?.length) &&
    ctx.iolOptionCount > 0 &&
    !ctx.selectedIolId
  ) {
    return 'Please select an IOL for the selected procedure';
  }
  return null;
}

export function validateDecisionPhase(ctx: CounsellingPhaseInput): string | null {
  if (!ctx.paymentType) return 'Please select a payment type';
  if (!ctx.decision) return 'Please select a patient decision';

  if (requiresInsuranceCompany(ctx.paymentType) && !ctx.insuranceCompany?.trim()) {
    return 'Please select an insurance company';
  }

  if (ctx.decision === 'DateForSurgery') {
    if (!ctx.schedule?.selectedDate || !ctx.schedule?.doctor) {
      return 'Please schedule surgery date and doctor';
    }
  }

  if (ctx.decision === 'NotInterested' || ctx.decision === 'NeedsTime') {
    if (!ctx.followUpReason?.trim()) {
      return 'Please select a follow-up reason';
    }
    if (!ctx.followUpDate?.trim()) {
      return 'Please select a follow-up date';
    }
  }

  return null;
}

export function validatePhase(
  phase: CounsellingPhase,
  ctx: CounsellingPhaseValidationContext,
): string | null {
  if (phase === 'estimate') return validateEstimatePhase(ctx);
  if (phase === 'decision') return validateDecisionPhase(ctx);
  return null;
}

/** Validate every phase before `targetPhase` (for forward wizard navigation). */
export function validatePhasesBefore(
  targetPhase: CounsellingPhase,
  ctx: CounsellingPhaseValidationContext,
): string | null {
  const targetIdx = COUNSELLING_PHASE_ORDER.indexOf(targetPhase);
  for (let i = 0; i < targetIdx; i++) {
    const error = validatePhase(COUNSELLING_PHASE_ORDER[i], ctx);
    if (error) return error;
  }
  return null;
}

/**
 * Whether the counsellor may open `targetPhase` from `activePhase`.
 * Recorded/completed phases remain safely revisitable without re-running earlier validation.
 */
export function canNavigateToCounsellingPhase(
  targetPhase: CounsellingPhase,
  activePhase: CounsellingPhase,
  ctx: CounsellingPhaseValidationContext,
  phaseCompletion: CounsellingPhaseCompletion,
): boolean {
  const targetIdx = COUNSELLING_PHASE_ORDER.indexOf(targetPhase);
  const activeIdx = COUNSELLING_PHASE_ORDER.indexOf(activePhase);
  if (targetIdx <= activeIdx) return true;
  if (phaseCompletion[targetPhase]) return true;
  return validatePhasesBefore(targetPhase, ctx) === null;
}

/** Decision-phase validation for Complete Session (estimate checks remain in validateCounsellingForSave). */
export function validateSaveSessionDecision(ctx: CounsellingPhaseInput): string | null {
  if (!ctx.decision) return 'Select a patient decision before saving';
  return validateDecisionPhase(ctx);
}

/** Infer which phases were completed when reopening a saved session. */
export function inferVisitedPhases(ctx: CounsellingPhaseValidationContext): Set<CounsellingPhase> {
  const visited = new Set<CounsellingPhase>(['estimate']);
  const completion = computePhaseCompletion(ctx);

  if (completion.estimate) {
    visited.add('estimate');
  }
  if (completion.decision) {
    visited.add('estimate');
    visited.add('decision');
  }
  if (
    ctx.counsellorNotes.trim() ||
    ctx.patientRemarks.trim() ||
    ctx.wantToSeeDoctor ||
    ctx.interestedToUpgrade ||
    ctx.notRequiredPreAuth
  ) {
    visited.add('wrapup');
  }

  return visited;
}

export function nextPhase(phase: CounsellingPhase): CounsellingPhase | null {
  const idx = COUNSELLING_PHASE_ORDER.indexOf(phase);
  return idx >= 0 && idx < COUNSELLING_PHASE_ORDER.length - 1
    ? COUNSELLING_PHASE_ORDER[idx + 1]
    : null;
}

export function prevPhase(phase: CounsellingPhase): CounsellingPhase | null {
  const idx = COUNSELLING_PHASE_ORDER.indexOf(phase);
  return idx > 0 ? COUNSELLING_PHASE_ORDER[idx - 1] : null;
}

export const COVERAGE_TAB_PAYMENT_TYPES = COVERAGE_PAYMENT_TYPES;

export function isCoveragePaymentType(paymentType: string): boolean {
  return isCoveragePaymentTypeValue(paymentType);
}
