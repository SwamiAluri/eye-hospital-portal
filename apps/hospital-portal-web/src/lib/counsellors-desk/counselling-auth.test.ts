import { describe, expect, it } from 'vitest';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from './counselling-auth';
import { SIDEBAR_MENU_SECTIONS } from '@/lib/navigation/sidebar-menu-sections';

describe('AUTH-01 counselling page read authorization', () => {
  it('exports counseling_sessions.read as the canonical read permission', () => {
    expect(COUNSELLING_SESSIONS_READ_PERMISSION).toBe('counseling_sessions.read');
  });

  it('gates Counsellor nav items on counseling_sessions.read', () => {
    const counsellor = SIDEBAR_MENU_SECTIONS.find((s) => s.title === 'Counsellor');
    expect(counsellor).toBeTruthy();
    const hrefs = [
      '/dashboard/counsellors-desk/waiting-list',
      '/dashboard/counsellors-desk/finalize-surgery',
      '/dashboard/counsellors-desk/surgery-followup',
      '/dashboard/counselor/analytics',
    ];
    for (const href of hrefs) {
      const item = counsellor!.items.find((i) => i.href === href);
      expect(item, href).toBeTruthy();
      expect(item!.requiredPermission).toBe(COUNSELLING_SESSIONS_READ_PERMISSION);
    }
  });
});
