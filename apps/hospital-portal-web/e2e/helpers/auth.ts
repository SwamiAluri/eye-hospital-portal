import { type APIRequestContext, type Page, expect } from '@playwright/test';

export const E2E_API_BASE = (
  process.env.E2E_API_URL ?? 'http://localhost:5073/api'
).replace(/\/$/, '');

export const E2E_TENANT_ID =
  process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';

export const E2E_EMAIL = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
export const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';

export type LoginPayload = {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
  roles: string[];
  permissions: string[];
};

export async function apiLogin(request: APIRequestContext): Promise<LoginPayload> {
  const res = await request.post(`${E2E_API_BASE}/auth/login`, {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD, tenantId: E2E_TENANT_ID },
  });
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as LoginPayload & { success?: boolean };
  expect(json.accessToken).toBeTruthy();
  return json;
}

/** Seed browser localStorage with API login tokens (matches auth-store keys). */
export async function seedBrowserAuth(page: Page, login: LoginPayload): Promise<void> {
  // addInitScript runs before page JS — avoids /auth/login clearing localStorage on mount
  await page.context().addInitScript(
    ({ login, tenantId }) => {
      localStorage.setItem('auth_token', login.accessToken);
      localStorage.setItem('refresh_token', login.refreshToken);
      localStorage.setItem('user', JSON.stringify(login.user));
      localStorage.setItem('roles', JSON.stringify(login.roles));
      localStorage.setItem('permissions', JSON.stringify(login.permissions));
      localStorage.setItem('tenant_id', tenantId);
    },
    { login, tenantId: E2E_TENANT_ID },
  );
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 });
  await page.waitForFunction(() => Boolean(localStorage.getItem('auth_token')), null, {
    timeout: 15_000,
  });
  // DashboardLoadingSkeleton has no nav/aside. Wait for the real Sidebar after zustand hydrate.
  await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({
    timeout: 90_000,
  });
}

export function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': E2E_TENANT_ID,
  };
}

/** Seed browser auth with a filtered permission set (RBAC negative tests). */
export async function seedBrowserAuthWithPermissions(
  page: Page,
  login: LoginPayload,
  permissions: string[],
): Promise<void> {
  const trimmed = { ...login, permissions };
  await seedBrowserAuth(page, trimmed);
}

const ROLE_CREDENTIALS: Record<string, { email: string; password: string }> = {
  admin: { email: E2E_EMAIL, password: E2E_PASSWORD },
  nurse: {
    email: process.env.E2E_NURSE_EMAIL ?? E2E_EMAIL,
    password: process.env.E2E_NURSE_PASSWORD ?? E2E_PASSWORD,
  },
  counsellor: {
    email: process.env.E2E_COUNSELLOR_EMAIL ?? E2E_EMAIL,
    password: process.env.E2E_COUNSELLOR_PASSWORD ?? E2E_PASSWORD,
  },
  ot_nurse: {
    email: process.env.E2E_OT_NURSE_EMAIL ?? E2E_EMAIL,
    password: process.env.E2E_OT_NURSE_PASSWORD ?? E2E_PASSWORD,
  },
};

export async function loginAsRole(page: Page, role: keyof typeof ROLE_CREDENTIALS): Promise<LoginPayload> {
  const creds = ROLE_CREDENTIALS[role] ?? ROLE_CREDENTIALS.admin;
  const res = await page.request.post(`${E2E_API_BASE}/auth/login`, {
    data: { email: creds.email, password: creds.password, tenantId: E2E_TENANT_ID },
  });
  expect(res.ok()).toBeTruthy();
  const login = (await res.json()) as LoginPayload;
  await seedBrowserAuth(page, login);
  return login;
}
