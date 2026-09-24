/**
 * Package 1 — Finalize Surgery KPI helpers (PD-FS-01 / PD-FS-02).
 * Needs Attention predicate is locked: NotConfirmed + Confirmed only.
 */
import type { FinalizeStatus } from '@/types/counsellors-desk';

/** Product Decision PD-FS-01 Option A — honest label for NotConfirmed|Confirmed. */
export const NEEDS_ATTENTION_KPI_LABEL = 'Awaiting Finalise';

export function isNeedsAttentionStatus(status: FinalizeStatus | string | undefined | null): boolean {
  return status === 'NotConfirmed' || status === 'Confirmed';
}

export function countNeedsAttention(
  records: Array<{ status?: FinalizeStatus | string | null }>,
): number {
  return records.filter((r) => isNeedsAttentionStatus(r.status)).length;
}

/** PD-FS-03 — Reporting Time required for Confirm (non-empty HH:MM-ish string). */
export function isReportingTimePresent(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Basic validity: HH:MM or HH:MM:SS with hour 0–23 and minute 0–59. */
export function isReportingTimeValid(value: string | undefined | null): boolean {
  if (!isReportingTimePresent(value)) return false;
  const m = value!.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] != null ? Number(m[3]) : 0;
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 && sec >= 0 && sec <= 59;
}

export function isCancelReasonPresent(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
