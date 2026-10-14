'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  buildJourneyRailStages,
  getJourneyStageNavigationTarget,
  type JourneyStageId,
  type JourneyStageVisualStatus,
} from '@/lib/counsellors-desk/counselling-journey-rail';
import type { BuildJourneyRailInput } from '@/lib/counsellors-desk/counselling-journey-rail';
import {
  applySessionNavigation,
  type SessionNavigationHandlers,
} from '@/lib/counsellors-desk/counselling-session-navigation';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { SessionMainTab } from '@/lib/counsellors-desk/session-status-summary';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export interface CounsellingJourneyRailProps extends BuildJourneyRailInput {
  onNavigateTab?: (tab: SessionMainTab) => void;
  onNavigatePhase?: (phase: CounsellingPhase) => void;
  onFinishSummaryActive?: (active: boolean) => void;
  navigationBlocked?: boolean;
  /** Page-local destination. Not a journey stage. */
  contextualDestination?: 'none' | 'patient-context' | 'history' | 'conversations' | 'documents';
  onSelectPatientContext?: () => void;
  onSelectHistory?: () => void;
  onSelectConversations?: () => void;
  onSelectDocuments?: () => void;
  recordingAction?: ReactNode;
}

const STATUS_LABEL: Record<JourneyStageVisualStatus, string> = {
  current: 'Current step',
  completed: 'Completed',
  available: 'Available',
  pending: 'Not yet available',
  skipped: 'Not applicable',
};

function pillClass(status: JourneyStageVisualStatus): string {
  return cn(
    counsellingSessionTokens.journeyTab,
    status === 'current' && counsellingSessionTokens.journeyTabCurrent,
    status === 'completed' && counsellingSessionTokens.journeyTabComplete,
    (status === 'pending' || status === 'skipped') && counsellingSessionTokens.journeyTabMuted,
  );
}

export function CounsellingJourneyRail({
  onNavigateTab,
  onNavigatePhase,
  onFinishSummaryActive,
  navigationBlocked = false,
  contextualDestination = 'none',
  onSelectPatientContext,
  onSelectHistory,
  onSelectConversations,
  onSelectDocuments,
  recordingAction,
  ...input
}: CounsellingJourneyRailProps) {
  const stages = buildJourneyRailStages(input);
  const contextOpen =
    contextualDestination === 'patient-context'
    || contextualDestination === 'history'
    || contextualDestination === 'conversations'
    || contextualDestination === 'documents';
  const conversationsOpen = contextualDestination === 'conversations';
  const documentsOpen = contextualDestination === 'documents';

  const handlers: SessionNavigationHandlers = {
    onNavigateTab,
    onNavigatePhase,
    onFinishSummaryActive,
    isBlocked: navigationBlocked,
  };

  const handleStageSelect = (stageId: JourneyStageId, navigable: boolean) => {
    if (!navigable) return;
    applySessionNavigation(getJourneyStageNavigationTarget(stageId), handlers);
  };

  return (
    <nav
      aria-label="Counselling workflow"
      data-testid={counsellingTestIds.journeyRail}
      className="min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden"
    >
      <ol className={counsellingSessionTokens.journeyTabTrack}>
        <li className="shrink-0 self-center">
          <button
            type="button"
            onClick={onSelectPatientContext}
            aria-label="Patient Context"
            data-workflow-active={contextualDestination === 'patient-context' ? 'true' : 'false'}
            className={cn(
              counsellingSessionTokens.journeyTab,
              contextualDestination === 'patient-context'
                ? counsellingSessionTokens.journeyTabCurrent
                : counsellingSessionTokens.journeyTabMuted,
            )}
          >
            Patient Context
          </button>
        </li>
        {stages.map((stage) => {
          const isCurrent = stage.status === 'current';
          const showCheck = stage.status === 'completed';
          const statusText = `${stage.label} — ${STATUS_LABEL[stage.status]}`;
          const label = (
            <>
              {showCheck ? (
                <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
              ) : null}
              <span>
                <span className="md:hidden">{stage.shortLabel}</span>
                <span className="hidden md:inline">{stage.label}</span>
              </span>
            </>
          );

          const visualStatus: JourneyStageVisualStatus =
            contextOpen && stage.status === 'current' ? 'completed' : stage.status;
          const workflowActive = stage.status === 'current' && contextualDestination === 'none';
          const returnToCurrent = contextOpen && stage.status === 'current';
          const clickable = stage.navigable || returnToCurrent;

          return (
            <li
              key={stage.id}
              data-testid={counsellingTestIds.journeyStage(stage.id)}
              data-journey-status={stage.status}
              data-journey-navigable={clickable ? 'true' : 'false'}
            >
              {clickable ? (
                <button
                  type="button"
                  onClick={() => handleStageSelect(stage.id, true)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Go to ${stage.label}`}
                  title={statusText}
                  data-workflow-active={workflowActive ? 'true' : 'false'}
                  className={pillClass(visualStatus)}
                >
                  {label}
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={statusText}
                  title={statusText}
                  data-workflow-active={workflowActive ? 'true' : 'false'}
                  className={cn(pillClass(visualStatus), 'cursor-default')}
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
        <li className="shrink-0 self-center">
          <button
            type="button"
            onClick={onSelectHistory}
            aria-label={counsellingCopy.sessionHistoryAria}
            data-workflow-active={contextualDestination === 'history' ? 'true' : 'false'}
            className={cn(
              counsellingSessionTokens.journeyTab,
              contextualDestination === 'history'
                ? counsellingSessionTokens.journeyTabCurrent
                : counsellingSessionTokens.journeyTabMuted,
            )}
          >
            {counsellingCopy.sessionHistory}
          </button>
        </li>
        <li className="shrink-0 self-center">
          <button
            type="button"
            onClick={onSelectConversations}
            aria-label={counsellingCopy.sessionConversationsAria}
            data-workflow-active={conversationsOpen ? 'true' : 'false'}
            className={cn(
              counsellingSessionTokens.journeyTab,
              conversationsOpen
                ? counsellingSessionTokens.journeyTabCurrent
                : counsellingSessionTokens.journeyTabMuted,
            )}
          >
            {counsellingCopy.sessionConversations}
          </button>
        </li>
        <li className="shrink-0 self-center">
          <button
            type="button"
            onClick={onSelectDocuments}
            aria-label={counsellingCopy.sessionDocumentsAria}
            data-workflow-active={documentsOpen ? 'true' : 'false'}
            data-testid="counselling-session-documents-nav"
            className={cn(
              counsellingSessionTokens.journeyTab,
              documentsOpen
                ? counsellingSessionTokens.journeyTabCurrent
                : counsellingSessionTokens.journeyTabMuted,
            )}
          >
            {counsellingCopy.sessionDocuments}
          </button>
        </li>
        <li
          className={cn('ml-auto shrink-0 self-center', !recordingAction && 'hidden')}
          data-testid="counselling-session-recording-action"
        >
          {recordingAction}
        </li>
      </ol>
    </nav>
  );
}
