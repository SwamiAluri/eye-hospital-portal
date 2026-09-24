import { describe, expect, it } from 'vitest';
import {
  AUTH_NETWORK_HOSPITAL_FIELD,
  isBranchNameInNetworkHospitalOptions,
} from '@/components/auth/network-hospital-login';
import { DEFAULT_LOGIN_TENANT_ID, mergeLoginTenants, type AuthTenant } from '@/components/auth/useAuthTenants';

describe('Network Hospital login selector semantics', () => {
  it('uses Network Hospital label (not Hospital / not Branch)', () => {
    expect(AUTH_NETWORK_HOSPITAL_FIELD.label).toBe('Network Hospital');
    expect(AUTH_NETWORK_HOSPITAL_FIELD.placeholder).toMatch(/network hospital/i);
    expect(AUTH_NETWORK_HOSPITAL_FIELD.loadingText).toMatch(/network hospital/i);
    expect(AUTH_NETWORK_HOSPITAL_FIELD.label.toLowerCase()).not.toBe('hospital');
  });

  it('loads tenant/network entities and does not treat operational branches as networks', () => {
    const tenants: AuthTenant[] = mergeLoginTenants([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Apollo Hospitals',
        tenantCode: 'APOLLO',
      },
    ]);

    expect(tenants.some((t) => t.id === DEFAULT_LOGIN_TENANT_ID)).toBe(true);
    expect(tenants.map((t) => t.name)).toContain('India Eye Hospital Network');
    expect(
      isBranchNameInNetworkHospitalOptions(
        tenants.map((t) => t.name),
        'Hyderabad Eye Clinic - Banjara Hills',
      ),
    ).toBe(false);
  });
});
