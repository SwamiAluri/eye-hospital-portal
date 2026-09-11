/**
 * Wave 5 — staff page composition density (workstation <1600, desktop SoT preserved).
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-density-wave5');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

const KEY_PROFILES = [
  { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, expectBand: 'desktop' as const },
  { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, expectBand: 'desktop' as const },
  { label: '1280x720', cssW: 1280, cssH: 720, dpr: 1.5, expectBand: 'workstation' as const },
  { label: '1536x864-dpr1.25', cssW: 1536, cssH: 864, dpr: 1.25, expectBand: 'workstation' as const },
];

const ROUTES = [
  { id: 'dashboard', path: '/dashboard' },
  { id: 'waiting-list', path: '/dashboard/counsellors-desk/waiting-list', heading: 'Waiting List' },
  { id: 'finalize-surgery', path: '/dashboard/counsellors-desk/finalize-surgery', heading: 'Surgery Finalization' },
  { id: 'opd-queue', path: '/dashboard/frontdesk/queue', heading: 'Queue Management' },
  { id: 'doctors-desk', path: '/dashboard/doctors-desk', heading: /Doctor/ },
  { id: 'ccms', path: '/dashboard/ccms', heading: /Coverage/ },
  { id: 'billing-opd', path: '/dashboard/billing/opd' },
  { id: 'admin-inventory', path: '/admin/inventory', heading: 'Inventory Management' },
];

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const token = (n: string) => root.getPropertyValue(n).trim();
    const sidebar = document.querySelector('[data-testid="app-sidebar"]') as HTMLElement | null;
    const topnav = document.querySelector('[data-testid="app-topnav"]') as HTMLElement | null;
    const shell = document.querySelector('[data-testid="app-shell"]') as HTMLElement | null;
    const h1 = document.querySelector('h1') as HTMLElement | null;
    const workRow =
      (document.querySelector('[data-testid="waiting-list-work-row"]') as HTMLElement | null) ||
      (document.querySelector('.staff-worklist-row') as HTMLElement | null);
    const btn = document.querySelector('button') as HTMLElement | null;
    const input = document.querySelector('input:not([type="hidden"])') as HTMLElement | null;

    return {
      innerWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      densityBandAttr: document.documentElement.dataset.densityBand || null,
      tokens: {
        pagePad: token('--page-pad'),
        pageSectionGap: token('--page-section-gap'),
        pageHeaderPadY: token('--page-header-pad-y'),
        pageContentPad: token('--page-content-pad'),
        kpiPad: token('--kpi-pad'),
        toolbarGap: token('--toolbar-gap'),
        worklistRowMinH: token('--worklist-row-min-h'),
        worklistRowPadY: token('--worklist-row-pad-y'),
        pageTitleSize: token('--page-title-size'),
        kpiValueSize: token('--kpi-value-size'),
        widgetPad: token('--widget-pad'),
        shellPad: token('--shell-pad'),
        topnavHeight: token('--topnav-height'),
        controlWs: token('--control-height-workstation'),
      },
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      topnavHeight: topnav ? Math.round(topnav.getBoundingClientRect().height) : null,
      shellPad: shell ? getComputedStyle(shell).paddingTop : null,
      pageTitle: h1
        ? {
            height: Math.round(h1.getBoundingClientRect().height),
            fontSize: getComputedStyle(h1).fontSize,
          }
        : null,
      worklistRow: workRow
        ? {
            height: Math.round(workRow.getBoundingClientRect().height),
            padY: getComputedStyle(workRow).paddingTop,
          }
        : null,
      defaultButtonHeight: btn ? Math.round(btn.getBoundingClientRect().height) : null,
      inputHeight: input ? Math.round(input.getBoundingClientRect().height) : null,
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

test.describe('Wave 5 — page composition density', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('desktop tokens preserved; workstation page tokens denser; screenshots', async () => {
    test.setTimeout(600_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

    for (const profile of KEY_PROFILES) {
      for (const route of ROUTES) {
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
          await page.waitForTimeout(1500);
        }
        await page.waitForTimeout(350);
        const m = await measure(page);
        report.push({ route: route.id, profile: profile.label, ...m });

        expect(m.innerWidth).toBe(profile.cssW);
        expect(m.densityBand).toBe(profile.expectBand);
        expect(m.pageHOverflow).toBeLessThanOrEqual(2);

        if (profile.expectBand === 'desktop') {
          expect(m.tokens.pagePad).toBe('24px');
          expect(m.tokens.pageSectionGap).toBe('24px');
          expect(m.tokens.kpiPad).toBe('20px');
          expect(m.tokens.worklistRowMinH).toBe('56px');
          expect(m.tokens.pageTitleSize).toBe('1.25rem');
          expect(m.tokens.widgetPad).toBe('24px');
          expect(m.tokens.shellPad).toBe('12px');
        } else {
          expect(m.tokens.pagePad).toBe('12px');
          expect(m.tokens.pageSectionGap).toBe('12px');
          expect(m.tokens.kpiPad).toBe('12px');
          expect(m.tokens.worklistRowMinH).toBe('48px');
          expect(m.tokens.worklistRowPadY).toBe('8px');
          expect(m.tokens.pageTitleSize).toBe('1.125rem');
          expect(m.tokens.kpiValueSize).toBe('1.25rem');
          expect(m.tokens.widgetPad).toBe('16px');
          expect(m.tokens.shellPad).toBe('8px');
        }

        await page.screenshot({
          path: path.join(OUT, `${route.id}-${profile.label}.png`),
          fullPage: false,
        });
        await context.close();
      }
    }

    fs.writeFileSync(path.join(OUT, 'wave5-measurements.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
