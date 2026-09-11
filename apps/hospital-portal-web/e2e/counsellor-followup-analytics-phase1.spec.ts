/**
 * Phase 1 — Counsellor Follow-up Center + Analytics visual/fit verification.
 * Captures screenshots + layout measurements vs Waiting List / Finalize Surgery.
 */
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const FOLLOWUP_OUT = path.join(__dirname, 'screenshots', 'counsellor-followup-phase1');
const ANALYTICS_OUT = path.join(__dirname, 'screenshots', 'counsellor-analytics-phase1');
const REF_OUT = path.join(__dirname, 'screenshots', 'counsellor-phase1-references');
const MEASURE_OUT = path.join(__dirname, 'screenshots', 'counsellor-phase1-measurements.json');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

type Profile = { label: string; cssW: number; cssH: number };

const PROFILES: Profile[] = [
  { label: '1920x1080', cssW: 1920, cssH: 1080 },
  { label: '1600x900', cssW: 1600, cssH: 900 },
  { label: '1280x720', cssW: 1280, cssH: 720 },
];

type Measure = Record<string, unknown>;

const allMeasures: Record<string, Measure> = {};

async function openAuthed(browser: Browser, profile: Profile): Promise<Page> {
  const context = await browser.newContext({
    storageState: fs.existsSync(AUTH) ? AUTH : undefined,
    viewport: { width: profile.cssW, height: profile.cssH },
    baseURL: BASE,
  });
  return context.newPage();
}

async function assertNoPageHOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page horizontal overflow').toBeLessThanOrEqual(1);
}

async function measureShell(page: Page, rootTestId: string): Promise<Measure> {
  return page.evaluate((rootId) => {
    const el = (s: string) => document.querySelector(s) as HTMLElement | null;
    const box = (n: Element | null) => {
      if (!n) return null;
      const r = (n as HTMLElement).getBoundingClientRect();
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    const root = el(`[data-testid="${rootId}"]`);
    const title = root?.querySelector('h1') ?? el('h1');
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      densityBand: window.innerWidth >= 1600 ? 'desktop' : 'workstation',
      pageHOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageVOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      root: box(root),
      title: box(title),
      hasCounsellingSessionClass: !!root?.classList.contains('counselling-session'),
      hasShellPageBg: !!root && root.className.includes('bg-gray-100'),
      mainBg: getComputedStyle(el('#main-content') ?? document.body).backgroundColor,
    };
  }, rootTestId);
}

