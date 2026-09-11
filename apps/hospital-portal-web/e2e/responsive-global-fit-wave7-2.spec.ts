/**
 * Wave 7.2 — global responsive fit architecture.
 * Validates page height budget, counselling workspace scroll, actual modal UX.
 */
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-global-fit-wave7-2');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

type Profile = { label: string; cssW: number; cssH: number; dpr: number; band: 'desktop' | 'workstation' };

const PRIMARY: Profile[] = [
  { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, band: 'desktop' },
  { label: '1280x720', cssW: 1280, cssH: 720, dpr: 1.5, band: 'workstation' },
];

const MATRIX: Profile[] = [
  ...PRIMARY,
  { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, band: 'desktop' },
  { label: '1536x864', cssW: 1536, cssH: 864, dpr: 1.25, band: 'workstation' },
  { label: '1440x900', cssW: 1440, cssH: 900, dpr: 1, band: 'workstation' },
  { label: '1366x768', cssW: 1366, cssH: 768, dpr: 1, band: 'workstation' },
  { label: '1200x800', cssW: 1200, cssH: 800, dpr: 1, band: 'workstation' },
  { label: '1024x768', cssW: 1024, cssH: 768, dpr: 1, band: 'workstation' },
];

async function measurePage(page: Page) {
  return page.evaluate(() => {
    const el = (s: string) => document.querySelector(s) as HTMLElement | null;
    const box = (n: Element | null) => {
      if (!n) return null;
      const r = (n as HTMLElement).getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) };
    };
    const body = el('[data-testid="waiting-list-worklist-body"], [data-testid="finalize-surgery-table-viewport"]');
    const bodyR = body?.getBoundingClientRect();
    const rows = Array.from(
      document.querySelectorAll('[data-testid="waiting-list-work-row"], [data-testid="finalize-surgery-work-row"]'),
    ) as HTMLElement[];
    let completeVisibleRowCount = 0;
    let firstComplete: { top: number; bottom: number; h: number } | null = null;
    if (bodyR) {
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (r.top >= bodyR.top - 0.5 && r.bottom <= bodyR.bottom + 0.5 && r.height > 0) {
          completeVisibleRowCount += 1;
          if (!firstComplete) {
            firstComplete = { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
          }
        }
      }
    }
    const pagination = el('[data-testid="waiting-list-pagination"], [data-testid="finalize-surgery-pagination"]');
    let paginationBelowBody = true;
    if (pagination && bodyR) {
      paginationBelowBody = pagination.getBoundingClientRect().top >= bodyR.bottom - 2;
    }
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      topNavHeight: box(el('[data-testid="app-shell"] header'))?.h ?? null,
      sidebarWidth: box(el('[data-testid="app-shell"] > div'))?.w ?? null,
      title: box(el('h1')),
      kpi: box(el('[data-testid="waiting-list-stats"], [data-testid="finalize-surgery-summary"]')),
      status: box(el('[data-testid="waiting-list-summary-strip"], [data-testid="finalize-surgery-status-nav"]')),
      toolbar: box(el('[data-testid="waiting-list-filter-toolbar"], [data-testid="finalize-surgery-toolbar"]')),
      worklistBody: bodyR
        ? { top: Math.round(bodyR.top), bottom: Math.round(bodyR.bottom), h: Math.round(bodyR.height) }
        : null,
      firstCompleteRow: firstComplete,
      completeVisibleRowCount,
      paginationBelowBody,
      pageHOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageVOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    };
  });
}

async function measureSession(page: Page) {
  return page.evaluate(() => {
    const el = (s: string) => document.querySelector(s) as HTMLElement | null;
    const box = (n: Element | null) => {
      if (!n) return null;
      const r = (n as HTMLElement).getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) };
    };
    const workspace = el('[data-testid="counselling-session-workspace"]');
    const footer = el('[data-testid="counselling-action-bar"]');
    const header = el('[data-testid="counselling-session-chrome"]')?.previousElementSibling
      || el('.counselling-session [class*="patient"]');
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      patientHeader: box(el('[data-testid="counselling-patient-header"], [data-testid="session-page-header"]')),
      chrome: box(el('[data-testid="counselling-session-chrome"]')),
      journey: box(el('[data-testid="counselling-journey-rail"]')),
      readback: box(el('[data-testid="counselling-session-summary-bar"]')),
      workspace: box(workspace),
      workspaceScrollH: workspace?.scrollHeight ?? null,
      workspaceClientH: workspace?.clientHeight ?? null,
      workspaceCanScroll: workspace ? workspace.scrollHeight > workspace.clientHeight + 1 : null,
      footer: box(footer),
      footerVisible: (() => {
        if (!footer) return false;
        const r = footer.getBoundingClientRect();
        return r.bottom <= window.innerHeight + 2 && r.top >= 0 && r.height > 0;
      })(),
      quoteVisible: !!el('[data-testid="counselling-quote-final-payable"], [data-testid="counselling-estimate-panel"]'),
      journeyLabels: Array.from(document.querySelectorAll('[data-testid="counselling-journey-rail"] button')).map(
        (b) => (b.textContent || '').trim(),
      ),
      pageHOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageVOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      headerFallback: header ? box(header) : null,
    };
  });
}

