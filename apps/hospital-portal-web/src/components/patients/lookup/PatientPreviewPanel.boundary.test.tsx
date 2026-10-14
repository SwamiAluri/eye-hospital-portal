import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PatientLookupRow, PatientSummary } from '@/types/patient-lookup';

const summary: PatientSummary = {
  id: 'pat-1',
  firstName: 'Sam',
  lastName: 'Aluri',
  mrn: 'MRN-100',
  dateOfBirth: '1987-01-01',
  gender: 'male',
  phone: '9876543210',
  clinicalAcuity: 'high',
  activeEngagements: [{ type: 'opd', label: 'OPD' }],
  careProgramCodes: [],
  reasonForVisit: 'Blurred vision',
  scheduledAt: '2026-09-29T09:00:00.000Z',
  assignedProviderName: 'Dr. Rao',
  assignedProviderRole: 'Admin',
  assignedVisitId: 'visit-1',
  currentStation: 'Optometry',
  dataQuality: {
    isIncomplete: true,
    issues: ['Phone number missing on file'],
  },
};

const row: PatientLookupRow = {
  id: 'pat-1',
  firstName: 'Sam',
  lastName: 'Aluri',
  mrn: 'MRN-100',
  dateOfBirth: '1987-01-01',
  gender: 'male',
  clinicalAcuity: 'high',
  isFavorite: false,
  careProgramCodes: [],
  activeEngagements: [{ type: 'opd', label: 'OPD' }],
  reasonForVisit: 'Blurred vision',
};

const queries = vi.hoisted(() => ({
  summary: {
    data: null as PatientSummary | null,
    isLoading: false,
    isError: false,
  },
  visits: {
    data: [] as {
      id: string;
      status: string;
      currentStation: string;
      tokenNumber: string;
      checkedInAt: string;
    }[],
    isLoading: false,
    isError: false,
  },
}));

vi.mock('@/hooks/use-patient-lookup-queries', () => ({
  usePatientSummaryQuery: () => queries.summary,
  usePatientRecentVisitsQuery: () => queries.visits,
  useRecordPatientRecentViewMutation: () => ({ mutate: () => undefined }),
}));

vi.mock('@/lib/api/patient-lookup.api', () => ({
  patientLookupApi: {
    logPhiAccess: () => Promise.resolve(),
  },
}));

import { PatientPreviewPanel } from './PatientPreviewPanel';

function renderPreview() {
  queries.summary = { data: summary, isLoading: false, isError: false };
  queries.visits = {
    data: [
      {
        id: 'visit-9',
        status: 'waiting',
        currentStation: 'Front desk',
        tokenNumber: 'A12',
        checkedInAt: '2026-09-29T08:00:00.000Z',
      },
    ],
    isLoading: false,
    isError: false,
  };
  return renderToStaticMarkup(
    <PatientPreviewPanel
      patient={row}
      branchId="branch-1"
      open
      onClose={() => undefined}
    />,
  );
}

