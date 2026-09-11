import type { WaitingListFilters } from '@/types/counsellors-desk';

export type FollowupQueryFilters = {
  branchId?: string | null;
  q?: string;
  intention?: string | null;
  page: number;
  pageSize: number;
};

export type FollowupStatsQueryFilters = {
  branchId?: string | null;
  q?: string;
  intention?: string | null;
};

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
  followups: () => [...counsellorsDeskKeys.all, 'followups'] as const,
  activeFollowups: (filters: FollowupQueryFilters) =>
    [
      ...counsellorsDeskKeys.followups(),
      'active',
      filters.branchId ?? '',
      filters.q ?? '',
      filters.intention ?? '',
      filters.page,
      filters.pageSize,
    ] as const,
  coldLeads: (filters: FollowupQueryFilters) =>
    [
      ...counsellorsDeskKeys.followups(),
      'cold',
      filters.branchId ?? '',
      filters.q ?? '',
      filters.page,
      filters.pageSize,
    ] as const,
  postSurgeryFollowups: (filters: FollowupQueryFilters) =>
    [
      ...counsellorsDeskKeys.followups(),
      'post-surgery',
      filters.branchId ?? '',
      filters.q ?? '',
      filters.page,
      filters.pageSize,
    ] as const,
  followupStats: (filters: FollowupStatsQueryFilters) =>
    [
      ...counsellorsDeskKeys.followups(),
      'stats',
      filters.branchId ?? '',
      filters.q ?? '',
      filters.intention ?? '',
    ] as const,
};

export const CATALOG_STALE_MS = 30 * 60 * 1000;
export const SESSION_STALE_MS = 2 * 60 * 1000;
export const LIST_STALE_MS = 60 * 1000;
