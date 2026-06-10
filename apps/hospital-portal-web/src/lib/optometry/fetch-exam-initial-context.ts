import { patientApi, type Patient } from '@/lib/api/patients.api';
import { patientHistoryApi, type PatientHistory } from '@/lib/api/medical-records.api';
import { patientAllergiesApi, type PatientAllergy } from '@/lib/api/patient-allergies.api';
import { optometrySegmentApi, type OptometrySegmentExamDto } from '@/lib/api/optometry-segment.api';
import { visitsApi } from '@/lib/api/visits.api';
import { historyQueryForExamVisit } from './optometry-history-query';
import { fetchOptometryPatientHistory, fetchPriorVisitSnapshot } from './optometry-prior-visit';
import { fetchRemoteExamDraft } from './optometry-exam-draft';
import type { OptometryExamDraftData, PriorVisitSnapshot } from './optometry-exam-types';
import type { OptometryVisitExamRecord } from './optometry-history.types';

export interface ExamInitialContext {
  segments: OptometrySegmentExamDto[];
  patient: Patient | null;
  patientHistory: PatientHistory | null;
  patientAllergies: PatientAllergy[];
  optometryHistory: OptometryVisitExamRecord[];
  priorVisit: PriorVisitSnapshot | null;
  draft: OptometryExamDraftData | null;
  visitDateIso: string | null;
}

function resolveVisitDateIso(visit: {
  checkedInAt?: string | null;
  createdAt?: string;
  appointment?: { appointmentDate?: string | null };
}): string | null {
  const appointmentDate = visit.appointment?.appointmentDate;
  return (
    visit.checkedInAt ??
    visit.createdAt ??
    (appointmentDate ? `${appointmentDate}T12:00:00` : null)
  );
}

/** Batch fetch everything needed before rendering exam tabs (Phase 3). */
export async function fetchExamInitialContext(
  patientId: string,
  visitId: string,
): Promise<ExamInitialContext> {
  const visit = visitId ? await visitsApi.getVisit(visitId).catch(() => null) : null;
  const visitDateIso = visit ? resolveVisitDateIso(visit) : null;

  const [
    segments,
    patientRes,
    patientHistory,
    allergiesRes,
    optometryHistory,
    priorVisit,
    draft,
  ] = await Promise.all([
    visitId
      ? optometrySegmentApi.listByVisit(visitId).catch(() => [] as OptometrySegmentExamDto[])
      : Promise.resolve([] as OptometrySegmentExamDto[]),
    patientId
      ? patientApi.getById(patientId).then((r) => r.data ?? null).catch(() => null)
      : Promise.resolve(null),
    patientId
      ? patientHistoryApi.get(patientId).catch(() => null)
      : Promise.resolve(null),
    patientId
      ? patientAllergiesApi.getByPatient(patientId).then((r) => r.data ?? []).catch(() => [])
      : Promise.resolve([]),
    patientId
      ? fetchOptometryPatientHistory(
          patientId,
          historyQueryForExamVisit(visitId || undefined, 10, visitDateIso ?? undefined),
        )
      : Promise.resolve([]),
    patientId
      ? fetchPriorVisitSnapshot(patientId, visitId || undefined)
      : Promise.resolve(null),
    patientId && visitId
      ? fetchRemoteExamDraft(patientId, visitId)
      : Promise.resolve(null),
  ]);

  return {
    segments,
    patient: patientRes,
    patientHistory,
    patientAllergies: allergiesRes,
    optometryHistory,
    priorVisit,
    draft,
    visitDateIso,
  };
}
