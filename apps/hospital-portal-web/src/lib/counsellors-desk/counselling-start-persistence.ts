import type { WaitingListStatus } from '@/types/counsellors-desk';

/**
 * After Auth StartSession, Waiting List / header status must be Processing (Processed).
 * If the queue remained Waiting, getSession still maps to Pending — treat as failed start.
 */
export function assertCounsellingStartReachedProcessing(
  status: WaitingListStatus | string | null | undefined,
): asserts status is 'Processed' {
  if (status !== 'Processed') {
    throw new Error(
      'Counselling start did not persist Processing status. Refresh and try Start Counseling again.',
    );
  }
}
