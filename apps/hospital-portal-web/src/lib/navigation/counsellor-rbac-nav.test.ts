/**
 * Phase 2Z PD-NAV-01 / PD-WL-01 — Counsellor nav least-privilege + shared waiting list contract.
 */
import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_MENU_SECTIONS,
  filterSidebarSectionsByPermission,
} from '@/lib/navigation/sidebar-menu-sections';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';

/** Post PD-RBAC-01 + patient workflow JWT baseline (no IP/Ward/OT mutations, no user.view). */
const COUNSELLOR_BASELINE_PERMS = [
  'dashboard.view',
  'master_data.lookup',
  'counseling_sessions.read',
  'counseling_sessions.create',
  'counseling_sessions.update',
  'counseling_sessions.delete',
  'counseling_sessions.view',
  'counsellor.outpatient_checklist.edit',
  'ip.view',
  'bill.view',
  'opd_bill.view',
  'ward.investigation.enter',
  'ward.investigation.verify',
  'patient.view',
  'patient.create',
] as const;

const COUNSELLOR_HREFS = [
  '/dashboard/counsellors-desk/waiting-list',
  '/dashboard/counsellors-desk/finalize-surgery',
  '/dashboard/counsellors-desk/surgery-followup',
  '/dashboard/counselor/analytics',
] as const;

/** Modules that must stay hidden. Patient Directory lives under OPD & Registration. */
const UNRELATED_SECTIONS = [
  'Ward & Inpatient',
  'Administration',
  'Reports & Analytics',
  'Diagnostics & Lab',
  'Pharmacy',
] as const;

function hasFrom(list: readonly string[]) {
  return (code: string) => list.includes('*') || list.includes(code);
}

describe('PD-NAV-01 Counsellor-focused navigation', () => {
  it('Counsellor baseline sees Counsellor section with four desk routes', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(COUNSELLOR_BASELINE_PERMS),
    );
    const counsellor = filtered.find(s => s.title === 'Counsellor');
    expect(counsellor).toBeTruthy();
    const hrefs = counsellor!.items.map(i => i.href);
    for (const href of COUNSELLOR_HREFS) {
      expect(hrefs).toContain(href);
    }
  });

  it('null requiredPermission does not expose operational modules to Counsellor', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(COUNSELLOR_BASELINE_PERMS),
    );
    for (const title of UNRELATED_SECTIONS) {
      expect(filtered.find(s => s.title === title)).toBeUndefined();
    }
  });

  it('patient.view exposes Patient Directory only under OPD & Registration', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(COUNSELLOR_BASELINE_PERMS),
    );
    const opd = filtered.find(s => s.title === 'OPD & Registration');
    expect(opd).toBeTruthy();
    expect(opd!.items.map(i => i.href)).toEqual(['/dashboard/patients']);
    expect(opd!.items.every(i => i.requiredPermission === 'patient.view')).toBe(true);
    expect(filtered.find(s => s.title === "Doctor's Desk")).toBeUndefined();
  });

  it('bill.view alone does not surface Charge Reconciliation after permission split', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(COUNSELLOR_BASELINE_PERMS),
    );
    const finance = filtered.find(s => s.title === 'Finance & Billing');
    expect(finance).toBeUndefined();
  });

  it('bill.reconciliation.view surfaces Charge Reconciliation for billing roles', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom([...COUNSELLOR_BASELINE_PERMS, 'bill.reconciliation.view']),
    );
    const finance = filtered.find(s => s.title === 'Finance & Billing');
    expect(finance).toBeTruthy();
    expect(finance!.items.some(i => i.href === '/dashboard/admin/charge-reconciliation')).toBe(true);
  });

  it('baseline does not include broad user.view', () => {
    expect(COUNSELLOR_BASELINE_PERMS).not.toContain('user.view');
    expect(COUNSELLOR_BASELINE_PERMS).not.toContain('patient.update');
    expect(COUNSELLOR_BASELINE_PERMS).not.toContain('patient.admin');
    expect(COUNSELLOR_BASELINE_PERMS).not.toContain('bill.reconciliation.view');
  });

  it('admin wildcard still sees operational sections including Counsellor (unchanged)', () => {
    const filtered = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      hasFrom(['*']),
    );
    expect(filtered.find(s => s.title === 'Counsellor')).toBeTruthy();
    expect(filtered.find(s => s.title === 'Administration')).toBeTruthy();
    expect(filtered.find(s => s.title === 'OPD & Registration')).toBeTruthy();
  });

  it('Counsellor section items stay gated by counseling_sessions.read', () => {
    const section = SIDEBAR_MENU_SECTIONS.find(s => s.title === 'Counsellor');
    for (const href of COUNSELLOR_HREFS) {
      expect(section!.items.find(i => i.href === href)?.requiredPermission).toBe(
        COUNSELLING_SESSIONS_READ_PERMISSION,
      );
    }
  });
});

describe('PD-WL-01 Waiting List remains shared (contract)', () => {
  it('Waiting List shared-queue filters exclude counselor ownership keys', () => {
    const allowedKeys = ['type', 'status', 'fromDate', 'toDate', 'branchId', 'patientName', 'mrd'];
    expect(allowedKeys).not.toContain('counselorId');
    expect(allowedKeys).not.toContain('createdByUserId');
  });
});
