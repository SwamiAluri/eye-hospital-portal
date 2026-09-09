'use client';

import { CheckCircle2, ClipboardList, FileText, Shield, Wallet } from 'lucide-react';
import { formatScheduleSummary } from '@/lib/counsellors-desk/decision-workspace-presentation';
import {
  finishOutcomeHeadline,
} from '@/lib/counsellors-desk/counselling-finish-outcome';
import {
  buildFinishPatientNextSteps,
  eyeDisplayLabel,
  resolveFinishCoverageLabel,
  summarizeEstimateAmounts,
} from '@/lib/counsellors-desk/counselling-finish-presentation';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import {
  formatDecisionLabel,
  type CoverageProgressSnapshot,
} from '@/lib/counsellors-desk/session-status-summary';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingSessionWidget } from '@/components/counsellors-desk/session/CounsellingSessionWidget';
import type { DecisionType, ScheduleData, WaitingListStatus } from '@/types/counsellors-desk';
import type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';

export interface CounsellingFinishSummaryProps {
  queueStatus: WaitingListStatus;
  decision: DecisionType | '';
  paymentType: string;
  insuranceCompany: string;
  schedule: ScheduleData | null;
  finalPayableAmount: number | null;
  showCoverageWorkflow: boolean;
  notRequiredPreAuth?: boolean;
  coverageProgress: CoverageProgressSnapshot;
  counsellorNotes: string;
  patientRemarks: string;
  doctorNotes: string;
  patientName?: string;
  procedureName?: string | null;
  packageName?: string | null;
  selectedEye?: 'RE' | 'LE' | 'BE' | string | null;
  estimateLines?: EstimateLine[];
  itemizedSubtotal?: number;
  discountAmount?: number;
  baseBeforeDiscount?: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
      <dt className="text-counselling-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-counselling-foreground">{value}</dd>
    </div>
  );
}

