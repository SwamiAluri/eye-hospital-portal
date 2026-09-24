/**
 * Phase 3I Slice 7 (PD-S7-06) — frontend concurrency helpers for CounselingSession Version conflicts.
 *
 * Backend contract: 409 = optimistic concurrency conflict (stale/missing expected Version, or an
 * ownership CAS miss on Assign/Claim/Reassign). 403 = authorization/ownership ACL — handled by
 * existing `skipForbiddenRedirect` / ownership copy and must stay distinct from this helper.
 *
 * On a 409: stop the mutation, surface this message, and let the caller refetch/invalidate the
 * session. Never auto-retry and never silently overwrite local state with the stale payload.
 */

/** Canonical Slice 7 stale-session copy (PD-S7-06). */
export const STALE_SESSION_MESSAGE =
  'This session was updated by another user. Refresh to continue.';

interface ApiErrorLike {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
}

function getResponse(error: unknown): ApiErrorLike['response'] | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as ApiErrorLike).response;
  }
  return undefined;
}

/** True only for HTTP 409 — Version/ownership concurrency conflicts. Never true for 403 (authz). */
export function isSessionConcurrencyConflict(error: unknown): boolean {
  return getResponse(error)?.status === 409;
}

/**
 * Prefers the backend's own conflict message (e.g. a distinct ownership-conflict copy) and falls
 * back to the canonical Slice 7 stale-session message when the server did not send one.
 */
export function getSessionConcurrencyMessage(error: unknown): string {
  const serverMessage = getResponse(error)?.data?.message;
  if (serverMessage && serverMessage.trim()) {
    return serverMessage.trim();
  }
  return STALE_SESSION_MESSAGE;
}
