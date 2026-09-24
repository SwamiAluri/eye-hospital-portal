import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import { shouldShowSessionBack } from '@/lib/counsellors-desk/counselling-session-navigation';
import {
  buildSessionStatusSummary,
  isPreAuthSubmittedState,
  type BuildSessionStatusSummaryInput,
  type SessionMainTab,
} from '@/lib/counsellors-desk/session-status-summary';
import { resolveCounsellingJourneyNext } from '@/lib/counsellors-desk/counselling-journey-navigation';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';

export type ActionBarPrimaryKind =
  | 'phase_next'
  | 'navigate'
  | 'save_session'
  | 'submit_claims'
  | 'none';

export interface ActionBarPrimaryAction {
  kind: ActionBarPrimaryKind;
  label: string;
  disabledReason?: string | null;
  navigateTab?: SessionMainTab;
  navigatePhase?: CounsellingPhase;
}

export interface SessionActionBarModel {
  primary: ActionBarPrimaryAction | null;
  showSaveDraft: boolean;
  saveDraftDisabledReason: string | null;
  showPhaseBack: boolean;
  /** Always leave the session workspace (navigation only). */
  showClose: boolean;
  showPrint: boolean;
  printDisabledReason: string | null;
  /** Status-only line when no primary CTA (e.g. session complete). */
  statusHint?: string | null;
}

export interface BuildSessionActionBarInput extends BuildSessionStatusSummaryInput {
  canAdvancePhase: boolean;
  phaseAdvanceError: string | null;
  saveDisabledReason: string | null;
  saveDraftDisabledReason: string | null;
  printDisabledReason: string | null;
  canSubmitToClaims: boolean;
  submittingToClaims: boolean;
  /** Finish terminal summary surface (not a counselling phase). */
  finishSummaryActive?: boolean;
  /** Insurance tab viewable for coverage payment types (even if pre-auth not required). */
  coverageTabAvailable?: boolean;
  /**
   * Ownership / sealed content lock (FE UX). When true, counselling-content mutation CTAs
   * (Save Draft, Complete Session, Submit Claims, phase-next) are hidden — same pattern as Pending.
   * History / Clinical Recommendations / Patient Details / Close remain available via chrome.
   */
  contentMutationsLocked?: boolean;
}

function isAtNavigationTarget(
  input: BuildSessionActionBarInput,
  tab?: SessionMainTab,
  phase?: CounsellingPhase,
): boolean {
  if (tab && input.activeMainTab !== tab) return false;
  if (phase && input.activeMainTab === 'counselling' && input.activePhase !== phase) return false;
  return true;
}

/** True when the footer should advance within the current counselling phase. */
export function shouldOfferPhaseNextAction(input: BuildSessionActionBarInput): boolean {
  const next = resolveCounsellingJourneyNext({
    activeMainTab: input.activeMainTab,
    activePhase: input.activePhase,
    phaseCompletion: input.phaseCompletion,
    showCoverageWorkflow: input.showCoverageWorkflow,
    coverageTabAvailable: input.coverageTabAvailable,
    finishSummaryActive: input.finishSummaryActive,
    decision: input.decision,
    paymentType: input.paymentType,
  });
  return next?.kind === 'phase_next';
}

