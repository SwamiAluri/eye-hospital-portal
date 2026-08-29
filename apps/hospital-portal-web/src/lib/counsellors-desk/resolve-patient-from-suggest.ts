import type { UnifiedPatientHit } from '@/lib/counsellors-desk/add-patient-to-waiting-list';

/** Normalize UHID/MRN for comparison (spaces/dashes ignored). */
export function normalizePatientIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-_/]/g, '');
}

export type ResolvePatientResult =
  | {
      ok: true;
      patient: UnifiedPatientHit;
      displayName: string;
      displayUhid: string;
    }
  | { ok: false; message: string };

function identifiersOf(hit: UnifiedPatientHit): string[] {
  const out: string[] = [];
  if (hit.mrn?.trim()) out.push(normalizePatientIdentifier(hit.mrn));
  if (hit.healthId?.trim()) out.push(normalizePatientIdentifier(hit.healthId));
  return out;
}

/**
 * Resolve MPI patient from suggest hits for Add Patient UHID lookup.
 * Prefers exact MRN/HealthId; falls back to a unique identifier prefix match.
 */
export function resolvePatientFromSuggestHits(
  hits: UnifiedPatientHit[],
  rawUhid: string,
): ResolvePatientResult {
  const key = normalizePatientIdentifier(rawUhid);
  if (key.length < 2) {
    return { ok: false, message: 'Enter at least 2 characters of the UHID/MRD.' };
  }

  if (!hits.length) {
    return {
      ok: false,
      message: 'No patient found for this UHID/MRD. Register the patient first.',
    };
  }

  const exact = hits.find((h) => identifiersOf(h).includes(key));
  const prefixOnly = hits.filter((h) =>
    identifiersOf(h).some((id) => id.startsWith(key) || key.startsWith(id)),
  );

  const chosen = exact ?? (prefixOnly.length === 1 ? prefixOnly[0] : undefined);
  if (!chosen) {
    return {
      ok: false,
      message:
        prefixOnly.length > 1
          ? 'Multiple patients match this UHID/MRD. Enter the full identifier.'
          : 'No patient found for this UHID/MRD. Register the patient first.',
    };
  }

  const displayName = `${chosen.firstName} ${chosen.lastName}`.trim();
  const displayUhid = (chosen.healthId && chosen.healthId.trim()) || chosen.mrn;
  return { ok: true, patient: chosen, displayName, displayUhid };
}
