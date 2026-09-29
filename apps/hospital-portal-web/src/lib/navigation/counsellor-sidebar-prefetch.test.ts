import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COUNSELLOR_SIDEBAR_PREFETCH_HREFS,
  SIDEBAR_MENU_SECTIONS,
  prefetchCounsellorSidebarHref,
} from './sidebar-menu-sections';

describe('Counsellor sidebar prefetch', () => {
  it('prefetches the five counsellor destinations and leaves other routes alone', () => {
    const counsellor = SIDEBAR_MENU_SECTIONS.find((section) => section.title === 'Counsellor');
    expect(counsellor).toBeDefined();
    const hrefs = counsellor!.items.map((item) => item.href);
    expect([...hrefs].sort()).toEqual([...COUNSELLOR_SIDEBAR_PREFETCH_HREFS].sort());
    for (const href of hrefs) {
      expect(prefetchCounsellorSidebarHref(href)).toBe(true);
      expect(COUNSELLOR_SIDEBAR_PREFETCH_HREFS.has(href)).toBe(true);
    }
    expect(prefetchCounsellorSidebarHref('/dashboard/settings')).toBe(false);
    expect(prefetchCounsellorSidebarHref('/dashboard/ccms')).toBe(false);
  });

  it('sidebar menu links use the counsellor prefetch helper; settings stay unprefetched', () => {
    const sidebar = readFileSync(
      join(process.cwd(), 'src/components/Sidebar.tsx'),
      'utf8',
    );
    expect(sidebar).toContain('prefetch={prefetchCounsellorSidebarHref(item.href)}');
    expect(sidebar).toContain('prefetch={prefetchCounsellorSidebarHref(subItem.href)}');
    expect(sidebar).toContain('href="/dashboard/settings"');
    expect(sidebar).toContain('prefetch={false}');
  });
});
