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

/** Queue statuses that block creating another counselling session for the same patient. */
export const ACTIVE_WAITING_LIST_STATUSES = [
  'Pending',
  'Processed',
  'AddOnSurgery',
  'Done',
  'RepeatCounselling',
] as const;

/** SurgeryDone is historical — a new episode may be created (PD-C). */
export const HISTORICAL_WAITING_LIST_STATUSES = ['SurgeryDone'] as const;

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

/** True when a reusable counsellor-queue row already exists for this patient identifier. */
export function findActiveWaitingListDuplicate(args: {
  uhid: string;
  patientDisplayName: string;
  rows: Array<{ id?: string; uhid: string; patientName: string; status: string }>;
}): { id?: string; uhid: string; patientName: string; status: string } | undefined {
  const key = args.uhid.trim().toLowerCase();
  const nameKey = args.patientDisplayName.trim().toLowerCase();
  return args.rows.find((r) => {
    if ((HISTORICAL_WAITING_LIST_STATUSES as readonly string[]).includes(r.status)) return false;
    if (!(ACTIVE_WAITING_LIST_STATUSES as readonly string[]).includes(r.status)) return false;
    const rowUhid = (r.uhid ?? '').trim().toLowerCase();
    if (rowUhid && rowUhid === key) return true;
    return nameKey.length > 0 && (r.patientName ?? '').trim().toLowerCase() === nameKey && rowUhid === key;
  });
}

/** Concise Add Patient block copy (PD-C). Kept for callers that still surface a sentence. */
export function waitingListDuplicateCreateMessage(dup: {
  patientName: string;
  status: string;
}): string {
  return buildScheduleCounsellingDecision(dup).body;
}

export type ScheduleCounsellingDecisionAction = 're-evaluate' | 'continue' | 'open';

export interface ScheduleCounsellingDecision {
  action: ScheduleCounsellingDecisionAction;
  title: string;
  body: string;
  primaryLabel: string;
  patientName: string;
  uhid: string;
  /** Raw waiting-list status used to find the existing row. */
  status: string;
  statusLabel: string;
  sessionId?: string;
}

const SCHEDULE_COUNSELLING_BLOCKED = 'ScheduleCounsellingBlocked';

export class ScheduleCounsellingBlockedError extends Error {
  readonly code = SCHEDULE_COUNSELLING_BLOCKED;
  readonly decision: ScheduleCounsellingDecision;

  constructor(decision: ScheduleCounsellingDecision) {
    super(decision.title);
    this.name = 'ScheduleCounsellingBlockedError';
    this.decision = decision;
  }
}

export function isScheduleCounsellingBlocked(
  err: unknown,
): err is ScheduleCounsellingBlockedError {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as { code?: string }).code === SCHEDULE_COUNSELLING_BLOCKED &&
    'decision' in err
  );
}

function plainStatusLabel(status: string): string {
  switch (status) {
    case 'RepeatCounselling':
      return 'Repeat counselling';
    case 'Processed':
      return 'Processing';
    case 'AddOnSurgery':
      return 'Add-on surgery';
    default:
      return status || 'On the waiting list';
  }
}

/** In-dialog decision for a waiting-list row that already owns this patient. */
export function buildScheduleCounsellingDecision(dup: {
  patientName: string;
  status: string;
  uhid?: string;
  sessionId?: string;
}): ScheduleCounsellingDecision {
  const patientName = dup.patientName?.trim() || 'This patient';
  const uhid = dup.uhid?.trim() ?? '';
  const status = dup.status;
  const shared = {
    patientName,
    uhid,
    status,
    statusLabel: plainStatusLabel(status),
    sessionId: dup.sessionId,
  };

  if (status === 'Done') {
    return {
      ...shared,
      action: 're-evaluate',
      title: 'Counselling already completed',
      primaryLabel: 'Re-evaluate session',
      body: `${patientName}'s counselling is finished, and surgery is not marked done. Re-evaluate that session.`,
    };
  }

  if (status === 'RepeatCounselling') {
    return {
      ...shared,
      action: 'continue',
      title: 'Session already open',
      primaryLabel: 'Continue session',
      body: `${patientName} already has an open counselling session. Continue that session.`,
    };
  }

  return {
    ...shared,
    action: 'open',
    title: 'Already on the waiting list',
    primaryLabel: 'Open existing row',
    body: `${patientName} is already on the waiting list. Open that row instead of scheduling a new session.`,
  };
}

/**
 * Map the create-session reuse sentences onto the same dialog decisions.
 * Unknown messages stay null so callers can keep their existing error toast.
 */
export function decisionFromScheduleCounsellingServerMessage(
  message: string,
  ctx: { patientName: string; uhid?: string; sessionId?: string },
): ScheduleCounsellingDecision | null {
  const text = message.trim();
  if (!text) return null;
  if (/existing counselling is completed but surgery is not done/i.test(text)) {
    return buildScheduleCounsellingDecision({ ...ctx, status: 'Done' });
  }
  if (/already has an open counselling episode/i.test(text)) {
    return buildScheduleCounsellingDecision({ ...ctx, status: 'RepeatCounselling' });
  }
  if (/already has an active counselling session/i.test(text)) {
    return buildScheduleCounsellingDecision({ ...ctx, status: 'Processed' });
  }
  return null;
}

export interface CreateCounsellingSessionFromWaitingListInput {
  patientId: string;
  branchId?: string;
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
    ...(input.branchId?.trim() ? { branchId: input.branchId.trim() } : {}),
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
