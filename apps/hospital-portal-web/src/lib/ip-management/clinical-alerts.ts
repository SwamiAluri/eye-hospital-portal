export type ClinicalAlertSource =
  | { status: 'unwired' }
  | { status: 'cleared' }
  | { status: 'present'; items: string[] };

/** Until a patient-level allergy/risk API exists, the banner must not invent a cleared state. */
export const UNWIRED_CLINICAL_ALERTS: ClinicalAlertSource = { status: 'unwired' };

export const NO_KNOWN_ALLERGIES_LABEL = 'No known allergies';
