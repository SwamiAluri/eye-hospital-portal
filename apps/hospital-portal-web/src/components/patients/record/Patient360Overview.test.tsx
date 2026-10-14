import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360Overview } from '@/components/patients/record/Patient360Overview';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';
import type { PatientRecentVisit, PatientSummary } from '@/types/patient-lookup';

const summary: PatientSummary = {
  id: 'p1',
  firstName: 'Asha',
  lastName: 'Rao',
  mrn: 'MRN-7',
  dateOfBirth: '1980-01-15',
  gender: 'Female',
  phone: '9990001111',
  clinicalAcuity: 'low',
  allergies: 'Penicillin',
  activeEngagements: [{ type: 'queue', label: 'Queue', status: 'waiting' }],
  careProgramCodes: ['CATARACT'],
  assignedVisitId: 'v1',
  scheduledAt: '2026-10-06T10:30:00',
  reasonForVisit: 'Blurred vision',
  currentStation: 'Optometry',
  assignedProviderName: 'Dr Sen',
  latestVitals: {
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    isStale: true,
  },
  dataQuality: { isIncomplete: true, issues: ['Missing phone number'] },
};

const visits: PatientRecentVisit[] = [
  {
    id: 'v1',
    checkedInAt: '2026-10-06T09:00:00',
    status: 'Checked-in',
    visitType: 'OPD',
    currentStation: 'Optometry',
  },
];

function renderOverview(
  props: Partial<React.ComponentProps<typeof Patient360Overview>> = {},
) {
  return renderToStaticMarkup(
    <>
      <Patient360SectionNav active="overview" onSelect={() => undefined} />
      <Patient360Overview summary={summary} recentVisits={visits} {...props} />
    </>,
  );
}

describe('patient 360 overview presentation', () => {
  it('renders the sparse workspace without repeating header identity or a card grid', () => {
    const html = renderOverview();

    expect(html).toContain('role="tab"');
    expect(html).toContain('>Now<');
    expect(html).toContain('>Clinical flags<');
    expect(html).toContain('>Recent activity<');
    expect(html).toContain('2026-10-06 10:30');
    expect(html).toContain('Cataract');
    expect(html).toContain('OPD vital signs, stale');
    expect(html).toContain('120/80');
    expect(html).toContain('Registration allergy text');
    expect(html).toContain('Penicillin');
    expect(html).toContain('>Date<');
    expect(html).toContain('>Visit<');
    expect(html).toContain('Station / reason');
    expect(html).toContain('>Status<');
    expect(html).toContain('href="/dashboard/patients/p1/encounter/v1"');
    expect(html).toContain('Open encounter');
    expect(html).toContain('Full journey in Care');
    expect(html).not.toContain('Patient snapshot');
    expect(html).not.toContain('Current care context');
    expect(html).not.toContain('Clinical snapshot');
    expect(html).not.toContain('Next actions');
    expect(html).not.toContain('md:grid-cols-2');
    expect(html).not.toContain('MRN-7');
    expect(html).not.toContain('Asha');
    expect(html).not.toContain('Queue · waiting');
    expect(html).not.toContain('Blurred vision');
    expect(html).not.toContain('Dr Sen');
    expect(html).not.toContain('Continue encounter');
    expect(html).not.toContain('Check-in');
    expect(html).not.toContain('Missing phone number');
    expect(html).not.toContain('Data quality');
    expect(html).not.toMatch(/Diagnosis history|No history|No documents|No counselling|No bills|outstanding|balance/i);
    expect(html.match(/role="tab"/g)).toHaveLength(7);
  });

  it('omits Now when there is no scheduled time or program, and uses recorded-absence copy for visits', () => {
    const html = renderOverview({
      summary: {
        ...summary,
        scheduledAt: null,
        careProgramCodes: [],
        latestVitals: null,
        allergies: '  ',
        assignedVisitId: null,
        dataQuality: { isIncomplete: false, issues: [] },
      },
      recentVisits: [],
    });

    expect(html).not.toContain('>Now<');
    expect(html).toContain('No clinical flags recorded.');
    expect(html).toContain('No visits recorded.');
    expect(html).not.toContain('No visits were returned.');
    expect(html).not.toContain('Data quality');
    expect(html).not.toContain('Next actions');
  });

  it('does not treat a recent-visit loader failure as empty success', () => {
    const html = renderOverview({ recentVisits: [], visitsFailed: true, visitsError: { response: { status: 500 } } });
    expect(html).toContain('Recent activity is not available in Patient 360.');
    expect(html).not.toContain('No visits recorded.');
  });

  it('keeps unauthorized recent activity distinct from recorded absence', () => {
    const html = renderOverview({ recentVisits: [], visitsFailed: true, visitsError: { response: { status: 403 } } });
    expect(html).toContain('Recent activity is not available to this sign-in.');
    expect(html).not.toContain('No visits recorded.');
  });
});
