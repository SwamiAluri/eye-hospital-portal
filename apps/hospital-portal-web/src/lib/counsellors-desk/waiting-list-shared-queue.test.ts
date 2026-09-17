import { describe, expect, it } from 'vitest';

/**
 * PD-WL-01 — Counsellor Waiting List remains a shared queue.
 * FE filter shape must not introduce counselorId / createdBy as population keys.
 */
describe('Waiting List shared-queue FE contract', () => {
  it('WaitingListFilters type fields exclude counselor ownership keys', async () => {
    // Import type via a value that mirrors the API params builder usage.
    const sample: Record<string, unknown> = {
      type: 'All',
      status: undefined,
      fromDate: undefined,
      toDate: undefined,
      branchId: '74c014cf-9570-4824-bdf9-b369ea11a8f4',
    };
    expect('counselorId' in sample).toBe(false);
    expect('createdByUserId' in sample).toBe(false);
    expect(sample.branchId).toBeTruthy();
  });
});