test.describe('Counsellor Phase 1 — Follow-up Center + Analytics', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  let browser: Browser;

  test.beforeAll(async () => {
    fs.mkdirSync(FOLLOWUP_OUT, { recursive: true });
    fs.mkdirSync(ANALYTICS_OUT, { recursive: true });
    fs.mkdirSync(REF_OUT, { recursive: true });
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    fs.writeFileSync(MEASURE_OUT, JSON.stringify(allMeasures, null, 2), 'utf8');
    await browser?.close();
  });

  test('reference Waiting List + Finalize Surgery at 1920', async () => {
    const profile = PROFILES[0];
    const page = await openAuthed(browser, profile);

    await page.goto('/dashboard/counsellors-desk/waiting-list', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(REF_OUT, 'waiting-list-1920x1080.png'),
      fullPage: false,
    });
    allMeasures['ref-waiting-list-1920'] = await measureShell(page, 'waiting-list-summary').catch(
      async () =>
        page.evaluate(() => ({
          note: 'waiting-list-summary missing',
          h1: document.querySelector('h1')?.textContent,
        })),
    );

    await page.goto('/dashboard/counsellors-desk/finalize-surgery', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(REF_OUT, 'finalize-surgery-1920x1080.png'),
      fullPage: false,
    });
    allMeasures['ref-finalize-1920'] = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const main = document.querySelector('#main-content');
      return {
        title: h1?.textContent?.trim(),
        hasCounsellingSession: !!document.querySelector('.counselling-session'),
        mainBg: main ? getComputedStyle(main).backgroundColor : null,
        pageHOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    await page.context().close();
  });

  for (const profile of PROFILES) {
    test(`follow-up center ${profile.label}`, async () => {
      const page = await openAuthed(browser, profile);
      await page.goto('/dashboard/counsellors-desk/surgery-followup', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await page.waitForTimeout(2000);

      const root = page.getByTestId('followup-page');
      await expect(root).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('followup-summary')).toBeVisible();
      await expect(page.getByTestId('followup-tabs')).toBeVisible();
      await expect(page.getByTestId('followup-toolbar')).toBeVisible();
      await expect(page.getByTestId('followup-worklist')).toBeVisible();
      await expect(page.getByTestId('followup-search')).toBeVisible();
      await assertNoPageHOverflow(page);
      await expect(page.getByTitle('Schedule Follow-up Visit')).toHaveCount(0);

      // Tabs
      await page.getByTestId('followup-tab-cold').click();
      await page.waitForTimeout(400);
      await page.getByTestId('followup-tab-post-surgery').click();
      await page.waitForTimeout(400);
      await page.getByTestId('followup-tab-active').click();
      await page.waitForTimeout(400);

      // Intention filter (active only)
      await expect(page.getByTestId('followup-intention-filter')).toBeVisible();
      await page.getByTestId('followup-intention-filter').selectOption('Undecided');
      await page.waitForTimeout(500);
      await page.getByTestId('followup-intention-filter').selectOption('');

      // Due-date Est. window chips removed (Phase 2F)
      await expect(page.getByTestId('followup-date-filters')).toHaveCount(0);
      await expect(page.getByText('Est. window')).toHaveCount(0);

      // Search
      await page.getByTestId('followup-search').fill('test');
      await page.waitForTimeout(400);
      await page.getByTestId('followup-search').fill('');

      const m = await measureShell(page, 'followup-page');
      allMeasures[`followup-${profile.label}`] = {
        ...m,
        titleText: await page.locator('[data-testid="followup-page"] h1').textContent(),
      };

      expect(m.hasCounsellingSessionClass).toBe(true);
      expect(m.densityBand).toBe(profile.cssW >= 1600 ? 'desktop' : 'workstation');

      await page.screenshot({
        path: path.join(FOLLOWUP_OUT, `followup-${profile.label}.png`),
        fullPage: false,
      });
      await page.context().close();
    });

    test(`analytics ${profile.label}`, async () => {
      const page = await openAuthed(browser, profile);
      await page.goto('/dashboard/counselor/analytics', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await page.waitForTimeout(2500);

      const root = page.getByTestId('analytics-page');
      await expect(root).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('analytics-toolbar')).toBeVisible();
      await assertNoPageHOverflow(page);

      // Period chips — Phase 2D: presets must be ≤30 days
      await page.getByTestId('analytics-period-7').click();
      await page.waitForTimeout(600);
      await page.getByTestId('analytics-period-14').click();
      await page.waitForTimeout(600);
      await page.getByTestId('analytics-period-30').click();
      await page.waitForTimeout(800);
      await expect(page.getByTestId('analytics-period-60')).toHaveCount(0);
      await expect(page.getByTestId('analytics-period-90')).toHaveCount(0);

      // Aging → Follow-up Center link if present
      const agingLink = page.getByTestId('analytics-aging-open-followup-center');
      if (await agingLink.count()) {
        await expect(agingLink).toBeVisible();
      }

      const m = await measureShell(page, 'analytics-page');
      allMeasures[`analytics-${profile.label}`] = {
        ...m,
        titleText: await page.locator('[data-testid="analytics-page"] h1').textContent(),
        hasFunnel: (await page.getByTestId('analytics-funnel').count()) > 0,
        hasTrends: (await page.getByTestId('analytics-trends-widget').count()) > 0,
        hasAging: (await page.getByTestId('analytics-aging').count()) > 0,
      };

      expect(m.hasCounsellingSessionClass).toBe(true);

      await page.screenshot({
        path: path.join(ANALYTICS_OUT, `analytics-${profile.label}.png`),
        fullPage: false,
      });
      await page.context().close();
    });
  }

  test('follow-up interactions + modals at 1600', async () => {
    const page = await openAuthed(browser, { label: '1600x900', cssW: 1600, cssH: 900 });
    await page.goto('/dashboard/counsellors-desk/surgery-followup', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);

    const rows = page.getByTestId('followup-worklist-row');
    const rowCount = await rows.count();
    allMeasures['followup-interaction-rowCount'] = { rowCount };

    if (rowCount > 0) {
      const first = rows.first();
      const historyBtn = first.getByTestId('followup-action-history');
      if (await historyBtn.count()) {
        await historyBtn.click();
        await expect(page.getByTestId('followup-history-drawer')).toBeVisible();
        await page.getByTestId('followup-history-close').click();
        await expect(page.getByTestId('followup-history-drawer')).toHaveCount(0);
      }

      const openBtn = first.getByTestId('followup-action-open-session');
      if (await openBtn.count()) {
        await expect(openBtn).toBeVisible();
      }
    }

    await page.getByTestId('followup-refresh').click();
    await page.waitForTimeout(500);
    await assertNoPageHOverflow(page);
    await page.context().close();
  });
});
