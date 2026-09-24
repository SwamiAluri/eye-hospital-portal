import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listDocumentRequirements,
  type DocumentRequirement,
} from '@/lib/api/ccms/ccms-master-data.api';
import {
  countRequiredFromRequirementRows,
  slotsFromMasterOrFallback,
  withBiometrySlot,
  type SlotDef,
} from '@/lib/ccms/ccms-document-slots';

/** Stable empty fallback — inline `?? []` recreates identity every render and thrash dependents. */
export const EMPTY_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [];

export interface UseCoverageDocumentRequirementsOptions {
  caseId?: string;
  insuranceProviderId?: string;
  tpaProviderId?: string;
  governmentSchemeId?: string;
  enabled?: boolean;
}

export function coverageDocumentRequirementsQueryKey(
  opts: UseCoverageDocumentRequirementsOptions,
): (string | undefined)[] {
  return [
    'ccms',
    'document-requirements',
    'preauth',
    'counsellor',
    opts.caseId,
    opts.insuranceProviderId,
    opts.tpaProviderId,
    opts.governmentSchemeId,
  ];
}

export function useCoverageDocumentRequirements(
  opts: UseCoverageDocumentRequirementsOptions,
) {
  const enabled = opts.enabled !== false && !!opts.caseId;

  const query = useQuery({
    queryKey: coverageDocumentRequirementsQueryKey(opts),
    queryFn: () =>
      listDocumentRequirements({
        stage: 'preauth',
        insuranceProviderId: opts.insuranceProviderId,
        tpaProviderId: opts.tpaProviderId,
        governmentSchemeId: opts.governmentSchemeId,
        caseScoped: true,
      }),
    enabled,
    staleTime: 60_000,
  });

  const requirements = query.data ?? EMPTY_DOCUMENT_REQUIREMENTS;
  const usingMasterRequirements = requirements.length > 0;

  const slots = useMemo(
    () => withBiometrySlot(slotsFromMasterOrFallback(requirements)),
    [requirements],
  );

  const requiredDocCount = useMemo(
    () => (usingMasterRequirements ? countRequiredFromRequirementRows(requirements) : 0),
    [requirements, usingMasterRequirements],
  );

  return {
    slots,
    requiredDocCount,
    requirements,
    usingMasterRequirements,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export type { SlotDef };
