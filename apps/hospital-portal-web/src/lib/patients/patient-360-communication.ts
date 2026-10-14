import { patientCommunicationsApi } from '@/lib/api/patient-communications.api';

const PREVIEW_LIMIT = 160;

export type ReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface CommunicationRow {
  id: string;
  channel: string;
  direction: string | null;
  subject: string | null;
  status: string | null;
  sender: string | null;
  recipient: string | null;
  when: string | null;
  preview: string | null;
  message: string | null;
}

export interface CommunicationListResult {
  state: ReadState;
  rows: CommunicationRow[];
}

export function communicationEmptyMessage(): string {
  return 'No communications recorded.';
}

export function communicationUnavailableMessage(): string {
  return 'Communications are not available in Patient 360.';
}

export function communicationUnauthorizedMessage(): string {
  return 'Communications are not available to this sign-in.';
}

export function classifyCommunicationError(error: unknown): Exclude<ReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

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
  return null;
}

export function mapCommunication(raw: Record<string, unknown>): CommunicationRow | null {
  const id = text(raw.id);
  const channel = text(raw.communicationType);
  if (!id || !channel) return null;
  const message = text(raw.message);
  return {
    id,
    channel,
    direction: text(raw.direction),
    subject: text(raw.subject),
    status: text(raw.status),
    sender: text(raw.sender),
    recipient: text(raw.recipient),
    when: displayWhen(raw.sentAt ?? raw.createdAt),
    preview: message ? message.slice(0, PREVIEW_LIMIT) : null,
    message,
  };
}

export async function loadPatient360Communications(patientId: string): Promise<CommunicationListResult> {
  try {
    const response = await patientCommunicationsApi.getByPatient(patientId);
    const rows = unwrapList(response.data);
    if (!rows) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map(mapCommunication)
        .filter((row): row is CommunicationRow => row != null),
    };
  } catch (error) {
    return { state: classifyCommunicationError(error), rows: [] };
  }
}
