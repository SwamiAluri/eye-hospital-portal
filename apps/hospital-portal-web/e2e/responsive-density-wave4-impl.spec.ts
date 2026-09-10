/**
 * Wave 4 implementation — Card / ui/table / opt-in control density (computed styles).
 * Run: npx playwright test e2e/responsive-density-wave4-impl.spec.ts --project=chromium
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'responsive-density-wave4-impl');
const AUTH = path.join(__dirname, '.auth', 'user.json');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

test.describe('Wave 4 impl — Card/table/control density', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('tokens + fixture measurements + page screenshots', async () => {
    test.setTimeout(300_000);
    expect(fs.existsSync(AUTH)).toBe(true);
    const browser: Browser = await chromium.launch();
    const report: unknown[] = [];

    async function measureFixture(cssW: number, cssH: number, dpr: number, label: string) {
      const context = await browser.newContext({
        viewport: { width: cssW, height: cssH },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await page.setContent(`<!DOCTYPE html>
<html><head>
<link rel="stylesheet" href="${BASE}/_next/static/css/app/layout.css">
<style>
  @import url('${BASE}');
</style>
</head><body>
<div id="root"></div>
<script type="module"></script>
</body></html>`);
      // Prefer injecting tokens via evaluating against live app CSS by loading a real page with fixtures.
      await context.close();
      return label;
    }
    void measureFixture;

    // Live app: inject measurement fixtures into dashboard DOM after load
    for (const profile of [
      { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1, band: 'desktop' as const },
      { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1, band: 'desktop' as const },
      { label: '1536x864-dpr1.25', cssW: 1536, cssH: 864, dpr: 1.25, band: 'workstation' as const },
    ]) {
      const context = await browser.newContext({
        viewport: { width: profile.cssW, height: profile.cssH },
        deviceScaleFactor: profile.dpr,
        storageState: AUTH,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 60_000 });

      const metrics = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const token = (n: string) => root.getPropertyValue(n).trim();

        const host = document.createElement('div');
        host.id = 'wave4-density-fixture';
        host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;';
        host.innerHTML = `
          <div data-testid="fix-card-responsive" class="rounded-xl border bg-white">
            <div data-testid="fix-card-header" class="p-[var(--widget-pad)]">H</div>
            <div data-testid="fix-card-content" class="p-[var(--widget-pad)] pt-0">C</div>
          </div>
          <div data-testid="fix-card-comfortable" style="--widget-pad:24px" class="rounded-xl border">
            <div data-testid="fix-card-comfortable-header" class="p-[var(--widget-pad)]">H</div>
          </div>
          <table data-testid="fix-table"><thead><tr>
            <th data-testid="fix-th" class="h-[var(--table-header-height)] px-[var(--table-cell-pad)]">Col</th>
          </tr></thead><tbody><tr>
            <td data-testid="fix-td" class="p-[var(--table-cell-pad)]">Cell</td>
          </tr></tbody></table>
          <button data-testid="fix-btn-default" class="h-10 px-4 text-base">Default</button>
          <button data-testid="fix-btn-ws" class="h-10 px-4 h-[var(--control-height-workstation)] px-[var(--control-pad-x-workstation)] text-sm">WS</button>
          <input data-testid="fix-input-default" class="h-10 px-3" />
          <input data-testid="fix-input-ws" class="h-10 h-[var(--control-height-workstation)] px-3" />
        `;
        document.body.appendChild(host);

        const box = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            h: Math.round(r.height),
            padT: cs.paddingTop,
            padL: cs.paddingLeft,
            padR: cs.paddingRight,
            padB: cs.paddingBottom,
          };
        };

        return {
          tokens: {
            widgetPad: token('--widget-pad'),
            tableHeader: token('--table-header-height'),
            tableCell: token('--table-cell-pad'),
            controlWs: token('--control-height-workstation'),
            controlPadWs: token('--control-pad-x-workstation'),
          },
          cardHeader: box('[data-testid="fix-card-header"]'),
          cardComfortable: box('[data-testid="fix-card-comfortable-header"]'),
          th: box('[data-testid="fix-th"]'),
          td: box('[data-testid="fix-td"]'),
          btnDefault: box('[data-testid="fix-btn-default"]'),
          btnWs: box('[data-testid="fix-btn-ws"]'),
          inputDefault: box('[data-testid="fix-input-default"]'),
          inputWs: box('[data-testid="fix-input-ws"]'),
          pageHOverflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      report.push({ profile: profile.label, route: 'dashboard-fixture', ...metrics });

      if (profile.band === 'desktop') {
        expect(metrics.tokens.widgetPad).toBe('24px');
        expect(metrics.tokens.tableHeader).toBe('48px');
        expect(metrics.tokens.tableCell).toBe('16px');
        expect(metrics.tokens.controlWs).toBe('40px');
        expect(metrics.cardHeader?.padT).toBe('24px');
        expect(metrics.cardComfortable?.padT).toBe('24px');
        expect(metrics.th?.h).toBe(48);
        expect(metrics.td?.padT).toBe('16px');
        expect(metrics.btnDefault?.h).toBe(40);
        expect(metrics.btnWs?.h).toBe(40);
        expect(metrics.inputDefault?.h).toBe(40);
        expect(metrics.inputWs?.h).toBe(40);
      } else {
        expect(metrics.tokens.widgetPad).toBe('16px');
        expect(metrics.tokens.tableHeader).toBe('40px');
        expect(metrics.tokens.tableCell).toBe('12px');
        expect(metrics.tokens.controlWs).toBe('36px');
        expect(metrics.cardHeader?.padT).toBe('16px');
        expect(metrics.cardComfortable?.padT).toBe('24px');
        expect(metrics.th?.h).toBe(40);
        expect(metrics.td?.padT).toBe('12px');
        expect(metrics.btnDefault?.h).toBe(40);
        expect(metrics.btnWs?.h).toBe(36);
        expect(metrics.inputDefault?.h).toBe(40);
        expect(metrics.inputWs?.h).toBe(36);
      }
      expect(metrics.pageHOverflow).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: path.join(OUT, `dashboard-${profile.label}.png`),
        fullPage: false,
      });
      await context.close();
    }

    // Representative Counsellor + admin screenshots (verify only)
    for (const route of [
      { id: 'waiting-list', path: '/dashboard/counsellors-desk/waiting-list', heading: 'Waiting List' },
      { id: 'finalize-surgery', path: '/dashboard/counsellors-desk/finalize-surgery', heading: 'Surgery Finalization' },
      { id: 'admin-inventory', path: '/admin/inventory' },
    ]) {
      for (const profile of [
        { label: '1920x1080', cssW: 1920, cssH: 1080, dpr: 1 },
        { label: '1600x900', cssW: 1600, cssH: 900, dpr: 1 },
        { label: '1536x864-dpr1.25', cssW: 1536, cssH: 864, dpr: 1.25 },
      ]) {
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
          await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 60_000 });
        }
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
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
