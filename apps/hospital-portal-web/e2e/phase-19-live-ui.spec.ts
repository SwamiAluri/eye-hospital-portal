/**
 * Phase 19 live UI certification. Opt-in only:
 *   PHASE19_LIVE=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/phase-19-live-ui.spec.ts --project=chromium
 *
 * Does not POST a successful implant record. Override dialog is opened then cancelled.
 */
import { test, expect } from '@playwright/test';
import { apiLogin, seedBrowserAuth } from './helpers/auth';
import { gotoWardPage, openWorkspaceForJourney } from './helpers/ward-preop';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';

const IMPLANT_JID = 'dd000001-4444-4444-4444-000000000007';
const WARD_JID = '73cb08ee-e63e-463c-b4a1-466b8350f8d6';
const GS1 = '(01)08901234567890(21)88213(10)B2291(17)280630';
const BAD = '01XX';
const SHOT = '../../artifacts/phase-19-live';

test.describe('Phase 19 live UI', () => {
  test.skip(!process.env.PHASE19_LIVE, 'Set PHASE19_LIVE=1 to run against the live portal');

  test('FR-5.2 / FR-5.3 ImplantScanPanel parse, reject, eye block, override dialog cancel', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
    await page.goto(`/dashboard/ip-management/operation-theatre?patient=${IMPLANT_JID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    const panel = page.getByTestId('implant-scan-panel');
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: `${SHOT}/ui-implant-initial.png`, fullPage: true });

    const barcode = panel.locator('input[placeholder="Scan UDI…"]');
    await barcode.fill(GS1);
    await panel.getByRole('button', { name: 'Resolve' }).click();
    await expect(panel.getByText('Parsed from GS1')).toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('span.font-mono', { hasText: '08901234567890' }).first()).toBeVisible();
    await expect(panel.locator('span.font-mono', { hasText: '88213' }).first()).toBeVisible();
    await expect(panel.locator('span.font-mono', { hasText: 'B2291' }).first()).toBeVisible();
    await page.screenshot({ path: `${SHOT}/ui-implant-gs1.png`, fullPage: true });

    await panel.getByRole('button', { name: /Record with override/i }).click();
    const dialog = page.getByTestId('reason-confirm-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOT}/ui-reason-dialog.png`, fullPage: true });
    await page.getByRole('button', { name: /Scan a different lens|Cancel/i }).click();
    await expect(dialog).toBeHidden();

    await panel.getByLabel('OS (left)').click();
    await expect(panel.getByText(/Recording is blocked/i)).toBeVisible();
    await expect(panel.getByRole('button', { name: /Record implant|Record with override/i })).toBeDisabled();
    await page.screenshot({ path: `${SHOT}/ui-eye-block.png`, fullPage: true });
    await panel.getByLabel('OD (right)').click();

    await barcode.fill(BAD);
    await panel.getByRole('button', { name: 'Resolve' }).click();
    await expect(panel.getByText(/could not be read/i)).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByPlaceholder('Type serial')).toBeVisible();
    await page.screenshot({ path: `${SHOT}/ui-implant-invalid.png`, fullPage: true });
  });

  test('FR-4.1 / FR-3.3 / FR-3.2 ward chip, warnings, wristband print dialog', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
    await gotoWardPage(page);
    await openWorkspaceForJourney(page, WARD_JID);

    const dilation = page.getByTestId(WARD_PREOP_TEST_IDS.dilationChip);
    await expect(dilation).toBeVisible({ timeout: 20_000 });
    await expect(dilation).toContainText(/remaining|ready|not recorded/i);
    await page.screenshot({ path: `${SHOT}/ui-ward-dilation.png`, fullPage: true });

    await expect(page.getByText(/192\/114/).first()).toBeVisible();
    await expect(page.getByText(/you can still mark ready for OT/i).first()).toBeVisible();
    const markReady = page.getByTestId(WARD_PREOP_TEST_IDS.btnMarkReady);
    await expect(markReady).toBeVisible();
    await page.screenshot({ path: `${SHOT}/ui-ward-gates.png`, fullPage: true });

    await page.getByTestId(WARD_PREOP_TEST_IDS.stepTab('admit')).click();
    const printBtn = page.getByTestId(WARD_PREOP_TEST_IDS.printWristband);
    await expect(printBtn).toBeVisible({ timeout: 15_000 });
    await printBtn.click();
    const band = page.getByTestId(WARD_PREOP_TEST_IDS.wristbandDialog);
    await expect(band).toBeVisible({ timeout: 15_000 });
    await expect(band.getByText(/OPERATING EYE/i)).toBeVisible();
    await expect(band.getByText(/LEFT \(OS\)/)).toBeVisible();
    await expect(band.locator('span.font-mono').filter({ hasText: /^UAT-IP-145$/ })).toBeVisible();
    await expect(band.getByText('WB-260827-00001', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOT}/ui-wristband.png`, fullPage: true });
  });
});
