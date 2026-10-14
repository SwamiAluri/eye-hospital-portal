import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LMS_NAV_ITEMS } from '@/lib/lms/lms-navigation';
import { LMS_CATALOGUE_PERMISSIONS, LEGACY_LABORATORY_VIEW } from '@/lib/lms/lms-permissions';

const srcRoot = join(__dirname, '../../../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('Enterprise LMS L-CAT-01B — catalogue UI', () => {
  it('registers catalogue routes under /dashboard/lms/configuration', () => {
    expect(
      existsSync(join(srcRoot, 'app/dashboard/lms/configuration/test-catalogue/page.tsx')),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, 'app/dashboard/lms/configuration/test-catalogue/[id]/page.tsx')),
    ).toBe(true);
    expect(existsSync(join(srcRoot, 'app/dashboard/lms/configuration/panels/page.tsx'))).toBe(
      true,
    );
  });

  it('gates catalogue nav with lms.catalogue.view, not laboratory.view', () => {
    const config = LMS_NAV_ITEMS.find((i) => i.href === '/dashboard/lms/configuration');
    const testCat = config?.subItems?.find(
      (i) => i.href === '/dashboard/lms/configuration/test-catalogue',
    );
    const panels = config?.subItems?.find(
      (i) => i.href === '/dashboard/lms/configuration/panels',
    );
    expect(testCat?.requiredPermission).toBe(LMS_CATALOGUE_PERMISSIONS.view);
    expect(panels?.requiredPermission).toBe(LMS_CATALOGUE_PERMISSIONS.view);
    expect(testCat?.requiredPermission).not.toBe(LEGACY_LABORATORY_VIEW);
  });

  it('workbench and detail use LMS catalogue client and lifecycle actions', () => {
    const workbench = read('components/lms/catalogue/CatalogueWorkbench.tsx');
    const detail = read('components/lms/catalogue/CatalogueDetailView.tsx');
    expect(workbench).toContain('listLmsCatalogue');
    expect(workbench).toContain('createLmsCatalogueDraft');
    expect(workbench).toContain('catalogue-empty');
    expect(workbench).toContain('catalogue-unauthorized');
    expect(detail).toContain('submitLmsCatalogueReview');
    expect(detail).toContain('approveLmsCatalogue');
    expect(detail).toContain('activateLmsCatalogue');
    expect(detail).toContain('catalogue-version-history');
    expect(detail).toContain('LMS_CATALOGUE_PERMISSIONS.approve');
    expect(detail).toContain('lms.catalogue.view');
    expect(workbench).not.toContain('laboratory-catalog');
    expect(detail).not.toContain('reference interval value');
  });

  it('does not invent Rejected lifecycle status in UI', () => {
    const detail = read('components/lms/catalogue/CatalogueDetailView.tsx');
    expect(detail).toContain('Return to draft');
    expect(detail).not.toMatch(/status.*Rejected|Rejected/);
  });

  it('detail route uses sync Next 14 params.id (not React use(params))', () => {
    const page = read('app/dashboard/lms/configuration/test-catalogue/[id]/page.tsx');
    expect(page).toContain("params: { id: string }");
    expect(page).toContain('params.id');
    expect(page).toContain('CatalogueDetailView');
    expect(page).not.toContain('use(params)');
    expect(page).not.toMatch(/import\s*\{\s*use\s*\}\s*from\s*['"]react['"]/);
    expect(page).not.toContain('Promise<{ id: string }>');
  });
});
