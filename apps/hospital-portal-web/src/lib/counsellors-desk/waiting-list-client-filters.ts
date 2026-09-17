import { resolveOwnershipRelation } from '@/lib/counsellors-desk/counselling-ownership';
import type { WaitingListPatient } from '@/types/counsellors-desk';

/** Client-only convenience Owner filter — does not change shared-queue API visibility. */
export type WaitingListOwnerFilter = 'All' | 'Mine' | 'Unassigned' | 'Other';

export interface WaitingListClientFilterInput {
  patients: WaitingListPatient[];
  /** Immediate type chip selection — client-side only (no Apply / no API). */
  type: 'All' | 'Procedure' | 'Surgery';
  activeTab: string;
  quickSearch: string;
  /** Expanded panel filters after Apply (name / MRD). */
  patientName: string;
  mrd: string;
  /** Convenience owner scope — client-side only; never sent to waiting-list API. */
  ownerFilter?: WaitingListOwnerFilter;
  currentUserId?: string | null;
  isPreAuthQueueRow: (p: WaitingListPatient) => boolean;
}

/**
 * Client-side Waiting List filtering: type is immediate; status/search/name/MRD compose with it.
 * Pre-Auth Queue uses the shared awaiting rule via `isPreAuthQueueRow` (do not redefine here).
 */
export function applyWaitingListClientFilters(
  input: WaitingListClientFilterInput,
): WaitingListPatient[] {
  let list = input.patients;

  if (input.activeTab === 'PreAuthQueue') {
    list = list.filter(input.isPreAuthQueueRow);
  } else if (input.activeTab !== 'All' && input.activeTab !== 'OtReturned') {
    list = list.filter((p) => p.status === input.activeTab);
  }

  if (input.type !== 'All') {
    list = list.filter((p) => p.type === input.type);
  }

  const ownerFilter = input.ownerFilter ?? 'All';
  if (ownerFilter !== 'All') {
    list = list.filter((p) => {
      const relation = resolveOwnershipRelation(p.counselorId, input.currentUserId);
      if (ownerFilter === 'Mine') return relation === 'current';
      if (ownerFilter === 'Unassigned') return relation === 'unassigned';
      return relation === 'other';
    });
  }

  const q = input.quickSearch.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        p.uhid.toLowerCase().includes(q) ||
        p.surgeryName.toLowerCase().includes(q) ||
        p.doctor.toLowerCase().includes(q) ||
        (p.counselorName?.toLowerCase().includes(q) ?? false),
    );
  }

  if (input.patientName.trim()) {
    const name = input.patientName.trim().toLowerCase();
    list = list.filter((p) => p.patientName.toLowerCase().includes(name));
  }

  if (input.mrd.trim()) {
    const mrd = input.mrd.trim().toLowerCase();
    list = list.filter((p) => p.uhid.toLowerCase().includes(mrd));
  }

  return list;
}
