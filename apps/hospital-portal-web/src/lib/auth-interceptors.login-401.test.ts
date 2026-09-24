import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  attachAuthResponseInterceptor,
  shouldSkipSessionExpiredLogout,
} from '@/lib/auth-interceptors';

const logoutEverywhere = vi.hoisted(() => vi.fn(async () => undefined));
const refreshAccessToken = vi.hoisted(() => vi.fn(async () => false));

vi.mock('@/lib/logout-everywhere', () => ({
  logoutEverywhere,
}));

vi.mock('@/lib/token-refresh', () => ({
  refreshAccessToken,
  isTokenNearExpiry: () => false,
}));

describe('shouldSkipSessionExpiredLogout', () => {
  it('skips auth login and MFA endpoints so credential failures are not session-expired', () => {
    expect(shouldSkipSessionExpiredLogout('/auth/login')).toBe(true);
    expect(shouldSkipSessionExpiredLogout('/Auth/login')).toBe(true);
    expect(shouldSkipSessionExpiredLogout('http://localhost:5073/api/auth/login')).toBe(true);
    expect(shouldSkipSessionExpiredLogout('/auth/mfa/verify')).toBe(true);
    expect(shouldSkipSessionExpiredLogout('/auth/forgot-password')).toBe(true);
    expect(shouldSkipSessionExpiredLogout('/auth/validate-reset-token')).toBe(true);
    expect(shouldSkipSessionExpiredLogout('/auth/reset-password')).toBe(true);
  });

  it('does not skip protected API routes', () => {
    expect(shouldSkipSessionExpiredLogout('/users')).toBe(false);
    expect(shouldSkipSessionExpiredLogout('/Counseling/waiting-list')).toBe(false);
  });
});

describe('auth interceptor — login 401 must not claim session expired', () => {
  beforeEach(() => {
    logoutEverywhere.mockClear();
    refreshAccessToken.mockClear();
    refreshAccessToken.mockResolvedValue(false);
  });

  function harness(options?: { skipLogoutUrls?: string[] }) {
    let errorHandler: (error: unknown) => Promise<unknown> = async (e) => {
      throw e;
    };
    const instance = {
      interceptors: {
        response: {
          use: (_ok: unknown, err: (error: unknown) => Promise<unknown>) => {
            errorHandler = err;
          },
        },
      },
    } as unknown as AxiosInstance;

    attachAuthResponseInterceptor(instance, options);

    return {
      reject: (error: unknown) => errorHandler(error),
    };
  }

  it('rejects login 401 without logoutEverywhere(session-expired)', async () => {
    const h = harness();
    const err = {
      config: { url: '/auth/login' },
      response: { status: 401, data: { message: 'Invalid credentials' } },
    };
    await expect(h.reject(err)).rejects.toBe(err);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(logoutEverywhere).not.toHaveBeenCalled();
  });

  it('still session-expires protected API 401 when refresh fails', async () => {
    const h = harness();
    const err = {
      config: { url: '/Counseling/waiting-list', headers: {} },
      response: { status: 401, data: { message: 'Unauthorized' } },
    };
    await expect(h.reject(err)).rejects.toBe(err);
    expect(refreshAccessToken).toHaveBeenCalled();
    expect(logoutEverywhere).toHaveBeenCalledWith('session-expired');
  });
});
