import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import {
  buildPackageApplyPatch,
  buildPackageRestorePatch,
  clearPackageEstimatePatch,
  computeEstimateResult,
  computeDiscountAmount,
  effectiveMaxDiscountPercent,
  shouldClearPackageOnChange,
} from './estimate-engine';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

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

// Custom mode subtotal
const custom = computeEstimateResult({
  estimateMode: 'custom',
  packageTemplate: null,
  procedure,
  iol,
  investigations: [{ catalogId: 'inv-1', testName: 'CBC', testType: 'Lab', price: 500, urgency: 'Routine', source: 'counsellor' }],
  discountType: null,
  discountValue: 0,
  settings: { maxDiscountPercent: 50 },
});
assert(custom.itemizedSubtotal === 40500, 'custom itemized = procedure + iol + inv');
assert(custom.finalPayableAmount === 40500, 'custom final without discount');

// Package mode: bundle savings + package base
const pkg = computeEstimateResult({
  estimateMode: 'package',
  packageTemplate: template,
  procedure,
  iol,
  investigations: [],
  discountType: 'percent',
  discountValue: 10,
  settings: { maxDiscountPercent: 50 },
});
assert(pkg.itemizedSubtotal === 40000, 'package itemized still shown');
assert(pkg.bundleSavings === 0, 'itemized equals package amount');
assert(pkg.baseBeforeDiscount === 40000, 'package base is template amount');
assert(pkg.finalPayableAmount === 36000, 'package final = amount - 10%');

// Package max discount caps tenant
const pkgCap = effectiveMaxDiscountPercent({ maxDiscountPercent: 50 }, template, 'package');
assert(pkgCap === 30, 'package template max 30% wins over tenant 50%');

const overDiscount = computeDiscountAmount({
  baseBeforeDiscount: 100000,
  discountType: 'percent',
  discountValue: 60,
  effectiveMaxPercent: 50,
});
assert(overDiscount.discountAmount === 50000, 'discount capped at 50%');
assert(overDiscount.discountExceeded === true, 'flags exceeded');

const flatCapped = computeDiscountAmount({
  baseBeforeDiscount: 100000,
  discountType: 'flat',
  discountValue: 30000,
  effectiveMaxPercent: 50,
  maxDiscountFlat: 10000,
});
assert(flatCapped.discountAmount === 10000, 'flat tenant cap applies');
assert(flatCapped.discountExceeded === true, 'flat cap exceeded flag');

// Mutual exclusivity kinds
assert(shouldClearPackageOnChange('procedure') === true, 'procedure clears package');
assert(shouldClearPackageOnChange('iol') === true, 'iol clears package');
assert(shouldClearPackageOnChange('investigation') === false, 'investigation keeps package');

const cleared = clearPackageEstimatePatch();
assert(cleared.estimateMode === 'custom' && cleared.packageTemplateId === null, 'clear patch');

const apply = buildPackageApplyPatch(template, { imaging: [], scan: [], lab: [] });
assert(apply.selectedVariantId === 'v-phaco', 'apply fills variant');
assert(apply.packageRate === 40000, 'apply sets package rate');

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
  investigations: new Map([['inv-1', { catalogId: 'inv-1', testName: 'OCT', testType: 'Scan', price: 500, urgency: 'Routine', source: 'counsellor' }]]),
});
assert(restored.estimate.discountType === 'percent', 'restore keeps discount type');
assert(restored.estimate.discountValue === 10, 'restore keeps discount value');
assert(restored.selectedEye === 'LE', 'restore keeps saved eye');
assert(restored.investigations.size === 1, 'restore keeps saved investigations');

console.log('estimate-engine.selfcheck: OK');
