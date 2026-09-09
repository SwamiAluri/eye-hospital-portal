'use client';

import { Check } from 'lucide-react';
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
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export interface CounsellingJourneyRailProps extends BuildJourneyRailInput {
  onNavigateTab?: (tab: SessionMainTab) => void;
  onNavigatePhase?: (phase: CounsellingPhase) => void;
  onFinishSummaryActive?: (active: boolean) => void;
  navigationBlocked?: boolean;
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
  ...input
}: CounsellingJourneyRailProps) {
  const stages = buildJourneyRailStages(input);

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
        {stages.map((stage) => {
          const isCurrent = stage.status === 'current';
          const showCheck = stage.status === 'completed';
          const statusText = `${stage.label} — ${STATUS_LABEL[stage.status]}`;
          const label = (
            <>
              {showCheck ? (
                <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    isCurrent ? 'bg-white' : 'bg-counselling-muted-foreground/50',
                  )}
                />
              )}
              <span>
                <span className="md:hidden">{stage.shortLabel}</span>
                <span className="hidden md:inline">{stage.label}</span>
              </span>
            </>
          );

          return (
            <li
              key={stage.id}
              data-testid={counsellingTestIds.journeyStage(stage.id)}
              data-journey-status={stage.status}
              data-journey-navigable={stage.navigable ? 'true' : 'false'}
            >
              {stage.navigable ? (
                <button
                  type="button"
                  onClick={() => handleStageSelect(stage.id, stage.navigable)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Go to ${stage.label}`}
                  title={statusText}
                  className={pillClass(stage.status)}
                >
                  {label}
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={statusText}
                  title={statusText}
                  className={cn(pillClass(stage.status), 'cursor-default')}
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
