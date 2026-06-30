import type { PatientOmniSearchHit } from '@/types/patient-omni-search';
import { patientHubUrl, patientProfileUrl } from '@/lib/patients/patient-routes';

/** Build Patient Hub URL from omnisearch hub_filter payload. */
export function buildPatientHubFilterUrl(hubFilter?: Record<string, string> | null): string {
  if (!hubFilter || Object.keys(hubFilter).length === 0) {
    return patientHubUrl();
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(hubFilter)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${patientHubUrl()}?${query}` : patientHubUrl();
}

/** Resolve navigation target for an omnisearch hit. */
export function resolveOmniSearchHitPath(hit: PatientOmniSearchHit): string {
  switch (hit.actionType) {
    case 'patient_profile':
      return patientProfileUrl(hit.patientId ?? hit.id);
    case 'hub_path':
      return hit.path ?? patientHubUrl();
    case 'hub_filter':
      return buildPatientHubFilterUrl(hit.hubFilter);
    default:
      return patientHubUrl();
  }
}

export function mapOmniSearchApiHit(raw: {
  id: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  actionType: string;
  patientId?: string | null;
  hubFilter?: Record<string, string> | null;
  path?: string | null;
}): PatientOmniSearchHit {
  const actionType =
    raw.actionType === 'patient_profile' ||
    raw.actionType === 'hub_filter' ||
    raw.actionType === 'hub_path'
      ? raw.actionType
      : 'hub_filter';

  return {
    id: raw.id,
    title: raw.title,
    subtitle: raw.subtitle,
    meta: raw.meta,
    actionType,
    patientId: raw.patientId,
    hubFilter: raw.hubFilter,
    path: raw.path,
  };
}
