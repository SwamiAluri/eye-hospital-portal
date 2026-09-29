import type { QueryClient } from '@tanstack/react-query';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import { ccmsKeys } from '@/hooks/use-ccms-case';

/**
 * Publish the visit-policy list the server already returned.
 * Does not create, update, or re-fetch policies.
 */
export function publishAuthoritativeVisitPolicies(
  queryClient: QueryClient,
  caseId: string,
  policies: VisitPolicy[],
): void {
  queryClient.setQueryData(ccmsKeys.policies(caseId), policies);
}
