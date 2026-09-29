import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { QuoteWorkspaceSection } from '@/components/counsellors-desk/session/QuoteWorkspaceSection';
import { CounsellingQuoteSummary } from '@/components/counsellors-desk/session/CounsellingQuoteSummary';
import { CounsellingInvestigationsWorkspace } from '@/components/counsellors-desk/session/CounsellingInvestigationsWorkspace';
import { CounsellingProceduresWorkspace } from '@/components/counsellors-desk/session/CounsellingProceduresWorkspace';
import { ProcedureReadOnlyMirror } from '@/components/counsellors-desk/session/ProcedureReadOnlyMirror';
import { QuoteProcedureCatalogGrid } from '@/components/counsellors-desk/session/QuoteProcedureCatalogGrid';
import { QuoteModeNav } from '@/components/counsellors-desk/session/QuoteModeNav';
import { PricingModeStatusStrip } from '@/components/counsellors-desk/session/PricingModeStatusStrip';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { MasterCatalogItem } from '@/types/counsellors-desk';

vi.mock('@/components/counsellors-desk/session/CounsellingSessionContext', () => ({
  useCounsellingSession: () => ({
    sessionId: 'sess-1',
    session: { patientId: 'patient-1', iolPower: '+21.0 D' },
  }),
}));

vi.mock('@/hooks/use-counsellors-desk-queries', () => ({
  useInvalidateCounsellorsDesk: () => ({ invalidateSession: vi.fn() }),
}));

vi.mock('@/lib/ip-management/clinical-evaluation-prefill', () => ({
  loadSuggestedIolPower: vi.fn(async () => '+21.0 D'),
}));

const procedureVariant: CounsellorProcedureVariant = {
  id: 'var-1',
  code: 'TRIF-TOR',
  name: 'Trifocal Toric',
  categoryCode: 'CAT-IOL',
  categoryName: 'IOL Procedures',
  price: 150_000,
  priceType: 'PER_EYE',
  subOptions: ['Zeiss', 'Alcon', 'J&J'],
  hasIolOptions: false,
};

const catalogItem: MasterCatalogItem = {
  id: 'inv-1',
  name: 'IOL Master (Biometry)',
  code: 'IOLM',
  category: 'Diagnostic Scans',
  testType: 'Imaging',
  price: 1500,
};

function buildEstimate(overrides: Partial<UseCounsellingEstimateResult> = {}): UseCounsellingEstimateResult {
  return {
    lines: [
      { key: 'procedure', label: 'Trifocal Toric', amount: 150_000, kind: 'procedure', detail: 'LE' },
      { key: 'inv-1', label: 'IOL Master', amount: 1500, kind: 'investigation', detail: 'Imaging' },
    ],
    itemizedSubtotal: 151_500,
    bundleSavings: 0,
    baseBeforeDiscount: 150_000,
    finalPayableAmount: 155_200,
    discountAmount: 0,
    discountExceeded: false,
    effectiveMaxDiscountPercent: 10,
    maxDiscountAmount: 15_000,
    tenantMaxDiscountFlat: null,
    isPackageMode: false,
    activeTemplate: null,
    mergedEstimate: {
      estimateMode: 'custom',
      discountType: null,
      discountValue: 0,
      discountReason: '',
      packageTemplateId: null,
    },
    selectPackage: vi.fn(),
    restorePackage: vi.fn(() => false),
    setEstimateMode: vi.fn(),
    setDiscount: vi.fn(),
    notifySelectionChange: vi.fn(),
    isApplyingPackage: vi.fn(() => false),
    ...overrides,
  } as UseCounsellingEstimateResult;
}

