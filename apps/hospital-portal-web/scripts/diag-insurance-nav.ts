import { chromium } from '@playwright/test';

const SESSION = process.env.E2E_COUNSELLING_SESSION_ID ?? '';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: 'e2e/.auth/user.json',
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3000/dashboard/counsellors-desk/${SESSION}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByTestId('counselling-journey-rail').waitFor({ state: 'visible', timeout: 60_000 });
  for (const id of ['quote', 'decision', 'insurance', 'notes', 'close'] as const) {
    const el = page.getByTestId(`counselling-journey-stage-${id}`);
    console.log(
      'before',
      id,
      'status=' + (await el.getAttribute('data-journey-status')),
      'navigable=' + (await el.getAttribute('data-journey-navigable')),
    );
  }
  await page.getByTestId('counselling-journey-stage-decision').getByRole('button').click();
  await page.getByTestId('counselling-decision-workspace').waitFor({ state: 'visible', timeout: 30_000 });
  for (let i = 0; i < 10; i++) {
    const ins = page.getByTestId('counselling-journey-stage-insurance');
    const status = await ins.getAttribute('data-journey-status');
    const navigable = await ins.getAttribute('data-journey-navigable');
    console.log('poll', i, 'insurance', status, navigable);
    if (navigable === 'true') break;
    await page.waitForTimeout(500);
  }
  const payment = await page.locator('#counselling-step-3').innerText().catch(() => 'no-step-3');
  console.log('payment_snippet', payment.slice(0, 300));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
