/**
 * Resolve which procedure/surgery is selected when hydrating a counselling session.
 *
 * Priority (certified scheduling → counselling behavior):
 * 1. Persisted blob selectedSurgeryId (counsellor save)
 * 2. Persisted blob variantId + eye
 * 3. First isRecommended catalog entry — carries the procedure/package chosen
 *    during Add Patient / Schedule Initial Counselling (and doctor recommend),
 *    via recommended_surgery / recommended_procedures → SurgeriesWithPricing
 */
export function resolveHydratedSelectedSurgeryId(args: {
  blobSelectedSurgeryId?: string | null;
  blobVariantId?: string | null;
  restoredEye?: string | null;
  /** First recommended surgery option id from hydrated catalog (may be null). */
  firstRecommendedSurgeryId?: string | null;
}): string | null {
  const fromBlob = args.blobSelectedSurgeryId?.trim();
  if (fromBlob) return fromBlob;

  const variantId = args.blobVariantId?.trim();
  if (variantId) {
    const eye = (args.restoredEye?.trim() || 'RE').toUpperCase();
    return `type-${variantId}-${eye}`;
  }

  const recommended = args.firstRecommendedSurgeryId?.trim();
  if (recommended) return recommended;

  return null;
}
