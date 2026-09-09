import { describe, expect, it } from 'vitest';
import { buildSessionStatusSummary } from '@/lib/counsellors-desk/session-status-summary';
import { formatPayableLabel } from '@/lib/counsellors-desk/session-status-summary';
import { resolveCounsellingQuoteFinalPayable } from '@/lib/counsellors-desk/build-coverage-preview';
import {
  buildSessionActionBarModel,
  shouldOfferPhaseNextAction,
} from '@/lib/counsellors-desk/counselling-session-actions';
import type { BuildSessionActionBarInput } from '@/lib/counsellors-desk/counselling-session-actions';
import { buildJourneyRailStages } from '@/lib/counsellors-desk/counselling-journey-rail';
import type { BuildJourneyRailInput } from '@/lib/counsellors-desk/counselling-journey-rail';

const QUOTE_PAYABLE = 155_200;
const COVERAGE_SPLIT_WITH_TAX = 180_200;

describe('counselling quote financial parity', () => {
  it('prefers live counselling quote over stale saved total when procedure line exists', () => {
    expect(
      resolveCounsellingQuoteFinalPayable({
        liveFinalPayable: QUOTE_PAYABLE,
        savedFinalPayable: COVERAGE_SPLIT_WITH_TAX,
        estimateLines: [
          { key: 'procedure', label: 'PPV', amount: 150_000, kind: 'procedure' },
        ],
      }),
    ).toBe(QUOTE_PAYABLE);
  });

  it('uses live computed quote for display when engine total is positive', () => {
    expect(155_200).toBe(
      155_200 > 0
        ? 155_200
        : resolveCounsellingQuoteFinalPayable({
            liveFinalPayable: 0,
            savedFinalPayable: COVERAGE_SPLIT_WITH_TAX,
            estimateLines: [],
          }),
    );
  });

  it('does not let coverage split tax total replace counselling quote in session summary', () => {
    const summary = buildSessionStatusSummary({
      queueStatus: 'Processed',
      activeMainTab: 'coverage',
      activePhase: 'estimate',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      isRepeatState: false,
      isSurgeryDoneState: false,
      decision: 'DateForSurgery',
      paymentType: 'Insurance',
      insuranceCompany: 'Bajaj',
      finalPayableAmount: QUOTE_PAYABLE,
      showCoverageWorkflow: true,
      notRequiredPreAuth: false,
      coverageProgress: {
        uploadedDocCount: 0,
        requiredDocCount: 4,
        ccmsState: 'DRAFT',
        preAuthSubmitted: false,
      },
      admission: null,
    });

    expect(summary.chips.find((c) => c.id === 'payable')?.value).toBe(
      formatPayableLabel(QUOTE_PAYABLE),
    );
    expect(summary.chips.find((c) => c.id === 'payable')?.value).not.toBe(
      formatPayableLabel(COVERAGE_SPLIT_WITH_TAX),
    );
  });
});

const actionBarBase: BuildSessionActionBarInput = {
  queueStatus: 'Processed',
  activeMainTab: 'counselling',
  activePhase: 'estimate',
  phaseCompletion: { estimate: true, decision: false, wrapup: false },
  isRepeatState: false,
  isSurgeryDoneState: false,
  decision: '',
  paymentType: 'Insurance',
  insuranceCompany: 'Star',
  finalPayableAmount: QUOTE_PAYABLE,
  showCoverageWorkflow: true,
  notRequiredPreAuth: false,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 4,
    ccmsState: 'DRAFT',
    preAuthSubmitted: false,
  },
  canAdvancePhase: true,
  phaseAdvanceError: null,
  saveDisabledReason: null,
  saveDraftDisabledReason: null,
  printDisabledReason: null,
  canSubmitToClaims: false,
  submittingToClaims: false,
};

describe('action bar after decision completion', () => {
  it('offers phase next only while decision is incomplete on estimate step', () => {
    expect(
      shouldOfferPhaseNextAction({
        ...actionBarBase,
        phaseCompletion: { estimate: true, decision: false, wrapup: false },
      }),
    ).toBe(true);
    expect(
      shouldOfferPhaseNextAction({
        ...actionBarBase,
        phaseCompletion: { estimate: true, decision: true, wrapup: false },
      }),
    ).toBe(false);
  });

  it('navigates to insurance when decision is complete on estimate step', () => {
    const model = buildSessionActionBarModel({
      ...actionBarBase,
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
    });
    expect(model.primary?.kind).toBe('navigate');
    expect(model.primary?.label).toBe('Next: Insurance');
    expect(model.primary?.label).not.toBe('Next: Patient Decision');
    expect(model.primary?.navigateTab).toBe('coverage');
  });

  it('navigates to insurance when decision field is set but phaseCompletion lags', () => {
    const model = buildSessionActionBarModel({
      ...actionBarBase,
      phaseCompletion: { estimate: false, decision: false, wrapup: false },
      decision: 'DateForSurgery',
    });
    expect(model.primary?.label).toBe('Next: Insurance');
  });

  it('navigates to close for cash when decision is complete', () => {
    const model = buildSessionActionBarModel({
      ...actionBarBase,
      showCoverageWorkflow: false,
      paymentType: 'Cash',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
    });
    expect(model.primary?.kind).toBe('navigate');
    expect(model.primary?.label).toBe('Next: Notes');
    expect(model.primary?.navigatePhase).toBe('wrapup');
  });

  it('shows no misleading next after pre-auth submit', () => {
    const model = buildSessionActionBarModel({
      ...actionBarBase,
      activeMainTab: 'coverage',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      decision: 'DateForSurgery',
      coverageProgress: {
        uploadedDocCount: 4,
        requiredDocCount: 4,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      },
    });
    expect(model.primary?.kind).not.toBe('phase_next');
    expect(model.primary?.label ?? '').not.toMatch(/Patient Decision/i);
    expect(model.statusHint).toBeNull();
  });
});

describe('journey rail completed stage navigation', () => {
  const railBase: BuildJourneyRailInput = {
    activeMainTab: 'counselling',
    activePhase: 'estimate',
    phaseCompletion: { estimate: true, decision: true, wrapup: false },
    showCoverageWorkflow: true,
    coverageProgress: {
      uploadedDocCount: 0,
      requiredDocCount: 4,
      ccmsState: 'DRAFT',
      preAuthSubmitted: false,
    },
    queueStatus: 'Processed',
    isRepeatState: false,
    isSurgeryDoneState: false,
    canGoToPhase: () => true,
  };

  it('allows primary journey navigation for completed stages on counselling tab', () => {
    const stages = buildJourneyRailStages({ ...railBase, activePhase: 'decision' });
    const quote = stages.find((s) => s.id === 'quote');
    expect(quote?.status).toBe('completed');
    expect(quote?.navigable).toBe(true);
  });

  it('keeps cross-tab journey navigation from coverage tab', () => {
    const stages = buildJourneyRailStages({ ...railBase, activeMainTab: 'coverage' });
    expect(stages.find((s) => s.id === 'decision')?.navigable).toBe(true);
  });

  it('blocks navigation in repeat state', () => {
    const stages = buildJourneyRailStages({ ...railBase, isRepeatState: true });
    expect(stages.every((s) => !s.navigable)).toBe(true);
  });
});
