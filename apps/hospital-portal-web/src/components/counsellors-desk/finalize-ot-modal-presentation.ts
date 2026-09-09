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
