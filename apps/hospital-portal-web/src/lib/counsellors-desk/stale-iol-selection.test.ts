import { describe, expect, it } from 'vitest';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { resolveStaleIolSelection } from '@/lib/counsellors-desk/stale-iol-selection';

const edofVariant = {
  id: 'var-edof',
  name: 'EDOF Lens (40cm-Distance)',
  hasIolOptions: true,
  subOptions: null,
  price: 40000,
  defaultPrice: 40000,
  priceType: 'PER_EYE',
  categoryCode: 'CATARACT',
} as CounsellorProcedureVariant;

const subOptionOnlyVariant = {
  id: 'var-sub',
  name: 'EDOF Subtype',
  hasIolOptions: false,
  subOptions: ['Alcon', 'Hoya'],
  price: 40000,
  defaultPrice: 40000,
  priceType: 'PER_EYE',
  categoryCode: 'CATARACT',
} as CounsellorProcedureVariant;

const hoya = { id: 'iol-hoya' };
const alcon = { id: 'iol-alcon' };

describe('resolveStaleIolSelection — hydration race', () => {
  it('preserves Hoya while procedure catalog is still loading', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: hoya.id,
        selectedVariantId: edofVariant.id,
        procedureVariants: [],
        procedureCatalogReady: false,
        iolOptions: [],
        iolOptionsReady: false,
      }),
    ).toBe('preserve');
  });

  it('preserves Hoya while IOL options are still loading after procedure catalog is ready', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: hoya.id,
        selectedVariantId: edofVariant.id,
        procedureVariants: [edofVariant],
        procedureCatalogReady: true,
        iolOptions: [],
        iolOptionsReady: false,
      }),
    ).toBe('preserve');
  });

  it('preserves Hoya once catalogs are ready and Hoya is present', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: hoya.id,
        selectedVariantId: edofVariant.id,
        procedureVariants: [edofVariant],
        procedureCatalogReady: true,
        iolOptions: [alcon, hoya],
        iolOptionsReady: true,
      }),
    ).toBe('preserve');
  });

  it('preserves Alcon once catalogs are ready and Alcon is present', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: alcon.id,
        selectedVariantId: edofVariant.id,
        procedureVariants: [edofVariant],
        procedureCatalogReady: true,
        iolOptions: [alcon, hoya],
        iolOptionsReady: true,
      }),
    ).toBe('preserve');
  });

  it('clears invalid IOL once authoritative options are ready', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: 'iol-missing',
        selectedVariantId: edofVariant.id,
        procedureVariants: [edofVariant],
        procedureCatalogReady: true,
        iolOptions: [alcon, hoya],
        iolOptionsReady: true,
      }),
    ).toBe('clear');
  });

  it('preserves IOL id when procedure uses lens sub-options (does not prune against IOL catalog)', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: hoya.id,
        selectedVariantId: subOptionOnlyVariant.id,
        procedureVariants: [subOptionOnlyVariant],
        procedureCatalogReady: true,
        iolOptions: [],
        iolOptionsReady: true,
      }),
    ).toBe('preserve');
  });

  it('clears IOL when catalog is ready and procedure has neither sub-options nor IOL support', () => {
    const plain = {
      ...edofVariant,
      hasIolOptions: false,
      subOptions: null,
    };
    expect(
      resolveStaleIolSelection({
        selectedIolId: hoya.id,
        selectedVariantId: plain.id,
        procedureVariants: [plain],
        procedureCatalogReady: true,
        iolOptions: [],
        iolOptionsReady: true,
      }),
    ).toBe('clear');
  });

  it('clears IOL when catalog is ready but selected procedure is missing', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: hoya.id,
        selectedVariantId: 'var-gone',
        procedureVariants: [edofVariant],
        procedureCatalogReady: true,
        iolOptions: [hoya],
        iolOptionsReady: true,
      }),
    ).toBe('clear');
  });

  it('clears IOL when options finished loading empty for an IOL-capable procedure', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: hoya.id,
        selectedVariantId: edofVariant.id,
        procedureVariants: [edofVariant],
        procedureCatalogReady: true,
        iolOptions: [],
        iolOptionsReady: true,
      }),
    ).toBe('clear');
  });

  it('does not clear when selectedIolId is already null', () => {
    expect(
      resolveStaleIolSelection({
        selectedIolId: null,
        selectedVariantId: edofVariant.id,
        procedureVariants: [],
        procedureCatalogReady: false,
        iolOptions: [],
        iolOptionsReady: false,
      }),
    ).toBe('preserve');
  });
});
