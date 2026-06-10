/**
 * B9 — Master value create → consuming dropdown reflects new option.
 */
import { test, expect } from '@playwright/test';
import { apiHeaders, apiLogin, E2E_API_BASE } from './helpers/auth';

test.describe('Master Data — edit refreshes consumer dropdown', () => {
  test('new patient.title appears on patients/new after API create', async ({ page, request }) => {
    const login = await apiLogin(request);
    const code = `E2E_T_${Date.now()}`;
    const label = `E2E Title ${code}`;
    const headers = apiHeaders(login.accessToken);

    const createRes = await request.post(`${E2E_API_BASE}/master-values/patient.title`, {
      headers,
      data: { code, label, sortOrder: 999 },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as { id?: string };

    await page.goto('/dashboard/patients/new');
    // Native <option> elements are present in DOM but not "visible" until select opens
    await expect(page.locator('select option', { hasText: label })).toHaveCount(1, {
      timeout: 20_000,
    });

    if (created.id) {
      await request.delete(`${E2E_API_BASE}/master-values/patient.title/${created.id}`, {
        headers,
      });
    }
  });
});
