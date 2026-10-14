import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SIDEBAR_MENU_SECTIONS,
  filterSidebarSectionsByPermission,
} from '@/lib/navigation/sidebar-menu-sections';

describe('Patient Directory route and action authorization', () => {
  it('gates the directory page on patient.view', async () => {
    const text = await readFile(join(process.cwd(), 'src/app/dashboard/patients/page.tsx'), 'utf8');
    expect(text).toContain('requiredPermission="patient.view"');
    expect(text).toContain('PatientHubPage');
  });

  it('gates Add Patient and export, and hides Directory-only merge chrome', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/patients/lookup/PatientHubPage.tsx'),
      'utf8',
    );
    expect(text).toContain('useHasPermission("patient.create")');
    expect(text).toContain('AddPatientDialog');
    expect(text).not.toContain("buildCanonicalAddPatientHref('/dashboard/patients')");
    expect(text).not.toContain('useHasPermission("patient.update")');
    expect(text).not.toContain('/dashboard/patients/merge');
    expect(text).toContain('useHasPermission("patient.export")');
    expect(text).toContain('toPatientLookupFilters');
    expect(text).not.toContain('>Patients<');
    expect(text).not.toContain('PatientHubSelectionBar');
    expect(text).toContain('AddPatientDialog');
    expect(text).not.toContain('Favorites');
    expect(text).not.toContain('Assigned to me');
    expect(text).toContain('worklistFooter');
    expect(text).toContain('worklistScroll');
    expect(text).toContain('PAGE_SIZE');
  });

  it('loads a worklist skeleton without the retired column labels', async () => {
    const text = await readFile(join(process.cwd(), 'src/app/dashboard/patients/loading.tsx'), 'utf8');
    expect(text).not.toContain('Last Visit');
    expect(text).not.toContain("'Phone'");
    expect(text).not.toContain("'Status'");
  });

  it('places Patient Directory once under OPD & Registration', () => {
    const matches = SIDEBAR_MENU_SECTIONS.flatMap(section =>
      section.items
        .filter(item => item.href === '/dashboard/patients' || item.label === 'Patient Directory')
        .map(item => ({ title: section.title, ...item })),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.title).toBe('OPD & Registration');
    expect(matches[0]?.href).toBe('/dashboard/patients');
    expect(matches[0]?.requiredPermission).toBe('patient.view');
    const desk = SIDEBAR_MENU_SECTIONS.find(section => section.title === "Doctor's Desk");
    expect(desk?.items.some(item => item.href === '/dashboard/patients')).toBe(false);

    const visible = filterSidebarSectionsByPermission(
      SIDEBAR_MENU_SECTIONS,
      code => code === 'patient.view',
    );
    const opd = visible.find(section => section.title === 'OPD & Registration');
    expect(opd?.items.map(item => item.href)).toEqual(['/dashboard/patients']);
    expect(visible.find(section => section.title === "Doctor's Desk")).toBeUndefined();
  });

  it('bounds only the directory list route, with pagination outside the row scroller', async () => {
    const layout = await readFile(join(process.cwd(), 'src/app/dashboard/layout.tsx'), 'utf8');
    expect(layout).toContain("pathname === '/dashboard/patients'");
    expect(layout).not.toContain("pathname.startsWith('/dashboard/patients')");
    const page = await readFile(
      join(process.cwd(), 'src/components/patients/lookup/PatientHubPage.tsx'),
      'utf8',
    );
    const scrollAt = page.indexOf('worklistScroll');
    const footerAt = page.indexOf('worklistFooter');
    expect(scrollAt).toBeGreaterThan(-1);
    expect(footerAt).toBeGreaterThan(scrollAt);
    expect(page).toContain('overflow-auto');
    expect(page).toContain('pageSize={PAGE_SIZE}');
  });
});

