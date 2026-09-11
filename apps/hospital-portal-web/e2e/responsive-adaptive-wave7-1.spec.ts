/**
 * Wave 7.1 — page composition, worklist containment, modal interaction.
 * Measures against actual worklist scroll viewport; opens modals via UI.
 */
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-adaptive-wave7-1');
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
    const rect = (n: Element | null) => {
      if (!n) return null;
      const r = (n as HTMLElement).getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        h: Math.round(r.height),
        w: Math.round(r.width),
      };
    };
    const body =
      el('[data-testid="waiting-list-worklist-body"]') ||
      el('[data-testid="finalize-surgery-table-viewport"]');
    const bodyRect = body ? body.getBoundingClientRect() : null;
    const rowSel =
      '[data-testid="waiting-list-work-row"], [data-testid="finalize-surgery-work-row"]';
    const rows = Array.from(document.querySelectorAll(rowSel)) as HTMLElement[];
    let completeVisibleRowCount = 0;
    let firstComplete: { top: number; bottom: number; h: number } | null = null;
    let partialVisible = 0;
    if (bodyRect) {
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        const fully =
          r.top >= bodyRect.top - 0.5 && r.bottom <= bodyRect.bottom + 0.5 && r.height > 0;
        const intersects = r.bottom > bodyRect.top + 1 && r.top < bodyRect.bottom - 1;
        if (fully) {
          completeVisibleRowCount += 1;
          if (!firstComplete) {
            firstComplete = {
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
              h: Math.round(r.height),
            };
          }
        } else if (intersects) {
          partialVisible += 1;
        }
      }
    }

    const sidebar = el('aside, [data-testid="app-shell"] > div');
    const topnav = el('[data-testid="app-shell"] header, nav');
    const pagination = el(
      '[data-testid="waiting-list-pagination"], [data-testid="finalize-surgery-pagination"]',
    );
    const footer = el(
      '[data-testid="waiting-list-queue-footer"], [data-testid="finalize-surgery-queue-footer"]',
    );
    const workGrid = el('.waiting-list-work-grid, .finalize-surgery-work-grid');

    let paginationBelowBody = true;
    if (pagination && bodyRect) {
      const pr = pagination.getBoundingClientRect();
      paginationBelowBody = pr.top >= bodyRect.bottom - 2;
    }

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      topNavHeight: topnav ? Math.round(topnav.getBoundingClientRect().height) : null,
      pageTitle: rect(el('h1')),
      kpi: rect(el('[data-testid="waiting-list-stats"], [data-testid="finalize-surgery-summary"]')),
      status: rect(
        el(
          '[data-testid="waiting-list-summary-strip"], [data-testid="finalize-surgery-status-nav"]',
        ),
      ),
      toolbar: rect(
        el(
          '[data-testid="waiting-list-filter-toolbar"], [data-testid="finalize-surgery-toolbar"]',
        ),
      ),
      queue: rect(el('[data-testid="waiting-list-queue"], [data-testid="finalize-surgery-workspace"]')),
      worklistBody: bodyRect
        ? {
            top: Math.round(bodyRect.top),
            bottom: Math.round(bodyRect.bottom),
            h: Math.round(bodyRect.height),
            w: Math.round(bodyRect.width),
          }
        : null,
      columnCues: rect(el('[data-testid="waiting-list-queue-column-cues"]')),
      pagination: rect(pagination),
      footer: rect(footer),
      firstCompleteRow: firstComplete,
      rowHeight: firstComplete?.h ?? null,
      completeVisibleRowCount,
      partialVisibleRowCount: partialVisible,
      paginationBelowBody,
      workGridCols: workGrid ? getComputedStyle(workGrid).gridTemplateColumns : null,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      documentClientHeight: document.documentElement.clientHeight,
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageVOverflow:
        document.documentElement.scrollHeight - document.documentElement.clientHeight,
      addPatientVisible: !!el('[data-testid="waiting-list-add-patient"]'),
      statusTabCount: document.querySelectorAll('[data-testid^="waiting-list-status-tab-"]').length,
    };
  });
}

