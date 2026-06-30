/** data-testid conventions for Coverage & Pre-Auth E2E */
export const coverageTestIds = {
  insurerName: 'coverage-insurer-name',
  estimatedAmount: 'coverage-estimated-amount',
  policyOcrPanel: 'policy-card-ocr-panel',
  policyOcrSlotFront: 'policy-ocr-slot-insurance_card_front',
  policyOcrSlotBack: 'policy-ocr-slot-insurance_card_back',
  policyExtractionReview: 'policy-extraction-review',
  saveCoverageDraft: 'coverage-save-draft', // deprecated — use counselling-btn-save-draft in footer
  visitPolicyNumber: 'visit-policy-number',
  visitPolicySave: 'visit-policy-save',
  visitPolicyAdd: 'visit-policy-add',
  surgeryDate: 'coverage-surgery-date',
  policyExpiryDate: 'coverage-policy-expiry-date',
  stepPolicy: 'coverage-step-policy',
  stepEstimate: 'coverage-step-estimate',
  stepDocuments: 'coverage-step-documents',
  visitPoliciesRail: 'coverage-visit-policies-rail',
  manageVisitPolicies: 'coverage-manage-visit-policies',
  submitToClaims: 'coverage-submit-to-claims',
} as const;
