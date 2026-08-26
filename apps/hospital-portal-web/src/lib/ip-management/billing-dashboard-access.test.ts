import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveBillingDashboardAccess } from './billing-dashboard-access';

describe('resolveBillingDashboardAccess', () => {
  it('gives Billing Executive and Admin full access', () => {
    expect(resolveBillingDashboardAccess({ roles: ['BillingExecutive'] })).toBe('full');
    expect(resolveBillingDashboardAccess({ roles: ['Admin'] })).toBe('full');
    expect(resolveBillingDashboardAccess({ roles: ['Cashier'] })).toBe('full');
  });

  it('gives Finance Manager report/reconciliation access', () => {
    expect(resolveBillingDashboardAccess({ roles: ['FinanceManager'] })).toBe('finance');
    expect(resolveBillingDashboardAccess({ roles: ['Accountant'] })).toBe('finance');
  });

  it('restricts ward/nursing to financial blockers', () => {
    expect(resolveBillingDashboardAccess({ roles: ['Nurse'], userType: 'Nurse' })).toBe('ward');
    expect(resolveBillingDashboardAccess({ roles: ['WardIncharge'] })).toBe('ward');
  });

  it('restricts doctors to patient-relevant amounts', () => {
    expect(resolveBillingDashboardAccess({ roles: ['Doctor'] })).toBe('doctor');
    expect(resolveBillingDashboardAccess({ roles: [], userType: 'Doctor' })).toBe('doctor');
  });

  it('does not grant unmatched clinical-adjacent roles full ledgers', () => {
    expect(resolveBillingDashboardAccess({ roles: ['Optometrist'] })).toBe('doctor');
    expect(resolveBillingDashboardAccess({ roles: ['Reception'] })).toBe('doctor');
  });

  describe('empty claim (SEC-041 fail-closed)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('gives the narrowest scope when nothing is known about the caller', () => {
      expect(resolveBillingDashboardAccess({ roles: [], permissions: [] })).toBe('ward');
      expect(resolveBillingDashboardAccess({})).toBe('ward');
      expect(resolveBillingDashboardAccess({ roles: null, permissions: null })).toBe('ward');
    });

    it('does not fail open in production even with the flag set', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN', 'true');
      expect(resolveBillingDashboardAccess({ roles: [], permissions: [] })).toBe('ward');
    });

    it('restores full access in development when the flag is set', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN', 'true');
      expect(resolveBillingDashboardAccess({ roles: [], permissions: [] })).toBe('full');
    });

    it('leaves a non-empty claim unaffected by the flag', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN', 'true');
      expect(resolveBillingDashboardAccess({ roles: ['Nurse'] })).toBe('ward');
      expect(resolveBillingDashboardAccess({ roles: ['Optometrist'] })).toBe('doctor');
    });
  });
});
