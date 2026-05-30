import axios from 'axios';
import jwtDecode from 'jwt-decode';
import { useAuthStore, type User } from './auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';

let refreshPromise: Promise<boolean> | null = null;

interface RefreshResponse {
  success?: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: User;
  roles?: string[];
  permissions?: string[];
}

/** Returns true when the JWT expires within `bufferSeconds` (default 2 min). */
export function isTokenNearExpiry(token: string, bufferSeconds = 120): boolean {
  try {
    const decoded = jwtDecode<{ exp?: number }>(token);
    if (!decoded.exp) return true;
    return decoded.exp < Date.now() / 1000 + bufferSeconds;
  } catch {
    return true;
  }
}

/** Exchange a refresh token for a new access token. Deduplicates concurrent calls. */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const state = useAuthStore.getState();
    const { refreshToken, tenantId, user, roles, permissions } = state;
    if (!refreshToken) return false;

    try {
      const { data } = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
          },
        },
      );

      if (!data.accessToken) return false;

      state.setAuth(
        data.accessToken,
        data.refreshToken ?? refreshToken,
        data.user ?? user!,
        data.roles ?? roles,
        data.permissions ?? permissions,
        tenantId ?? '',
        false,
      );
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Redirect to login with a friendly session-expired message. */
export function redirectToLogin(reason = 'Your session has expired. Please sign in again.'): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('auth_expired_message', reason);
  window.location.href = '/auth/login';
}
