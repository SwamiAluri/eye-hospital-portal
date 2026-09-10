/**
 * AUDIT-ONLY harness — Wave 4 control/widget density.
 * Does not modify production UI. Measures computed styles.
 * Run: npx playwright test e2e/responsive-density-wave4-audit.spec.ts --project=chromium
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-density-wave4-audit');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

const PROFILES = [
  { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1 },
  { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1 },
  { label: '1536x864-dpr1.25', cssW: 1536, cssH: 864, dpr: 1.25 },
] as const;

const ROUTES = [
  { id: 'dashboard', path: '/dashboard' },
  { id: 'waiting-list', path: '/dashboard/counsellors-desk/waiting-list', heading: 'Waiting List' },
  { id: 'finalize-surgery', path: '/dashboard/counsellors-desk/finalize-surgery', heading: 'Surgery Finalization' },
  { id: 'admin-inventory', path: '/admin/inventory' },
] as const;

async function measurePage(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const pick = (el: Element | null) => {
      if (!el || !(el instanceof HTMLElement)) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        h: Math.round(r.height),
        w: Math.round(r.width),
        padT: cs.paddingTop,
        padR: cs.paddingRight,
        padB: cs.paddingBottom,
        padL: cs.paddingLeft,
        fontSize: cs.fontSize,
        gap: cs.gap || cs.columnGap || null,
      };
    };

    const first = (sel: string) => document.querySelector(sel);
    const buttons = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.offsetParent !== null && b.getBoundingClientRect().height >= 28,
    );
    const inputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]), select, textarea'),
    ).filter((el) => (el as HTMLElement).offsetParent !== null);

    const sampleBtn = buttons.slice(0, 8).map((b) => ({
      text: (b.textContent || '').trim().slice(0, 40),
      ...pick(b),
    }));
    const sampleInputs = inputs.slice(0, 6).map((el) => ({
      type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
      ...pick(el),
    }));

    const tables = Array.from(document.querySelectorAll('table')).slice(0, 2);
    const tableMetrics = tables.map((t) => {
      const th = t.querySelector('th');
      const td = t.querySelector('td');
      const tr = t.querySelector('tbody tr') || t.querySelector('tr');
      return {
        th: pick(th),
        td: pick(td),
        rowH: tr ? Math.round(tr.getBoundingClientRect().height) : null,
      };
    });

    const cards = Array.from(
      document.querySelectorAll('[class*="rounded-xl"], [class*="rounded-2xl"]'),
    )
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 200 && r.height > 60 && r.height < 900;
      })
      .slice(0, 4)
      .map((el) => pick(el));

    const heading =
      document.querySelector('h1') ||
      document.querySelector('[class*="text-xl"], [class*="text-2xl"]');

    return {
      innerWidth: window.innerWidth,
      dpr: window.devicePixelRatio,
      pageTitle: pick(heading),
      topnav: pick(document.querySelector('[data-testid="app-topnav"]')),
      shell: pick(document.querySelector('[data-testid="app-shell"]')),
      sampleBtn,
      sampleInputs,
      tableMetrics,
      cards,
      pageHOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      btnHeightHistogram: buttons.reduce<Record<string, number>>((acc, b) => {
        const h = Math.round(b.getBoundingClientRect().height);
        const key = String(h);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      inputHeightHistogram: inputs.reduce<Record<string, number>>((acc, el) => {
        const h = Math.round((el as HTMLElement).getBoundingClientRect().height);
        const key = String(h);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    };
  });
}

test.describe('Wave 4 AUDIT ONLY — control/widget density', () => {
  test('measure representative pages at 1920 / 1600 / 1536', async () => {
    test.setTimeout(420_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    fs.mkdirSync(OUT, { recursive: true });

    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

    for (const profile of PROFILES) {
      for (const route of ROUTES) {
        const context = await browser.newContext({
          viewport: { width: profile.cssW, height: profile.cssH },
          deviceScaleFactor: profile.dpr,
          storageState: AUTH,
        });
        const page = await context.newPage();
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded' });
        if ('heading' in route && route.heading) {
          await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({
            timeout: 60_000,
          });
        } else {
          await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({
            timeout: 60_000,
          });
        }
        await page.waitForTimeout(400);
        const m = await measurePage(page);
        report.push({ profile: profile.label, route: route.id, ...m });
        await page.screenshot({
          path: path.join(OUT, `${route.id}-${profile.label}.png`),
          fullPage: false,
        });
        await context.close();
      }
    }

    fs.writeFileSync(path.join(OUT, 'measurements.json'), JSON.stringify(report, null, 2));
    await browser.close();
  });
});
