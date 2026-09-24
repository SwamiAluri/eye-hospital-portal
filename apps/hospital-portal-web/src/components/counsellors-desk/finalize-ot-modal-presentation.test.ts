import { describe, expect, it } from 'vitest';
import {
  FINALIZE_OT_MODAL_SECTIONS,
  FINALIZE_OT_NOTES_WEIGHT,
  resolveFinalizeOtModalFooterActions,
  shouldShowPatientDetailsBlock,
  shouldShowCancellationReason,
} from '@/components/counsellors-desk/finalize-ot-modal-presentation';
import { resolveFinalizeQueuePrimaryAction } from '@/lib/counsellors-desk/finalize-ot-authorization';

describe('finalize OT modal presentation IA', () => {
  it('uses the four primary widgets plus a slim notes area', () => {
    expect(FINALIZE_OT_MODAL_SECTIONS).toEqual([
      'Surgery & Schedule',
      'Anaesthesia & Team',
      'Financial',
      'Outpatient Safety',
      'Notes',
    ]);
    expect(FINALIZE_OT_NOTES_WEIGHT).toBe('slim');
  });

  it('does not present the redundant Patient Details body block', () => {
    expect(shouldShowPatientDetailsBlock()).toBe(false);
  });

  it('shows cancellation reason only for Cancelled', () => {
    expect(shouldShowCancellationReason('Cancelled')).toBe(true);
    expect(shouldShowCancellationReason('NotConfirmed')).toBe(false);
    expect(shouldShowCancellationReason('Confirmed')).toBe(false);
    expect(shouldShowCancellationReason('Finalised')).toBe(false);
    expect(shouldShowCancellationReason('OTPrepared')).toBe(false);
    expect(shouldShowCancellationReason('SurgeryDone')).toBe(false);
  });
});

/**
 * Package LA — state-aware footer (PD-FS-LA-02 Option A).
 * C-LA-04 DEFERRED: Cancel Surgery remains on NotConfirmed / Confirmed / Finalised.
 * Finalise is queue-only for Confirmed (not modal footer).
 */
describe('Package LA — FinalizeOtModal footer action matrix', () => {
  it('NotConfirmed → Save · Confirm · Cancel Surgery', () => {
    expect(resolveFinalizeOtModalFooterActions('NotConfirmed')).toEqual([
      'save',
      'confirm',
      'cancel_surgery',
    ]);
  });

  it('Confirmed → Save (will revert) · Cancel Surgery (no Finalise)', () => {
    expect(resolveFinalizeOtModalFooterActions('Confirmed')).toEqual([
      'save_will_revert',
      'cancel_surgery',
    ]);
    expect(resolveFinalizeOtModalFooterActions('Confirmed')).not.toContain('finalise');
  });

  it('Finalised → Save (will revert) · Cancel Surgery', () => {
    expect(resolveFinalizeOtModalFooterActions('Finalised')).toEqual([
      'save_will_revert',
      'cancel_surgery',
    ]);
  });

  it('OTPrepared → Reopen only (no Cancel / Save / Confirm / Finalise)', () => {
    expect(resolveFinalizeOtModalFooterActions('OTPrepared')).toEqual(['reopen']);
  });

  it('SurgeryDone → no mutation actions (Close only)', () => {
    expect(resolveFinalizeOtModalFooterActions('SurgeryDone')).toEqual([]);
  });

  it('Cancelled → Reopen only', () => {
    expect(resolveFinalizeOtModalFooterActions('Cancelled')).toEqual(['reopen']);
  });

  it('Confirmed queue primary action remains Finalise (modal Finalise removed)', () => {
    expect(resolveFinalizeQueuePrimaryAction('Confirmed', true).action).toBe('finalise');
  });
});
