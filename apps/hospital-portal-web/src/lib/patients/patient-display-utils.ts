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
  if (first) return first.toUpperCase();
  if (fallbackName?.trim()) return fallbackName.trim()[0]!.toUpperCase();
  return 'P';
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
