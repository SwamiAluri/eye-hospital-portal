/**
 * Concise counsellor-facing disabled-action hints (presentation only).
 */

const SAVE_SESSION_HINTS: Record<string, string> = {
  'Select a patient decision before saving': 'Record patient decision first',
  'Please select a payment type': 'Select payment type first',
  'Please select an insurance company': 'Select insurer first',
  'Please schedule surgery date and doctor': 'Schedule surgery first',
  'Please select a follow-up reason': 'Select follow-up reason',
  'Please select a follow-up date': 'Set follow-up date',
  'Session is read-only': 'Session is read-only',
  'Saving session…': 'Saving…',
};

const PHASE_HINTS: Record<string, string> = {
  'Select a procedure or package to continue': 'Select procedure or package',
  'Please select a sub-type for the selected procedure': 'Select procedure sub-type',
  'Please select an IOL for the selected procedure': 'Select IOL',
  'Please select a payment type': 'Select payment type',
  'Please select a patient decision': 'Record patient decision',
  'Please select an insurance company': 'Select insurer',
  'Please schedule surgery date and doctor': 'Schedule surgery',
  'Please select a follow-up reason': 'Select follow-up reason',
  'Please select a follow-up date': 'Set follow-up date',
};

export function clarifySaveSessionHint(reason: string | null): string | null {
  if (!reason) return null;
  return SAVE_SESSION_HINTS[reason] ?? reason;
}

export function clarifySaveDraftHint(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === 'Start repeat session to continue') return 'Start repeat session first';
  if (reason === 'Saving…') return 'Saving…';
  return SAVE_SESSION_HINTS[reason] ?? reason;
}

export function clarifyPhaseAdvanceHint(reason: string | null): string | null {
  if (!reason) return null;
  return PHASE_HINTS[reason] ?? reason;
}
