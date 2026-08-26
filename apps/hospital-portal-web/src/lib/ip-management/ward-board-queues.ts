import type { PatientJourneyRowDto, WardBedDto, WardDto } from '@/lib/api/ip-management.api';
import type { IpPersona } from './ip-persona';
import type { IpRoleActions } from './ip-role-actions';
import { nextPermittedClinicalAction } from './ip-role-actions';
import { clinicalBadgeLabel } from './ip-target-badges';
import type { PreOpStatus } from './preop-status';
import { wardBedMapKind } from './ward-bed-map';

/** UI queues — filters only. Not persisted clinical states. */
export type WardBoardQueue = 'need' | 'ward' | 'arrive' | 'ot' | 'rec' | 'more';

export const WARD_BOARD_QUEUES: { key: WardBoardQueue; label: string }[] = [
  { key: 'need', label: 'Needs me' },
  { key: 'ward', label: 'On ward' },
  { key: 'arrive', label: 'Arriving' },
  { key: 'ot', label: 'In OT' },
  { key: 'rec', label: 'Recovery / D/C' },
  { key: 'more', label: 'Discharged today' },
];

const ON_WARD_STATES = new Set([
  'Admitted',
  'ReadyForSurgery',
  'SurgeryCompleted',
  'PostOp',
  'ReadyForDischarge',
]);

const NEED_STATES = new Set([
  'Expected',
  'Admitted',
  'ReadyForSurgery',
  'SurgeryCompleted',
  'PostOp',
  'ReadyForDischarge',
  'CancelledSurgery',
]);

export function defaultWardQueue(persona: IpPersona): WardBoardQueue {
  return persona === 'ward' ? 'need' : 'ward';
}

export function isDayCareWard(ward: Pick<WardDto, 'wardName' | 'wardType'> | null | undefined): boolean {
  if (!ward) return false;
  return /day\s*care/i.test(ward.wardType) || /day\s*care/i.test(ward.wardName);
}

export function matchesWardQueue(journey: PatientJourneyRowDto, queue: WardBoardQueue): boolean {
  const state = journey.clinicalState;
  switch (queue) {
    case 'need':
      return NEED_STATES.has(state) || journey.pendingRebook === true || Boolean(journey.otReturnReason);
    case 'ward':
      return ON_WARD_STATES.has(state);
    case 'arrive':
      return state === 'Expected';
    case 'ot':
      return state === 'InOT' || state === 'SentToOT';
    case 'rec':
      return state === 'PostOp' || state === 'ReadyForDischarge' || state === 'SurgeryCompleted';
    case 'more':
      return state === 'Discharged';
    default:
      return true;
  }
}

export function countWardQueue(journeys: PatientJourneyRowDto[], queue: WardBoardQueue): number {
  return journeys.filter(j => matchesWardQueue(j, queue)).length;
}

/** Empty Needs me falls through to On ward. Does not invent patients. */
export function resolveEffectiveWardQueue(
  selected: WardBoardQueue,
  journeys: PatientJourneyRowDto[],
): { queue: WardBoardQueue; fellThrough: boolean } {
  if (selected === 'need' && countWardQueue(journeys, 'need') === 0) {
    return { queue: 'ward', fellThrough: true };
  }
  return { queue: selected, fellThrough: false };
}

export function journeyOnSelectedWard(
  journey: PatientJourneyRowDto,
  ward: Pick<WardDto, 'wardName'> | null | undefined,
): boolean {
  if (!ward) return true;
  if (!journey.wardName) return journey.clinicalState === 'Expected';
  return journey.wardName === ward.wardName;
}

export function occupancySummary(beds: WardBedDto[]): {
  total: number;
  occupied: number;
  available: number;
  cleaning: number;
  reserved: number;
} {
  let occupied = 0;
  let available = 0;
  let cleaning = 0;
  let reserved = 0;
  for (const bed of beds) {
    const kind = wardBedMapKind(bed);
    if (kind === 'occupied') occupied += 1;
    else if (kind === 'available') available += 1;
    else if (kind === 'cleaning') cleaning += 1;
    else if (kind === 'reserved') reserved += 1;
  }
  return { total: beds.length, occupied, available, cleaning, reserved };
}

export function returnedFromOtCount(journeys: PatientJourneyRowDto[]): number {
  return journeys.filter(j => Boolean(j.otReturnReason) && j.clinicalState !== 'Discharged').length;
}

export function rowLooksReadyForOt(journey: PatientJourneyRowDto): boolean {
  const total = journey.readinessTotal ?? 0;
  const done = journey.readinessCompleted ?? 0;
  if (total > 0 && done < total) return false;
  if (journey.pacCompleted === false) return false;
  if ((journey.unverifiedCriticalCount ?? 0) > 0) return false;
  return journey.clinicalState === 'Admitted';
}

export type WardNextKind =
  | 'preop'
  | 'markReady'
  | 'sendToOt'
  | 'postop'
  | 'discharge'
  | 'journey'
  | 'rebook'
  | 'otBoard';

export interface WardNextAction {
  label: string;
  kind: WardNextKind;
  primary: boolean;
}

/**
 * Persona changes the filled label, not authorisation.
 * Permission still comes from `nextPermittedClinicalAction`.
 */
