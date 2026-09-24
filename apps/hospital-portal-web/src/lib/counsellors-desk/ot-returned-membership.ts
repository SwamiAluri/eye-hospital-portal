/**
 * OT Returned operational membership (Counsellor Waiting List projection).
 *
 * OT Returned = unresolved counselling attention related to an OT return.
 * Historical PatientJourney.otReturnReason is never cleared here.
 *
 * Authoritative lifecycle:
 * - Prefer Waiting List row status when matched by patientId
 * - Else deriveWaitingListStatus from patient sessions (status + patientAgreedToSurgery)
 * - Action via resolveWaitingListLifecycleAction (shared with Pending/Processing/Done/Repeat)
 *
 * OT membership excludes Done (resolved counselling). Done remains on the normal
 * Waiting List with Re-evaluate; OT Returned must not keep stale Done rows.
 */

import type { WaitingListStatus } from '@/types/counsellors-desk';
import {
  deriveWaitingListStatus,
  isOtReturnedActionableStatus,
  otReturnedLifecyclePriority,
} from './waiting-list-status';

export type OtReturnedSessionLite = {
  id: string;
  status: string;
  patientAgreedToSurgery?: boolean | null;
  additionalNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  counselorId?: string | null;
  counselorName?: string | null;
  patientType?: string | null;
  version?: number | null;
  queueStatus?: string | null;
};

export type OtReturnedMembershipInput = {
  otReturnReason: string | null | undefined;
  counselingSessionId: string | null | undefined;
  sessions: OtReturnedSessionLite[];
  /** Authoritative WL status when patient already appears on Waiting List. */
  waitingListStatus?: WaitingListStatus | null;
  waitingListSessionId?: string | null;
  waitingListCounselorId?: string | null;
  waitingListCounselorName?: string | null;
  waitingListPatientType?: string | null;
  waitingListVersion?: number | null;
};

export type OtReturnedMembership =
  | { include: false }
  | {
      include: true;
      effectiveSessionId: string | null;
      lifecycleStatus: WaitingListStatus | null;
      counselorId: string | null;
      counselorName: string | null;
      patientType: string | null;
      version: number | null;
      needsSessionCreate: boolean;
    };

function sortNewestFirst(a: OtReturnedSessionLite, b: OtReturnedSessionLite): number {
  const at = a.updatedAt
    ? Date.parse(a.updatedAt)
    : a.createdAt
      ? Date.parse(a.createdAt)
      : 0;
  const bt = b.updatedAt
    ? Date.parse(b.updatedAt)
    : b.createdAt
      ? Date.parse(b.createdAt)
      : 0;
  return bt - at;
}

function isCancelledSession(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return s === 'cancelled' || s === 'noshow' || s === 'no-show' || s === 'no_show';
}

type RankedSession = {
  session: OtReturnedSessionLite;
  lifecycleStatus: WaitingListStatus;
};

/**
 * Among all patient sessions, pick the highest-priority OT-actionable lifecycle.
 * Done alone is not OT-actionable (resolved).
 */
export function pickOtReturnedActionableSession(
  sessions: OtReturnedSessionLite[],
  preferredId?: string | null,
): RankedSession | null {
  const ranked: RankedSession[] = [];
  for (const session of sessions) {
    if (!session.id?.trim() || isCancelledSession(session.status)) continue;
    const lifecycleStatus = deriveWaitingListStatus({
      queueStatus: session.queueStatus,
      sessionStatus: session.status,
      patientAgreedToSurgery: session.patientAgreedToSurgery,
    });
    ranked.push({ session, lifecycleStatus });
  }
  if (ranked.length === 0) return null;

  const preferred = preferredId?.trim();
  if (preferred) {
    const hit = ranked.find(
      (r) =>
        r.session.id === preferred && isOtReturnedActionableStatus(r.lifecycleStatus),
    );
    if (hit) return hit;
  }

  ranked.sort((a, b) => {
    const pri = otReturnedLifecyclePriority(b.lifecycleStatus) - otReturnedLifecyclePriority(a.lifecycleStatus);
    if (pri !== 0) return pri;
    return sortNewestFirst(a.session, b.session);
  });

  const best = ranked[0]!;
  if (!isOtReturnedActionableStatus(best.lifecycleStatus)) {
    return null;
  }
  return best;
}

/**
 * Decide whether a journey with otReturnReason belongs on Counsellor OT Returned.
 */
