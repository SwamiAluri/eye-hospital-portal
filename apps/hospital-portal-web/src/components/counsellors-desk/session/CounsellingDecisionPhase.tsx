'use client';

import { useMemo } from 'react';
import { Calendar, ClipboardList, CreditCard, UserCheck } from 'lucide-react';
import type { CombinedPaymentType, DecisionType, ScheduleData } from '@/types/counsellors-desk';
import { type CounsellingPhaseValidationContext } from '@/lib/counsellors-desk/counselling-progress';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import {
  isDecisionPhaseComplete,
  resolveDecisionPhaseBlocker,
} from '@/lib/counsellors-desk/decision-workspace-presentation';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { DecisionSummaryStrip } from '@/components/counsellors-desk/session/DecisionSummaryStrip';
import { CounsellingSessionWidget } from '@/components/counsellors-desk/session/CounsellingSessionWidget';
import { CounsellingStatusPill } from '@/components/counsellors-desk/session/CounsellingStatusPill';
import {
  CounsellingDecisionSection,
  CounsellingFollowUpSection,
  CounsellingPaymentSection,
  CounsellingScheduleSection,
} from '@/components/counsellors-desk/session/CounsellingWorkflowSections';

export interface CounsellingDecisionPhaseProps {
  paymentType: CombinedPaymentType | '';
  setPaymentType: (v: CombinedPaymentType | '') => void;
  insuranceCompany: string;
  setInsuranceCompany: (v: string) => void;
  insuranceProviderOptions: { value: string; label: string }[];
  freeSurgeryReason: string;
  setFreeSurgeryReason: (v: string) => void;
  decision: DecisionType | '';
  setDecision: (v: DecisionType) => void;
  followUpReason: string;
  setFollowUpReason: (v: string) => void;
  followUpDate: string;
  setFollowUpDate: (v: string) => void;
  schedule: ScheduleData | null;
  setIsScheduleModalOpen: (open: boolean) => void;
  isReadOnly: boolean;
  markDirty: () => void;
  phaseValidationContext: CounsellingPhaseValidationContext;
}

export function CounsellingDecisionPhase({
  paymentType,
  setPaymentType,
  insuranceCompany,
  setInsuranceCompany,
  insuranceProviderOptions,
  freeSurgeryReason,
  setFreeSurgeryReason,
  decision,
  setDecision,
  followUpReason,
  setFollowUpReason,
  followUpDate,
  setFollowUpDate,
  schedule,
  setIsScheduleModalOpen,
  isReadOnly,
  markDirty,
  phaseValidationContext,
}: CounsellingDecisionPhaseProps) {
  const showSchedule = decision === 'DateForSurgery' || decision === 'Interested';
  const scheduleRequired = decision === 'DateForSurgery';
  const showFollowUp = decision === 'NotInterested' || decision === 'NeedsTime';
  const phaseInput = phaseValidationContext;
  const isComplete = isDecisionPhaseComplete(phaseValidationContext);
  const blocker = useMemo(() => resolveDecisionPhaseBlocker(phaseInput), [phaseInput]);

  return (
    <div
      data-testid={counsellingTestIds.decisionWorkspace}
      className={`${counsellingSessionTokens.counsellingWorkspace} pb-4`}
    >
      <CounsellingSessionWidget
        title={counsellingCopy.decision}
        icon={<UserCheck className="h-4 w-4 text-counselling-primary" aria-hidden />}
        data-testid={counsellingTestIds.decisionWorkspaceHeader}
        headerAction={
          <CounsellingStatusPill
            tone={isComplete ? 'complete' : 'required'}
            data-testid={counsellingTestIds.decisionWorkspaceStatus}
          >
            {isComplete
              ? counsellingCopy.decisionRecordedBadge
              : counsellingCopy.decisionRequiredBadge}
          </CounsellingStatusPill>
        }
      >
        {!isComplete && blocker ? (
          <p
            data-testid={counsellingTestIds.decisionInlineBlocker}
            className="text-xs text-amber-900"
            role="status"
          >
            {blocker}
          </p>
        ) : null}

        <CounsellingDecisionSection
          embedded
          decision={decision}
          setDecision={setDecision}
          followUpReason={followUpReason}
          setFollowUpReason={setFollowUpReason}
          followUpDate={followUpDate}
          setFollowUpDate={setFollowUpDate}
          isReadOnly={isReadOnly}
          markDirty={markDirty}
        />

        {decision ? (
          <DecisionSummaryStrip
            decision={decision}
            paymentType={paymentType}
            insuranceCompany={insuranceCompany}
            schedule={schedule}
          />
        ) : null}
      </CounsellingSessionWidget>

      <CounsellingSessionWidget
        title={counsellingCopy.fundingSource}
        icon={<CreditCard className="h-4 w-4 text-counselling-primary" aria-hidden />}
        data-testid="counselling-decision-funding-widget"
      >
        <CounsellingPaymentSection
          embedded
          paymentType={paymentType}
          setPaymentType={setPaymentType}
          insuranceCompany={insuranceCompany}
          setInsuranceCompany={setInsuranceCompany}
          insuranceProviderOptions={insuranceProviderOptions}
          freeSurgeryReason={freeSurgeryReason}
          setFreeSurgeryReason={setFreeSurgeryReason}
          isReadOnly={isReadOnly}
          markDirty={markDirty}
        />
      </CounsellingSessionWidget>

      {showSchedule ? (
        <CounsellingSessionWidget
          title={counsellingCopy.surgerySchedule}
          icon={<Calendar className="h-4 w-4 text-counselling-primary" aria-hidden />}
          data-testid="counselling-decision-schedule-widget"
        >
          <CounsellingScheduleSection
            embedded
            compact
            schedule={schedule}
            required={scheduleRequired}
            optional={decision === 'Interested'}
            setIsScheduleModalOpen={setIsScheduleModalOpen}
          />
        </CounsellingSessionWidget>
      ) : null}

      {showFollowUp ? (
        <CounsellingSessionWidget
          title={counsellingCopy.followUpRequired}
          icon={<ClipboardList className="h-4 w-4 text-counselling-primary" aria-hidden />}
          data-testid="counselling-decision-followup-widget"
        >
          <CounsellingFollowUpSection
            embedded
            followUpReason={followUpReason}
            setFollowUpReason={setFollowUpReason}
            followUpDate={followUpDate}
            setFollowUpDate={setFollowUpDate}
            isReadOnly={isReadOnly}
            markDirty={markDirty}
          />
        </CounsellingSessionWidget>
      ) : null}
    </div>
  );
}
