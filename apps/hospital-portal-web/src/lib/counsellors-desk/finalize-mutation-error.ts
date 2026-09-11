import { getApiErrorMessage } from '@/lib/auth-interceptors';

/**
 * Operator-facing mutation error for Waiting List / Finalize actions (WL-03).
 * Prefers API message over generic Axios status text.
 */
export function finalizeMutationErrorMessage(
  error: unknown,
  fallback = 'Action failed',
): string {
  const msg = getApiErrorMessage(error, fallback);
  if (msg.startsWith('Request failed with status code')) return fallback;
  return msg || fallback;
}
