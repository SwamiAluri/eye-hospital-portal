import { describe, expect, it } from 'vitest';
import { SIDEBAR_MENU_SECTIONS } from './sidebar-menu-sections';
import { resolveStaffPageTitle, type StaffNavItem } from './resolve-staff-page-title';

const ITEMS: StaffNavItem[] = [
  { label: 'Overview', href: '/dashboard', exact: true },
  { label: 'Front Office / OPD', href: '/dashboard/frontdesk' },
  { label: 'Queue', href: '/dashboard/frontdesk/queue' },
  { label: 'Queue Display', href: '/dashboard/frontdesk/queue-display?mode=branch&interval=10' },
  { label: 'Doctor\'s Desk', href: '/dashboard/doctors-desk' },
  { label: 'Patients', href: '/dashboard/patients' },
  { label: 'Counsellor Waiting List', href: '/dashboard/counsellors-desk/waiting-list' },
  { label: 'Counselling Sessions', href: '/dashboard/counsellors-desk/sessions' },
  { label: 'Finalize Surgery', href: '/dashboard/counsellors-desk/finalize-surgery' },
  { label: 'Analytics', href: '/dashboard/counselor/analytics' },
  { label: 'Analytics', href: '/dashboard/ccms/analytics' },
  { label: 'Cases', href: '/dashboard/ccms/cases' },
  { label: 'Ward', href: '/dashboard/ip-management/ward' },
  { label: 'IP Management', href: '/dashboard/ip-management', exact: true },
  { label: 'Dashboard', href: '/admin/inventory', exact: true },
  { label: 'Items', href: '/admin/inventory/items' },
];

describe('resolveStaffPageTitle', () => {
  it('uses the sidebar label for the current page', () => {
    expect(resolveStaffPageTitle('/dashboard/counsellors-desk/waiting-list', ITEMS)).toBe(
      'Counsellor Waiting List',
    );
    expect(resolveStaffPageTitle('/dashboard/ip-management/ward', ITEMS)).toBe('Ward');
  });

  it('picks the longest matching address when several fit', () => {
    expect(resolveStaffPageTitle('/dashboard/frontdesk/queue', ITEMS)).toBe('Queue');
    expect(resolveStaffPageTitle('/dashboard/ccms/analytics/operational', ITEMS)).toBe('Analytics');
  });

  it('ignores a query string on the menu address', () => {
    expect(resolveStaffPageTitle('/dashboard/frontdesk/queue-display', ITEMS)).toBe('Queue Display');
  });

  it('does not let an exact parent claim a child page', () => {
    expect(resolveStaffPageTitle('/dashboard/ip-management/throughput', ITEMS)).toBe('');
    expect(resolveStaffPageTitle('/admin/inventory/items', ITEMS)).toBe('Items');
    expect(resolveStaffPageTitle('/dashboard', ITEMS)).toBe('Overview');
  });

  it('keeps the parent page name on a record route', () => {
    expect(resolveStaffPageTitle('/dashboard/doctors-desk/encounter-1', ITEMS)).toBe("Doctor's Desk");
    expect(resolveStaffPageTitle('/dashboard/ccms/cases/case-9', ITEMS)).toBe('Cases');
    expect(resolveStaffPageTitle('/dashboard/patients/patient-1/summary', ITEMS)).toBe('Patients');
  });

  it('names a counselling session after Counselling Sessions', () => {
    expect(resolveStaffPageTitle('/dashboard/counsellors-desk/session-1', ITEMS)).toBe(
      'Counselling Sessions',
    );
  });

  it('uses the live sidebar label for the waiting list', () => {
    expect(
      resolveStaffPageTitle(
        '/dashboard/counsellors-desk/waiting-list',
        SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items),
      ),
    ).toBe('Counsellor Waiting List');
  });

  it('distinguishes two Analytics items by address', () => {
    expect(resolveStaffPageTitle('/dashboard/counselor/analytics', ITEMS)).toBe('Analytics');
    expect(resolveStaffPageTitle('/dashboard/ccms/analytics', ITEMS)).toBe('Analytics');
  });
});
