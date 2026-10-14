/**
 * Patient 360 All-tab identity for shared canonical documents.
 * Same CanonicalDocumentId must appear once on All even when multiple domains associate it.
 */
export function patient360CanonicalIdentityKey(
  canonicalDocumentId: string | null | undefined,
): string | null {
  if (typeof canonicalDocumentId !== 'string') return null;
  const trimmed = canonicalDocumentId.trim();
  return trimmed ? trimmed : null;
}

export function shouldSkipDuplicateCanonicalOnAll(
  filter: string,
  seenCanonicalIds: Set<string>,
  canonicalDocumentId: string | null | undefined,
): boolean {
  if (filter !== 'all') return false;
  const key = patient360CanonicalIdentityKey(canonicalDocumentId);
  if (!key) return false;
  if (seenCanonicalIds.has(key)) return true;
  seenCanonicalIds.add(key);
  return false;
}
