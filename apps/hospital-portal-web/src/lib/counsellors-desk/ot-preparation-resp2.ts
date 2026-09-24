import type { FinalizeSurgeryRecord, PrepareOtListItem } from '@/types/counsellors-desk';
import { isValidPrepareOtSurgeryDate } from './prepare-ot-date-scope';

function dayKey(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const day = raw.trim().slice(0, 10);
  return isValidPrepareOtSurgeryDate(day) ? day : null;
}

/** Eligible for OT Prep selection: Finalised only (RESP2 — no invented blockers). */
export function isEligibleFinalisedForOtPrep(rec: FinalizeSurgeryRecord): boolean {
  return rec.status === 'Finalised';
}

export function filterFinalisedForOtPrepWorklist(
  records: FinalizeSurgeryRecord[],
  filters: { date?: string; uhid?: string; name?: string },
): FinalizeSurgeryRecord[] {
  const date = dayKey(filters.date) ?? '';
  const uhid = (filters.uhid ?? '').trim().toLowerCase();
  const name = (filters.name ?? '').trim().toLowerCase();

  return records.filter((r) => {
    if (!isEligibleFinalisedForOtPrep(r)) return false;
    if (date) {
      const rd = dayKey(r.scheduleDate) ?? '';
      if (rd !== date) return false;
    }
    if (uhid && !(r.uhid ?? '').toLowerCase().includes(uhid)) return false;
    if (name && !(r.patientName ?? '').toLowerCase().includes(name)) return false;
    return true;
  });
}

/** Distinct ScheduleDate values among selected rows (yyyy-MM-dd). */
export function collectDistinctScheduleDates(
  records: FinalizeSurgeryRecord[],
  selectedIds: ReadonlySet<string> | string[],
): string[] {
  const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const dates = new Set<string>();
  for (const r of records) {
    if (!idSet.has(r.id)) continue;
    const d = dayKey(r.scheduleDate);
    if (d) dates.add(d);
  }
  return [...dates].sort();
}

export function resolveSinglePrepareScheduleDate(
  records: FinalizeSurgeryRecord[],
  selectedIds: ReadonlySet<string> | string[],
): { ok: true; date: string } | { ok: false; reason: 'empty' | 'mixed' | 'missing_date' } {
  const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  if (idSet.size === 0) return { ok: false, reason: 'empty' };

  const selected = records.filter((r) => idSet.has(r.id));
  if (selected.length === 0) return { ok: false, reason: 'empty' };

  const dates = collectDistinctScheduleDates(selected, idSet);
  if (dates.length === 0) return { ok: false, reason: 'missing_date' };
  if (dates.length > 1) return { ok: false, reason: 'mixed' };
  return { ok: true, date: dates[0] };
}

/**
 * Highest SequenceNo among OTPrepared rows for ScheduleDate D.
 * Null/absent treated as 0 for continuation math (RESP2-10).
 */
export function highestOtPreparedSequenceForDate(
  records: FinalizeSurgeryRecord[],
  scheduleDate: string,
): number {
  const day = dayKey(scheduleDate);
  if (!day) return 0;
  let max = 0;
  for (const r of records) {
    if (r.status !== 'OTPrepared') continue;
    if ((dayKey(r.scheduleDate) ?? '') !== day) continue;
    const seq = typeof r.sequenceNo === 'number' && Number.isFinite(r.sequenceNo) ? r.sequenceNo : 0;
    if (seq > max) max = seq;
  }
  return max;
}

/**
 * Build Prepare items for selected rows in existing worklist order.
 * Sequences continue from highestExisting (RESP2-10). No click-order.
 */
export function buildContinuedPrepareItems(
  orderedSelected: FinalizeSurgeryRecord[],
  highestExistingSequence: number,
): PrepareOtListItem[] {
  const base = Math.max(0, highestExistingSequence);
  return orderedSelected.map((r, i) => ({
    scheduleId: r.id,
    sequence: base + i + 1,
  }));
}

/** Selected IDs that remain visible on the current page (reconcile after page/filter change). */
export function reconcileSelectionToVisible(
  selectedIds: ReadonlySet<string>,
  visibleIds: ReadonlyArray<string>,
): Set<string> {
  const visible = new Set(visibleIds);
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (visible.has(id)) next.add(id);
  }
  return next;
}

/** Select-all-visible: eligible Finalised rows on the current page only. */
export function selectAllVisibleIds(visibleEligible: FinalizeSurgeryRecord[]): Set<string> {
  return new Set(visibleEligible.filter(isEligibleFinalisedForOtPrep).map((r) => r.id));
}

/** Preserve worklist order when collecting selected rows for Prepare. */
export function selectedRecordsInWorklistOrder(
  worklistOrdered: FinalizeSurgeryRecord[],
  selectedIds: ReadonlySet<string>,
): FinalizeSurgeryRecord[] {
  return worklistOrdered.filter((r) => selectedIds.has(r.id) && isEligibleFinalisedForOtPrep(r));
}
