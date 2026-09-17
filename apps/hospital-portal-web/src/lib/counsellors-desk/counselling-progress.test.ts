import { describe, expect, it } from 'vitest';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import {
  canNavigateToCounsellingPhase,
  computePhaseCompletion,
  validateDecisionPhase,
  validateEstimatePhase,
  validatePhasesBefore,
  validateSaveSessionDecision,
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

const VARIANT_EDOF_DUAL: CounsellorProcedureVariant = {
  id: 'var-edof',
  name: 'EDOF Lens (40cm-Distance)',
  price: 120000,
  defaultPrice: 120000,
  categoryCode: 'CAT',
  categoryName: 'Cataract',
  subOptions: ['Alcon', 'Hoya'],
  hasIolOptions: true,
};

const VARIANT_WITH_IOL: CounsellorProcedureVariant = {
  id: 'var-iol',
  name: 'Phaco with IOL',
  price: 12000,
  defaultPrice: 12000,
  categoryCode: 'CAT',
  categoryName: 'Cataract',
  hasIolOptions: true,
};

const VARIANT_SIMPLE: CounsellorProcedureVariant = {
  id: 'var-simple',
  name: 'Simple procedure',
  price: 8000,
  defaultPrice: 8000,
  categoryCode: 'CAT',
  categoryName: 'Cataract',
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

describe('counselling-progress — D018 Build Quote completion', () => {
  it('marks estimate complete when required procedure data is valid', () => {
    const completion = computePhaseCompletion(
      ctx(
        { selectedVariantId: 'var-simple' },
        [VARIANT_SIMPLE],
      ),
    );
    expect(completion.estimate).toBe(true);
  });

  it('marks estimate incomplete when sub-type is required but missing', () => {
    const completion = computePhaseCompletion(
      ctx({ selectedVariantId: 'var-sub' }, [VARIANT_WITH_SUBTYPE]),
    );
    expect(completion.estimate).toBe(false);
    expect(validateEstimatePhase(ctx({ selectedVariantId: 'var-sub' }, [VARIANT_WITH_SUBTYPE]))).toBe(
      'Please select a sub-type for the selected procedure',
    );
  });

  it('marks estimate complete when sub-type is selected', () => {
    const completion = computePhaseCompletion(
      ctx(
        { selectedVariantId: 'var-sub', variantSubOption: 'Standard' },
        [VARIANT_WITH_SUBTYPE],
      ),
    );
    expect(completion.estimate).toBe(true);
  });

  it('requires Alcon/Hoya sub-type for EDOF even when hasIolOptions is true', () => {
    expect(
      validateEstimatePhase(
        ctx({ selectedVariantId: 'var-edof', iolOptionCount: 2 }, [VARIANT_EDOF_DUAL]),
      ),
    ).toBe('Please select a sub-type for the selected procedure');

    expect(
      validateEstimatePhase(
        ctx(
          { selectedVariantId: 'var-edof', variantSubOption: 'Hoya', iolOptionCount: 2 },
          [VARIANT_EDOF_DUAL],
        ),
      ),
    ).toBeNull();
  });

  it('marks estimate incomplete when IOL is required but missing', () => {
    const completion = computePhaseCompletion(
      ctx(
        { selectedVariantId: 'var-iol', iolOptionCount: 3 },
        [VARIANT_WITH_IOL],
      ),
    );
    expect(completion.estimate).toBe(false);
    expect(
      validateEstimatePhase(ctx({ selectedVariantId: 'var-iol', iolOptionCount: 3 }, [VARIANT_WITH_IOL])),
    ).toBe('Please select an IOL for the selected procedure');
  });

  it('marks estimate complete when IOL is selected', () => {
    const completion = computePhaseCompletion(
      ctx(
        { selectedVariantId: 'var-iol', selectedIolId: 'iol-1', iolOptionCount: 3 },
        [VARIANT_WITH_IOL],
      ),
    );
    expect(completion.estimate).toBe(true);
  });

  it('marks estimate complete for active package template without procedure variant', () => {
    const completion = computePhaseCompletion(ctx({ hasActiveTemplate: true }));
    expect(completion.estimate).toBe(true);
  });

  it('does not require investigations for estimate completion', () => {
    const completion = computePhaseCompletion(
      ctx({ selectedVariantId: 'var-simple' }, [VARIANT_SIMPLE]),
    );
    expect(completion.estimate).toBe(true);
  });
});

describe('counselling-progress — D019 wizard navigation gates', () => {
  it('blocks forward navigation to decision when estimate is invalid', () => {
    const context = ctx({ selectedVariantId: 'var-sub' }, [VARIANT_WITH_SUBTYPE]);
    expect(validatePhasesBefore('decision', context)).toBe(
      'Please select a sub-type for the selected procedure',
    );
  });

  it('allows forward navigation to decision when estimate is valid', () => {
    const context = ctx(
      { selectedVariantId: 'var-simple' },
      [VARIANT_SIMPLE],
    );
    expect(validatePhasesBefore('decision', context)).toBeNull();
  });

  it('blocks forward navigation to wrapup when decision is invalid', () => {
    const context = ctx(
      {
        selectedVariantId: 'var-simple',
        paymentType: 'Cash',
        decision: 'NotInterested',
      },
      [VARIANT_SIMPLE],
    );
    expect(validatePhasesBefore('wrapup', context)).toBe('Please select a follow-up reason');
  });

  it('allows forward navigation to wrapup when estimate and decision are valid', () => {
    const context = ctx(
      {
        selectedVariantId: 'var-simple',
        paymentType: 'Cash',
        decision: 'Interested',
      },
      [VARIANT_SIMPLE],
    );
    expect(validatePhasesBefore('wrapup', context)).toBeNull();
  });
});

describe('counselling-progress — D002 follow-up validation', () => {
  const repeatBase = {
    paymentType: 'Cash',
    decision: 'NotInterested' as const,
  };

  it('requires follow-up reason for Not Interested', () => {
    expect(
      validateDecisionPhase(baseInput({ ...repeatBase, followUpDate: '2026-09-01' })),
    ).toBe('Please select a follow-up reason');
  });

  it('requires follow-up date for Not Interested', () => {
    expect(
      validateDecisionPhase(baseInput({ ...repeatBase, followUpReason: 'Cost concern' })),
    ).toBe('Please select a follow-up date');
  });

  it('accepts Not Interested when reason and date are present', () => {
    expect(
      validateDecisionPhase(
        baseInput({
          ...repeatBase,
          followUpReason: 'Cost concern',
          followUpDate: '2026-09-01',
        }),
      ),
    ).toBeNull();
  });

  it('requires follow-up reason for Needs Time', () => {
    expect(
      validateDecisionPhase(
        baseInput({
          paymentType: 'Cash',
          decision: 'NeedsTime',
          followUpDate: '2026-09-01',
        }),
      ),
    ).toBe('Please select a follow-up reason');
  });

  it('requires follow-up date for Needs Time', () => {
    expect(
      validateDecisionPhase(
        baseInput({
          paymentType: 'Cash',
          decision: 'NeedsTime',
          followUpReason: 'Family discussion',
        }),
      ),
    ).toBe('Please select a follow-up date');
  });

  it('accepts Needs Time when reason and date are present', () => {
    expect(
      validateDecisionPhase(
        baseInput({
          paymentType: 'Cash',
          decision: 'NeedsTime',
          followUpReason: 'Family discussion',
          followUpDate: '2026-09-15',
        }),
      ),
    ).toBeNull();
  });

  it('does not require follow-up for Interested', () => {
    expect(
      validateDecisionPhase(
        baseInput({ paymentType: 'Cash', decision: 'Interested' }),
      ),
    ).toBeNull();
  });

  it('does not require follow-up for Date for Surgery when schedule is complete', () => {
    expect(
      validateDecisionPhase(
        baseInput({
          paymentType: 'Cash',
          decision: 'DateForSurgery',
          schedule: { selectedDate: '2026-10-01', doctor: 'Dr Smith' },
        }),
      ),
    ).toBeNull();
  });
});

describe('counselling-progress — D003 insurance validation', () => {
  it('requires insurer for Insurance payment type', () => {
    expect(
      validateDecisionPhase(
        baseInput({ paymentType: 'Insurance', decision: 'Interested' }),
      ),
    ).toBe('Please select an insurance company');
  });

  it('accepts Insurance payment when insurer is selected', () => {
    expect(
      validateDecisionPhase(
        baseInput({
          paymentType: 'Insurance',
          insuranceCompany: 'Star Health',
          decision: 'Interested',
        }),
      ),
    ).toBeNull();
  });

  it('does not require insurer for Cash', () => {
    expect(
      validateDecisionPhase(
        baseInput({ paymentType: 'Cash', decision: 'Interested' }),
      ),
    ).toBeNull();
  });

  it('does not require insurer for Staff payment', () => {
    expect(
      validateDecisionPhase(
        baseInput({ paymentType: 'Staff', decision: 'Interested' }),
      ),
    ).toBeNull();
  });

  it('requires insurer for TPA payment type', () => {
    expect(
      validateDecisionPhase(
        baseInput({ paymentType: 'TPA', decision: 'Interested' }),
      ),
    ).toBe('Please select an insurance company');
  });
});

describe('counselling-progress — Complete Session decision validation', () => {
  it('blocks save when repeat decision lacks follow-up information', () => {
    expect(
      validateSaveSessionDecision(
        baseInput({
          paymentType: 'Cash',
          decision: 'NotInterested',
        }),
      ),
    ).toBe('Please select a follow-up reason');
  });

  it('blocks save when insurance payment lacks insurer', () => {
    expect(
      validateSaveSessionDecision(
        baseInput({
          paymentType: 'Insurance',
          decision: 'Interested',
        }),
      ),
    ).toBe('Please select an insurance company');
  });

  it('allows save when repeat decision has complete follow-up', () => {
    expect(
      validateSaveSessionDecision(
        baseInput({
          paymentType: 'Cash',
          decision: 'NeedsTime',
          followUpReason: 'Needs spouse approval',
          followUpDate: '2026-09-20',
        }),
      ),
    ).toBeNull();
  });
});

describe('counselling-progress — phase navigation revisit', () => {
  it('allows revisiting recorded decision when estimate validation currently fails', () => {
    const context = ctx({ selectedVariantId: 'var-sub' }, [VARIANT_WITH_SUBTYPE]);
    const phaseCompletion = computePhaseCompletion(
      ctx(
        {
          selectedVariantId: 'var-sub',
          paymentType: 'Cash',
          decision: 'Interested',
        },
        [VARIANT_WITH_SUBTYPE],
      ),
    );

    expect(phaseCompletion.estimate).toBe(false);
    expect(phaseCompletion.decision).toBe(true);
    expect(validatePhasesBefore('decision', context)).not.toBeNull();
    expect(
      canNavigateToCounsellingPhase('decision', 'estimate', context, phaseCompletion),
    ).toBe(true);
  });

  it('allows opening Notes when decision is recorded even if estimate validation fails', () => {
    const context = ctx({ selectedVariantId: 'var-sub' }, [VARIANT_WITH_SUBTYPE]);
    const phaseCompletion = computePhaseCompletion(
      ctx(
        {
          selectedVariantId: 'var-sub',
          paymentType: 'Insurance',
          insuranceCompany: 'Bajaj',
          decision: 'DateForSurgery',
          schedule: { selectedDate: '2026-09-15', doctor: 'Dr A', operationTheatre: 'OT-1' },
        },
        [VARIANT_WITH_SUBTYPE],
      ),
    );

    expect(phaseCompletion.wrapup).toBe(true);
    expect(validatePhasesBefore('wrapup', context)).not.toBeNull();
    expect(
      canNavigateToCounsellingPhase('wrapup', 'estimate', context, phaseCompletion),
    ).toBe(true);
  });

  it('still blocks forward navigation when the target phase is not yet recorded', () => {
    const context = ctx({ selectedVariantId: 'var-sub' }, [VARIANT_WITH_SUBTYPE]);
    const phaseCompletion = computePhaseCompletion(context);

    expect(phaseCompletion.decision).toBe(false);
    expect(phaseCompletion.estimate).toBe(false);
    expect(
      canNavigateToCounsellingPhase('decision', 'estimate', context, phaseCompletion),
    ).toBe(false);
  });

  it('always allows backward navigation within counselling phases', () => {
    const context = ctx(
      { selectedVariantId: 'var-simple', paymentType: 'Cash', decision: 'Interested' },
      [VARIANT_SIMPLE],
    );
    const phaseCompletion = computePhaseCompletion(context);

    expect(
      canNavigateToCounsellingPhase('estimate', 'decision', context, phaseCompletion),
    ).toBe(true);
  });
});
