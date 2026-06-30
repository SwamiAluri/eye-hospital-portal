import { calcPatientAge, formatPatientDob } from '@/lib/patients/patient-display-utils';

export interface PatientDisambiguationInput {
  firstName?: string | null;
  lastName?: string | null;
  mrn?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Primary line: full patient name. */
export function formatPatientLookupName(patient: PatientDisambiguationInput): string {
  const name = `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim();
  return name || 'Unknown patient';
}

/**
 * Disambiguation subtitle for autosuggest + table rows (locked PHI: full MRN + phone).
 * Format: MRN {full} • {age}Y • {gender} • DOB {dd MMM yyyy} • {phone}
 */
export function formatPatientLookupSubtitle(
  patient: PatientDisambiguationInput,
  options?: { includePhone?: boolean; includeEmail?: boolean },
): string {
  const includePhone = options?.includePhone !== false;
  const includeEmail = options?.includeEmail ?? false;

  const parts: string[] = [];
  const mrn = patient.mrn?.trim();
  if (mrn) parts.push(`MRN ${mrn}`);

  const age = calcPatientAge(patient.dateOfBirth);
  if (age != null) parts.push(`${age}Y`);

  const gender = patient.gender?.trim();
  if (gender) parts.push(gender);

  const dob = formatPatientDob(patient.dateOfBirth);
  if (dob) parts.push(`DOB ${dob}`);

  if (includePhone && patient.phone?.trim()) {
    parts.push(patient.phone.trim());
  }

  if (includeEmail && patient.email?.trim()) {
    parts.push(patient.email.trim());
  }

  return parts.join(' • ');
}

/** Compact subtitle for dense table cells (MRN • age • gender • DOB). */
export function formatPatientLookupTableSubline(patient: PatientDisambiguationInput): string {
  return formatPatientLookupSubtitle(patient, { includePhone: false });
}
