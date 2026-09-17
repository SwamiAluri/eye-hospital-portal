import { describe, expect, it } from 'vitest';
import { BUCKET_COPY, canViewChargeReconciliation, completenessWarning, localDateToUtcRange, reconciliationCsv } from './charge-reconciliation';

describe('charge-reconciliation helpers', () => {
  it('gates the report on bill.reconciliation.view (not broad bill.view)', () => {
    expect(canViewChargeReconciliation(undefined)).toBe(false);
    expect(canViewChargeReconciliation([])).toBe(false);
    expect(canViewChargeReconciliation(['bill.update'])).toBe(false);
    expect(canViewChargeReconciliation(['bill.view'])).toBe(false);
    expect(canViewChargeReconciliation(['bill.admin'])).toBe(false);
    expect(canViewChargeReconciliation(['bill.reconciliation.view'])).toBe(true);
    expect(canViewChargeReconciliation(['*'])).toBe(true);
  });

  it('formats the pre-finalize warning from recorded vs missing', () => {
    expect(completenessWarning(2, 1)).toBe('2 implants recorded, 1 charge missing');
    expect(completenessWarning(2, 0)).toBeNull();
  });

  it('has copy for every exception bucket', () => {
    expect(BUCKET_COPY[1]).toMatch(/revenue leakage/i);
    expect(BUCKET_COPY[4]).toMatch(/Double-charge/i);
    expect(BUCKET_COPY[5]).toMatch(/variant/i);
  });

  it('builds a CSV of every exception bucket', () => {
    const csv = reconciliationCsv({
      implantedNotCharged: [{
        patientName: 'Amit Verma',
        billNumber: 'IPD-1',
        itemName: 'SN60WF',
        serialNumber: '88213',
        amount: 14000,
        reason: 'Outbox not yet posted',
        occurredAt: '2026-08-25T08:00:00Z',
      }],
      chargedNotImplanted: [],
      stockOutNoUsage: [],
      packageConsumableOverlap: [],
      unmappedItems: [{
        patientName: null,
        billNumber: null,
        itemName: 'Unmapped item',
        serialNumber: null,
        amount: 0,
        reason: '1 open exception(s)',
        occurredAt: '2026-08-25T09:00:00Z',
      }],
    });
    expect(csv).toContain('Implanted, not charged');
    expect(csv).toContain('Amit Verma');
    expect(csv).toContain('Unmapped items');
  });

  it('converts local dates to an exclusive UTC window', () => {
    expect(localDateToUtcRange('2026-08-01', '2026-08-31')).toEqual({
      fromUtc: '2026-08-01T00:00:00.000Z',
      toUtc: '2026-09-01T00:00:00.000Z',
    });
  });
});
