import { describe, expect, it } from 'vitest';
import {
  IP_FINANCIAL_FIELD_CLASSIFICATION,
  classifyIpFinancialField,
  isDeprecatedIpFinancialField,
} from './ip-financial-field-classification';

describe('ip-financial-field-classification (Phase 3)', () => {
  it('classifies InsurancePreauthSubmitted as deprecated under CCMS ownership', () => {
    const meta = classifyIpFinancialField('InsurancePreauthSubmitted');
    expect(meta?.classification).toBe('deprecated');
    expect(meta?.canonicalOwner).toBe('CCMS');
    expect(isDeprecatedIpFinancialField('InsurancePreauthSubmitted')).toBe(true);
  });

  it('keeps PaymentMode as clinical workflow owned by IP', () => {
    const meta = classifyIpFinancialField('PaymentMode');
    expect(meta?.classification).toBe('clinical_workflow');
    expect(meta?.canonicalOwner).toBe('IP');
  });

  it('treats TotalPaid / BalanceDue as billing projections', () => {
    expect(classifyIpFinancialField('TotalPaid')?.classification).toBe('billing_projection');
    expect(classifyIpFinancialField('BalanceDue')?.canonicalOwner).toBe('Billing');
  });

  it('does not leave FinancialState as hospital-wide Billing SoT', () => {
    const meta = classifyIpFinancialField('FinancialState');
    expect(meta?.canonicalOwner).toBe('IP');
    expect(meta?.notes.toLowerCase()).toContain('billing');
  });

  it('includes every Phase 3 audited field', () => {
    const fields = IP_FINANCIAL_FIELD_CLASSIFICATION.map((f) => f.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'FinancialState',
        'PaymentMode',
        'PackageAmount',
        'TotalPaid',
        'BalanceDue',
        'InsurancePreauthSubmitted',
        'GovernmentApprovalSubmitted',
      ]),
    );
  });
});
