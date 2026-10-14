import { describe, expect, it } from 'vitest';
import { isSidebarNavActive } from '@/lib/navigation/is-sidebar-nav-active';

describe('isSidebarNavActive', () => {
  it('exact Overview does not activate on Specimens list or detail', () => {
    expect(isSidebarNavActive('/dashboard/lms/specimens', '/dashboard/lms', true)).toBe(false);
    expect(
      isSidebarNavActive(
        '/dashboard/lms/specimens/74c014cf-9570-4824-bdf9-b369ea11a8f4',
        '/dashboard/lms',
        true,
      ),
    ).toBe(false);
  });

  it('Specimens is active for list and detail paths', () => {
    expect(isSidebarNavActive('/dashboard/lms/specimens', '/dashboard/lms/specimens')).toBe(true);
    expect(
      isSidebarNavActive('/dashboard/lms/specimens/abc', '/dashboard/lms/specimens'),
    ).toBe(true);
  });
});
