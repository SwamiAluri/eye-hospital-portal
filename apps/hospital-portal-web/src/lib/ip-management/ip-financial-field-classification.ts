/**
 * Phase 3 — IP financial / coverage field classification.
 *
 * IP must not independently own hospital-wide settlement. Fields on the journey
 * are classified so UI and integrations know what is authoritative vs projection.
 */

export type IpFinancialFieldClass =
  | 'clinical_workflow'
  | 'billing_projection'
  | 'coverage_projection'
  | 'legacy_compatibility'
  | 'deprecated';

export interface IpFinancialFieldMeta {
  field: string;
  classification: IpFinancialFieldClass;
  canonicalOwner: 'IP' | 'Billing' | 'CCMS' | 'none';
  notes: string;
}

export const IP_FINANCIAL_FIELD_CLASSIFICATION: readonly IpFinancialFieldMeta[] = [
  {
    field: 'FinancialState',
    classification: 'clinical_workflow',
    canonicalOwner: 'IP',
    notes:
      'Ward/OT workflow compatibility only. Settled may emit BillFinalized bridge; Billing remains SoT for charges.',
  },
  {
    field: 'PaymentMode',
    classification: 'clinical_workflow',
    canonicalOwner: 'IP',
    notes: 'Drives coverage-based admit policy; not payer approval.',
  },
  {
    field: 'PackageAmount',
    classification: 'billing_projection',
    canonicalOwner: 'Billing',
    notes: 'Display / counselling estimate snapshot on the journey.',
  },
  {
    field: 'TotalPaid',
    classification: 'billing_projection',
    canonicalOwner: 'Billing',
    notes: 'Projection of advances/receipts; not claim settlement.',
  },
  {
    field: 'TotalAdvances',
    classification: 'billing_projection',
    canonicalOwner: 'Billing',
    notes: 'Ward advance projection.',
  },
  {
    field: 'BalanceDue',
    classification: 'billing_projection',
    canonicalOwner: 'Billing',
    notes: 'Generated / projected outstanding patient responsibility.',
  },
  {
    field: 'IpBillingTransaction',
    classification: 'billing_projection',
    canonicalOwner: 'Billing',
    notes: 'Ward receipts/advances; not the hospital charge engine.',
  },
  {
    field: 'IsBillingLocked',
    classification: 'clinical_workflow',
    canonicalOwner: 'IP',
    notes: 'Mutation / OT guard — clinically relevant.',
  },
  {
    field: 'EmergencyFcApplied',
    classification: 'clinical_workflow',
    canonicalOwner: 'IP',
    notes: 'Privileged admit override; mirrored to CCMS; not coverage approval.',
  },
  {
    field: 'InsurancePreauthSubmitted',
    classification: 'deprecated',
    canonicalOwner: 'CCMS',
    notes: 'Legacy flag. Live authorization is CCMS PreauthStatus / coverage case.',
  },
  {
    field: 'GovernmentApprovalSubmitted',
    classification: 'legacy_compatibility',
    canonicalOwner: 'CCMS',
    notes: 'Scheme doc workflow hint; authorization truth remains CCMS.',
  },
  {
    field: 'CoverageStatus (PreauthStatusDto)',
    classification: 'coverage_projection',
    canonicalOwner: 'CCMS',
    notes: 'Backend-owned read model from CCMS admit validation.',
  },
] as const;

export function classifyIpFinancialField(field: string): IpFinancialFieldMeta | undefined {
  return IP_FINANCIAL_FIELD_CLASSIFICATION.find(
    (f) => f.field.toLowerCase() === field.trim().toLowerCase(),
  );
}

export function isDeprecatedIpFinancialField(field: string): boolean {
  return classifyIpFinancialField(field)?.classification === 'deprecated';
}
