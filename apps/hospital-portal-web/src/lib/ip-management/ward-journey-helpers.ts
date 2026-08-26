import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';

const CANCEL_CLINICAL_STATES = new Set([
  'Expected',
  'Admitted',
  'ReadyForSurgery',
  'SentToOT',
]);

/** Whether ward cancel-today is allowed (G1 / R7). */
export function canCancelTodaySurgery(journey: Pick<
  PatientJourneyRowDto,
  'clinicalState' | 'otState' | 'isLocked' | 'isPatientMerged'
>): boolean {
  if (journey.isPatientMerged || journey.isLocked) return false;
  if (!CANCEL_CLINICAL_STATES.has(journey.clinicalState)) return false;
  if (
    journey.clinicalState === 'SentToOT'
    && journey.otState !== 'NotSent'
    && journey.otState !== 'SentToOT'
  ) {
    return false;
  }
  return true;
}

/** Admission cancel is allowed only from Expected, before irreversible clinical activity. */
export function canCancelAdmission(journey: Pick<
  PatientJourneyRowDto,
  'clinicalState' | 'isLocked' | 'isPatientMerged'
>): boolean {
  if (journey.isPatientMerged || journey.isLocked) return false;
  return journey.clinicalState === 'Expected';
}

export function journeyRowFromDetail(
  prev: PatientJourneyRowDto,
  detail: Partial<PatientJourneyRowDto> & { clinicalState: string },
): PatientJourneyRowDto {
  return {
    ...prev,
    ...detail,
    clinicalState: detail.clinicalState,
    otState: detail.otState ?? prev.otState,
    wardName: detail.wardName ?? prev.wardName,
    bedNumber: detail.bedNumber ?? prev.bedNumber,
    admittedAt: detail.admittedAt ?? prev.admittedAt,
    pendingRebook: detail.pendingRebook ?? prev.pendingRebook,
    surgeryCancelledAt: detail.surgeryCancelledAt ?? prev.surgeryCancelledAt,
    surgeryCancelReason: detail.surgeryCancelReason ?? prev.surgeryCancelReason,
    cancelledFromState: detail.cancelledFromState ?? prev.cancelledFromState,
  };
}
