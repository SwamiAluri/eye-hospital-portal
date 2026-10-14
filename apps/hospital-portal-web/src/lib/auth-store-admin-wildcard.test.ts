import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth-store';

describe('auth-store Admin wildcard (L0 UAT prerequisite)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      roles: [],
      permissions: [],
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      mustChangePassword: false,
    });
  });

  it('treats * as unrestricted administrative access for laboratory.view / patient.*', () => {
    useAuthStore.setState({
      permissions: ['*'],
      roles: ['Admin'],
      isAuthenticated: true,
    });
    const { hasPermission } = useAuthStore.getState();
    expect(hasPermission('laboratory.view')).toBe(true);
    expect(hasPermission('patient.view')).toBe(true);
    expect(hasPermission('patient.update')).toBe(true);
    expect(hasPermission('any.other.code')).toBe(true);
  });

  it('does not grant wildcard behavior to ordinary explicit permission lists', () => {
    useAuthStore.setState({
      permissions: ['patient.view', 'laboratory.view'],
      roles: ['Lab Technician'],
      isAuthenticated: true,
    });
    const { hasPermission } = useAuthStore.getState();
    expect(hasPermission('laboratory.view')).toBe(true);
    expect(hasPermission('patient.view')).toBe(true);
    expect(hasPermission('patient.update')).toBe(false);
    expect(hasPermission('user.manage')).toBe(false);
  });
});
