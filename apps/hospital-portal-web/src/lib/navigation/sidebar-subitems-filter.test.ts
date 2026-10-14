import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_MENU_SECTIONS,
  filterSidebarSectionsByPermission,
} from '@/lib/navigation/sidebar-menu-sections';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

describe('filterSidebarSectionsByPermission — expandable subItems', () => {
  it('preserves LMS expandable children when parent permission matches', () => {
    const hasLms = (code: string) => code === LMS_VIEW || code === '*';
    const admin = filterSidebarSectionsByPermission(SIDEBAR_MENU_SECTIONS, hasLms);
    const lms = admin.find((s) => s.title === 'Laboratory Management');
    expect(lms).toBeTruthy();
    const quality = lms?.items.find((i) => i.label === 'Quality');
    expect(quality?.subItems?.some((s) => s.href === '/dashboard/lms/quality/qc')).toBe(true);

    const lmsOnly = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      (code) => code === LMS_VIEW,
    ).find((s) => s.title === 'Laboratory Management');
    expect(lmsOnly?.items.find((i) => i.label === 'Configuration')?.subItems?.length).toBeGreaterThan(0);
  });

  it('does not drop non-LMS sections when filtering by unrelated permission', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      (code) => code === 'patient.view',
    );
    expect(filtered.find((s) => s.title === 'Laboratory Management')).toBeUndefined();
  });
});
