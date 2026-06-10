/** Stable React Query keys for the live optometry queue. */
export const optometryQueueKeys = {
  all: ['optometry-queue'] as const,
  queue: (branchId: string, includeCompletedToday = true) =>
    [...optometryQueueKeys.all, 'list', branchId, includeCompletedToday] as const,
  stats: (branchId: string) =>
    [...optometryQueueKeys.all, 'stats', branchId] as const,
  rooms: (branchId: string) =>
    [...optometryQueueKeys.all, 'rooms', branchId] as const,
  routingReasons: () =>
    [...optometryQueueKeys.all, 'routing-reasons'] as const,
};

export const OPTOMETRY_LIST_STALE_MS = 15_000;
export const OPTOMETRY_STATS_STALE_MS = 15_000;
export const OPTOMETRY_POLL_MS = 60_000;
