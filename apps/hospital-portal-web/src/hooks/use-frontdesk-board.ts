'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { frontdeskApi, type FrontdeskBoardPayload } from '@/lib/api/frontdesk.api';

export function localDateIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const frontdeskBoardKeys = {
  all: ['frontdesk-board'] as const,
  branch: (branchId: string, date: string) => [...frontdeskBoardKeys.all, branchId, date] as const,
};

const FALLBACK_POLL_MS = 120_000;

export function useFrontdeskBoardQuery(
  branchId?: string,
  enabled = true,
  pollWhenDisconnected = false,
) {
  const date = useMemo(() => localDateIso(), []);

  return useQuery({
    queryKey: frontdeskBoardKeys.branch(branchId ?? '', date),
    queryFn: () => frontdeskApi.getBoard(branchId!, date),
    enabled: enabled && !!branchId,
    staleTime: 15_000,
    retry: 1,
    refetchInterval: pollWhenDisconnected ? FALLBACK_POLL_MS : false,
    placeholderData: (prev: FrontdeskBoardPayload | undefined) => prev,
  });
}

export function useInvalidateFrontdeskBoard() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: frontdeskBoardKeys.all });
  }, [queryClient]);
}
