import { describe, expect, it } from 'vitest';
import {
  applyVisitPolicyHydrationToForm,
  buildCoverageFormHydrationFromPolicies,
  resolveVisitPolicySyncPlan,
} from './ccms-visit-policy-prereq';
import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';

const CASE_ID = '00000000-0000-4000-8000-000000000001';
const PROVIDER_ID = '00000000-0000-4000-8000-000000000099';

function form(overrides: Partial<CoveragePanelForm> = {}): CoveragePanelForm {
  return {
    policyNumber: '',
    insurerName: 'HDFC Ergo',
    insuranceProviderId: PROVIDER_ID,
    ...overrides,
  } as CoveragePanelForm;
}

function primaryPolicy(overrides: Partial<VisitPolicy> = {}): VisitPolicy {
  return {
    id: 'pol-1',
    policyNumber: '897654344445',
    isPrimary: true,
    tenantId: 't1',
    sortOrder: 1,
    status: 'active',
    createdAt: '',
    updatedAt: '',
    membershipNumber: 'M-1',
    insuredName: 'Vasantha',
    ...overrides,
  };
}

describe('applyVisitPolicyHydrationToForm — survive draft rebuild', () => {
  it('fills policyNumber when draft rebuild left it empty and primary exists', () => {
    const policies = [primaryPolicy()];
    const rebuilt = form({ policyNumber: '', insurerName: 'HDFC Ergo' });
    const next = applyVisitPolicyHydrationToForm(rebuilt, policies);
    expect(next.policyNumber).toBe('897654344445');
    expect(next.membershipNumber).toBe('M-1');
    expect(next.insuredName).toBe('Vasantha');
  });

  it('keeps policyNumber after simulate load then hydrate (integration-style)', () => {
    const policies = [primaryPolicy()];
    // First hydrate
    let state = applyVisitPolicyHydrationToForm(form(), policies);
    expect(state.policyNumber).toBe('897654344445');
    // load(true) / persistDraft rebuild from case draft without policy number
    const fromDraft = form({ policyNumber: undefined, insurerName: 'HDFC Ergo' });
    state = applyVisitPolicyHydrationToForm(fromDraft, policies);
    expect(state.policyNumber).toBe('897654344445');
  });

  it('does not clobber a typed number that is not on the visit list', () => {
    const policies = [primaryPolicy()];
    const next = applyVisitPolicyHydrationToForm(
      form({ policyNumber: 'NEW-TYPED-99' }),
      policies,
    );
    expect(next.policyNumber).toBe('NEW-TYPED-99');
    expect(buildCoverageFormHydrationFromPolicies(form({ policyNumber: 'NEW-TYPED-99' }), policies)).toBeNull();
  });
});

describe('resolveVisitPolicySyncPlan — update primary vs create', () => {
  it('creates when no visit policies exist', () => {
    const plan = resolveVisitPolicySyncPlan(CASE_ID, form({ policyNumber: 'NEW-1' }), []);
    expect(plan.action).toBe('create');
    if (plan.action === 'create') {
      expect(plan.payload.policyNumber).toBe('NEW-1');
      expect(plan.payload.isPrimary).toBe(true);
    }
  });

  it('updates existing primary when form matches that number', () => {
    const policies = [primaryPolicy()];
    const plan = resolveVisitPolicySyncPlan(
      CASE_ID,
      form({
        policyNumber: '897654344445',
        membershipNumber: 'M-UPDATED',
        insuredName: 'Updated Name',
      }),
      policies,
    );
    expect(plan.action).toBe('update');
    if (plan.action === 'update') {
      expect(plan.policyId).toBe('pol-1');
      expect(plan.payload.membershipNumber).toBe('M-UPDATED');
      expect(plan.payload.insuredName).toBe('Updated Name');
      expect(plan.setPrimary).toBeFalsy();
    }
  });

  it('updates primary when form has a different number but policies already exist (no silent create)', () => {
    const policies = [primaryPolicy()];
    const plan = resolveVisitPolicySyncPlan(
      CASE_ID,
      form({ policyNumber: '999999999999' }),
      policies,
    );
    expect(plan.action).toBe('update');
    if (plan.action === 'update') {
      expect(plan.policyId).toBe('pol-1');
      expect(plan.payload.policyNumber).toBe('999999999999');
    }
  });

  it('updates selected policy id when provided', () => {
    const policies = [
      primaryPolicy({ id: 'pol-a', policyNumber: '111', isPrimary: true }),
      primaryPolicy({ id: 'pol-b', policyNumber: '222', isPrimary: false }),
    ];
    const plan = resolveVisitPolicySyncPlan(
      CASE_ID,
      form({ policyNumber: '222' }),
      policies,
      { selectedPolicyId: 'pol-b' },
    );
    expect(plan.action).toBe('update');
    if (plan.action === 'update') {
      expect(plan.policyId).toBe('pol-b');
      expect(plan.setPrimary).toBe(true);
    }
  });

  it('skips when form cannot sync', () => {
    expect(resolveVisitPolicySyncPlan(CASE_ID, form({ policyNumber: '' }), [primaryPolicy()]).action).toBe(
      'skip',
    );
  });
});
