'use client';

import type { CombinedPaymentType, DecisionType, ScheduleData } from '@/types/counsellors-desk';
import { isCoveragePaymentType } from '@/lib/counsellors-desk/counselling-progress';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingCard,
  CounsellingCardContent,
  CounsellingCardDescription,
  CounsellingCardHeader,
  CounsellingCardTitle,
  CounsellingButton,
} from '@/components/counsellors-desk/session/primitives';
import {
  CounsellingDecisionSection,
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
  onOpenCoverageTab?: () => void;
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
  onOpenCoverageTab,
}: CounsellingDecisionPhaseProps) {
  const showSchedule = decision === 'DateForSurgery';
  const showCoverageBanner = paymentType && isCoveragePaymentType(paymentType);

  return (
    <div className="flex flex-col gap-5 pb-4">
      <CounsellingCard className={counsellingSessionTokens.card}>
        <CounsellingCardHeader className={counsellingSessionTokens.cardHeader}>
          <CounsellingCardTitle className={counsellingSessionTokens.sectionTitle}>
            Payment &amp; coverage
          </CounsellingCardTitle>
          <CounsellingCardDescription className={counsellingSessionTokens.sectionSubtitle}>
            How the patient will pay for this procedure.
          </CounsellingCardDescription>
        </CounsellingCardHeader>
        <CounsellingCardContent className={counsellingSessionTokens.cardBody}>
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
          {showCoverageBanner && onOpenCoverageTab ? (
            <div className="mt-4">
              <CounsellingButton
                type="button"
                variant="outline"
                onClick={onOpenCoverageTab}
                data-testid={counsellingTestIds.btnOpenCoverage}
              >
                Coverage &amp; Pre-Auth
              </CounsellingButton>
            </div>
          ) : null}
        </CounsellingCardContent>
      </CounsellingCard>

      <CounsellingCard className={counsellingSessionTokens.card}>
        <CounsellingCardHeader className={counsellingSessionTokens.cardHeader}>
          <CounsellingCardTitle className={counsellingSessionTokens.sectionTitle}>
            Patient decision
          </CounsellingCardTitle>
          <CounsellingCardDescription className={counsellingSessionTokens.sectionSubtitle}>
            Record the outcome of this counselling visit.
          </CounsellingCardDescription>
        </CounsellingCardHeader>
        <CounsellingCardContent className={counsellingSessionTokens.cardBody}>
          <CounsellingDecisionSection
            embedded
            decision={decision}
            setDecision={setDecision}
            followUpReason={followUpReason}
            setFollowUpReason={setFollowUpReason}
            followUpDate={followUpDate}
            setFollowUpDate={setFollowUpDate}
            schedule={schedule}
            isReadOnly={isReadOnly}
            markDirty={markDirty}
          />
        </CounsellingCardContent>
      </CounsellingCard>

      {showSchedule ? (
        <CounsellingCard className={counsellingSessionTokens.card}>
          <CounsellingCardHeader className={counsellingSessionTokens.cardHeader}>
            <CounsellingCardTitle className={counsellingSessionTokens.sectionTitle}>
              Surgery schedule
            </CounsellingCardTitle>
            <CounsellingCardDescription className={counsellingSessionTokens.sectionSubtitle}>
              Required when the patient agrees to a surgery date.
            </CounsellingCardDescription>
          </CounsellingCardHeader>
          <CounsellingCardContent className={counsellingSessionTokens.cardBody}>
            <CounsellingScheduleSection
              embedded
              schedule={schedule}
              setIsScheduleModalOpen={setIsScheduleModalOpen}
            />
          </CounsellingCardContent>
        </CounsellingCard>
      ) : null}
    </div>
  );
}
