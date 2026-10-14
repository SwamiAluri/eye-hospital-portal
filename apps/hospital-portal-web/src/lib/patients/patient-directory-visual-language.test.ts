import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

describe('patient directory visual language', () => {
  const page = readWeb('components/patients/lookup/PatientHubPage.tsx');
  const table = readWeb('components/patients/lookup/PatientHubTable.tsx');
  const mobile = readWeb('components/patients/lookup/PatientHubMobileCards.tsx');
  const tabs = readWeb('components/patients/lookup/PatientHubClassificationTabs.tsx');
  const search = readWeb('components/patients/lookup/PatientDirectorySearch.tsx');
  const toolbar = readWeb('components/patients/lookup/PatientDirectoryToolbarFilters.tsx');
  const actions = readWeb('components/patients/lookup/PatientHubRowActions.tsx');
  const layout = readWeb('app/dashboard/layout.tsx');

  it('uses the counselling workspace canvas without a second page title', () => {
    expect(page).toContain('counsellingSessionTokens.shellPage');
    expect(page).toContain('staff-page-fit');
    expect(page).toContain('aria-label="Patient directory worklist"');
    expect(layout).toContain('isPatientDirectory');
  });

  it('keeps discovery actions in a single toolbar with search dominant', () => {
    expect(page).toContain('PatientDirectorySearch');
    expect(page).toContain('PatientDirectoryToolbarFilters');
    expect(page).toContain('filterClear');
    expect(page).toContain('Add Patient');
    expect(page).toContain('source: "census-bar"');
    expect(page).toContain('pillTabCurrent');
    expect(page).toContain('ring-inset');
    expect(page).not.toContain('Favorites');
    expect(page).not.toContain('Assigned to me');
    expect(page).not.toContain('Merge');
    expect(search).not.toContain('role="combobox"');
  });

  it('keeps primary census as All | Active pills, not summary cards', () => {
    expect(tabs).toContain('pillTab');
    expect(tabs).toContain("label: 'All'");
    expect(tabs).toContain("label: 'Active'");
    expect(tabs).toContain("key: 'current'");
    expect(tabs).not.toContain("label: 'High priority'");
    expect(tabs).not.toContain("label: 'New'");
    expect(tabs).not.toContain("label: 'Discharged'");
    expect(page).not.toContain('border-l-[3px]');
  });

  it('uses refined discovery columns with Gender', () => {
    expect(table).toContain('sticky top-0');
    expect(table).toContain('label="Patient"');
    expect(table).toContain('data-col="mrn"');
    expect(table).toContain('data-col="gender"');
    expect(table).toContain('Phone');
    expect(table).toContain('Provider');
    expect(table).toContain('Actions');
    expect(table).not.toContain('Current Visit');
    expect(table).not.toContain('Next Appointment');
    expect(table).not.toContain('data-col="location"');
    expect(table).not.toContain('>Engagement<');
    expect(table).toContain('PatientHubRowActions');
    expect(mobile).toContain('PatientHubPhoneCell');
    expect(mobile).toContain('PatientHubRowActions');
    expect(mobile).toContain('formatPatientHubIdentityLine');
  });

  it('keeps Provider independent at compact and certified direct row actions', () => {
    expect(table).toContain('PATIENT_HUB_COLGROUP_DESKTOP');
    expect(table).toContain('PATIENT_HUB_COLGROUP_COMPACT');
    expect(table).toContain('table-fixed');
    expect(table).toContain('data-col=');
    expect(table).toContain("key: 'provider'");
    expect(page).toContain('compactColumns={showDockedPreview || !canDock}');
    expect(page).toContain('replaceDirectoryUrlState');
    expect(page).not.toContain('router.replace(');
    expect(actions).toContain('Print Card');
    expect(actions).toContain('Check-in');
    expect(actions).toContain('Book appointment');
    expect(actions).toContain('canDirectoryOfferBookAppointment');
    expect(actions).toContain('flex-nowrap');
    expect(actions).not.toContain('MoreHorizontal');
    expect(actions).not.toContain('More actions');
    expect(actions).toContain('registrationCardPatient');
    expect(actions).toContain('RegistrationCardPreview');
  });

  it('uses always-visible Gen-1 Gender + DOB without Filters button or Sheet', () => {
    expect(toolbar).toContain('Gender');
    expect(toolbar).toContain('data-filter-surface="directory-gen1"');
    expect(toolbar).toContain('page: 1');
    expect(toolbar).not.toContain('>Apply<');
    expect(page).not.toContain('More filters');
    expect(page).not.toContain('sheetFirstFilters');
    expect(page).not.toContain('PatientAdvancedFilterSheet');
    expect(page).not.toContain('filterToggle');
    expect(page).not.toContain('<Sheet');
  });
});
