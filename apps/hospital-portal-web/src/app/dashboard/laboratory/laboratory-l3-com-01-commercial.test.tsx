import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  getApi: () => ({
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock,
  }),
}));

import { laboratoryCatalogApi } from '@/lib/api/laboratory-catalog.api';

describe('L3-COM-01 Laboratory commercial mapping foundation', () => {
  const admin = read('components/laboratory/LaboratoryCatalogAdminDialog.tsx');
  const workbench = read('components/laboratory/LaboratoryWorkbench.tsx');
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const catalogApi = read('lib/api/laboratory-catalog.api.ts');
  const picker = read('components/laboratory/LaboratoryCatalogPicker.tsx');

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  it('renders commercial states and ServiceVariant in catalog admin', () => {
    expect(admin).toContain('commercialState');
    expect(admin).toContain('MAPPED');
    expect(admin).toContain('UNMAPPED');
    expect(admin).toContain('NON_BILLABLE');
    expect(admin).toContain('UNPRICED');
    expect(admin).toContain('data-testid="laboratory-commercial-state"');
    expect(admin).toContain('data-testid="laboratory-commercial-variant"');
    expect(admin).toContain('laboratory-catalog-commercial-table');
  });

  it('provides map / unmap / non-billable actions with contradiction guards', () => {
    expect(admin).toContain('laboratory-commercial-map');
    expect(admin).toContain('laboratory-commercial-unmap');
    expect(admin).toContain('laboratory-commercial-nonbillable');
    expect(admin).toContain('Clear non-billable before mapping');
    expect(admin).toContain('Unmap the ServiceVariant before marking non-billable');
    expect(admin).toContain('laboratory-service-variant-select');
  });

  it('reuses catalog admin permission surface (patient.update) and does not call bill.admin', () => {
    expect(workbench).toContain("useHasPermission('patient.update')");
    expect(catalogApi).toContain('/laboratory/catalog/service-variants');
    expect(catalogApi).not.toContain('/ChargeMapping');
    expect(catalogApi).not.toContain('bill.admin');
  });

  it('API client exposes commercial map/unmap/non-billable and omits charge posting', () => {
    expect(catalogApi).toContain('commercial/map');
    expect(catalogApi).toContain('commercial/non-billable');
    expect(catalogApi).toContain('getCommercialState');
    expect(catalogApi).not.toContain('opdBill');
    expect(catalogApi).not.toContain('createCharge');
    expect(admin).toContain('does not create bills or charges');
  });

  it('mapping selector validates selection before map', () => {
    expect(admin).toContain('Select an active ServiceVariant before mapping');
    expect(admin).toContain('!selectedVariantId');
  });

  it('existing catalog search/filter still present', () => {
    expect(admin).toContain('laboratory-catalog-commercial-search');
    expect(admin).toContain('searchTests');
    expect(picker).toContain('Laboratory Tests');
    expect(picker).toContain('searchTests');
  });

  it('Order Composer remains L2-intact (picker + create; mapping stays in catalog admin)', () => {
    // L3-UX-01 adds Order Summary Sheet; L3-COM-01 mapping mutations stay out of the composer.
    expect(orderDialog).not.toContain('commercial/map');
    expect(orderDialog).not.toContain('patientPayable');
    expect(orderDialog).toContain('LaboratoryCatalogPicker');
    expect(orderDialog).toContain('createFromCatalog');
  });

  it('client calls map and unmap endpoints', async () => {
    putMock.mockResolvedValue({
      data: {
        testDefinitionId: 't1',
        commercialState: 'MAPPED',
        financiallyActionable: true,
      },
    });
    deleteMock.mockResolvedValue({
      data: {
        testDefinitionId: 't1',
        commercialState: 'UNMAPPED',
        financiallyActionable: false,
      },
    });

    await laboratoryCatalogApi.mapServiceVariant('t1', 'sv1');
    await laboratoryCatalogApi.unmapServiceVariant('t1');
    await laboratoryCatalogApi.setNonBillable('t1', true);

    expect(putMock).toHaveBeenCalledWith(
      '/laboratory/catalog/tests/t1/commercial/map',
      { serviceVariantId: 'sv1' },
      expect.objectContaining({ skipForbiddenRedirect: true }),
    );
    expect(deleteMock).toHaveBeenCalledWith(
      '/laboratory/catalog/tests/t1/commercial/map',
      expect.objectContaining({ skipForbiddenRedirect: true }),
    );
    expect(putMock).toHaveBeenCalledWith(
      '/laboratory/catalog/tests/t1/commercial/non-billable',
      { isNonBillable: true },
      expect.objectContaining({ skipForbiddenRedirect: true }),
    );
  });
});
