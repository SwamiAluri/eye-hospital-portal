'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { Patient } from '@/lib/api/patients.api';
import type { CounsellingSession, WaitingListStatus } from '@/types/counsellors-desk';
import { getStatusBadge } from '@/lib/counsellors-desk/session-utils';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import { sessionTypeLabelForCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { SessionSummaryChip } from '@/lib/counsellors-desk/session-status-summary';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import {
  formatPatientDisplayName,
  formatPatientSex,
  resolvePatientMrn,
} from '@/lib/patients/patient-display-utils';
import { cn } from '@/lib/utils';

const CHIP_VALUE_CLASS: Record<string, string> = {
  neutral: counsellingSessionTokens.sessionStatusDetailValue,
  success: counsellingSessionTokens.sessionStatusDetailValueSuccess,
  warning: counsellingSessionTokens.sessionStatusDetailValueWarning,
  danger: counsellingSessionTokens.sessionStatusDetailValueDanger,
  info: counsellingSessionTokens.sessionStatusDetailValue,
};

interface SessionPageHeaderProps {
  session: CounsellingSession;
  queueStatus: WaitingListStatus;
  patientDetails: Patient | null;
  patientDetailsLoading?: boolean;
  doctorRecommendation?: string | null;
  consultingDoctor?: string | null;
  operativeEye?: string | null;
  /** Existing session summary chips. Rendered in the header, not under the journey rail. */
  summaryChips?: SessionSummaryChip[];
  summaryStatusLine?: string;
  /** Opens the outpatient checklist. Same gate as the previous strip action. */
  showOutpatientSafety?: boolean;
  onOpenOutpatientSafety?: () => void;
  /** Leaves the session. Same navigation as the former footer Close. */
  onCloseSession?: () => void;
  /** Page-local Patient Context destination. Not a sheet or popover. */
  onOpenPatientContext?: () => void;
  /** Page-local History destination. Not a modal. */
  onOpenHistory?: () => void;
  renderWorkflow?: (actions: {
    openClinicalRecommendations: () => void;
    openSessionHistory: () => void;
  }) => ReactNode;
}

export function SessionPageHeader({
  session,
  queueStatus,
  patientDetails,
  patientDetailsLoading = false,
  operativeEye,
  summaryChips,
  summaryStatusLine,
  showOutpatientSafety = false,
  onOpenOutpatientSafety,
  onCloseSession,
  onOpenPatientContext,
  onOpenHistory,
  renderWorkflow,
}: SessionPageHeaderProps) {
  const { sessionTypeOptions } = useCounsellorMasterOptions();

  const statusBadge = getStatusBadge(queueStatus);
  const sessionTypeLabel = session.sessionTypeCode
    ? sessionTypeLabelForCode(session.sessionTypeCode, sessionTypeOptions)
    : null;

  const patientName = formatPatientDisplayName(patientDetails, session.patientName);
  const mrn = resolvePatientMrn(patientDetails, session.uhid) ?? session.uhid;
  const gender = formatPatientSex(patientDetails?.gender?.trim() || session.gender);

  const identityMeta = [
    mrn ? `MRN ${mrn}` : null,
    gender,
    operativeEye?.trim() ? `${counsellingCopy.operativeEye} ${operativeEye}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const showSummary = summaryChips != null;

  const openClinicalRecommendations = () => {
    onOpenPatientContext?.();
  };

  const openSessionHistory = () => {
    onOpenHistory?.();
  };

  return (
    <>
      <header
        className={cn(
          'z-30',
          counsellingSessionTokens.sessionWidget,
          counsellingSessionTokens.patientHeaderPad,
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center',
            counsellingSessionTokens.patientHeaderGap,
          )}
        >
          <div className={cn('flex min-w-0 shrink-0 items-center xl:max-w-[16rem]', counsellingSessionTokens.patientHeaderGap)}>
            <div className="shrink-0" aria-hidden={patientDetailsLoading ? undefined : true}>
              {patientDetailsLoading ? (
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full bg-counselling-muted',
                    counsellingSessionTokens.patientHeaderPhoto,
                  )}
                >
                  <Loader2 className="h-5 w-5 animate-spin text-counselling-muted-foreground" />
                </div>
              ) : (
                <PatientAvatar
                  photoUrl={patientDetails?.photoUrl}
                  firstName={patientDetails?.firstName}
                  lastName={patientDetails?.lastName}
                  displayName={patientName}
                  size="lg"
                  className={counsellingSessionTokens.patientHeaderPhoto}
                />
              )}
            </div>
            <div className={cn('min-w-0', counsellingSessionTokens.patientHeaderStack)}>
              <h1 className={counsellingSessionTokens.patientName}>{patientName}</h1>
              {identityMeta ? (
                <p className={cn(counsellingSessionTokens.shellMeta, 'mt-1')}>{identityMeta}</p>
              ) : null}
            </div>
          </div>

          {showSummary ? (
            <div className="hidden h-9 w-px shrink-0 bg-counselling-border xl:block" aria-hidden />
          ) : null}

          {showSummary ? (
            <div
              className="min-w-0 flex-1"
              data-testid={counsellingTestIds.sessionSummaryBar}
              aria-label={summaryStatusLine}
            >
              <dl
                className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 xl:grid-cols-5"
                data-testid={counsellingTestIds.sessionSummaryChips}
              >
                {summaryChips.map((chip) => (
                  <div
                    key={chip.id}
                    data-testid={counsellingTestIds.sessionSummaryChip(chip.id)}
                    className="min-w-0"
                  >
                    <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>{chip.label}</dt>
                    <dd
                      className={cn(
                        'whitespace-normal leading-snug',
                        CHIP_VALUE_CLASS[chip.tone] ?? CHIP_VALUE_CLASS.neutral,
                      )}
                    >
                      {chip.value}
                    </dd>
                  </div>
                ))}
                <div className="min-w-0" data-testid={counsellingTestIds.sessionSummaryChip('safety')}>
                  <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Safety</dt>
                  <dd className={cn('whitespace-normal leading-snug', counsellingSessionTokens.sessionStatusDetailValue)}>
                    {showOutpatientSafety ? (
                      <button
                        type="button"
                        data-testid={counsellingTestIds.outpatientAccess}
                        aria-label="Outpatient Safety"
                        onClick={onOpenOutpatientSafety}
                        className="text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
                      >
                        Outpatient
                      </button>
                    ) : (
                      'Outpatient'
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {showSummary ? (
            <div className="hidden h-9 w-px shrink-0 bg-counselling-border xl:block" aria-hidden />
          ) : null}

          <div className="flex shrink-0 flex-col items-stretch gap-1.5 xl:items-end">
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                {queueStatus !== 'RepeatCounselling' ? (
                  <span
                    className={cn(
                      'rounded-md px-2.5 py-0.5',
                      counsellingSessionTokens.patientStatusPill,
                      statusBadge.cls,
                    )}
                  >
                    {statusBadge.label}
                  </span>
                ) : null}
                {sessionTypeLabel ? (
                  <span
                    className={cn(
                      'rounded-md bg-counselling-muted/80 px-2.5 py-0.5 text-counselling-foreground',
                      counsellingSessionTokens.patientStatusPill,
                      'font-medium',
                    )}
                  >
                    {sessionTypeLabel}
                  </span>
                ) : null}
                {onCloseSession ? (
                  <button
                    type="button"
                    onClick={onCloseSession}
                    data-testid={counsellingTestIds.btnCloseSession}
                    className={cn(
                      'rounded-md px-2.5 py-0.5 text-counselling-muted-foreground hover:bg-counselling-muted/50 hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
                      counsellingSessionTokens.patientStatusPill,
                    )}
                  >
                    Close
                  </button>
                ) : null}
              </div>
            </div>
          </div>
      </header>
      {renderWorkflow?.({ openClinicalRecommendations, openSessionHistory })}
    </>
  );
}