describe('Patient Directory preview boundary', () => {
  it('shows identity, operational context, warnings, recent visits, and existing handoffs', () => {
    const html = renderPreview();
    expect(html).toContain('Sam Aluri');
    expect(html).toContain('MRN-100');
    expect(html).toContain('high acuity');
    expect(html).toContain('OPD');
    expect(html).toContain('Blurred vision');
    expect(html).toContain('Phone number missing on file');
    expect(html).toContain('Recent visits');
    expect(html).toContain('A12');
    expect(html).toContain('Open Patient 360');
    expect(html).toContain('/dashboard/patients/pat-1');
    expect(html).not.toContain('Open full profile');
    expect(html).not.toContain('Expand to full profile');
    expect(html).toContain('/dashboard/frontdesk/check-in?patientId=pat-1');
    expect(html).not.toContain('/dashboard/patients/pat-1/encounter/visit-1');
    expect(html).not.toContain('Continue encounter');
    expect(html).not.toContain('/dashboard/patients/pat-1/summary/print');
    expect(html).not.toContain('>Print<');
    expect(html).not.toContain('<footer');
    expect(html).toContain('aria-label="Close preview"');
    expect(html).toContain('Current context');
    expect(html).toContain('Data quality');
    expect(html).toContain('>Visit<');
    expect(html).toContain('Emergency contact');
    expect(html).toContain('No emergency contact on file.');
    expect(html).toContain('Location');
    expect(html).toContain('Provider');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('>Time<');
    expect(html).toContain('>Reason<');
    expect(html).toContain('Scheduled');
    expect(html).toContain('>Check in<');
    expect(html).not.toContain('Check in →');
    expect(html).toContain('Missing/incomplete information');
    expect(html).toContain('text-counselling-primary');
    expect(html).not.toContain('bg-emerald-600');
    expect(html.split('Open Patient 360').length - 1).toBe(1);
    expect(html).toContain('tabindex="-1"');
  });

  it('keeps the desktop preview at half the work area without a 480px cap', () => {
    const split = readFileSync(resolve(__dirname, 'PatientPreviewSplitPane.tsx'), 'utf8');
    const drawer = readFileSync(resolve(__dirname, 'PatientPreviewDrawer.tsx'), 'utf8');
    const panel = readFileSync(resolve(__dirname, 'PatientPreviewPanel.tsx'), 'utf8');
    expect(split).toContain('w-1/2');
    expect(split).not.toContain('max-w-[480px]');
    expect(drawer).toContain('sm:w-1/2');
    expect(drawer).toContain('h-[100dvh]');
    expect(drawer).not.toContain('max-w-[420px]');
    expect(drawer).not.toContain('max-w-[480px]');
    expect(panel).toContain('shrink-0 border-b');
    expect(panel).toContain('min-h-0 flex-1 divide-y divide-counselling-border/50 overflow-y-auto');
    expect(panel).toContain('previewBody');
    expect(panel).not.toContain('<footer');
    expect(panel).not.toContain('patientEncounterUrl');
    expect(panel).toContain('buildFrontDeskCheckInHref');
    expect(panel).toContain("event.key !== 'Escape'");
    expect(panel).toContain('previous?.focus()');
  });

  it('does not render clinical mini-panels or call their APIs from the preview', () => {
    const html = renderPreview();
    expect(html).not.toContain('>Vitals<');
    expect(html).not.toContain('>Eye<');
    expect(html).not.toContain('>Meds<');
    expect(html).not.toContain('>Labs<');
    expect(html).not.toContain('No vitals recorded yet');
    expect(html).not.toContain('No lab results');

    const panel = readFileSync(resolve(__dirname, 'PatientPreviewPanel.tsx'), 'utf8');
    expect(panel).toContain("patientLookupApi.logPhiAccess(patientId, 'preview')");
    expect(panel).toContain('useRecordPatientRecentViewMutation');
    expect(panel).toContain('usePatientSummaryQuery');
    expect(panel).toContain('skipPhiAudit: true');
    expect(panel).toContain('usePatientRecentVisitsQuery');
    expect(panel).not.toContain('PatientPreviewTabPanels');
    expect(panel).not.toContain('examinationApi');
    expect(panel).not.toContain('prescriptionsApi');
    expect(panel).not.toContain('labReportsApi');
    expect(panel).not.toContain('PreviewVitalsGrid');
  });

  it('shows an empty recent-visits line only when the visit query succeeds with no rows', () => {
    queries.summary = { data: summary, isLoading: false, isError: false };
    queries.visits = { data: [], isLoading: false, isError: false };
    const empty = renderToStaticMarkup(
      <PatientPreviewPanel patient={row} branchId="branch-1" open onClose={() => undefined} />,
    );
    expect(empty).toContain('No recent visits');
    expect(empty).not.toContain('medical history');

    queries.visits = { data: [], isLoading: false, isError: true };
    const failed = renderToStaticMarkup(
      <PatientPreviewPanel patient={row} branchId="branch-1" open onClose={() => undefined} />,
    );
    expect(failed).toContain('Could not load recent visits.');
    expect(failed).not.toContain('No recent visits');
  });

  it('hides Check in when the visit is already checked in', () => {
    queries.summary = {
      data: {
        ...summary,
        assignedVisitId: 'visit-1',
        dataQuality: { isIncomplete: false, issues: [] },
      },
      isLoading: false,
      isError: false,
    };
    queries.visits = { data: [], isLoading: false, isError: false };
    const checkedInRow: PatientLookupRow = {
      ...row,
      primaryOpenVisitId: 'visit-1',
      waitingMinutes: 12,
      scheduledAt: '2026-09-29T09:00:00.000Z',
    };
    const html = renderToStaticMarkup(
      <PatientPreviewPanel
        patient={checkedInRow}
        branchId="branch-1"
        open
        onClose={() => undefined}
      />,
    );
    expect(html).toContain('Checked in');
    expect(html).not.toContain('patient-hub-preview-check-in');
    expect(html).not.toContain('>Check in<');
    expect(html).not.toContain('Check in →');
  });

  it('hides Check in when there is no eligible visit context', () => {
    queries.summary = {
      data: {
        ...summary,
        scheduledAt: null,
        assignedVisitId: null,
        reasonForVisit: null,
        assignedProviderName: null,
        currentStation: null,
        activeEngagements: [],
        dataQuality: { isIncomplete: false, issues: [] },
      },
      isLoading: false,
      isError: false,
    };
    queries.visits = { data: [], isLoading: false, isError: false };
    const bareRow: PatientLookupRow = {
      ...row,
      scheduledAt: null,
      primaryOpenVisitId: null,
      waitingMinutes: null,
      reasonForVisit: null,
      activeEngagements: [],
    };
    const html = renderToStaticMarkup(
      <PatientPreviewPanel patient={bareRow} branchId="branch-1" open onClose={() => undefined} />,
    );
    expect(html).not.toContain('patient-hub-preview-check-in');
    expect(html).not.toContain('>Check in<');
  });

  it('hides data quality when there are no warnings and shows Call only with a phone', () => {
    queries.summary = {
      data: {
        ...summary,
        dataQuality: { isIncomplete: false, issues: [] },
        emergencyContactName: 'Anita Aluri',
        emergencyContactRelationship: 'spouse',
        emergencyContactPhone: '9000011111',
      },
      isLoading: false,
      isError: false,
    };
    queries.visits = { data: [], isLoading: false, isError: false };
    const populated = renderToStaticMarkup(
      <PatientPreviewPanel patient={row} branchId="branch-1" open onClose={() => undefined} />,
    );
    expect(populated).not.toContain('Data quality');
    expect(populated).not.toContain('Missing/incomplete information');
    expect(populated).toContain('Anita Aluri');
    expect(populated).toContain('9000011111');
    expect(populated).toContain('>Call<');
    expect(populated).toContain('aria-label="Call emergency contact Anita Aluri"');

    queries.summary = {
      data: {
        ...summary,
        dataQuality: { isIncomplete: false, issues: [] },
        emergencyContactName: 'Anita Aluri',
        emergencyContactPhone: '',
      },
      isLoading: false,
      isError: false,
    };
    const noPhone = renderToStaticMarkup(
      <PatientPreviewPanel patient={row} branchId="branch-1" open onClose={() => undefined} />,
    );
    expect(noPhone).toContain('Anita Aluri');
    expect(noPhone).not.toContain('>Call<');
  });
});
