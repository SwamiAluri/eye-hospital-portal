import { useEffect, useMemo, useState } from 'react';
import { validateAdmission, type AdmissionValidation } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { CounsellingPhaseCompletion } from '@/lib/counsellors-desk/counselling-progress';
import {
  buildSessionStatusSummary,
  type CoverageProgressSnapshot,
  type SessionMainTab,
  type SessionStatusSummary,
} from '@/lib/counsellors-desk/session-status-summary';
import type { DecisionType, WaitingListStatus } from '@/types/counsellors-desk';

export interface UseCounsellingSessionSummaryInput {
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
  notRequiredPreAuth: boolean;
  coverageProgress: CoverageProgressSnapshot;
  workspaceCcmsState?: string | null;
}

export function useCounsellingSessionSummary(
  input: UseCounsellingSessionSummaryInput,
): { summary: SessionStatusSummary; mergedProgress: CoverageProgressSnapshot } {
  const [admission, setAdmission] = useState<AdmissionValidation | null>(null);

  useEffect(() => {
    if (!input.showCoverageWorkflow) {
      setAdmission(null);
      return;
    }
    let active = true;
    void validateAdmission({ sessionId: input.sessionId })
      .then((data) => {
        if (active) setAdmission(data);
      })
      .catch(() => {
        if (active) setAdmission(null);
      });
    return () => {
      active = false;
    };
  }, [
    input.sessionId,
    input.showCoverageWorkflow,
    input.coverageProgress.ccmsState,
    input.coverageProgress.preAuthSubmitted,
  ]);

  const mergedProgress = useMemo<CoverageProgressSnapshot>(
    () => ({
      ...input.coverageProgress,
      ccmsState:
        input.coverageProgress.ccmsState ??
        input.workspaceCcmsState ??
        admission?.coverageState,
    }),
    [input.coverageProgress, input.workspaceCcmsState, admission?.coverageState],
  );

  const summary = useMemo(
    () =>
      buildSessionStatusSummary({
        queueStatus: input.queueStatus,
        activeMainTab: input.activeMainTab,
        activePhase: input.activePhase,
        phaseCompletion: input.phaseCompletion,
        isRepeatState: input.isRepeatState,
        isSurgeryDoneState: input.isSurgeryDoneState,
        decision: input.decision,
        paymentType: input.paymentType,
        insuranceCompany: input.insuranceCompany,
        finalPayableAmount: input.finalPayableAmount,
        showCoverageWorkflow: input.showCoverageWorkflow,
        notRequiredPreAuth: input.notRequiredPreAuth,
        coverageProgress: mergedProgress,
        admission,
      }),
    [
      input.queueStatus,
      input.activeMainTab,
      input.activePhase,
      input.phaseCompletion,
      input.isRepeatState,
      input.isSurgeryDoneState,
      input.decision,
      input.paymentType,
      input.insuranceCompany,
      input.finalPayableAmount,
      input.showCoverageWorkflow,
      input.notRequiredPreAuth,
      mergedProgress,
      admission,
    ],
  );

  return { summary, mergedProgress };
}
