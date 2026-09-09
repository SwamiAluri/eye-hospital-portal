/**
 * Option 1 dual-save: counselling draft always; coverage draft when workflow + panel ready + editable.
 */

export interface CounsellingDualDraftSaveInput {
  draftDisabled: boolean;
  coverageWorkflowActive: boolean;
  coveragePanelReady: boolean;
  /** False when CCMS case is locked (e.g. Waiting for TPA). Default true when omitted. */
  coverageEditable?: boolean;
  /** Flush outpatient checklist as well (any tab). */
  flushOutpatient?: boolean;
}

export interface CounsellingDualDraftSavePlan {
  saveCounselling: boolean;
  saveCoverage: boolean;
  coverageSoftWarn: boolean;
  /** Coverage workflow on but case locked — skip without error toast. */
  coverageSkippedLocked: boolean;
  flushOutpatient: boolean;
}

export function planCounsellingDualDraftSave(
  input: CounsellingDualDraftSaveInput,
): CounsellingDualDraftSavePlan {
  if (input.draftDisabled) {
    return {
      saveCounselling: false,
      saveCoverage: false,
      coverageSoftWarn: false,
      coverageSkippedLocked: false,
      flushOutpatient: false,
    };
  }

  const coverageEditable = input.coverageEditable !== false;
  const coverageSkippedLocked =
    input.coverageWorkflowActive && input.coveragePanelReady && !coverageEditable;
  const saveCoverage =
    input.coverageWorkflowActive && input.coveragePanelReady && coverageEditable;
  const coverageSoftWarn =
    input.coverageWorkflowActive && !input.coveragePanelReady && coverageEditable;

  return {
    saveCounselling: true,
    saveCoverage,
    coverageSoftWarn,
    coverageSkippedLocked,
    flushOutpatient: Boolean(input.flushOutpatient),
  };
}
