import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import { LMS_NAV_ITEMS } from '@/lib/lms/lms-navigation';
import { LMS_CRITICAL_PERMISSIONS } from '@/lib/lms/lms-permissions';
import { testingWorkQueuePrimaryAction } from '@/lib/lms/testing-work-queue-actions';

const srcRoot = join(__dirname, '../../../../../');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('L-CRT-UX-01 Authorized Results discovery', () => {
  it('registers Authorized Results capability as implemented', () => {
    const cap = LMS_CAPABILITIES.find((c) => c.id === 'results-authorized');
    expect(cap?.status).toBe('implemented');
    expect(cap?.href).toBe('/dashboard/lms/results/authorized');
    expect(cap?.description).toMatch(/ClinicallyAuthorized/i);
    expect(cap?.description).toMatch(/Not Final/i);
  });

  it('exposes Authorized Results under Results & Authorization navigation', () => {
    const results = LMS_NAV_ITEMS.find((i) => i.href === '/dashboard/lms/results');
    const authorized = results?.subItems?.find((s) => s.href === '/dashboard/lms/results/authorized');
    expect(authorized?.label).toBe('Authorized Results');
    const labels = results?.subItems?.map((s) => s.label) ?? [];
    expect(labels.indexOf('Authorized Results')).toBeGreaterThan(labels.indexOf('Authorization'));
    expect(labels.indexOf('Authorized Results')).toBeLessThan(labels.indexOf('Critical Results'));
  });

  it('Authorized Results page filters ClinicallyAuthorized via TestingWorkbench', () => {
    const page = read('app/dashboard/lms/results/authorized/page.tsx');
    expect(page).toContain('Authorized Results');
    expect(page).toContain('resultStatus="ClinicallyAuthorized"');
    expect(page).toContain('TestingWorkbench');
    expect(page).toMatch(/Not Final/i);
    expect(page).toMatch(/patient-visible/i);
    expect(page).not.toContain('CriticalResultEvent');
    expect(page).not.toContain('createLmsCriticalEvent');
  });

  it('ClinicallyAuthorized primary action is open-result with manual-results URL shape', () => {
    const action = testingWorkQueuePrimaryAction({
      resultId: 'r-ca',
      resultStatus: 'ClinicallyAuthorized',
    });
    expect(action).toEqual({ kind: 'open-result', label: 'Open result' });

    const wb = read('components/lms/testing/TestingWorkbench.tsx');
    expect(wb).toContain(
      '`/dashboard/lms/testing/manual-results?orderTestId=${row.orderTestId}&specimenId=${row.specimenId}&operatingBranchId=${branchId}`',
    );
    expect(wb).toContain('listLmsTestingWorkQueue');
    expect(wb).toContain('resultStatus: props?.resultStatus');
  });

  it('preserves Draft and TechnicalVerified primary actions', () => {
    expect(testingWorkQueuePrimaryAction({ resultId: null })).toEqual({
      kind: 'enter-draft',
      label: 'Enter draft',
    });
    expect(
      testingWorkQueuePrimaryAction({ resultId: 'r1', resultStatus: 'Draft' }),
    ).toEqual({ kind: 'edit-draft', label: 'Edit draft' });
    expect(
      testingWorkQueuePrimaryAction({
        resultId: 'r1',
        resultStatus: 'TechnicalVerified',
      }),
    ).toEqual({ kind: 'open-result', label: 'Open result' });
  });

  it('Critical Results remains event-backed; Critical manage permission unchanged', () => {
    const criticalPage = read('app/dashboard/lms/results/critical/page.tsx');
    expect(criticalPage).toContain('CriticalWorkbench');
    const criticalWb = read('components/lms/testing/CriticalWorkbench.tsx');
    expect(criticalWb).toContain('listLmsCriticalWorkQueue');
    expect(criticalWb).toContain('No Critical events');
    expect(LMS_CRITICAL_PERMISSIONS.manage).toBe('lms.results.critical.manage');
  });

  it('does not add permission catalog codes or Critical create on open', () => {
    const page = read('app/dashboard/lms/results/authorized/page.tsx');
    expect(page).not.toMatch(/lms\.results\.critical\./);
    expect(page).not.toContain('createLmsCriticalEvent');
    const panel = read('components/lms/testing/CriticalResultPanel.tsx');
    expect(panel).toContain('Mark as Critical');
    expect(panel).toContain("resultStatus === 'ClinicallyAuthorized'");
  });

  it('Testing default and Authorization filters remain unchanged', () => {
    const testingPage = read('app/dashboard/lms/testing/page.tsx');
    expect(testingPage).toContain('<TestingWorkbench />');
    expect(testingPage).not.toContain('resultStatus=');
    const authPage = read('app/dashboard/lms/results/authorization/page.tsx');
    expect(authPage).toContain('resultStatus="TechnicalVerified"');
    const verifyPage = read('app/dashboard/lms/results/verification/page.tsx');
    expect(verifyPage).toContain('resultStatus="Draft"');
  });
});
