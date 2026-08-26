import type { DecisionType, ScheduleData } from '@/types/counsellors-desk';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { findCounsellorVariant } from '@/lib/master-data/clinical-catalog-master';
import { COVERAGE_PAYMENT_TYPES, isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';



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

  decision: DecisionType | '';

  schedule: ScheduleData | null;

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



export function computePhaseCompletion(input: CounsellingPhaseInput): CounsellingPhaseCompletion {

  const scheduleRequired = input.decision === 'DateForSurgery';

  const scheduleComplete =

    !scheduleRequired || !!(input.schedule?.selectedDate && input.schedule?.doctor);



  return {

    estimate: !!(input.selectedVariantId || input.hasActiveTemplate),

    decision: !!input.paymentType && !!input.decision && scheduleComplete,

    wrapup: true,

  };

}



export function validateEstimatePhase(ctx: CounsellingPhaseValidationContext): string | null {

  if (!ctx.selectedVariantId && !ctx.hasActiveTemplate) {

    return 'Select a procedure or package to continue';

  }

  if (!ctx.selectedVariantId) return null;



  const variant = findCounsellorVariant(ctx.procedureVariants, ctx.selectedVariantId);

  if (!variant) return null;



  if (variant.subOptions?.length && !variant.hasIolOptions && !ctx.variantSubOption) {

    return 'Please select a sub-type for the selected procedure';

  }

  if (variant.hasIolOptions && ctx.iolOptionCount > 0 && !ctx.selectedIolId) {

    return 'Please select an IOL for the selected procedure';

  }

  return null;

}



export function validateDecisionPhase(ctx: CounsellingPhaseInput): string | null {

  if (!ctx.paymentType) return 'Please select a payment type';

  if (!ctx.decision) return 'Please select a patient decision';

  if (ctx.decision === 'DateForSurgery') {

    if (!ctx.schedule?.selectedDate || !ctx.schedule?.doctor) {

      return 'Please schedule surgery date and doctor';

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



/** Infer which phases were completed when reopening a saved session. */

export function inferVisitedPhases(input: CounsellingPhaseInput): Set<CounsellingPhase> {

  const visited = new Set<CounsellingPhase>(['estimate']);

  const completion = computePhaseCompletion(input);



  if (completion.estimate) {

    visited.add('estimate');

  }

  if (completion.decision) {

    visited.add('estimate');

    visited.add('decision');

  }

  if (

    input.counsellorNotes.trim() ||

    input.patientRemarks.trim() ||

    input.wantToSeeDoctor ||

    input.interestedToUpgrade ||

    input.notRequiredPreAuth

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


