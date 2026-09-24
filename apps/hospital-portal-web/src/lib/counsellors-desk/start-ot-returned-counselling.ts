/**
 * OT Returned — Start Counselling (PD-OT-RETURNED-RESOLUTION §21).
 * Reuses POST /Counseling/sessions. AddToQueue=false (no WL duplicate).
 * Does not invent CounselorId — ownership follows certified create path.
 */

export type OtReturnedCreateSessionPayload = {
  patientId: string;
  branchId?: string;
  referredByDoctorId: string;
  sessionType: string;
  patientType: string;
  addToQueue: false;
  recommendedSurgery?: string;
  surgeryTentativeEye?: string;
  additionalNotes?: string;
};

export function buildOtReturnedCreateSessionPayload(input: {
  patientId: string;
  branchId?: string;
  referredByDoctorId: string;
  otReturnReason?: string | null;
  procedureName?: string | null;
  eye?: string | null;
}): OtReturnedCreateSessionPayload {
  const reason = input.otReturnReason?.trim();
  const procedure = input.procedureName?.trim();
  const eye = input.eye?.trim();
  return {
    patientId: input.patientId,
    ...(input.branchId?.trim() ? { branchId: input.branchId.trim() } : {}),
    referredByDoctorId: input.referredByDoctorId,
    sessionType: 'Followup',
    patientType: 'Cash',
    addToQueue: false,
    ...(procedure ? { recommendedSurgery: procedure } : {}),
    ...(eye ? { surgeryTentativeEye: eye } : {}),
    ...(reason ? { additionalNotes: `OT Returned: ${reason}` } : {}),
  };
}

export function resolveReferringDoctorId(input: {
  primarySurgeonId?: string | null;
  admittingDoctorId?: string | null;
  priorSessionReferredByDoctorId?: string | null;
}): string | null {
  const surg = input.primarySurgeonId?.trim();
  if (surg) return surg;
  const admit = input.admittingDoctorId?.trim();
  if (admit) return admit;
  const prior = input.priorSessionReferredByDoctorId?.trim();
  if (prior) return prior;
  return null;
}

export function counsellingSessionHref(sessionId: string): string {
  return `/dashboard/counsellors-desk/${sessionId}?from=waiting-list`;
}

export type CreateSessionHttpResult = {
  status: number;
  data?: {
    success?: boolean;
    sessionId?: string;
    message?: string;
    SessionId?: string;
  } | null;
};

export type ParsedCreateSessionResult =
  | { ok: true; sessionId: string; created: boolean }
  | { ok: false; message: string };

function pickSessionId(data: CreateSessionHttpResult['data']): string | null {
  if (!data) return null;
  const id = (data.sessionId ?? data.SessionId)?.trim();
  return id || null;
}

/**
 * Interprets POST /Counseling/sessions success and PD-C Conflict (409 + sessionId).
 */
export function parseCreateSessionResult(
  result: CreateSessionHttpResult,
): ParsedCreateSessionResult {
  const sessionId = pickSessionId(result.data);
  if (result.status >= 200 && result.status < 300 && sessionId) {
    return { ok: true, sessionId, created: true };
  }
  // PD-C reuse block — continue existing episode (authoritative duplicate guard).
  if (result.status === 409 && sessionId) {
    return { ok: true, sessionId, created: false };
  }
  // Some clients surface conflict body without relying on status alone.
  if (result.data?.success === false && sessionId) {
    return { ok: true, sessionId, created: false };
  }
  if (result.status >= 200 && result.status < 300 && result.data?.success !== false) {
    // Success without sessionId is not usable.
    return {
      ok: false,
      message: 'Counselling session was created but no session id was returned.',
    };
  }
  const message =
    result.data?.message?.trim() ||
    'Failed to start counselling for this OT Returned patient.';
  return { ok: false, message };
}

export type StartOtReturnedCounsellingDeps = {
  getJourneyDetail: (journeyId: string) => Promise<{
    patientId?: string | null;
    primarySurgeonId?: string | null;
    admittingDoctorId?: string | null;
    procedureName?: string | null;
    eyeOperated?: string | null;
    otReturnReason?: string | null;
  } | null>;
  getPatientSessions: (patientId: string) => Promise<
    Array<{ id?: string; referredByDoctorId?: string | null; status?: string | null }>
  >;
  createSession: (payload: OtReturnedCreateSessionPayload) => Promise<CreateSessionHttpResult>;
};

/**
 * Certified Start Counselling for OT Returned no-session rows.
 * Uses POST /Counseling/sessions; respects PD-C conflict SessionId.
 */
export async function startOtReturnedCounselling(
  input: {
    journeyId: string;
    patientId?: string | null;
    branchId?: string | null;
    otReturnReason?: string | null;
    procedureName?: string | null;
    eye?: string | null;
  },
  deps: StartOtReturnedCounsellingDeps,
): Promise<{ sessionId: string; created: boolean; href: string }> {
  const detail = await deps.getJourneyDetail(input.journeyId);
  const patientId = (input.patientId ?? detail?.patientId)?.trim();
  if (!patientId) {
    throw new Error('Patient is missing on this OT Returned journey.');
  }

  const priorSessions = await deps.getPatientSessions(patientId);
  const priorDoctor =
    priorSessions.find((s) => !!s.referredByDoctorId?.trim())?.referredByDoctorId ?? null;

  const referredByDoctorId = resolveReferringDoctorId({
    primarySurgeonId: detail?.primarySurgeonId,
    admittingDoctorId: detail?.admittingDoctorId,
    priorSessionReferredByDoctorId: priorDoctor,
  });

  if (!referredByDoctorId) {
    throw new Error(
      'Cannot start counselling: no referring surgeon is available on this journey or prior session.',
    );
  }

  const payload = buildOtReturnedCreateSessionPayload({
    patientId,
    branchId: input.branchId ?? undefined,
    referredByDoctorId,
    otReturnReason: input.otReturnReason ?? detail?.otReturnReason,
    procedureName: input.procedureName ?? detail?.procedureName,
    eye: input.eye ?? detail?.eyeOperated,
  });

  const httpResult = await deps.createSession(payload);
  const parsed = parseCreateSessionResult(httpResult);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }

  return {
    sessionId: parsed.sessionId,
    created: parsed.created,
    href: counsellingSessionHref(parsed.sessionId),
  };
}
