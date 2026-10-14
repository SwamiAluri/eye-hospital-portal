import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  getApi: () => ({
    get: getMock,
    post: postMock,
  }),
}));

import { labReportsApi } from '@/lib/api/lab-reports.api';
import { laboratoryCatalogApi } from '@/lib/api/laboratory-catalog.api';

describe('L2 Clinical Catalog — order UX contracts', () => {
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const picker = read('components/laboratory/LaboratoryCatalogPicker.tsx');
  const doctor = read('components/laboratory/DoctorSearchAutosuggest.tsx');
  const workbench = read('components/laboratory/LaboratoryWorkbench.tsx');
  const api = read('lib/api/lab-reports.api.ts');
  const catalogApi = read('lib/api/laboratory-catalog.api.ts');

  it('uses catalog picker and doctor autosuggest — no free-text test code or clinician', () => {
    expect(orderDialog).toContain('LaboratoryCatalogPicker');
    expect(orderDialog).toContain('DoctorSearchAutosuggest');
    expect(orderDialog).toContain('createFromCatalog');
    expect(orderDialog).not.toMatch(/labReportsApi\.create\(/);
    expect(orderDialog).not.toContain('id="lab-order-test-code"');
    expect(orderDialog).not.toContain('id="lab-order-test-name"');
    expect(orderDialog).not.toContain('Ordering clinician (optional)');
    expect(orderDialog).toContain('Clinical indication / reason');
    expect(orderDialog).toContain('Additional notes');
    expect(orderDialog).toContain('orderedById: clinician.id');
    expect(orderDialog).toContain('items: selectedItems.map');
  });

  it('distinguishes Test vs Panel in catalog picker', () => {
    expect(picker).toContain('Laboratory Panels');
    expect(picker).toContain('Laboratory Tests');
    expect(picker).toContain("kind === 'panel'");
    expect(picker).toContain("kind === 'test'");
    expect(picker).toContain('data-testid="laboratory-catalog-empty"');
    expect(picker).toContain('Unable to load laboratory catalog');
  });

  it('Patient-style absolute listbox (z-[100], input combobox)', () => {
    expect(picker).toContain('z-[100]');
    expect(picker).toContain('role="combobox"');
    expect(picker).toContain('role="listbox"');
    expect(picker).not.toContain('PopoverContent');
    expect(doctor).toContain('z-[100]');
    expect(doctor).toContain('role="combobox"');
    expect(doctor).not.toContain('PopoverContent');
  });

  it('ordering clinician uses laboratory catalog endpoint — not users/doctors/search', () => {
    expect(doctor).toContain('searchOrderingClinicians');
    expect(doctor).not.toContain('useDoctorSearch');
    expect(doctor).not.toContain('masterDataApi.searchDoctors');
    expect(doctor).not.toContain('useDoctorSearch');
    expect(catalogApi).toContain('/laboratory/catalog/ordering-clinicians');
    expect(catalogApi).toContain('skipForbiddenRedirect: true');
  });

  it('empty catalog state documents UAT prerequisite path', () => {
    expect(picker).toContain('No active laboratory catalog items');
    expect(picker).toContain('Add catalog test');
  });

  it('populates derived catalog summary (code/category/specimen) without manual typing', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-derived-code"');
    expect(orderDialog).toContain('data-testid="laboratory-order-derived-category"');
    expect(orderDialog).toContain('data-testid="laboratory-order-specimen"');
    expect(orderDialog).toContain('specimenOptions');
    expect(orderDialog).toContain('Select specimen…');
    expect(orderDialog).toContain('data-testid="laboratory-order-selected-items"');
    expect(orderDialog).toContain('role="table"');
  });

  it('requires authoritative clinician and clinical indication', () => {
    expect(orderDialog).toContain('Select an ordering clinician');
    expect(orderDialog).toContain('Clinical indication / reason is required');
    expect(doctor).toContain('searchOrderingClinicians');
    expect(doctor).toContain('Search ordering clinician');
  });

  it('refreshes worklist after catalog order create', () => {
    expect(workbench).toContain('onCreated={onCreated}');
    expect(workbench).toContain('void load()');
    expect(workbench).toContain('testCode');
  });

  it('catalog API routes follow /laboratory/catalog/*', () => {
    expect(catalogApi).toContain('/laboratory/catalog/tests');
    expect(catalogApi).toContain('/laboratory/catalog/panels');
    expect(api).toContain('/lab-reports/catalog-order');
    expect(api).not.toContain('/lab/orders');
  });
});

describe('L2 labReportsApi.createFromCatalog + catalog search', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('createFromCatalog posts catalog IDs only — no free-text test metadata override fields', async () => {
    postMock.mockResolvedValue({
      data: {
        id: 'lab-1',
        testName: 'CBC',
        testCode: 'CBC',
        testCategory: 'hematology',
        status: 'ordered',
      },
    });

    const payload = {
      patientId: 'p1',
      testDefinitionId: 'tdef-1',
      orderedById: 'doc-1',
      clinicalIndication: 'Pre-op',
      specimenType: 'Blood',
      priority: 'routine',
      notes: 'n1',
    };

    await labReportsApi.createFromCatalog(payload);

    expect(postMock).toHaveBeenCalledWith('/lab-reports/catalog-order', payload);
    const sent = postMock.mock.calls[0][1] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('testName');
    expect(sent).not.toHaveProperty('testCode');
    expect(sent).not.toHaveProperty('testCategory');
    expect(sent).toHaveProperty('testDefinitionId', 'tdef-1');
    expect(sent).toHaveProperty('orderedById', 'doc-1');
  });

  it('searchTests uses active-only catalog GET', async () => {
    getMock.mockResolvedValue({ data: [] });
    await laboratoryCatalogApi.searchTests({ search: 'CBC', activeOnly: true, take: 40 });
    expect(getMock).toHaveBeenCalledWith('/laboratory/catalog/tests', {
      params: { search: 'CBC', activeOnly: true, take: 40 },
      skipForbiddenRedirect: true,
    });
  });

  it('searchPanels uses active-only catalog GET', async () => {
    getMock.mockResolvedValue({ data: [] });
    await laboratoryCatalogApi.searchPanels({ search: 'panel', activeOnly: true });
    expect(getMock).toHaveBeenCalledWith('/laboratory/catalog/panels', {
      params: { search: 'panel', activeOnly: true },
      skipForbiddenRedirect: true,
    });
  });
});
