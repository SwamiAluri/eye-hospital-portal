'use client';

import { useQuery } from '@tanstack/react-query';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import { ipRealtimeQueryKeys } from '@/lib/ip-management/ip-realtime-events';

/** Short enough that a just-cleared step is not shown as blocked after returning to census. */
export const TRANSITION_GATES_STALE_MS = 8_000;

export function useTransitionGatesQuery(
  journeyId: string | undefined,
  newState: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ipRealtimeQueryKeys.transitionGates(journeyId ?? '', newState ?? ''),
    enabled: Boolean(journeyId) && Boolean(newState) && enabled,
    staleTime: TRANSITION_GATES_STALE_MS,
    retry: 1,
    queryFn: async () => {
      const dto = await ipManagementApi.getTransitionGates(journeyId!, newState!);
      if (!dto) throw new Error('Could not verify readiness.');
      return dto;
    },
  });
}
