import { describe, expect, it } from 'vitest';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import {
  buildPackageApplyPatch,
  buildPackageRestorePatch,
  clearPackageEstimatePatch,
  computeEstimateResult,
  computeDiscountAmount,
  effectiveMaxDiscountPercent,
  groupEstimateLinesForDisplay,
  mergeEstimateState,
  shouldClearPackageOnChange,
} from './estimate-engine';

const procedure = {
  id: 'v-phaco',
  code: 'PHACO',
  name: 'Phaco',
  price: 30000,
  priceType: 'PER_EYE',
  hasIolOptions: true,
  displayOrder: 1,
  isActive: true,
  categoryId: 'c1',
  categoryCode: 'CATARACT',
  categoryName: 'Cataract',
  serviceId: 's1',
  serviceName: 'Cataract Surgery',
  defaultPrice: 30000,
} satisfies CounsellorProcedureVariant;

const iol = {
  id: 'iol-1',
  modelName: 'Acrylic',
  brandManufacturer: 'Brand',
  iolType: 'Mono',
  origin: 'Indian' as const,
  price: 10000,
  isDefault: true,
};

const template: CounsellingPackageTemplate = {
  id: 'tpl-1',
  tenantId: 't1',
  code: 'CAT-ECON',
  name: 'Cataract Economy',
  packageAmount: 40000,
  currency: 'INR',
  procedureVariantId: 'v-phaco',
  defaultEye: 'RE',
  iolId: 'iol-1',
  investigationIds: [],
  maxDiscountPercent: 30,
  isDefault: true,
  sortOrder: 1,
  isActive: true,
  createdAt: '',
};

