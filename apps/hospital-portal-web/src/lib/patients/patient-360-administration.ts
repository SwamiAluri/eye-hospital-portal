import { appointmentsApi, visitsApi } from '@/lib/api';
import { patientConsentsApi } from '@/lib/api/patient-consents.api';
import { patientEncounterUrl } from '@/lib/patients/patient-routes';

export const SURGERY_UNAVAILABLE = 'Surgery / OT is not available in Patient 360.';

export type AdministrationSource = 'appointments' | 'visits' | 'consents';
export type ReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface AppointmentRow {
  id: string;
  when: string | null;
  status: string | null;
  provider: string | null;
  title: string;
  detail: string | null;
}

export interface VisitRow {
  id: string | null;
  title: string;
  status: string | null;
  when: string | null;
  provider: string | null;
  station: string | null;
  checkInTime: string | null;
  encounterHref: string | null;
}

export interface ConsentRow {
  id: string;
  title: string;
  status: string;
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface AdministrationListResult<T> {
  state: ReadState;
  rows: T[];
}

export interface Patient360AdministrationBundle {
  appointments: AdministrationListResult<AppointmentRow>;
  visits: AdministrationListResult<VisitRow>;
  consents: AdministrationListResult<ConsentRow>;
}

const EMPTY: Record<AdministrationSource, string> = {
  appointments: 'No appointments recorded.',
  visits: 'No visits recorded.',
  consents: 'No consents recorded.',
};

const UNAVAILABLE: Record<AdministrationSource, string> = {
  appointments: 'Appointments are not available in Patient 360.',
  visits: 'Visits are not available in Patient 360.',
  consents: 'Consents are not available in Patient 360.',
};

const UNAUTHORIZED: Record<AdministrationSource, string> = {
  appointments: 'Appointments are not available to this sign-in.',
  visits: 'Visits are not available to this sign-in.',
  consents: 'Consents are not available to this sign-in.',
};

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function displayWhen(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  return raw;
}

function unwrapList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  if (record.data && typeof record.data === 'object') {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items;
  }
  return null;
}

export function classifyAdministrationError(error: unknown): Exclude<ReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

export function administrationEmptyMessage(source: AdministrationSource): string {
  return EMPTY[source];
}

export function administrationUnavailableMessage(source: AdministrationSource): string {
  return UNAVAILABLE[source];
}

export function administrationUnauthorizedMessage(source: AdministrationSource): string {
  return UNAUTHORIZED[source];
}

export function mapAppointment(raw: Record<string, unknown>): AppointmentRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    when: displayWhen(raw.appointmentDate ?? raw.appointmentDateTime),
    status: text(raw.status),
    provider: text(raw.doctorName),
    title: text(raw.appointmentType) ?? 'Appointment',
    detail: text(raw.notes) ?? text(raw.reasonForVisit),
  };
}

export function mapVisit(patientId: string, raw: Record<string, unknown>): VisitRow | null {
  const id = text(raw.id);
  const status = text(raw.status);
  const visitType = text(raw.visitType);
  if (!id && !status && !visitType) return null;
  return {
    id,
    title: visitType ?? 'Visit',
    status,
    when: displayWhen(raw.createdAt),
    provider: text(raw.consultantName) ?? text(raw.assignedToName),
    station: text(raw.currentStation),
    checkInTime: displayWhen(raw.checkedInAt),
    encounterHref: id ? patientEncounterUrl(patientId, id) : null,
  };
}

export function mapConsent(raw: Record<string, unknown>): ConsentRow | null {
  const id = text(raw.id);
  const title = text(raw.consentName) ?? text(raw.consentType);
  if (!id || !title) return null;
  const revokedAt = displayWhen(raw.revokedAt);
  const storedStatus = text(raw.status);
  const status =
    revokedAt && (!storedStatus || /^active$/i.test(storedStatus)) ? 'revoked' : storedStatus ?? 'revoked';
  return {
    id,
    title,
    status,
    grantedAt: displayWhen(raw.grantedAt),
    revokedAt,
  };
}

async function readMapped<T>(
  task: () => Promise<unknown>,
  map: (raw: Record<string, unknown>) => T | null,
): Promise<AdministrationListResult<T>> {
  try {
    const rows = unwrapList(await task());
    if (!rows) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map(map)
        .filter((row): row is T => row != null),
    };
  } catch (error) {
    return { state: classifyAdministrationError(error), rows: [] };
  }
}

export async function loadPatient360Administration(patientId: string): Promise<Patient360AdministrationBundle> {
  const [appointments, visits, consents] = await Promise.all([
    readMapped(
      () => appointmentsApi.getByPatient(patientId).then((response) => response.data),
      mapAppointment,
    ),
    readMapped(
      () => visitsApi.getByPatient(patientId, 1, 100).then((response) => response.data),
      (raw) => mapVisit(patientId, raw),
    ),
    readMapped(
      () => patientConsentsApi.getByPatient(patientId).then((response) => response.data),
      mapConsent,
    ),
  ]);

  return { appointments, visits, consents };
}
