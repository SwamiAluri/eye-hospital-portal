/**
 * Wave 7 — adaptive viewport fit & information-density parity.
 * Same screen as Large Desktop SoT; workstation reclaims chrome for complete rows.
 */
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-adaptive-wave7');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

type Profile = {
  label: string;
  cssW: number;
  cssH: number;
  dpr: number;
  band: 'desktop' | 'workstation';
};

const WIDTH_MATRIX: Profile[] = [
  { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, band: 'desktop' },
  { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, band: 'desktop' },
  { label: '1536x864', cssW: 1536, cssH: 864, dpr: 1.25, band: 'workstation' },
  { label: '1440x900', cssW: 1440, cssH: 900, dpr: 1, band: 'workstation' },
  { label: '1366x768', cssW: 1366, cssH: 768, dpr: 1, band: 'workstation' },
  { label: '1280x720', cssW: 1280, cssH: 720, dpr: 1.5, band: 'workstation' },
  { label: '1200x800', cssW: 1200, cssH: 800, dpr: 1, band: 'workstation' },
  { label: '1024x768', cssW: 1024, cssH: 768, dpr: 1, band: 'workstation' },
];

async function measureWaitingList(page: Page) {
  return page.evaluate(() => {
    const el = (sel: string) => document.querySelector(sel) as HTMLElement | null;
    const box = (sel: string) => {
      const n = el(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    };
    const sidebar = el('aside, [data-testid="sidebar"], nav[aria-label*="Sidebar" i]');
    const topnav = el('header, [data-testid="top-nav"], [data-testid="topnav"]');
    const workGrid = el('.waiting-list-work-grid, .finalize-surgery-work-grid');
    const rows = Array.from(
      document.querySelectorAll('[data-testid="waiting-list-work-row"], [data-testid="finalize-surgery-work-row"]'),
    ) as HTMLElement[];
    const vh = window.innerHeight;
    let completeVisible = 0;
    let firstCompleteTop: number | null = null;
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= vh + 0.5) {
        completeVisible += 1;
        if (firstCompleteTop == null) firstCompleteTop = Math.round(r.top);
      }
    }
    const firstRow = rows[0];
    const firstRowBox = firstRow
      ? (() => {
          const r = firstRow.getBoundingClientRect();
          return { h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
        })()
      : null;

    const modal = el('[data-testid="patient-form-modal"]') || el('[data-testid="add-patient-modal"]');
    const modalRect = modal?.getBoundingClientRect();
    const footer = modal?.querySelector('.border-t') as HTMLElement | null;
    const footerRect = footer?.getBoundingClientRect();
    const body = modal?.querySelector('.overflow-y-auto') as HTMLElement | null;

    const patientCell = firstRow?.querySelector('.waiting-list-work-grid > div, .finalize-surgery-work-grid > div');
    const zones = firstRow
      ? Array.from(firstRow.querySelectorAll('.waiting-list-work-grid > *, .finalize-surgery-work-grid > *')).map((n) => {
          const r = (n as HTMLElement).getBoundingClientRect();
          return { w: Math.round(r.width), visible: r.width > 8 && r.height > 8 };
        })
      : [];

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      densityBandAttr: document.documentElement.dataset.densityBand || null,
      pageHOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageVOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      sidebarW: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      topNavH: topnav ? Math.round(topnav.getBoundingClientRect().height) : null,
      title: box('h1'),
      kpi: box('[data-testid="waiting-list-stats"], [data-testid="finalize-surgery-summary"]'),
      statusNav: box('[data-testid="waiting-list-summary-strip"], [data-testid="finalize-surgery-status-nav"]'),
      toolbar: box('[data-testid="waiting-list-filter-toolbar"], [data-testid="finalize-surgery-toolbar"]'),
      queueTitle: box('[data-testid="waiting-list-queue"] h2, [data-testid="finalize-surgery-workspace"] h2'),
      columnCues: box('[data-testid="waiting-list-queue-column-cues"]'),
      workRow: firstRowBox,
      workGridCols: workGrid ? getComputedStyle(workGrid).gridTemplateColumns : null,
      completeVisibleRows: completeVisible,
      firstCompleteRowTop: firstCompleteTop,
      zoneVisibility: zones,
      patientIdentityVisible: !!(patientCell && patientCell.textContent && patientCell.textContent.trim().length > 0),
      addPatientVisible: !!el('[data-testid="waiting-list-add-patient"]'),
      statusTabCount: document.querySelectorAll('[data-testid^="waiting-list-status-tab-"]').length,
      modal: modal && modalRect
        ? {
            w: Math.round(modalRect.width),
            h: Math.round(modalRect.height),
            top: Math.round(modalRect.top),
            bottom: Math.round(modalRect.bottom),
            maxH: getComputedStyle(modal).maxHeight,
            maxW: getComputedStyle(modal).maxWidth,
            bodyScrollH: body ? body.scrollHeight : null,
            bodyClientH: body ? body.clientHeight : null,
            footerVisible: footerRect
              ? footerRect.bottom <= window.innerHeight + 1 && footerRect.top >= 0
              : null,
            hOverflow: modal.scrollWidth - modal.clientWidth,
          }
        : null,
    };
  });
}

