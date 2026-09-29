'use client';

import type { ReactNode } from 'react';
import { CounsellingJourneyRail } from '@/components/counsellors-desk/session/CounsellingJourneyRail';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { CounsellingPhaseCompletion } from '@/lib/counsellors-desk/counselling-progress';
import type { CoverageProgressSnapshot, SessionMainTab } from '@/lib/counsellors-desk/session-status-summary';
import type { WaitingListStatus } from '@/types/counsellors-desk';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';

export interface CounsellingSessionChromeProps {
  queueStatus: WaitingListStatus;
  activeMainTab: SessionMainTab;
  activePhase: CounsellingPhase;
  phaseCompletion: CounsellingPhaseCompletion;
  isRepeatState: boolean;
  isSurgeryDoneState: boolean;
  showCoverageWorkflow: boolean;
  coverageTabAvailable?: boolean;
  /** Coverage progress already merged with admission state. */
  coverageProgress: CoverageProgressSnapshot;
  canGoToPhase: (phase: CounsellingPhase) => boolean;
  finishSummaryActive?: boolean;
  onNavigateTab?: (tab: SessionMainTab) => void;
  onNavigatePhase?: (phase: CounsellingPhase) => void;
  onFinishSummaryActive?: (active: boolean) => void;
  navigationBlocked?: boolean;
  contextualDestination?: 'none' | 'patient-context' | 'history' | 'conversations';
  onSelectPatientContext?: () => void;
  onSelectHistory?: () => void;
  onSelectConversations?: () => void;
  recordingAction?: ReactNode;
}

export function CounsellingSessionChrome({
  queueStatus,
  activeMainTab,
  activePhase,
  phaseCompletion,
  isRepeatState,
  isSurgeryDoneState,
  showCoverageWorkflow,
  coverageTabAvailable,
  coverageProgress,
  canGoToPhase,
  finishSummaryActive = false,
  onNavigateTab,
  onNavigatePhase,
  onFinishSummaryActive,
  navigationBlocked = false,
  contextualDestination = 'none',
  onSelectPatientContext,
  onSelectHistory,
  onSelectConversations,
  recordingAction,
}: CounsellingSessionChromeProps) {
  return (
    <section
      data-testid={counsellingTestIds.sessionChrome}
      aria-label="Session progress"
      className={counsellingSessionTokens.shellWorkflow}
    >
      <CounsellingJourneyRail
        activeMainTab={activeMainTab}
        activePhase={activePhase}
        phaseCompletion={phaseCompletion}
        showCoverageWorkflow={showCoverageWorkflow}
        coverageTabAvailable={coverageTabAvailable ?? showCoverageWorkflow}
        coverageProgress={coverageProgress}
        queueStatus={queueStatus}
        isRepeatState={isRepeatState}
        isSurgeryDoneState={isSurgeryDoneState}
        canGoToPhase={canGoToPhase}
        finishSummaryActive={finishSummaryActive}
        onNavigateTab={onNavigateTab}
        onNavigatePhase={onNavigatePhase}
        onFinishSummaryActive={onFinishSummaryActive}
        navigationBlocked={navigationBlocked}
        contextualDestination={contextualDestination}
        onSelectPatientContext={onSelectPatientContext}
        onSelectHistory={onSelectHistory}
        onSelectConversations={onSelectConversations}
        recordingAction={recordingAction}
      />
    </section>
  );
}
