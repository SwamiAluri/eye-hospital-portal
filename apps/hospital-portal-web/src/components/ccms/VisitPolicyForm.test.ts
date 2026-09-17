import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Presentation contract for Add Insurance Policy — keep counselling dialog tokens,
 * never reintroduce indigo/portal overlay styling.
 */
describe('VisitPolicyForm counselling presentation contract', () => {
  const source = readFileSync(join(__dirname, 'VisitPolicyForm.tsx'), 'utf8');

  it('uses CounsellingDialog / Button / Input primitives', () => {
    expect(source).toContain('CounsellingDialog');
    expect(source).toContain('CounsellingButton');
    expect(source).toContain('CounsellingInput');
    expect(source).toContain('Policy Details');
    expect(source).toContain('Additional Details');
    expect(source).toContain('Add Policy');
  });

  it('does not use indigo portal styling', () => {
    expect(source).not.toMatch(/indigo-/);
    expect(source).not.toContain('createPortal');
    expect(source).not.toContain('bg-indigo-600');
  });

  it('preserves existing payload field names', () => {
    expect(source).toContain('policyNumber');
    expect(source).toContain('cardNumber');
    expect(source).toContain('membershipNumber');
    expect(source).toContain('insuredName');
    expect(source).toContain('relationshipToInsured');
    expect(source).toContain('companyName');
    expect(source).toContain('contactNumber');
    expect(source).toContain('accommodationClass');
    expect(source).toContain('tpaCoordinatorName');
    expect(source).toContain('serviceTaxApplicable');
    expect(source).toContain('isPrimary');
    expect(source).toContain('createPolicy');
    expect(source).toContain('updatePolicy');
  });

  it('uses professional empty/select labels and free-text company/employer', () => {
    expect(source).toContain('Select relationship');
    expect(source).toContain('Select room class');
    expect(source).toContain('Enter company or employer name');
    expect(source).not.toContain('— Select —');
    expect(source).not.toContain('useTpaProviderMaster');
    expect(source).not.toContain('visit-policy-tpa-suggestions');
  });
});