describe('estimate-engine', () => {
  it('custom mode: subtotal and final without discount', () => {
    const result = computeEstimateResult({
      estimateMode: 'custom',
      packageTemplate: null,
      procedure,
      iol,
      investigations: [
        {
          catalogId: 'inv-1',
          testName: 'CBC',
          testType: 'Lab',
          price: 500,
          urgency: 'Routine',
          source: 'counsellor',
        },
      ],
      discountType: null,
      discountValue: 0,
      settings: { maxDiscountPercent: 50 },
    });
    expect(result.itemizedSubtotal).toBe(30500);
    expect(result.finalPayableAmount).toBe(30500);
    const iolLine = result.lines.find((l) => l.kind === 'iol');
    expect(iolLine?.amount).toBe(0);
    expect(iolLine?.detail).toContain('Included');
  });

  it('uses selectedEye on procedure line detail', () => {
    const result = computeEstimateResult({
      estimateMode: 'custom',
      packageTemplate: null,
      procedure,
      iol: null,
      investigations: [],
      selectedEye: 'LE',
      discountType: null,
      discountValue: 0,
      settings: { maxDiscountPercent: 50 },
    });
    const proc = result.lines.find((l) => l.kind === 'procedure');
    expect(proc?.detail).toBe('LE');
  });

  it('adds procedure line from override price when variant is missing', () => {
    const result = computeEstimateResult({
      estimateMode: 'custom',
      packageTemplate: null,
      procedure: null,
      procedureOverridePrice: 95000,
      iol: null,
      investigations: [],
      selectedEye: 'RE',
      discountType: null,
      discountValue: 0,
      settings: { maxDiscountPercent: 50 },
    });
    const proc = result.lines.find((l) => l.kind === 'procedure');
    expect(proc?.amount).toBe(95000);
    expect(result.finalPayableAmount).toBe(95000);
  });

  it('groupEstimateLinesForDisplay splits procedure, imaging, and labs', () => {
    const grouped = groupEstimateLinesForDisplay([
      { key: 'p', label: 'Phaco', amount: 1, kind: 'procedure', detail: 'RE' },
      { key: 'i', label: 'OCT', amount: 2, kind: 'investigation', detail: 'Imaging' },
      { key: 's', label: 'B-scan', amount: 3, kind: 'investigation', detail: 'Scan' },
      { key: 'l', label: 'CBC', amount: 4, kind: 'investigation', detail: 'Lab' },
    ]);
    expect(grouped.procedurePackage).toHaveLength(1);
    expect(grouped.imaging).toHaveLength(2);
    expect(grouped.labs).toHaveLength(1);
  });

  it('package mode: discount on package amount', () => {
    const result = computeEstimateResult({
      estimateMode: 'package',
      packageTemplate: template,
      procedure,
      iol,
      investigations: [],
      discountType: 'percent',
      discountValue: 10,
      settings: { maxDiscountPercent: 50 },
    });
    expect(result.baseBeforeDiscount).toBe(40000);
    expect(result.finalPayableAmount).toBe(36000);
  });

  it('package mode: uses packageOverridePrice instead of catalog packageAmount', () => {
    const result = computeEstimateResult({
      estimateMode: 'package',
      packageTemplate: template,
      packageOverridePrice: 45000,
      procedure,
      iol,
      investigations: [],
      discountType: null,
      discountValue: 0,
      settings: { maxDiscountPercent: 50 },
    });
    expect(result.baseBeforeDiscount).toBe(45000);
    expect(result.finalPayableAmount).toBe(45000);
    // Bundle savings vs catalog itemized still uses the effective package amount
    expect(result.bundleSavings).toBe(Math.max(0, result.itemizedSubtotal - 45000));
  });

  it('effectiveMaxDiscountPercent: template cap wins in package mode', () => {
    expect(effectiveMaxDiscountPercent({ maxDiscountPercent: 50 }, template, 'package')).toBe(30);
  });

  it('computeDiscountAmount: caps percent at effective max', () => {
    const result = computeDiscountAmount({
      baseBeforeDiscount: 100000,
      discountType: 'percent',
      discountValue: 60,
      effectiveMaxPercent: 50,
    });
    expect(result.discountAmount).toBe(50000);
    expect(result.discountExceeded).toBe(true);
  });

  it('computeDiscountAmount: flat tenant cap', () => {
    const result = computeDiscountAmount({
      baseBeforeDiscount: 100000,
      discountType: 'flat',
      discountValue: 30000,
      effectiveMaxPercent: 50,
      maxDiscountFlat: 10000,
    });
    expect(result.discountAmount).toBe(10000);
    expect(result.discountExceeded).toBe(true);
  });

  it('shouldClearPackageOnChange mutual exclusivity', () => {
    expect(shouldClearPackageOnChange('procedure')).toBe(true);
    expect(shouldClearPackageOnChange('iol')).toBe(true);
    expect(shouldClearPackageOnChange('investigation')).toBe(false);
    expect(shouldClearPackageOnChange('eye')).toBe(false);
    expect(shouldClearPackageOnChange('package-select')).toBe(false);
  });

  it('clearPackageEstimatePatch resets package mode', () => {
    const patch = clearPackageEstimatePatch();
    expect(patch.estimateMode).toBe('custom');
    expect(patch.packageTemplateId).toBeNull();
  });

  it('buildPackageApplyPatch fills variant and rate', () => {
    const patch = buildPackageApplyPatch(template, { imaging: [], scan: [], lab: [] });
    expect(patch.selectedVariantId).toBe('v-phaco');
    expect(patch.packageRate).toBe(40000);
  });

  it('buildPackageRestorePatch preserves discount and eye', () => {
    const restored = buildPackageRestorePatch(template, { imaging: [], scan: [], lab: [] }, {
      estimate: {
        estimateMode: 'package',
        packageTemplateId: template.id,
        discountType: 'percent',
        discountValue: 10,
        discountReason: 'Staff discount',
        discountAmount: 0,
        itemizedSubtotal: 0,
        bundleSavings: 0,
        finalPayableAmount: 0,
      },
      selectedVariantId: 'v-phaco',
      selectedIolId: 'iol-1',
      selectedEye: 'LE',
      variantSubOption: 'Standard',
      selectedSurgeryId: 'type-v-phaco-LE',
      investigations: new Map([
        [
          'inv-1',
          {
            catalogId: 'inv-1',
            testName: 'OCT',
            testType: 'Scan',
            price: 500,
            urgency: 'Routine',
            source: 'counsellor',
          },
        ],
      ]),
    });
    expect(restored.estimate.discountType).toBe('percent');
    expect(restored.selectedEye).toBe('LE');
    expect(restored.investigations.size).toBe(1);
  });
});

