'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queueDisplayApi, type QueueDisplayParams } from '@/lib/api/queue-display.api';
import { useQueueConnection } from '@/hooks/useQueueConnection';

export const queueDisplayKeys = {
  all: ['queue-display'] as const,
  branch: (params: QueueDisplayParams) => [...queueDisplayKeys.all, 'branch', params] as const,
};

export function useQueueDisplayQuery(params: QueueDisplayParams | null, enabled = true, pollWhenDisconnected = false) {
  return useQuery({
    queryKey: queueDisplayKeys.branch(params ?? { branchId: '' }),
    queryFn: () => queueDisplayApi.getBranchDisplay(params!),
    enabled: enabled && !!params?.branchId,
    staleTime: 15_000,
    retry: 1,
    refetchInterval: pollWhenDisconnected ? 30_000 : false,
  });
}

export function useQueueDisplayRealtime(branchId?: string, onUpdate?: () => void) {
  useQueueConnection({
    branchId,
    autoConnect: !!branchId,
    onQueueUpdate: () => onUpdate?.(),
  });

  // Also listen for QueueDisplayUpdated via connection - extend useQueueConnection if needed
  // For S1, branch QueueUpdate invalidates via parent hook
}

export function useInvalidateQueueDisplay() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queueDisplayKeys.all });
  }, [queryClient]);
}
