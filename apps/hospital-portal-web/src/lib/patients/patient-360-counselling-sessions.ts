import { getCounselingSessionContextByPatient } from '@/lib/api/counseling-sessions.api';

export type CounsellingSessionReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface CounsellingSessionRow {
  id: string;
  sessionNumber: string | null;
  sessionType: string | null;
  sessionDate: string | null;
  sessionTime: string | null;
  status: string | null;
  counsellorName: string | null;
}

export interface CounsellingSessionListResult {
  state: CounsellingSessionReadState;
  rows: CounsellingSessionRow[];
}

export function counsellingSessionEmptyMessage(): string {
  return 'No counselling sessions recorded.';
}

export function counsellingSessionUnavailableMessage(): string {
  return 'Counselling session information is unavailable.';
}

export function counsellingSessionUnauthorizedMessage(): string {
  return 'Counselling session information is not available to this sign-in.';
}

export function classifyCounsellingSessionError(error: unknown): Exclude<CounsellingSessionReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function displayDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
}

function clock(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function sessionTime(start: unknown, end: unknown): string | null {
  const from = clock(start);
  const to = clock(end);
  if (from && to) return `${from}–${to}`;
  return from ?? to;
}

function unwrapSessions(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const sessions = (payload as { sessions?: unknown }).sessions;
  return Array.isArray(sessions) ? sessions : null;
}

export function mapCounsellingSession(raw: Record<string, unknown>): CounsellingSessionRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    sessionNumber: text(raw.sessionNumber),
    sessionType: text(raw.sessionType),
    sessionDate: displayDate(raw.sessionDate),
    sessionTime: sessionTime(raw.sessionStartTime, raw.sessionEndTime),
    status: text(raw.status),
    counsellorName: text(raw.counsellorName),
  };
}

export async function loadPatient360CounsellingSessions(
  patientId: string,
): Promise<CounsellingSessionListResult> {
  try {
    const response = await getCounselingSessionContextByPatient(patientId);
    const list = unwrapSessions(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapCounsellingSession)
        .filter((row): row is CounsellingSessionRow => row != null),
    };
  } catch (error) {
    return { state: classifyCounsellingSessionError(error), rows: [] };
  }
}
