export const SLOT_SESSIONS = ['Morning', 'Afternoon', 'Evening'] as const;
export type IpSlotSession = (typeof SLOT_SESSIONS)[number];
export type IpSlotSessionFilter = 'All' | IpSlotSession;

export function isSlotSession(value: string | null | undefined): value is IpSlotSession {
  return !!value && (SLOT_SESSIONS as readonly string[]).includes(value);
}

export function formatSlotLabel(session: string | null | undefined, sequenceNo: number | null | undefined): string | null {
  if (!session || sequenceNo == null || sequenceNo < 1) return null;
  const prefix = session === 'Morning' ? 'AM' : session === 'Afternoon' ? 'PM' : session === 'Evening' ? 'EV' : session;
  return `${prefix}-${sequenceNo}`;
}

export function matchesSlotSession(
  row: { slotSession?: string | null },
  session: IpSlotSessionFilter,
): boolean {
  if (!session || session === 'All') return true;
  return row.slotSession === session;
}

/** Ready-for-OT queue: sequence, then planned arrival, then original order. */
export function compareReadyForOtQueue(
  a: { slotSequenceNo?: number | null; plannedArrivalAt?: string | null },
  b: { slotSequenceNo?: number | null; plannedArrivalAt?: string | null },
): number {
  const as = a.slotSequenceNo ?? Number.MAX_SAFE_INTEGER;
  const bs = b.slotSequenceNo ?? Number.MAX_SAFE_INTEGER;
  if (as !== bs) return as - bs;
  const ap = a.plannedArrivalAt ? Date.parse(a.plannedArrivalAt) : Number.MAX_SAFE_INTEGER;
  const bp = b.plannedArrivalAt ? Date.parse(b.plannedArrivalAt) : Number.MAX_SAFE_INTEGER;
  return ap - bp;
}

/** Census Ready-for-OT tab key is `ReadyForOt` (not the clinical state name). */
export function sortIpCensusRows<T extends { slotSequenceNo?: number | null; plannedArrivalAt?: string | null }>(
  rows: T[],
  tab: string,
): T[] {
  if (tab === 'ReadyForOt') return [...rows].sort(compareReadyForOtQueue);
  return rows;
}

export function formatPlannedArrival(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDurationMinutes(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return '—';
  const rounded = Math.round(mins);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatBoardScopeDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatArriveLabel(iso: string | null | undefined): string {
  const t = formatPlannedArrival(iso);
  return t === '—' ? '' : `arrive ${t}`;
}

export type SlotBadgeTone = 'ok' | 'ot' | 'danger' | 'efc' | 'inhouse';

export function slotCardBadges(row: {
  clinicalState?: string | null;
  otState?: string | null;
  pacCompleted?: boolean;
  isEmergencyFc?: boolean;
}): { label: string; tone: SlotBadgeTone }[] {
  const badges: { label: string; tone: SlotBadgeTone }[] = [];
  const clinical = row.clinicalState ?? '';
  const ot = row.otState ?? '';
  if (clinical === 'Expected') badges.push({ label: 'Not admitted', tone: 'danger' });
  if (clinical === 'ReadyForSurgery') badges.push({ label: 'Ready', tone: 'ok' });
  if (clinical === 'InOT' || ot === 'InProgress' || ot === 'Accepted') {
    badges.push({ label: 'In OT', tone: 'ot' });
  } else if (clinical === 'SentToOT' || ot === 'SentToOT') {
    badges.push({ label: 'Sent to OT', tone: 'ot' });
  }
  if (row.isEmergencyFc) badges.push({ label: 'Emergency FC', tone: 'efc' });
  if (!row.pacCompleted && clinical !== 'Discharged' && clinical !== 'Expected') {
    badges.push({ label: 'PAC pending', tone: 'danger' });
  }
  if (row.pacCompleted && clinical !== 'ReadyForSurgery' && clinical !== 'InOT' && clinical !== 'SentToOT') {
    badges.push({ label: 'PAC done', tone: 'inhouse' });
  }
  return badges;
}
