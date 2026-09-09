import type {

  CounsellingPhase,

  CounsellingPhaseCompletion,

} from '@/lib/counsellors-desk/counselling-progress';

import type {

  CoverageProgressSnapshot,

  SessionMainTab,

} from '@/lib/counsellors-desk/session-status-summary';

import { isPreAuthSubmittedState } from '@/lib/counsellors-desk/session-status-summary';

import type { SessionNavigationTarget } from '@/lib/counsellors-desk/counselling-session-navigation';
import { isCounsellingTerminalOutcome } from '@/lib/counsellors-desk/counselling-finish-outcome';
import type { WaitingListStatus } from '@/types/counsellors-desk';



export type JourneyStageId = 'quote' | 'decision' | 'insurance' | 'notes' | 'close';



export type JourneyStageVisualStatus =

  | 'completed'

  | 'current'

  | 'available'

  | 'pending'

  | 'skipped';



export interface JourneyStageDefinition {

  id: JourneyStageId;

  label: string;

  shortLabel: string;

  status: JourneyStageVisualStatus;

  navigable: boolean;

}



export interface BuildJourneyRailInput {
  activeMainTab: SessionMainTab;
  activePhase: CounsellingPhase;
  phaseCompletion: CounsellingPhaseCompletion;
  /** Pre-auth workflow required for counselling completion (payment type + !notRequiredPreAuth). */
  showCoverageWorkflow: boolean;
  /**
   * Insurance tab may be opened for viewing when payment is a coverage type,
   * even if pre-auth is marked not required (read-only after terminal outcomes).
   */
  coverageTabAvailable?: boolean;
  coverageProgress: CoverageProgressSnapshot;
  queueStatus: WaitingListStatus;
  isRepeatState: boolean;
  isSurgeryDoneState: boolean;
  canGoToPhase: (phase: CounsellingPhase) => boolean;
  /** When true, Finish summary surface is active (not a counselling phase). */
  finishSummaryActive?: boolean;
}



export const JOURNEY_STAGE_ORDER: JourneyStageId[] = [
  'quote',
  'decision',
  'insurance',
  'notes',
  'close',
];

export const JOURNEY_STAGE_LABELS: Record<JourneyStageId, { label: string; shortLabel: string }> = {
  quote: { label: 'Quote', shortLabel: 'Quote' },
  decision: { label: 'Decision', shortLabel: 'Decision' },
  insurance: { label: 'Insurance', shortLabel: 'Insurance' },
  notes: { label: 'Notes', shortLabel: 'Notes' },
  close: { label: 'Finish', shortLabel: 'Finish' },
};



/** Outpatient Safety is independent — do not highlight a journey stage as "current" on that tab. */

export function shouldSuppressJourneyCurrentStage(input: BuildJourneyRailInput): boolean {

  return input.activeMainTab === 'outpatient';

}



/** Macro workflow pointer when the active main tab does not map 1:1 to a journey stage. */

export function resolveMacroJourneyStage(input: BuildJourneyRailInput): JourneyStageId {
  const { phaseCompletion, showCoverageWorkflow, queueStatus, isSurgeryDoneState } = input;

  if (isCounsellingTerminalOutcome(queueStatus, isSurgeryDoneState)) return 'close';

  if (!phaseCompletion.estimate) return 'quote';

  if (!phaseCompletion.decision) return 'decision';

  if (showCoverageWorkflow && !isJourneyStageCompleted('insurance', input)) return 'insurance';

  if (!isJourneyStageCompleted('notes', input)) return 'notes';

  return 'close';
}



export function resolveCurrentJourneyStage(input: BuildJourneyRailInput): JourneyStageId {
  if (input.activeMainTab === 'coverage') return 'insurance';
  if (input.activeMainTab === 'outpatient') return resolveMacroJourneyStage(input);
  if (input.activePhase === 'estimate') return 'quote';
  if (input.activePhase === 'decision') return 'decision';
  if (input.finishSummaryActive) return 'close';
  return 'notes';
}



