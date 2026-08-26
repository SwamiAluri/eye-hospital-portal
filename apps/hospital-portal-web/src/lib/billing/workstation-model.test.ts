import { describe, expect, it } from 'vitest';
import type { OpdBill } from '@/lib/api/opd-billing.api';
import {
  buildWorkstationContext,
  packageInclusionLabel,
  pickBillForPatient,
  pickJourneyForPatient,
  shouldRetainReadyBill,
  sumAdvanceFromPayments,
  summarizeWorkstation,
} from './workstation-model';

function bill(overrides: Partial<OpdBill> = {}): OpdBill {
  return {
    id: 'b1',
    tenantId: 't',
    patientId: 'p1',
    appointmentId: 'a1',
    branchId: 'br',
    billNumber: 'IPD-1',
    billDate: '2026-08-20T09:00:00Z',
    consultationFee: 0,
    registrationFee: 0,
    additionalCharges: 0,
    grossAmount: 100000,
    discountPercentage: 0,
    discountAmount: 2000,
    taxAmount: 0,
    netAmount: 98000,
    amountPaid: 20000,
    balanceDue: 78000,
    status: 'partial',
    isFreeVisit: false,
    isCredit: false,
    isInsurance: true,
    insuranceProvider: 'Star Health',
    insuranceClaimAmount: 0,
    patientName: 'Meena Iyer',
    patientMrn: 'UAT-002',
    generatedBy: 'e2e',
    payments: [],
    isFinalized: false,
    createdAt: '2026-08-20T09:00:00Z',
    ...overrides,
  };
}

describe('summarizeWorkstation', () => {
  it('uses OpdBill amounts as the financial source of truth', () => {
    const summary = summarizeWorkstation(bill(), {
      packageAmount: 100000,
      ipSummary: { billedAmount: 1, totalCollected: 1, balanceDue: 1, advances: 5000 },
    });
    expect(summary.charges).toBe(98000);
    expect(summary.paid).toBe(20000);
    expect(summary.due).toBe(78000);
    expect(summary.adjustments).toBe(2000);
    expect(summary.packageAmount).toBe(100000);
    expect(summary.payerShare).toBe(0);
    expect(summary.patientShare).toBeNull();
  });

  it('reads payer and patient share from the IP financial summary, not client math', () => {
    const summary = summarizeWorkstation(bill(), {
      ipSummary: { insuranceResponsibility: 80000, patientResponsibility: 18000 },
    });
    expect(summary.charges).toBe(98000);
    expect(summary.due).toBe(78000);
    expect(summary.payerShare).toBe(80000);
    expect(summary.patientShare).toBe(18000);
  });

  it('sums Advance only when paymentKind is present on the ledger', () => {
    expect(sumAdvanceFromPayments(undefined)).toBeNull();
    expect(sumAdvanceFromPayments([{ amount: 5000 } as never])).toBeNull();
    expect(
      sumAdvanceFromPayments([
        { amount: 15000, paymentKind: 'Advance' } as never,
        { amount: 5000, paymentKind: 'Payment' } as never,
      ]),
    ).toBe(15000);
  });
});

describe('buildWorkstationContext', () => {
  it('prefers journey identity for IP encounters', () => {
    const ctx = buildWorkstationContext({
      bill: bill({ patientJourneyId: 'j1' }),
      journey: {
        id: 'j1',
        patientId: 'p1',
        uhid: 'UAT-002',
        patientName: 'Meena Iyer',
        patientAge: 58,
        patientGender: 'F',
        procedureName: 'Phaco + IOL',
        eyeOperated: 'OD',
        surgeonName: 'Dr Rao',
        admittedAt: '2026-08-20T08:00:00Z',
        paymentMode: 'Insurance',
        packageAmount: 100000,
        financialState: 'PartiallyPaid',
      } as never,
    });
    expect(ctx.encounterKind).toBe('ip');
    expect(ctx.uhid).toBe('UAT-002');
    expect(ctx.procedureName).toBe('Phaco + IOL');
    expect(ctx.laterality).toBe('OD');
    expect(ctx.payerMode).toBe('Insurance');
  });

  it('falls back to the OpdBill for OPD-only bills', () => {
    const ctx = buildWorkstationContext({ bill: bill({ isInsurance: false, insuranceProvider: undefined }) });
    expect(ctx.encounterKind).toBe('opd');
    expect(ctx.patientName).toBe('Meena Iyer');
    expect(ctx.payerMode).toBe('Self-pay');
  });
});

describe('pickBillForPatient', () => {
  it('prefers the latest IP-linked open bill', () => {
    const picked = pickBillForPatient([
      bill({ id: 'old-ip', patientJourneyId: 'j1', billDate: '2026-01-01T00:00:00Z' }),
      bill({ id: 'new-opd', billDate: '2026-08-01T00:00:00Z' }),
      bill({ id: 'new-ip', patientJourneyId: 'j2', billDate: '2026-08-20T00:00:00Z' }),
      bill({ id: 'cancelled', status: 'cancelled', patientJourneyId: 'j3', billDate: '2026-08-25T00:00:00Z' }),
    ]);
    expect(picked?.id).toBe('new-ip');
  });
});

describe('pickJourneyForPatient', () => {
  it('never opens another patient\'s journey when UHID search is ambiguous', () => {
    expect(
      pickJourneyForPatient(
        [
          { id: 'j-other', patientId: 'someone-else' },
          { id: 'j-self', patientId: 'p1' },
        ],
        'p1',
      )?.id,
    ).toBe('j-self');
    expect(pickJourneyForPatient([{ id: 'j-other', patientId: 'someone-else' }], 'p1')).toBeNull();
  });
});

describe('shouldRetainReadyBill', () => {
  it('keeps the workstation only for the same bill identity', () => {
    expect(shouldRetainReadyBill({
      currentBillId: 'b1',
      currentJourneyId: 'j1',
      linkBillId: 'b1',
    })).toBe(true);
    expect(shouldRetainReadyBill({
      currentBillId: 'b1',
      currentJourneyId: 'j1',
      linkBillId: 'b2',
    })).toBe(false);
  });
});

describe('packageInclusionLabel', () => {
  it('maps existing sourceType without inventing a package flag', () => {
    expect(packageInclusionLabel('Package')).toBe('Package');
    expect(packageInclusionLabel('PackageDiscount')).toBe('Package');
    expect(packageInclusionLabel('Implant')).toBe('Extra');
    expect(packageInclusionLabel(null)).toBe('Extra');
  });
});
