export interface OutpatientChecklistHandle {
  /** Apply pending integration suggestions; items already toggle-saved. */
  flushDraft: (options?: { silent?: boolean }) => Promise<boolean>;
}
