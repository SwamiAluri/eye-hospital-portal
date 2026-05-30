import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './auth-store';
import { isTokenNearExpiry, refreshAccessToken } from './token-refresh';
import { logoutEverywhere } from './logout-everywhere';

type RetryConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

/** Attach tenant + bearer token; proactively refresh when near expiry. */
export function attachAuthRequestInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use(async (config) => {
    let { tenantId, token } = useAuthStore.getState();

    if (token && isTokenNearExpiry(token)) {
      const ok = await refreshAccessToken();
      if (ok) token = useAuthStore.getState().token;
    }

    const headers = config.headers as Record<string, string>;
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return config;
  });
}

/**
 * On 401: attempt one silent token refresh + retry.
 * Falls back to logout + redirect when refresh fails.
 */
export function attachAuthResponseInterceptor(
  instance: AxiosInstance,
  options?: { skipLogoutUrls?: string[] },
): void {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config as RetryConfig | undefined;
      const status = error.response?.status;
      const url: string = config?.url ?? '';

      if (process.env.NODE_ENV !== 'production') {
        console.error('[API]', url, status, error.response?.data);
      }

      if (status !== 401 || !config || config._authRetry) {
        if (status === 403 && typeof window !== 'undefined') {
          window.location.href = '/dashboard/unauthorized';
        }
        return Promise.reject(error);
      }

      const skip = options?.skipLogoutUrls?.some((path) => url.includes(path));
      if (skip) return Promise.reject(error);

      config._authRetry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const token = useAuthStore.getState().token;
        if (token) {
          (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
        return instance(config);
      }

      await logoutEverywhere('session-expired');
      return Promise.reject(error);
    },
  );
}

/** Extract a human-readable message from an Axios error. */
export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { status?: number; data?: { error?: string; message?: string } } }).response;
    if (resp?.status === 401) return 'Session expired — please sign in again.';
    const msg = resp?.data?.error ?? resp?.data?.message;
    if (msg) return msg;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