describe('Quote workspace presentation (Wave 2F)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders flat section heading without card wrapper', () => {
    const html = renderToStaticMarkup(
      <QuoteWorkspaceSection title="Investigations" meta="2 selected">
        <p>Content</p>
      </QuoteWorkspaceSection>,
    );
    expect(html).toContain('Investigations');
    expect(html).toContain('2 selected');
    expect(html).not.toContain('rounded-2xl');
  });

  it('renders dominant final payable from estimate engine output', () => {
    const html = renderToStaticMarkup(
      <CounsellingQuoteSummary
        estimate={buildEstimate()}
        estimateDiscountType={null}
        estimateDiscountValue={0}
        estimateDiscountReason=""
        selectedVariant={procedureVariant}
        savedOverrides={[]}
        isReadOnly={false}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteFinalPayable}"`);
    expect(html).toContain('₹1,55,200');
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteItemizedBreakdown}"`);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.quoteSummaryBreakdown}"`);
  });

  it('renders quote mode nav with procedure, package, imaging, and labs tabs', () => {
    const html = renderToStaticMarkup(
      <QuoteModeNav
        activeTab="custom"
        onModeChange={() => {}}
        selectedEye="LE"
        onEyeChange={() => {}}
        investigationTabsEnabled
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteModeNav}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.tabCustom}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.tabPackage}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.tabImaging}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.tabLab}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.eyeLe}"`);
    expect(html).toContain('rounded-full');
  });

  it('shows eye selector on labs tab (Wave 2H)', () => {
    const html = renderToStaticMarkup(
      <QuoteModeNav
        activeTab="labs"
        onModeChange={() => {}}
        selectedEye="LE"
        onEyeChange={() => {}}
        investigationTabsEnabled
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.eyeLe}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.tabLab}"`);
  });

  it('renders Apply Discount collapsed by default with toggle', () => {
    const html = renderToStaticMarkup(
      <CounsellingQuoteSummary
        estimate={buildEstimate()}
        estimateDiscountType={null}
        estimateDiscountValue={0}
        estimateDiscountReason=""
        selectedVariant={procedureVariant}
        savedOverrides={[]}
        isReadOnly={false}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteDiscountPanel}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteDiscountToggle}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(counsellingCopy.applyDiscount);
    expect(html).not.toContain(counsellingCopy.discountType);
    expect(html).not.toContain(counsellingCopy.discountReasonLabel);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.quoteDiscountApply}"`);
  });

  it('renders procedure CTA as Select procedure not Select package', () => {
    const html = renderToStaticMarkup(
      <QuoteProcedureCatalogGrid
        procedureVariants={[procedureVariant]}
        procedureLoading={false}
        procedureError={false}
        loadProcedures={vi.fn()}
        recommendedVariantIds={[]}
        selectedVariantId={null}
        selectedEye="LE"
        isReadOnly={false}
        isDoneState={false}
        onPickVariant={vi.fn()}
        onReEvaluate={vi.fn()}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain('Select procedure');
    expect(html).not.toContain('Select package');
  });

  it('shows the procedure catalog loading state without procedure cards', () => {
    const html = renderToStaticMarkup(
      <QuoteProcedureCatalogGrid
        procedureVariants={[]}
        procedureLoading
        procedureError={false}
        loadProcedures={vi.fn()}
        recommendedVariantIds={[]}
        selectedVariantId={null}
        selectedEye="RE"
        isReadOnly={false}
        isDoneState={false}
        onPickVariant={vi.fn()}
        onReEvaluate={vi.fn()}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain('aria-label="Loading procedures"');
    expect(html).not.toContain('Select procedure');
  });

  it('renders inline procedure catalog grid with search', () => {
    const html = renderToStaticMarkup(
      <QuoteProcedureCatalogGrid
        procedureVariants={[procedureVariant]}
        procedureLoading={false}
        procedureError={false}
        loadProcedures={vi.fn()}
        recommendedVariantIds={[]}
        selectedVariantId={null}
        selectedEye="LE"
        isReadOnly={false}
        isDoneState={false}
        onPickVariant={vi.fn()}
        onReEvaluate={vi.fn()}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteProcedureCatalogGrid}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.procedureSearch}"`);
    expect(html).toContain('Trifocal Toric');
    expect(html).not.toContain('Procedure catalogue');
  });

  it('renders lens configuration controls', () => {
    const html = renderToStaticMarkup(
      <CounsellingProceduresWorkspace
        embedded
        parts={['lens']}
        procedureVariants={[procedureVariant]}
        selectedVariantId="var-1"
        selectedEye="LE"
        variantSubOption="Zeiss"
        iolOptions={[]}
        selectedIolId={null}
        isReadOnly={false}
        onVariantSubOption={vi.fn()}
        onSelectIol={vi.fn()}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain('Zeiss');
    expect(html).not.toContain(`data-testid="${counsellingTestIds.procedureSearch}"`);
  });

  it('renders forced imaging catalog without internal segmented tabs', () => {
    const selected = new Map([
      ['inv-1', { id: 'inv-1', name: catalogItem.name, price: 1500, source: 'counsellor' as const }],
    ]);
    const html = renderToStaticMarkup(
      <CounsellingInvestigationsWorkspace
        embedded
        hideSectionChrome
        forceCategory="imaging"
        masterCatalog={{ imaging: [catalogItem], scan: [], lab: [] }}
        selectedInvestigations={selected}
        onToggleInvestigation={vi.fn()}
        onClearAll={vi.fn()}
        isReadOnly={false}
        isPackageMode={false}
        packageInvestigationIds={[]}
      />,
    );
    expect(html).not.toContain('aria-label="Filter investigations by category"');
    expect(html).toContain(`data-testid="${counsellingTestIds.investigationSearch}"`);
  });

  it('renders investigation category filter nav when not forced by quote tabs', () => {
    const selected = new Map([
      ['inv-1', { id: 'inv-1', name: catalogItem.name, price: 1500, source: 'counsellor' as const }],
    ]);
    const html = renderToStaticMarkup(
      <CounsellingInvestigationsWorkspace
        embedded
        masterCatalog={{ imaging: [catalogItem], scan: [], lab: [] }}
        selectedInvestigations={selected}
        onToggleInvestigation={vi.fn()}
        onClearAll={vi.fn()}
        isReadOnly={false}
        isPackageMode={false}
        packageInvestigationIds={[]}
      />,
    );
    expect(html).toContain('aria-label="Filter investigations by category"');
    expect(html).toContain(`data-testid="${counsellingTestIds.investigationSearch}"`);
    expect(html).toContain('data-testid="counselling-investigation-selection-summary"');
    expect(html).toContain('1 selected');
  });

  it('shows always-expanded itemized breakdown with investigation amounts', () => {
    const html = renderToStaticMarkup(
      <CounsellingQuoteSummary
        estimate={buildEstimate()}
        estimateDiscountType={null}
        estimateDiscountValue={0}
        estimateDiscountReason=""
        selectedVariant={procedureVariant}
        savedOverrides={[]}
        isReadOnly={false}
      />,
    );
    expect(html).toContain(counsellingCopy.itemizedBreakdown);
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteItemizedBreakdown}"`);
    expect(html).toContain('IOL Master');
    expect(html).toContain('₹1,500');
  });

  it('shows IOL on a separate Lens / IOL section when present', () => {
    const estimate = buildEstimate({
      lines: [
        { key: 'procedure', label: 'EDOF Lens', amount: 120_000, kind: 'procedure', detail: 'LE' },
        {
          key: 'iol-1',
          label: 'Alcon Vivity Extended Vision IOL',
          amount: 0,
          kind: 'iol',
          detail: 'Alcon · Included',
        },
      ],
      itemizedSubtotal: 120_000,
      finalPayableAmount: 120_000,
      baseBeforeDiscount: 120_000,
    });
    const html = renderToStaticMarkup(
      <CounsellingQuoteSummary
        estimate={estimate}
        estimateDiscountType={null}
        estimateDiscountValue={0}
        estimateDiscountReason=""
        selectedVariant={procedureVariant}
        savedOverrides={[]}
        isReadOnly={false}
      />,
    );
    expect(html).toContain(counsellingCopy.lensIol);
    expect(html).toContain('Alcon Vivity Extended Vision IOL');
    expect(html).toContain('EDOF Lens');
    expect(html).toContain(counsellingCopy.included);
  });

  it('hides clear-all when investigations workspace is read-only', () => {
    const selected = new Map([
      ['inv-1', { id: 'inv-1', name: catalogItem.name, price: 1500, source: 'counsellor' as const }],
    ]);
    const html = renderToStaticMarkup(
      <CounsellingInvestigationsWorkspace
        embedded
        masterCatalog={{ imaging: [catalogItem], scan: [], lab: [] }}
        selectedInvestigations={selected}
        onToggleInvestigation={vi.fn()}
        onClearAll={vi.fn()}
        isReadOnly
        isPackageMode={false}
        packageInvestigationIds={[]}
      />,
    );
    expect(html).toContain('1 selected');
    expect(html).not.toContain('Clear all');
  });

  it('renders package read-only selected procedure mirror', () => {
    const html = renderToStaticMarkup(
      <ProcedureReadOnlyMirror
        procedureVariants={[procedureVariant]}
        selectedVariantId="var-1"
        selectedEye="LE"
        variantSubOption="Zeiss"
        selectedIolId={null}
        iolOptions={[]}
        activeTemplate={{ id: 'pkg-1', name: 'Premium Package', packageAmount: 200_000 } as never}
        isReadOnly
        onSwitchToCustom={vi.fn()}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteSelectedProcedure}"`);
    expect(html).not.toContain('Switch to custom pricing');
    expect(html).toContain('Premium Package');
  });

  it('shows package edit-price control on estimate package row (Wave 2I)', () => {
    const estimate = buildEstimate({
      isPackageMode: true,
      activeTemplate: {
        id: 'pkg-1',
        name: 'LASIK Advanced',
        packageAmount: 45_000,
      } as never,
      baseBeforeDiscount: 45_000,
      finalPayableAmount: 45_000,
      lines: [
        { key: 'procedure', label: 'LASIK', amount: 45_000, kind: 'procedure', detail: 'LE' },
      ],
      mergedEstimate: {
        estimateMode: 'package',
        discountType: null,
        discountValue: 0,
        discountReason: '',
        packageTemplateId: 'pkg-1',
      },
    });
    const html = renderToStaticMarkup(
      <CounsellingQuoteSummary
        estimate={estimate}
        estimateDiscountType={null}
        estimateDiscountValue={0}
        estimateDiscountReason=""
        selectedVariant={procedureVariant}
        selectedEye="RE"
        savedOverrides={[]}
        isReadOnly={false}
        onOpenPackageOverride={() => {}}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.quotePackageEditPrice}"`);
    expect(html).toContain('LASIK Advanced');
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteEstimateEyeBadge}"`);
    expect(html).toContain('bg-orange-100');
  });

  it('package selected strip shows eye badge and catalog amount (Wave 2J)', () => {
    const html = renderToStaticMarkup(
      <PricingModeStatusStrip
        isPackageMode
        activeTemplate={{ id: 'pkg-1', name: 'Cataract Standard', packageAmount: 55_000 } as never}
        selectedVariantId="var-1"
        selectedEye="LE"
        procedureVariants={[procedureVariant]}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteSelectedPackage}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.quoteSelectedEyeBadge}"`);
    expect(html).toContain('bg-purple-100');
    expect(html).toContain('₹55,000');
    expect(html).not.toContain('Locked while package');
  });

  it('does not show package lock chrome on eye selector', () => {
    const html = renderToStaticMarkup(
      <QuoteModeNav
        activeTab="labs"
        onModeChange={() => {}}
        selectedEye="LE"
        onEyeChange={() => {}}
        investigationTabsEnabled
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.eyeLe}"`);
    expect(html).not.toContain('Eye (package)');
    expect(html).not.toContain('Locked while package pricing is active');
  });

  it('preserves quote workspace root test id contract', () => {
    expect(counsellingTestIds.quoteWorkspace).toBe('counselling-quote-workspace');
  });
});
