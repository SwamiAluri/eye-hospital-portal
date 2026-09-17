import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_MENU_SECTIONS,
  filterSidebarSectionsByPermission,
} from '@/lib/navigation/sidebar-menu-sections';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';

const AMELIA_AUTH = {
  userId: '48a94c56-ccb2-49c0-9916-bee2703b0251',
  role: 'Counsellor',
  permissionsBeforeFix: [
    'dashboard.view',
    'counsellor.outpatient_checklist.edit',
    'ip.view',
    'master_data.lookup',
  ] as string[],
  permissionsAfterFix: [
    'dashboard.view',
    'counsellor.outpatient_checklist.edit',
    'counseling_sessions.read',
    'counseling_sessions.create',
    'counseling_sessions.update',
    'ip.view',
    'bill.view',
    'opd_bill.view',
    'patient.view',
    'patient.create',
  ] as string[],
};

const COUNSELLOR_HREFS = [
  '/dashboard/counsellors-desk/waiting-list',
  '/dashboard/counsellors-desk/finalize-surgery',
  '/dashboard/counsellors-desk/surgery-followup',
  '/dashboard/counselor/analytics',
] as const;

function hasFrom(list: string[]) {
  return (code: string) => list.includes('*') || list.includes(code);
}

describe('Counsellor sidebar navigation authorization', () => {
  it('Counsellor section items require counseling_sessions.read (same as ProtectedRoute)', () => {
    const section = SIDEBAR_MENU_SECTIONS.find(s => s.title === 'Counsellor');
    expect(section).toBeTruthy();
    for (const href of COUNSELLOR_HREFS) {
      const item = section!.items.find(i => i.href === href);
      expect(item?.requiredPermission).toBe(COUNSELLING_SESSIONS_READ_PERMISSION);
    }
  });

  it('Amelia-like JWT without counseling_sessions.read hides Counsellor navigation', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(AMELIA_AUTH.permissionsBeforeFix),
    );
    expect(filtered.find(s => s.title === 'Counsellor')).toBeUndefined();
  });

  it('PD-NAV-01: null permission does not expose OPD to counsellor baseline', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(AMELIA_AUTH.permissionsAfterFix),
    );
    expect(filtered.find(s => s.title === 'OPD & Registration')).toBeUndefined();
    expect(filtered.find(s => s.title === 'Counsellor')).toBeTruthy();
  });

  it('authorized counsellor with counseling_sessions.read sees Counsellor section', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(AMELIA_AUTH.permissionsAfterFix),
    );
    const counsellor = filtered.find(s => s.title === 'Counsellor');
    expect(counsellor).toBeTruthy();
    const hrefs = counsellor!.items.map(i => i.href);
    for (const href of COUNSELLOR_HREFS) {
      expect(hrefs).toContain(href);
    }
  });

  it('non-counsellor without counselling or admin wildcard does not see Counsellor nav', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(['dashboard.view', 'appointment.view', 'patient.view']),
    );
    expect(filtered.find(s => s.title === 'Counsellor')).toBeUndefined();
  });

  it('admin wildcard still sees Counsellor navigation (unchanged)', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(['*']),
    );
    expect(filtered.find(s => s.title === 'Counsellor')).toBeTruthy();
  });

  it('documents Amelia identity constants used in UAT (not hardcoded into auth)', () => {
    expect(AMELIA_AUTH.userId).toBe('48a94c56-ccb2-49c0-9916-bee2703b0251');
    expect(AMELIA_AUTH.role).toBe('Counsellor');
    expect(AMELIA_AUTH.permissionsBeforeFix).not.toContain(COUNSELLING_SESSIONS_READ_PERMISSION);
    expect(AMELIA_AUTH.permissionsAfterFix).toContain(COUNSELLING_SESSIONS_READ_PERMISSION);
  });
});
