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

describe('L3-UX-01 Laboratory Order Summary / Estimate (integrated panel)', () => {
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const summaryPanel = read('components/laboratory/LaboratoryOrderSummaryPanel.tsx');
  const catalogApi = read('lib/api/laboratory-catalog.api.ts');
  const picker = read('components/laboratory/LaboratoryCatalogPicker.tsx');

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  it('uses integrated two-column workspace — not a separate Summary Sheet overlay', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-workspace"');
    expect(orderDialog).toContain('data-layout="two-column-summary"');
    expect(orderDialog).toContain('LaboratoryOrderSummaryPanel');
    expect(orderDialog).toContain('lg:flex-row');
    expect(orderDialog).toContain('lg:basis-[62%]');
    expect(orderDialog).toContain('lg:basis-[38%]');
    expect(orderDialog).not.toContain('LaboratoryOrderSummarySheet');
    expect(orderDialog).not.toContain('laboratory-order-summary-open');
    expect(orderDialog).not.toContain("from '@/components/ui/sheet'");
    expect(summaryPanel).toContain('data-testid="laboratory-order-summary-panel"');
    expect(summaryPanel).not.toContain('SheetContent');
    expect(summaryPanel).not.toContain("from '@/components/ui/sheet'");
  });

  it('keeps L2 Composer functional (picker + createFromCatalog + selected table)', () => {
    expect(orderDialog).toContain('LaboratoryCatalogPicker');
    expect(orderDialog).toContain('createFromCatalog');
    expect(orderDialog).toContain('data-testid="laboratory-order-selected-items"');
    expect(orderDialog).toContain('data-testid="laboratory-order-submit"');
    expect(orderDialog).toContain('Cancel');
    expect(picker).toContain('searchTests');
  });

  it('renders selected tests distinctly with commercial states', () => {
    expect(summaryPanel).toContain('data-testid="laboratory-order-summary-lines"');
    expect(summaryPanel).toContain('laboratory-order-summary-line-');
    expect(summaryPanel).toContain('data-testid="laboratory-order-summary-commercial-state"');
    expect(summaryPanel).toContain('MAPPED');
    expect(summaryPanel).toContain('UNMAPPED');
    expect(summaryPanel).toContain('NON_BILLABLE');
    expect(summaryPanel).toContain('UNPRICED');
    expect(summaryPanel).toContain('data-commercial-state');
    expect(summaryPanel).toContain('laboratory-order-summary-overview-card');
    expect(summaryPanel).toContain('laboratory-order-summary-estimate');
  });

  it('gates monetary amounts on FIN-VIS permissions (bill.view / opd_bill.view)', () => {
    expect(orderDialog).toContain("useHasAnyPermission(['bill.view', 'opd_bill.view'])");
    expect(summaryPanel).toContain('Amounts are not shown for this role.');
    expect(summaryPanel).toContain('data-testid="laboratory-order-summary-amounts-hidden"');
    expect(summaryPanel).toContain('financialAmountsVisible');
    expect(summaryPanel).toContain('laboratory-order-summary-line-price');
    expect(summaryPanel).toContain('laboratory-order-summary-estimate-total');
  });

  it('does not fabricate prices or expose payment/charge CTAs', () => {
    expect(summaryPanel).not.toContain('Collect payment');
    expect(summaryPanel).not.toContain('Post charge');
    expect(summaryPanel).not.toContain('Pay now');
    expect(summaryPanel).not.toContain('Create bill');
    expect(summaryPanel).not.toContain('Final Payable');
    expect(summaryPanel).not.toContain('Amount Due');
    expect(summaryPanel).toContain('Read-only estimate');
    expect(summaryPanel).not.toMatch(/unitPrice\s*=\s*\d/);
    expect(catalogApi).not.toContain('createCharge');
    expect(orderDialog).not.toContain('Pay');
  });

  it('summary updates with selection; cancel still resets composer via handleOpenChange', () => {
    expect(summaryPanel).toContain('getOrderSummary');
    expect(summaryPanel).toContain('selectionSignature');
    expect(orderDialog).toContain('handleOpenChange');
    expect(orderDialog).toMatch(/if \(!next\) reset\(\)/);
    expect(orderDialog).not.toContain('summaryOpen');
  });

  it('responsive: desktop two-column, compact single-column fallback, no Sheet nested overlay', () => {
    expect(orderDialog).toContain('lg:flex-row');
    expect(orderDialog).toContain('max-h-[min(40vh,18rem)]');
    expect(orderDialog).toContain('overflow-hidden');
    expect(orderDialog).toContain('max-w-6xl');
    expect(summaryPanel).toContain('overflow-y-auto');
    expect(orderDialog).toContain('data-testid="laboratory-order-selected-items"');
    expect(orderDialog).toContain('role="table"');
  });

  it('API client posts authoritative order-summary route', async () => {
    expect(catalogApi).toContain('/laboratory/catalog/order-summary');
    expect(catalogApi).toContain('getOrderSummary');
    expect(catalogApi).toContain('financialAmountsVisible');

    postMock.mockResolvedValue({
      data: {
        selectedItemCount: 2,
        lineCount: 2,
        financialAmountsVisible: false,
        estimateTotal: null,
        lines: [
          {
            testDefinitionId: 't1',
            localCode: 'CBC001',
            name: 'CBC',
            quantity: 1,
            commercialState: 'MAPPED',
            financiallyActionable: true,
            unitPrice: null,
            lineEstimate: null,
          },
          {
            testDefinitionId: 't2',
            localCode: 'UM1',
            name: 'Unmapped',
            quantity: 1,
            commercialState: 'UNMAPPED',
            financiallyActionable: false,
            unitPrice: null,
            lineEstimate: null,
          },
        ],
      },
    });

    const res = await laboratoryCatalogApi.getOrderSummary({
      items: [{ testDefinitionId: 't1' }, { testDefinitionId: 't2' }],
    });

    expect(postMock).toHaveBeenCalledWith(
      '/laboratory/catalog/order-summary',
      { items: [{ testDefinitionId: 't1' }, { testDefinitionId: 't2' }] },
      expect.objectContaining({ skipForbiddenRedirect: true }),
    );
    expect(res.data.lines).toHaveLength(2);
    expect(res.data.lines[0].commercialState).toBe('MAPPED');
    expect(res.data.lines[1].commercialState).toBe('UNMAPPED');
    expect(res.data.financialAmountsVisible).toBe(false);
  });

  it('authorized client path surfaces resolver-derived amounts when API returns them', async () => {
    postMock.mockResolvedValue({
      data: {
        selectedItemCount: 1,
        lineCount: 1,
        financialAmountsVisible: true,
        estimateTotal: 350,
        lines: [
          {
            testDefinitionId: 't1',
            localCode: 'CBC001',
            name: 'CBC',
            quantity: 1,
            commercialState: 'MAPPED',
            financiallyActionable: true,
            unitPrice: 350,
            lineEstimate: 350,
          },
        ],
      },
    });

    const res = await laboratoryCatalogApi.getOrderSummary({
      items: [{ testDefinitionId: 't1' }],
    });
    expect(res.data.financialAmountsVisible).toBe(true);
    expect(res.data.estimateTotal).toBe(350);
    expect(res.data.lines[0].unitPrice).toBe(350);
  });
});
