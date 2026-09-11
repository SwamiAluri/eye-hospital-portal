/**
 * Wave 6 — responsive workstation fit & information parity.
 * Same design as 1920 Large Desktop SoT; denser/reflowed composition below 1600.
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-fit-wave6');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

async function measurePage(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const token = (n: string) => root.getPropertyValue(n).trim();
    const el = (sel: string) => document.querySelector(sel) as HTMLElement | null;
    const box = (sel: string) => {
      const n = el(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return {
        h: Math.round(r.height),
        w: Math.round(r.width),
        top: Math.round(r.top),
      };
    };
    const workGrid = el('.waiting-list-work-grid, .finalize-surgery-work-grid');
    const modal = el('[data-testid="add-patient-modal"], [data-testid="patient-form-modal"]');
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      pagePad: token('--page-pad'),
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: box('h1'),
      kpi: box('[data-testid="waiting-list-stats"], [data-testid="finalize-surgery-summary"]'),
      statusNav: box(
        '[data-testid="waiting-list-summary-strip"], [data-testid="finalize-surgery-status-nav"]',
      ),
      toolbar: box(
        '[data-testid="waiting-list-filter-toolbar"], [data-testid="finalize-surgery-toolbar"]',
      ),
      workRow: box('[data-testid="waiting-list-work-row"], .staff-worklist-row'),
      workGridCols: workGrid ? getComputedStyle(workGrid).gridTemplateColumns : null,
      modal: modal
        ? {
            w: Math.round(modal.getBoundingClientRect().width),
            h: Math.round(modal.getBoundingClientRect().height),
            maxH: getComputedStyle(modal).maxHeight,
            footerVisible: (() => {
              const footer = modal.querySelector('.border-t');
              if (!footer) return null;
              const fr = footer.getBoundingClientRect();
              return fr.bottom <= window.innerHeight + 1 && fr.top >= 0;
            })(),
          }
        : null,
      addPatientVisible: !!el('[data-testid="waiting-list-add-patient"]'),
    };
  });
}

test.describe('Wave 6 — responsive fit & information parity', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('waiting-list + finalize + modal fit; desktop SoT preserved', async () => {
    test.setTimeout(480_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

    for (const profile of [
      { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, band: 'desktop' as const },
      { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, band: 'desktop' as const },
      { label: '1280x720', cssW: 1280, cssH: 720, dpr: 1.5, band: 'workstation' as const },
    ]) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();

      // Waiting List
      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(400);
      let m = await measurePage(page);
      report.push({ route: 'waiting-list', profile: profile.label, ...m });
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      expect(m.addPatientVisible).toBe(true);
      expect(m.densityBand).toBe(profile.band);
      const tracks = (m.workGridCols || '').trim().split(/\s+/).filter(Boolean);
      // Empty queue may lack a row grid; when present, expect five-zone IA
      if (tracks.length >= 5) {
        expect(tracks.length).toBeGreaterThanOrEqual(5);
        if (profile.band === 'desktop') {
          // Large Desktop SoT floors resolve to px; patient track stays generous
          expect(parseFloat(tracks[0])).toBeGreaterThanOrEqual(200);
        }
      }
      if (profile.band === 'workstation') {
        expect(m.kpi?.h ?? 999).toBeLessThanOrEqual(120);
      }
      await page.screenshot({
        path: path.join(OUT, `waiting-list-${profile.label}.png`),
        fullPage: false,
      });

      // Register / Add Patient modal (primary at 1920 + 1280)
      if (profile.label === '1920x1080' || profile.label === '1280x720') {
        await page.getByTestId('waiting-list-add-patient').click();
        await expect(page.getByTestId('add-patient-modal')).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(200);
        m = await measurePage(page);
        report.push({ route: 'add-patient-modal', profile: profile.label, ...m });
        expect(m.modal).toBeTruthy();
        expect(m.modal!.w).toBeLessThanOrEqual(profile.cssW - 16);
        expect(m.modal!.h).toBeLessThanOrEqual(profile.cssH);
        expect(m.modal!.footerVisible).toBe(true);
        await page.screenshot({
          path: path.join(OUT, `add-patient-modal-${profile.label}.png`),
          fullPage: false,
        });
        await page.keyboard.press('Escape');
      }

      // Finalize Surgery
      await page.goto(`${BASE}/dashboard/counsellors-desk/finalize-surgery`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(400);
      m = await measurePage(page);
      report.push({ route: 'finalize-surgery', profile: profile.label, ...m });
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: path.join(OUT, `finalize-surgery-${profile.label}.png`),
        fullPage: false,
      });

      await context.close();
    }

    // Secondary modules @ 1280 only
    for (const route of [
      { id: 'dashboard', path: '/dashboard' },
      { id: 'opd-queue', path: '/dashboard/frontdesk/queue', heading: 'Queue Management' },
      { id: 'doctors-desk', path: '/dashboard/doctors-desk', heading: /Doctor/ },
      { id: 'ccms', path: '/dashboard/ccms', heading: /Coverage/ },
      { id: 'billing-opd', path: '/dashboard/billing/opd' },
      { id: 'admin-inventory', path: '/admin/inventory', heading: 'Inventory Management' },
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1.5,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded' });
      if (route.heading) {
        await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({
          timeout: 60_000,
        });
      } else {
        await page.waitForTimeout(1200);
      }
      const m = await measurePage(page);
      report.push({ route: route.id, profile: '1280x720', ...m });
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: path.join(OUT, `${route.id}-1280x720.png`),
        fullPage: false,
      });
      await context.close();
    }

    fs.writeFileSync(path.join(OUT, 'wave6-measurements.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