export function isJourneyStageCompleted(
  stageId: JourneyStageId,
  input: BuildJourneyRailInput,
): boolean {
  const { phaseCompletion, showCoverageWorkflow, coverageProgress, queueStatus, isSurgeryDoneState } =
    input;
  const coverageTabAvailable = input.coverageTabAvailable ?? showCoverageWorkflow;
  const { ccmsState, preAuthSubmitted } = coverageProgress;

  switch (stageId) {
    case 'quote':
      return phaseCompletion.estimate;
    case 'decision':
      return phaseCompletion.decision;
    case 'insurance':
      if (!coverageTabAvailable) return false;
      // Pre-auth not required: stage is satisfied for journey completion, still viewable.
      if (!showCoverageWorkflow) return phaseCompletion.decision;
      return preAuthSubmitted || isPreAuthSubmittedState(ccmsState);
    case 'notes':
      return isCounsellingTerminalOutcome(queueStatus, isSurgeryDoneState);
    case 'close':
      return isCounsellingTerminalOutcome(queueStatus, isSurgeryDoneState);
    default:
      return false;
  }
}

export function canNavigateToJourneyStage(
  stageId: JourneyStageId,
  input: BuildJourneyRailInput,
): boolean {
  const {
    isRepeatState,
    isSurgeryDoneState,
    canGoToPhase,
    phaseCompletion,
    queueStatus,
  } = input;
  const coverageTabAvailable = input.coverageTabAvailable ?? input.showCoverageWorkflow;

  if (stageId === 'close') {
    return isCounsellingTerminalOutcome(queueStatus, isSurgeryDoneState);
  }

  if (isRepeatState || isSurgeryDoneState) return false;

  switch (stageId) {
    case 'quote':
      return canGoToPhase('estimate');
    case 'decision':
      return canGoToPhase('decision');
    case 'insurance':
      // Viewable for coverage payment types even when pre-auth is not required.
      return coverageTabAvailable && phaseCompletion.decision;
    case 'notes':
      return canGoToPhase('wrapup');
    default:
      return false;
  }
}

export function getJourneyStageNavigationTarget(stageId: JourneyStageId): SessionNavigationTarget {
  switch (stageId) {
    case 'quote':
      return { tab: 'counselling', phase: 'estimate', finishSummaryActive: false };
    case 'decision':
      return { tab: 'counselling', phase: 'decision', finishSummaryActive: false };
    case 'insurance':
      return { tab: 'coverage', finishSummaryActive: false };
    case 'notes':
      return { tab: 'counselling', phase: 'wrapup', finishSummaryActive: false };
    case 'close':
      return { tab: 'counselling', finishSummaryActive: true };
    default:
      return {};
  }
}



function resolveStageVisualStatus(

  stageId: JourneyStageId,

  currentStage: JourneyStageId,

  input: BuildJourneyRailInput,

): JourneyStageVisualStatus {

  if (stageId === 'insurance' && !(input.coverageTabAvailable ?? input.showCoverageWorkflow)) {

    return 'skipped';

  }



  const completed = isJourneyStageCompleted(stageId, input);

  const suppressCurrent = shouldSuppressJourneyCurrentStage(input);



  if (stageId === currentStage && !suppressCurrent) return 'current';

  if (stageId === currentStage && suppressCurrent) {

    if (completed) return 'completed';

    if (input.isRepeatState || input.isSurgeryDoneState) return 'pending';

    if (canNavigateToJourneyStage(stageId, input)) return 'available';

    return 'pending';

  }

  if (completed) return 'completed';



  if (input.isRepeatState || input.isSurgeryDoneState) {

    return 'pending';

  }



  if (canNavigateToJourneyStage(stageId, input)) {

    return 'available';

  }



  return 'pending';

}



export function buildJourneyRailStages(input: BuildJourneyRailInput): JourneyStageDefinition[] {

  const currentStage = resolveCurrentJourneyStage(input);

  const suppressCurrent = shouldSuppressJourneyCurrentStage(input);



  return JOURNEY_STAGE_ORDER.map((id) => {

    const labels = JOURNEY_STAGE_LABELS[id];

    const status = resolveStageVisualStatus(id, currentStage, input);

    const isCurrent = id === currentStage && !suppressCurrent;

    const stageCanNavigate = canNavigateToJourneyStage(id, input);

    const navigable =
      id === 'close'
        ? status !== 'skipped' &&
          status !== 'pending' &&
          !isCurrent &&
          stageCanNavigate
        : status !== 'skipped' &&
          status !== 'pending' &&
          !isCurrent &&
          !input.isRepeatState &&
          !input.isSurgeryDoneState &&
          (status === 'completed' || status === 'available') &&
          stageCanNavigate;



    return {

      id,

      label: labels.label,

      shortLabel: labels.shortLabel,

      status,

      navigable,

    };

  });

}

