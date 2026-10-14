/**
 * Add Patient wizard step identity + applicable-step display numbering.
 * Display numbers are derived from applicableSteps (Guardian may be omitted).
 */

export type RegistrationStepId =
  | 'PERSONAL'
  | 'CONTACT'
  | 'IDENTITY'
  | 'GUARDIAN'
  | 'EMERGENCY'
  | 'INSURANCE'
  | 'REVIEW';

export type RegistrationStepDef = {
  id: RegistrationStepId;
  label: string;
};

export const REGISTRATION_STEP_DEFS: readonly RegistrationStepDef[] = [
  { id: 'PERSONAL', label: 'Personal Information' },
  { id: 'CONTACT', label: 'Contact Information' },
  { id: 'IDENTITY', label: 'Identity Documents' },
  { id: 'GUARDIAN', label: 'Guardian Information' },
  { id: 'EMERGENCY', label: 'Emergency Contact' },
  { id: 'INSURANCE', label: 'Insurance Information' },
  { id: 'REVIEW', label: 'Review & Confirm' },
] as const;

/** Build the visible step list for the current Guardian eligibility. */
export function getApplicableRegistrationSteps(
  guardianApplicable: boolean,
): RegistrationStepDef[] {
  return REGISTRATION_STEP_DEFS.filter(
    (step) => step.id !== 'GUARDIAN' || guardianApplicable,
  );
}

export function getStepDisplayNumber(
  stepId: RegistrationStepId,
  applicableSteps: readonly RegistrationStepDef[],
): number {
  const index = applicableSteps.findIndex((step) => step.id === stepId);
  return index >= 0 ? index + 1 : 0;
}

export function getStepDef(
  stepId: RegistrationStepId,
): RegistrationStepDef | undefined {
  return REGISTRATION_STEP_DEFS.find((step) => step.id === stepId);
}

export type StepperLayoutMode = 'LEFT_CURRENT' | 'CENTER_CURRENT' | 'RIGHT_CURRENT';

export function getStepperLayoutMode(
  stepId: RegistrationStepId,
  applicableSteps: readonly RegistrationStepDef[],
): StepperLayoutMode {
  const index = applicableSteps.findIndex((step) => step.id === stepId);
  if (index <= 0) return 'LEFT_CURRENT';
  if (index >= applicableSteps.length - 1) return 'RIGHT_CURRENT';
  return 'CENTER_CURRENT';
}

/** True when `candidate` is at or before `reached` in the applicable order. */
export function isStepReached(
  candidate: RegistrationStepId,
  reached: RegistrationStepId,
  applicableSteps: readonly RegistrationStepDef[],
): boolean {
  const candidateIndex = applicableSteps.findIndex((step) => step.id === candidate);
  const reachedIndex = applicableSteps.findIndex((step) => step.id === reached);
  if (candidateIndex < 0 || reachedIndex < 0) return false;
  return candidateIndex <= reachedIndex;
}

export function getNextStepId(
  current: RegistrationStepId,
  applicableSteps: readonly RegistrationStepDef[],
): RegistrationStepId | null {
  const index = applicableSteps.findIndex((step) => step.id === current);
  if (index < 0 || index >= applicableSteps.length - 1) return null;
  return applicableSteps[index + 1]!.id;
}

export function getPreviousStepId(
  current: RegistrationStepId,
  applicableSteps: readonly RegistrationStepDef[],
): RegistrationStepId | null {
  const index = applicableSteps.findIndex((step) => step.id === current);
  if (index <= 0) return null;
  return applicableSteps[index - 1]!.id;
}
