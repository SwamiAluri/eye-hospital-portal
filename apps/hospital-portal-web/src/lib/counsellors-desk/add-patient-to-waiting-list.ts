/**
 * Counsellor Waiting List — Add Patient (Option 1).
 * Resolve existing MPI patient → POST /Counseling/sessions with AddToQueue.
 */

import { sessionTypeCodeToDb } from '@/lib/counsellors-desk/counsellor-master-maps';

export interface UnifiedPatientHit {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  /** UHID / Health ID when present — Waiting List prefers this over MRN. */
  healthId?: string | null;
}

export type PatientMatchResult =
  | { ok: true; patient: UnifiedPatientHit }
  | { ok: false; message: string };

/** Queue statuses that mean the patient is already actively on the counsellor waiting list. */
export const ACTIVE_WAITING_LIST_STATUSES = [
  'Pending',
  'Processed',
  'AddOnSurgery',
] as const;

function displayName(p: UnifiedPatientHit): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** Prefer HealthId/UHID for waiting-list display; fall back to MRN. */
export function displayIdentifierForWaitingList(p: UnifiedPatientHit): string {
  const health = p.healthId?.trim();
  if (health) return health;
  return (p.mrn ?? '').trim();
}

/**
 * Counselling Add Patient — identity must come from MPI select or registration,
 * not free-typed UHID/name alone.
 */
export function requireSelectedMpiPatient(
  patient: UnifiedPatientHit | null | undefined,
): PatientMatchResult {
  if (!patient?.id?.trim()) {
    return {
      ok: false,
      message: 'Select or register a patient before adding to the waiting list.',
    };
  }
  return { ok: true, patient };
}

function namesCompatible(entered: string, resolved: string): boolean {
  const a = entered.trim().toLowerCase().replace(/\s+/g, ' ');
  const b = resolved.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

function identifierMatches(hit: UnifiedPatientHit, key: string): boolean {
  const needle = key.trim().toLowerCase().replace(/[\s\-_/]/g, '');
  const ids = [hit.mrn, hit.healthId]
    .filter((v): v is string => !!v && !!v.trim())
    .map((v) => v.trim().toLowerCase().replace(/[\s\-_/]/g, ''));
  return ids.includes(needle);
}

/** Exact UHID/MRN/HealthId match against unified search hits; name must agree with MPI. */
export function matchPatientForAddWaitingList(
  hits: UnifiedPatientHit[],
  uhid: string,
  enteredName: string,
): PatientMatchResult {
  const key = uhid.trim().toLowerCase();
  if (!key) {
    return { ok: false, message: 'UHID / MRD is required.' };
  }

  const exact = hits.filter((h) => identifierMatches(h, key));
  if (exact.length === 0) {
    return {
      ok: false,
      message:
        'No patient found for this UHID/MRD. Register the patient first, then add to the waiting list.',
    };
  }

  const patient = exact[0];
  const resolved = displayName(patient);
  if (!namesCompatible(enteredName, resolved)) {
    return {
      ok: false,
      message: `UHID matches "${resolved}" but the entered name does not match. Correct the name or UHID.`,
    };
  }

  return { ok: true, patient };
}

/** True when an open counsellor-queue row already exists for this patient identifier. */
export function findActiveWaitingListDuplicate(args: {
  uhid: string;
  patientDisplayName: string;
  rows: Array<{ uhid: string; patientName: string; status: string }>;
}): { uhid: string; patientName: string; status: string } | undefined {
  const key = args.uhid.trim().toLowerCase();
  const nameKey = args.patientDisplayName.trim().toLowerCase();
  return args.rows.find((r) => {
    if (!(ACTIVE_WAITING_LIST_STATUSES as readonly string[]).includes(r.status)) return false;
    const rowUhid = (r.uhid ?? '').trim().toLowerCase();
    if (rowUhid && rowUhid === key) return true;
    return nameKey.length > 0 && (r.patientName ?? '').trim().toLowerCase() === nameKey && rowUhid === key;
  });
}

export interface CreateCounsellingSessionFromWaitingListInput {
  patientId: string;
  branchId: string;
  doctorId: string;
  sessionTypeCode: string;
  surgeryType: 'Procedure' | 'Surgery';
  surgeryName: string;
  eye: string;
  remarks: string;
}

/** Body for POST /Counseling/sessions (camelCase JSON). */
export function buildCreateCounsellingSessionPayload(
  input: CreateCounsellingSessionFromWaitingListInput,
) {
  const surgeryName = input.surgeryName.trim();
  const remarks = input.remarks.trim();
  return {
    patientId: input.patientId,
    branchId: input.branchId,
    referredByDoctorId: input.doctorId,
    sessionType: sessionTypeCodeToDb(input.sessionTypeCode),
    /** Walk-in add has no coverage capture yet — counsellor sets payment type in session. */
    patientType: 'Cash',
    addToQueue: true,
    recommendedSurgery: surgeryName || undefined,
    sessionCategory: input.surgeryType,
    surgeryTentativeEye: input.eye || undefined,
    additionalNotes: remarks || undefined,
  };
}
