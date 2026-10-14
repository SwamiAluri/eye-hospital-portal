import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { countActiveFilters } from '@/lib/patients/patient-lookup-filters';
import {
  DIRECTORY_DOB_PLACEHOLDER,
  formatDirectoryDobDigits,
  parseDirectoryDobDisplay,
} from '@/lib/patients/patient-directory-dob';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

vi.mock('@/hooks/use-permissions', () => ({
  useHasPermission: (code: string) => code === 'appointment.view',
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

import {
  PatientHubTable,
  PATIENT_HUB_COLGROUP_DESKTOP,
  PATIENT_HUB_COLGROUP_COMPACT,
} from '@/components/patients/lookup/PatientHubTable';
import { PatientDirectoryToolbarFilters } from '@/components/patients/lookup/PatientDirectoryToolbarFilters';
import type { PatientLookupRow } from '@/types/patient-lookup';

const row: PatientLookupRow = {
  id: 'patient-visual',
  firstName: 'Sam',
  lastName: 'Aluri',
  mrn: 'MRN-2026-02-CE412',
  dateOfBirth: '1987-01-01',
  gender: 'male',
  clinicalAcuity: 'low',
  isFavorite: false,
  careProgramCodes: [],
  reasonForVisit: 'Follow-up review',
  currentStation: 'Triage',
  roomNumber: '3',
  waitingMinutes: 12,
  assignedProviderName: 'Dr. Rao',
  assignedProviderRole: 'Ophthalmologist',
  primaryOpenVisitId: 'visit-1',
  scheduledAt: '2026-06-02T04:35:00.000Z',
  phone: '9999900000',
  activeEngagements: [],
};

const bareBookableRow: PatientLookupRow = {
  ...row,
  id: 'patient-bare',
  waitingMinutes: null,
  primaryOpenVisitId: null,
  scheduledAt: null,
  reasonForVisit: null,
  currentStation: null,
  roomNumber: null,
  assignedProviderName: null,
  assignedProviderRole: null,
  phone: '9999900000',
  activeEngagements: [],
};

describe('Patient Directory final filter toolbar + worklist', () => {
  const page = readWeb('components/patients/lookup/PatientHubPage.tsx');
  const toolbar = readWeb('components/patients/lookup/PatientDirectoryToolbarFilters.tsx');
  const dobField = readWeb('components/patients/lookup/PatientDirectoryDobField.tsx');
  const table = readWeb('components/patients/lookup/PatientHubTable.tsx');
  const search = readWeb('components/patients/lookup/PatientDirectorySearch.tsx');
  const mobile = readWeb('components/patients/lookup/PatientHubMobileCards.tsx');
  const sessionPicker = readWeb(
    'components/counsellors-desk/session/primitives/SessionDatePicker.tsx',
  );

  it('renders always-visible Gender + DOB with Clear in toolbar and Add Patient by census', () => {
    expect(page).toContain('PatientDirectoryToolbarFilters');
    expect(page).toContain('PatientDirectorySearch');
    expect(page).toContain('filterClear');
    expect(page).toContain('aria-label="Clear filters"');
    expect(page).toContain('Add Patient');
    expect(page).toContain('source: "census-bar"');
    expect(page).toContain('Export');
    expect(page).toContain('Refresh');
    expect(page).not.toContain('PatientAdvancedFilterSheet');
    expect(page).not.toContain('PatientFilterChips');
    expect(page).not.toContain('filterToggle');
    expect(page).not.toContain('SlidersHorizontal');
    expect(page).not.toContain('filtersOpen');
    expect(page).not.toContain('isNarrowViewport');
    expect(page).not.toContain('More filters');
    expect(page).toContain('branchId: urlState.branchId');
    expect(page).toContain('tab: urlState.tab');
    expect(page).toContain('q: urlState.q');
    expect(toolbar).toContain('All genders');
    expect(toolbar).toContain('patient-hub-filter-gender');
    expect(toolbar).toContain('prefix="DOB From:"');
    expect(toolbar).toContain('prefix="To:"');
    expect(toolbar).toContain('label="DOB From"');
    expect(toolbar).toContain('label="DOB To"');
    expect(toolbar).not.toContain('prefix="DOB To:"');
    expect(toolbar).toContain('page: 1');
    expect(toolbar).not.toContain('>Apply<');
    expect(toolbar).not.toContain('SlidersHorizontal');
    expect(toolbar).not.toContain('filterToggle');
  });

  it('toolbar filter markup exposes Gender and DOB controls at h-9', () => {
    const html = renderToStaticMarkup(
      <PatientDirectoryToolbarFilters
        state={{ page: 2, tab: 'current', q: 'rao', gender: undefined }}
        onApply={() => undefined}
      />,
    );
    expect(html).toContain('patient-hub-filter-inline');
    expect(html).toContain('Gender');
    expect(html).toContain('All genders');
    expect(html).toContain('patient-hub-filter-dob-from');
    expect(html).toContain('patient-hub-filter-dob-to');
    expect(html).toContain('DOB From:');
    expect(html).toContain('To:');
    expect(html).toContain(DIRECTORY_DOB_PLACEHOLDER);
    expect(html).toContain('h-9');
    expect(html).toContain('aria-label="DOB From"');
    expect(html).toContain('aria-label="DOB To"');
    expect(html).not.toContain('DOB To:');
    expect(html).not.toContain('Date of Birth');
    expect(html).not.toContain('mb-1 block text-xs');
    expect(html).not.toContain('>Apply<');
    expect(html).not.toContain('mock-sheet');
  });

  it('applies gender immediately with page reset via shared apply path', () => {
    expect(toolbar).toContain('patch({ gender })');
    expect(toolbar).toContain('onApply({ ...state, ...partial, page: 1 })');
    expect(page).toContain('applyState');
  });

  it('DOB field is Directory-scoped with inline prefix and does not modify SessionDatePicker', () => {
    expect(dobField).toContain('Directory-scoped DOB');
    expect(dobField).toContain('sanitizeDirectoryDobInput');
    expect(dobField).toContain('CalendarIcon');
    expect(dobField).toContain(DIRECTORY_DOB_PLACEHOLDER);
    expect(dobField).toContain('prefix');
    expect(dobField).toContain('aria-hidden');
    expect(dobField).toContain('items-center');
    expect(dobField).toContain('min-w-[8.75rem]');
    expect(dobField).toContain('align="end"');
    expect(dobField).toContain('avoidCollisions={false}');
    expect(dobField).toContain('disabled={{ after: latestDob }}');
    expect(dobField).toContain('directoryDobLatestSelectableDate');
    expect(dobField).not.toContain('mb-1 block');
    expect(dobField).not.toContain("from './SessionDatePicker'");
    expect(dobField).not.toContain('from "@/components/counsellors-desk/session/primitives/SessionDatePicker"');
    expect(sessionPicker).not.toContain('patient-directory-dob');
    expect(sessionPicker).not.toContain('DD/MM/YYYY');
  });

  it('DOB helpers support numeric DD/MM/YYYY and reject invalid dates', () => {
    expect(formatDirectoryDobDigits('01011990')).toBe('01/01/1990');
    expect(parseDirectoryDobDisplay('01/01/1990')).toEqual({
      status: 'valid',
      iso: '1990-01-01',
    });
    expect(parseDirectoryDobDisplay('31/02/2025').status).toBe('invalid');
    expect(parseDirectoryDobDisplay('').status).toBe('empty');
    expect(countActiveFilters({ gender: 'male', dobFrom: '1990-01-01', q: 'rao' })).toBe(2);
  });

  it('search remains flex-1 beside stable filter widths', () => {
    expect(search).toContain('flex-1');
    expect(search).toContain('min-w-[12rem]');
    expect(toolbar).toContain('shrink-0');
  });

  it('desktop worklist is Patient | MRN | Gender | Phone | Provider | Actions', () => {
    const html = renderToStaticMarkup(
      <PatientHubTable
        rows={[row]}
        previewId={null}
        isLoading={false}
        isError={false}
        isReady
        currentSort="name"
        currentSortDir="asc"
        onSort={() => undefined}
        onRowClick={() => undefined}
        onOpenProfile={() => undefined}
      />,
    );
    expect(html).toContain('>Patient<');
    expect(html).toContain('>MRN<');
    expect(html).toContain('>Gender<');
    expect(html).toContain('>Phone<');
    expect(html).toContain('>Provider<');
    expect(html).toContain('>Actions<');
    expect(html).not.toContain('>Next Appointment<');
    expect(html).not.toContain('>Current Visit<');
    expect(html).not.toContain('>Location<');

    const mrnHeader = html.indexOf('>MRN<');
    const genderHeader = html.indexOf('>Gender<');
    const phoneHeader = html.indexOf('>Phone<');
    expect(genderHeader).toBeGreaterThan(mrnHeader);
    expect(phoneHeader).toBeGreaterThan(genderHeader);

    expect(html).toContain('Sam Aluri');
    expect(html).toContain('MRN-2026-02-CE412');
    expect(html).toContain('MALE');
    expect(html).not.toContain('MRN-2026-02-CE412 ·');
    expect(html).not.toContain('Follow-up review');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('+91-9999900000');
    expect(html).not.toContain('tel:');
  });

  it('keeps Provider independent in compact mode and B.1A action alignment', () => {
    const compactHtml = renderToStaticMarkup(
      <PatientHubTable
        rows={[row]}
        previewId={null}
        isLoading={false}
        isError={false}
        isReady
        currentSort="name"
        currentSortDir="asc"
        onSort={() => undefined}
        compactColumns
        onRowClick={() => undefined}
        onOpenProfile={() => undefined}
      />,
    );
    expect(compactHtml).toContain('data-compact="true"');
    expect(compactHtml).toContain('>Provider<');
    expect(compactHtml).toContain('>Gender<');

    expect(PATIENT_HUB_COLGROUP_DESKTOP.map((c) => c.key)).toEqual([
      'patient',
      'mrn',
      'gender',
      'phone',
      'provider',
      'actions',
    ]);
    expect(
      PATIENT_HUB_COLGROUP_DESKTOP.map((c) => Number.parseFloat(c.width)).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBe(100);
    expect(
      PATIENT_HUB_COLGROUP_COMPACT.map((c) => Number.parseFloat(c.width)).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBe(100);
    expect(table).toContain('<colgroup');
    expect(table).not.toContain('hidden xl:table-cell');

    const actionsHtml = renderToStaticMarkup(
      <PatientHubTable
        rows={[bareBookableRow]}
        previewId={null}
        isLoading={false}
        isError={false}
        isReady
        currentSort="name"
        currentSortDir="asc"
        onSort={() => undefined}
        onRowClick={() => undefined}
        onOpenProfile={() => undefined}
      />,
    );
    expect(actionsHtml).toContain('flex-nowrap');
    expect(actionsHtml).toContain('justify-start');
    expect(actionsHtml).toContain('Print Card');
    expect(actionsHtml).toContain('Book appointment');
  });

  it('mobile cards keep MRN via the existing identity line', () => {
    expect(mobile).toContain('formatPatientHubIdentityLine');
    expect(mobile).toContain('identityLine');
  });
});
