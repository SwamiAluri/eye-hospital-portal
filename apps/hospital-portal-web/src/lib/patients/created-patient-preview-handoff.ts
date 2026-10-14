/**
 * Post-registration Directory handoff — open existing Preview by patient.id
 * without clearing search/filter context. Uses existing summary contract when
 * the created patient is outside the current filtered lookup page.
 */

import type { PatientLookupRow, PatientSummary } from '@/types/patient-lookup';

/** Map existing summary DTO → lookup-row shape required by Preview hosts. */
export function patientLookupRowFromSummary(summary: PatientSummary): PatientLookupRow {
  return {
    id: summary.id,
    firstName: summary.firstName,
    lastName: summary.lastName,
    mrn: summary.mrn,
    dateOfBirth: summary.dateOfBirth,
    gender: summary.gender,
    phone: summary.phone,
    email: summary.email,
    photoThumbnailUrl: summary.photoThumbnailUrl,
    isFavorite: false,
    lastVisitAt: null,
    careProgramCodes: summary.careProgramCodes ?? [],
    reasonForVisit: summary.reasonForVisit,
    scheduledAt: summary.scheduledAt,
    clinicalAcuity: summary.clinicalAcuity ?? 'routine',
    queuePriority: null,
    activeEngagements: summary.activeEngagements ?? [],
    assignedProviderName: summary.assignedProviderName,
    assignedProviderRole: summary.assignedProviderRole,
    primaryOpenVisitId: summary.assignedVisitId ?? null,
    waitingMinutes: null,
    currentStation: summary.currentStation,
    roomNumber: null,
    ipAdmission: summary.ipAdmission ?? null,
  };
}

/**
 * Prefer the row already on the current page; otherwise use summary-backed stub.
 * Never invent identity — createdPatientId must match the chosen row.
 */
export function resolveCreatedPatientPreviewRow(args: {
  createdPatientId: string;
  rows: PatientLookupRow[];
  summary: PatientSummary | null | undefined;
}): PatientLookupRow | null {
  const id = args.createdPatientId.trim();
  if (!id) return null;

  const fromList = args.rows.find((row) => row.id === id);
  if (fromList) return fromList;

  if (args.summary?.id === id) {
    return patientLookupRowFromSummary(args.summary);
  }

  return null;
}
