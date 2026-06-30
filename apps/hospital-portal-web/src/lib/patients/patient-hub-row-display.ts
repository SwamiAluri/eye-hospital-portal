import { calcPatientAge } from '@/lib/patients/patient-display-utils';
import type { PatientDisambiguationInput } from '@/lib/patients/patient-disambiguation';
import type { PatientActiveEngagement } from '@/types/patient-lookup';

/** Compact identity line: MRN · age · gender */
export function formatPatientHubIdentityLine(patient: PatientDisambiguationInput): string {
  const parts: string[] = [];
  const mrn = patient.mrn?.trim();
  if (mrn) parts.push(mrn);

  const age = calcPatientAge(patient.dateOfBirth);
  if (age != null) parts.push(`${age}Y`);

  const gender = patient.gender?.trim();
  if (gender) parts.push(gender);

  return parts.join(' · ');
}

export function formatHubSchedule(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const VISIT_TYPE_PRIORITY = [
  'ip',
  'queue',
  'opd',
  'counselling',
  'insurance',
  'ccms',
  'billing',
  'camp',
] as const;

export function pickPrimaryVisitEngagement(
  engagements: PatientActiveEngagement[],
): PatientActiveEngagement | null {
  if (!engagements?.length) return null;
  for (const type of VISIT_TYPE_PRIORITY) {
    const match = engagements.find((e) => e.type.toLowerCase() === type);
    if (match) return match;
  }
  return engagements[0];
}

export const HUB_ENGAGEMENT_STYLES: Record<string, string> = {
  opd: 'bg-blue-50 text-blue-800 ring-blue-100',
  queue: 'bg-violet-50 text-violet-800 ring-violet-100',
  ip: 'bg-indigo-50 text-indigo-800 ring-indigo-100',
  counselling: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  insurance: 'bg-cyan-50 text-cyan-800 ring-cyan-100',
  ccms: 'bg-sky-50 text-sky-900 ring-sky-100',
  billing: 'bg-amber-50 text-amber-800 ring-amber-100',
  camp: 'bg-teal-50 text-teal-800 ring-teal-100',
};

export const HUB_PROGRAM_STYLES: Record<string, string> = {
  CATARACT: 'bg-violet-50 text-violet-900 ring-violet-100',
  GLAUCOMA: 'bg-indigo-50 text-indigo-900 ring-indigo-100',
  RETINA: 'bg-sky-50 text-sky-900 ring-sky-100',
  CORNEA: 'bg-cyan-50 text-cyan-900 ring-cyan-100',
  REFRACTIVE: 'bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-100',
};
