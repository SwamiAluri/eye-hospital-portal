import type { WaitingListFilters } from '@/types/counsellors-desk';

/** Stable query keys for counsellor desk data — shared across pages. */
export const counsellorsDeskKeys = {
  all: ['counsellors-desk'] as const,
  waitingList: (filters?: WaitingListFilters) =>
    [...counsellorsDeskKeys.all, 'waiting-list', filters ?? {}] as const,
  session: (sessionId: string) =>
    [...counsellorsDeskKeys.all, 'session', sessionId] as const,
  masterCatalog: () => [...counsellorsDeskKeys.all, 'master-catalog'] as const,
  serviceCatalog: () => [...counsellorsDeskKeys.all, 'service-catalog'] as const,
  staffDirectory: () => [...counsellorsDeskKeys.all, 'staff-directory'] as const,
  surgeons: () => [...counsellorsDeskKeys.all, 'surgeons'] as const,
  finalizeList: (filters: { date?: string; uhid?: string; name?: string }) =>
    [...counsellorsDeskKeys.all, 'finalize-list', filters] as const,
  activeFollowups: (page: number, pageSize: number) =>
    [...counsellorsDeskKeys.all, 'followups', 'active', page, pageSize] as const,
  coldLeads: (page: number, pageSize: number) =>
    [...counsellorsDeskKeys.all, 'followups', 'cold', page, pageSize] as const,
  postSurgeryFollowups: (page: number, pageSize: number) =>
    [...counsellorsDeskKeys.all, 'followups', 'post-surgery', page, pageSize] as const,
};

export const CATALOG_STALE_MS = 30 * 60 * 1000;
export const SESSION_STALE_MS = 2 * 60 * 1000;
export const LIST_STALE_MS = 60 * 1000;
