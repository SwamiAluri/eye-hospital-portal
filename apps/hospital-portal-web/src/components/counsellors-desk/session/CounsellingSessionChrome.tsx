'use client';

import { CounsellingJourneyRail } from '@/components/counsellors-desk/session/CounsellingJourneyRail';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { CounsellingPhaseCompletion } from '@/lib/counsellors-desk/counselling-progress';
import type { CoverageProgressSnapshot, SessionMainTab } from '@/lib/counsellors-desk/session-status-summary';
import { useCounsellingSessionSummary } from '@/hooks/use-counselling-session-summary';
import type { DecisionType, WaitingListStatus } from '@/types/counsellors-desk';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

const CHIP_VALUE_CLASS: Record<string, string> = {
  neutral: counsellingSessionTokens.sessionStatusDetailValue,
  success: counsellingSessionTokens.sessionStatusDetailValueSuccess,
  warning: counsellingSessionTokens.sessionStatusDetailValueWarning,
  danger: counsellingSessionTokens.sessionStatusDetailValueDanger,
  info: counsellingSessionTokens.sessionStatusDetailValue,
};

export interface CounsellingSessionChromeProps {
  sessionId: string;
  queueStatus: WaitingListStatus;
  activeMainTab: SessionMainTab;
  activePhase: CounsellingPhase;
  phaseCompletion: CounsellingPhaseCompletion;
  isRepeatState: boolean;
  isSurgeryDoneState: boolean;
  decision: DecisionType | '';
  paymentType: string;
  insuranceCompany: string;
  finalPayableAmount: number | null;
  showCoverageWorkflow: boolean;
  coverageTabAvailable?: boolean;
  notRequiredPreAuth: boolean;
  coverageProgress: CoverageProgressSnapshot;
  workspaceCcmsState?: string | null;
  canGoToPhase: (phase: CounsellingPhase) => boolean;
  finishSummaryActive?: boolean;
  onNavigateTab?: (tab: SessionMainTab) => void;
  onNavigatePhase?: (phase: CounsellingPhase) => void;
  onFinishSummaryActive?: (active: boolean) => void;
  navigationBlocked?: boolean;
}

export function CounsellingSessionChrome({
  sessionId,
  queueStatus,
  activeMainTab,
  activePhase,
  phaseCompletion,
  isRepeatState,
  isSurgeryDoneState,
  decision,
  paymentType,
  insuranceCompany,
  finalPayableAmount,
  showCoverageWorkflow,
  coverageTabAvailable,
  notRequiredPreAuth,
  coverageProgress,
  workspaceCcmsState,
  canGoToPhase,
  finishSummaryActive = false,
  onNavigateTab,
  onNavigatePhase,
  onFinishSummaryActive,
  navigationBlocked = false,
}: CounsellingSessionChromeProps) {
  const { summary, mergedProgress } = useCounsellingSessionSummary({
    sessionId,
    queueStatus,
    activeMainTab,
    activePhase,
    phaseCompletion,
    isRepeatState,
    isSurgeryDoneState,
    decision,
    paymentType,
    insuranceCompany,
    finalPayableAmount,
    showCoverageWorkflow,
    notRequiredPreAuth,
    coverageProgress,
    workspaceCcmsState,
  });

  const showOutpatientAccess =
    onNavigateTab && !isRepeatState && !isSurgeryDoneState && activeMainTab !== 'outpatient';

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
        coverageProgress={mergedProgress}
        queueStatus={queueStatus}
        isRepeatState={isRepeatState}
        isSurgeryDoneState={isSurgeryDoneState}
        canGoToPhase={canGoToPhase}
        finishSummaryActive={finishSummaryActive}
        onNavigateTab={onNavigateTab}
        onNavigatePhase={onNavigatePhase}
        onFinishSummaryActive={onFinishSummaryActive}
        navigationBlocked={navigationBlocked}
      />

      <div
        className={cn(counsellingSessionTokens.sessionStatusStrip, 'mt-1.5 min-[1600px]:mt-3')}
        data-testid={counsellingTestIds.sessionSummaryBar}
        aria-label={summary.statusLine}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 min-[1600px]:gap-3">
          <div className="min-w-0 flex-1">
            {summary.chips.length > 0 ? (
              <dl
                className={counsellingSessionTokens.sessionStatusDetails}
                data-testid={counsellingTestIds.sessionSummaryChips}
              >
                {summary.chips.map((chip) => (
                  <div
                    key={chip.id}
                    data-testid={counsellingTestIds.sessionSummaryChip(chip.id)}
                    className="min-w-0"
                  >
                    <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>{chip.label}</dt>
                    <dd
                      className={cn(
                        'truncate',
                        CHIP_VALUE_CLASS[chip.tone] ?? CHIP_VALUE_CLASS.neutral,
                      )}
                    >
                      {chip.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {showOutpatientAccess ? (
            <button
              type="button"
              data-testid={counsellingTestIds.outpatientAccess}
              onClick={() => onNavigateTab('outpatient')}
              disabled={navigationBlocked}
              className={cn(counsellingSessionTokens.outpatientAccessLink, 'shrink-0')}
            >
              Outpatient Safety
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
