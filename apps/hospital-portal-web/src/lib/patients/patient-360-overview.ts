import { formatCareProgramLabel } from '@/lib/patients/patient-display-utils';
import { patientEncounterUrl } from '@/lib/patients/patient-routes';
import type { PatientRecentVisit, PatientSummary } from '@/types/patient-lookup';

export interface OverviewEngagement {
  label: string;
  status: string | null;
}

export interface OverviewVisitRow {
  id: string;
  date: string | null;
  visit: string;
  stationReason: string | null;
  status: string;
  encounterHref: string | null;
}

export interface OverviewMeasure {
  label: string;
  value: string;
}

export interface Patient360OverviewModel {
  now: {
    scheduledAt: string | null;
    programs: string[];
    engagements: OverviewEngagement[];
  };
  showNow: boolean;
  context: {
    reason: string | null;
    station: string | null;
    provider: string | null;
    programs: string[];
    engagements: OverviewEngagement[];
    ip: string | null;
    dataQuality: string[];
  };
  recentActivity: OverviewVisitRow[];
  recentActivityEmpty: boolean;
  visits: OverviewVisitRow[];
  visitsEmpty: boolean;
  scheduledAt: string | null;
  clinical: {
    opdVitals: OverviewMeasure[];
    opdStale: boolean;
    draftExam: OverviewMeasure[];
    registrationAllergyText: string | null;
  };
  hasClinicalFlags: boolean;
  encounterHref: string | null;
  showNextStep: false;
  showDataQuality: false;
  /** Diagnosis stores are not both on this page load. The block stays omitted. */
  diagnosisIncluded: false;
}

const RECENT_ACTIVITY_LIMIT = 3;

function displayWhen(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  return value;
}

function text(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function visitRow(visit: PatientRecentVisit, summary: PatientSummary): OverviewVisitRow {
  return {
    id: visit.id,
    date: displayWhen(visit.checkedInAt),
    visit: text(visit.visitType) ?? 'Visit',
    stationReason: text(visit.currentStation),
    status: visit.status,
    encounterHref:
      summary.assignedVisitId && visit.id === summary.assignedVisitId
        ? patientEncounterUrl(summary.id, visit.id)
        : null,
  };
}

function opdVitals(summary: PatientSummary): OverviewMeasure[] {
  const vitals = summary.latestVitals;
  if (!vitals) return [];
  const rows: OverviewMeasure[] = [];
  if (vitals.bloodPressureSystolic != null && vitals.bloodPressureDiastolic != null) {
    rows.push({
      label: 'Blood pressure',
      value: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`,
    });
  }
  if (vitals.heartRate != null) rows.push({ label: 'Heart rate', value: String(vitals.heartRate) });
  if (vitals.temperature != null) rows.push({ label: 'Temperature', value: String(vitals.temperature) });
  if (vitals.oxygenSaturation != null) {
    rows.push({ label: 'Oxygen saturation', value: `${vitals.oxygenSaturation}%` });
  }
  if (vitals.weightKg != null) rows.push({ label: 'Weight', value: `${vitals.weightKg} kg` });
  if (vitals.heightCm != null) rows.push({ label: 'Height', value: `${vitals.heightCm} cm` });
  return rows;
}

function draftExam(summary: PatientSummary): OverviewMeasure[] {
  const vitals = summary.latestVitals;
  if (!vitals) return [];
  const rows: OverviewMeasure[] = [];
  if (text(vitals.visualAcuityOd)) rows.push({ label: 'Visual acuity OD', value: vitals.visualAcuityOd!.trim() });
  if (text(vitals.visualAcuityOs)) rows.push({ label: 'Visual acuity OS', value: vitals.visualAcuityOs!.trim() });
  if (vitals.iopOd != null) rows.push({ label: 'IOP OD', value: String(vitals.iopOd) });
  if (vitals.iopOs != null) rows.push({ label: 'IOP OS', value: String(vitals.iopOs) });
  return rows;
}

export function classifyRecentActivityFailure(error: unknown): 'unauthorized' | 'unavailable' {
  const status =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

export function recentActivityMessage(state: 'empty' | 'unauthorized' | 'unavailable'): string {
  if (state === 'empty') return 'No visits recorded.';
  if (state === 'unauthorized') return 'Recent activity is not available to this sign-in.';
  return 'Recent activity is not available in Patient 360.';
}

export function buildPatient360Overview(
  summary: PatientSummary,
  recentVisits: PatientRecentVisit[],
): Patient360OverviewModel {
  const visitRows = recentVisits.map((visit) => visitRow(visit, summary));
  const provider = [text(summary.assignedProviderName), text(summary.assignedProviderRole)].filter(Boolean).join(' · ');
  const admission = summary.ipAdmission?.isAdmitted
    ? ['Admitted', text(summary.ipAdmission.wardName), text(summary.ipAdmission.clinicalState), text(summary.ipAdmission.procedureName)]
        .filter(Boolean)
        .join(' · ')
    : null;
  const programs = summary.careProgramCodes.map(formatCareProgramLabel);
  const scheduledAt = displayWhen(summary.scheduledAt);
  const clinical = {
    opdVitals: opdVitals(summary),
    opdStale: summary.latestVitals?.isStale === true && opdVitals(summary).length > 0,
    draftExam: draftExam(summary),
    registrationAllergyText: text(summary.allergies),
  };

  return {
    now: {
      scheduledAt,
      programs,
      engagements: [],
    },
    showNow: Boolean(scheduledAt || programs.length > 0),
    context: {
      reason: text(summary.reasonForVisit),
      station: text(summary.currentStation),
      provider: provider || null,
      programs,
      engagements: summary.activeEngagements.map((engagement) => ({
        label: engagement.label,
        status: text(engagement.status),
      })),
      ip: admission || null,
      dataQuality: summary.dataQuality?.issues ?? [],
    },
    recentActivity: visitRows.slice(0, RECENT_ACTIVITY_LIMIT),
    recentActivityEmpty: visitRows.length === 0,
    visits: visitRows,
    visitsEmpty: visitRows.length === 0,
    scheduledAt,
    clinical,
    hasClinicalFlags:
      clinical.opdVitals.length > 0 || clinical.draftExam.length > 0 || Boolean(clinical.registrationAllergyText),
    encounterHref: summary.assignedVisitId ? patientEncounterUrl(summary.id, summary.assignedVisitId) : null,
    showNextStep: false,
    showDataQuality: false,
    diagnosisIncluded: false,
  };
}
