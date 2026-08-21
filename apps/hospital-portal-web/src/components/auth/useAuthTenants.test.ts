import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGIN_TENANT_ID,
  mergeLoginTenants,
  pickDefaultTenantId,
  type AuthTenant,
} from '@/components/auth/useAuthTenants';

describe('pickDefaultTenantId', () => {
  const indiaEye: AuthTenant = {
    id: DEFAULT_LOGIN_TENANT_ID,
    name: 'India Eye Hospital Network',
    tenantCode: 'INDIA_EYE_NET',
  };

  const other: AuthTenant = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Apollo Hospitals - Main',
    tenantCode: 'APOLLO-MAIN',
  };

  it('prefers India Eye when present regardless of list order', () => {
    expect(pickDefaultTenantId([other, indiaEye])).toBe(DEFAULT_LOGIN_TENANT_ID);
    expect(pickDefaultTenantId([indiaEye, other])).toBe(DEFAULT_LOGIN_TENANT_ID);
  });

  it('always defaults to India Eye after merge', () => {
    expect(pickDefaultTenantId(mergeLoginTenants([other]))).toBe(DEFAULT_LOGIN_TENANT_ID);
    expect(mergeLoginTenants([other]).map(t => t.id)).toEqual([
      DEFAULT_LOGIN_TENANT_ID,
      other.id,
    ]);
  });

  it('falls back to first tenant when India Eye is absent', () => {
    expect(pickDefaultTenantId([other])).toBe(other.id);
  });

  it('returns default id for empty list', () => {
    expect(pickDefaultTenantId([])).toBe(DEFAULT_LOGIN_TENANT_ID);
  });
});
