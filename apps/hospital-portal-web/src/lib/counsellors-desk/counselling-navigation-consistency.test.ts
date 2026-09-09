import { describe, expect, it } from 'vitest';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { buildJourneyRailStages } from './counselling-journey-rail';
import {
  canNavigateToCounsellingPhase,
  computePhaseCompletion,
  type CounsellingPhaseInput,
  type CounsellingPhaseValidationContext,
} from './counselling-progress';

const VARIANT_WITH_SUBTYPE: CounsellorProcedureVariant = {
  id: 'var-sub',
  name: 'Phaco with subtype',
  price: 10000,
  defaultPrice: 10000,
  categoryCode: 'CAT',
  categoryName: 'Cataract',
  subOptions: ['Standard', 'Premium'],
  hasIolOptions: false,
};

function baseInput(overrides: Partial<CounsellingPhaseInput> = {}): CounsellingPhaseInput {
  return {
    selectedVariantId: null,
    hasActiveTemplate: false,
    selectedIolId: null,
    variantSubOption: null,
    iolOptionCount: 0,
    paymentType: '',
    insuranceCompany: '',
    decision: '',
    schedule: null,
    followUpReason: '',
    followUpDate: '',
    counsellorNotes: '',
    patientRemarks: '',
    wantToSeeDoctor: false,
    interestedToUpgrade: false,
    notRequiredPreAuth: false,
    ...overrides,
  };
}

function ctx(
  input: Partial<CounsellingPhaseInput> = {},
  procedureVariants: CounsellorProcedureVariant[] = [],
): CounsellingPhaseValidationContext {
  return { ...baseInput(input), procedureVariants };
}

function buildCanGoToPhase(
  activePhase: 'estimate' | 'decision' | 'wrapup',
  context: CounsellingPhaseValidationContext,
) {
  const phaseCompletion = computePhaseCompletion(context);
  return (phase: 'estimate' | 'decision' | 'wrapup') =>
    canNavigateToCounsellingPhase(phase, activePhase, context, phaseCompletion);
}

describe('counselling-navigation-consistency', () => {
  it('keeps journey rail navigability aligned with canNavigateToCounsellingPhase', () => {
    const context = ctx(
      {
        selectedVariantId: 'var-sub',
        paymentType: 'Insurance',
        insuranceCompany: 'Bajaj',
        decision: 'DateForSurgery',
        schedule: { selectedDate: '2026-09-15', doctor: 'Dr A', operationTheatre: 'OT-1' },
      },
      [VARIANT_WITH_SUBTYPE],
    );
    const canGoToPhase = buildCanGoToPhase('estimate', context);
    const stages = buildJourneyRailStages({
      activeMainTab: 'coverage',
      activePhase: 'estimate',
      phaseCompletion: computePhaseCompletion(context),
      showCoverageWorkflow: true,
      coverageProgress: {
        uploadedDocCount: 4,
        requiredDocCount: 4,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      },
      queueStatus: 'Processed',
      isRepeatState: false,
      isSurgeryDoneState: false,
      canGoToPhase,
    });

    for (const stage of stages) {
      if (stage.id === 'insurance' || stage.id === 'close') continue;
      const targetPhase =
        stage.id === 'quote'
          ? 'estimate'
          : stage.id === 'decision'
            ? 'decision'
            : 'wrapup';
      if (stage.navigable) {
        expect(canGoToPhase(targetPhase)).toBe(true);
      }
    }
  });

  it('enables Notes and Decision pills when decision is recorded on an estimate-invalid session', () => {
    const context = ctx(
      {
        selectedVariantId: 'var-sub',
        paymentType: 'Cash',
        decision: 'Interested',
      },
      [VARIANT_WITH_SUBTYPE],
    );
    const canGoToPhase = buildCanGoToPhase('estimate', context);

    expect(canGoToPhase('decision')).toBe(true);
    expect(canGoToPhase('wrapup')).toBe(true);
  });
});
