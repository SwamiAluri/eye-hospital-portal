import { getApi } from '@/lib/api';
import { optometryQueueApi, type OptometryQueueItem } from '@/lib/api/optometry.api';

export type StationQueueType = 'Optometry' | 'Doctor' | 'Billing' | 'Pharmacy';

export interface StationQueueItem {
  id: string;
  visitId: string;
  tokenNumber: string;
  patientId: string;
  patientName: string;
  mobileNumber: string;
  queueType: StationQueueType;
  status: 'waiting' | 'called' | 'in-progress' | 'completed' | 'absent';
  checkedInAt: string;
  waitTime: number;
  doctorName?: string;
  roomNumber?: string;
  priority: 'normal' | 'emergency' | 'follow-up';
}

export interface StationQueueStats {
  totalWaiting: number;
  averageWaitTime: number;
  totalCompleted: number;
  totalAbsent: number;
}

export type StationQueuesState = Record<StationQueueType, StationQueueItem[]>;
export type StationStatsState = Record<StationQueueType, StationQueueStats>;

const EMPTY_STATS: StationQueueStats = {
  totalWaiting: 0,
  averageWaitTime: 0,
  totalCompleted: 0,
  totalAbsent: 0,
};

function waitMinutes(checkedInAt?: string): number {
  if (!checkedInAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000));
}

function mapOptometryStatus(status: string): StationQueueItem['status'] {
  switch (status) {
    case 'In Progress':
      return 'in-progress';
    case 'Completed':
      return 'completed';
    case 'Skipped':
      return 'absent';
    default:
      return 'waiting';
  }
}

function mapVisitPriority(priority?: string, isEmergency?: boolean): StationQueueItem['priority'] {
  if (isEmergency) return 'emergency';
  const p = (priority ?? '').toLowerCase();
  if (p === 'urgent' || p === 'high') return 'follow-up';
  return 'normal';
}

function mapOptometryItem(item: OptometryQueueItem): StationQueueItem {
  const checkedInAt = item.waitingSince ?? new Date().toISOString();
  return {
    id: item.visitId ?? item.id,
    visitId: item.visitId ?? item.id,
    tokenNumber: item.tokenNumber,
    patientId: item.patientId,
    patientName: item.patientName,
    mobileNumber: '',
    queueType: 'Optometry',
    status: mapOptometryStatus(item.status),
    checkedInAt,
    waitTime: waitMinutes(checkedInAt),
    doctorName: item.assignedOptometrist,
    roomNumber: item.roomCode,
    priority:
      item.urgency === 'Emergency' ? 'emergency' : item.urgency === 'Urgent' ? 'follow-up' : 'normal',
  };
}

interface VisitQueueRow {
  id: string;
  tokenNumber: string;
  patientName: string;
  patientMrn?: string;
  status: string;
  checkedInAt?: string;
  waitingMinutes?: number;
  currentStation?: string;
  assignedToName?: string;
  isEmergency?: boolean;
  priority?: string;
}

function mapVisitRow(
  row: VisitQueueRow,
  queueType: StationQueueType,
): StationQueueItem {
  const checkedInAt = row.checkedInAt ?? new Date().toISOString();
  const status: StationQueueItem['status'] =
    row.status === 'in_consultation' || row.status === 'with_doctor' || row.status === 'with_optometrist'
      ? 'in-progress'
      : 'waiting';

  return {
    id: row.id,
    visitId: row.id,
    tokenNumber: row.tokenNumber,
    patientId: row.patientMrn ?? row.id,
    patientName: row.patientName,
    mobileNumber: '',
    queueType,
    status,
    checkedInAt,
    waitTime: row.waitingMinutes ?? waitMinutes(checkedInAt),
    doctorName: row.assignedToName,
    priority: mapVisitPriority(row.priority, row.isEmergency),
  };
}

function buildStats(items: StationQueueItem[]): StationQueueStats {
  const waiting = items.filter((i) => i.status === 'waiting');
  const avg =
    waiting.length > 0
      ? Math.round(waiting.reduce((sum, i) => sum + i.waitTime, 0) / waiting.length)
      : 0;

  return {
    totalWaiting: waiting.length,
    averageWaitTime: avg,
    totalCompleted: items.filter((i) => i.status === 'completed').length,
    totalAbsent: items.filter((i) => i.status === 'absent').length,
  };
}

export async function loadStationQueues(branchId: string): Promise<{
  queues: StationQueuesState;
  stats: StationStatsState;
}> {
  const api = getApi();

  const [optometryRaw, doctorRaw, billingRaw, pharmacyRaw] = await Promise.all([
    optometryQueueApi.getQueue(branchId, true).catch(() => [] as OptometryQueueItem[]),
    api
      .get<VisitQueueRow[]>(`/visits/queue/${branchId}`, { params: { station: 'doctor' } })
      .then((r) => r.data)
      .catch(() => [] as VisitQueueRow[]),
    api
      .get<VisitQueueRow[]>(`/visits/queue/${branchId}`, { params: { station: 'billing' } })
      .then((r) => r.data)
      .catch(() => [] as VisitQueueRow[]),
    api
      .get<VisitQueueRow[]>(`/visits/queue/${branchId}`, { params: { station: 'pharmacy' } })
      .then((r) => r.data)
      .catch(() => [] as VisitQueueRow[]),
  ]);

  const optometry = optometryRaw
    .filter((p) => p.status === 'Waiting' || p.status === 'In Progress')
    .map(mapOptometryItem);
  const doctor = doctorRaw.map((r) => mapVisitRow(r, 'Doctor'));
  const billing = billingRaw.map((r) => mapVisitRow(r, 'Billing'));
  const pharmacy = pharmacyRaw.map((r) => mapVisitRow(r, 'Pharmacy'));

  const queues: StationQueuesState = {
    Optometry: optometry,
    Doctor: doctor,
    Billing: billing,
    Pharmacy: pharmacy,
  };

  const stats: StationStatsState = {
    Optometry: buildStats(optometry),
    Doctor: buildStats(doctor),
    Billing: buildStats(billing),
    Pharmacy: buildStats(pharmacy),
  };

  return { queues, stats };
}

export function emptyStationQueues(): { queues: StationQueuesState; stats: StationStatsState } {
  return {
    queues: { Optometry: [], Doctor: [], Billing: [], Pharmacy: [] },
    stats: {
      Optometry: { ...EMPTY_STATS },
      Doctor: { ...EMPTY_STATS },
      Billing: { ...EMPTY_STATS },
      Pharmacy: { ...EMPTY_STATS },
    },
  };
}
