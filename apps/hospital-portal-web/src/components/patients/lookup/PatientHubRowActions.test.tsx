import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PatientLookupRow } from '@/types/patient-lookup';

const permission = vi.hoisted(() => ({ allow: true }));

vi.mock('@/hooks/use-permissions', () => ({
  useHasPermission: (code: string) => permission.allow && code === 'appointment.view',
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

import { PatientHubRowActions } from './PatientHubRowActions';

const bareRow: PatientLookupRow = {
  id: 'patient-1',
  firstName: 'Sam',
  lastName: 'Aluri',
  mrn: 'MRN-1',
  dateOfBirth: '1990-01-15',
  gender: 'male',
  clinicalAcuity: 'low',
  isFavorite: false,
  careProgramCodes: [],
  activeEngagements: [],
};

const upcomingRow: PatientLookupRow = {
  ...bareRow,
  id: 'patient-upcoming',
  scheduledAt: '2026-10-08T05:00:00.000Z',
};

const checkedInRow: PatientLookupRow = {
  ...bareRow,
  id: 'patient-checked-in',
  primaryOpenVisitId: 'visit-1',
  waitingMinutes: 8,
  scheduledAt: '2026-06-02T04:35:00.000Z',
};

describe('PatientHubRowActions Slice B.1A', () => {
  it('shows Check-in, Print Card, and direct Book appointment when eligible', () => {
    permission.allow = true;
    const openVisitNotCheckedIn: PatientLookupRow = {
      ...bareRow,
      primaryOpenVisitId: 'visit-open',
      waitingMinutes: null,
      scheduledAt: null,
    };
    const html = renderToStaticMarkup(
      <PatientHubRowActions row={openVisitNotCheckedIn} />,
    );
    expect(html).toContain('>Check-in<');
    expect(html).toContain('/dashboard/frontdesk/check-in?patientId=patient-1');
    expect(html).toContain('Print Card');
    expect(html).toContain('aria-label="Print Card"');
    expect(html).toContain('patient-hub-print-card-patient-1');
    expect(html).toContain('Book appointment');
    expect(html).not.toContain('aria-label="More actions"');
    expect(html).not.toContain('/dashboard/appointments/schedule');
  });

  it('shows Print Card and Book for a bare row without visit context', () => {
    permission.allow = true;
    const html = renderToStaticMarkup(<PatientHubRowActions row={bareRow} />);
    expect(html).toContain('Print Card');
    expect(html).toContain('Book appointment');
    expect(html).not.toContain('>Check-in<');
    expect(html).not.toContain('aria-label="More actions"');
  });

  it('shows Check-in and Print Card for an upcoming appointment and suppresses Book', () => {
    permission.allow = true;
    const html = renderToStaticMarkup(<PatientHubRowActions row={upcomingRow} />);
    expect(html).toContain('>Check-in<');
    expect(html).toContain('/dashboard/frontdesk/check-in?patientId=patient-upcoming');
    expect(html).toContain('Print Card');
    expect(html).not.toContain('Book appointment');
    expect(html).not.toContain('aria-label="More actions"');
  });

  it('hides Check-in for an already checked-in visit but keeps Print Card and Book', () => {
    permission.allow = true;
    const html = renderToStaticMarkup(<PatientHubRowActions row={checkedInRow} />);
    expect(html).not.toContain('>Check-in<');
    expect(html).toContain('Print Card');
    expect(html).toContain('Book appointment');
    expect(html).not.toContain('aria-label="More actions"');
  });

  it('omits Book appointment when appointment.view is absent', () => {
    permission.allow = false;
    const html = renderToStaticMarkup(<PatientHubRowActions row={bareRow} />);
    expect(html).toContain('Print Card');
    expect(html).not.toContain('Book appointment');
    expect(html).not.toContain('aria-label="More actions"');
  });
});
