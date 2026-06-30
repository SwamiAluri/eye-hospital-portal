import { type APIRequestContext } from '@playwright/test';
import { E2E_API_BASE, apiHeaders, type LoginPayload } from './auth';

export interface OtScheduleApi {
  id: string;
  patientId: string;
  eye?: string | null;
  status: string;
  startTime?: string | null;
}

function authHeaders(token: string): Record<string, string> {
  return apiHeaders(token);
}

export async function apiUpsertOtSchedule(
  request: APIRequestContext,
  login: LoginPayload,
  payload: {
    patientId: string;
    patientName: string;
    uhid?: string;
    surgeryName?: string;
    eye: string;
    startTime: string;
    counsellingSessionId?: string;
  },
): Promise<OtScheduleApi | null> {
  const res = await request.post(`${E2E_API_BASE}/Counseling/ot-schedule`, {
    headers: authHeaders(login.accessToken),
    data: {
      patientId: payload.patientId,
      patientName: payload.patientName,
      uhid: payload.uhid,
      surgeryName: payload.surgeryName ?? 'Phaco',
      eye: payload.eye,
      startTime: payload.startTime,
      counsellingSessionId: payload.counsellingSessionId,
    },
  });
  if (!res.ok()) return null;
  return (await res.json()) as OtScheduleApi;
}

export async function apiConfirmOtSchedule(
  request: APIRequestContext,
  login: LoginPayload,
  scheduleId: string,
): Promise<boolean> {
  const res = await request.post(`${E2E_API_BASE}/Counseling/ot-schedule/${scheduleId}/confirm`, {
    headers: authHeaders(login.accessToken),
    data: {},
  });
  return res.ok();
}

export async function apiFinaliseOtSchedule(
  request: APIRequestContext,
  login: LoginPayload,
  scheduleId: string,
): Promise<boolean> {
  const res = await request.post(`${E2E_API_BASE}/Counseling/ot-schedule/${scheduleId}/finalise`, {
    headers: authHeaders(login.accessToken),
    data: {},
  });
  return res.ok();
}

export async function apiPrepareOtList(
  request: APIRequestContext,
  login: LoginPayload,
  date: string,
  scheduleIds: string[],
): Promise<{ ok: boolean; status: number; message?: string }> {
  const res = await request.post(`${E2E_API_BASE}/Counseling/ot-schedule/prepare`, {
    headers: authHeaders(login.accessToken),
    data: {
      date,
      items: scheduleIds.map((scheduleId, index) => ({
        scheduleId,
        sequence: index + 1,
      })),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok(), status: res.status(), message: body.message };
}
