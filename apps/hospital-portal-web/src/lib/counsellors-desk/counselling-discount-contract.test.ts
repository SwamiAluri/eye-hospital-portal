import { describe, expect, it } from 'vitest';
import {
  buildCommittedDiscountPatch,
  validateDiscountForSave,
} from '@/lib/counsellors-desk/counselling-discount-contract';

describe('counselling-discount-contract', () => {
  it('blocks save when discount amount > 0 and reason is empty', () => {
    expect(
      validateDiscountForSave({
        discountType: 'flat',
        discountValue: 5000,
        discountReason: '',
      }),
    ).toBe('Please enter a discount reason');
    expect(
      validateDiscountForSave({
        discountType: 'flat',
        discountValue: 5000,
        discountReason: '   ',
      }),
    ).toBe('Please enter a discount reason');
  });

  it('allows save when discount ₹5000 has reason test', () => {
    expect(
      validateDiscountForSave({
        discountType: 'flat',
        discountValue: 5000,
        discountReason: 'test',
      }),
    ).toBeNull();
  });

  it('allows save with no discount and no reason', () => {
    expect(
      validateDiscountForSave({
        discountType: null,
        discountValue: 0,
        discountReason: '',
      }),
    ).toBeNull();
  });

  it('allows save after discount cleared (stale reason ignored)', () => {
    expect(
      validateDiscountForSave({
        discountType: null,
        discountValue: 0,
        discountReason: 'old reason',
      }),
    ).toBeNull();
  });

  it('commits draft reason into canonical discount patch', () => {
    expect(
      buildCommittedDiscountPatch({
        draftType: 'flat',
        draftValue: '5000',
        draftReason: 'test',
      }),
    ).toEqual({
      discountType: 'flat',
      discountValue: 5000,
      discountReason: 'test',
    });
  });

  it('requires reason before committing a positive discount draft', () => {
    expect(
      buildCommittedDiscountPatch({
        draftType: 'flat',
        draftValue: '5000',
        draftReason: '  ',
      }),
    ).toBeNull();
  });

  it('clears discount when type is removed', () => {
    expect(
      buildCommittedDiscountPatch({
        draftType: null,
        draftValue: '',
        draftReason: 'test',
      }),
    ).toEqual({
      discountType: null,
      discountValue: 0,
      discountReason: '',
    });
  });

  it('persists discountReason through package addons blob round-trip', async () => {
    const { mergeEstimateIntoBlob, parseEstimateFromBlob } = await import(
      '@/lib/counsellors-desk/package-addons-blob'
    );
    const merged = mergeEstimateIntoBlob(
      {},
      {
        discountType: 'flat',
        discountValue: 5000,
        discountReason: 'test',
        discountAmount: 5000,
        finalPayableAmount: 10000,
      },
    );
    expect(merged.discountReason).toBe('test');
    const restored = parseEstimateFromBlob(merged);
    expect(restored.discountReason).toBe('test');
    expect(restored.discountValue).toBe(5000);
  });

  it('persists discounted finalPayableAmount through blob round-trip (206000 - 10000)', async () => {
    const { mergeEstimateIntoBlob, parseEstimateFromBlob } = await import(
      '@/lib/counsellors-desk/package-addons-blob'
    );
    const merged = mergeEstimateIntoBlob(
      {},
      {
        discountType: 'flat',
        discountValue: 10_000,
        discountReason: 'Courtesy',
        discountAmount: 10_000,
        finalPayableAmount: 196_000,
        itemizedSubtotal: 206_000,
      },
    );
    expect(merged.finalPayableAmount).toBe(196_000);
    expect(merged.rate).toBe(196_000);
    const restored = parseEstimateFromBlob(merged);
    expect(restored.finalPayableAmount).toBe(196_000);
    expect(restored.discountAmount).toBe(10_000);
  });
});
