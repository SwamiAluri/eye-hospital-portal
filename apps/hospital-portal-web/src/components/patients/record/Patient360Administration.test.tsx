import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360AdministrationView } from '@/components/patients/record/Patient360Administration';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';
import type { Patient360AdministrationBundle } from '@/lib/patients/patient-360-administration';
import type { InpatientHistoryListResult } from '@/lib/patients/patient-360-inpatient-history';
import type { PatientSummary } from '@/types/patient-lookup';

const history: InpatientHistoryListResult = {
  state: 'ready',
  rows: [
    {
      id: 'j1',
      admittedAt: '2026-03-01 08:00',
      dischargedAt: '2026-03-02 11:00',
      clinicalState: 'Discharged',
    },
  ],
  totalCount: 1,
  pageNumber: 1,
  pageSize: 20,
};

const bundle: Patient360AdministrationBundle = {
  appointments: {
    state: 'ready',
    rows: [
      {
        id: 'apt-1',
        title: 'Follow-up',
        detail: 'Blurred vision',
        provider: 'Dr Sen',
        status: 'Cancelled',
        when: '2026-09-30 09:30',
      },
    ],
  },
  visits: {
    state: 'ready',
    rows: [
      {
        id: 'v1',
        title: 'OPD',
        status: 'completed',
        when: '2026-09-28 10:00',
        provider: 'Dr Sen',
        station: 'Optometry',
        checkInTime: '2026-09-28 10:00',
        encounterHref: '/dashboard/patients/p1/encounter/v1',
      },
    ],
  },
  consents: {
    state: 'unavailable',
    rows: [],
  },
};

describe('patient 360 administration presentation', () => {
  it('renders administrative history, preserved status, and not-integrated boundaries', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="administration" onSelect={() => undefined} />
        <Patient360AdministrationView bundle={bundle} history={history} />
      </>,
    );

    expect(html).toContain('>Check-in history<');
    for (const heading of ['Check-in history', 'Consents', 'Inpatient History', 'Surgery / OT']) {
      expect(html).toContain(`>${heading}<`);
    }
    expect(html).not.toContain('Appointments are listed in Care.');
    expect(html).not.toContain('>Appointments<');
    expect(html).toContain('Admission');
    expect(html).toContain('2026-03-01 08:00');
    expect(html).toContain('Discharge');
    expect(html).toContain('2026-03-02 11:00');
    expect(html).toContain('Discharged');
    expect(html).toContain('Status');
    expect(html).toContain('completed');
    expect(html).toContain('Time');
    expect(html).toContain('href="/dashboard/patients/p1/encounter/v1"');
    expect(html).toContain('Open encounter');
    expect(html).toContain('Consents are not available in Patient 360.');
    expect(html).toContain('Surgery / OT is not available in Patient 360.');
    expect(html).toContain('<table');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).not.toMatch(/No history|No documents|No counselling|No bills|No admissions|No surgery|Check in|Revoke|procedure|theatre|implant/i);
  });

  it('keeps empty, unauthorized, and unavailable inpatient history distinct', () => {
    const empty = renderToStaticMarkup(
      <Patient360AdministrationView
        bundle={bundle}
        history={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      />,
    );
    const denied = renderToStaticMarkup(
      <Patient360AdministrationView
        bundle={bundle}
        history={{ state: 'unauthorized', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      />,
    );
    const down = renderToStaticMarkup(
      <Patient360AdministrationView
        bundle={bundle}
        history={{ state: 'unavailable', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      />,
    );
    expect(empty).toContain('No inpatient history recorded.');
    expect(empty).not.toContain('not available to this sign-in');
    expect(denied).toContain('Inpatient history is not available to this sign-in.');
    expect(denied).not.toContain('No inpatient history recorded.');
    expect(down).toContain('Inpatient history is not available in Patient 360.');
    expect(down).not.toContain('No inpatient history recorded.');
    expect(empty).not.toMatch(/Admit|Transfer|procedure|Ward|OT booking/i);
  });

  it('renders inpatient history pagination from the server total', () => {
    const html = renderToStaticMarkup(
      <Patient360AdministrationView
        bundle={bundle}
        history={{ ...history, totalCount: 21, pageSize: 20, pageNumber: 1 }}
        onHistoryPageChange={() => undefined}
      />,
    );
    expect(html).toContain('Showing 1–20 of 21');
    expect(html).toContain('aria-label="Inpatient history pagination"');
  });

  it('does not repeat data-quality warnings inside Registration', () => {
    const html = renderToStaticMarkup(
      <Patient360AdministrationView
        bundle={bundle}
        history={history}
        summary={{
          id: 'p1',
          firstName: 'Asha',
          lastName: 'Rao',
          mrn: 'MRN-7',
          dateOfBirth: '1987-01-01T00:00:00Z',
          gender: 'Female',
          bloodGroup: 'O+',
          phone: null,
          clinicalAcuity: 'low',
          allergies: '',
          activeEngagements: [],
          careProgramCodes: [],
          dataQuality: {
            isIncomplete: true,
            issues: ['Missing phone number', 'Incomplete emergency contact', 'Allergies not documented'],
          },
        } as PatientSummary}
      />,
    );
    expect(html).toContain('>Registration<');
    expect(html).toContain('Date of birth');
    expect(html).toContain('01 Jan 1987');
    expect(html).not.toContain('Missing phone number');
    expect(html).not.toContain('Incomplete emergency contact');
    expect(html).not.toContain('Allergies not documented');
    expect(html).not.toContain('>Appointments<');
    expect(html).not.toContain('Appointments are listed in Care.');
    expect(html).toContain('>Check-in history<');
    expect(html).toContain('>Consents<');
    expect(html).toContain('>Inpatient History<');
  });
});
