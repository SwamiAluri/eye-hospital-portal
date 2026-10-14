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

describe('L2 Order Composer UX — scalable selected-test table', () => {
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const picker = read('components/laboratory/LaboratoryCatalogPicker.tsx');

  it('opens constrained dialog (max height, overflow hidden — not unbounded growth)', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-dialog"');
    expect(orderDialog).toContain('Order New Laboratory Tests');
    // L3-UX-01 widens dialog for integrated summary rail; still height-capped.
    expect(orderDialog).toMatch(/max-h-\[min\(9[02]vh,/);
    expect(orderDialog).toContain('overflow-hidden');
    expect(orderDialog).toContain('flex-col');
    // Defeat DialogContent default `grid` so flex scroll/footer partition works
    expect(orderDialog).toContain('!flex');
  });

  it('keeps form body scrollable above a non-overlapping sticky footer', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-form"');
    expect(orderDialog).toContain('data-testid="laboratory-order-form-body"');
    expect(orderDialog).toContain('data-testid="laboratory-order-notes-field"');

    const bodyIdx = orderDialog.indexOf('data-testid="laboratory-order-form-body"');
    const indicationIdx = orderDialog.indexOf('data-testid="laboratory-order-indication"');
    const notesIdx = orderDialog.indexOf('data-testid="laboratory-order-notes"');
    const bodyCloseHint = orderDialog.indexOf('data-testid="laboratory-order-error"');
    const footerIdx = orderDialog.indexOf('<DialogFooter');

    expect(bodyIdx).toBeGreaterThan(-1);
    expect(indicationIdx).toBeGreaterThan(bodyIdx);
    expect(notesIdx).toBeGreaterThan(indicationIdx);
    expect(footerIdx).toBeGreaterThan(notesIdx);
    expect(footerIdx).toBeGreaterThan(bodyCloseHint);

    // Bottom padding so last controls can scroll fully clear of the footer
    expect(orderDialog).toContain('pb-6');
    expect(orderDialog).toContain('scroll-pb-6');
    expect(orderDialog).toMatch(
      /data-testid="laboratory-order-form-body"[\s\S]*overflow-y-auto[\s\S]*laboratory-order-notes/,
    );

    // Footer is sibling chrome (not inside scroll body): opaque, shrink-0, above content
    expect(orderDialog).toContain('DialogFooter');
    expect(orderDialog).toContain('shrink-0 border-t');
    expect(orderDialog).toContain('bg-white');
    expect(orderDialog).toContain('relative z-10');
    expect(orderDialog).toMatch(
      /<form[\s\S]*className="flex min-h-0 flex-1 flex-col overflow-hidden"[\s\S]*data-testid="laboratory-order-form"/,
    );
    // Notes field (and its wrapper) must close before DialogFooter sibling
    const notesFieldIdx = orderDialog.indexOf('data-testid="laboratory-order-notes-field"');
    expect(notesFieldIdx).toBeGreaterThan(bodyIdx);
    expect(footerIdx).toBeGreaterThan(notesFieldIdx);
  });

  it('keeps patient, clinician, and priority selected-state contracts', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-patient-selected"');
    expect(orderDialog).toContain('data-testid="laboratory-order-clinician-selected"');
    expect(orderDialog).toContain('data-testid="laboratory-order-priority"');
    expect(orderDialog).toContain("useState('routine')");
  });

  it('shows compact selected count that tracks composition', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-selected-count"');
    expect(orderDialog).toContain('{selectedItems.length} selected');
    expect(orderDialog).toContain('aria-live="polite"');
  });

  it('renders selected tests in a compact table — not large stacked cards', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-selected-items"');
    expect(orderDialog).toContain('role="table"');
    expect(orderDialog).toContain('TableHead');
    expect(orderDialog).toMatch(/>Test<\/TableHead>/);
    expect(orderDialog).toMatch(/>Code<\/TableHead>/);
    expect(orderDialog).toMatch(/>\s*Category\s*<\/TableHead>/);
    expect(orderDialog).toMatch(/>Specimen<\/TableHead>/);
    expect(orderDialog).toContain('data-testid="laboratory-order-derived-code"');
    expect(orderDialog).toContain('data-testid="laboratory-order-derived-category"');
    // Large card chrome removed from selected list
    expect(orderDialog).not.toMatch(/rounded-md border bg-slate-50 px-3 py-2 text-sm/);
  });

  it('selected-test table is independently scrollable for large orders', () => {
    expect(orderDialog).toContain('max-h-[min(14rem,30vh)]');
    expect(orderDialog).toContain('overflow-y-auto');
    expect(orderDialog).toContain('aria-label="Selected laboratory tests"');
    expect(orderDialog).toContain('tabIndex={0}');
  });

  it('supports add/remove and duplicate prevention', () => {
    expect(orderDialog).toContain('excludeKeys');
    expect(orderDialog).toContain('removeCatalogItem');
    expect(orderDialog).toContain('That test or panel is already selected.');
    expect(orderDialog).toContain('aria-label={`Remove ${meta.name} from order`}');
    expect(picker).toContain('loadOnOpen');
    expect(picker).toContain('excludeKeys');
  });

  it('keeps clinical indication required free-text and notes compact', () => {
    expect(orderDialog).toContain('laboratory-order-indication');
    expect(orderDialog).toContain('Clinical indication / reason is required');
    expect(orderDialog).toContain('Enter clinical indication or reason');
    expect(orderDialog).not.toContain('clinicalIndicationsApi');
    expect(orderDialog).not.toContain('Routine screening');
    expect(orderDialog).toContain('laboratory-order-notes');
    expect(orderDialog).toContain('placeholder="Optional"');
  });

  it('footer remains outside the selected-test scroll region', () => {
    expect(orderDialog).toContain('DialogFooter');
    expect(orderDialog).toContain('shrink-0 border-t');
    expect(orderDialog).toContain('data-testid="laboratory-order-submit"');
    // Selected scroll region closes before footer
    const selectedIdx = orderDialog.indexOf('data-testid="laboratory-order-selected-items"');
    const footerIdx = orderDialog.indexOf('<DialogFooter');
    expect(selectedIdx).toBeGreaterThan(-1);
    expect(footerIdx).toBeGreaterThan(selectedIdx);
    // Table keeps its own max-height scroll — independent of form-body scroll
    expect(orderDialog).toContain('max-h-[min(14rem,30vh)]');
  });

  it('submits one logical order via items[]', () => {
    expect(orderDialog).toContain('items: selectedItems.map');
    expect(orderDialog).toContain('createFromCatalog');
    expect(orderDialog).not.toMatch(/labReportsApi\.create\(/);
  });
});

describe('L2 Order Composer UX — createFromCatalog payload regression', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('single-test and multi-test items[] payloads remain valid', async () => {
    postMock.mockResolvedValue({ data: { id: 'lab-1', status: 'ordered' } });

    await labReportsApi.createFromCatalog({
      patientId: 'p1',
      items: [{ testDefinitionId: 'tdef-1' }],
      orderedById: 'doc-1',
      clinicalIndication: 'Check',
      priority: 'routine',
    });
    expect(postMock.mock.calls[0][1].items).toHaveLength(1);

    await labReportsApi.createFromCatalog({
      patientId: 'p1',
      items: [{ testDefinitionId: 'a' }, { testDefinitionId: 'b' }, { testDefinitionId: 'c' }],
      orderedById: 'doc-1',
      clinicalIndication: 'Pre-op',
      priority: 'urgent',
      notes: 'n',
    });
    const multi = postMock.mock.calls[1][1] as Record<string, unknown>;
    expect(multi.items).toHaveLength(3);
    expect(multi).not.toHaveProperty('testName');
  });
});
