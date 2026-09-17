import { describe, expect, it } from 'vitest';
import {
  CLOSE_FORBIDDEN_MUTATIONS,
  resolveCloseNavigation,
} from './counselling-session-close';
import { buildSessionActionBarModel } from './counselling-session-actions';
import type { BuildSessionActionBarInput } from './counselling-session-actions';
import { resolveSessionBackTarget } from './counselling-session-navigation';

const baseInput: BuildSessionActionBarInput = {
  queueStatus: 'Processed',
  activeMainTab: 'counselling',
  activePhase: 'decision',
  phaseCompletion: { estimate: true, decision: false, wrapup: false },
  isRepeatState: false,
  isSurgeryDoneState: false,
  decision: '',
  paymentType: 'Cash',
  insuranceCompany: '',
  finalPayableAmount: 1000,
  showCoverageWorkflow: false,
  notRequiredPreAuth: false,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 0,
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

describe('counselling-session-close', () => {
  it('clean close navigates immediately', () => {
    expect(resolveCloseNavigation({ isDirty: false })).toEqual({ action: 'navigate' });
  });

  it('dirty close without choice asks for confirmation', () => {
    expect(resolveCloseNavigation({ isDirty: true })).toEqual({ action: 'confirm' });
  });

  it('Save & Close then navigates after save', () => {
    expect(
      resolveCloseNavigation({ isDirty: true, choice: 'save_and_close' }),
    ).toEqual({ action: 'save_then_navigate' });
  });

  it('Leave Without Saving navigates without persist', () => {
    expect(
      resolveCloseNavigation({ isDirty: true, choice: 'leave_without_saving' }),
    ).toEqual({ action: 'navigate_discard' });
  });

  it('Cancel stays in session', () => {
    expect(resolveCloseNavigation({ isDirty: true, choice: 'cancel' })).toEqual({
      action: 'stay',
    });
  });

  it('Close is always shown and is distinct from Back/Next/Finish', () => {
    const model = buildSessionActionBarModel(baseInput);
    expect(model.showClose).toBe(true);
    expect(model.showPhaseBack).toBe(true);
    expect(model.primary?.kind).toBe('phase_next');
    expect(model.primary?.kind).not.toBe('save_session');
  });

  it('Back from Decision remains phase navigation to Quote', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'counselling',
        activePhase: 'decision',
        showCoverageWorkflow: false,
      }),
    ).toEqual({ tab: 'counselling', phase: 'estimate', finishSummaryActive: false });
  });

  it('Close forbidden mutation list documents lifecycle safety', () => {
    expect(CLOSE_FORBIDDEN_MUTATIONS).toContain('complete');
    expect(CLOSE_FORBIDDEN_MUTATIONS).toContain('cancel');
    expect(CLOSE_FORBIDDEN_MUTATIONS).toContain('PatientIntention');
    expect(CLOSE_FORBIDDEN_MUTATIONS).toContain('ownership');
  });

  it('shows Close on Finish summary without Save Draft / primary finish CTA', () => {
    const model = buildSessionActionBarModel({
      ...baseInput,
      finishSummaryActive: true,
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
    });
    expect(model.showClose).toBe(true);
    expect(model.showSaveDraft).toBe(false);
    expect(model.primary).toBeNull();
  });
});
