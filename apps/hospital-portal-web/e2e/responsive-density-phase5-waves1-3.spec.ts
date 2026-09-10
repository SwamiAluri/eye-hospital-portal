/**
 * Phase 5 Waves 1–3 — global density tokens + shell + TopNav/Sidebar chrome.
 * Run: npx playwright test e2e/responsive-density-phase5-waves1-3.spec.ts --project=chromium
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-density-phase5-waves1-3');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

const PROFILES = [
  { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, band: 'desktop' as const },
  { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, band: 'desktop' as const },
  { label: '1536x864-dpr1.25', cssW: 1536, cssH: 864, dpr: 1.25, band: 'workstation' as const },
  { label: '1440x900', cssW: 1440, cssH: 900, dpr: 1, band: 'workstation' as const },
  { label: '1366x768', cssW: 1366, cssH: 768, dpr: 1, band: 'workstation' as const },
  { label: '1280x720', cssW: 1280, cssH: 720, dpr: 1, band: 'workstation' as const },
  { label: '1200x800', cssW: 1200, cssH: 800, dpr: 1, band: 'workstation' as const },
  { label: '1024x768', cssW: 1024, cssH: 768, dpr: 1, band: 'workstation' as const },
] as const;

async function measureShell(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const shell = document.querySelector('[data-testid="app-shell"]') as HTMLElement | null;
    const topnav = document.querySelector('[data-testid="app-topnav"]') as HTMLElement | null;
    const sidebar = document.querySelector('[data-testid="app-sidebar"]') as HTMLElement | null;
    const sidebarCard = document.querySelector(
      'div.hidden.lg\\:flex.flex-shrink-0.rounded-2xl',
    ) as HTMLElement | null;
    const bellBtn = document.querySelector(
      '[data-testid="topnav-notifications"]',
    ) as HTMLElement | null;
    const bell = bellBtn?.querySelector('svg') as SVGElement | null;
    const avatar = document.querySelector(
      '[data-testid="topnav-avatar"]',
    ) as HTMLElement | null;
    const shellStyle = shell ? getComputedStyle(shell) : null;
    const topnavStyle = topnav ? getComputedStyle(topnav) : null;
    const sidebarR = (sidebar ?? sidebarCard)?.getBoundingClientRect();

    const token = (name: string) => rootStyle.getPropertyValue(name).trim();

    return {
      innerWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio,
      tokens: {
        shellPad: token('--shell-pad'),
        shellGap: token('--shell-gap'),
        topnavHeight: token('--topnav-height'),
        topnavPadX: token('--topnav-pad-x'),
        topnavGap: token('--topnav-gap'),
        topnavIcon: token('--topnav-icon-size'),
        topnavAvatar: token('--topnav-avatar-size'),
        sidebarExpanded: token('--sidebar-expanded-width'),
        sidebarCollapsed: token('--sidebar-collapsed-width'),
        sidebarLogo: token('--sidebar-logo-size'),
        sidebarSectionIcon: token('--sidebar-section-icon-size'),
        sidebarIcon: token('--sidebar-icon-size'),
        sidebarItemPadY: token('--sidebar-item-pad-y'),
      },
      shellPadding: shellStyle?.paddingTop ?? null,
      shellGap: shellStyle?.columnGap || shellStyle?.gap || null,
      topnavHeight: topnav ? Math.round(topnav.getBoundingClientRect().height) : null,
      topnavPadX: topnavStyle?.paddingLeft ?? null,
      sidebarWidth: sidebarR ? Math.round(sidebarR.width) : 0,
      bellSize: bell ? Math.round(bell.getBoundingClientRect().width) : null,
      avatarSize: avatar ? Math.round(avatar.getBoundingClientRect().width) : null,
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      shellHOverflow: shell ? Math.max(0, shell.scrollWidth - shell.clientWidth) : null,
      topnavHOverflow: topnav ? Math.max(0, topnav.scrollWidth - topnav.clientWidth) : null,
    };
  });
}

test.describe('Phase 5 Waves 1–3 — density tokens + shell chrome', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('token resolution + shell geometry matrix + admin parity + sidebar override', async () => {
    test.setTimeout(420_000);
    expect(fs.existsSync(AUTH), 'e2e auth storageState').toBe(true);

    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

    for (const profile of PROFILES) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-testid="topnav-notifications"]')).toBeVisible({
        timeout: 30_000,
      });
      await page.waitForTimeout(300);

      const m = await measureShell(page);
      report.push({ route: 'dashboard', profile: profile.label, ...m });
      await page.screenshot({
        path: path.join(OUT, `dashboard-${profile.label}.png`),
        fullPage: false,
      });

      if (profile.band === 'desktop') {
        expect(m.tokens.shellPad, profile.label).toBe('12px');
        expect(m.tokens.shellGap).toBe('12px');
        expect(m.tokens.topnavHeight).toBe('56px');
        expect(m.tokens.topnavPadX).toBe('20px');
        expect(m.tokens.topnavIcon).toBe('24px');
        expect(m.tokens.topnavAvatar).toBe('32px');
        expect(m.tokens.sidebarLogo).toBe('36px');
        expect(m.tokens.sidebarSectionIcon).toBe('20px');
        expect(m.tokens.sidebarItemPadY).toBe('10px');
        expect(m.shellPadding).toBe('12px');
        expect(m.shellGap).toBe('12px');
        expect(m.topnavHeight).toBe(56);
        expect(m.topnavPadX).toBe('20px');
        expect(m.sidebarWidth).toBeGreaterThanOrEqual(200);
        expect(m.bellSize).toBe(24);
        expect(m.avatarSize).toBe(32);
      } else if (profile.cssW >= 1024) {
        expect(m.tokens.shellPad, profile.label).toBe('8px');
        expect(m.tokens.shellGap).toBe('8px');
        expect(m.tokens.topnavHeight).toBe('48px');
        expect(m.tokens.topnavPadX).toBe('16px');
        expect(m.tokens.topnavIcon).toBe('20px');
        expect(m.tokens.topnavAvatar).toBe('28px');
        expect(m.tokens.sidebarLogo).toBe('32px');
        expect(m.tokens.sidebarSectionIcon).toBe('18px');
        expect(m.tokens.sidebarItemPadY).toBe('8px');
        expect(m.shellPadding).toBe('8px');
        expect(m.shellGap).toBe('8px');
        expect(m.topnavHeight).toBe(48);
        expect(m.topnavPadX).toBe('16px');
        expect(m.sidebarWidth).toBeLessThanOrEqual(80);
        expect(m.bellSize).toBe(20);
        expect(m.avatarSize).toBe(28);
      }

      expect(m.pageHOverflow, profile.label).toBeLessThanOrEqual(1);
      expect(m.shellHOverflow ?? 0).toBeLessThanOrEqual(1);
      expect(m.topnavHOverflow ?? 0).toBeLessThanOrEqual(1);
      await context.close();
    }

    // Admin shell parity at desktop + primary workstation
    for (const profile of [PROFILES[0], PROFILES[2]]) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/admin/inventory`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-testid="topnav-notifications"]')).toBeVisible({
        timeout: 30_000,
      });
      await page.waitForTimeout(300);
      const m = await measureShell(page);
      report.push({ route: 'admin/inventory', profile: profile.label, ...m });
      await page.screenshot({
        path: path.join(OUT, `admin-inventory-${profile.label}.png`),
        fullPage: false,
      });

      if (profile.band === 'desktop') {
        expect(m.shellPadding).toBe('12px');
        expect(m.shellGap).toBe('12px');
        expect(m.topnavHeight).toBe(56);
      } else {
        expect(m.shellPadding).toBe('8px');
        expect(m.shellGap).toBe('8px');
        expect(m.topnavHeight).toBe(48);
      }
      await context.close();
    }

    // Manual sidebar override at 1536 (workstation default collapsed)
    {
      const context = await browser.newContext({
        viewport: { width: 1536, height: 864 },
        deviceScaleFactor: 1.25,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible({ timeout: 60_000 });
      let m = await measureShell(page);
      expect(m.sidebarWidth).toBeLessThanOrEqual(80);
      await page.getByTestId('sidebar-expand').click();
      await page.waitForTimeout(350);
      m = await measureShell(page);
      expect(m.sidebarWidth).toBeGreaterThanOrEqual(200);
      await page.getByTestId('sidebar-collapse').click();
      await page.waitForTimeout(350);
      m = await measureShell(page);
      expect(m.sidebarWidth).toBeLessThanOrEqual(80);
      await context.close();
    }

    fs.writeFileSync(path.join(OUT, 'measurements.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
