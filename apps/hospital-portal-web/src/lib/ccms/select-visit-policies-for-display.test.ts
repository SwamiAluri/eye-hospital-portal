import { describe, expect, it } from 'vitest';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import { selectVisitPoliciesForDisplay } from './select-visit-policies-for-display';

/**
 * The API remains the source of truth. This presentation guard prevents a known
 * duplicate policy-number write defect from producing duplicate operational display rows.
 */

function policy(overrides: Partial<VisitPolicy> & { id: string; policyNumber: string }): VisitPolicy {
  return {
    tenantId: 'tenant-1',
    isPrimary: false,
    sortOrder: 1,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectVisitPoliciesForDisplay', () => {
  it('returns empty for empty input', () => {
    expect(selectVisitPoliciesForDisplay([])).toEqual([]);
  });

  it('returns one policy unchanged', () => {
    const one = policy({ id: 'a', policyNumber: '56/B7890/2026/98765', isPrimary: true });
    expect(selectVisitPoliciesForDisplay([one])).toEqual([one]);
  });

  it('keeps two policies with different numbers', () => {
    const a = policy({ id: 'a', policyNumber: 'POL-1', isPrimary: true });
    const b = policy({ id: 'b', policyNumber: 'POL-2', isPrimary: false });
    expect(selectVisitPoliciesForDisplay([a, b])).toEqual([a, b]);
  });

  it('collapses same policy number to one display row', () => {
    const a = policy({
      id: 'a',
      policyNumber: '56/B7890/2026/98765',
      isPrimary: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const b = policy({
      id: 'b',
      policyNumber: '56/B7890/2026/98765',
      isPrimary: false,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(selectVisitPoliciesForDisplay([a, b])).toEqual([a]);
  });

  it('when duplicate and exactly one primary — retains primary', () => {
    const olderPrimary = policy({
      id: 'primary',
      policyNumber: 'SAME',
      isPrimary: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const newerSecondary = policy({
      id: 'secondary',
      policyNumber: 'SAME',
      isPrimary: false,
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(selectVisitPoliciesForDisplay([newerSecondary, olderPrimary])).toEqual([olderPrimary]);
  });

  it('when duplicate and neither primary — keeps newest updatedAt', () => {
    const older = policy({
      id: 'old',
      policyNumber: 'SAME',
      isPrimary: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = policy({
      id: 'new',
      policyNumber: 'SAME',
      isPrimary: false,
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(selectVisitPoliciesForDisplay([older, newer])).toEqual([newer]);
  });

  it('when duplicate and both primary — keeps newest updatedAt (deterministic)', () => {
    const older = policy({
      id: 'old-p',
      policyNumber: 'SAME',
      isPrimary: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = policy({
      id: 'new-p',
      policyNumber: 'SAME',
      isPrimary: true,
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(selectVisitPoliciesForDisplay([older, newer])).toEqual([newer]);
  });

  it('ignores soft-deleted duplicates (status deleted or deletedAt-like status)', () => {
    const active = policy({
      id: 'active',
      policyNumber: 'SAME',
      isPrimary: true,
      status: 'active',
    });
    const deleted = policy({
      id: 'deleted',
      policyNumber: 'SAME',
      isPrimary: false,
      status: 'deleted',
    });
    expect(selectVisitPoliciesForDisplay([active, deleted])).toEqual([active]);
  });

  it('normalizes case and whitespace for policy number comparison', () => {
    const a = policy({
      id: 'a',
      policyNumber: '  pol-abc  ',
      isPrimary: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const b = policy({
      id: 'b',
      policyNumber: 'POL-ABC',
      isPrimary: false,
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(selectVisitPoliciesForDisplay([a, b])).toEqual([a]);
  });

  it('leaves distinct policy numbers untouched alongside a collapsed duplicate', () => {
    const dupA = policy({
      id: 'd1',
      policyNumber: 'DUP',
      isPrimary: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const dupB = policy({
      id: 'd2',
      policyNumber: 'DUP',
      isPrimary: false,
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    const other = policy({
      id: 'o',
      policyNumber: 'OTHER',
      isPrimary: false,
      sortOrder: 2,
    });
    expect(selectVisitPoliciesForDisplay([dupA, other, dupB])).toEqual([dupA, other]);
  });
});
