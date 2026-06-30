/** Minimal policy OCR preview fixture for E2E (no OpenAI call). */
export const MOCK_POLICY_EXTRACTION_PREVIEW = {
  sessionId: 'e2e-policy-ocr-session',
  frontDocumentUrl: 'https://example.test/card-front.png',
  backDocumentUrl: null,
  originalFilename: 'card-front.png',
  providerModel: 'gpt-4.1-mini',
  processingMs: 120,
  hasDuplicateWarning: false,
  duplicateWarningDetail: null,
  fields: {
    insurerName: { value: 'ICICI Lombard', sourceText: null, confidence: 'High', mismatchReason: null },
    policyNumber: { value: 'E2E-OCR-POL-001', sourceText: null, confidence: 'High', mismatchReason: null },
    cardNumber: { value: null, sourceText: null, confidence: 'Low', mismatchReason: null },
    membershipNumber: { value: 'MEM-E2E-001', sourceText: null, confidence: 'Review', mismatchReason: null },
    insuredName: { value: 'E2E Test Patient', sourceText: null, confidence: 'High', mismatchReason: null },
    relationshipToInsured: { value: 'self', sourceText: null, confidence: 'High', mismatchReason: null },
    companyName: { value: null, sourceText: null, confidence: 'Low', mismatchReason: null },
    contactNumber: { value: null, sourceText: null, confidence: 'Low', mismatchReason: null },
    sumInsured: { value: 500000, sourceText: null, confidence: 'Review', mismatchReason: null },
    coPayPercent: { value: null, sourceText: null, confidence: 'Low', mismatchReason: null },
    validFrom: { value: null, sourceText: null, confidence: 'Low', mismatchReason: null },
    validTo: { value: null, sourceText: null, confidence: 'Low', mismatchReason: null },
    tpaName: { value: null, sourceText: null, confidence: 'Low', mismatchReason: null },
  },
  insurerCandidates: [],
  resolvedInsuranceProviderId: null,
};

export const MOCK_POLICY_CONFIRM_RESPONSE = {
  policyId: '00000000-0000-4000-8000-000000000001',
  policyNumber: 'E2E-OCR-POL-001',
  insurerName: 'ICICI Lombard',
};