describe('mergeEstimateState', () => {
  it('prefers live quote when procedure line is present', () => {
    const merged = mergeEstimateState(
      { finalPayableAmount: 180_200 } as never,
      {
        finalPayableAmount: 155_200,
        lines: [{ key: 'procedure', label: 'PPV', amount: 150_000, kind: 'procedure' }],
        itemizedSubtotal: 155_200,
        bundleSavings: 0,
        discount: { discountAmount: 0, discountExceeded: false, effectiveMaxPercent: 50, maxDiscountAmount: 0 },
        baseBeforeDiscount: 155_200,
      },
    );
    expect(merged.finalPayableAmount).toBe(155_200);
  });

  it('restores saved total while live quote is still zero', () => {
    const merged = mergeEstimateState(
      { finalPayableAmount: 138_100 } as never,
      {
        finalPayableAmount: 0,
        lines: [],
        itemizedSubtotal: 0,
        bundleSavings: 0,
        discount: { discountAmount: 0, discountExceeded: false, effectiveMaxPercent: 50, maxDiscountAmount: 0 },
        baseBeforeDiscount: 0,
      },
    );
    expect(merged.finalPayableAmount).toBe(138_100);
  });

  it('restores saved total during partial hydration before procedure line returns', () => {
    const merged = mergeEstimateState(
      { finalPayableAmount: 138_100 } as never,
      {
        finalPayableAmount: 2700,
        lines: [{ key: 'inv-1', label: 'OCT', amount: 1500, kind: 'investigation' }],
        itemizedSubtotal: 2700,
        bundleSavings: 0,
        discount: { discountAmount: 0, discountExceeded: false, effectiveMaxPercent: 50, maxDiscountAmount: 0 },
        baseBeforeDiscount: 2700,
      },
    );
    expect(merged.finalPayableAmount).toBe(138_100);
  });

  it('flat discount on package+labs (no procedure line) prefers discounted live over stale savedFinal', () => {
    const live = computeEstimateResult({
      estimateMode: 'package',
      packageTemplate: { ...template, packageAmount: 206_000, procedureVariantId: null, iolId: null },
      procedure: null,
      iol: null,
      investigations: [
        {
          catalogId: 'inv-oct',
          testName: 'OCT',
          testType: 'Imaging',
          price: 2700,
          urgency: 'Routine',
          source: 'counsellor',
        },
      ],
      discountType: 'flat',
      discountValue: 10_000,
      settings: { maxDiscountPercent: 50 },
    });
    expect(live.baseBeforeDiscount).toBe(206_000);
    expect(live.discount.discountAmount).toBe(10_000);
    expect(live.finalPayableAmount).toBe(196_000);

    const merged = mergeEstimateState(
      {
        estimateMode: 'package',
        packageTemplateId: template.id,
        discountType: 'flat',
        discountValue: 10_000,
        discountReason: 'Courtesy',
        finalPayableAmount: 206_000,
      } as never,
      live,
    );
    expect(merged.discountAmount).toBe(10_000);
    expect(merged.finalPayableAmount).toBe(196_000);
  });

  it('percentage discount prefers live discounted payable over higher savedFinal', () => {
    const live = computeEstimateResult({
      estimateMode: 'custom',
      packageTemplate: null,
      procedure: null,
      procedureOverridePrice: 100_000,
      iol: null,
      investigations: [],
      discountType: 'percent',
      discountValue: 10,
      settings: { maxDiscountPercent: 50 },
    });
    // procedure override creates a procedure line — still assert discount math
    expect(live.finalPayableAmount).toBe(90_000);

    const merged = mergeEstimateState(
      {
        discountType: 'percent',
        discountValue: 10,
        discountReason: 'Promo',
        finalPayableAmount: 100_000,
      } as never,
      {
        ...live,
        lines: [{ key: 'inv-1', label: 'Lab', amount: 100_000, kind: 'investigation' }],
      },
    );
    expect(merged.finalPayableAmount).toBe(90_000);
  });

  it('active discount does not allow double-discount via merge', () => {
    const live = computeEstimateResult({
      estimateMode: 'package',
      packageTemplate: { ...template, packageAmount: 206_000 },
      procedure: null,
      iol: null,
      investigations: [],
      discountType: 'flat',
      discountValue: 10_000,
      settings: { maxDiscountPercent: 50 },
    });
    const once = mergeEstimateState(
      {
        discountType: 'flat',
        discountValue: 10_000,
        discountReason: 'Courtesy',
        finalPayableAmount: 196_000,
      } as never,
      live,
    );
    const twice = mergeEstimateState(once, live);
    expect(twice.finalPayableAmount).toBe(196_000);
    expect(twice.discountAmount).toBe(10_000);
  });

  it('removing discount restores gross live payable over discounted savedFinal', () => {
    const live = computeEstimateResult({
      estimateMode: 'package',
      packageTemplate: { ...template, packageAmount: 206_000 },
      procedure: null,
      iol: null,
      investigations: [],
      discountType: null,
      discountValue: 0,
      settings: { maxDiscountPercent: 50 },
    });
    expect(live.finalPayableAmount).toBe(206_000);

    const merged = mergeEstimateState(
      {
        discountType: null,
        discountValue: 0,
        discountReason: '',
        finalPayableAmount: 196_000,
      } as never,
      {
        ...live,
        lines: [{ key: 'inv-1', label: 'OCT', amount: 2700, kind: 'investigation' }],
      },
    );
    // No active discount + no procedure line: hydration may keep saved; clearing discount
    // with a live gross base must prefer live when liveFinal >= saved (gross restored).
    expect(merged.finalPayableAmount).toBe(206_000);
  });

  it('caps flat discount at effective max percent of package base', () => {
    const live = computeEstimateResult({
      estimateMode: 'package',
      packageTemplate: { ...template, packageAmount: 100_000, maxDiscountPercent: 10 },
      procedure: null,
      iol: null,
      investigations: [],
      discountType: 'flat',
      discountValue: 50_000,
      settings: { maxDiscountPercent: 50 },
    });
    expect(live.discount.discountAmount).toBe(10_000);
    expect(live.discount.discountExceeded).toBe(true);
    expect(live.finalPayableAmount).toBe(90_000);
  });
});
