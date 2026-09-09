import type { Patient } from '@/lib/api/patients.api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/** API origin without `/api` suffix — for relative asset paths. */
export function getApiOrigin(): string {
  return API_BASE.replace(/\/api\/?$/, '');
}

export function resolvePatientMrn(
  patient?: Pick<Patient, 'patientCode' | 'medicalRecordNumber'> | null,
  fallbackMrn?: string | null,
): string | null {
  const mrn =
    patient?.patientCode?.trim() ||
    patient?.medicalRecordNumber?.trim() ||
    fallbackMrn?.trim();
  return mrn || null;
}

/**
 * Safe patient display name — never stringifies `undefined`/`null`.
 * Prefer first+last, then fallback, then neutral "Patient".
 */
export function formatPatientDisplayName(
  patient?: Pick<Patient, 'firstName' | 'lastName'> | null,
  fallbackName?: string | null,
): string {
  const fromParts = [patient?.firstName, patient?.lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ');

  const fallback = typeof fallbackName === 'string' ? fallbackName.trim() : '';
  const fallbackWordCount = fallback ? fallback.split(/\s+/).filter(Boolean).length : 0;
  const partsWordCount = fromParts ? fromParts.split(/\s+/).filter(Boolean).length : 0;

  // Prefer authoritative multi-word display name when API only returned a single part.
  if (fromParts && !(partsWordCount < 2 && fallbackWordCount >= 2)) {
    return fromParts;
  }
  if (fallback) return fallback;
  if (fromParts) return fromParts;

  return 'Patient';
}

/**
 * Normalize patientApi.getById / mock responses to a Patient or null.
 * Accepts both Axios `{ data: Patient }` and an already-unwrapped Patient.
 */
export function unwrapPatientApiResponse(
  response: unknown,
): Patient | null {
  if (!response || typeof response !== 'object') return null;

  const maybeWrapped = response as { data?: unknown };
  const candidate =
    maybeWrapped.data !== undefined ? maybeWrapped.data : response;

  if (!candidate || typeof candidate !== 'object') return null;

  const record = candidate as Record<string, unknown>;
  // Require an id so empty `{}` / non-patient objects are rejected.
  if (typeof record.id !== 'string' || !record.id.trim()) return null;

  return candidate as Patient;
}

/** Absolute URL for patient photos (handles relative paths from API). */
export function resolvePatientPhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl?.trim()) return null;
  const trimmed = photoUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${getApiOrigin()}${trimmed}`;
  }
  return `${getApiOrigin()}/${trimmed}`;
}

export function getPatientInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallbackName?: string | null,
): string {
  const first = firstName?.trim()?.[0];
  const last = lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();

  const displayParts =
    fallbackName
      ?.trim()
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean) ?? [];

  if (first && displayParts.length >= 2) {
    const lastFromDisplay = displayParts[displayParts.length - 1]?.[0];
    if (lastFromDisplay) return `${first}${lastFromDisplay}`.toUpperCase();
  }

  if (first) return first.toUpperCase();

  if (displayParts.length >= 2) {
    const a = displayParts[0]?.[0];
    const b = displayParts[displayParts.length - 1]?.[0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }

  if (displayParts[0]?.[0]) return displayParts[0][0]!.toUpperCase();
  return 'P';
}

/** Human-readable sex/gender for clinical display (never raw lowercase codes). */
export function formatPatientSex(sex?: string | null): string | null {
  const raw = sex?.trim();
  if (!raw) return null;

  const key = raw.toLowerCase();
  const known: Record<string, string> = {
    m: 'Male',
    male: 'Male',
    f: 'Female',
    female: 'Female',
    o: 'Other',
    other: 'Other',
    u: 'Unknown',
    unknown: 'Unknown',
  };
  if (known[key]) return known[key];

  return raw
    .split(/([\s-_]+)/)
    .map((token) => {
      if (/^[\s-_]+$/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join('');
}

export function formatPatientDob(
  dateOfBirth?: string | null,
  locale = undefined as string | undefined,
): string | null {
  if (!dateOfBirth) return null;
  try {
    return new Date(dateOfBirth).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export function resolvePatientPhone(patient?: Pick<Patient, 'contactNumber' | 'phone'> | null): string | null {
  const phone = patient?.contactNumber?.trim() || patient?.phone?.trim();
  return phone || null;
}

/** Whole-year age from ISO date of birth. */
export function calcPatientAge(dateOfBirth?: string | null, asOf = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDelta = asOf.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

const CARE_PROGRAM_LABELS: Record<string, string> = {
  CATARACT: 'Cataract',
  GLAUCOMA: 'Glaucoma',
  RETINA: 'Retina',
  REFRACTIVE: 'LASIK',
};

export function formatCareProgramLabel(code: string): string {
  return CARE_PROGRAM_LABELS[code.toUpperCase()] ?? code;
}
