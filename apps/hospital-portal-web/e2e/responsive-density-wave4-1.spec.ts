/**
 * Wave 4.1 — viewport / breakpoint diagnostic + rendering correction verification.
 * Captures CSS viewport vs DPR vs computed density band.
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-density-wave4-1');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

const PROFILES = [
  { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, expectBand: 'desktop' },
  { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, expectBand: 'desktop' },
  { label: '1536x864-dpr1.25', cssW: 1536, cssH: 864, dpr: 1.25, expectBand: 'workstation' },
  { label: '1440x900', cssW: 1440, cssH: 900, dpr: 1, expectBand: 'workstation' },
  { label: '1366x768', cssW: 1366, cssH: 768, dpr: 1, expectBand: 'workstation' },
  { label: '1280x720', cssW: 1280, cssH: 720, dpr: 1, expectBand: 'workstation' },
  { label: '1200x800', cssW: 1200, cssH: 800, dpr: 1, expectBand: 'workstation' },
  { label: '1024x768', cssW: 1024, cssH: 768, dpr: 1, expectBand: 'workstation' },
] as const;

async function diagnose(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const token = (n: string) => root.getPropertyValue(n).trim();
    const sidebar = document.querySelector('[data-testid="app-sidebar"]') as HTMLElement | null;
    const topnav = document.querySelector('[data-testid="app-topnav"]') as HTMLElement | null;
    const shell = document.querySelector('[data-testid="app-shell"]') as HTMLElement | null;
    const mq1600 = window.matchMedia('(min-width: 1600px)');
    const mq1599 = window.matchMedia('(max-width: 1599.98px)');

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      visualViewportWidth: window.visualViewport?.width ?? null,
      visualViewportScale: window.visualViewport?.scale ?? null,
      mqMin1600: mq1600.matches,
      mqMax1599: mq1599.matches,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      tokens: {
        shellPad: token('--shell-pad'),
        shellGap: token('--shell-gap'),
        topnavHeight: token('--topnav-height'),
        widgetPad: token('--widget-pad'),
        tableHeader: token('--table-header-height'),
        tableCell: token('--table-cell-pad'),
        sidebarExpanded: token('--sidebar-expanded-width'),
        sidebarCollapsed: token('--sidebar-collapsed-width'),
        controlWs: token('--control-height-workstation'),
      },
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      sidebarMode: sidebar?.getAttribute('data-sidebar-mode') || null,
      sidebarCollapsedAttr: sidebar?.getAttribute('data-sidebar-collapsed') || null,
      densityBandAttr: document.documentElement.dataset.densityBand || null,
      sidebarInlineWidth: sidebar?.style.width || null,
      topnavHeight: topnav ? Math.round(topnav.getBoundingClientRect().height) : null,
      shellPad: shell ? getComputedStyle(shell).paddingTop : null,
      shellGap: shell ? getComputedStyle(shell).columnGap || getComputedStyle(shell).gap : null,
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      expandBtn: !!document.querySelector('[data-testid="sidebar-expand"]'),
      collapseBtn: !!document.querySelector('[data-testid="sidebar-collapse"]'),
    };
  });
}

test.describe('Wave 4.1 — viewport/breakpoint diagnostic', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('full viewport matrix + waiting-list + finalize + inventory', async () => {
    test.setTimeout(480_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

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
      await page.waitForTimeout(400);
      const m = await diagnose(page);
      report.push({ route: 'waiting-list', profile: profile.label, ...m });

      // Assertions: CSS tokens and shell must follow CSS viewport, not physical screen
      expect(m.innerWidth, profile.label).toBe(profile.cssW);
      expect(m.mqMin1600).toBe(profile.expectBand === 'desktop');
      expect(m.mqMax1599).toBe(profile.expectBand === 'workstation');
      expect(m.densityBand).toBe(profile.expectBand);

      if (profile.expectBand === 'desktop') {
        expect(m.tokens.shellPad).toBe('12px');
        expect(m.tokens.topnavHeight).toBe('56px');
        expect(m.tokens.widgetPad).toBe('24px');
        expect(m.sidebarWidth).toBeGreaterThanOrEqual(200);
        expect(m.topnavHeight).toBe(56);
        expect(m.collapseBtn).toBe(true);
        expect(m.expandBtn).toBe(false);
        expect(m.sidebarMode).toBe('auto');
        expect(m.densityBandAttr).toBe('desktop');
      } else if (profile.cssW >= 1024) {
        expect(m.tokens.shellPad).toBe('8px');
        expect(m.tokens.topnavHeight).toBe('48px');
        expect(m.tokens.widgetPad).toBe('16px');
        expect(m.sidebarWidth, `${profile.label} must be collapsed`).toBeLessThanOrEqual(80);
        expect(m.topnavHeight).toBe(48);
        expect(m.expandBtn).toBe(true);
        expect(m.collapseBtn).toBe(false);
        expect(m.sidebarMode).toBe('auto');
        expect(m.densityBandAttr).toBe('workstation');
      }

      expect(m.pageHOverflow).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: path.join(OUT, `waiting-list-${profile.label}.png`),
        fullPage: false,
      });
      await context.close();
    }

    // Key pages at desktop + primary workstation
    for (const route of [
      { id: 'dashboard', path: '/dashboard' },
      { id: 'finalize-surgery', path: '/dashboard/counsellors-desk/finalize-surgery', heading: 'Surgery Finalization' },
      { id: 'admin-inventory', path: '/admin/inventory' },
    ]) {
      for (const profile of [PROFILES[0], PROFILES[1], PROFILES[2]]) {
        const context = await browser.newContext({
          viewport: { width: profile.cssW, height: profile.cssH },
          deviceScaleFactor: profile.dpr,
          storageState: AUTH,
        });
        const page = await context.newPage();
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded' });
        if (route.heading) {
          await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({
            timeout: 60_000,
          });
        } else {
          await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({
            timeout: 60_000,
          });
        }
        await page.waitForTimeout(300);
        const m = await diagnose(page);
        report.push({ route: route.id, profile: profile.label, ...m });
        if (profile.expectBand === 'workstation' && profile.cssW >= 1024) {
          expect(m.sidebarWidth, `${route.id} ${profile.label}`).toBeLessThanOrEqual(80);
          expect(m.topnavHeight).toBe(48);
        }
        if (profile.expectBand === 'desktop') {
          expect(m.sidebarWidth).toBeGreaterThanOrEqual(200);
          expect(m.topnavHeight).toBe(56);
        }
        await page.screenshot({
          path: path.join(OUT, `${route.id}-${profile.label}.png`),
          fullPage: false,
        });
        await context.close();
      }
    }

    fs.writeFileSync(path.join(OUT, 'diagnostics.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
