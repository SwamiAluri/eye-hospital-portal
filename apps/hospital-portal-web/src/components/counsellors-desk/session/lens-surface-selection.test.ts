import { describe, expect, it } from 'vitest';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import {
  variantNeedsLensSection,
  variantUsesLensSubOptions,
} from '@/components/counsellors-desk/session/CounsellingProceduresWorkspace';

const edofDual = {
  id: 'var-edof',
  name: 'EDOF Lens (40cm-Distance)',
  hasIolOptions: true,
  subOptions: ['Alcon', 'Hoya'],
  price: 120000,
  defaultPrice: 120000,
  priceType: 'PER_EYE',
  categoryCode: 'CATARACT',
} as CounsellorProcedureVariant;

describe('variant lens surface selection', () => {
  it('prefers sub-options for EDOF when both hasIolOptions and subOptions are set', () => {
    expect(variantUsesLensSubOptions(edofDual)).toBe(true);
    expect(
      variantNeedsLensSection(edofDual, [
        { id: 'iol-1', modelName: 'X', brandManufacturer: 'Alcon', iolType: 'EDOF', origin: 'Imported', price: 1, isDefault: false },
      ]),
    ).toBe(true);
  });

  it('uses IOL catalog only when subOptions are absent', () => {
    const iolOnly = { ...edofDual, subOptions: null };
    expect(variantUsesLensSubOptions(iolOnly)).toBe(false);
    expect(
      variantNeedsLensSection(iolOnly, [
        { id: 'iol-1', modelName: 'X', brandManufacturer: 'Alcon', iolType: 'EDOF', origin: 'Imported', price: 1, isDefault: false },
      ]),
    ).toBe(true);
    expect(variantNeedsLensSection(iolOnly, [])).toBe(false);
  });
});
