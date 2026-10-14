/**
 * Primary row action for LMS Testing / verification / authorization work queues.
 * "Edit draft" is only for editable Draft Results. Non-Draft statuses never show Edit draft.
 */
export type TestingWorkQueuePrimaryAction =
  | { kind: 'enter-draft'; label: 'Enter draft' }
  | { kind: 'edit-draft'; label: 'Edit draft' }
  | { kind: 'open-result'; label: 'Open result' };

export function testingWorkQueuePrimaryAction(row: {
  resultId?: string | null;
  resultStatus?: string | null;
}): TestingWorkQueuePrimaryAction | null {
  if (!row.resultId) {
    return { kind: 'enter-draft', label: 'Enter draft' };
  }
  if (row.resultStatus === 'Draft') {
    return { kind: 'edit-draft', label: 'Edit draft' };
  }
  // Authorization / Authorized Results read paths may open detail — not edit.
  if (
    row.resultStatus === 'TechnicalVerified' ||
    row.resultStatus === 'ClinicallyAuthorized'
  ) {
    return { kind: 'open-result', label: 'Open result' };
  }
  // Any other non-Draft status: no Draft-edit action.
  return null;
}
