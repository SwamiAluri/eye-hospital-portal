import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import { attachAuthResponseInterceptor } from '@/lib/auth-interceptors';

describe('auth interceptor — per-request skipForbiddenRedirect (Assign 403)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { href: 'http://localhost/dashboard/counsellors-desk/waiting-list' },
    });
  });

  function harness() {
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

    attachAuthResponseInterceptor(instance);

    return {
      reject: (error: unknown) => errorHandler(error),
      get href() {
        return (window as { location: { href: string } }).location.href;
      },
    };
  }

  it('redirects to /dashboard/unauthorized on 403 by default', async () => {
    const h = harness();
    await expect(
      h.reject({
        config: { url: '/Counseling/sessions/x/assign' },
        response: { status: 403, data: { message: 'Forbidden' } },
      }),
    ).rejects.toBeTruthy();
    expect(h.href).toBe('/dashboard/unauthorized');
  });

  it('does NOT redirect when request sets skipForbiddenRedirect (Assign path)', async () => {
    const h = harness();
    const err = {
      config: {
        url: '/Counseling/sessions/sess-1/assign',
        skipForbiddenRedirect: true,
      },
      response: {
        status: 403,
        data: { message: 'Target counsellor is not authorized for this session branch.' },
      },
    };
    await expect(h.reject(err)).rejects.toBe(err);
    expect(h.href).toBe('http://localhost/dashboard/counsellors-desk/waiting-list');
  });
});