async function measureOpenModal(page: Page, which: 'add-patient' | 'patient-form') {
  const root =
    which === 'patient-form'
      ? '[data-testid="patient-form-modal"]'
      : '[data-testid="add-patient-modal"]';
  return page.evaluate((rootSel) => {
    const modal = document.querySelector(rootSel) as HTMLElement | null;
    if (!modal) return null;
    const r = modal.getBoundingClientRect();
    const header = modal.querySelector(
      '[data-testid$="-modal-header"], [data-testid$="-header"]',
    ) as HTMLElement | null;
    const body = modal.querySelector(
      '[data-testid$="-modal-body"], .overflow-y-auto',
    ) as HTMLElement | null;
    const footer = modal.querySelector(
      '[data-testid$="-modal-footer"], .border-t',
    ) as HTMLElement | null;
    const close = modal.querySelector(
      '[data-testid$="-modal-close"], [aria-label="Close"]',
    ) as HTMLElement | null;
    const primary = modal.querySelector(
      'button[type="submit"], [data-testid="add-patient-submit"]',
    ) as HTMLElement | null;
    const fr = footer?.getBoundingClientRect();
    const hr = header?.getBoundingClientRect();
    const br = body?.getBoundingClientRect();
    return {
      modalWidth: Math.round(r.width),
      modalHeight: Math.round(r.height),
      modalTop: Math.round(r.top),
      modalBottom: Math.round(r.bottom),
      headerHeight: hr ? Math.round(hr.height) : null,
      bodyHeight: br ? Math.round(br.height) : null,
      footerHeight: fr ? Math.round(fr.height) : null,
      bodyScrollHeight: body?.scrollHeight ?? null,
      bodyClientHeight: body?.clientHeight ?? null,
      bodyCanScroll: body ? body.scrollHeight > body.clientHeight + 1 : null,
      footerVisible: fr
        ? fr.bottom <= window.innerHeight + 1 && fr.top >= 0 && fr.height > 0
        : false,
      headerVisible: hr ? hr.top >= -1 && hr.bottom <= window.innerHeight + 1 : false,
      closeButtonVisible: !!(close && close.getBoundingClientRect().height > 0),
      primaryActionVisible: primary
        ? (() => {
            const pr = primary.getBoundingClientRect();
            return pr.bottom <= window.innerHeight + 1 && pr.top >= 0 && pr.height > 0;
          })()
        : null,
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, root);
}

test.describe('Wave 7.1 — composition + containment + modal interaction', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('waiting-list matrix, finalize, actual modal open/close', async () => {
    test.setTimeout(900_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

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
      expect(m.paginationBelowBody).toBe(true);
      expect(m.worklistBody).toBeTruthy();
      expect(m.worklistBody!.h).toBeGreaterThan(80);

      if (profile.label === '1280x720') {
        expect(m.completeVisibleRowCount).toBeGreaterThanOrEqual(6);
        expect(m.firstCompleteRow?.top ?? 999).toBeLessThanOrEqual(300);
        expect(m.toolbar?.h ?? 999).toBeLessThanOrEqual(80);
        // Status strip should not wrap into multi-row height explosion
        expect(m.status?.h ?? 999).toBeLessThanOrEqual(40);
      }

      if (profile.label === '1920x1080') {
        expect(m.toolbar?.h ?? 0).toBeGreaterThanOrEqual(80);
        expect(m.firstCompleteRow?.h ?? 0).toBeGreaterThanOrEqual(64);
      }

      await page.screenshot({
        path: path.join(OUT, `waiting-list-${profile.label}.png`),
        fullPage: false,
      });
      await context.close();
    }

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

      // Finalize
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
      expect(m.paginationBelowBody).toBe(true);
      await page.screenshot({
        path: path.join(OUT, `finalize-surgery-${profile.label}.png`),
        fullPage: false,
      });

      // Waiting List + ACTUAL Add Patient open
      await page.goto(`${BASE}/dashboard/counsellors-desk/waiting-list`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({
        timeout: 60_000,
      });
      await page.getByTestId('waiting-list-add-patient').click();
      await expect(page.getByTestId('add-patient-modal')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('add-patient-modal-overlay')).toBeVisible();
      await expect(page.getByTestId('add-patient-modal-header')).toBeVisible();
      await expect(page.getByTestId('add-patient-modal-body')).toBeVisible();
      await expect(page.getByTestId('add-patient-modal-footer')).toBeVisible();

      const addMeas = await measureOpenModal(page, 'add-patient');
      report.push({ route: 'add-patient-modal', profile: profile.label, ...addMeas });
      expect(addMeas).toBeTruthy();
      expect(addMeas!.modalWidth).toBeLessThanOrEqual(profile.cssW - 16);
      expect(addMeas!.modalHeight).toBeLessThanOrEqual(profile.cssH);
      expect(addMeas!.modalTop).toBeGreaterThanOrEqual(-2);
      expect(addMeas!.modalBottom).toBeLessThanOrEqual(profile.cssH + 2);
      expect(addMeas!.footerVisible).toBe(true);
      expect(addMeas!.closeButtonVisible).toBe(true);
      expect(addMeas!.pageHOverflow).toBeLessThanOrEqual(2);

      // Scroll modal body if possible
      await page.getByTestId('add-patient-modal-body').evaluate((n) => {
        (n as HTMLElement).scrollTop = (n as HTMLElement).scrollHeight;
      });
      await page.waitForTimeout(100);
      expect(await page.getByTestId('add-patient-modal-footer').isVisible()).toBe(true);

      await page.screenshot({
        path: path.join(OUT, `add-patient-modal-${profile.label}.png`),
        fullPage: false,
      });

      // Patient form via Register
      const registerBtn = page.getByRole('button', { name: /Register new patient/i });
      await expect(registerBtn).toBeVisible({ timeout: 10_000 });
      await registerBtn.click();
      await expect(page.getByTestId('patient-form-modal')).toBeVisible({ timeout: 15_000 });
      const formMeas = await measureOpenModal(page, 'patient-form');
      report.push({ route: 'patient-form-modal', profile: profile.label, ...formMeas });
      expect(formMeas).toBeTruthy();
      expect(formMeas!.modalWidth).toBeLessThanOrEqual(profile.cssW - 8);
      expect(formMeas!.modalHeight).toBeLessThanOrEqual(profile.cssH);
      expect(formMeas!.footerVisible).toBe(true);
      await page.screenshot({
        path: path.join(OUT, `patient-form-modal-${profile.label}.png`),
        fullPage: false,
      });

      // Close patient form then add patient
      await page.getByTestId('patient-form-modal-close').click();
      await expect(page.getByTestId('patient-form-modal')).toHaveCount(0, { timeout: 10_000 });
      await page.getByTestId('add-patient-modal-close').click();
      await expect(page.getByTestId('add-patient-modal')).toHaveCount(0, { timeout: 10_000 });

      await context.close();
    }

    fs.writeFileSync(path.join(OUT, 'wave7-1-measurements.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