/** Terminal read-only confirmation after Save session completion — not a counselling phase. */
export function CounsellingFinishSummary({
  queueStatus,
  decision,
  paymentType,
  insuranceCompany,
  schedule,
  finalPayableAmount,
  showCoverageWorkflow,
  notRequiredPreAuth = false,
  coverageProgress,
  counsellorNotes,
  patientRemarks,
  doctorNotes,
  patientName,
  procedureName,
  packageName,
  selectedEye,
  estimateLines = [],
  itemizedSubtotal,
  discountAmount = 0,
  baseBeforeDiscount,
}: CounsellingFinishSummaryProps) {
  const headline = finishOutcomeHeadline(queueStatus);
  const scheduleText = formatScheduleSummary(schedule);
  const coverageLabel = resolveFinishCoverageLabel({
    showCoverageWorkflow,
    notRequiredPreAuth,
    coverageProgress,
  });
  const notesPresent = [counsellorNotes, patientRemarks, doctorNotes].some((n) => n.trim());
  const docsLabel =
    coverageProgress.requiredDocCount > 0
      ? `${coverageProgress.uploadedDocCount}/${coverageProgress.requiredDocCount} received`
      : null;
  const amounts = summarizeEstimateAmounts(estimateLines);
  const payable =
    finalPayableAmount != null && finalPayableAmount > 0
      ? formatInr(finalPayableAmount)
      : '—';
  const fundingLine = insuranceCompany.trim()
    ? `${paymentType || '—'} · ${insuranceCompany.trim()}`
    : paymentType || '—';
  const procedureLabel =
    packageName?.trim() ||
    procedureName?.trim() ||
    '—';
  const nextSteps = buildFinishPatientNextSteps({
    queueStatus,
    scheduleSummary: scheduleText,
    showCoverageWorkflow,
    coverageLabel,
    preAuthSubmitted: coverageProgress.preAuthSubmitted,
    docsIncomplete:
      coverageProgress.requiredDocCount > 0 &&
      coverageProgress.uploadedDocCount < coverageProgress.requiredDocCount,
  });

  return (
    <div
      data-testid={counsellingTestIds.finishWorkspace}
      className={`${counsellingSessionTokens.counsellingWorkspace} space-y-3 pb-4`}
    >
      <CounsellingSessionWidget
        title={counsellingCopy.finishOutcome}
        icon={<CheckCircle2 className="h-4 w-4 text-counselling-primary" aria-hidden />}
        data-testid={counsellingTestIds.finishOutcomeWidget}
      >
        <p className="text-sm font-semibold text-counselling-foreground">{headline}</p>
        <p className="mt-1 text-xs text-counselling-muted-foreground">
          {formatDecisionLabel(decision)}
          {queueStatus !== 'Done' ? ` · ${queueStatus}` : null}
        </p>
      </CounsellingSessionWidget>

      <CounsellingSessionWidget
        title={counsellingCopy.finishAgreedPlan}
        icon={<ClipboardList className="h-4 w-4 text-counselling-primary" aria-hidden />}
        data-testid={counsellingTestIds.finishSummaryWidget}
      >
        <dl className="space-y-2">
          {patientName ? <Row label={counsellingCopy.patient} value={patientName} /> : null}
          <Row label={counsellingCopy.procedure} value={procedureLabel} />
          <Row label={counsellingCopy.eye} value={eyeDisplayLabel(selectedEye)} />
          {schedule?.doctor ? <Row label={counsellingCopy.doctor} value={schedule.doctor} /> : null}
          {scheduleText ? <Row label={counsellingCopy.surgerySchedule} value={scheduleText} /> : null}
          {schedule?.operationTheatre && !scheduleText?.includes(schedule.operationTheatre) ? (
            <Row label={counsellingCopy.operationTheatre} value={schedule.operationTheatre} />
          ) : null}
        </dl>
      </CounsellingSessionWidget>

      <CounsellingSessionWidget
        title={counsellingCopy.finishFinancial}
        icon={<Wallet className="h-4 w-4 text-counselling-primary" aria-hidden />}
        data-testid={counsellingTestIds.finishFinancialWidget}
      >
        <dl className="space-y-2">
          {amounts.procedureAmount > 0 ? (
            <Row label={counsellingCopy.procedurePackageAmount} value={formatInr(amounts.procedureAmount)} />
          ) : null}
          {amounts.investigationAmount > 0 ? (
            <Row
              label={counsellingCopy.investigationsAmount}
              value={formatInr(amounts.investigationAmount)}
            />
          ) : null}
          {amounts.otherAmount > 0 ? (
            <Row label={counsellingCopy.otherEstimateAmount} value={formatInr(amounts.otherAmount)} />
          ) : null}
          {itemizedSubtotal != null && itemizedSubtotal > 0 ? (
            <Row label={counsellingCopy.subtotal} value={formatInr(itemizedSubtotal)} />
          ) : baseBeforeDiscount != null && baseBeforeDiscount > 0 ? (
            <Row label={counsellingCopy.subtotal} value={formatInr(baseBeforeDiscount)} />
          ) : null}
          {discountAmount > 0 ? (
            <Row label={counsellingCopy.discount} value={`−${formatInr(discountAmount)}`} />
          ) : null}
          <Row label={counsellingCopy.finalPayable} value={payable} />
        </dl>
      </CounsellingSessionWidget>

      <CounsellingSessionWidget
        title={counsellingCopy.finishCoverage}
        icon={<Shield className="h-4 w-4 text-counselling-primary" aria-hidden />}
        data-testid={counsellingTestIds.finishCoverageWidget}
      >
        <dl className="space-y-2">
          <Row label={counsellingCopy.fundingSource} value={fundingLine} />
          <Row label={counsellingCopy.preAuthStatus} value={coverageLabel} />
        </dl>
      </CounsellingSessionWidget>

      <CounsellingSessionWidget
        title={counsellingCopy.finishDocumentation}
        icon={<FileText className="h-4 w-4 text-counselling-primary" aria-hidden />}
        data-testid={counsellingTestIds.finishDocsWidget}
      >
        <dl className="space-y-2">
          <Row
            label={counsellingCopy.notes}
            value={notesPresent ? counsellingCopy.finishNotesRecorded : counsellingCopy.finishNotesEmpty}
          />
          {docsLabel ? <Row label={counsellingCopy.documents} value={docsLabel} /> : null}
        </dl>
        {nextSteps.length > 0 ? (
          <ul
            className="mt-3 list-disc space-y-1 border-t border-counselling-border/40 pt-3 pl-4 text-xs text-counselling-muted-foreground"
            data-testid={counsellingTestIds.finishNextStepsWidget}
          >
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        ) : null}
      </CounsellingSessionWidget>
    </div>
  );
}
