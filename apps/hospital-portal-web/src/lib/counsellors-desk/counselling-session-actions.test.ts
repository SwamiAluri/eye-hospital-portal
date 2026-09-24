import { describe, expect, it } from 'vitest';
import { buildSessionActionBarModel } from './counselling-session-actions';
import type { BuildSessionActionBarInput } from './counselling-session-actions';

const baseInput: BuildSessionActionBarInput = {
  queueStatus: 'Processed',
  activeMainTab: 'counselling',
  activePhase: 'estimate',
  phaseCompletion: { estimate: false, decision: false, wrapup: false },
  isRepeatState: false,
  isSurgeryDoneState: false,
  decision: '',
  paymentType: 'Insurance',
  insuranceCompany: 'Star Health',
  finalPayableAmount: null,
  showCoverageWorkflow: true,
  notRequiredPreAuth: false,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 3,
    ccmsState: 'DRAFT',
    preAuthSubmitted: false,
  },
  canAdvancePhase: false,
  phaseAdvanceError: 'Select a procedure or package to continue',
  saveDisabledReason: 'Please select a payment type',
  saveDraftDisabledReason: null,
  printDisabledReason: 'Select a procedure or package to print an estimate',
  canSubmitToClaims: false,
  submittingToClaims: false,
};

describe('counselling-session-actions', () => {
  it('shows phase next as primary on counselling estimate step', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      canAdvancePhase: true,
      phaseAdvanceError: null,
    });
    expect(model.primary?.kind).toBe('phase_next');
    expect(model.primary?.label).toBe('Next: Patient Decision');
    expect(model.showSaveDraft).toBe(true);
  });

  it('shows Complete Session on wrap-up when coverage not pending', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      showCoverageWorkflow: false,
      activePhase: 'wrapup',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      decision: 'NotInterested',
      paymentType: 'Cash',
      saveDisabledReason: null,
      canAdvancePhase: true,
      phaseAdvanceError: null,
    });
    expect(model.primary?.kind).toBe('save_session');
    expect(model.primary?.label).toBe('Complete Session');
  });

  it('shows submit to claims on coverage tab when ready', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      activeMainTab: 'coverage',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      decision: 'DateForSurgery',
      coverageProgress: {
        uploadedDocCount: 3,
        requiredDocCount: 3,
        ccmsState: 'POLICY_CAPTURED',
        preAuthSubmitted: false,
        canSubmitToClaims: true,
      },
      canSubmitToClaims: true,
      saveDisabledReason: null,
    });
    expect(model.primary?.kind).toBe('submit_claims');
    expect(model.primary?.label).toBe('Submit to claims');
    expect(model.showPhaseBack).toBe(true);
  });

  it('shows Back on coverage while waiting for TPA', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      activeMainTab: 'coverage',
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      coverageProgress: {
        uploadedDocCount: 4,
        requiredDocCount: 4,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      },
      saveDisabledReason: null,
    });
    expect(model.showPhaseBack).toBe(true);
  });

  it('shows Close on quote estimate step (not Back — Close leaves session)', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      canAdvancePhase: true,
      phaseAdvanceError: null,
    });
    expect(model.showPhaseBack).toBe(false);
    expect(model.showClose).toBe(true);
  });

  it('shows Back on decision step', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: false, wrapup: false },
      canAdvancePhase: true,
      phaseAdvanceError: null,
    });
    expect(model.showPhaseBack).toBe(true);
  });
  it('shows Complete Session on Quote after decision when waiting for TPA', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      activeMainTab: 'counselling',
      activePhase: 'estimate',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      coverageProgress: {
        uploadedDocCount: 4,
        requiredDocCount: 4,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      },
      saveDisabledReason: null,
      canAdvancePhase: true,
      phaseAdvanceError: null,
    });
    expect(model.primary?.kind).toBe('save_session');
    expect(model.primary?.label).toBe('Complete Session');
  });

  it('avoids misleading next action after pre-auth submit', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      activeMainTab: 'coverage',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      decision: 'Interested',
      coverageProgress: {
        uploadedDocCount: 3,
        requiredDocCount: 3,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      },
      saveDisabledReason: null,
    });
    expect(model.primary?.kind).toBe('save_session');
    expect(model.primary?.kind).not.toBe('phase_next');
    expect(model.primary?.kind).not.toBe('navigate');
  });

  it('shows session complete with Back when queue is done', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      queueStatus: 'Done',
      activePhase: 'wrapup',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      decision: 'DateForSurgery',
      saveDisabledReason: null,
      coverageTabAvailable: true,
    });
    expect(model.primary).toBeNull();
    expect(model.statusHint).toBe('Session complete');
    expect(model.showSaveDraft).toBe(false);
    expect(model.showPhaseBack).toBe(true);
  });

  it('blocks actions in repeat state', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      isRepeatState: true,
    });
    expect(model.primary).toBeNull();
    expect(model.showSaveDraft).toBe(false);
  });

  it('PD-PENDING-READONLY-01: Pending hides Save Draft and mutation CTAs', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      queueStatus: 'Pending',
      canAdvancePhase: true,
      phaseAdvanceError: null,
      saveDraftDisabledReason: null,
    });
    expect(model.primary).toBeNull();
    expect(model.showSaveDraft).toBe(false);
    expect(model.showClose).toBe(true);
    expect(model.statusHint).toMatch(/start counselling/i);
  });

  it('PD-PENDING-READONLY-01: Processing keeps Save Draft and Next: Patient Decision', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      queueStatus: 'Processed',
      canAdvancePhase: true,
      phaseAdvanceError: null,
    });
    expect(model.showSaveDraft).toBe(true);
    expect(model.primary?.label).toBe('Next: Patient Decision');
  });

  it('ownership content lock: Processing non-owner hides Save Draft and mutation CTAs', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      queueStatus: 'Processed',
      canAdvancePhase: true,
      phaseAdvanceError: null,
      contentMutationsLocked: true,
      saveDraftDisabledReason: 'Session is read-only',
    });
    expect(model.showSaveDraft).toBe(false);
    expect(model.primary).toBeNull();
    expect(model.showClose).toBe(true);
    expect(model.statusHint).toBe('Session read-only');
  });

  it('ownership content lock off: current-owner Processing keeps Save Draft usable', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      queueStatus: 'Processed',
      canAdvancePhase: true,
      phaseAdvanceError: null,
      contentMutationsLocked: false,
      saveDraftDisabledReason: null,
    });
    expect(model.showSaveDraft).toBe(true);
    expect(model.saveDraftDisabledReason).toBeNull();
    expect(model.primary?.label).toBe('Next: Patient Decision');
  });

  it('after repeat start (Processed, finish sealed off) does not show Counselling completed', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      queueStatus: 'Processed',
      isRepeatState: false,
      finishSummaryActive: false,
      decision: 'NeedsTime',
      canAdvancePhase: true,
      phaseAdvanceError: null,
      saveDisabledReason: null,
    });
    expect(model.statusHint).not.toBe('Counselling completed');
    expect(model.showSaveDraft).toBe(true);
  });

  it('after decision complete on Quote still offers Next: Patient Decision', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      canAdvancePhase: true,
      phaseAdvanceError: null,
      coverageTabAvailable: true,
    });
    expect(model.primary?.label).toBe('Next: Patient Decision');
    expect(model.primary?.kind).toBe('phase_next');
  });

  it('after decision complete on Decision offers Next: Insurance', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      canAdvancePhase: true,
      phaseAdvanceError: null,
      coverageTabAvailable: true,
    });
    expect(model.primary?.label).toBe('Next: Insurance');
    expect(model.primary?.navigateTab).toBe('coverage');
  });

  it('Insurance → Notes with incomplete required docs (not blocked)', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      activeMainTab: 'coverage',
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      coverageProgress: {
        uploadedDocCount: 1,
        requiredDocCount: 4,
        ccmsState: 'POLICY_CAPTURED',
        preAuthSubmitted: false,
      },
      canSubmitToClaims: false,
      saveDisabledReason: null,
      coverageTabAvailable: true,
    });
    expect(model.primary?.kind).toBe('navigate');
    expect(model.primary?.label).toBe('Next: Notes');
    expect(model.showSaveDraft).toBe(true);
  });
});