export function buildSessionActionBarModel(
  input: BuildSessionActionBarInput,
): SessionActionBarModel {
  const summary = buildSessionStatusSummary(input);
  const decisionComplete = input.phaseCompletion.decision;
  const base = {
    showSaveDraft: true,
    saveDraftDisabledReason: input.saveDraftDisabledReason,
    showPhaseBack: false,
    showClose: true,
    showPrint: true,
    printDisabledReason: input.printDisabledReason,
    statusHint: null as string | null,
  };

  if (input.isSurgeryDoneState) {
    return {
      ...base,
      primary: null,
      showSaveDraft: false,
      showPrint: false,
      showPhaseBack: shouldShowSessionBack({
        activeMainTab: input.activeMainTab,
        activePhase: input.activePhase,
        showCoverageWorkflow: input.showCoverageWorkflow,
        coverageTabAvailable: input.coverageTabAvailable,
        finishSummaryActive: input.finishSummaryActive,
      }),
      statusHint: 'Session read-only',
    };
  }

  // PD-PENDING-READONLY-01 — Pending is view-only until Waiting List Start Counseling.
  if (input.queueStatus === 'Pending') {
    return {
      ...base,
      primary: null,
      showSaveDraft: false,
      showPrint: false,
      showPhaseBack: shouldShowSessionBack({
        activeMainTab: input.activeMainTab,
        activePhase: input.activePhase,
        showCoverageWorkflow: input.showCoverageWorkflow,
        coverageTabAvailable: input.coverageTabAvailable,
        finishSummaryActive: input.finishSummaryActive,
      }),
      statusHint: 'Start counselling from the Waiting List to edit',
    };
  }

  // Non-owner / ownership-sealed viewer (e.g. Admin viewing Amelia's Processing session).
  // Hide mutation CTAs; do not present enabled Save Draft. Backend ACL unchanged.
  if (input.contentMutationsLocked) {
    return {
      ...base,
      primary: null,
      showSaveDraft: false,
      showPhaseBack: shouldShowSessionBack({
        activeMainTab: input.activeMainTab,
        activePhase: input.activePhase,
        showCoverageWorkflow: input.showCoverageWorkflow,
        coverageTabAvailable: input.coverageTabAvailable,
        finishSummaryActive: input.finishSummaryActive,
      }),
      statusHint: 'Session read-only',
    };
  }

  if (input.finishSummaryActive) {
    return {
      ...base,
      primary: null,
      showSaveDraft: false,
      showPhaseBack: true,
      statusHint:
        input.queueStatus === 'RepeatCounselling'
          ? 'Repeat counselling required'
          : input.queueStatus === 'AddOnSurgery'
            ? 'Add-on surgery recorded'
            : 'Counselling completed',
    };
  }

  if (input.isRepeatState) {
    return {
      ...base,
      primary: null,
      showSaveDraft: false,
      showPrint: false,
      showPhaseBack: shouldShowSessionBack({
        activeMainTab: input.activeMainTab,
        activePhase: input.activePhase,
        showCoverageWorkflow: input.showCoverageWorkflow,
        coverageTabAvailable: input.coverageTabAvailable,
        finishSummaryActive: input.finishSummaryActive,
      }),
      statusHint: 'Start repeat session to continue',
    };
  }

  if (input.queueStatus === 'Done' || input.queueStatus === 'AddOnSurgery') {
    return {
      ...base,
      primary: null,
      showSaveDraft: false,
      showPhaseBack: shouldShowSessionBack({
        activeMainTab: input.activeMainTab,
        activePhase: input.activePhase,
        showCoverageWorkflow: input.showCoverageWorkflow,
        coverageTabAvailable: input.coverageTabAvailable,
        finishSummaryActive: input.finishSummaryActive,
      }),
      statusHint:
        input.queueStatus === 'AddOnSurgery' ? 'Add-on surgery recorded' : 'Session complete',
    };
  }

  const showPhaseBack = shouldShowSessionBack({
    activeMainTab: input.activeMainTab,
    activePhase: input.activePhase,
    showCoverageWorkflow: input.showCoverageWorkflow,
    coverageTabAvailable: input.coverageTabAvailable,
    finishSummaryActive: input.finishSummaryActive,
  });
  base.showPhaseBack = showPhaseBack;

  const { ccmsState, preAuthSubmitted } = input.coverageProgress;
  const awaitingInsurer =
    preAuthSubmitted ||
    isPreAuthSubmittedState(ccmsState) ||
    summary.nextAction === 'Awaiting insurer approval';

  const coveragePending =
    input.showCoverageWorkflow &&
    !preAuthSubmitted &&
    !isPreAuthSubmittedState(ccmsState);

  if (awaitingInsurer) {
    // Decision complete → allow Complete Session from any tab (incl. Quote) so counselling
    // can close while coverage continues Waiting for TPA / post-submit.
    if (decisionComplete) {
      return {
        ...base,
        primary: {
          kind: 'save_session',
          label: counsellingCopy.completeSession,
          disabledReason: input.saveDisabledReason,
        },
      };
    }
    return {
      ...base,
      primary: null,
      showSaveDraft: true,
    };
  }

  if (
    input.showCoverageWorkflow &&
    input.canSubmitToClaims &&
    !awaitingInsurer &&
    input.activeMainTab === 'coverage'
  ) {
    return {
      ...base,
      primary: {
        kind: 'submit_claims',
        label: 'Submit to claims',
        disabledReason: input.submittingToClaims ? 'Submitting…' : null,
      },
    };
  }

  const journeyNext = resolveCounsellingJourneyNext({
    activeMainTab: input.activeMainTab,
    activePhase: input.activePhase,
    phaseCompletion: input.phaseCompletion,
    showCoverageWorkflow: input.showCoverageWorkflow,
    coverageTabAvailable: input.coverageTabAvailable,
    finishSummaryActive: input.finishSummaryActive,
    decision: input.decision,
    paymentType: input.paymentType,
  });

  if (journeyNext?.kind === 'navigate') {
    if (
      !isAtNavigationTarget(input, journeyNext.navigateTab, journeyNext.navigatePhase)
    ) {
      return {
        ...base,
        primary: {
          kind: 'navigate',
          label: journeyNext.label,
          navigateTab: journeyNext.navigateTab,
          navigatePhase: journeyNext.navigatePhase,
        },
      };
    }
  }

  if (journeyNext?.kind === 'phase_next') {
    return {
      ...base,
      primary: {
        kind: 'phase_next',
        label: journeyNext.label,
        disabledReason: input.phaseAdvanceError,
      },
    };
  }

  if (
    summary.nextActionTab &&
    summary.nextAction &&
    !isAtNavigationTarget(input, summary.nextActionTab, summary.nextActionPhase)
  ) {
    return {
      ...base,
      primary: {
        kind: 'navigate',
        label: `Next: ${summary.nextAction}`,
        navigateTab: summary.nextActionTab,
        navigatePhase: summary.nextActionPhase,
      },
    };
  }

  if (
    input.activeMainTab === 'counselling' &&
    input.activePhase === 'wrapup' &&
    !coveragePending
  ) {
    return {
      ...base,
      primary: {
        kind: 'save_session',
        label: counsellingCopy.completeSession,
        disabledReason: input.saveDisabledReason,
      },
    };
  }

  if (input.activeMainTab === 'counselling' && input.activePhase === 'wrapup' && coveragePending) {
    // Insurance is not required to complete counselling — Complete Session remains available on Notes.
    return {
      ...base,
      primary: {
        kind: 'save_session',
        label: counsellingCopy.completeSession,
        disabledReason: input.saveDisabledReason,
      },
    };
  }

  if (coveragePending && input.activeMainTab === 'coverage') {
    return {
      ...base,
      primary: null,
      statusHint: summary.nextAction,
    };
  }

  return {
    ...base,
    primary: input.saveDisabledReason
      ? {
          kind: 'save_session',
          label: counsellingCopy.completeSession,
          disabledReason: input.saveDisabledReason,
        }
      : null,
    statusHint: summary.nextAction !== 'Continue current step' ? summary.nextAction : null,
  };
}
