/** Surgery id emitted by the lightweight session recommendation: type-{variantId}-{eye}. */
export function variantIdFromSurgeryOptionId(id: string | null | undefined): string | undefined {
  if (!id?.startsWith('type-')) return undefined;
  const withoutPrefix = id.slice(5);
  const eyeMatch = withoutPrefix.match(/-(RE|LE|BE)$/);
  if (!eyeMatch) return undefined;
  const variantId = withoutPrefix.slice(0, -eyeMatch[0].length);
  return variantId || undefined;
}

/**
 * Relocates the previous server text match onto the catalog the quote picker already loads.
 * First catalog row whose name or code contains the stored recommended surgery text.
 * Does not apply prices or invent a procedure.
 */
export function matchRecommendedProcedureVariant(
  variants: ReadonlyArray<{ id: string; name?: string | null; code?: string | null }>,
  recommendedName: string | null | undefined,
): string | null {
  const needle = recommendedName?.trim().toLowerCase();
  if (!needle) return null;
  const hit = variants.find((variant) => {
    const name = (variant.name ?? '').toLowerCase();
    const code = (variant.code ?? '').toLowerCase();
    return name.includes(needle) || (code.length > 0 && code.includes(needle));
  });
  return hit?.id ?? null;
}
