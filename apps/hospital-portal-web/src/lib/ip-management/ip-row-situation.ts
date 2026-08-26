import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';

export interface IpRowSituation {
  location: string;
  nextAction: string;
  nextActionOwner: string;
  financialBlocker: string | null;
  coverageBlocker: string | null;
  operationalBlocker: string | null;
}

const OT_LABEL: Record<string, string> = {
  NotSent: 'Not sent',
  SentToOT: 'Sent to OT',
  Accepted: 'Accepted in OT',
  InProgress: 'Surgery in progress',
  Completed: 'Surgery complete',
};

export function formatOtState(otState: string | null | undefined): string {
  if (!otState) return '—';
  return OT_LABEL[otState] ?? otState;
}

export function buildIpRowSituation(j: PatientJourneyRowDto): IpRowSituation {
  const location = describeLocation(j);
  const { nextAction, nextActionOwner } = describeNextAction(j);
  const financialBlocker = describeFinancialBlocker(j);
  const coverageBlocker = describeCoverageBlocker(j);
  const operationalBlocker = j.otReturnReason ? `Returned from OT: ${j.otReturnReason}` : null;
  return { location, nextAction, nextActionOwner, financialBlocker, coverageBlocker, operationalBlocker };
}

function describeLocation(j: PatientJourneyRowDto): string {
  const bed = [j.wardName, j.bedNumber].filter(Boolean).join(' · ');
  switch (j.clinicalState) {
    case 'Expected':
      return 'Not yet admitted';
    case 'SentToOT':
      return 'En route to OT';
    case 'InOT':
      return 'In operation theatre';
    case 'Discharged':
      return 'Discharged';
    case 'CancelledSurgery':
    case 'AdmissionCancelled':
      return 'Cancelled';
    default:
      return bed || 'In hospital';
  }
}

/**
 * Descriptive census situation — who / which desk / what needs attention.
 * Not an executable mutation label. Rail primary still uses `resolveRailPrimary`.
 */
function describeNextAction(j: PatientJourneyRowDto): { nextAction: string; nextActionOwner: string } {
  switch (j.clinicalState) {
    case 'Expected':
      return { nextAction: 'Awaiting admission', nextActionOwner: 'Ward' };
    case 'Admitted':
      return { nextAction: 'Needs pre-op', nextActionOwner: 'Ward' };
    case 'ReadyForSurgery':
      return { nextAction: 'Awaiting OT', nextActionOwner: 'Ward' };
    case 'SentToOT':
      return { nextAction: 'Awaiting OT acceptance', nextActionOwner: 'OT' };
    case 'InOT':
      return j.otState === 'InProgress'
        ? { nextAction: 'Surgery in progress', nextActionOwner: 'OT' }
        : { nextAction: 'In OT', nextActionOwner: 'OT' };
    case 'SurgeryCompleted':
      return { nextAction: 'Recovery', nextActionOwner: 'Ward' };
    case 'PostOp':
      return { nextAction: 'Recovery', nextActionOwner: 'Ward' };
    case 'ReadyForDischarge':
      return { nextAction: 'Discharge pending', nextActionOwner: 'Ward' };
    case 'Discharged':
      return { nextAction: 'No further clinical action', nextActionOwner: '—' };
    case 'CancelledSurgery':
      return { nextAction: 'Rebook pending', nextActionOwner: 'Counselling' };
    case 'AdmissionCancelled':
      return { nextAction: 'Closed', nextActionOwner: '—' };
    default:
      return { nextAction: 'Review journey', nextActionOwner: 'Ward' };
  }
}

function formatDueAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function describeFinancialBlocker(j: PatientJourneyRowDto): string | null {
  if (j.isEmergencyFc) return 'Emergency FC — billing still open';
  if ((j.balanceDue ?? 0) > 0) return `Patient dues ${formatDueAmount(j.balanceDue)}`;
  if (j.financialState === 'NotCreated' || j.financialState === 'Draft') return 'Bill not confirmed';
  return null;
}

export type CensusAttentionLevel = 'critical' | 'warning' | 'information';

export interface CensusAttention {
  label: string;
  tone: 'ok' | 'danger' | 'efc' | 'ot' | 'info';
  level: CensusAttentionLevel;
}

/** Single Attention cell — listed blockers only. Absence of blockers is not "ready". */
export function buildCensusAttention(j: PatientJourneyRowDto): CensusAttention {
  const s = buildIpRowSituation(j);
  const items = [s.operationalBlocker, s.financialBlocker, s.coverageBlocker].filter(
    (item): item is string => Boolean(item),
  );
  if (items.length === 0) {
    return { label: 'No listed blockers', tone: 'info', level: 'information' };
  }
  if (items.length > 1) {
    return { label: `${items.length} blockers`, tone: 'danger', level: 'critical' };
  }
  if (s.operationalBlocker && items[0] === s.operationalBlocker) {
    return { label: items[0], tone: 'danger', level: 'critical' };
  }
  if (s.financialBlocker?.includes('Emergency FC')) {
    return { label: 'Emergency FC', tone: 'efc', level: 'warning' };
  }
  if (s.coverageBlocker && items[0] === s.coverageBlocker) {
    return { label: s.coverageBlocker, tone: 'ot', level: 'warning' };
  }
  return { label: items[0], tone: 'danger', level: 'warning' };
}

function describeCoverageBlocker(j: PatientJourneyRowDto): string | null {
  const mode = (j.paymentMode ?? '').toLowerCase();
  if (!mode) return null;
  if (mode.includes('insurance') || mode.includes('tpa') || mode.includes('cghs')) {
    if (j.financialState === 'Draft' || j.financialState === 'Estimated' || j.financialState === 'Confirmed') {
      return 'Coverage / pre-auth pending';
    }
  }
  return null;
}
