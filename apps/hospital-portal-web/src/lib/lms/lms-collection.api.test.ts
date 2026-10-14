import { describe, expect, it } from 'vitest';
import {
  newLmsIdempotencyKey,
  parseLmsCollectionApiError,
} from '@/lib/lms/lms-collection.api';

describe('lms-collection.api helpers', () => {
  it('maps concurrency, audit, permission, and network errors', () => {
    expect(
      parseLmsCollectionApiError({
        response: { status: 409, data: { error: 'stale', code: 'concurrency_conflict' } },
      }).isConcurrencyConflict,
    ).toBe(true);
    expect(
      parseLmsCollectionApiError({
        response: { status: 503, data: { error: 'audit down', code: 'audit_unavailable' } },
      }).isAuditUnavailable,
    ).toBe(true);
    expect(
      parseLmsCollectionApiError({ response: { status: 403, data: { error: 'denied' } } })
        .isPermissionDenied,
    ).toBe(true);
    expect(
      parseLmsCollectionApiError({ code: 'ERR_NETWORK', message: 'Network Error' }).message,
    ).toMatch(/Network/i);
  });

  it('generates distinct idempotency keys', () => {
    const a = newLmsIdempotencyKey();
    const b = newLmsIdempotencyKey();
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toEqual(b);
  });
});