export function resolveWardNextAction(
  journey: PatientJourneyRowDto,
  persona: IpPersona,
  actions: IpRoleActions,
): WardNextAction {
  const permitted = nextPermittedClinicalAction(journey.clinicalState, journey.otState, actions);
  const coord = persona === 'coordinator' || persona === 'admin';

  if (journey.clinicalState === 'CancelledSurgery' || journey.pendingRebook) {
    return { label: 'Rebook', kind: 'rebook', primary: true };
  }
  if (journey.clinicalState === 'InOT' || journey.clinicalState === 'SentToOT') {
    return { label: 'Track in OT', kind: 'otBoard', primary: false };
  }
  if (journey.clinicalState === 'Admitted' && !rowLooksReadyForOt(journey)) {
    const label = coord && journey.pacCompleted === false ? 'Chase PAC' : 'Open pre-op';
    return { label, kind: 'preop', primary: false };
  }
  if (journey.clinicalState === 'Admitted' && rowLooksReadyForOt(journey) && permitted?.kind === 'ready') {
    return { label: 'Mark ready for OT', kind: 'markReady', primary: true };
  }
  if (permitted?.kind === 'send') {
    return { label: 'Send to OT', kind: 'sendToOt', primary: true };
  }
  if (permitted?.kind === 'admit') {
    return { label: 'Open pre-op', kind: 'preop', primary: true };
  }
  if (permitted?.kind === 'postop') {
    return { label: 'Open post-op', kind: 'postop', primary: false };
  }
  if (permitted?.kind === 'readyDc' || permitted?.kind === 'discharge') {
    const due = (journey.balanceDue ?? 0) > 0;
    const label = coord && due ? 'Clear dues then discharge' : 'Open discharge';
    return { label, kind: 'discharge', primary: !due };
  }
  if (journey.clinicalState === 'Expected') {
    return { label: 'Open pre-op', kind: 'preop', primary: true };
  }
  return { label: 'Open pre-op', kind: 'preop', primary: false };
}

export function clinicalStateToChip(state: string | null | undefined): {
  status: PreOpStatus;
  label: string;
} {
  const label = clinicalBadgeLabel(state);
  switch (state) {
    case 'Expected':
      return { status: 'not-started', label };
    case 'Admitted':
    case 'PostOp':
      return { status: 'in-progress', label };
    case 'ReadyForSurgery':
    case 'SurgeryCompleted':
    case 'Discharged':
      return { status: 'completed', label };
    case 'SentToOT':
    case 'InOT':
    case 'ReadyForDischarge':
      return { status: 'pending-verification', label };
    case 'CancelledSurgery':
    case 'AdmissionCancelled':
      return { status: 'rejected', label };
    default:
      return { status: 'not-started', label };
  }
}

export function otStateToChip(otState: string | null | undefined): {
  status: PreOpStatus;
  label: string;
} {
  const label = (otState ?? '').trim() || '—';
  const lower = label.toLowerCase();
  if (!otState) return { status: 'not-started', label: '—' };
  if (/cancel|abort/.test(lower)) return { status: 'rejected', label };
  if (/complete|done|out/.test(lower)) return { status: 'completed', label };
  if (/progress|in ot|timeout|time out/.test(lower)) return { status: 'pending-verification', label };
  if (/ready|sign/.test(lower)) return { status: 'in-progress', label };
  return { status: 'in-progress', label };
}

export function blockingSummary(journey: PatientJourneyRowDto): string | null {
  const bits: string[] = [];
  if (journey.pacCompleted === false) bits.push('PAC');
  if ((journey.unverifiedCriticalCount ?? 0) > 0) bits.push('Critical lab');
  if (journey.p2ClearanceNeedsAttention) bits.push('Clearance');
  const total = journey.readinessTotal ?? 0;
  const done = journey.readinessCompleted ?? 0;
  if (total > 0 && done < total && bits.length === 0) {
    bits.push(`${done} of ${total}`);
  }
  if (journey.otReturnReason) bits.push('Returned from OT');
  if ((journey.balanceDue ?? 0) > 0 && (journey.clinicalState === 'ReadyForDischarge' || journey.clinicalState === 'PostOp')) {
    bits.push('Patient due');
  }
  return bits.length ? bits.join(' · ') : null;
}

const PRE_OP_KPI = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

function startOfDay(value?: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** KPI chips are list filters over existing journeys — not persisted states. */
export function matchesWardKpi(j: PatientJourneyRowDto, key: string): boolean {
  const preOp = PRE_OP_KPI.has(j.clinicalState);
  const active = j.clinicalState !== 'Discharged'
    && j.clinicalState !== 'CancelledSurgery'
    && j.clinicalState !== 'AdmissionCancelled';
  const today = startOfDay(new Date().toISOString())!;
  const sched = startOfDay(j.surgeryScheduledAt);
  switch (key) {
    case 'otLoadToday':
      return active && sched === today;
    case 'pacPending':
      return (j.clinicalState === 'Admitted' || j.clinicalState === 'ReadyForSurgery') && j.pacCompleted === false;
    case 'criticalLabs':
      return preOp && (j.unverifiedCriticalCount ?? 0) > 0;
    case 'financialPending':
      return preOp && (j.balanceDue ?? 0) > 0;
    case 'delayed':
      return preOp && ((sched !== null && sched < today) || !!j.otReturnReason);
    case 'rebookRequired':
      return j.pendingRebook === true;
    case 'returnedFromOt':
      return Boolean(j.otReturnReason) && j.clinicalState !== 'Discharged';
    default:
      return true;
  }
}

export function stayLabel(admittedAt: string | null | undefined): string {
  if (!admittedAt) return '—';
  const start = new Date(admittedAt);
  if (Number.isNaN(start.getTime())) return '—';
  const hours = Math.max(0, Math.floor((Date.now() - start.getTime()) / 3_600_000));
  if (hours < 24) return `${hours}h stay`;
  const days = Math.floor(hours / 24);
  return `${days}d stay`;
}
