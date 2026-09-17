import {
  findCounsellorVariant,
  type CounsellorProcedureVariant,
} from '@/lib/master-data/clinical-catalog-master';

export type StaleIolCleanupInput = {
  selectedIolId: string | null;
  selectedVariantId: string | null;
  procedureVariants: CounsellorProcedureVariant[];
  /** False while procedure catalog query is still loading. */
  procedureCatalogReady: boolean;
  iolOptions: Array<{ id: string }>;
  /** False while IOL options for the selected variant are still loading. */
  iolOptionsReady: boolean;
};

export type StaleIolCleanupAction = 'preserve' | 'clear';

/**
 * Decide whether a hydrated/restored selectedIolId should be cleared.
 * Must not treat "catalog still loading" as "invalid selection".
 */
export function resolveStaleIolSelection(input: StaleIolCleanupInput): StaleIolCleanupAction {
  if (!input.selectedIolId) return 'preserve';

  if (!input.procedureCatalogReady) return 'preserve';

  const variant = findCounsellorVariant(input.procedureVariants, input.selectedVariantId);
  if (!variant) {
    // Catalog finished loading but the selected procedure is not present — drop orphan IOL.
    return 'clear';
  }

  // Sub-option path (Alcon/Hoya, etc.) owns the counsellor lens choice via variantSubOption.
  // Do not prune selectedIolId against the IOL catalog for these variants.
  if ((variant.subOptions?.length ?? 0) > 0) {
    return 'preserve';
  }

  if (!variant.hasIolOptions) {
    return 'clear';
  }

  if (!input.iolOptionsReady) return 'preserve';

  if (!input.iolOptions.some((iol) => iol.id === input.selectedIolId)) {
    return 'clear';
  }

  return 'preserve';
}
