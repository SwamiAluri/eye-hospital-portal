/**
 * One-shot responsive workstation audit — Counsellor Waiting List + Surgery Finalization.
 * Run: npx playwright test e2e/responsive-workstation-audit.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-workstation-audit');

const VIEWPORTS = [
  { w: 1920, h: 1080, label: '1920x1080' },
  { w: 1600, h: 900, label: '1600x900' },
  { w: 1440, h: 900, label: '1440x900' },
  { w: 1366, h: 768, label: '1366x768' },
  { w: 1280, h: 720, label: '1280x720' },
  { w: 1200, h: 800, label: '1200x800' },
  { w: 1024, h: 768, label: '1024x768' },
] as const;

type OverflowReport = {
  viewport: string;
  pageHOverflow: number;
  pageVOverflow: number;
  mainHOverflow: number;
  queueHOverflow: number;
  queueViewport: { width: number; height: number } | null;
  rowHOverflow: number;
  statusNavHOverflow: number;
  paginationHOverflow: number;
  filterToolbarHOverflow: number;
  modalHOverflow: number | null;
  modalWidth: number | null;
  modalExceedsViewport: boolean | null;
  footerVisible: boolean | null;
  defects: string[];
};

async function measurePageOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main');
    const queue = document.querySelector('[data-testid="waiting-list-queue"], [data-testid="finalize-surgery-workspace"]');
    const row = document.querySelector(
      '[data-testid="waiting-list-work-row"], [data-testid="finalize-surgery-work-row"]',
    );
    const statusNav = document.querySelector(
      '[data-testid="waiting-list-summary-strip"], [data-testid="finalize-surgery-status-nav"]',
    );
    const pagination = document.querySelector(
      '[data-testid="waiting-list-pagination"], [data-testid="finalize-surgery-pagination"]',
    );
    const filterToolbar = document.querySelector(
      '[data-testid="waiting-list-queue-toolbar"], [data-testid="finalize-surgery-toolbar"]',
    );

    const hOverflow = (el: Element | null) => {
      if (!el) return 0;
      const e = el as HTMLElement;
      return Math.max(0, e.scrollWidth - e.clientWidth);
    };

    return {
      pageHOverflow: doc.scrollWidth - doc.clientWidth,
      pageVOverflow: doc.scrollHeight - doc.clientHeight,
      mainHOverflow: main ? (main as HTMLElement).scrollWidth - (main as HTMLElement).clientWidth : 0,
      queueHOverflow: hOverflow(queue),
      queueViewport: queue
        ? { width: (queue as HTMLElement).clientWidth, height: (queue as HTMLElement).clientHeight }
        : null,
      rowHOverflow: hOverflow(row),
      statusNavHOverflow: hOverflow(statusNav),
      paginationHOverflow: hOverflow(pagination),
      filterToolbarHOverflow: hOverflow(filterToolbar),
    };
  });
}

function collectDefects(
  label: string,
  m: Awaited<ReturnType<typeof measurePageOverflow>>,
  extra?: Partial<OverflowReport>,
): string[] {
  const defects: string[] = [];
  if (m.pageHOverflow > 1) defects.push(`page-level horizontal overflow (+${m.pageHOverflow}px)`);
  if (m.mainHOverflow > 1) defects.push(`main horizontal overflow (+${m.mainHOverflow}px)`);
  if (m.queueHOverflow > 1) defects.push(`queue/workspace horizontal overflow (+${m.queueHOverflow}px)`);
  if (m.rowHOverflow > 1) defects.push(`work row horizontal overflow (+${m.rowHOverflow}px)`);
  if (m.statusNavHOverflow > 1) defects.push(`status nav internal overflow (+${m.statusNavHOverflow}px)`);
  if (m.paginationHOverflow > 1) defects.push(`pagination horizontal overflow (+${m.paginationHOverflow}px)`);
  if (m.filterToolbarHOverflow > 1) defects.push(`filter toolbar horizontal overflow (+${m.filterToolbarHOverflow}px)`);
  if (extra?.modalExceedsViewport) defects.push('modal exceeds viewport width');
  if (extra?.footerVisible === false) defects.push('modal sticky footer not visible');
  if (m.queueViewport && m.queueViewport.height < 180 && label.includes('768'))
    defects.push(`queue viewport very short (${m.queueViewport.height}px) — primary work area below fold risk`);
  return defects;
}

test.describe('Responsive workstation audit', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('Waiting List — viewport matrix', async ({ page }) => {
    test.setTimeout(180_000);
    const reports: OverflowReport[] = [];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/dashboard/counsellors-desk/waiting-list', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId('waiting-list-queue').locator('.animate-pulse')).toHaveCount(0, {
        timeout: 30_000,
      }).catch(() => undefined);

      const m = await measurePageOverflow(page);
      const defects = collectDefects(vp.label, m);
      reports.push({ viewport: vp.label, ...m, modalHOverflow: null, modalWidth: null, modalExceedsViewport: null, footerVisible: null, defects });

      await page.screenshot({
        path: path.join(OUT, `waiting-list-${vp.label}.png`),
        fullPage: false,
      });
    }

    fs.writeFileSync(path.join(OUT, 'waiting-list-audit.json'), JSON.stringify(reports, null, 2));
    // Surface failures in test output without failing the whole audit run
    const withDefects = reports.filter((r) => r.defects.length > 0);
    console.log(JSON.stringify({ waitingList: withDefects }, null, 2));
  });

  test('Surgery Finalization — viewport matrix + modal', async ({ page }) => {
    test.setTimeout(240_000);
    const reports: OverflowReport[] = [];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId('finalize-surgery-workspace').locator('.animate-pulse')).toHaveCount(0, {
        timeout: 30_000,
      }).catch(() => undefined);

      const m = await measurePageOverflow(page);
      const defects = collectDefects(vp.label, m);
      reports.push({
        viewport: vp.label,
        ...m,
        modalHOverflow: null,
        modalWidth: null,
        modalExceedsViewport: null,
        footerVisible: null,
        defects,
      });

      await page.screenshot({
        path: path.join(OUT, `finalize-surgery-${vp.label}.png`),
        fullPage: false,
      });
    }

    // Modal audit at key laptop / constrained workstation widths
    for (const vp of [
      { w: 1440, h: 900, label: '1440x900' },
      { w: 1366, h: 768, label: '1366x768' },
      { w: 1280, h: 720, label: '1280x720' },
      { w: 1024, h: 768, label: '1024x768' },
    ] as const) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({
        timeout: 60_000,
      });
      await page.getByTestId('finalize-status-tab-NotConfirmed').click();
      await expect(page.getByTestId('finalize-surgery-workspace').locator('.animate-pulse')).toHaveCount(0, {
        timeout: 30_000,
      }).catch(() => undefined);

      const row = page.getByTestId('finalize-surgery-work-row').first();
      if ((await row.count()) === 0) continue;

      await row.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 30_000 });

      const modalMetrics = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
        const footer = dialog?.querySelector(':scope > div:last-child') as HTMLElement | null;
        const vw = window.innerWidth;
        if (!dialog) return null;
        const rect = dialog.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        return {
          modalHOverflow: Math.max(0, dialog.scrollWidth - dialog.clientWidth),
          modalWidth: rect.width,
          modalExceedsViewport: rect.right > vw || rect.left < 0,
          footerVisible: footerRect ? footerRect.bottom <= window.innerHeight && footerRect.top >= 0 : null,
        };
      });

      if (modalMetrics) {
        await page.screenshot({
          path: path.join(OUT, `finalize-ot-modal-${vp.label}.png`),
          fullPage: false,
        });
        const entry = reports.find((r) => r.viewport === vp.label);
        if (entry) {
          Object.assign(entry, modalMetrics);
          if (modalMetrics.modalExceedsViewport) entry.defects.push('modal exceeds viewport width');
          if (modalMetrics.modalHOverflow > 1)
            entry.defects.push(`modal horizontal overflow (+${modalMetrics.modalHOverflow}px)`);
          if (modalMetrics.footerVisible === false) entry.defects.push('modal sticky footer not visible');
        }
      }

      await dialog.getByText('Close', { exact: true }).click({ timeout: 5_000 }).catch(() => undefined);
    }

    fs.writeFileSync(path.join(OUT, 'finalize-surgery-audit.json'), JSON.stringify(reports, null, 2));
    const withDefects = reports.filter((r) => r.defects.length > 0);
    console.log(JSON.stringify({ finalizeSurgery: withDefects }, null, 2));
  });
});
