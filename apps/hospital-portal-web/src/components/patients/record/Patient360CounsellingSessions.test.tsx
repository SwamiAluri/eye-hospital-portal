import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360CounsellingSessionsView } from '@/components/patients/record/Patient360CounsellingSessions';
import type { CounsellingSessionRow } from '@/lib/patients/patient-360-counselling-sessions';

const first: CounsellingSessionRow = {
  id: '11111111-1111-1111-1111-111111111111',
  sessionNumber: 'CS-14',
  sessionType: 'Followup',
  sessionDate: '2026-09-02',
  sessionTime: '09:15–09:45',
  status: 'InProgress',
  counsellorName: 'Ada Lovelace',
};

const second: CounsellingSessionRow = {
  id: '22222222-2222-2222-2222-222222222222',
  sessionNumber: null,
  sessionType: 'Initial',
  sessionDate: '2026-09-01',
  sessionTime: null,
  status: 'Scheduled',
  counsellorName: null,
};

describe('patient 360 counselling session presentation', () => {
  it('renders stored session context for each authorized session', () => {
    const html = renderToStaticMarkup(
      <Patient360CounsellingSessionsView result={{ state: 'ready', rows: [first, second] }} />,
    );
    expect(html).toContain('Source: Counselling Sessions');
    expect(html).toContain('not the complete care history');
    expect(html).toContain('CS-14');
    expect(html).toContain('Followup');
    expect(html).toContain('2026-09-02');
    expect(html).toContain('09:15–09:45');
    expect(html).toContain('InProgress');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Initial');
    expect(html).toContain('Scheduled');
    expect(html).toContain('2026-09-01');
    expect(html).toContain('<table');
    expect(html).not.toContain('11111111-1111-1111-1111-111111111111');
    expect(html).not.toContain('Unassigned');
    expect(html.match(/Counsellor:/g)?.length ?? 0).toBe(1);
    expect(html).not.toMatch(/<button|Assign|Claim|Reassign|Requeue/i);
    expect(html).not.toMatch(/package|clinical summary|consent|surgery|note|decision|transcript|recording/i);
  });

  it('shows the empty sentence only after a successful empty read', () => {
    const html = renderToStaticMarkup(
      <Patient360CounsellingSessionsView result={{ state: 'ready', rows: [] }} />,
    );
    expect(html).toContain('No counselling sessions recorded.');
    expect(html).not.toContain('Counselling session information is unavailable.');
  });

  it('does not turn an unauthorized read into empty history', () => {
    const html = renderToStaticMarkup(
      <Patient360CounsellingSessionsView result={{ state: 'unauthorized', rows: [] }} />,
    );
    expect(html).toContain('Counselling session information is not available to this sign-in.');
    expect(html).not.toContain('No counselling sessions recorded.');
  });

  it('shows an unavailable state for a failed read', () => {
    const html = renderToStaticMarkup(
      <Patient360CounsellingSessionsView result={{ state: 'unavailable', rows: [] }} />,
    );
    expect(html).toContain('Counselling session information is unavailable.');
    expect(html).not.toContain('No counselling sessions recorded.');
  });

  it('shows a loading state before the read returns', () => {
    const html = renderToStaticMarkup(<Patient360CounsellingSessionsView result={null} />);
    expect(html).toContain('Loading counselling sessions.');
  });

  it('keeps communication and the other Patient 360 sections in place', () => {
    const root = resolve(__dirname, '../../..');
    const page = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    const care = readFileSync(resolve(root, 'components/patients/record/Patient360Care.tsx'), 'utf8');
    const communication = readFileSync(
      resolve(root, 'components/patients/record/Patient360Communication.tsx'),
      'utf8',
    );
    expect(page).toContain('<Patient360CarePanel />');
    expect(care).toContain('Patient360CommunicationPanel');
    expect(care).toContain('Patient360CounsellingSessionsView');
    expect(page).toContain("section === 'clinical'");
    expect(page).toContain('<Patient360ClinicalPanel />');
    expect(page).toContain("section === 'coverage'");
    expect(page).toContain('<Patient360CoveragePanel />');
    expect(page).toContain("section === 'documents'");
    expect(page).toContain('<Patient360AdministrationPanel />');
    expect(page).toContain('<Patient360SectionBody section={section} />');
    expect(communication).toContain('Communication');
    expect(communication).not.toContain('patient-360/sessions');
    expect(communication).not.toContain('Assign');
    const api = readFileSync(resolve(root, 'lib/api/counseling-sessions.api.ts'), 'utf8');
    expect(api).toContain('/counseling/patients/${patientId}/patient-360/sessions');
    expect(api).toContain('`/counseling/patients/${patientId}/sessions`');
  });
});
