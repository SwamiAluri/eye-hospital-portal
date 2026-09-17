import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';

/**
 * The API remains the source of truth. This presentation guard prevents a known
 * duplicate policy-number write defect from producing duplicate operational display rows.
 *
 * Collapse only when the same normalized policyNumber appears more than once.
 * Distinct policy numbers (legitimate primary/secondary) are never collapsed.
 */
export function normalizeVisitPolicyNumber(policyNumber?: string | null): string {
  return (policyNumber ?? '').trim().toLowerCase();
}

function isSoftDeletedPolicy(policy: VisitPolicy): boolean {
  const status = (policy.status ?? '').trim().toLowerCase();
  return status === 'deleted';
}

function pickCanonicalDuplicate(candidates: VisitPolicy[]): VisitPolicy {
  const primaries = candidates.filter((p) => p.isPrimary);
  if (primaries.length === 1) {
    return primaries[0]!;
  }

  return [...candidates].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt) || 0;
    const bTime = Date.parse(b.updatedAt) || 0;
    if (bTime !== aTime) return bTime - aTime;
    // Stable tie-break: lexicographic id
    return a.id.localeCompare(b.id);
  })[0]!;
}

export function selectVisitPoliciesForDisplay(policies: VisitPolicy[]): VisitPolicy[] {
  const active = policies.filter((p) => !isSoftDeletedPolicy(p));
  const byNumber = new Map<string, VisitPolicy[]>();
  const order: string[] = [];

  for (const policy of active) {
    const key = normalizeVisitPolicyNumber(policy.policyNumber);
    // Empty policy numbers stay distinct by id so we never invent merges.
    const bucketKey = key || `__empty:${policy.id}`;
    if (!byNumber.has(bucketKey)) {
      byNumber.set(bucketKey, []);
      order.push(bucketKey);
    }
    byNumber.get(bucketKey)!.push(policy);
  }

  return order.map((bucketKey) => {
    const group = byNumber.get(bucketKey)!;
    return group.length === 1 ? group[0]! : pickCanonicalDuplicate(group);
  });
}
