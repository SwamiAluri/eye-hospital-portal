import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LMS_NAV_ITEMS,
  LEGACY_LABORATORY_ROUTE,
  LMS_ROUTE_PREFIX,
  collectLmsHrefs,
} from '@/lib/lms/lms-navigation';
import { LMS_VIEW, LEGACY_LABORATORY_VIEW, LMS_PLANNED_PERMISSIONS } from '@/lib/lms/lms-permissions';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import {
  SIDEBAR_MENU_SECTIONS,
  filterSidebarSectionsByPermission,
} from '@/lib/navigation/sidebar-menu-sections';
import { isSidebarNavActive } from '@/lib/navigation/is-sidebar-nav-active';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

function collectPageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collectPageFiles(full));
    else if (name === 'page.tsx') out.push(full);
  }
  return out;
}

describe('Enterprise LMS L0 — route namespace isolation', () => {
  it('defines LMS under /dashboard/lms and keeps legacy laboratory route', () => {
    expect(LMS_ROUTE_PREFIX).toBe('/dashboard/lms');
    expect(LEGACY_LABORATORY_ROUTE).toBe('/dashboard/laboratory');
    expect(existsSync(join(srcRoot, 'app/dashboard/lms/page.tsx'))).toBe(true);
    expect(existsSync(join(srcRoot, 'app/dashboard/laboratory/page.tsx'))).toBe(true);
  });

  it('creates capability pages for all registered LMS hrefs', () => {
    const hrefs = collectLmsHrefs();
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      const rel = href.replace('/dashboard/', 'app/dashboard/') + '/page.tsx';
      expect(existsSync(join(srcRoot, rel)), `missing page for ${href}`).toBe(true);
    }
  });

  it('does not place LMS pages under /dashboard/laboratory', () => {
    const labPages = collectPageFiles(join(srcRoot, 'app/dashboard/laboratory'));
    for (const page of labPages) {
      const src = readFileSync(page, 'utf8');
      expect(src).not.toContain("from '@/components/lms/");
      expect(src).not.toContain('LMS_VIEW');
      expect(src).not.toContain('/dashboard/lms');
    }
  });
});

describe('Enterprise LMS L0 — navigation', () => {
  it('adds Laboratory Management section without mutating Diagnostics & Lab pathology item', () => {
    const diagnostics = SIDEBAR_MENU_SECTIONS.find((s) => s.title === 'Diagnostics & Lab');
    const lms = SIDEBAR_MENU_SECTIONS.find((s) => s.title === 'Laboratory Management');
    expect(diagnostics).toBeTruthy();
    expect(lms).toBeTruthy();

    const pathology = diagnostics!.items.find((i) => i.href === '/dashboard/laboratory');
    expect(pathology?.requiredPermission).toBe('laboratory.view');
    expect(pathology?.label).toBe('Laboratory (Pathology)');

    expect(lms!.items.some((i) => i.href === '/dashboard/lms')).toBe(true);
    expect(lms!.items.every((i) => i.href === '#' || i.href.startsWith('/dashboard/lms'))).toBe(
      true,
    );
  });

  it('hides LMS nav without lms.view and shows it with lms.view', () => {
    const without = filterSidebarSectionsByPermission(SIDEBAR_MENU_SECTIONS, () => false);
    expect(without.find((s) => s.title === 'Laboratory Management')).toBeUndefined();

    const withLms = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      (code) => code === LMS_VIEW,
    );
    expect(withLms.find((s) => s.title === 'Laboratory Management')).toBeTruthy();

    const withLegacyOnly = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      (code) => code === LEGACY_LABORATORY_VIEW,
    );
    expect(withLegacyOnly.find((s) => s.title === 'Laboratory Management')).toBeUndefined();
    const diagnostics = withLegacyOnly.find((s) => s.title === 'Diagnostics & Lab');
    expect(diagnostics?.items.some((i) => i.href === '/dashboard/laboratory')).toBe(true);
  });

  it('filters expandable LMS children by permission', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      (code) => code === LMS_VIEW,
    );
    const lms = filtered.find((s) => s.title === 'Laboratory Management');
    const testing = lms?.items.find((i) => i.label === 'Testing');
    expect(testing?.isExpandable).toBe(true);
    expect(testing?.subItems?.length).toBeGreaterThan(0);
  });

  it('keeps counsellor nav section intact', () => {
    const counsellor = SIDEBAR_MENU_SECTIONS.find((s) => s.title === 'Counsellor');
    expect(counsellor).toBeTruthy();
    expect(counsellor!.items.some((i) => i.href.includes('counsellors-desk'))).toBe(true);
  });

  it('on Specimens routes only Specimens is active — Overview is not', () => {
    const overview = LMS_NAV_ITEMS.find((i) => i.href === '/dashboard/lms');
    const specimens = LMS_NAV_ITEMS.find((i) => i.href === '/dashboard/lms/specimens');
    expect(overview?.exact).toBe(true);
    expect(specimens?.exact).toBeFalsy();

    const sidebar = read('components/Sidebar.tsx');
    expect(sidebar).toContain('isSidebarNavActive');
    expect(sidebar).toContain('isActive(item.href, item.exact)');

    for (const path of ['/dashboard/lms/specimens', '/dashboard/lms/specimens/abc-123']) {
      expect(isSidebarNavActive(path, '/dashboard/lms', true)).toBe(false);
      expect(isSidebarNavActive(path, '/dashboard/lms/specimens')).toBe(true);
      expect(isSidebarNavActive(path, '/dashboard/lms/collection')).toBe(false);
    }

    expect(isSidebarNavActive('/dashboard/lms', '/dashboard/lms', true)).toBe(true);
    expect(isSidebarNavActive('/dashboard/lms', '/dashboard/lms/specimens')).toBe(false);
  });
});

