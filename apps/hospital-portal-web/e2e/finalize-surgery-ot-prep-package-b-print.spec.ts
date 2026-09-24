import { test, expect } from '@playwright/test';
import { apiLogin, seedBrowserAuth } from './helpers/auth';

/**
 * Package B — Dedicated OT Preparation prepared-list print (PD-OTPREP-UAT-08).
 * Asserts print trigger + dedicated document contract; browser print dialog may not run in CI.
 */
test.describe('Finalize Surgery OT Preparation Package B Print', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', {
      waitUntil: 'domcontentloaded',
    });
  });

  test('OT Preparation Print CTA is available and opens dedicated prepared-list document', async ({
    page,
  }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();
    await expect(page.getByTestId('finalize-ot-preparation-workspace')).toBeVisible();

    const dateInput = page.getByTestId('finalize-ot-prep-date-input');
    await expect(dateInput).toBeVisible();
    await dateInput.fill('2026-09-24');

    const printBtn = page.getByTestId('finalize-ot-prep-print-prepared');
    await expect(printBtn).toBeVisible();
    await expect(printBtn).toBeEnabled();

    // Screen chrome / RESP2 controls remain on page (must not appear in print HTML)
    await expect(page.getByTestId('finalize-ot-prepare-selected')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-toolbar')).toBeVisible();

    await page.route('**/Counseling/ot-list**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ot-print-1',
            uhid: 'UHID-PRINT-1',
            patientName: 'Print Patient',
            surgeryName: 'Phaco + IOL',
            eyes: 'OD',
            patientType: 'Cash',
            paymentMode: 'Cash',
            surgeon: 'Dr. Print',
            startTime: '2026-09-24T09:00:00',
            theaterName: 'OT-1',
            status: 'OTPrepared',
            version: 1,
            isLocked: true,
            sequenceNo: 1,
            scheduleDate: '2026-09-24',
          },
        ]),
      });
    });

    await page.evaluate(() => {
      (window as unknown as { __otPrepPrintHtml?: string }).__otPrepPrintHtml = undefined;
      const originalOpen = window.open.bind(window);
      window.open = ((...args: Parameters<typeof window.open>) => {
        const w = originalOpen(...args);
        if (!w) {
          const stub = {
            document: {
              write(html: string) {
                (window as unknown as { __otPrepPrintHtml?: string }).__otPrepPrintHtml = html;
              },
              close() {},
            },
            close() {},
          };
          return stub as unknown as Window;
        }
        const doc = w.document;
        const origWrite = doc.write.bind(doc);
        doc.write = ((...writeArgs: unknown[]) => {
          const html = String(writeArgs[0] ?? '');
          (window as unknown as { __otPrepPrintHtml?: string }).__otPrepPrintHtml = html;
          return origWrite(...(writeArgs as [string]));
        }) as typeof doc.write;
        return w;
      }) as typeof window.open;
    });

    await printBtn.click();

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => (window as unknown as { __otPrepPrintHtml?: string }).__otPrepPrintHtml ?? '',
          ),
        { timeout: 15_000 },
      )
      .toContain('OT Preparation — Prepared List');

    const html = await page.evaluate(
      () => (window as unknown as { __otPrepPrintHtml?: string }).__otPrepPrintHtml ?? '',
    );

    expect(html).toContain('Surgery Date');
    expect(html).toMatch(/24/);
    expect(html).toContain('Print Patient');
    expect(html).toContain('UHID-PRINT-1');
    expect(html).toContain('Phaco + IOL');
    expect(html).toContain('Dr. Print');
    expect(html).toContain('OT-1');
    expect(html).toContain('OTPrepared');
    expect(html).not.toMatch(/Prepare OT/i);
    expect(html).not.toMatch(/Select all visible/i);
    expect(html).not.toMatch(/sidebar/i);
    expect(html).not.toMatch(/finalize-ot-prep/i);
    expect(html).not.toMatch(/pagination/i);

    // RESP2 screen controls still on page (not moved into print)
    await expect(page.getByTestId('finalize-ot-prepare-selected')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prepared-grid')).toHaveCount(0);
  });

  test('Finalization OT slip print control remains on Finalization rows', async ({ page }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('finalize-surgery-workspace')).toBeVisible();

    const printSlip = page.getByTitle('Print OT Slip').first();
    await expect
      .poll(async () => printSlip.count(), { timeout: 20_000 })
      .toBeGreaterThan(0)
      .catch(() => null);

    if ((await printSlip.count()) === 0) {
      test.skip(true, 'No Finalization rows with Print OT Slip in environment');
      return;
    }
    await expect(printSlip).toBeVisible();
  });
});
