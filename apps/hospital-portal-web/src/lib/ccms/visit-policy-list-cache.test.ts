import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import { ccmsKeys } from '@/hooks/use-ccms-case';
import { selectVisitPoliciesForDisplay } from './select-visit-policies-for-display';
import { publishAuthoritativeVisitPolicies } from './visit-policy-list-cache';

function policy(overrides: Partial<VisitPolicy> = {}): VisitPolicy {
  return {
    id: 'pol-1',
    coverageCaseId: 'case-1',
    policyNumber: 'POL-100',
    isPrimary: true,
    status: 'active',
    updatedAt: '2026-09-25T10:00:00Z',
    ...overrides,
  } as VisitPolicy;
}

describe('publishAuthoritativeVisitPolicies', () => {
  it('B2/B3 — writes the persisted policy into the VisitPolicyList query cache', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ccmsKeys.policies('case-1'), []);

    publishAuthoritativeVisitPolicies(queryClient, 'case-1', [policy()]);

    const cached = queryClient.getQueryData<VisitPolicy[]>(ccmsKeys.policies('case-1')) ?? [];
    const displayed = selectVisitPoliciesForDisplay(cached);
    expect(displayed).toHaveLength(1);
    expect(displayed[0]?.policyNumber).toBe('POL-100');
    expect(displayed[0]?.isPrimary).toBe(true);
  });

  it('B4 — a single persisted primary stays primary according to the returned row', () => {
    const queryClient = new QueryClient();
    publishAuthoritativeVisitPolicies(queryClient, 'case-1', [policy({ isPrimary: true })]);
    const displayed = selectVisitPoliciesForDisplay(
      queryClient.getQueryData<VisitPolicy[]>(ccmsKeys.policies('case-1')) ?? [],
    );
    expect(displayed.filter((row) => row.isPrimary)).toHaveLength(1);
  });

  it('B5 — publishing the read model does not invoke a create callback', () => {
    const createPolicy = vi.fn();
    const queryClient = new QueryClient();
    publishAuthoritativeVisitPolicies(queryClient, 'case-1', [policy()]);
    expect(createPolicy).not.toHaveBeenCalled();
  });

  it('B9 — does not duplicate a policy already in the authoritative list', () => {
    const queryClient = new QueryClient();
    const row = policy();
    publishAuthoritativeVisitPolicies(queryClient, 'case-1', [row, row]);
    const displayed = selectVisitPoliciesForDisplay(
      queryClient.getQueryData<VisitPolicy[]>(ccmsKeys.policies('case-1')) ?? [],
    );
    expect(displayed).toHaveLength(1);
    expect(displayed[0]?.policyNumber).toBe('POL-100');
  });
});

describe('Coverage Save Draft visit-policy read reconciliation', () => {
  const panelSource = readFileSync(
    join(__dirname, '../../components/counsellors-desk/coverage/CoveragePreauthPanel.tsx'),
    'utf8',
  );
  const formSource = readFileSync(
    join(__dirname, '../../components/ccms/VisitPolicyForm.tsx'),
    'utf8',
  );

  function persistDraftSource(): string {
    return (
      panelSource.match(
        /const persistDraft = useCallback\([\s\S]*?\n  const handleSubmitToClaims/,
      )?.[0] ?? ''
    );
  }

  it('B1/B6/B7/B8 — draft save still owns coverage case persistence and not a second policy POST', () => {
    const persist = persistDraftSource();
    expect(persist).toContain('updateCoverageCase');
    expect(persist).toContain('getPoliciesByCase');
    expect(persist).not.toContain('createPolicy');
    expect(persist).not.toContain('updatePolicy');
    expect(persist).toContain('requirePolicyNumber');
    expect(formSource).toContain('updatePolicy');
    expect(formSource).toContain('createPolicy');
  });

  it('B2/B10 — after the draft write, the existing policies query is updated from the read', () => {
    const persist = persistDraftSource();
    expect(persist).toContain('publishAuthoritativeVisitPolicies');
    expect(persist).toContain('queryClient');
    expect(panelSource).not.toMatch(/persistDraft[\s\S]*?router\.refresh/);
    expect(panelSource).not.toContain('setTimeout');
  });
});
