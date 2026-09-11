/**
 * Phase 3 AUDIT ONLY — CSS viewport vs high-DPI / display scaling.
 * Proves why <1440 collapse may not fire on a real 14" laptop.
 *
 * Run: npx playwright test e2e/responsive-shell-phase3-audit.spec.ts --project=chromium
 */
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-shell-phase3-audit');

/** Common workstation profiles (CSS viewport × DPR). */
const PROFILES = [
  { label: 'large-desktop-1920x1080-dpr1', cssW: 1920, cssH: 1080, dpr: 1 },
  { label: 'large-desktop-1600x900-dpr1', cssW: 1600, cssH: 900, dpr: 1 },
  { label: 'sot-1440x900-dpr1', cssW: 1440, cssH: 900, dpr: 1 },
  /** Typical 14" FHD @ 125% Windows scaling → CSS ~1536×864 */
  { label: 'laptop-fhd-125pct', cssW: 1536, cssH: 864, dpr: 1.25 },
  /** Typical 14" FHD @ 150% → CSS ~1280×720 */
  { label: 'laptop-fhd-150pct', cssW: 1280, cssH: 720, dpr: 1.5 },
  { label: 'laptop-1366x768-dpr1', cssW: 1366, cssH: 768, dpr: 1 },
  { label: 'laptop-1280x720-dpr1', cssW: 1280, cssH: 720, dpr: 1 },
  /** QHD/retina-ish laptop @ 150% often still ≥1440 CSS */
  { label: 'laptop-qhd-150pct-approx', cssW: 1707, cssH: 1067, dpr: 1.5 },
  { label: 'constrained-1024x768-dpr1', cssW: 1024, cssH: 768, dpr: 1 },
] as const;

async function collectMetrics(page: Page) {
  return page.evaluate(() => {
    const sidebarCard = document.querySelector(
      'div.hidden.lg\\:flex.flex-shrink-0.rounded-2xl',
    ) as HTMLElement | null;
    const main = document.querySelector('main#main-content') as HTMLElement | null;
    const queue = document.querySelector(
      '[data-testid="waiting-list-queue"], [data-testid="finalize-surgery-workspace"]',
    ) as HTMLElement | null;
    const sidebarW = sidebarCard?.getBoundingClientRect().width ?? 0;
    const mainR = main?.getBoundingClientRect();
    const queueR = queue?.getBoundingClientRect();
    const vv = window.visualViewport;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      visualViewportWidth: vv?.width ?? null,
      visualViewportHeight: vv?.height ?? null,
      sidebarWidth: Math.round(sidebarW),
      sidebarPctOfViewport: window.innerWidth
        ? Math.round((sidebarW / window.innerWidth) * 1000) / 10
        : null,
      mainWidth: mainR ? Math.round(mainR.width) : null,
      mainLeft: mainR ? Math.round(mainR.left) : null,
      queueWidth: queueR ? Math.round(queueR.width) : null,
      queueHeight: queueR ? Math.round(queueR.height) : null,
      chromeAboveQueue:
        mainR && queueR ? Math.round(queueR.top - mainR.top) : null,
      phase2WouldExpand: window.innerWidth >= 1440,
      phase2WouldCollapse: window.innerWidth < 1440,
    };
  });
}

test.describe('Phase 3 density audit (no implementation)', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('measure CSS×DPR profiles against Phase 2 1440 rule', async () => {
    test.setTimeout(300_000);
    const browser: Browser = await chromium.launch();
    const rows: unknown[] = [];

    for (const profile of PROFILES) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: path.join(__dirname, '.auth', 'user.json'),
      });
      const page = await context.newPage();
      await page.goto('http://localhost:3000/dashboard/counsellors-desk/waiting-list', {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(400);
      const m = await collectMetrics(page);
      const row = {
        profile: profile.label,
        configuredCss: `${profile.cssW}x${profile.cssH}`,
        configuredDpr: profile.dpr,
        ...m,
        mismatchRisk:
          m.phase2WouldExpand && profile.cssW < 1920
            ? 'HIGH — Phase2 expands sidebar on non-large-desktop CSS width'
            : m.phase2WouldExpand
              ? 'OK — large desktop expand expected'
              : 'OK — Phase2 collapses',
      };
      rows.push(row);
      await page.screenshot({
        path: path.join(OUT, `waiting-list-${profile.label}.png`),
      });
      await context.close();
    }

    await browser.close();
    fs.writeFileSync(path.join(OUT, 'phase3-density-audit.json'), JSON.stringify(rows, null, 2));
    console.log(JSON.stringify(rows, null, 2));
  });
});
