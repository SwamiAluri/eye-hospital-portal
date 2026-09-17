/**
 * Phase 3G.4 — Complete Session terminology contract.
 * Internal kind remains `save_session`; user-facing label is Complete Session.
 */
import { describe, expect, it } from 'vitest';
import { buildSessionActionBarModel } from './counselling-session-actions';
import type { BuildSessionActionBarInput } from './counselling-session-actions';
import { counsellingCopy } from './counselling-copy';
import { finishOutcomeDetail } from './counselling-finish-outcome';
import { buildSessionStatusSummary } from './session-status-summary';

const wrapupReady: BuildSessionActionBarInput = {
  queueStatus: 'Processed',
  activeMainTab: 'counselling',
  activePhase: 'wrapup',
  phaseCompletion: { estimate: true, decision: true, wrapup: true },
  isRepeatState: false,
  isSurgeryDoneState: false,
  decision: 'DateForSurgery',
  paymentType: 'Cash',
  insuranceCompany: '',
  finalPayableAmount: 50000,
  showCoverageWorkflow: false,
  notRequiredPreAuth: false,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 0,
    ccmsState: null,
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

describe('Phase 3G.4 — Complete Session label contract', () => {
  it('A — final CTA label is Complete Session, not Save session', () => {
    const model = buildSessionActionBarModel(wrapupReady);
    expect(model.primary?.kind).toBe('save_session');
    expect(model.primary?.label).toBe('Complete Session');
    expect(model.primary?.label).not.toMatch(/Save session/i);
    expect(counsellingCopy.completeSession).toBe('Complete Session');
  });

  it('A — Save Draft remains distinct intermediate action', () => {
    const model = buildSessionActionBarModel(wrapupReady);
    expect(model.showSaveDraft).toBe(true);
    expect(counsellingCopy.saveDraft).toBe('Save Draft');
  });

  it('D — Close remains available and is not the completion CTA', () => {
    const model = buildSessionActionBarModel(wrapupReady);
    expect(model.showClose).toBe(true);
    expect(model.primary?.kind).toBe('save_session');
  });

  it('E — Completing / saving disabled reason disables primary (double-submit gate)', () => {
    const completing = buildSessionActionBarModel({
      ...wrapupReady,
      saveDisabledReason: 'Completing session…',
    });
    expect(completing.primary?.kind).toBe('save_session');
    expect(completing.primary?.disabledReason).toBe('Completing session…');

    const drafting = buildSessionActionBarModel({
      ...wrapupReady,
      saveDisabledReason: 'Saving…',
    });
    expect(drafting.primary?.disabledReason).toBe('Saving…');
  });

  it('G — incomplete insurance docs do not change Complete Session label/kind', () => {
    const model = buildSessionActionBarModel({
      ...wrapupReady,
      paymentType: 'Insurance',
      insuranceCompany: 'Star Health',
      showCoverageWorkflow: true,
      coverageProgress: {
        uploadedDocCount: 0,
        requiredDocCount: 4,
        ccmsState: 'POLICY_CAPTURED',
        preAuthSubmitted: false,
      },
    });
    expect(model.primary?.kind).toBe('save_session');
    expect(model.primary?.label).toBe('Complete Session');
    expect(model.primary?.disabledReason).toBeNull();
    expect(model.showSaveDraft).toBe(true);
  });

  it('status nextAction uses Complete Session wording', () => {
    const summary = buildSessionStatusSummary({
      queueStatus: 'Processed',
      activeMainTab: 'counselling',
      activePhase: 'wrapup',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      isRepeatState: false,
      isSurgeryDoneState: false,
      decision: 'DateForSurgery',
      paymentType: 'Cash',
      insuranceCompany: '',
      finalPayableAmount: 50000,
      showCoverageWorkflow: false,
      notRequiredPreAuth: false,
      coverageProgress: {
        uploadedDocCount: 0,
        requiredDocCount: 0,
        ccmsState: null,
        preAuthSubmitted: false,
      },
    });
    expect(summary.nextAction).toBe('Complete Session');
  });

  it('Finish outcome copy directs to Complete Session, not Save session', () => {
    expect(finishOutcomeDetail('Processed' as never)).toMatch(/Complete Session/);
    expect(finishOutcomeDetail('Processed' as never)).not.toMatch(/Save session/i);
    expect(finishOutcomeDetail('Done')).not.toMatch(/Save session/i);
  });
});