async function measureModal(page: Page, root: string) {
  return page.evaluate((rootSel) => {
    const modal = document.querySelector(rootSel) as HTMLElement | null;
    if (!modal) return null;
    const r = modal.getBoundingClientRect();
    const body = modal.querySelector('[data-testid$="-modal-body"], .overflow-y-auto') as HTMLElement | null;
    const footer = modal.querySelector('[data-testid$="-modal-footer"], .border-t') as HTMLElement | null;
    const fr = footer?.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      bodyScrollH: body?.scrollHeight ?? null,
      bodyClientH: body?.clientHeight ?? null,
      footerVisible: fr ? fr.bottom <= window.innerHeight + 1 && fr.top >= 0 : false,
      closeVisible: !!modal.querySelector('[aria-label="Close"], [data-testid$="-modal-close"]'),
    };
  }, root);
}

test.describe('Wave 7.2 — global responsive fit', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('waiting-list + finalize + counselling + modals', async () => {
    test.setTimeout(900_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

    // Waiting List matrix (screenshots for all; strict asserts on primary)
    for (const profile of MATRIX) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(400);
      const m = await measurePage(page);
      report.push({ route: 'waiting-list', profile: profile.label, ...m });
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      expect(m.worklistBody).toBeTruthy();
      expect(m.paginationBelowBody).toBe(true);
      if (profile.label === '1280x720') {
        expect(m.completeVisibleRowCount).toBeGreaterThanOrEqual(6);
        expect(m.worklistBody!.h).toBeGreaterThan(200);
      }
      if (profile.label === '1920x1080' || profile.label === '1280x720') {
        await page.screenshot({ path: path.join(OUT, `waiting-list-${profile.label}.png`), fullPage: false });
      }
      await context.close();
    }

    for (const profile of PRIMARY) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();

      // Finalize
      await page.goto(`${BASE}/dashboard/counsellors-desk/finalize-surgery`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(400);
      let m = await measurePage(page);
      report.push({ route: 'finalize-surgery', profile: profile.label, ...m });
      expect(m.pageHOverflow).toBeLessThanOrEqual(2);
      await page.screenshot({ path: path.join(OUT, `finalize-surgery-${profile.label}.png`), fullPage: false });

      // Counselling session via worklist row click
      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({ timeout: 60_000 });
      const row = page.getByTestId('waiting-list-work-row').first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      await row.click();
      await expect(page.getByTestId('counselling-journey-rail')).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(500);
      const session = await measureSession(page);
      report.push({ route: 'counselling-session', profile: profile.label, ...session });
      expect(session.pageHOverflow).toBeLessThanOrEqual(2);
      expect(session.footerVisible).toBe(true);
      expect(session.workspace).toBeTruthy();
      expect(session.workspace!.h).toBeGreaterThan(120);
      // Same journey IA (labels may say "Build Quote" for Quote stage)
      const joined = session.journeyLabels.join(' ').toLowerCase();
      expect(joined).toMatch(/quote|decision/);
      expect(joined).toMatch(/decision|insurance|notes|finish/);
      expect(session.journeyLabels.length).toBeGreaterThanOrEqual(4);
      if (profile.label === '1280x720') {
        // Footer must remain in viewport; workspace owns remaining height
        expect(session.footer!.bottom).toBeLessThanOrEqual(profile.cssH + 2);
        expect(session.workspace!.h).toBeGreaterThan(180);
      }
      // Scroll workspace if needed — footer stays reachable
      if (session.workspaceCanScroll) {
        await page.getByTestId('counselling-session-workspace').evaluate((n) => {
          (n as HTMLElement).scrollTop = (n as HTMLElement).scrollHeight;
        });
        await page.waitForTimeout(100);
        expect(await page.getByTestId('counselling-action-bar').isVisible()).toBe(true);
      }
      await page.screenshot({ path: path.join(OUT, `counselling-session-${profile.label}.png`), fullPage: false });

      // Add Patient modal interaction
      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('waiting-list-add-patient')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('waiting-list-add-patient').click();
      await expect(page.getByTestId('add-patient-modal')).toBeVisible({ timeout: 15_000 });
      const addM = await measureModal(page, '[data-testid="add-patient-modal"]');
      report.push({ route: 'add-patient-modal', profile: profile.label, ...addM });
      expect(addM!.bottom).toBeLessThanOrEqual(profile.cssH + 2);
      expect(addM!.footerVisible).toBe(true);
      await page.screenshot({ path: path.join(OUT, `add-patient-modal-${profile.label}.png`), fullPage: false });

      await page.getByRole('button', { name: /Register new patient/i }).click();
      await expect(page.getByTestId('patient-form-modal')).toBeVisible({ timeout: 15_000 });
      const formM = await measureModal(page, '[data-testid="patient-form-modal"]');
      report.push({ route: 'patient-form-modal', profile: profile.label, ...formM });
      expect(formM!.footerVisible).toBe(true);
      await page.screenshot({ path: path.join(OUT, `patient-form-modal-${profile.label}.png`), fullPage: false });
      await page.getByTestId('patient-form-modal-close').click();
      await expect(page.getByTestId('patient-form-modal')).toHaveCount(0);
      await page.getByTestId('add-patient-modal-close').click();
      await expect(page.getByTestId('add-patient-modal')).toHaveCount(0);

      await context.close();
    }

    // Secondary modules @ 1280
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
        await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({ timeout: 60_000 });
      } else {
        await page.waitForTimeout(1000);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      report.push({ route: route.id, profile: '1280x720', pageHOverflow: overflow });
      expect(overflow).toBeLessThanOrEqual(2);
      await page.screenshot({ path: path.join(OUT, `${route.id}-1280x720.png`), fullPage: false });
      await context.close();
    }

    fs.writeFileSync(path.join(OUT, 'wave7-2-measurements.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
