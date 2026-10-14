import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  countActiveFilters,
  type PatientLookupUrlState,
} from '@/lib/patients/patient-lookup-filters';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

describe('Patient Directory Gen-1 Filter UX (always-visible direct apply)', () => {
  const page = readWeb('components/patients/lookup/PatientHubPage.tsx');
  const toolbar = readWeb('components/patients/lookup/PatientDirectoryToolbarFilters.tsx');
  const dobField = readWeb('components/patients/lookup/PatientDirectoryDobField.tsx');
  const search = readWeb('components/patients/lookup/PatientDirectorySearch.tsx');
  const tabs = readWeb('components/patients/lookup/PatientHubClassificationTabs.tsx');

  it('keeps Search as the Name/MRN/Phone/Email discovery control', () => {
    expect(search).toContain('Search patients by name, MRN, phone, or email');
    expect(search).toContain('Search name, MRN, phone, email');
    expect(page).toContain('PatientDirectorySearch');
    expect(page).toContain('debouncedSearch');
  });

  it('uses always-visible Gender + DOB with toolbar Clear and no Filters/Apply/Sheet/chips', () => {
    expect(page).toContain('PatientDirectoryToolbarFilters');
    expect(page).toContain('countActiveFilters');
    expect(page).toContain('applyState');
    expect(page.match(/function applyState|const applyState/g)?.length ?? 0).toBe(1);
    expect(page).toContain('filterClear');
    expect(page).toContain('source: "census-bar"');
    expect(page).not.toContain('PatientAdvancedFilterSheet');
    expect(page).not.toContain('PatientFilterChips');
    expect(page).not.toContain('More filters');
    expect(page).not.toContain('patientLookupTestIds.moreFilters');
    expect(page).not.toContain('sheetFirstFilters');
    expect(page).not.toContain('filterToggle');
    expect(page).not.toContain('filtersOpen');
    expect(toolbar).toContain('page: 1');
    expect(toolbar).not.toContain('>Apply<');
    expect(toolbar).not.toContain('filterApply');
  });

  it('filter surface exposes only Gender + DOB From/To with immediate apply', () => {
    expect(toolbar).toContain('Gender');
    expect(toolbar).toContain('prefix="DOB From:"');
    expect(toolbar).toContain('prefix="To:"');
    expect(toolbar).toContain('label="DOB From"');
    expect(toolbar).toContain('label="DOB To"');
    expect(toolbar).not.toContain('prefix="DOB To:"');
    expect(toolbar).toContain('All genders');
    expect(toolbar).toContain('data-filter-surface="directory-gen1"');
    expect(toolbar).toContain('patch({ gender })');
    expect(dobField).toContain('onCommit');
    expect(dobField).toContain('prefix');
    expect(toolbar).not.toContain('Clinical');
    expect(toolbar).not.toContain('Diagnosis');
    expect(toolbar).not.toContain('Favorites');
    expect(toolbar).not.toContain('Assigned to me');
  });

  it('preserves filter apply semantics through the shared apply path', () => {
    expect(toolbar).toContain('onApply({ ...state, ...partial, page: 1 })');
    expect(toolbar).toContain('...state');
    expect(page).toContain('PatientDirectoryToolbarFilters state={urlState} onApply={applyState}');
    expect(page).toContain('applyState');
    expect(page).toContain('page: 1');
  });

  it('keeps All | Active census and does not restore Favorite/Assigned filter UI', () => {
    expect(tabs).toContain("label: 'All'");
    expect(tabs).toContain("label: 'Active'");
    expect(tabs).not.toContain("label: 'New'");
    expect(tabs).not.toContain("label: 'Discharged'");
    expect(tabs).not.toContain("label: 'High priority'");
    expect(page).not.toContain('Favorites');
    expect(page).not.toContain('Assigned to me');
  });

  it('counts only Gen-1 filters', () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ gender: 'female' })).toBe(1);
    expect(countActiveFilters({ dobFrom: '1990-01-01' })).toBe(1);
    expect(countActiveFilters({ dobTo: '1995-12-31' })).toBe(1);
    expect(
      countActiveFilters({ dobFrom: '1990-01-01', dobTo: '1995-12-31' }),
    ).toBe(1);
    expect(
      countActiveFilters({
        gender: 'male',
        dobFrom: '1990-01-01',
        dobTo: '1995-12-31',
      }),
    ).toBe(2);
    expect(
      countActiveFilters({
        q: 'search-me',
        tab: 'current',
        diagnosis: 'cataract',
        name: 'legacy',
        mrn: 'MRN1',
        phone: '999',
        favoritesOnly: true,
        assignedToMe: true,
        engagementTypes: ['opd'],
        programCodes: ['CATARACT'],
        patientTypes: ['Cash'],
        departmentId: 'd1',
        providerId: 'p1',
        wardName: 'Ward A',
        appointmentFrom: '2026-01-01',
        admissionFrom: '2026-01-01',
      }),
    ).toBe(0);

    const state: PatientLookupUrlState = {
      page: 2,
      tab: 'current',
      q: 'keep-me',
      branchId: 'br-1',
      previewPatientId: 'p-1',
      gender: 'male',
      dobFrom: '1990-01-01',
      diagnosis: 'cataract',
      name: 'legacy-name',
      mrn: 'legacy-mrn',
      phone: '9999999999',
    };
    expect(countActiveFilters(state)).toBe(2);
  });

  it('does not change lookup filter contract helpers', () => {
    const filters = readWeb('lib/patients/patient-lookup-filters.ts');
    expect(filters).toContain('export function toPatientLookupFilters');
    expect(filters).toContain('export function countActiveFilters');
    expect(filters).toContain('export function parseLookupUrlParams');
    expect(filters).toContain('export function buildLookupUrlParams');
  });
});
