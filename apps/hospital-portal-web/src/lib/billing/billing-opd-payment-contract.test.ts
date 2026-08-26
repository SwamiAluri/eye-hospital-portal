import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(__dirname, '../..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe('B1 billing payment contract', () => {
  it('OPD desk reuses CollectPaymentDrawer and does not post billId', () => {
    const page = readFileSync(
      join(srcRoot, 'app/dashboard/billing/opd/page.tsx'),
      'utf8',
    );
    expect(page).toContain('CollectPaymentDrawer');
    expect(page).toContain('IpBillingWorkstation');
    expect(page).toContain('PatientSearchCombobox');
    expect(page).toContain('initialKind="Payment"');
    expect(page).toContain('AddBillItemDialog');
    expect(page).toContain('ApplyDiscountDialog');
    expect(page).not.toContain('opdBillingApi.addPayment');
    expect(page).not.toContain('handlePayment');
    expect(page).toContain('opdBillId: selectedBill.id');
    expect(page).not.toMatch(/billId:\s*selectedBill/);
    expect(page).toContain('buildRequestRefundRequest');
    expect(page).toContain('opdBillId: billToRefund.id');
    expect(page).not.toMatch(/billId:\s*billToRefund/);
  });

  it('create form no longer mounts PaymentDialog as a parallel collect path', () => {
    const form = readFileSync(join(srcRoot, 'components/billing/OpdBillForm.tsx'), 'utf8');
    expect(form).not.toContain('PaymentDialog');
    expect(form).toContain('/dashboard/billing/opd');
  });

  it('Census and Ward discharge keep the Advance default (do not pass initialKind)', () => {
    const census = readFileSync(join(srcRoot, 'components/ip-management/PatientQuickPanel.tsx'), 'utf8');
    const ward = readFileSync(
      join(srcRoot, 'components/ip-management/WardDischargeWorkspaceModal.tsx'),
      'utf8',
    );
    expect(census).toContain('CollectPaymentDrawer');
    expect(ward).toContain('CollectPaymentDrawer');
    expect(census).not.toContain('initialKind');
    expect(ward).not.toContain('initialKind');
  });

  it('refunds client uses Auth /{id} routes and the bill collection path', () => {
    const src = readFileSync(join(srcRoot, 'lib/api/refunds.api.ts'), 'utf8');
    expect(src).toContain('buildRequestRefundRequest');
    expect(src).toContain('buildAuthorizeRefundPath');
    expect(src).toContain('buildCompleteRefundPath');
    expect(src).toContain('refundsByBillPath');
    expect(src).not.toContain("'/refunds/authorize'");
    expect(src).not.toContain("'/refunds/complete'");
    expect(src).not.toContain('/refunds/by-bill/');
  });

  it('OT board does not mutate OpdBill or collect payments', () => {
    const otPage = readFileSync(
      join(srcRoot, 'app/dashboard/ip-management/operation-theatre/page.tsx'),
      'utf8',
    );
    expect(otPage).not.toContain('addPayment');
    expect(otPage).not.toContain('CollectPaymentDrawer');
    expect(otPage).not.toContain('opdBillingApi');
  });

  it('every browser addPayment call goes through buildAddPaymentRequest', () => {
    const allowedSuffixes = [
      'lib/api/opd-billing.api.ts',
      'lib/billing/billing-opd-payment-contract.test.ts',
    ];
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      const normalised = file.replace(/\\/g, '/');
      if (allowedSuffixes.some(s => normalised.endsWith(s))) continue;
      const src = readFileSync(file, 'utf8');
      if (!src.includes('addPayment(') && !src.includes('.addPayment')) continue;
      if (!src.includes('buildAddPaymentRequest')) {
        offenders.push(normalised.slice(srcRoot.replace(/\\/g, '/').length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