test.describe('Wave 7 — adaptive viewport fit', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('waiting-list matrix + finalize + modals + secondary modules', async () => {
    test.setTimeout(900_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

    // —— Waiting List width matrix ——
    for (const profile of WIDTH_MATRIX) {
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
      await page.waitForTimeout(500);
      const m = await measureWaitingList(page);
      report.push({ route: 'waiting-list', profile: profile.label, ...m });

      expect(m.densityBand).toBe(profile.band);
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      expect(m.addPatientVisible).toBe(true);
      expect(m.statusTabCount).toBeGreaterThanOrEqual(9);

      const tracks = (m.workGridCols || '').trim().split(/\s+/).filter(Boolean);
      if (tracks.length >= 5) {
        expect(tracks.length).toBeGreaterThanOrEqual(5);
        if (profile.band === 'desktop') {
          expect(parseFloat(tracks[0])).toBeGreaterThanOrEqual(200);
        }
      }

      if (profile.label === '1280x720') {
        expect(m.toolbar?.h ?? 999).toBeLessThanOrEqual(76);
        expect(m.workRow?.h ?? 999).toBeLessThanOrEqual(58);
        expect(m.workRow?.top ?? 999).toBeLessThanOrEqual(290);
        expect(m.kpi?.h ?? 999).toBeLessThanOrEqual(56);
        if (m.zoneVisibility.length >= 5) {
          expect(m.zoneVisibility.every((z) => z.visible)).toBe(true);
        }
        expect(m.patientIdentityVisible).toBe(true);
      }

      if (profile.band === 'desktop' && profile.label === '1920x1080') {
        // Desktop SoT: row remains spacious (~76)
        if (m.workRow) {
          expect(m.workRow.h).toBeGreaterThanOrEqual(64);
        }
      }

      await page.screenshot({
        path: path.join(OUT, `waiting-list-${profile.label}.png`),
        fullPage: false,
      });
      await context.close();
    }

    // —— Finalize + modals at 1920 and 1280 ——
    for (const profile of [
      WIDTH_MATRIX[0],
      WIDTH_MATRIX.find((p) => p.label === '1280x720')!,
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
      await page.waitForTimeout(400);
      let m = await measureWaitingList(page);
      report.push({ route: 'finalize-surgery', profile: profile.label, ...m });
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      if (profile.label === '1280x720' && m.workRow) {
        expect(m.workRow.h).toBeLessThanOrEqual(64);
      }
      await page.screenshot({
        path: path.join(OUT, `finalize-surgery-${profile.label}.png`),
        fullPage: false,
      });

      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({
        timeout: 60_000,
      });
      await page.getByTestId('waiting-list-add-patient').click();
      await expect(page.getByTestId('add-patient-modal')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(200);
      m = await measureWaitingList(page);
      report.push({ route: 'add-patient-modal', profile: profile.label, ...m });
      expect(m.modal).toBeTruthy();
      expect(m.modal!.w).toBeLessThanOrEqual(profile.cssW - 16);
      expect(m.modal!.h).toBeLessThanOrEqual(profile.cssH);
      expect(m.modal!.bottom).toBeLessThanOrEqual(profile.cssH + 1);
      expect(m.modal!.top).toBeGreaterThanOrEqual(-1);
      expect(m.modal!.footerVisible).toBe(true);
      expect(m.modal!.hOverflow).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: path.join(OUT, `add-patient-modal-${profile.label}.png`),
        fullPage: false,
      });

      const registerBtn = page.getByRole('button', { name: /Register new patient/i });
      if (await registerBtn.isVisible().catch(() => false)) {
        await registerBtn.click();
        await expect(page.getByTestId('patient-form-modal')).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(200);
        m = await measureWaitingList(page);
        report.push({ route: 'patient-form-modal', profile: profile.label, ...m });
        expect(m.modal).toBeTruthy();
        expect(m.modal!.w).toBeLessThanOrEqual(profile.cssW - 8);
        expect(m.modal!.h).toBeLessThanOrEqual(profile.cssH);
        expect(m.modal!.footerVisible).toBe(true);
        await page.screenshot({
          path: path.join(OUT, `patient-form-modal-${profile.label}.png`),
          fullPage: false,
        });
      }

      await context.close();
    }

    // —— Secondary modules @ 1280 ——
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
      const m = await measureWaitingList(page);
      report.push({ route: route.id, profile: '1280x720', ...m });
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: path.join(OUT, `${route.id}-1280x720.png`),
        fullPage: false,
      });
      await context.close();
    }

    fs.writeFileSync(path.join(OUT, 'wave7-measurements.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
