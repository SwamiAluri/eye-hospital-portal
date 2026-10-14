/**
 * Patient Directory handoffs into the modules that already own the work.
 * Navigation only: no visit creation, no counselling session creation, no CounselorId assignment.
 */

export const FRONT_DESK_CHECK_IN_PATH = '/dashboard/frontdesk/check-in';
export const COUNSELLOR_WAITING_LIST_PATH = '/dashboard/counsellors-desk/waiting-list';

const CHECK_IN_PATIENT_PARAM = 'patientId';
const COUNSELLOR_PATIENT_PARAM = 'patientId';

export function buildFrontDeskCheckInHref(patientId: string): string {
  const id = patientId.trim();
  const params = new URLSearchParams();
  if (id) params.set(CHECK_IN_PATIENT_PARAM, id);
  const query = params.toString();
  return query ? `${FRONT_DESK_CHECK_IN_PATH}?${query}` : FRONT_DESK_CHECK_IN_PATH;
}

/** Canonical query used by directory, record toolbar, preview, and billing. */
export function readCheckInPatientId(
  params: { get: (key: string) => string | null } | null | undefined,
): string | null {
  const raw = params?.get(CHECK_IN_PATIENT_PARAM)?.trim() ?? '';
  return raw || null;
}

/**
 * Empty search must not clear a patient that was loaded from the check-in link.
 * Typed search still uses the existing search path.
 */
export function shouldClearCheckInSelection(searchTerm: string, linkedPatientId: string | null): boolean {
  return searchTerm.trim().length === 0 && !linkedPatientId;
}

export function buildCounsellorHandoffHref(patientId: string): string {
  const id = patientId.trim();
  const params = new URLSearchParams();
  if (id) params.set(COUNSELLOR_PATIENT_PARAM, id);
  const query = params.toString();
  return query ? `${COUNSELLOR_WAITING_LIST_PATH}?${query}` : COUNSELLOR_WAITING_LIST_PATH;
}

export function readCounsellorHandoffPatientId(
  params: { get: (key: string) => string | null } | null | undefined,
): string | null {
  const raw = params?.get(COUNSELLOR_PATIENT_PARAM)?.trim() ?? '';
  return raw || null;
}

export interface CounsellorHandoffSession {
  id?: string | null;
  patientId?: string | null;
}

export type CounsellorHandoffResolution =
  | { kind: 'session'; sessionId: string; href: string }
  | { kind: 'list'; href: string };

/**
 * Open an existing session only when exactly one session belongs to this patient.
 * Zero or several sessions stay on the waiting list. The session URL is view-only:
 * no lifecycle, no counselorId.
 */
export function resolveCounsellorSessionHandoff(
  patientId: string,
  sessions: CounsellorHandoffSession[],
): CounsellorHandoffResolution {
  const id = patientId.trim();
  const listHref = buildCounsellorHandoffHref(id);
  if (!id) return { kind: 'list', href: COUNSELLOR_WAITING_LIST_PATH };

  const sessionIds = new Set<string>();
  for (const session of sessions) {
    const sessionId = session.id?.trim() ?? '';
    if (!sessionId) continue;
    const owner = session.patientId?.trim() ?? '';
    if (owner && owner !== id) continue;
    sessionIds.add(sessionId);
  }

  if (sessionIds.size !== 1) return { kind: 'list', href: listHref };

  const sessionId = [...sessionIds][0]!;
  const params = new URLSearchParams({ from: 'waiting-list' });
  return {
    kind: 'session',
    sessionId,
    href: `/dashboard/counsellors-desk/${sessionId}?${params.toString()}`,
  };
}

export async function loadCounsellorHandoffHref(
  patientId: string,
  getSessions: (patientId: string) => Promise<CounsellorHandoffSession[]>,
): Promise<string | null> {
  const sessions = await getSessions(patientId);
  const target = resolveCounsellorSessionHandoff(patientId, sessions);
  return target.kind === 'session' ? target.href : null;
}
