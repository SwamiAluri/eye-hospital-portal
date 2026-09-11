/**
 * Phase-1 audit: shell / sidebar / content proportions (no implementation).
 * Run: npx playwright test e2e/responsive-shell-audit.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-shell-audit');

const VIEWPORTS = [
  { w: 1920, h: 1080, label: '1920x1080' },
  { w: 1600, h: 900, label: '1600x900' },
  { w: 1440, h: 900, label: '1440x900' },
  { w: 1366, h: 768, label: '1366x768' },
  { w: 1280, h: 720, label: '1280x720' },
  { w: 1200, h: 800, label: '1200x800' },
  { w: 1024, h: 768, label: '1024x768' },
] as const;

async function measureShell(page: import('@playwright/test').Page, pageKind: 'waiting' | 'finalize') {
  return page.evaluate((kind) => {
    const sidebarCard = document.querySelector(
      'div.hidden.lg\\:flex.flex-shrink-0.rounded-2xl',
    ) as HTMLElement | null;
    const sidebarNav = document.querySelector('nav[aria-label="Main navigation"]') as HTMLElement | null;
    const topNav = document.querySelector('#main-content')?.parentElement?.querySelector(
      '.rounded-2xl.overflow-hidden.shadow-md.flex-shrink-0',
    ) as HTMLElement | null;
    // Prefer first rounded card in right column
    const rightCol = document.querySelector('main#main-content')?.parentElement as HTMLElement | null;
    const topNavCard = rightCol?.children?.[0] as HTMLElement | undefined;
    const main = document.querySelector('main#main-content') as HTMLElement | null;
    const pageRoot = document.querySelector('.counselling-session') as HTMLElement | null;
    const title = document.querySelector('h1') as HTMLElement | null;
    const summary =
      (document.querySelector('[data-testid="waiting-list-stats"], [data-testid="finalize-surgery-summary"]') as HTMLElement | null);
    const statusNav =
      (document.querySelector(
        '[data-testid="waiting-list-summary-strip"], [data-testid="finalize-surgery-status-nav"]',
      ) as HTMLElement | null);
    const filters =
      (document.querySelector(
        '[data-testid="waiting-list-queue-toolbar"], [data-testid="finalize-surgery-toolbar"]',
      ) as HTMLElement | null);
    const queue =
      (document.querySelector(
        kind === 'waiting'
          ? '[data-testid="waiting-list-queue"]'
          : '[data-testid="finalize-surgery-workspace"]',
      ) as HTMLElement | null);
    const row = document.querySelector(
      kind === 'waiting'
        ? '[data-testid="waiting-list-work-row"]'
        : '[data-testid="finalize-surgery-work-row"]',
    ) as HTMLElement | null;

    const rect = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        left: Math.round(r.left),
      };
    };

    const overflow = (el: HTMLElement | null) =>
      el ? Math.max(0, el.scrollWidth - el.clientWidth) : null;

    const sidebarW = sidebarCard?.getBoundingClientRect().width ?? sidebarNav?.getBoundingClientRect().width ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Height above queue (title through filters / status)
    const queueTop = queue?.getBoundingClientRect().top ?? null;
    const mainTop = main?.getBoundingClientRect().top ?? null;
    const chromeAboveQueue =
      queueTop != null && mainTop != null ? Math.round(queueTop - mainTop) : null;

    return {
      innerWidth: vw,
      innerHeight: vh,
      clientWidth: document.documentElement.clientWidth,
      pageHOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebarWidth: Math.round(sidebarW),
      sidebarPctOfViewport: vw ? Math.round((sidebarW / vw) * 1000) / 10 : null,
      sidebarVisible: sidebarW > 0,
      main: rect(main),
      topNav: rect(topNavCard ?? topNav),
      pageRoot: rect(pageRoot),
      title: rect(title),
      summary: rect(summary),
      statusNav: rect(statusNav),
      filters: rect(filters),
      queue: rect(queue),
      queueClientW: queue?.clientWidth ?? null,
      queueScrollW: queue?.scrollWidth ?? null,
      queueHOverflow: overflow(queue),
      rowClientW: row?.clientWidth ?? null,
      rowScrollW: row?.scrollWidth ?? null,
      rowHOverflow: overflow(row),
      chromeAboveQueuePx: chromeAboveQueue,
      queueHeightPctOfViewport: queue && vh ? Math.round((queue.getBoundingClientRect().height / vh) * 1000) / 10 : null,
    };
  }, pageKind);
}

test.describe('Responsive shell proportion audit', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('Waiting List + Surgery Finalization shell metrics', async ({ page }) => {
    test.setTimeout(240_000);
    const waiting: unknown[] = [];
    const finalize: unknown[] = [];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/dashboard/counsellors-desk/waiting-list', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(400);
      const m = await measureShell(page, 'waiting');
      waiting.push({ viewport: vp.label, ...m });
      await page.screenshot({ path: path.join(OUT, `waiting-list-${vp.label}.png`), fullPage: false });
    }

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(400);
      const m = await measureShell(page, 'finalize');
      finalize.push({ viewport: vp.label, ...m });
      await page.screenshot({ path: path.join(OUT, `finalize-surgery-${vp.label}.png`), fullPage: false });
    }

    // Collapsed sidebar gain at typical laptop width
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dashboard/counsellors-desk/waiting-list', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({ timeout: 60_000 });
    const before = await measureShell(page, 'waiting');
    // Click collapse control (PanelLeftClose / expand toggle in sidebar header)
    const collapseBtn = page.locator('nav[aria-label="Main navigation"] button').first();
    if (await collapseBtn.count()) {
      await collapseBtn.click();
      await page.waitForTimeout(350);
    }
    const after = await measureShell(page, 'waiting');
    const collapseDelta = {
      viewport: '1366x768',
      beforeSidebar: (before as { sidebarWidth: number }).sidebarWidth,
      afterSidebar: (after as { sidebarWidth: number }).sidebarWidth,
      beforeMainW: (before as { main: { w: number } | null }).main?.w ?? null,
      afterMainW: (after as { main: { w: number } | null }).main?.w ?? null,
      beforeQueueW: (before as { queueClientW: number | null }).queueClientW,
      afterQueueW: (after as { queueClientW: number | null }).queueClientW,
      workspaceGainPx:
        ((after as { main: { w: number } | null }).main?.w ?? 0) -
        ((before as { main: { w: number } | null }).main?.w ?? 0),
    };

    fs.writeFileSync(
      path.join(OUT, 'shell-audit.json'),
      JSON.stringify({ waiting, finalize, collapseDelta }, null, 2),
    );
    console.log(JSON.stringify({ collapseDelta, sample1366: waiting.find((r) => (r as { viewport: string }).viewport === '1366x768'), sample1920: waiting.find((r) => (r as { viewport: string }).viewport === '1920x1080') }, null, 2));
  });
});
