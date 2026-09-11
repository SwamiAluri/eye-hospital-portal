/**
 * Phase 3 Option A verification — density boundary at 1600 CSS px.
 * Run: npx playwright test e2e/responsive-shell-phase3.spec.ts --project=chromium
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-shell-phase3');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

const PROFILES = [
  { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, expectExpanded: true },
  { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, expectExpanded: true },
  { label: '1536x864-dpr1.25', cssW: 1536, cssH: 864, dpr: 1.25, expectExpanded: false },
  { label: '1440x900', cssW: 1440, cssH: 900, dpr: 1, expectExpanded: false },
  { label: '1366x768', cssW: 1366, cssH: 768, dpr: 1, expectExpanded: false },
  { label: '1280x720', cssW: 1280, cssH: 720, dpr: 1, expectExpanded: false },
  { label: '1200x800', cssW: 1200, cssH: 800, dpr: 1, expectExpanded: false },
  { label: '1024x768', cssW: 1024, cssH: 768, dpr: 1, expectExpanded: false },
] as const;

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const sidebarCard = document.querySelector(
      'div.hidden.lg\\:flex.flex-shrink-0.rounded-2xl',
    ) as HTMLElement | null;
    const shell = document.querySelector('div.flex.h-screen') as HTMLElement | null;
    const main = document.querySelector('main#main-content') as HTMLElement | null;
    const queue = document.querySelector(
      '[data-testid="waiting-list-queue"], [data-testid="finalize-surgery-workspace"]',
    ) as HTMLElement | null;
    const row = document.querySelector(
      '[data-testid="waiting-list-work-row"], [data-testid="finalize-surgery-work-row"]',
    ) as HTMLElement | null;
    const sidebarW = sidebarCard?.getBoundingClientRect().width ?? 0;
    const mainR = main?.getBoundingClientRect();
    const queueR = queue?.getBoundingClientRect();
    const shellStyle = shell ? getComputedStyle(shell) : null;
    return {
      innerWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio,
      sidebarWidth: Math.round(sidebarW),
      density: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      shellPadding: shellStyle?.paddingTop ?? null,
      shellGap: shellStyle?.columnGap || shellStyle?.gap || null,
      mainWidth: mainR ? Math.round(mainR.width) : null,
      queueWidth: queueR ? Math.round(queueR.width) : null,
      queueHeight: queueR ? Math.round(queueR.height) : null,
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      queueHOverflow: queue ? Math.max(0, queue.scrollWidth - queue.clientWidth) : null,
      rowHOverflow: row ? Math.max(0, row.scrollWidth - row.clientWidth) : null,
    };
  });
}

test.describe('Phase 3 Option A — 1600 density boundary', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('viewport matrix + 1536 laptop + manual toggle + modal', async () => {
    test.setTimeout(360_000);
    const browser: Browser = await chromium.launch();
    const waiting: unknown[] = [];

    for (const profile of PROFILES) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(350);
      const m = await measure(page);
      waiting.push({ profile: profile.label, ...m });
      await page.screenshot({ path: path.join(OUT, `waiting-list-${profile.label}.png`) });

      if (profile.expectExpanded) {
        expect(m.sidebarWidth, `${profile.label} expanded`).toBeGreaterThanOrEqual(200);
        expect(m.density).toBe('desktop');
      } else if (profile.cssW >= 1024) {
        expect(m.sidebarWidth, `${profile.label} collapsed`).toBeLessThanOrEqual(80);
        expect(m.density).toBe('workstation');
      }
      expect(m.pageHOverflow).toBeLessThanOrEqual(1);
      expect(m.queueHOverflow ?? 0).toBeLessThanOrEqual(1);
      expect(m.rowHOverflow ?? 0).toBeLessThanOrEqual(1);
      await context.close();
    }

    // Finalize spot-check key profiles
    const finalize: unknown[] = [];
    for (const profile of [
      PROFILES[0],
      PROFILES[1],
      PROFILES[2],
      PROFILES[3],
      PROFILES[4],
      PROFILES[5],
    ]) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard/counsellors-desk/finalize-surgery`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(350);
      const m = await measure(page);
      finalize.push({ profile: profile.label, ...m });
      await page.screenshot({
        path: path.join(OUT, `finalize-surgery-${profile.label}.png`),
      });
      expect(m.pageHOverflow).toBeLessThanOrEqual(1);
      expect(m.rowHOverflow ?? 0).toBeLessThanOrEqual(1);
      await context.close();
    }

    // Manual toggle at 1536×864
    {
      const context = await browser.newContext({
        viewport: { width: 1536, height: 864 },
        deviceScaleFactor: 1.25,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({
        timeout: 60_000,
      });
      let m = await measure(page);
      expect(m.sidebarWidth).toBeLessThanOrEqual(80);
      await page.getByTestId('sidebar-expand').click();
      await page.waitForTimeout(350);
      m = await measure(page);
      expect(m.sidebarWidth).toBeGreaterThanOrEqual(200);
      // Stay at 1536 — must NOT force-close
      await page.waitForTimeout(500);
      m = await measure(page);
      expect(m.sidebarWidth, 'manual expand holds at 1536').toBeGreaterThanOrEqual(200);
      await page.getByTestId('sidebar-collapse').click();
      await page.waitForTimeout(350);
      m = await measure(page);
      expect(m.sidebarWidth).toBeLessThanOrEqual(80);

      // Cross 1600 boundary → desktop expand
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.waitForTimeout(400);
      m = await measure(page);
      expect(m.sidebarWidth, 'cross to 1600 expands').toBeGreaterThanOrEqual(200);

      // Cross back below 1600 → collapse default
      await page.setViewportSize({ width: 1536, height: 864 });
      await page.waitForTimeout(400);
      m = await measure(page);
      expect(m.sidebarWidth, 'cross below 1600 collapses').toBeLessThanOrEqual(80);
      await context.close();
    }

    // Modal re-verify
    const modalResults: unknown[] = [];
    {
      const context = await browser.newContext({
        viewport: { width: 1536, height: 864 },
        deviceScaleFactor: 1.25,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard/counsellors-desk/finalize-surgery`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({
        timeout: 60_000,
      });
      await page.getByTestId('finalize-status-tab-NotConfirmed').click();
      await page.waitForTimeout(500);
      const row = page.getByTestId('finalize-surgery-work-row').first();
      if (await row.count()) {
        await row.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        const metrics = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]') as HTMLElement | null;
          if (!d) return null;
          const r = d.getBoundingClientRect();
          return {
            width: Math.round(r.width),
            hOverflow: Math.max(0, d.scrollWidth - d.clientWidth),
            exceeds: r.right > window.innerWidth + 1 || r.left < -1,
          };
        });
        modalResults.push({ profile: '1536x864-dpr1.25', ...metrics });
        await page.screenshot({ path: path.join(OUT, 'finalize-ot-modal-1536x864.png') });
        if (metrics) {
          expect(metrics.hOverflow).toBeLessThanOrEqual(1);
          expect(metrics.exceeds).toBe(false);
        }
      }
      await context.close();
    }

    await browser.close();
    fs.writeFileSync(
      path.join(OUT, 'phase3-metrics.json'),
      JSON.stringify({ waiting, finalize, modalResults }, null, 2),
    );
    console.log(JSON.stringify({ waiting, finalize, modalResults }, null, 2));
  });
});
