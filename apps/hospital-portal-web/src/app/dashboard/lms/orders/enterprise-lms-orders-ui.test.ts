import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import { LMS_ORDERS_PERMISSIONS, LEGACY_LABORATORY_VIEW } from '@/lib/lms/lms-permissions';

const srcRoot = join(__dirname, '../../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('Enterprise LMS L-ORD-01C — Orders UI', () => {
  it('registers orders route and marks capability implemented', () => {
    expect(existsSync(join(srcRoot, 'app/dashboard/lms/orders/page.tsx'))).toBe(true);
    const orders = LMS_CAPABILITIES.find((c) => c.href === '/dashboard/lms/orders');
    expect(orders?.status).toBe('implemented');
  });

  it('page uses OrdersWorkbench instead of LmsCapabilityPage placeholder', () => {
    const page = read('app/dashboard/lms/orders/page.tsx');
    expect(page).toContain('OrdersWorkbench');
    expect(page).not.toContain('LmsCapabilityPage');
  });

  it('workbench covers worklist states and permission gates', () => {
    const wb = read('components/lms/orders/OrdersWorkbench.tsx');
    expect(wb).toContain('listLmsOrders');
    expect(wb).toContain('orders-loading');
    expect(wb).toContain('orders-empty');
    expect(wb).toContain('orders-error');
    expect(wb).toContain('orders-unauthorized');
    expect(wb).toContain('LMS_ORDERS_PERMISSIONS.view');
    expect(wb).toContain('LMS_ORDERS_PERMISSIONS.create');
    expect(wb).toContain('LMS_ORDERS_PERMISSIONS.manage');
    expect(wb).not.toContain(LEGACY_LABORATORY_VIEW);
    expect(wb).not.toContain('laboratory-catalog');
    expect(wb).not.toContain('lab-reports');
  });

  it('composer covers patient, visit optional, providers, source, priority, orderables, draft, submit', () => {
    const c = read('components/lms/orders/OrderComposerDialog.tsx');
    expect(c).toContain('PatientSearchAutosuggest');
    expect(c).toContain('composer-visit');
    expect(c).toContain('OrderProviderPicker');
    expect(c).toContain('ordering-provider');
    expect(c).toContain('responsible-clinician');
    expect(c).toContain('LMS_ORDER_SOURCES');
    expect(c).toContain('LMS_ORDER_PRIORITIES');
    expect(c).toContain('composer-ack');
    expect(c).toContain('OrderablesPicker');
    expect(c).toContain('createLmsOrderDraft');
    expect(c).toContain('updateLmsOrderDraft');
    expect(c).toContain('submitLmsOrder');
    expect(c).toContain('amendLmsOrder');
    expect(c).toContain('newLmsIdempotencyKey');
    expect(c).toContain('expectedRowVersion');
    expect(c).toContain('concurrencyHint');
    expect(c).not.toContain('CollectionTask');
    expect(c).not.toContain('Accession');
    expect(c).not.toContain('createSpecimen');
  });

  it('detail sheet covers version history, amend, cancel, submit, read-only submitted tests', () => {
    const d = read('components/lms/orders/OrderDetailSheet.tsx');
    expect(d).toContain('order-version-history');
    expect(d).toContain('detail-tests');
    expect(d).toContain('detail-amend');
    expect(d).toContain('detail-cancel');
    expect(d).toContain('detail-submit');
    expect(d).toContain('cancelLmsOrder');
    expect(d).toContain('getLmsOrderVersions');
    expect(d).toContain('This order was changed by another action');
  });

  it('API client uses LaboratoryApi order/orderables endpoints only', () => {
    const api = read('lib/lms/lms-orders.api.ts');
    expect(api).toContain('/lms/orders');
    expect(api).toContain('/lms/catalogue/orderables');
    expect(api).toContain('parseLmsOrderApiError');
    expect(api).toContain('audit_unavailable');
    expect(api).toContain('concurrency_conflict');
    expect(api).not.toContain('/laboratory/catalog');
    expect(api).not.toContain('/lab-reports');
    expect(api).not.toContain('CollectionTask');
    expect(api).not.toContain('Specimen');
  });

  it('orderables picker does not use Pathology catalogue', () => {
    const p = read('components/lms/orders/OrderablesPicker.tsx');
    expect(p).toContain('listLmsOrderables');
    expect(p).not.toContain('laboratory-catalog');
    expect(p).not.toContain(LEGACY_LABORATORY_VIEW);
  });

  it('provider picker does not use Doctor string heuristic or pathology ordering-clinicians', () => {
    const p = read('components/lms/orders/OrderProviderPicker.tsx');
    expect(p).toContain('usersApi');
    expect(p).not.toContain('Contains("Doctor")');
    expect(p).not.toContain('ordering-clinicians');
    expect(p).not.toContain('doctors/search');
  });

  it('does not introduce Collection/Specimen leakage in orders UI tree', () => {
    const files = [
      'components/lms/orders/OrdersWorkbench.tsx',
      'components/lms/orders/OrderComposerDialog.tsx',
      'components/lms/orders/OrderDetailSheet.tsx',
      'components/lms/orders/OrderablesPicker.tsx',
      'lib/lms/lms-orders.api.ts',
    ];
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/CollectionTask/);
      expect(src).not.toMatch(/\bAccession\b/);
      expect(src).not.toMatch(/\bBarcode\b/);
      expect(src).not.toMatch(/createSpecimen|SpecimenCustody|Receiving|Triage/);
    }
  });

  it('orders permission codes remain distinct', () => {
    expect(LMS_ORDERS_PERMISSIONS.view).toBe('lms.orders.view');
    expect(LMS_ORDERS_PERMISSIONS.create).toBe('lms.orders.create');
    expect(LMS_ORDERS_PERMISSIONS.manage).toBe('lms.orders.manage');
    expect(LMS_ORDERS_PERMISSIONS.view).not.toBe(LEGACY_LABORATORY_VIEW);
  });
});
