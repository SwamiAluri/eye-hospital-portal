/**
 * Phase 3G.2 — Visit policy persistence may only run from explicit actions.
 * Wizard tab changes and coverage draft save must NOT create/update policies.
 */

export type VisitPolicyPersistTrigger =
  | 'wizard-step-change'
  | 'coverage-panel-draft-save'
  | 'explicit-add-edit'
  | 'submit-to-claims-ensure-primary'
  | 'import-from-draft'
  | 'set-primary';

/** Whether a trigger is allowed to POST/PUT/PATCH a visit policy. */
export function mayPersistVisitPolicy(trigger: VisitPolicyPersistTrigger): boolean {
  switch (trigger) {
    case 'wizard-step-change':
    case 'coverage-panel-draft-save':
      return false;
    case 'explicit-add-edit':
    case 'submit-to-claims-ensure-primary':
    case 'import-from-draft':
    case 'set-primary':
      return true;
    default: {
      const _exhaustive: never = trigger;
      return _exhaustive;
    }
  }
}

/** Steps that must never trigger policy persistence when leaving Policy. */
export const COVERAGE_WIZARD_STEPS_NO_POLICY_PERSIST = [
  'estimate',
  'documents',
  'notes',
  'finish',
] as const;
