import { describe, expect, it } from 'vitest';
import {
  classifySettlementError,
  mapSettlement,
  settlementEmptyMessage,
  settlementUnauthorizedMessage,
  settlementUnavailableMessage,
} from '@/lib/patients/patient-360-settlements';

describe('patient 360 settlement reads', () => {
  it('maps stored settlement fields and drops bank, notes, and line items', () => {
    const row = mapSettlement({
      id: 's1',
      settlementNumber: 'STL-1',
      settlementType: 'partial',
      caseNumber: 'CC-1',
      claimNumber: 'CLM-1',
      settledAmount: 4000,
      claimAmount: 5000,
      outstandingAmount: 1000,
      paymentMode: 'NEFT',
      paymentReference: 'UTR-1',
      paymentDate: '2026-09-02',
      settledAt: '2026-09-02T10:15:00',
      reconciliationStatus: 'pending',
      createdAt: '2026-09-02T10:15:00',
      bankReference: 'secret-bank',
      reconciliationNotes: 'secret-note',
      lineItems: [{ disallowedReason: 'secret-line' }],
      coverageCase_Id: 'case-guid',
    });
    expect(row).toEqual({
      id: 's1',
      settlementNumber: 'STL-1',
      settlementType: 'partial',
      caseNumber: 'CC-1',
      claimNumber: 'CLM-1',
      settledAmount: '₹4000.00',
      claimAmount: '₹5000.00',
      paymentMode: 'NEFT',
      paymentReference: 'UTR-1',
      paymentDate: '2026-09-02',
      settledAt: '2026-09-02',
      reconciliationStatus: 'pending',
      createdAt: '2026-09-02',
    });
    expect(JSON.stringify(row)).not.toMatch(/secret-bank|secret-note|secret-line|case-guid|outstanding/i);
    expect(classifySettlementError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifySettlementError({ response: { status: 500 } })).toBe('unavailable');
    expect(settlementEmptyMessage()).toBe('No settlement records found.');
    expect(settlementUnauthorizedMessage()).not.toBe(settlementEmptyMessage());
    expect(settlementUnavailableMessage()).not.toBe(settlementEmptyMessage());
  });
});
