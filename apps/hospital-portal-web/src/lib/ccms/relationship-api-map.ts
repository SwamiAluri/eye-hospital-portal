import type { RelationshipToInsured } from '@/lib/api/ccms/visit-policies.api';

const MASTER_TO_API: Record<string, RelationshipToInsured> = {
  SELF: 'self',
  SPOUSE: 'spouse',
  CHILD: 'child',
  PARENT: 'parent',
  OTHER: 'other',
  self: 'self',
  spouse: 'spouse',
  child: 'child',
  parent: 'parent',
  other: 'other',
};

const API_TO_MASTER: Record<RelationshipToInsured, string> = {
  self: 'SELF',
  spouse: 'SPOUSE',
  child: 'CHILD',
  parent: 'PARENT',
  other: 'OTHER',
};

export function relationshipMasterCode(apiValue?: RelationshipToInsured | string | null): string {
  if (!apiValue) return 'SELF';
  const key = apiValue as RelationshipToInsured;
  return API_TO_MASTER[key] ?? String(apiValue).toUpperCase();
}

export function relationshipApiValue(masterCode: string): RelationshipToInsured {
  return MASTER_TO_API[masterCode] ?? MASTER_TO_API[masterCode.toUpperCase()] ?? 'self';
}
