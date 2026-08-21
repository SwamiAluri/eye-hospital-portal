import { describe, expect, it } from 'vitest';
import {
  AmbiguousFinancialPhrases,
  CoveragePaymentTerms,
  isAmbiguousFinancialPhrase,
} from './coverage-payment-terminology';

describe('coverage-payment-terminology (Phase 3)', () => {
  it('defines distinct clinical discharge vs financial settlement labels', () => {
    expect(CoveragePaymentTerms.clinicalDischarge).toBe('Clinical Discharge');
    expect(CoveragePaymentTerms.financialSettlement).toBe('Financial Settlement');
    expect(CoveragePaymentTerms.clinicalDischarge).not.toBe(
      CoveragePaymentTerms.financialSettlement,
    );
  });

  it('keeps Coverage & Payment Status as the ward step label', () => {
    expect(CoveragePaymentTerms.coverageAndPaymentStatus).toBe('Coverage & Payment Status');
  });

  it('flags ambiguous Financial Clearance phrasing', () => {
    for (const phrase of AmbiguousFinancialPhrases) {
      expect(isAmbiguousFinancialPhrase(phrase)).toBe(true);
    }
    expect(isAmbiguousFinancialPhrase(CoveragePaymentTerms.coverageStatus)).toBe(false);
    expect(isAmbiguousFinancialPhrase(CoveragePaymentTerms.patientPaymentStatus)).toBe(false);
  });
});
