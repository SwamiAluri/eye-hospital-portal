import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { SessionMainTab } from '@/lib/counsellors-desk/session-status-summary';
import type { SessionNavigationTarget } from '@/lib/counsellors-desk/counselling-session-navigation';
import { resolveSessionBackTarget } from '@/lib/counsellors-desk/counselling-session-navigation';

export type CounsellingJourneyNextAction =
  | {
      kind: 'phase_next';
      label: string;
    }
  | {
      kind: 'navigate';
      label: string;
      navigateTab: SessionMainTab;
      navigatePhase?: CounsellingPhase;
    };

export interface ResolveCounsellingJourneyNextInput {
  activeMainTab: SessionMainTab;
  activePhase: CounsellingPhase;
  phaseCompletion: { estimate: boolean; decision: boolean; wrapup: boolean };
  /** Pre-auth workflow required (coverage payment && !notRequiredPreAuth). */
  showCoverageWorkflow: boolean;
  /** Insurance tab available for coverage payment types (authoritative for journey path). */
  coverageTabAvailable?: boolean;
  finishSummaryActive?: boolean;
  /** Display/hydration only — not used to mark decision complete for navigation. */
  decision?: string;
  paymentType?: string;
}

/**
 * Authoritative next destination for counselling journey footer / phase advance.
 *
 * Quote → Decision
 * Decision → Insurance if coverageTabAvailable, else Notes
 * Insurance → Notes
 * Notes / Finish → no journey next (Complete Session handled separately)
 *
 * Decision completion uses phaseCompletion.decision only (not a loose decision field).
 */
export function resolveCounsellingJourneyNext(
  input: ResolveCounsellingJourneyNextInput,
): CounsellingJourneyNextAction | null {
  if (input.finishSummaryActive) return null;

  const insuranceOnPath = input.coverageTabAvailable ?? input.showCoverageWorkflow;
  const decisionComplete = input.phaseCompletion.decision;

  if (input.activeMainTab === 'coverage') {
    return {
      kind: 'navigate',
      label: 'Next: Notes',
      navigateTab: 'counselling',
      navigatePhase: 'wrapup',
    };
  }

  if (input.activeMainTab !== 'counselling') return null;

  if (input.activePhase === 'estimate') {
    return {
      kind: 'phase_next',
      label: 'Next: Patient Decision',
    };
  }

  if (input.activePhase === 'decision') {
    if (!decisionComplete) {
      return {
        kind: 'phase_next',
        label: 'Next: Session Notes',
      };
    }
    if (insuranceOnPath) {
      return {
        kind: 'navigate',
        label: 'Next: Insurance',
        navigateTab: 'coverage',
      };
    }
    return {
      kind: 'navigate',
      label: 'Next: Notes',
      navigateTab: 'counselling',
      navigatePhase: 'wrapup',
    };
  }

  // Notes (wrapup): Complete Session is the primary action — no journey "next".
  return null;
}

/** Previous target — reuses resolveSessionBackTarget (Insurance when coverage tab available). */
export function resolveCounsellingJourneyPrevious(
  input: Parameters<typeof resolveSessionBackTarget>[0],
): SessionNavigationTarget | null {
  return resolveSessionBackTarget(input);
}
