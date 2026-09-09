import { describe, expect, it } from 'vitest';
import {
  FINALIZE_OT_MODAL_SECTIONS,
  FINALIZE_OT_NOTES_WEIGHT,
  shouldShowPatientDetailsBlock,
  shouldShowCancellationReason,
} from '@/components/counsellors-desk/finalize-ot-modal-presentation';

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
