import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

describe('patient directory layout', () => {
  it('keeps the sticky header inside the row scroller and pagination after it', () => {
    const page = readWeb('components/patients/lookup/PatientHubPage.tsx');
    const table = readWeb('components/patients/lookup/PatientHubTable.tsx');
    const scrollAt = page.indexOf('worklistScroll');
    const footerAt = page.indexOf('worklistFooter');
    expect(scrollAt).toBeGreaterThan(-1);
    expect(footerAt).toBeGreaterThan(scrollAt);
    expect(page).toContain('overflow-auto');
    expect(page).toContain('overflow-hidden');
    expect(page).not.toContain('PatientHubTableHeader');
    expect(table).toContain('sticky top-0');
    expect(table).toContain('<thead');
    expect(table).not.toContain('border-separate');
  });

  it('keeps one table so the header and rows share column tracks', () => {
    const table = readWeb('components/patients/lookup/PatientHubTable.tsx');
    const bodyFn = table.indexOf('export function PatientHubTable(');
    expect(bodyFn).toBeGreaterThan(-1);
    expect(table.slice(bodyFn)).toContain('<PatientHubTableHeader');
    expect(table.slice(bodyFn)).toContain('<tbody');
    expect(table).toContain('PATIENT_HUB_COLGROUP_DESKTOP');
    expect(table).toContain('PATIENT_HUB_COLGROUP_COMPACT');
    expect(table).toContain('table-fixed');
    expect(table).toContain('<colgroup');
    expect(table).not.toContain('hidden xl:table-cell');
    expect(table).not.toContain('max-w-[16.5rem]');
  });

  it('keeps Provider as an independent column via colgroup, not CSS-hidden table cells', () => {
    const page = readWeb('components/patients/lookup/PatientHubPage.tsx');
    const table = readWeb('components/patients/lookup/PatientHubTable.tsx');
    expect(page).toContain('compactColumns={showDockedPreview || !canDock}');
    expect(table).toContain("key: 'provider'");
    expect(table).toContain("key: 'mrn'");
    expect(table).toContain("key: 'gender'");
    expect(table).not.toContain('xl:table-cell');
    expect(table).not.toContain('Current Visit');
    expect(table).not.toContain('Next Appointment');
    expect(table).not.toContain('data-col="location"');
  });

  it('uses always-visible Gen-1 Gender + DOB filters with no Sheet/Filters button', () => {
    const toolbar = readWeb('components/patients/lookup/PatientDirectoryToolbarFilters.tsx');
    const page = readWeb('components/patients/lookup/PatientHubPage.tsx');
    expect(toolbar).toContain('Gender');
    expect(toolbar).toContain('prefix="DOB From:"');
    expect(toolbar).toContain('prefix="To:"');
    expect(toolbar).toContain('data-filter-surface="directory-gen1"');
    expect(toolbar).toContain('page: 1');
    expect(page).toContain('PatientDirectoryToolbarFilters');
    expect(page).not.toContain('PatientAdvancedFilterSheet');
    expect(page).not.toContain('PatientFilterChips');
    expect(page).not.toContain('More filters');
    expect(page).not.toContain('filterToggle');
    expect(page).not.toContain('onRecentPatientSelect');
    expect(page).not.toContain('PatientRecentPatientsSection');
  });
});
