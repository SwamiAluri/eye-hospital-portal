/**
 * OT mutation responses. Azure Functions WriteError is `{ error }`, intended as
 * 4xx/409. This host may still deliver HTTP 200, so OT clients must not treat
 * that body as a successful journey mutation.
 */

export function otMutationConcurrencyMessage(message: string): boolean {
  return /updated by another user/i.test(message);
}

export function requireOtJourneyMutationResult<T extends { id?: unknown; clinicalState?: unknown }>(
  data: unknown,
  fallback: string,
): T {
  if (!data || typeof data !== 'object') {
    throw otMutationError(fallback);
  }
  const rec = data as Record<string, unknown>;
  const errorText = typeof rec.error === 'string' ? rec.error.trim() : '';
  const hasJourney = typeof rec.id === 'string' && typeof rec.clinicalState === 'string';

  if (errorText && !hasJourney) {
    throw otMutationError(errorText, otMutationConcurrencyMessage(errorText));
  }
  if (!hasJourney) {
    throw otMutationError(fallback);
  }
  return data as T;
}

export function otMutationError(message: string, concurrencyConflict = false): Error & { concurrencyConflict: boolean } {
  const err = new Error(message) as Error & { concurrencyConflict: boolean };
  err.concurrencyConflict = concurrencyConflict;
  return err;
}

export function isOtMutationConflict(e: unknown): boolean {
  if (e && typeof e === 'object' && 'concurrencyConflict' in e && (e as { concurrencyConflict?: boolean }).concurrencyConflict) {
    return true;
  }
  return e instanceof Error && otMutationConcurrencyMessage(e.message);
}
