import type { WaitingListPatient } from '@/types/counsellors-desk';

export interface WaitingListClientFilterInput {
  patients: WaitingListPatient[];
  /** Immediate type chip selection — client-side only (no Apply / no API). */
  type: 'All' | 'Procedure' | 'Surgery';
  activeTab: string;
  quickSearch: string;
  /** Expanded panel filters after Apply (name / MRD). */
  patientName: string;
  mrd: string;
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

  const q = input.quickSearch.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        p.uhid.toLowerCase().includes(q) ||
        p.surgeryName.toLowerCase().includes(q) ||
        p.doctor.toLowerCase().includes(q),
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
