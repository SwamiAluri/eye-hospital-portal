import { describe, expect, it } from 'vitest';
import type { OpdBill } from '@/lib/api/opd-billing.api';
import { collectJourneyFromOpdBill, finSummaryFromOpdBill } from './opd-collect-context';

const bill = {
  id: 'bill-1',
  billNumber: 'OPD-1',
  patientId: 'pat-1',
  patientName: 'Meena Iyer',
  patientMrn: 'UAT-002',
  netAmount: 120000,
  amountPaid: 30000,
  balanceDue: 10000,
  insuranceClaimAmount: 80000,
  isFinalized: false,
  isInsurance: true,
} as OpdBill;

describe('opd-collect-context', () => {
  it('maps ledger amounts so CollectPaymentDrawer can collect without a census journey', () => {
    const summary = finSummaryFromOpdBill(bill);
    expect(summary?.opdBillId).toBe('bill-1');
    expect(summary?.patientBalance).toBe(10000);
    expect(summary?.billedAmount).toBe(120000);
    expect(summary?.isFinalized).toBe(false);
  });

  it('does not treat TPA-inclusive balanceDue as collectible patient due', () => {
    const copay = {
      ...bill,
      netAmount: 105000,
      amountPaid: 0,
      balanceDue: 105000,
      insuranceClaimAmount: 90000,
      patientJourneyId: 'journey-106',
    } as OpdBill;
    const summary = finSummaryFromOpdBill(copay);
    expect(summary?.balanceDue).toBe(105000);
    expect(summary?.patientBalance).toBe(15000);
    expect(summary?.patientResponsibility).toBe(15000);
  });

  it('after patient copay is collected, remaining patient due is 0 not ledger TPA remainder', () => {
    const collected = {
      ...bill,
      netAmount: 105000,
      amountPaid: 15000,
      balanceDue: 90000,
      insuranceClaimAmount: 90000,
      patientJourneyId: 'journey-106',
    } as OpdBill;
    expect(finSummaryFromOpdBill(collected)?.patientBalance).toBe(0);
  });

  it('prefers live IP patientBalance over billed-minus-ICA', () => {
    const copay = {
      ...bill,
      netAmount: 105000,
      amountPaid: 0,
      balanceDue: 105000,
      insuranceClaimAmount: 80000,
      patientJourneyId: 'journey-106',
    } as OpdBill;
    const summary = finSummaryFromOpdBill(copay, { patientBalance: 15000, patientResponsibility: 15000 });
    expect(summary?.patientBalance).toBe(15000);
  });

  it('cash OPD without coverage still uses ledger remaining as patient due', () => {
    const cash = {
      ...bill,
      netAmount: 500,
      amountPaid: 0,
      balanceDue: 500,
      insuranceClaimAmount: 0,
      isInsurance: false,
    } as OpdBill;
    expect(finSummaryFromOpdBill(cash)?.patientBalance).toBe(500);
  });

  it('never uses a fake journey id that would call ip-ensure (callers pass canCreateBill false)', () => {
    const journey = collectJourneyFromOpdBill(bill);
    expect(journey.financialState).toBe('PartiallyPaid');
    expect(journey.patientName).toBe('Meena Iyer');
    expect(journey.uhid).toBe('UAT-002');
  });
});
