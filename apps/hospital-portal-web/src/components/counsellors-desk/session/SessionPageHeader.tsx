'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2, Phone, Stethoscope } from 'lucide-react';
import type { Patient } from '@/lib/api/patients.api';
import type { CounsellingSession, WaitingListStatus } from '@/types/counsellors-desk';
import { getStatusBadge } from '@/lib/counsellors-desk/session-utils';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import { sessionTypeLabelForCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { PatientDemographicsSheet } from '@/components/examination/PatientDemographicsSheet';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import {
  formatPatientDob,
  resolvePatientMrn,
  resolvePatientPhone,
} from '@/lib/patients/patient-display-utils';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';
import { CounsellingDisabledActionTooltip } from '@/components/counsellors-desk/session/CounsellingDisabledActionTooltip';

function resolveDisplayAge(patient: Patient | null, sessionAge: number): number | null {
  if (patient?.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
  }
  return sessionAge ?? null;
}

interface SessionPageHeaderProps {
  session: CounsellingSession;
  queueStatus: WaitingListStatus;
  patientDetails: Patient | null;
  patientDetailsLoading?: boolean;
  onBack: () => void;
  doctorRecommendation?: string | null;
  onSaveSession: () => void;
  saveDisabledReason: string | null;
  isSaving: boolean;
  showSaveSession?: boolean;
}

export function SessionPageHeader({
  session,
  queueStatus,
  patientDetails,
  patientDetailsLoading = false,
  onBack,
  doctorRecommendation,
  onSaveSession,
  saveDisabledReason,
  isSaving,
  showSaveSession = true,
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

  const mrn = resolvePatientMrn(patientDetails, session.uhid) ?? session.uhid;
  const phone = resolvePatientPhone(patientDetails);
  const dobLabel = formatPatientDob(patientDetails?.dateOfBirth);
  const bloodGroup = patientDetails?.bloodGroup;

  const identityMeta = [
    displayAge != null ? `${displayAge} yrs` : null,
    patientDetails?.gender ?? session.gender,
    bloodGroup,
    mrn ? `MRN ${mrn}` : null,
    dobLabel ? `DOB ${dobLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const openDetails = () => {
    if (patientDetails) setDetailsOpen(true);
  };

  return (
    <>
      <div className="z-30 shrink-0 rounded-xl border border-counselling-border bg-counselling-card px-3 py-2.5 shadow-sm sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <CounsellingButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mt-0.5 h-8 shrink-0 gap-1 px-2 text-counselling-muted-foreground"
              aria-label="Back to waiting list"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{counsellingCopy.back}</span>
            </CounsellingButton>

            <CounsellingButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={!patientDetails && !patientDetailsLoading}
              onClick={openDetails}
              className="h-auto shrink-0 rounded-full p-0 hover:bg-transparent"
              aria-label="View patient details"
            >
              {patientDetailsLoading ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-counselling-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-counselling-muted-foreground" />
                </div>
              ) : (
                <PatientAvatar
                  photoUrl={patientDetails?.photoUrl}
                  firstName={patientDetails?.firstName}
                  lastName={patientDetails?.lastName}
                  displayName={session.patientName}
                  size="md"
                  className="h-10 w-10 ring-2 ring-counselling-accent"
                />
              )}
            </CounsellingButton>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="truncate text-sm font-semibold text-counselling-foreground sm:text-base">
                  {session.patientName}
                </h1>
                {queueStatus !== 'RepeatCounselling' ? (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                ) : null}
                {sessionTypeLabel ? (
                  <span className="rounded bg-counselling-muted px-1.5 py-0.5 text-[10px] text-counselling-foreground">
                    {sessionTypeLabel}
                  </span>
                ) : null}
                {doctorRecommendation ? (
                  <span
                    className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800"
                    title={`Doctor recommends: ${doctorRecommendation}`}
                  >
                    <Stethoscope className="h-3 w-3 shrink-0" aria-hidden />
                    {doctorRecommendation}
                  </span>
                ) : null}
              </div>

              <p className="mt-0.5 text-[11px] tabular-nums text-counselling-muted-foreground">{identityMeta}</p>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {phone ? (
                  <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-counselling-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    {phone}
                  </span>
                ) : null}
                {patientDetails ? (
                  <CounsellingButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid={counsellingTestIds.btnPatientDetails}
                    onClick={openDetails}
                    className="h-auto gap-0.5 px-0 py-0 text-[11px] font-medium text-counselling-primary hover:bg-transparent hover:text-counselling-primary/80"
                  >
                    {counsellingCopy.patientDetails}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </CounsellingButton>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            {showSaveSession ? (
              <CounsellingDisabledActionTooltip reason={saveDisabledReason}>
                <CounsellingButton
                  type="button"
                  onClick={onSaveSession}
                  disabled={!!saveDisabledReason}
                  data-testid={counsellingTestIds.btnSaveSession}
                  className="h-9 gap-2 bg-counselling-primary px-4 hover:bg-counselling-primary/90 disabled:opacity-50 sm:px-6"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {counsellingCopy.saveSession}
                </CounsellingButton>
              </CounsellingDisabledActionTooltip>
            ) : null}
          </div>
        </div>
      </div>

      <PatientDemographicsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        patient={patientDetails}
        age={displayAge}
        visitLabel={counsellingCopy.counsellingSession}
      />
    </>
  );
}
