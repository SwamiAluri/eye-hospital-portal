import { describe, expect, it } from 'vitest';
import { resolveCoverageDocumentPayerScope } from './resolve-coverage-document-scope';

const alignedPayers = [
  {
    providerCode: 'HDFC_ERGO',
    name: 'HDFC ERGO',
    ccmsId: '11111111-1111-1111-1111-111111111111',
    ccmsPayer: null,
    selectable: true,
  },
];

describe('resolveCoverageDocumentPayerScope', () => {
  it('prefers case insurance provider id', () => {
    const scope = resolveCoverageDocumentPayerScope({
      caseInsuranceProviderId: '22222222-2222-2222-2222-222222222222',
      formInsuranceProviderId: 'HDFC_ERGO',
      counsellingProviderId: '11111111-1111-1111-1111-111111111111',
      alignedPayers,
    });
    expect(scope.insuranceProviderId).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('falls back to form and counselling provider codes', () => {
    const scope = resolveCoverageDocumentPayerScope({
      formInsuranceProviderId: 'HDFC_ERGO',
      alignedPayers,
    });
    expect(scope.insuranceProviderId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('uses primary visit policy provider when case/form are empty', () => {
    const scope = resolveCoverageDocumentPayerScope({
      policies: [
        {
          id: 'p1',
          isPrimary: true,
          insuranceProviderId: 'HDFC_ERGO',
        } as never,
      ],
      alignedPayers,
    });
    expect(scope.insuranceProviderId).toBe('11111111-1111-1111-1111-111111111111');
  });
});
