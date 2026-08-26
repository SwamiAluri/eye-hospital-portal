import { describe, expect, it } from 'vitest';
import { normalizeJourneyAuditLog } from './ip-management.api';

describe('normalizeJourneyAuditLog', () => {
  it('maps backend camelCase audit fields onto UI aliases', () => {
    const log = normalizeJourneyAuditLog({
      id: 'a1',
      action: 'ClinicalStateChanged',
      oldValue: 'Admitted',
      newValue: 'ReadyForSurgery',
      performedAt: '2026-08-24T08:00:00Z',
      performedByUserId: 'u1',
      reason: 'Ready',
      correlationId: 'j1',
      previousState: '{"ClinicalState":"Admitted"}',
      newState: '{"ClinicalState":"ReadyForSurgery"}',
    }, 'j1');

    expect(log.fieldChanged).toBe('ClinicalStateChanged');
    expect(log.changedAt).toBe('2026-08-24T08:00:00Z');
    expect(log.reason).toBe('Ready');
    expect(log.correlationId).toBe('j1');
    expect(log.previousState).toContain('Admitted');
  });
});

describe('ipManagementApi.transitionFinancial', () => {
  it('throws locally and does not POST Paid/Settled', async () => {
    const { ipManagementApi } = await import('./ip-management.api');
    await expect(
      ipManagementApi.transitionFinancial('00000000-0000-0000-0000-000000000001', {
        newState: 'Paid',
      }),
    ).rejects.toThrow(/Billing/);
  });
});
