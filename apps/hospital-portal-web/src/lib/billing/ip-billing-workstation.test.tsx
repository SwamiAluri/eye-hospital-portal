import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IpBillingWorkstation } from '@/components/billing/IpBillingWorkstation';
import type { OpdBill } from '@/lib/api/opd-billing.api';
import { WORKSTATION_TEST_IDS } from '@/lib/billing/workstation-model';

const bill = {
  id: 'bill-1',
  tenantId: 't',
  patientId: 'p1',
  appointmentId: 'a1',
  branchId: 'br',
  billNumber: 'IPD-2026-00841',
  billDate: '2026-08-20T09:00:00Z',
  consultationFee: 0,
  registrationFee: 0,
  additionalCharges: 0,
  grossAmount: 100000,
  discountPercentage: 0,
  discountAmount: 0,
  taxAmount: 0,
  netAmount: 100000,
  amountPaid: 20000,
  balanceDue: 80000,
  status: 'partial',
  isFreeVisit: false,
  isCredit: false,
  isInsurance: true,
  insuranceProvider: 'Star Health',
  insuranceClaimAmount: 0,
  patientName: 'Meena Iyer',
  patientMrn: 'UAT-002',
  patientJourneyId: 'j1',
  generatedBy: 'e2e',
  isFinalized: false,
  createdAt: '2026-08-20T09:00:00Z',
  payments: [
    {
      id: 'pay-1',
      opdBillId: 'bill-1',
      paymentReference: 'REF-1',
      paymentMode: 'cash',
      amount: 20000,
      paymentDate: '2026-08-20T10:00:00Z',
      receiptNumber: 'RCP-ADV-1',
      paymentKind: 'Advance',
      status: 'completed',
      createdAt: '2026-08-20T10:00:00Z',
    },
  ],
} as OpdBill;

describe('IpBillingWorkstation', () => {
  it('renders patient context, ledger summary, payment history, and collect as next action', () => {
    const html = renderToStaticMarkup(
      <IpBillingWorkstation
        bill={bill}
        journey={{
          id: 'j1',
          uhid: 'UAT-002',
          patientName: 'Meena Iyer',
          patientAge: 58,
          patientGender: 'F',
          procedureName: 'Phaco + IOL',
          eyeOperated: 'OD',
          surgeonName: 'Dr Rao',
          packageAmount: 100000,
          financialState: 'PartiallyPaid',
          paymentMode: 'Insurance',
        } as never}
        ipSummary={{
          insuranceResponsibility: 80000,
          patientResponsibility: 18000,
        }}
        completeness={{
          implantsRecorded: 1,
          implantsCharged: 0,
          implantsMissingCharge: 1,
          consumablesPending: 1,
          warnings: ['1 consumable is unmapped and not charged'],
        }}
        items={[
          {
            id: 'c1',
            serviceName: 'Phaco surgery',
            quantity: 1,
            unitPrice: 62000,
            totalAmount: 62000,
            sourceType: 'Package',
            status: 'posted',
          },
        ]}
        itemsLoading={false}
        canCollect
        canUpdateBill
        onCollect={() => undefined}
        onAddItem={() => undefined}
        onDiscount={() => undefined}
        onPrint={() => undefined}
      />,
    );

    expect(html).toContain(WORKSTATION_TEST_IDS.root);
    expect(html).toContain(WORKSTATION_TEST_IDS.context);
    expect(html).toContain(WORKSTATION_TEST_IDS.summary);
    expect(html).toContain(WORKSTATION_TEST_IDS.charges);
    expect(html).toContain(WORKSTATION_TEST_IDS.payments);
    expect(html).toContain(WORKSTATION_TEST_IDS.status);
    expect(html).toContain('ip-billing-refunds');
    expect(html).not.toContain('Request refund');
    expect(html).toContain('Meena Iyer');
    expect(html).toContain('UAT-002');
    expect(html).toContain('Phaco + IOL');
    expect(html).toContain('RCP-ADV-1');
    expect(html).toContain('Advance');
    expect(html).toContain('billing-opd-collect');
    expect(html).toContain('Collect payment');
    expect(html).toContain('Add item');
    expect(html).toContain('Discount');
    expect(html).toContain('Charge mapping');
    expect(html).toContain('Payer share');
    expect(html).not.toContain('billId');
  });

  it('hides add item and discount without bill.update', () => {
    const html = renderToStaticMarkup(
      <IpBillingWorkstation
        bill={bill}
        items={[]}
        itemsLoading={false}
        canCollect={false}
        canUpdateBill={false}
        onCollect={() => undefined}
        onAddItem={() => undefined}
        onDiscount={() => undefined}
        onPrint={() => undefined}
      />,
    );
    expect(html).not.toContain('ip-billing-add-item');
    expect(html).not.toContain('ip-billing-discount');
  });

  it('shows authorize and complete on the workstation, not a refund queue', () => {
    const html = renderToStaticMarkup(
      <IpBillingWorkstation
        bill={bill}
        items={[]}
        itemsLoading={false}
        canCollect
        canRefund
        canAuthorizeRefund
        refunds={[
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            billId: bill.id,
            refundAmount: 500,
            refundReason: 'Duplicate payment',
            refundMode: 'cash',
            status: 'pending',
            requestedAt: '2026-08-26T12:00:00Z',
          },
        ]}
        onCollect={() => undefined}
        onPrint={() => undefined}
        onRequestRefund={() => undefined}
        onApproveRefund={() => undefined}
        onRejectRefund={() => undefined}
        onCompleteRefund={() => undefined}
      />,
    );
    expect(html).toContain('Request refund');
    expect(html).toContain('ip-billing-refund-authorize');
    expect(html).toContain('Pending authorization');
    expect(html).not.toContain('/dashboard/cashier');
  });
});
