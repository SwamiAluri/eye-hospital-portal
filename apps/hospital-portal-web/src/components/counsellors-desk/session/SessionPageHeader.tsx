'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Loader2, Stethoscope } from 'lucide-react';
import type { Patient } from '@/lib/api/patients.api';
import type { CounsellingSession, WaitingListStatus } from '@/types/counsellors-desk';
import { getStatusBadge } from '@/lib/counsellors-desk/session-utils';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import { sessionTypeLabelForCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import {
  counsellingSessionTokens,
  counsellingTestIds,
} from '@/lib/counsellors-desk/counselling-session-tokens';
import { PatientDemographicsSheet } from '@/components/examination/PatientDemographicsSheet';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import {
  calcPatientAge,
  formatPatientDisplayName,
  formatPatientSex,
  resolvePatientMrn,
} from '@/lib/patients/patient-display-utils';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

function resolveDisplayAge(patient: Patient | null, sessionAge: number): number | null {
  const fromDob = calcPatientAge(patient?.dateOfBirth);
  if (fromDob != null) return fromDob;
  return sessionAge ?? null;
}

interface SessionPageHeaderProps {
  session: CounsellingSession;
  queueStatus: WaitingListStatus;
  patientDetails: Patient | null;
  patientDetailsLoading?: boolean;
  doctorRecommendation?: string | null;
  consultingDoctor?: string | null;
  operativeEye?: string | null;
}

export function SessionPageHeader({
  session,
  queueStatus,
  patientDetails,
  patientDetailsLoading = false,
  doctorRecommendation,
  consultingDoctor,
  operativeEye,
}: SessionPageHeaderProps) {
  const { sessionTypeOptions } = useCounsellorMasterOptions();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const statusBadge = getStatusBadge(queueStatus);
  const sessionTypeLabel = session.sessionTypeCode
    ? sessionTypeLabelForCode(session.sessionTypeCode, sessionTypeOptions)
    : null;

  const displayAge = useMemo(
    () => resolveDisplayAge(patientDetails, session.age),
    [patientDetails, session.age],
  );

  const patientName = formatPatientDisplayName(patientDetails, session.patientName);
  const mrn = resolvePatientMrn(patientDetails, session.uhid) ?? session.uhid;
  const gender = formatPatientSex(patientDetails?.gender?.trim() || session.gender);

  const identityMeta = [
    mrn ? `MRN ${mrn}` : null,
    displayAge != null ? `${displayAge} yrs` : null,
    gender,
    operativeEye?.trim() ? `${counsellingCopy.operativeEye} ${operativeEye}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const clinicalMeta = [
    consultingDoctor?.trim()
      ? `${counsellingCopy.consultingDoctor}: ${consultingDoctor}`
      : null,
    counsellingCopy.counsellingSession,
  ]
    .filter(Boolean)
    .join(' · ');

  const canOpenDetails = Boolean(patientDetails);
  const openDetails = () => {
    if (canOpenDetails) setDetailsOpen(true);
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
        <div className={cn('flex items-center', counsellingSessionTokens.patientHeaderGap)}>
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canOpenDetails && !patientDetailsLoading}
            onClick={openDetails}
            className="h-auto shrink-0 rounded-full p-0 hover:bg-transparent"
            aria-label="View patient details"
          >
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
          </CounsellingButton>

          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between',
              counsellingSessionTokens.patientHeaderZones,
            )}
          >
            <div className={cn('min-w-0 flex-1', counsellingSessionTokens.patientHeaderStack)}>
              <p className={counsellingSessionTokens.patientLabel}>{counsellingCopy.patient}</p>
              <h1 className={counsellingSessionTokens.patientName}>{patientName}</h1>
              {identityMeta ? (
                <p className={cn(counsellingSessionTokens.shellMeta, 'mt-1')}>{identityMeta}</p>
              ) : null}
              {clinicalMeta ? (
                <p className={cn(counsellingSessionTokens.shellSecondaryMeta, 'mt-0.5')}>
                  {clinicalMeta}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
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
              </div>
              {canOpenDetails ? (
                <CounsellingButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={counsellingTestIds.btnPatientDetails}
                  onClick={openDetails}
                  className={cn(
                    'h-auto min-h-9 justify-start gap-1 rounded-md px-2 py-1.5 hover:bg-counselling-muted/60 hover:text-counselling-primary focus-visible:ring-2 focus-visible:ring-counselling-primary/40 sm:justify-end',
                    counsellingSessionTokens.patientDetailsAction,
                  )}
                >
                  {counsellingCopy.patientDetails}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </CounsellingButton>
              ) : null}
            </div>
          </div>
        </div>

        {doctorRecommendation ? (
          <div
            data-testid={counsellingTestIds.clinicalContextRow}
            className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-1 border-l-2 border-amber-400/80 bg-amber-50/60 py-1.5 pl-2.5 pr-1"
          >
            <span className="inline-flex min-w-0 items-start gap-1 text-[12.5px] leading-5 text-amber-950">
              <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{counsellingCopy.recommendedProcedure}: </span>
                <span className="line-clamp-2">{doctorRecommendation}</span>
              </span>
            </span>
            {canOpenDetails ? (
              <CounsellingButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={openDetails}
                className="h-auto px-1 py-0 text-[12.5px] font-medium text-amber-900 hover:bg-amber-100/60 hover:text-amber-950"
              >
                {counsellingCopy.viewClinicalDetails}
              </CounsellingButton>
            ) : null}
          </div>
        ) : null}
      </header>

      <PatientDemographicsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        patient={patientDetails}
        age={displayAge}
        visitLabel={counsellingCopy.counsellingSession}
        displayNameFallback={session.patientName}
        mrnFallback={session.uhid}
        genderFallback={session.gender}
        counsellingContext={{
          counsellingType: sessionTypeLabel,
          sessionStatus:
            queueStatus !== 'RepeatCounselling' ? statusBadge.label : 'Repeat Counselling',
          operativeEye,
          consultingDoctor,
        }}
      />
    </>
  );
}
