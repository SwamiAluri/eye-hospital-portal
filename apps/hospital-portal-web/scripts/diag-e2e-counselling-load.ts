/**
 * Phase 2U.5 diagnostic — time goCounsellingSession wait stages (not part of suite).
 * Run: npx playwright test --config=playwright.config.ts  (invoked via node below)
 *
 * Usage: npx tsx scripts/diag-e2e-counselling-load.ts
 */
import { chromium } from '@playwright/test';
import path from 'path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const SESSION = process.env.E2E_COUNSELLING_SESSION_ID ?? '';
const AUTH = path.join(__dirname, '../e2e/.auth/user.json');

async function main() {
  if (!SESSION) {
    console.error('Set E2E_COUNSELLING_SESSION_ID');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: AUTH,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const pending = new Map<string, number>();
  page.on('request', (req) => {
    if (['xhr', 'fetch', 'websocket'].includes(req.resourceType())) {
      pending.set(req.url(), Date.now());
    }
  });
  page.on('requestfinished', (req) => pending.delete(req.url()));
  page.on('requestfailed', (req) => pending.delete(req.url()));

  const url = `${BASE}/dashboard/counsellors-desk/${SESSION}`;
  console.log('goto', url);

  let t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log(`domcontentloaded_ms=${Date.now() - t0}`);

  t0 = Date.now();
  let networkIdleOk = false;
  let networkIdleErr: string | null = null;
  try {
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    networkIdleOk = true;
  } catch (e) {
    networkIdleErr = e instanceof Error ? e.message : String(e);
  }
  console.log(`networkidle_ms=${Date.now() - t0} ok=${networkIdleOk}`);
  if (networkIdleErr) console.log(`networkidle_error=${networkIdleErr.split('\n')[0]}`);

  const stillPending = [...pending.keys()].slice(0, 20);
  console.log(`pending_xhr_fetch_ws_count=${pending.size}`);
  for (const u of stillPending) {
    console.log(`  pending: ${u}`);
  }

  t0 = Date.now();
  await page.getByTestId('counselling-journey-rail').waitFor({ state: 'visible', timeout: 60_000 });
  console.log(`journey_rail_ms=${Date.now() - t0}`);

  t0 = Date.now();
  await page.locator('#counselling-step-1').waitFor({ state: 'visible', timeout: 30_000 });
  console.log(`estimate_step_ms=${Date.now() - t0}`);

  await browser.close();
  console.log('diag_done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
