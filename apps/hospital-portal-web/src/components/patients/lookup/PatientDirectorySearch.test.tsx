import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toPatientLookupFilters } from '@/lib/patients/patient-lookup-filters';
import { PatientDirectorySearch } from './PatientDirectorySearch';

const pageSource = readFileSync(
  resolve(__dirname, 'PatientHubPage.tsx'),
  'utf8',
);

describe('directory search', () => {
  it('renders a labeled search field and no suggestion overlay', () => {
    const html = renderToStaticMarkup(
      <PatientDirectorySearch value="sa" onChange={() => undefined} />,
    );
    expect(html).toContain('aria-label="Search patients by name, MRN, phone, or email"');
    expect(html).toContain('placeholder="Search name, MRN, phone, email…"');
    expect(html).toContain('value="sa"');
    expect(html).toContain('patient-hub-search');
    expect(html).toContain('type="search"');
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('patient-hub-autosuggest');
    expect(html).not.toContain('Recent');
  });

  it('wires the directory page to the existing debounced lookup and not autosuggest', () => {
    expect(pageSource).toContain('PatientDirectorySearch');
    expect(pageSource).not.toContain('PatientSearchAutosuggest');
    expect(pageSource).not.toContain('searchPatientsUnified');
    expect(pageSource).not.toContain('role="combobox"');
    expect(pageSource).not.toContain('role="listbox"');
    expect(pageSource).toContain('useDebouncedValue(search, 300)');
    expect(pageSource).toContain('q: debouncedSearch || undefined');
    expect(pageSource).toContain('page: 1');
    expect(pageSource).toContain('replaceDirectoryUrlState');
    expect(pageSource).toContain('shouldHydrateSearchFromUrl');
    expect(pageSource).toContain('onFocusChange');
    expect(pageSource).not.toContain('router.replace(');
    expect(pageSource).toContain('usePatientLookupQuery(filters, isReady)');
    expect(pageSource).toContain('usePatientLookupStatsQuery(branchId, isReady)');
    expect(pageSource).toContain('No patients found');
    expect(pageSource).toContain('Try another name, MRN, phone number, or email.');
    expect(pageSource).not.toContain('does not exist');
  });

  it('sends search, gender, and census to the same lookup and resets the page', () => {
    const filters = toPatientLookupFilters(
      { q: 'old', gender: 'male', tab: 'current', page: 4 },
      { branchId: 'branch-1', pageSize: 25, q: 'sa' },
    );
    expect(filters.q).toBe('sa');
    expect(filters.gender).toBe('male');
    expect(filters.tab).toBe('current');
    expect(filters.page).toBe(4);

    const cleared = toPatientLookupFilters(
      { gender: 'male', tab: 'current', page: 1 },
      { branchId: 'branch-1', pageSize: 25, q: '' },
    );
    expect(cleared.q).toBeUndefined();
    expect(cleared.gender).toBe('male');
    expect(cleared.tab).toBe('current');
  });
});
