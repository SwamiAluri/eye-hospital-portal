import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

const postMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  getApi: () => ({
    get: vi.fn(),
    post: postMock,
  }),
}));

import { labReportsApi } from '@/lib/api/lab-reports.api';

describe('L2 UAT correction — order composer contracts', () => {
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const picker = read('components/laboratory/LaboratoryCatalogPicker.tsx');
  const doctor = read('components/laboratory/DoctorSearchAutosuggest.tsx');
  const api = read('lib/api/lab-reports.api.ts');

  it('uses multi-test order composer with selected items list', () => {
    expect(orderDialog).toContain('Order New Laboratory Tests');
    expect(orderDialog).toContain('selectedItems');
    expect(orderDialog).toContain('data-testid="laboratory-order-selected-items"');
    expect(orderDialog).toContain('data-testid="laboratory-order-selected-count"');
    expect(orderDialog).toContain('excludeKeys');
    expect(orderDialog).toContain('loadOnOpen');
    expect(orderDialog).toContain('items: selectedItems.map');
    expect(orderDialog).toContain('role="table"');
  });

  it('shows selected patient state distinctly from empty search', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-patient-selected"');
    expect(orderDialog).toContain('data-testid="laboratory-order-patient-clear"');
    expect(orderDialog).toContain('data-testid="laboratory-order-patient-context"');
  });

  it('catalog picker loads on open and filters excluded selections', () => {
    expect(picker).toContain('loadOnOpen');
    expect(picker).toContain('excludeKeys');
    expect(picker).toContain('Search or select laboratory test/panel');
    expect(picker).toContain('activeOnly: true');
  });

  it('ordering clinician loads eligible options when opened', () => {
    expect(doctor).toContain('searchOrderingClinicians');
    expect(doctor).toContain('const search = trimmed.length >= 2 ? trimmed : undefined');
    expect(doctor).not.toContain('useDoctorSearch');
  });

  it('priority defaults to routine with approved vocabulary', () => {
    expect(orderDialog).toContain("useState('routine')");
    expect(orderDialog).toContain('LAB_REPORT_PRIORITIES');
    expect(orderDialog).toContain('LAB_REPORT_PRIORITY_LABELS');
  });

  it('preserves clinical indication as free-text (no fabricated catalog)', () => {
    expect(orderDialog).toContain('laboratory-order-indication');
    expect(orderDialog).not.toContain('clinicalIndicationsApi');
    expect(orderDialog).not.toContain('Routine screening');
  });

  it('API supports items[] multi-test payload', () => {
    expect(api).toContain('items?: Array<{ testDefinitionId?: string; panelId?: string }>');
    expect(api).toContain('/lab-reports/catalog-order');
  });
});

describe('L2 UAT correction — createFromCatalog multi-item payload', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('posts one catalog-order with items array', async () => {
    postMock.mockResolvedValue({
      data: { id: 'lab-multi', testName: 'CBC + Lipid', status: 'ordered', items: [] },
    });

    const payload = {
      patientId: 'p1',
      items: [
        { testDefinitionId: 'tdef-cbc' },
        { testDefinitionId: 'tdef-lipid' },
      ],
      orderedById: 'doc-1',
      clinicalIndication: 'Pre-op',
      priority: 'routine',
    };

    await labReportsApi.createFromCatalog(payload);
    expect(postMock).toHaveBeenCalledWith('/lab-reports/catalog-order', payload);
    const sent = postMock.mock.calls[0][1] as Record<string, unknown>;
    expect(sent.items).toHaveLength(2);
    expect(sent).not.toHaveProperty('testName');
  });
});
