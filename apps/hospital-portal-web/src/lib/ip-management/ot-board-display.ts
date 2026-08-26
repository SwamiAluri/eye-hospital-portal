import type { PreOpStatus } from './preop-status';
import { clinicalBadgeLabel } from './ip-target-badges';
import { operativeEyeDisplay } from './operative-eye-display';
import { formatOtState } from './ip-row-situation';
import { censusAgeSex, tidyClinicalText } from './ip-census-display';

export const otAgeSex = censusAgeSex;

export function otSeqLabel(j: {
  slotLabel?: string | null;
  slotSequenceNo?: number | null;
  slotSession?: string | null;
}): string {
  if (j.slotLabel?.trim()) return j.slotLabel.trim();
  if (j.slotSession && j.slotSequenceNo != null) {
    const prefix = j.slotSession === 'Morning' ? 'AM' : j.slotSession === 'Afternoon' ? 'PM' : j.slotSession;
    return `${prefix}-${j.slotSequenceNo}`;
  }
  if (j.slotSequenceNo != null) return String(j.slotSequenceNo);
  return '—';
}

export function otLaterality(eye: string | null | undefined): { text: string; missing: boolean } {
  const display = operativeEyeDisplay(eye);
  if (display.kind === 'eye') return { text: `${display.word} ${display.code}`, missing: false };
  return { text: 'Eye not set', missing: true };
}

export function otProcedureLine(procedureName: string | null | undefined): string {
  return tidyClinicalText(procedureName);
}

/** Clinical chip on the OT board — Accepted overlays SentToOT when otState is Accepted. */
export function otClinicalChip(
  clinicalState: string | null | undefined,
  otState: string | null | undefined,
): { status: PreOpStatus; label: string } {
  if (clinicalState === 'SentToOT' && otState === 'Accepted') {
    return { status: 'in-progress', label: 'Accepted in OT' };
  }
  const label = clinicalBadgeLabel(clinicalState);
  switch (clinicalState) {
    case 'SentToOT':
      return { status: 'pending-verification', label };
    case 'InOT':
      return { status: 'pending-verification', label };
    case 'SurgeryCompleted':
      return { status: 'completed', label };
    case 'PostOp':
      return { status: 'in-progress', label };
    default:
      return { status: 'not-started', label };
  }
}

export function otStateChip(otState: string | null | undefined): {
  status: PreOpStatus;
  label: string;
} {
  const label = formatOtState(otState);
  if (!otState || otState === 'NotSent') return { status: 'not-started', label };
  if (otState === 'SentToOT') return { status: 'pending-verification', label };
  if (otState === 'Accepted') return { status: 'in-progress', label };
  if (otState === 'InProgress') return { status: 'pending-verification', label };
  if (otState === 'Completed') return { status: 'completed', label };
  return { status: 'in-progress', label };
}

/**
 * Operational financial projection only. Never "Authorized" / "Approved".
 * Null or unknown is a missing projection, not clearance.
 */
export function otFinancialChip(financialState: string | null | undefined): {
  status: PreOpStatus;
  label: string;
} {
  if (!financialState?.trim()) {
    return { status: 'not-started', label: 'No financial projection' };
  }
  const labels: Record<string, string> = {
    NotCreated: 'Bill not created',
    Draft: 'Bill draft',
    Estimated: 'Estimated',
    Confirmed: 'Bill confirmed',
    PartiallyPaid: 'Partially collected',
    Paid: 'Collected',
    Settled: 'Settled',
  };
  const label = labels[financialState] ?? financialState.replace(/([A-Z])/g, ' $1').trim();
  if (/authori[sz]|approved|eligible/i.test(label)) {
    return { status: 'needs-info', label: 'Financial projection unavailable' };
  }
  if (financialState === 'Paid' || financialState === 'Settled' || financialState === 'Confirmed') {
    return { status: 'completed', label };
  }
  if (financialState === 'PartiallyPaid' || financialState === 'Estimated') {
    return { status: 'in-progress', label };
  }
  return { status: 'not-started', label };
}

export function otCoverageProjection(paymentMode: string | null | undefined): string | null {
  const mode = (paymentMode ?? '').trim();
  if (!mode) return null;
  return mode;
}

export function sortOtBoardRows<T extends {
  slotSequenceNo?: number | null;
  slotLabel?: string | null;
  surgeryScheduledAt?: string | null;
}>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aSeq = a.slotSequenceNo ?? Number.MAX_SAFE_INTEGER;
    const bSeq = b.slotSequenceNo ?? Number.MAX_SAFE_INTEGER;
    if (aSeq !== bSeq) return aSeq - bSeq;
    const label = (a.slotLabel ?? '').localeCompare(b.slotLabel ?? '');
    if (label !== 0) return label;
    return (a.surgeryScheduledAt ?? '').localeCompare(b.surgeryScheduledAt ?? '');
  });
}
