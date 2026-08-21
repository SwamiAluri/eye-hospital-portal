/** Shared labels and filters for §2 Department Clearance (Ward Pre-Op Workspace). */

export const DEPARTMENT_CLEARANCE_CATEGORY_LABELS: Record<string, string> = {
  Compliance:             'Pre-Op Compliance',
  Evaluation:             'Clinical Evaluation',
  Anaesthesia:            'Anaesthesia Clearance',
  Consent:                'Consent Forms',
  'Pharmacy Preparation': 'Pharmacy Preparation',
  Financial:              'Coverage & Payment Status',
  'OT Preparation':       'OT Preparation',
  Documents:              'Required Documents',
};

/**
 * §2 Department Clearance is now purely the four real departmental sign-offs
 * (Workspace v2 Phase 11). Every other former §2 category has its own owning step:
 *   - Consent     → ④ ConsentAuthorizationPanel (Phase 5)
 *   - Financial   → ⑤ FinancialClearancePanel (Phase 6)
 *   - Compliance  → ⑥ FastingMedicationPanel (Phase 7)
 *   - Documents   → uploaded onto owning writers (Phase 2 dedupe)
 *   - Lab/Imaging/Investigations/Vitals → ① Investigations / ⑧ Vitals
 * These are excluded from the generic clearance engine so it renders only the 4.
 */
export const DEPARTMENT_CLEARANCE_REAL_CATEGORIES = [
  'Evaluation',
  'Anaesthesia',
  'Pharmacy Preparation',
  'OT Preparation',
] as const;

export const DEPARTMENT_CLEARANCE_EXCLUDED_CATEGORIES = new Set([
  'Lab Tests',
  'Diagnostic Imaging',
  'Investigations',
  'Vitals',
  'Consent',
  'Financial',
  'Compliance',
  'Documents',
]);

export const DEPARTMENT_CLEARANCE_CATEGORY_ORDER: string[] = [...DEPARTMENT_CLEARANCE_REAL_CATEGORIES];

export const SECTION_STATUS_COLORS: Record<string, string> = {
  NotRequested:      'bg-gray-100 text-gray-500',
  Requested:         'bg-yellow-100 text-yellow-700',
  RespondedClear:    'bg-green-100 text-green-700',
  RespondedConcerns: 'bg-red-100 text-red-700',
  WardConfirmed:     'bg-emerald-100 text-emerald-700',
  OnHold:            'bg-amber-100 text-amber-700',
  Rejected:          'bg-red-200 text-red-800',
  NeedsInfo:         'bg-purple-100 text-purple-700',
  Escalated:         'bg-orange-100 text-orange-700',
};

export const SECTION_STATUS_LABELS: Record<string, string> = {
  NotRequested:      'Not Requested',
  Requested:         'Awaiting Response',
  RespondedClear:    'Cleared',
  RespondedConcerns: 'Concerns Raised',
  WardConfirmed:     'Confirmed',
  OnHold:            'On Hold',
  Rejected:          'Rejected',
  NeedsInfo:         'Needs Info',
  Escalated:         'Escalated',
};

export function isDepartmentClearanceCategory(category: string): boolean {
  return !DEPARTMENT_CLEARANCE_EXCLUDED_CATEGORIES.has(category);
}

export function departmentClearanceCategoryLabel(category: string): string {
  return DEPARTMENT_CLEARANCE_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}
