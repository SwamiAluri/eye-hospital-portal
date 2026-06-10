'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { optometryQueueApi } from '@/lib/api/optometry.api';
import { useRoutingReasons } from '@/hooks/use-operations-master';
import { useQueueConnection } from '@/hooks/useQueueConnection';
import {
  optometryQueueKeys,
  OPTOMETRY_LIST_STALE_MS,
  OPTOMETRY_STATS_STALE_MS,
  OPTOMETRY_POLL_MS,
} from '@/lib/optometry/optometry-query-keys';

export { optometryQueueKeys } from '@/lib/optometry/optometry-query-keys';

export interface RoutingReason {
  code: string;
  label: string;
}

export function useOptometryQueueQuery(
  branchId?: string,
  includeCompletedToday = true,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: optometryQueueKeys.queue(branchId ?? '', includeCompletedToday),
    queryFn: () => optometryQueueApi.getQueue(branchId!, includeCompletedToday),
    enabled: !!branchId && (options?.enabled ?? true),
    staleTime: OPTOMETRY_LIST_STALE_MS,
    refetchInterval: options?.refetchInterval,
  });
}

export function useOptometryStatsQuery(
  branchId?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: optometryQueueKeys.stats(branchId ?? ''),
    queryFn: () => optometryQueueApi.getStats(branchId!),
    enabled: !!branchId && (options?.enabled ?? true),
    staleTime: OPTOMETRY_STATS_STALE_MS,
    refetchInterval: options?.refetchInterval,
  });
}

export function useOptometryServiceRoomsQuery(branchId?: string) {
  return useQuery({
    queryKey: optometryQueueKeys.rooms(branchId ?? ''),
    queryFn: () => optometryQueueApi.getServiceRooms(branchId!),
    enabled: !!branchId,
    staleTime: 30 * 60 * 1000,
  });
}

/** Routing reasons from `operations.routing_reason` master data. */
export function useRoutingReasonsQuery() {
  const { reasons, loading, error, refetch } = useRoutingReasons();
  return {
    data: reasons,
    isLoading: loading,
    error: error ? new Error('Failed to load routing reasons') : null,
    refetch,
  };
}

export function useInvalidateOptometryQueue() {
  const queryClient = useQueryClient();

  return useCallback(
    (branchId?: string) => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: optometryQueueKeys.queue(branchId) });
        queryClient.invalidateQueries({ queryKey: optometryQueueKeys.stats(branchId) });
      } else {
        queryClient.invalidateQueries({ queryKey: optometryQueueKeys.all });
      }
    },
    [queryClient],
  );
}

/** Subscribe to branch-level SignalR updates; falls back to slow polling when disconnected. */
export function useOptometryQueueRealtime(branchId?: string, pollWhenDisconnected = true) {
  const invalidate = useInvalidateOptometryQueue();
  const isOptometryUpdate = useCallback((payload: Record<string, unknown>) => {
    const queueType = String(payload.queueType ?? payload.QueueType ?? '');
    return !queueType || queueType.toLowerCase() === 'optometry';
  }, []);

  const { isConnected, isConnecting, error } = useQueueConnection({
    branchId,
    autoConnect: !!branchId,
    onQueueUpdate: (update) => {
      const payload = (update?.data ?? update) as Record<string, unknown>;
      if (isOptometryUpdate(payload)) {
        invalidate(branchId);
      }
    },
  });

  const pollInterval: number | false =
    pollWhenDisconnected && !!branchId && !isConnected && !isConnecting
      ? OPTOMETRY_POLL_MS
      : false;

  return { isConnected, isConnecting, error, pollInterval };
}
