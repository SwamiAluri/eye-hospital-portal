/**
 * Phase 3I — CounselingSession.Version authority for in-session mutations.
 *
 * React `session.version` state updates are asynchronous. After Start / Save Draft succeed,
 * an immediate Complete (or second Save) can still close over the pre-mutation Version and
 * produce a false 409. Keep a synchronously updated ref as the expected Version for writes.
 */

/** Prefer the sync ref; fall back to session state only when the ref is unset. */
export function resolveMutationVersion(
  refVersion: number | undefined,
  sessionVersion: number | undefined,
): number | undefined {
  if (typeof refVersion === 'number') return refVersion;
  if (typeof sessionVersion === 'number') return sessionVersion;
  return undefined;
}

/**
 * After a successful Save, Complete must use the response Version — never the Version that
 * was sent on the Save request. If the response omits Version, do not invent a bump.
 */
export function resolveVersionAfterSave(options: {
  responseVersion: number | undefined;
  requestVersion: number | undefined;
}): number | undefined {
  if (typeof options.responseVersion === 'number') return options.responseVersion;
  return options.requestVersion;
}
