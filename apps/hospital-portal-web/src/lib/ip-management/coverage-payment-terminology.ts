/**
 * Phase 3 — canonical Coverage / Payment / Discharge vocabulary.
 *
 * Use these labels across Counselling, Ward/IP, Billing, and CCMS so the same
 * concept is not shown under incompatible names.
 *
 * Do not use the ambiguous phrase "Financial Clearance" for coverage readiness,
 * patient payment, or payer settlement.
 */

export const CoveragePaymentTerms = {
  /** CCMS case / eligibility / authorization readiness (what the payer may pay). */
  coverageStatus: 'Coverage Status',

  /** Pre-auth / approval / rejection state owned by CCMS. */
  authorizationStatus: 'Authorization Status',

  /** Patient responsibility / advances / outstanding (Billing + IP projection). */
  patientPaymentStatus: 'Patient Payment Status',

  /** Payer / claim payment state owned by CCMS settlement. */
  payerPaymentStatus: 'Payer Payment Status',

  /** IP clinical journey complete — patient left the ward. */
  clinicalDischarge: 'Clinical Discharge',

  /** Claim / bill closed financially — Billing + CCMS, not IP clinical state. */
  financialSettlement: 'Financial Settlement',

  /** Ward step that projects coverage + payment (not an editable clearance form). */
  coverageAndPaymentStatus: 'Coverage & Payment Status',

  /**
   * Privileged admit override only. Not a synonym for coverage approval or
   * patient payment complete.
   */
  emergencyFinancialClearance: 'Emergency Financial Clearance',
} as const;

export type CoveragePaymentTermKey = keyof typeof CoveragePaymentTerms;

/** Phrases that must not be used as a stand-alone status when meaning is ambiguous. */
export const AmbiguousFinancialPhrases = ['Financial Clearance', 'Financial clearance'] as const;

export function isAmbiguousFinancialPhrase(label: string): boolean {
  return AmbiguousFinancialPhrases.some(
    (p) => p.localeCompare(label.trim(), undefined, { sensitivity: 'accent' }) === 0,
  );
}
