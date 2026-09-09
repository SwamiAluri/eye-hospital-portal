import { describe, expect, it } from 'vitest';
import {
  buildCoverageFormHydrationFromPolicies,
  buildVisitPolicyFromCoverageForm,
  canEnableSubmitToClaims,
  canSyncVisitPolicyFromCoverageForm,
  coverageFormPatchFromVisitPolicy,
  hasDbPrimaryVisitPolicy,
  isCoveragePolicyStepComplete,
  resolvePreferredVisitPolicy,
  shouldHydrateCoverageFormFromVisitPolicies,
  shouldOfferImportPolicyFromCounsellorDraft,
} from './ccms-visit-policy-prereq';
import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';

const CASE_ID = '00000000-0000-4000-8000-000000000001';

function form(overrides: Partial<CoveragePanelForm> = {}): CoveragePanelForm {
  return {
    policyNumber: '',
    insurerName: '',
    insuranceProviderId: '',
    ...overrides,
  } as CoveragePanelForm;
}

function primaryPolicy(overrides: Partial<VisitPolicy> = {}): VisitPolicy {
  return {
    id: 'pol-1',
    policyNumber: 'POL-123',
    isPrimary: true,
    tenantId: 't1',
    sortOrder: 1,
    status: 'active',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('ccms-visit-policy-prereq — counselling save coupling', () => {
  it('does not attempt visit-policy sync when policy number is absent', () => {
    expect(
      canSyncVisitPolicyFromCoverageForm(
        form({ insurerName: 'New India Assurance', insuranceProviderId: 'p1' }),
      ),
    ).toBe(false);
    expect(buildVisitPolicyFromCoverageForm(CASE_ID, form({ insurerName: 'Star Health' }))).toBeNull();
  });

  it('allows visit-policy sync when insurer and policy number are present', () => {
    const ready = form({
      policyNumber: 'POL-123',
      insurerName: 'New India Assurance',
      insuranceProviderId: '00000000-0000-4000-8000-000000000099',
    });
    expect(canSyncVisitPolicyFromCoverageForm(ready)).toBe(true);
    expect(buildVisitPolicyFromCoverageForm(CASE_ID, ready)?.policyNumber).toBe('POL-123');
  });

  it('policy step complete requires DB primary with number', () => {
    expect(canEnableSubmitToClaims([])).toBe(false);
    expect(isCoveragePolicyStepComplete([primaryPolicy({ isPrimary: false })])).toBe(false);
    expect(isCoveragePolicyStepComplete([primaryPolicy({ policyNumber: '  ' })])).toBe(false);
    expect(hasDbPrimaryVisitPolicy([primaryPolicy()])).toBe(true);
    expect(isCoveragePolicyStepComplete([primaryPolicy()])).toBe(true);
  });
});

describe('shouldOfferImportPolicyFromCounsellorDraft', () => {
  it('offers import only when draft has number and visit list is empty', () => {
    expect(
      shouldOfferImportPolicyFromCounsellorDraft({
        hasCaseId: true,
        readOnly: false,
        draftPolicyNumber: '34500980098654',
        policies: [],
      }),
    ).toBe(true);
  });

  it('hides import when any visit policy row already exists', () => {
    expect(
      shouldOfferImportPolicyFromCounsellorDraft({
        hasCaseId: true,
        readOnly: false,
        draftPolicyNumber: '34500980098654',
        policies: [primaryPolicy({ isPrimary: false })],
      }),
    ).toBe(false);
  });

  it('hides import when primary already exists', () => {
    expect(
      shouldOfferImportPolicyFromCounsellorDraft({
        hasCaseId: true,
        readOnly: false,
        draftPolicyNumber: 'OTHER',
        policies: [primaryPolicy()],
      }),
    ).toBe(false);
  });
});

describe('visit policy → coverage form hydration', () => {
  it('prefers primary policy when multiple exist', () => {
    const preferred = resolvePreferredVisitPolicy([
      primaryPolicy({ id: 'a', policyNumber: '111', isPrimary: false }),
      primaryPolicy({ id: 'b', policyNumber: '34500980098654', isPrimary: true }),
    ]);
    expect(preferred?.policyNumber).toBe('34500980098654');
  });

  it('hydrates empty form from primary visit policy', () => {
    const policies = [
      primaryPolicy({
        policyNumber: '34500980098654',
        membershipNumber: 'M-9',
        insuredName: 'Venkatesh',
        relationshipToInsured: 'self',
        accommodationClass: 'private',
        insuranceProviderName: 'Future Generali',
      }),
    ];
    expect(shouldHydrateCoverageFormFromVisitPolicies(form(), policies)).toBe(true);
    const patch = buildCoverageFormHydrationFromPolicies(form(), policies);
    expect(patch).toMatchObject({
      policyNumber: '34500980098654',
      membershipNumber: 'M-9',
      insuredName: 'Venkatesh',
      relationshipToInsured: 'Self',
      roomClassEntitlement: 'Private',
      insurerName: 'Future Generali',
    });
  });

  it('does not clobber a typed policy number that is not yet on the visit list', () => {
    const policies = [primaryPolicy({ policyNumber: '34500980098654' })];
    expect(
      shouldHydrateCoverageFormFromVisitPolicies(form({ policyNumber: 'NEW-TYPED-99' }), policies),
    ).toBe(false);
    expect(
      buildCoverageFormHydrationFromPolicies(form({ policyNumber: 'NEW-TYPED-99' }), policies),
    ).toBeNull();
  });

  it('switches form to primary when current number is a non-primary visit policy', () => {
    const policies = [
      primaryPolicy({ id: 'a', policyNumber: '111', isPrimary: false }),
      primaryPolicy({ id: 'b', policyNumber: '222', isPrimary: true }),
    ];
    expect(shouldHydrateCoverageFormFromVisitPolicies(form({ policyNumber: '111' }), policies)).toBe(
      true,
    );
    expect(coverageFormPatchFromVisitPolicy(policies[1]!).policyNumber).toBe('222');
  });
});
