/**
 * Playwright auth setup — logs in via API and seeds localStorage (reliable vs UI login).
 */
import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { apiLogin, E2E_TENANT_ID, seedBrowserAuth, type LoginPayload } from './helpers/auth';

const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

function authInitPayload(login: LoginPayload) {
  return {
    accessToken: login.accessToken,
    refreshToken: login.refreshToken,
    userJson: JSON.stringify(login.user),
    rolesJson: JSON.stringify(login.roles),
    permissionsJson: JSON.stringify(login.permissions),
    tenantId: E2E_TENANT_ID,
  };
}

setup('authenticate as test user', async ({ page, request }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const login = await apiLogin(request);
  const payload = authInitPayload(login);

  await page.context().addInitScript((auth) => {
    localStorage.setItem('auth_token', auth.accessToken);
    localStorage.setItem('refresh_token', auth.refreshToken);
    localStorage.setItem('user', auth.userJson);
    localStorage.setItem('roles', auth.rolesJson);
    localStorage.setItem('permissions', auth.permissionsJson);
    localStorage.setItem('tenant_id', auth.tenantId);
  }, payload);

  await seedBrowserAuth(page, login);
  await page.goto('/dashboard');
  await expect(page.locator('nav, aside, [class*="sidebar"]').first()).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
