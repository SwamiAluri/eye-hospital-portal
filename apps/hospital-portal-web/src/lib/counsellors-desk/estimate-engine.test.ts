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
    expect(result.itemizedSubtotal).toBe(40500);
    expect(result.finalPayableAmount).toBe(40500);
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
