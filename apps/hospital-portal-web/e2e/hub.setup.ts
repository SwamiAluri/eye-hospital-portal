/**
 * Seeds E2E hub patients once before patient-hub.spec.ts runs (CI + local).
 */
import { test as setup } from '@playwright/test';
import { apiLogin } from './helpers/auth';
import { ensureHubPatients } from './helpers/patient-hub';

setup('seed patient hub fixtures', async ({ request }) => {
  const login = await apiLogin(request);
  await ensureHubPatients(request, login, 3);
});