describe('Enterprise LMS L0 — permissions boundary', () => {
  it('uses lms.view as L0 gate and does not reuse laboratory.view', () => {
    expect(LMS_VIEW).toBe('lms.view');
    expect(LEGACY_LABORATORY_VIEW).toBe('laboratory.view');
    expect(LMS_VIEW).not.toBe(LEGACY_LABORATORY_VIEW);

    const overview = read('app/dashboard/lms/page.tsx');
    expect(overview).toContain('LMS_VIEW');
    expect(overview).toContain('ProtectedRoute');
    expect(overview).not.toContain('laboratory.view');

    const capability = read('components/lms/LmsCapabilityPage.tsx');
    expect(capability).toContain('LMS_VIEW');
    expect(capability).not.toContain('laboratory.view');
  });

  it('documents planned fine-grained codes without using them as L0 page gates', () => {
    expect(Object.values(LMS_PLANNED_PERMISSIONS).every((c) => c.startsWith('lms.'))).toBe(true);
    const overview = read('app/dashboard/lms/page.tsx');
    for (const code of Object.values(LMS_PLANNED_PERMISSIONS)) {
      expect(overview).not.toContain(code);
    }
  });
});

describe('Enterprise LMS L0 — honesty (no fabricated KPIs)', () => {
  it('overview does not render fabricated counts or mock clinical rows', () => {
    const overview = read('components/lms/LmsOverviewDashboard.tsx');
    expect(overview).toContain('Not yet implemented');
    expect(overview).toContain('No live count');
    expect(overview).not.toMatch(/\b\d+\s+orders\b/i);
    expect(overview).not.toContain('pendingTests:');
    expect(overview).not.toContain('criticalResults: 4');
    expect(overview).not.toContain('Simulated data');
    expect(overview).not.toContain("from '@/lib/api/lab.api");
    expect(overview).not.toContain("from '@/lib/api/lab-reports.api");
    expect(overview).not.toContain("from '@/components/laboratory/");
  });

  it('capability registry marks unimplemented workflows honestly (nav ≠ implementation)', () => {
    const implemented = LMS_CAPABILITIES.filter((c) => c.status === 'implemented');
    expect(implemented.map((c) => c.id).sort()).toEqual([
      'collection',
      'configuration-panels',
      'configuration-test-catalogue',
      'orders',
      'reports',
      'results-authorization',
      'results-authorized',
      'results-critical',
      'results-verification',
      'specimens',
      'testing',
      'testing-manual-results',
      'testing-workbench',
    ]);
    const allowedImplemented = new Set(implemented.map((c) => c.id));
    expect(
      LMS_CAPABILITIES.filter((c) => !allowedImplemented.has(c.id)).every(
        (c) => c.status === 'placeholder' || c.status === 'not_implemented',
      ),
    ).toBe(true);
  });

  it('orders and collection pages use workbenches; other placeholders keep LmsCapabilityPage', () => {
    const orders = read('app/dashboard/lms/orders/page.tsx');
    expect(orders).toContain('OrdersWorkbench');
    expect(orders).not.toContain('LmsCapabilityPage');
    const collection = read('app/dashboard/lms/collection/page.tsx');
    expect(collection).toContain('CollectionWorkbench');
    expect(collection).not.toContain('LmsCapabilityPage');
    const specimens = read('app/dashboard/lms/specimens/page.tsx');
    expect(specimens).not.toContain('LmsCapabilityPage');
    expect(specimens).toContain('SpecimenWorkbench');
  });
});

describe('Enterprise LMS L0 — nav source integrity', () => {
  it('LMS_NAV_ITEMS covers primary operational areas from the L0 IA', () => {
    const labels = LMS_NAV_ITEMS.map((i) => i.label);
    for (const required of [
      'Overview',
      'Work Queue',
      'Orders',
      'Collection',
      'Specimens',
      'Testing',
      'Results & Authorization',
      'Reports',
      'Referrals',
      'Quality',
      'Operations',
      'Billing',
      'Analytics',
      'Configuration',
      'Administration',
    ]) {
      expect(labels).toContain(required);
    }
  });
});
