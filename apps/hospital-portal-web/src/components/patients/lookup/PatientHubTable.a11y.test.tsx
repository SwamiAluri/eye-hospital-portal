import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-permissions', () => ({
  useHasPermission: (code: string) => code === 'appointment.view',
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

import { PatientHubTable, PATIENT_HUB_COLGROUP_DESKTOP, PATIENT_HUB_COLGROUP_COMPACT } from './PatientHubTable';
import type { PatientLookupRow } from '@/types/patient-lookup';

const noop = () => undefined;

const row: PatientLookupRow = {
  id: 'patient-1',
  firstName: 'Sam',
  lastName: 'Aluri',
  mrn: 'MRN-2026-02-CE412',
  dateOfBirth: '1987-01-01',
  gender: 'male',
  clinicalAcuity: 'high',
  isFavorite: false,
  careProgramCodes: ['CATARACT'],
  reasonForVisit: 'Follow-up review',
  currentStation: 'Triage',
  roomNumber: '3',
  waitingMinutes: 12,
  assignedProviderName: 'Dr. Rao',
  assignedProviderRole: 'Ophthalmologist',
  primaryOpenVisitId: 'visit-1',
  scheduledAt: '2026-06-02T04:35:00.000Z',
  phone: '9999900000',
  activeEngagements: [
    { type: 'queue', label: 'In queue', status: 'waiting' },
    { type: 'billing', label: 'Billing', status: 'open' },
  ],
};

const checkInEligibleRow: PatientLookupRow = {
  ...row,
  id: 'patient-checkin',
  waitingMinutes: null,
  primaryOpenVisitId: null,
  scheduledAt: '2026-10-08T05:00:00.000Z',
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
  phone: null,
  activeEngagements: [],
};

function renderTable(
  currentSort: 'name' | 'acuity' = 'name',
  currentSortDir: 'asc' | 'desc' = 'asc',
  rows: PatientLookupRow[] = [row],
  compact = false,
) {
  return renderToStaticMarkup(
    <PatientHubTable
      rows={rows}
      previewId={null}
      isLoading={false}
      isError={false}
      isReady
      currentSort={currentSort}
      currentSortDir={currentSortDir}
      onSort={noop}
      compactColumns={compact}
      onRowClick={noop}
      onOpenProfile={noop}
    />,
  );
}

describe('PatientHubTable Slice B.1A', () => {
  it('renders approved desktop columns and identity', () => {
    const html = renderTable();
    expect(html).toContain('>Patient<');
    expect(html).toContain('>MRN<');
    expect(html).toContain('>Gender<');
    expect(html).toContain('>Phone<');
    expect(html).toContain('>Provider<');
    expect(html).toContain('>Actions<');
    expect(html).not.toContain('>Next Appointment<');
    expect(html).not.toContain('>Current Visit<');
    expect(html).not.toContain('>Location<');
    expect(html).not.toContain('>Engagement<');
    expect(html).toContain('MRN-2026-02-CE412');
    expect(html).not.toContain('MRN-2026-02-CE412 ·');
    expect(html).toContain('MALE');
    expect(html).not.toContain('Follow-up review');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('Ophthalmologist');
    expect(html).toContain('+91-9999900000');
    expect(html).toContain('patient-hub-phone-patient-1');
    expect(html).not.toContain('tel:');
    expect(html).not.toContain('CATARACT');
    expect(html).toContain('href="/dashboard/patients/patient-1"');
  });

  it('uses matching column tracks on header and rows via colgroup + data-col', () => {
    const html = renderTable();
    expect(html).toContain('patient-hub-table-colgroup');
    expect(html).toContain('table-fixed');
    expect(html).toContain('border-collapse');
    for (const col of PATIENT_HUB_COLGROUP_DESKTOP) {
      expect(html).toContain(`data-col="${col.key}"`);
      expect(html).toContain(`width:${col.width}`);
      const markers = html.split(`data-col="${col.key}"`).length - 1;
      expect(markers).toBeGreaterThanOrEqual(2);
    }
    const widths = PATIENT_HUB_COLGROUP_DESKTOP.map((c) => Number.parseFloat(c.width));
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('keeps Provider in the track when compact and keeps percentage sum at 100', () => {
    const html = renderTable('name', 'asc', [row], true);
    expect(html).toContain('data-compact="true"');
    expect(html).toContain('>Provider<');
    expect(html).toContain('data-col="provider"');
    const widths = PATIENT_HUB_COLGROUP_COMPACT.map((c) => Number.parseFloat(c.width));
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('omits unusable wait durations from the worklist', () => {
    const html = renderTable('name', 'asc', [
      { ...row, waitingMinutes: 180733 },
    ]);
    expect(html).not.toContain('180733');
  });

  it('shows Check-in in actions when eligible and suppresses Book', () => {
    const html = renderTable('name', 'asc', [checkInEligibleRow]);
    expect(html).toContain('>Check-in<');
    expect(html).toContain('/dashboard/frontdesk/check-in?patientId=patient-checkin');
    expect(html).not.toContain('Book appointment');
  });

  it('exposes direct Check-in / Print Card / Book without a three-dot menu', () => {
    const html = renderTable('name', 'asc', [bareBookableRow]);
    expect(html).toContain('Print Card');
    expect(html).toContain('aria-label="Print Card"');
    expect(html).toContain('patient-hub-print-card-patient-bare');
    expect(html).toContain('Book appointment');
    expect(html).not.toContain('aria-label="More actions"');
    expect(html).not.toContain('aria-label="Favorite"');
    expect(html).not.toContain('>Assigned<');
  });

  it('keeps Provider independent when compact and omits retired columns', () => {
    const html = renderTable('name', 'asc', [row], true);
    expect(html).toContain('data-compact="true"');
    expect(html).not.toContain('>Current Visit<');
    expect(html).not.toContain('>Location<');
    expect(html).not.toContain('>Next Appointment<');
    expect(html).toContain('>Provider<');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('>Phone<');
    expect(html).toContain('>MRN<');
    expect(html).toContain('>Gender<');
    expect(html).toContain('>Actions<');
  });

  it('contains phone cells with overflow clipping', () => {
    const html = renderTable();
    expect(html).toContain('min-w-0 overflow-hidden');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('+91-9999900000');
    expect(html).not.toContain('tel:');
  });

  it('keeps actions start-aligned on a single nowrap line without a More menu', () => {
    const html = renderTable('name', 'asc', [bareBookableRow]);
    expect(html).toContain('flex-nowrap');
    expect(html).toContain('justify-start');
    expect(html).toContain('Print Card');
    expect(html).toContain('Book appointment');
    expect(html).not.toContain('aria-label="More actions"');
  });

  it('uses the balanced six-column colgroup percentages', () => {
    expect(PATIENT_HUB_COLGROUP_DESKTOP.map((c) => c.key)).toEqual([
      'patient',
      'mrn',
      'gender',
      'phone',
      'provider',
      'actions',
    ]);
    expect(
      PATIENT_HUB_COLGROUP_DESKTOP.map((c) => Number.parseFloat(c.width)).reduce((a, b) => a + b, 0),
    ).toBe(100);
  });

  it('exposes aria-sort on the patient name header only', () => {
    const active = renderTable('name', 'asc');
    expect(active).toContain('aria-sort="ascending"');
    const inactiveName = renderTable('acuity', 'desc');
    expect(inactiveName).toContain('aria-sort="none"');
  });
});
