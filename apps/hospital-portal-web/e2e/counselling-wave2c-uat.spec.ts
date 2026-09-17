/**
 * Wave 2C browser UAT — quote density, coverage estimate mirror, action bar, documents smoke.
 * Fixture: E2E_COUNSELLING_SESSION_ID (resolve-e2e-counselling-fixtures.ts)
 */
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import {
  actionBar,
  actionBarPrimary,
  coverageEstimateMirror,
  coverageEstimateMirrorPayable,
  coverageMainTab,
  coverageTestIds,
  coverageWizardStep,
  ensureInsurancePaymentType,
  goCounsellingSession,
  goCoverageTabWithWizard,
  goCoverageWizardStep,
  goToPhase,
  hasCounsellingFixture,
  journeyStage,
  openQuotePanel,
  quoteFinalPayable,
  saveDraftButton,
  counsellingMainTab,
} from './helpers/counselling';
import { apiHeaders, apiLogin, E2E_API_BASE } from './helpers/auth';

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'wave2c');

function shot(page: import('@playwright/test').Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

function parseInr(text: string): number {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n%%EOF\n',
);

const MINIMAL_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

test.describe('Wave 2C counselling UAT @wave2c-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  test('A1–A2: quote workspace hierarchy', async ({ page }) => {
    await goCounsellingSession(page);
    await openQuotePanel(page);

    await expect(page.getByTestId('counselling-eye-re')).toBeVisible();
    await expect(page.getByTestId('counselling-tab-custom')).toBeVisible();
    await expect(page.getByTestId('counselling-tab-package')).toBeVisible();
    await expect(page.getByTestId('counselling-quote-panel')).toBeVisible();
    await expect(journeyStage(page, 'quote')).toBeVisible();

    const payable = quoteFinalPayable(page);
    if (await payable.isVisible().catch(() => false)) {
      await expect(payable.locator('p').nth(1)).toBeVisible();
    }

    await shot(page, '01-quote-initial');
  });

  test('A3: biometry warning is concise when present', async ({ page }) => {
    await goCounsellingSession(page);
    const warning = page.getByText(/Biometry unavailable for/i);
    if (await warning.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const text = await warning.textContent();
      expect((text ?? '').length).toBeLessThan(80);
      await shot(page, '02-quote-biometry-warning');
    } else {
      test.info().annotations.push({ type: 'note', description: 'No biometry warning on fixture — skipped visual check' });
    }
  });

  test('B: decision workspace and action hierarchy', async ({ page }) => {
    await goCounsellingSession(page);
    await expect(journeyStage(page, 'decision')).toHaveAttribute('data-journey-status', /completed|current/);
    await expect(actionBar(page)).toBeVisible();
    await expect(saveDraftButton(page)).toBeVisible();
    const primary = actionBarPrimary(page);
    if (await primary.isVisible().catch(() => false)) {
      const primaryLabel = (await primary.textContent()) ?? '';
      if (primaryLabel.match(/Next:/i)) {
        expect(primaryLabel).not.toMatch(/Patient Decision/i);
      }
    } else {
      await expect(page.getByTestId('counselling-action-bar-status-hint')).not.toHaveText(
        /Patient Decision/i,
      );
    }
    await shot(page, '03-decision-context-on-quote');
  });

  test('C–D: coverage estimate mirror matches quote (read-only)', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await openQuotePanel(page);

    let quoteAmount = 0;
    const quotePayable = quoteFinalPayable(page);
    if (await quotePayable.isVisible().catch(() => false)) {
      quoteAmount = parseInr((await quotePayable.locator('p').nth(1).textContent()) ?? '');
    }

    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'estimate');

    await expect(coverageEstimateMirror(page)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('coverage-estimated-amount')).toHaveCount(0);

    const mirrorPayable = coverageEstimateMirrorPayable(page);
    await expect(mirrorPayable).toBeVisible();
    if (quoteAmount > 0) {
      const mirrorAmount = parseInr((await mirrorPayable.textContent()) ?? '');
      const chromePayable = page.getByTestId('counselling-session-summary-chip-payable');
      const chromeAmount = (await chromePayable.isVisible().catch(() => false))
        ? parseInr((await chromePayable.textContent()) ?? '')
        : 0;
      test.info().annotations.push({
        type: 'financial-parity',
        description: `Quote payable=${quoteAmount}; Coverage mirror=${mirrorAmount}; Chrome=${chromeAmount}`,
      });
      expect(
        mirrorAmount,
        `Coverage mirror must match counselling quote (quote=${quoteAmount}, mirror=${mirrorAmount})`,
      ).toBe(quoteAmount);
      if (chromeAmount > 0) {
        expect(chromeAmount, `Session chrome must match quote (quote=${quoteAmount}, chrome=${chromeAmount})`).toBe(
          quoteAmount,
        );
      }
    }

    const editQuote = page.getByRole('button', { name: /Edit quote/i });
    if (await editQuote.isVisible().catch(() => false)) {
      await expect(editQuote).toBeEnabled();
    }

    await shot(page, '04-coverage-estimate-mirror');
  });

  test('G: documents complete shows single submit in action bar', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'documents');

    const ready = page.getByTestId('ccms-docs-ready');
    const outstanding = page.getByTestId('ccms-docs-outstanding');
    if (await ready.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(page.getByTestId(coverageTestIds.submitToClaims)).toHaveCount(0);
      const primary = actionBarPrimary(page);
      const label = (await primary.textContent()) ?? '';
      expect(label).toMatch(/Submit to Claims/i);
      await shot(page, '05-coverage-docs-complete');
    } else if (await outstanding.isVisible().catch(() => false)) {
      await shot(page, '05-coverage-docs-missing');
      test.info().annotations.push({ type: 'note', description: 'Documents incomplete on fixture — submit CTA not expected' });
    } else {
      test.info().annotations.push({ type: 'note', description: 'No document progress banner — case may lack CCMS case' });
    }
  });

  test('E: document upload preview open download replace remove', async ({ page, request }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'documents');
    await expect(coverageWizardStep(page, 'documents')).toHaveAttribute('aria-current', 'step');

    const emptySlot = page.locator('[data-testid^="ccms-doc-row-"][data-uploaded="false"]').first();
    await expect(emptySlot).toBeVisible({ timeout: 30_000 });

    const slotTestId = (await emptySlot.getAttribute('data-testid')) ?? 'ccms-doc-row-other_1';
    const slotKey = slotTestId.replace('ccms-doc-row-', '');
    const slotRow = page.getByTestId(slotTestId);
    const fileInput = slotRow.locator('label').filter({ hasText: /^Upload$/ }).locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });
    const ext = slotKey.includes('photo') || slotKey.includes('image') || slotKey.includes('card') ? 'jpg' : 'pdf';
    const payload = ext === 'jpg' ? MINIMAL_JPEG : MINIMAL_PDF;
    const uploadDone = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/documents\b/i.test(res.url()) &&
        res.status() >= 200 &&
        res.status() < 300,
      { timeout: 90_000 },
    );
    await fileInput.setInputFiles({
      name: `uat-wave2c.${ext}`,
      mimeType: ext === 'jpg' ? 'image/jpeg' : 'application/pdf',
      buffer: payload,
    });
    const uploadResponse = await uploadDone;
    const uploadBody = (await uploadResponse.json()) as { id?: string; documentType?: string };
    const uploadedDocId = uploadBody.id;
    expect(uploadedDocId, 'Upload response must include persisted document id').toBeTruthy();

    await expect(slotRow).toHaveAttribute('data-uploaded', 'true', { timeout: 60_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    const docsReload = page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        /\/coverage-cases\/[^/]+\/documents\b/i.test(res.url()) &&
        res.status() === 200,
      { timeout: 60_000 },
    );
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'documents');
    await docsReload.catch(() => undefined);

    const reloadedSlotRow = page.getByTestId(slotTestId);
    await expect(reloadedSlotRow).toHaveAttribute('data-uploaded', 'true', { timeout: 30_000 });
    test.info().annotations.push({
      type: 'document-persistence',
      description: `Document ${uploadedDocId} survived full page reload`,
    });

    await expect(page.getByTestId('ccms-doc-preview-btn').first()).toBeVisible();

    await page.getByTestId('ccms-doc-preview-btn').first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /close/i }).first().click().catch(() => page.keyboard.press('Escape'));

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
    await page.getByTestId('ccms-doc-download-btn').first().click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toBeTruthy();
    }

    await shot(page, '06-coverage-docs-uploaded');

    const replaceInput = slotRow.locator('label').filter({ hasText: /^Replace$/ }).locator('input[type="file"]');
    if (await replaceInput.isVisible().catch(() => false)) {
      await replaceInput.setInputFiles({
        name: `uat-wave2c-replace.${ext}`,
        mimeType: ext === 'jpg' ? 'image/jpeg' : 'application/pdf',
        buffer: payload,
      });
      await expect(slotRow).toHaveAttribute('data-uploaded', 'true', { timeout: 60_000 });
    }

    const removeBtn = slotRow.getByTestId('ccms-doc-remove-btn');
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();
      await expect(slotRow).toHaveAttribute('data-uploaded', 'false', { timeout: 30_000 });
    }
  });

  test('J: cash patient hides coverage tab when payment is cash', async ({ page, request }) => {
    const login = await apiLogin(request);
    const listRes = await request.get(`${E2E_API_BASE}/Counseling/waiting-list`, {
      headers: apiHeaders(login.accessToken),
    });
    test.skip(!listRes.ok(), 'Waiting list unavailable');
    const rows = (await listRes.json()) as Array<Record<string, unknown>>;
    const cashRow = rows.find((r) => {
      const pt = String(r.patientType ?? r.PatientType ?? '').toLowerCase();
      return pt === 'cash' || pt === 'self' || pt === 'selfpay';
    });
    test.skip(!cashRow, 'No cash patient in waiting list');
    const sessionId = String(cashRow!.id ?? cashRow!.Id);
    await page.goto(`/dashboard/counsellors-desk/${sessionId}`, { waitUntil: 'domcontentloaded' });
    await expect(counsellingMainTab(page)).toBeVisible({ timeout: 60_000 });
    await expect(coverageMainTab(page)).toHaveAttribute('data-journey-status', 'skipped');
    await shot(page, '07-cash-patient');
  });
});
