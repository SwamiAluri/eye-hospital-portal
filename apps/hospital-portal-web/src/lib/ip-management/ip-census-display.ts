import type { PreOpStatus } from './preop-status';
import { clinicalBadgeLabel } from './ip-target-badges';
import { operativeEyeDisplay } from './operative-eye-display';
import { formatOtState } from './ip-row-situation';

/** Repair UTF-8 read as Latin-1 (e.g. "â€" for an em dash) in clinical names. */
export function tidyClinicalText(value: string | null | undefined, empty = '—'): string {
  if (!value || !value.trim()) return empty;
  return value
    .replace(/â€[“”–—]?/g, '—')
    .replace(/\u00e2\u20ac./g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

export function censusAgeSex(
  dob: string | null | undefined,
  ageOverride: number | null | undefined,
  gender: string | null | undefined,
): string {
  let age = '—';
  if (ageOverride !== null && ageOverride !== undefined) age = `${ageOverride}y`;
  else if (dob) {
    age = `${Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365))}y`;
  }
  const sex = (gender ?? '').trim();
  const sexShort = /^m(ale)?$/i.test(sex) ? 'M' : /^f(emale)?$/i.test(sex) ? 'F' : (sex[0]?.toUpperCase() || '');
  return [age, sexShort].filter(Boolean).join(' · ');
}

export function censusClinicalChip(state: string | null | undefined): {
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

export function censusOtChip(otState: string | null | undefined): {
  status: PreOpStatus;
  label: string;
} {
  const label = formatOtState(otState);
  if (!otState || otState === 'NotSent') {
    return { status: 'not-started', label };
  }
  const lower = otState.toLowerCase();
  if (/cancel|abort/.test(lower)) return { status: 'rejected', label };
  if (/complete|done|out/.test(lower)) return { status: 'completed', label };
  if (/progress|in ot|timeout|time out/.test(lower)) {
    return { status: 'pending-verification', label };
  }
  return { status: 'in-progress', label };
}

export function censusProcedureLine(procedureName: string | null | undefined, eyeOperated: string | null | undefined): {
  procedure: string;
  laterality: string | null;
  lateralityMissing: boolean;
} {
  const procedure = tidyClinicalText(procedureName);
  const eye = operativeEyeDisplay(eyeOperated);
  if (eye.kind === 'eye') {
    return { procedure, laterality: `${eye.word} ${eye.code}`, lateralityMissing: false };
  }
  return { procedure, laterality: null, lateralityMissing: true };
}

export function formatCensusSlot(label: string | null | undefined): { text: string; unassigned: boolean } {
  if (!label?.trim()) return { text: 'Unassigned', unassigned: true };
  return { text: label.trim(), unassigned: false };
}

export function formatCensusAdmitted(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
