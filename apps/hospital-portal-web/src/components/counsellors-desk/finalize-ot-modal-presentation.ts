import type { FinalizeStatus } from '@/types/counsellors-desk';

/** Primary + slim Notes IA for Surgery Finalization modal (presentation only). */
export const FINALIZE_OT_MODAL_SECTIONS = [
  'Surgery & Schedule',
  'Anaesthesia & Team',
  'Financial',
  'Outpatient Safety',
  'Notes',
] as const;

/** Notes must not match primary widget visual weight. */
export const FINALIZE_OT_NOTES_WEIGHT = 'slim' as const;

/**
 * Patient DOB / blood group / contact / address / emergency are not used by
 * validation, save, confirm/finalise/cancel/reopen, checklist, or OT integration
 * in FinalizeOtModal — header identity is sufficient.
 */
export function shouldShowPatientDetailsBlock(): boolean {
  return false;
}

export function shouldShowCancellationReason(status: FinalizeStatus | string): boolean {
  return status === 'Cancelled';
}

/**
 * Package LA — right-side FinalizeOtModal footer actions by lifecycle status.
 * Close is always rendered separately.
 *
 * C-LA-04 DEFERRED: Cancel Surgery remains for NotConfirmed / Confirmed / Finalised.
 * Finalise is intentionally omitted from Confirmed (queue primary CTA only).
 */
export type FinalizeOtModalFooterAction =
  | 'save'
  | 'save_will_revert'
  | 'confirm'
  | 'cancel_surgery'
  | 'reopen';

export function resolveFinalizeOtModalFooterActions(
  status: FinalizeStatus | string,
): FinalizeOtModalFooterAction[] {
  switch (status) {
    case 'NotConfirmed':
      return ['save', 'confirm', 'cancel_surgery'];
    case 'Confirmed':
      return ['save_will_revert', 'cancel_surgery'];
    case 'Finalised':
      return ['save_will_revert', 'cancel_surgery'];
    case 'OTPrepared':
    case 'Cancelled':
      return ['reopen'];
    case 'SurgeryDone':
    default:
      return [];
  }
}
