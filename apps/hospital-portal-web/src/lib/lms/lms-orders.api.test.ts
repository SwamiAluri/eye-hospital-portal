import { describe, expect, it } from 'vitest';
import {
  newLmsIdempotencyKey,
  parseLmsOrderApiError,
  priorityRequiresReason,
  validateOrderComposerClient,
} from '@/lib/lms/lms-orders.api';

describe('lms-orders.api helpers', () => {
  it('requires priority reason for Urgent and STAT only', () => {
    expect(priorityRequiresReason('Routine')).toBe(false);
    expect(priorityRequiresReason('Urgent')).toBe(true);
    expect(priorityRequiresReason('STAT')).toBe(true);
  });

  it('validates composer fields including SelfRequested acknowledgement', () => {
    const base = {
      patientId: 'p1',
      orderingProviderUserId: 'o1',
      responsibleClinicianUserId: 'r1',
      operatingBranchId: 'b1',
      orderSource: 'Clinician',
      priority: 'Routine',
      clinicalIndication: 'Anemia',
      selections: [{ catalogueItemId: 'c1' }],
    };
    expect(validateOrderComposerClient(base)).toBeNull();
    expect(validateOrderComposerClient({ ...base, selections: [] })).toMatch(/test or panel/i);
    expect(validateOrderComposerClient({ ...base, priority: 'STAT' })).toMatch(/reason/i);
    expect(
      validateOrderComposerClient({
        ...base,
        orderSource: 'SelfRequested',
        acknowledgementEvidence: '',
      }),
    ).toMatch(/Acknowledgement/i);
  });

  it('maps concurrency, audit, permission, and network errors', () => {
    expect(
      parseLmsOrderApiError({
        response: { status: 409, data: { error: 'stale', code: 'concurrency_conflict' } },
      }).isConcurrencyConflict,
    ).toBe(true);
    expect(
      parseLmsOrderApiError({
        response: { status: 503, data: { error: 'audit down', code: 'audit_unavailable' } },
      }).isAuditUnavailable,
    ).toBe(true);
    expect(
      parseLmsOrderApiError({ response: { status: 403, data: { error: 'denied' } } })
        .isPermissionDenied,
    ).toBe(true);
    expect(parseLmsOrderApiError({ code: 'ERR_NETWORK', message: 'Network Error' }).message).toMatch(
      /Network/i,
    );
  });

  it('generates stable-format idempotency keys and reuses same logical key pattern', () => {
    const a = newLmsIdempotencyKey();
    const b = newLmsIdempotencyKey();
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toEqual(b);
  });
});
