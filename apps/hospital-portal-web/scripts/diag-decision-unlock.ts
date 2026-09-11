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
  await page.getByTestId('counselling-journey-stage-decision').getByRole('button').click();
  await page.getByTestId('counselling-decision-workspace').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(2000);

  const options = await page.locator('[data-testid^="counselling-decision-option-"]').evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute('data-testid'),
      pressed: e.getAttribute('aria-pressed'),
      text: (e.textContent || '').trim().slice(0, 40),
    })),
  );
  console.log('options', JSON.stringify(options, null, 2));

  const schedule = page.getByTestId('counselling-decision-schedule-widget');
  console.log('schedule_visible', await schedule.isVisible().catch(() => false));
  if (await schedule.isVisible().catch(() => false)) {
    console.log('schedule_text', (await schedule.innerText()).slice(0, 200));
  }

  // Select Date for Surgery via the radio control (label test id has no aria-pressed).
  await page.locator('#counselling-decision-DateForSurgery').click({ force: true });
  await page.waitForTimeout(1500);

  const selected = await page.locator('#counselling-decision-DateForSurgery').isChecked().catch(() => false);
  console.log('dateforsurgery_checked', selected);

  const ins = page.getByTestId('counselling-journey-stage-insurance');
  console.log(
    'after_radio',
    await ins.getAttribute('data-journey-status'),
    await ins.getAttribute('data-journey-navigable'),
    'btn',
    await ins.getByRole('button').count(),
  );

  if ((await ins.getByRole('button').count()) > 0) {
    await ins.getByRole('button').click();
    await page.waitForTimeout(1500);
    console.log(
      'coverage_policy_visible',
      await page.getByTestId('coverage-step-policy').isVisible().catch(() => false),
    );
    console.log(
      'insurer_enabled',
      await page.getByTestId('coverage-insurer-name').isEnabled().catch(() => false),
    );
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
