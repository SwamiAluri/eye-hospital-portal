import { describe, expect, it } from 'vitest';
import { resolveHydratedSelectedSurgeryId } from '@/lib/counsellors-desk/resolve-hydrated-selected-surgery-id';

describe('resolveHydratedSelectedSurgeryId', () => {
  it('Test A — restores scheduled procedure via isRecommended when blob empty', () => {
    expect(
      resolveHydratedSelectedSurgeryId({
        blobSelectedSurgeryId: null,
        blobVariantId: null,
        restoredEye: 'RE',
        firstRecommendedSurgeryId: 'type-toric-mono-RE',
      }),
    ).toBe('type-toric-mono-RE');
  });

  it('Test B — scheduled selection survives reload (blob selectedSurgeryId wins)', () => {
    expect(
      resolveHydratedSelectedSurgeryId({
        blobSelectedSurgeryId: 'type-toric-mono-RE',
        blobVariantId: null,
        restoredEye: 'RE',
        firstRecommendedSurgeryId: 'type-other-RE',
      }),
    ).toBe('type-toric-mono-RE');
  });

  it('Test B — scheduled selection survives reload (blob variantId + eye)', () => {
    expect(
      resolveHydratedSelectedSurgeryId({
        blobSelectedSurgeryId: null,
        blobVariantId: 'var-1',
        restoredEye: 'LE',
        firstRecommendedSurgeryId: 'type-other-RE',
      }),
    ).toBe('type-var-1-LE');
  });

  it('Test C — scheduled/recommended X is not replaced when blob already has X', () => {
    expect(
      resolveHydratedSelectedSurgeryId({
        blobSelectedSurgeryId: 'type-scheduled-X-RE',
        blobVariantId: 'would-be-Y',
        restoredEye: 'LE',
        firstRecommendedSurgeryId: 'type-recommend-Y-RE',
      }),
    ).toBe('type-scheduled-X-RE');
  });

  it('Test C — blob variantId X is not replaced by recommended Y', () => {
    expect(
      resolveHydratedSelectedSurgeryId({
        blobSelectedSurgeryId: null,
        blobVariantId: 'scheduled-X',
        restoredEye: 'RE',
        firstRecommendedSurgeryId: 'type-recommend-Y-RE',
      }),
    ).toBe('type-scheduled-X-RE');
  });

  it('returns null only when no blob and no recommended scheduling selection', () => {
    expect(
      resolveHydratedSelectedSurgeryId({
        blobSelectedSurgeryId: null,
        blobVariantId: null,
        restoredEye: 'RE',
        firstRecommendedSurgeryId: null,
      }),
    ).toBeNull();
  });

  it('restores explicit blob selectedSurgeryId over variant and recommended', () => {
    expect(
      resolveHydratedSelectedSurgeryId({
        blobSelectedSurgeryId: 'type-abc-RE',
        blobVariantId: 'other',
        restoredEye: 'LE',
        firstRecommendedSurgeryId: 'type-rec-RE',
      }),
    ).toBe('type-abc-RE');
  });
});
