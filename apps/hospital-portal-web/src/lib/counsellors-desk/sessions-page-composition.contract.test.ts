import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { resolveStaffPageTitle, type StaffNavItem } from '../navigation/resolve-staff-page-title';

const sessionsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/sessions/page.tsx'),
  'utf8',
);

const sidebar = readFileSync(
  resolve(__dirname, '../navigation/sidebar-menu-sections.tsx'),
  'utf8',
);

const SESSIONS_NAV: StaffNavItem[] = [
  { label: 'Counselling Sessions', href: '/dashboard/counsellors-desk/sessions' },
];

describe('Sessions page composition — filter register', () => {
  it('uses the staff chrome title and does not render a second content heading', () => {
    expect(resolveStaffPageTitle('/dashboard/counsellors-desk/sessions', SESSIONS_NAV)).toBe(
      'Counselling Sessions',
    );
    expect(sidebar).toContain("label: 'Counselling Sessions'");
    expect(sessionsPage).toContain('data-testid="sessions-filters-open"');
    expect(sessionsPage).toMatch(/sessions-filters-open[\s\S]{0,160}>\s*Filters\s*</);
    expect(sessionsPage).not.toContain('aria-label="Session views"');
    expect(sessionsPage).not.toContain('data-testid="sessions-purpose-line"');
    expect(sessionsPage).not.toContain('data-testid="sessions-list-title"');
    expect(sessionsPage).not.toContain('<h1');
    expect(sessionsPage).not.toContain('staff-page-title');
    expect(sessionsPage).not.toContain('data-testid="sessions-list-count"');
    expect(sessionsPage).not.toContain('data-testid="sessions-state-band"');
    expect(sessionsPage).not.toContain('aria-label="Go back"');
    expect(sessionsPage).not.toContain('sessionStatusStrip');
  });

  it('keeps one register and puts Reassignment Required in the filter sheet', () => {
    const filtersAt = sessionsPage.indexOf('data-testid="sessions-filters-open"');
    const searchAt = sessionsPage.indexOf('data-testid="sessions-search"');
    const chipsAt = sessionsPage.indexOf('data-testid="sessions-filter-chips"');
    const rrAt = sessionsPage.indexOf('id="sessions-filter-rr"');
    const worklistAt = sessionsPage.indexOf('aria-label="Counselling sessions worklist"');

    expect(filtersAt).toBeGreaterThan(-1);
    expect(searchAt).toBeGreaterThan(filtersAt);
    expect(chipsAt).toBeGreaterThan(searchAt);
    expect(rrAt).toBeGreaterThan(chipsAt);
    expect(worklistAt).toBeGreaterThan(rrAt);

    expect(sessionsPage).toContain('Search session number');
    expect(sessionsPage).toContain('>Reassignment required<');
    expect(sessionsPage).toContain('applySessionsRegisterDraft');
    expect(sessionsPage).toContain('clearSessionsDrilldownFilters');
    expect(sessionsPage).not.toContain('toggleReassignmentRequiredInSearchParams');
    expect(sessionsPage).not.toContain('sessions-state-selector');
    expect(sessionsPage).not.toContain('pillTabCurrent');
  });
});
