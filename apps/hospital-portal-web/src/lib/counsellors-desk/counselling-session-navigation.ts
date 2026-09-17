import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { SessionMainTab } from '@/lib/counsellors-desk/session-status-summary';

export interface SessionNavigationTarget {
  tab?: SessionMainTab;
  phase?: CounsellingPhase;
  /** Leave counselling session (Quote / first step). */
  leaveSession?: boolean;
  /** Show Finish terminal summary (not a counselling phase). */
  finishSummaryActive?: boolean;
}

export interface SessionNavigationHandlers {
  onNavigateTab?: (tab: SessionMainTab) => void;
  onNavigatePhase?: (phase: CounsellingPhase) => void;
  onFinishSummaryActive?: (active: boolean) => void;
  isBlocked?: boolean;
}

export interface ResolveSessionBackInput {
  activeMainTab: SessionMainTab;
  activePhase: CounsellingPhase;
  showCoverageWorkflow: boolean;
  /** When payment is a coverage type, Back from Notes can return to Insurance for viewing. */
  coverageTabAvailable?: boolean;
  finishSummaryActive?: boolean;
}

/**
 * Journey-aware Back target for the session footer.
 * Quote has no previous phase — Close (not Back) leaves the session.
 * Later stages walk the journey backward.
 */
export function resolveSessionBackTarget(
  input: ResolveSessionBackInput,
): SessionNavigationTarget | null {
  if (input.finishSummaryActive) {
    return { tab: 'counselling', phase: 'wrapup', finishSummaryActive: false };
  }
  if (input.activeMainTab === 'coverage') {
    return { tab: 'counselling', phase: 'decision', finishSummaryActive: false };
  }
  if (input.activeMainTab === 'outpatient') {
    return { tab: 'counselling', phase: 'wrapup', finishSummaryActive: false };
  }
  if (input.activeMainTab === 'counselling') {
    if (input.activePhase === 'estimate') {
      // First counselling phase — Back is not leave; use Close for exit.
      return null;
    }
    if (input.activePhase === 'decision') {
      return { tab: 'counselling', phase: 'estimate', finishSummaryActive: false };
    }
    if (input.activePhase === 'wrapup') {
      const canOpenInsurance =
        input.coverageTabAvailable ?? input.showCoverageWorkflow;
      if (canOpenInsurance) {
        return { tab: 'coverage', finishSummaryActive: false };
      }
      return { tab: 'counselling', phase: 'decision', finishSummaryActive: false };
    }
  }
  return null;
}

export function shouldShowSessionBack(input: ResolveSessionBackInput): boolean {
  return resolveSessionBackTarget(input) != null;
}

/** Applies tab/phase navigation used by the summary bar and journey rail. */
export function applySessionNavigation(
  target: SessionNavigationTarget,
  handlers: SessionNavigationHandlers,
): void {
  // Finish summary remains reachable after terminal outcomes (including repeat).
  if (handlers.isBlocked && target.finishSummaryActive !== true) return;
  if (target.leaveSession) return;
  if (typeof target.finishSummaryActive === 'boolean') {
    handlers.onFinishSummaryActive?.(target.finishSummaryActive);
  }
  if (target.tab && handlers.onNavigateTab) {
    handlers.onNavigateTab(target.tab);
  }
  if (target.phase && handlers.onNavigatePhase) {
    handlers.onNavigatePhase(target.phase);
  }
}

export function isSessionNavigationTargetActionable(
  target: SessionNavigationTarget,
  handlers: SessionNavigationHandlers,
): boolean {
  if (handlers.isBlocked) return false;
  if (target.tab && handlers.onNavigateTab) return true;
  if (target.phase && handlers.onNavigatePhase) return true;
  return false;
}
