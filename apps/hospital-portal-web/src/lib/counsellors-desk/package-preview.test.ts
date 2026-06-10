import { describe, expect, it } from 'vitest';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import {
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