export function resolveOtReturnedMembership(
  input: OtReturnedMembershipInput,
): OtReturnedMembership {
  if (!input.otReturnReason?.trim()) {
    return { include: false };
  }

  const sessions = (input.sessions ?? []).filter((s) => !!s.id?.trim());
  const linkedId = input.counselingSessionId?.trim() || null;
  const wlSessionId = input.waitingListSessionId?.trim() || null;
  const wlStatus = input.waitingListStatus ?? null;

  // SurgeryDone / AddOnSurgery are not OT counselling attention.
  if (wlStatus === 'SurgeryDone' || wlStatus === 'AddOnSurgery') {
    return { include: false };
  }

  // Prefer authoritative Waiting List lifecycle when it is OT-actionable.
  if (wlStatus && isOtReturnedActionableStatus(wlStatus)) {
    const sessionId =
      wlSessionId ||
      linkedId ||
      pickOtReturnedActionableSession(sessions, linkedId)?.session.id ||
      null;
    if (!sessionId) {
      return {
        include: true,
        effectiveSessionId: null,
        lifecycleStatus: null,
        counselorId: null,
        counselorName: null,
        patientType: null,
        version: null,
        needsSessionCreate: true,
      };
    }
    return {
      include: true,
      effectiveSessionId: sessionId,
      lifecycleStatus: wlStatus,
      counselorId: input.waitingListCounselorId ?? null,
      counselorName: input.waitingListCounselorName ?? null,
      patientType: input.waitingListPatientType ?? null,
      version: input.waitingListVersion ?? null,
      needsSessionCreate: false,
    };
  }

  // WL Done (or no WL row): still scan sessions for Repeat/Pending/Processed.
  const actionable = pickOtReturnedActionableSession(sessions, linkedId || wlSessionId);
  if (actionable) {
    return {
      include: true,
      effectiveSessionId: actionable.session.id,
      lifecycleStatus: actionable.lifecycleStatus,
      counselorId: actionable.session.counselorId ?? null,
      counselorName: actionable.session.counselorName ?? null,
      patientType: actionable.session.patientType ?? null,
      version: actionable.session.version ?? null,
      needsSessionCreate: false,
    };
  }

  const hasNonCancelled = sessions.some((s) => !isCancelledSession(s.status));
  // No sessions, or only cancelled → Start Counselling (fail-open for OT attention).
  if (!hasNonCancelled) {
    return {
      include: true,
      effectiveSessionId: null,
      lifecycleStatus: null,
      counselorId: null,
      counselorName: null,
      patientType: null,
      version: null,
      needsSessionCreate: true,
    };
  }

  // Remaining sessions are resolved Done — hide from OT Returned (reason untouched).
  return { include: false };
}

export type OtReturnedProjectedRow<TJourney> = TJourney & {
  counselingSessionId: string | null;
  lifecycleStatus: WaitingListStatus | null;
  counselorId: string | null;
  counselorName: string | null;
  patientType: string | null;
  sessionVersion: number | null;
  needsSessionCreate: boolean;
};

export function filterOtReturnedOperationalRows<
  T extends {
    id: string;
    patientId?: string | null;
    otReturnReason: string | null;
    counselingSessionId: string | null;
  },
>(
  journeys: T[],
  sessionsByPatientId: Map<string, OtReturnedSessionLite[]>,
  waitingListByPatientId?: Map<
    string,
    {
      id: string;
      status: WaitingListStatus;
      counselorId?: string | null;
      counselorName?: string | null;
      patientType?: string | null;
      version?: number | null;
    }
  >,
): Array<OtReturnedProjectedRow<T>> {
  const out: Array<OtReturnedProjectedRow<T>> = [];
  for (const journey of journeys) {
    if (!journey.otReturnReason?.trim()) continue;
    const patientKey = journey.patientId?.trim() || '';
    const sessions = patientKey ? sessionsByPatientId.get(patientKey) ?? [] : [];
    const wl = patientKey ? waitingListByPatientId?.get(patientKey) : undefined;
    const membership = resolveOtReturnedMembership({
      otReturnReason: journey.otReturnReason,
      counselingSessionId: journey.counselingSessionId,
      sessions,
      waitingListStatus: wl?.status,
      waitingListSessionId: wl?.id,
      waitingListCounselorId: wl?.counselorId,
      waitingListCounselorName: wl?.counselorName,
      waitingListPatientType: wl?.patientType,
      waitingListVersion: wl?.version,
    });
    if (!membership.include) continue;
    out.push({
      ...journey,
      counselingSessionId: membership.effectiveSessionId,
      lifecycleStatus: membership.lifecycleStatus,
      counselorId: membership.counselorId,
      counselorName: membership.counselorName,
      patientType: membership.patientType,
      sessionVersion: membership.version,
      needsSessionCreate: membership.needsSessionCreate,
    });
  }
  return out;
}
