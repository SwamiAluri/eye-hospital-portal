import type { AlignedCcmsPayer } from '@/lib/ccms/resolve-ccms-payers';
import { resolveCcmsProviderUuid } from '@/lib/ccms/ccms-ids';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';

export interface CoverageDocumentPayerScope {
  insuranceProviderId?: string;
  tpaProviderId?: string;
  governmentSchemeId?: string;
}

interface ResolveCoverageDocumentPayerScopeInput {
  caseInsuranceProviderId?: string | null;
  caseTpaProviderId?: string | null;
  caseGovernmentSchemeId?: string | null;
  formInsuranceProviderId?: string | null;
  counsellingProviderId?: string | null;
  policies?: VisitPolicy[];
  alignedPayers: AlignedCcmsPayer[];
}

/** Resolve payer UUIDs for master document-requirements (caseScoped) queries. */
export function resolveCoverageDocumentPayerScope(
  input: ResolveCoverageDocumentPayerScopeInput,
): CoverageDocumentPayerScope {
  const primaryPolicy =
    input.policies?.find((p) => p.isPrimary) ?? input.policies?.[0];

  const insuranceProviderId =
    resolveCcmsProviderUuid(input.caseInsuranceProviderId ?? undefined, input.alignedPayers) ??
    resolveCcmsProviderUuid(input.formInsuranceProviderId ?? undefined, input.alignedPayers) ??
    resolveCcmsProviderUuid(primaryPolicy?.insuranceProviderId, input.alignedPayers) ??
    resolveCcmsProviderUuid(input.counsellingProviderId ?? undefined, input.alignedPayers);

  const tpaProviderId =
    resolveCcmsProviderUuid(input.caseTpaProviderId ?? undefined, input.alignedPayers) ??
    resolveCcmsProviderUuid(primaryPolicy?.tpaProviderId, input.alignedPayers);

  const governmentSchemeId = resolveCcmsProviderUuid(
    input.caseGovernmentSchemeId ?? undefined,
    input.alignedPayers,
  );

  return {
    insuranceProviderId,
    tpaProviderId,
    governmentSchemeId,
  };
}
