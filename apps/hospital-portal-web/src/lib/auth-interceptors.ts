import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './auth-store';
import { isTokenNearExpiry, refreshAccessToken } from './token-refresh';
import { logoutEverywhere } from './logout-everywhere';

/** Per-request flag: keep 403 on the caller (toast/dialog) instead of hard-redirect. */
export type AuthAxiosRequestConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean;
  skipForbiddenRedirect?: boolean;
};

type RetryConfig = AuthAxiosRequestConfig;

/**
 * Public auth endpoints return 401 for bad credentials / MFA codes.
 * Those must not be rewritten as "session expired" via logoutEverywhere.
 */
export const AUTH_SESSION_LOGOUT_SKIP_PATHS = [
  '/auth/login',
  '/auth/mfa',
  '/auth/forgot-password',
  '/auth/validate-reset-token',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/login-with-otp',
] as const;

export function shouldSkipSessionExpiredLogout(url: string): boolean {
  const path = (url || '').toLowerCase();
  return AUTH_SESSION_LOGOUT_SKIP_PATHS.some((p) => path.includes(p));
}

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
 *
 * On 403: by default hard-redirect to Access Denied (protected staff workflows).
 * Callers that intentionally treat 403 as in-context (e.g. Assign dialog, Azure
 * enrichment) may set instance `skipForbiddenRedirect` or per-request
 * `config.skipForbiddenRedirect`.
 */
export function attachAuthResponseInterceptor(
  instance: AxiosInstance,
  options?: { skipLogoutUrls?: string[]; skipForbiddenRedirect?: boolean },
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
        const skipForbidden =
          options?.skipForbiddenRedirect === true ||
          config?.skipForbiddenRedirect === true;
        if (
          status === 403 &&
          typeof window !== 'undefined' &&
          !skipForbidden
        ) {
          window.location.href = '/dashboard/unauthorized';
        }
        return Promise.reject(error);
      }

      const skip =
        shouldSkipSessionExpiredLogout(url) ||
        options?.skipLogoutUrls?.some((path) => url.includes(path));
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
