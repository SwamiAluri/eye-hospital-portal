import { test, expect } from '@playwright/test';
import { apiLogin, seedBrowserAuth } from './helpers/auth';

/**
 * OT Prepared — bulk OT slip printing & print UX.
 * Native browser print dialog not asserted; dedicated document HTML is.
 */
test.describe('Finalize Surgery OT Prepared bulk OT slip print', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', {
      waitUntil: 'domcontentloaded',
    });
  });

  test('OT Prepared selection + Print OT Slips (N) opens dedicated multi-slip document', async ({
    page,
  }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-status-tab-OTPrepared').click();
    await expect(page.getByTestId('finalize-status-tab-OTPrepared')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const rows = page.locator('[data-testid="finalize-surgery-work-row"]');
    await expect
      .poll(async () => rows.count(), { timeout: 20_000 })
      .toBeGreaterThan(0)
      .catch(() => null);

    if ((await rows.count()) === 0) {
      test.skip(true, 'No OT Prepared rows in environment for bulk print');
      return;
    }

    await expect(page.getByTestId('finalize-ot-prepared-print-selection-bar')).toBeVisible();
    const printBulk = page.getByTestId('finalize-ot-prepared-print-slips');
    await expect(printBulk).toBeDisabled();
    await expect(page.getByTestId('finalize-ot-prepared-selected-count')).toContainText('0');

    // Row-level Print removed on OT Prepared — bulk Print OT Slips (1)/(N) is the print path
    await expect(
      page.getByTitle('Print OT Slip', { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('[data-testid^="finalize-ot-prepared-row-print-"]')).toHaveCount(0);
    // Decorative chevron absent from OT Prepared action cells
    await expect(
      page.locator('[data-testid="finalize-surgery-work-row"] svg.lucide-chevron-right'),
    ).toHaveCount(0);
    // Reopen remains
    await expect(page.getByRole('button', { name: 'Reopen' }).first()).toBeVisible();
    // Bulk Print OT Slips remains (worklist-level)
    await expect(printBulk).toBeVisible();

    await page.getByTestId('finalize-ot-prepared-select-all-visible').click();
    const visibleCount = await rows.count();
    await expect(page.getByTestId('finalize-ot-prepared-selected-count')).toContainText(
      String(visibleCount),
    );
    await expect(printBulk).toBeEnabled();
    await expect(printBulk).toContainText(`Print OT Slips (${visibleCount})`);

    // Capture two selected names for HTML assertion; leave one unselected if possible
    const firstId = await rows.nth(0).getAttribute('data-schedule-id');
    const secondId =
      visibleCount > 1 ? await rows.nth(1).getAttribute('data-schedule-id') : firstId;
    const thirdId =
      visibleCount > 2 ? await rows.nth(2).getAttribute('data-schedule-id') : null;

    await page.getByTestId('finalize-ot-prepared-clear-selection').click();
    await expect(page.getByTestId('finalize-ot-prepared-selected-count')).toContainText('0');
    await expect(printBulk).toBeDisabled();

    if (firstId) {
      await page.getByTestId(`finalize-ot-prepared-select-${firstId}`).check();
    }
    if (secondId && secondId !== firstId) {
      await page.getByTestId(`finalize-ot-prepared-select-${secondId}`).check();
    }

    const selectedCount = secondId && secondId !== firstId ? 2 : 1;
    await expect(page.getByTestId('finalize-ot-prepared-selected-count')).toContainText(
      String(selectedCount),
    );

    const name1 = await rows.nth(0).locator('p').first().textContent();
    const name2 =
      selectedCount === 2 ? await rows.nth(1).locator('p').first().textContent() : null;
    const name3 =
      thirdId && visibleCount > 2
        ? await rows.nth(2).locator('p').first().textContent()
        : null;

    await page.evaluate(() => {
      (window as unknown as { __otSlipsPrintHtml?: string }).__otSlipsPrintHtml = undefined;
      const originalOpen = window.open.bind(window);
      window.open = ((...args: Parameters<typeof window.open>) => {
        const stub = {
          document: {
            write(html: string) {
              (window as unknown as { __otSlipsPrintHtml?: string }).__otSlipsPrintHtml = html;
            },
            close() {},
          },
          close() {},
        };
        try {
          const w = originalOpen(...args);
          if (!w) return stub as unknown as Window;
          const doc = w.document;
          const origWrite = doc.write.bind(doc);
          doc.write = ((...writeArgs: unknown[]) => {
            const html = String(writeArgs[0] ?? '');
            (window as unknown as { __otSlipsPrintHtml?: string }).__otSlipsPrintHtml = html;
            return origWrite(...(writeArgs as [string]));
          }) as typeof doc.write;
          return w;
        } catch {
          return stub as unknown as Window;
        }
      }) as typeof window.open;
    });

    await printBulk.click();

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => (window as unknown as { __otSlipsPrintHtml?: string }).__otSlipsPrintHtml ?? '',
          ),
        { timeout: 15_000 },
      )
      .toContain('OT Slip');

    const html = await page.evaluate(
      () => (window as unknown as { __otSlipsPrintHtml?: string }).__otSlipsPrintHtml ?? '',
    );

    expect(html).toMatch(/page-break-after:\s*always|break-after:\s*page/i);
    expect(html).not.toMatch(/sidebar/i);
    expect(html).not.toMatch(/Reopen/i);
    expect(html).not.toContain('OT Preparation — Prepared List');
    expect(html).not.toMatch(/Select all visible/i);
    expect(html).not.toMatch(/Print OT Slips/i);

    if (name1?.trim()) expect(html).toContain(name1.trim());
    if (name2?.trim()) expect(html).toContain(name2.trim());
    if (name3?.trim() && selectedCount < visibleCount) {
      // Unselected third patient must not appear when only first two selected
      expect(html).not.toContain(name3.trim());
    }

    const slipCount = (html.match(/class="ot-slip"/g) ?? []).length;
    expect(slipCount).toBe(selectedCount);

    // Reopen / primary action still available on rows
    await expect(rows.first()).toBeVisible();
  });

  test('Package B OT Preparation Prepared List print remains available and separate', async ({
    page,
  }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();
    await expect(page.getByTestId('finalize-ot-prep-print-prepared')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prepared-print-slips')).toHaveCount(0);
    await expect(page.getByTestId('finalize-ot-prepared-grid')).toHaveCount(0);
  });
});
