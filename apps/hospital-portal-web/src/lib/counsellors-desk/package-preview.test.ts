import { describe, expect, it } from 'vitest';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import {
  packageOverrideVariantId,
  resolvePackageOverride,
  resolvePackageOverridePrice,
  resolveProcedureOverride,
  resolveProcedureOverridePrice,
} from './package-preview';

function makeOverride(
  partial: Partial<PriceOverrideRecord> & Pick<PriceOverrideRecord, 'id' | 'variantId' | 'overriddenPrice'>,
): PriceOverrideRecord {
  return {
    variantName: 'Test procedure',
    basePrice: 55000,
    priceType: 'PER_EYE',
    reason: 'Financial hardship',
    requestedByType: 'SELF',
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('resolveProcedureOverride', () => {
  const overrides: PriceOverrideRecord[] = [
    makeOverride({
      id: 'ov-a-old',
      variantId: 'variant-a',
      overriddenPrice: 100000,
      createdAt: '2026-01-01T00:00:00Z',
    }),
    makeOverride({
      id: 'ov-b',
      variantId: 'variant-b',
      overriddenPrice: 120000,
      createdAt: '2026-06-01T00:00:00Z',
    }),
    makeOverride({
      id: 'ov-a-new',
      variantId: 'variant-a',
      overriddenPrice: 95000,
      createdAt: '2026-06-10T00:00:00Z',
    }),
  ];

  it('returns null when no variant is selected', () => {
    expect(resolveProcedureOverride(overrides, null)).toBeNull();
    expect(resolveProcedureOverridePrice(overrides, null)).toBeNull();
  });

  it('returns null when selected variant has no override', () => {
    expect(resolveProcedureOverride(overrides, 'variant-c')).toBeNull();
    expect(resolveProcedureOverridePrice(overrides, 'variant-c')).toBeNull();
  });

  it('returns the most recent override for the selected variant', () => {
    const match = resolveProcedureOverride(overrides, 'variant-a');
    expect(match?.id).toBe('ov-a-new');
    expect(resolveProcedureOverridePrice(overrides, 'variant-a')).toBe(95000);
  });

  it('does not leak another variant override when switching procedures', () => {
    expect(resolveProcedureOverridePrice(overrides, 'variant-b')).toBe(120000);
    expect(resolveProcedureOverridePrice(overrides, 'variant-a')).toBe(95000);
  });
});

describe('resolvePackageOverride', () => {
  const pkgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const overrides: PriceOverrideRecord[] = [
    makeOverride({
      id: 'ov-pkg-old',
      variantId: pkgId,
      variantName: 'LASIK Advanced',
      basePrice: 45000,
      overriddenPrice: 42000,
      priceType: 'PACKAGE',
      createdAt: '2026-01-01T00:00:00Z',
    }),
    makeOverride({
      id: 'ov-pkg-new',
      variantId: pkgId,
      variantName: 'LASIK Advanced',
      basePrice: 45000,
      overriddenPrice: 40000,
      priceType: 'PACKAGE',
      createdAt: '2026-06-10T00:00:00Z',
    }),
    makeOverride({
      id: 'ov-proc',
      variantId: 'v-phaco',
      overriddenPrice: 95000,
      createdAt: '2026-06-11T00:00:00Z',
    }),
    makeOverride({
      id: 'ov-legacy-prefix',
      variantId: `pkg-override:${pkgId}`,
      variantName: 'Legacy',
      basePrice: 45000,
      overriddenPrice: 39000,
      priceType: 'PACKAGE',
      createdAt: '2026-06-12T00:00:00Z',
    }),
  ];

  it('packageOverrideVariantId is the package template Guid (Azure-compatible)', () => {
    expect(packageOverrideVariantId(pkgId)).toBe(pkgId);
  });

  it('returns null when no package template is selected', () => {
    expect(resolvePackageOverride(overrides, null)).toBeNull();
    expect(resolvePackageOverridePrice(overrides, null)).toBeNull();
  });

  it('returns most recent PACKAGE override by template id and ignores procedure overrides', () => {
    expect(resolvePackageOverride(overrides, pkgId)?.id).toBe('ov-pkg-new');
    expect(resolvePackageOverridePrice(overrides, pkgId)).toBe(40000);
    expect(resolvePackageOverridePrice(overrides, 'other-tpl')).toBeNull();
  });

  it('does not treat PACKAGE overrides as procedure overrides when ids collide', () => {
    const mixed = [
      makeOverride({
        id: 'ov-pkg',
        variantId: 'shared-id',
        overriddenPrice: 40000,
        priceType: 'PACKAGE',
      }),
      makeOverride({
        id: 'ov-proc-shared',
        variantId: 'shared-id',
        overriddenPrice: 99000,
        priceType: 'PER_EYE',
      }),
    ];
    expect(resolvePackageOverridePrice(mixed, 'shared-id')).toBe(40000);
    expect(resolveProcedureOverridePrice(mixed, 'shared-id')).toBe(99000);
  });
});
