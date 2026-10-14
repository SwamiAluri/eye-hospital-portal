import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PatientLookupRow } from '@/types/patient-lookup';
import {
  PatientHubCurrentVisitCell,
  PatientHubLocationCell,
  PatientHubNextAppointmentCell,
  PatientHubPhoneCell,
  PatientHubProviderCell,
} from './PatientHubContextCluster';

const emptyRow: PatientLookupRow = {
  id: 'patient-empty',
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

const checkedInRow: PatientLookupRow = {
  ...emptyRow,
  id: 'patient-1',
  reasonForVisit: 'General Check-up',
  primaryOpenVisitId: 'visit-1',
  waitingMinutes: 8,
  scheduledAt: '2026-06-02T04:35:00.000Z',
  activeEngagements: [
    { type: 'queue', label: 'Queue', status: 'waiting' },
    { type: 'billing', label: 'Billing', status: 'open' },
  ],
};

describe('PatientHubContextCluster Slice B.1A empty states', () => {
  it('uses field-specific empty copy for phone, visit, and next appointment', () => {
    expect(renderToStaticMarkup(<PatientHubPhoneCell row={emptyRow} />)).toContain(
      'Not available',
    );
    expect(renderToStaticMarkup(<PatientHubCurrentVisitCell row={emptyRow} />)).toContain(
      'No active visit',
    );
    expect(renderToStaticMarkup(<PatientHubNextAppointmentCell row={emptyRow} />)).toContain(
      'No upcoming appointment',
    );
    expect(renderToStaticMarkup(<PatientHubProviderCell row={emptyRow} />)).toContain('—');
    expect(renderToStaticMarkup(<PatientHubLocationCell row={emptyRow} />)).toContain('—');
  });

  it('does not invent provider assignment semantics', () => {
    const html = renderToStaticMarkup(<PatientHubProviderCell row={emptyRow} />);
    expect(html).not.toContain('Not assigned');
    expect(html).not.toContain('No provider');
  });

  it('renders phone as plain formatted text without tel: or click affordance', () => {
    const html = renderToStaticMarkup(
      <PatientHubPhoneCell
        row={{ ...emptyRow, phone: '+919800000003' }}
      />,
    );
    expect(html).toContain('+91-9800000003');
    expect(html).toContain('patient-hub-phone-patient-empty');
    expect(html).not.toContain('tel:');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('onClick');
  });
});

describe('PatientHubCurrentVisitCell Slice B.1A density', () => {
  it('keeps Current Visit to reason + compact status with engagement', () => {
    const html = renderToStaticMarkup(<PatientHubCurrentVisitCell row={checkedInRow} />);
    expect(html).toContain('General Check-up');
    expect(html).toContain('Checked in');
    expect(html).toContain('Queue +1');
    expect(html).not.toContain('statusPill');
    expect(html).not.toContain('Book appointment');
  });

  it('does not mislabel an appointment time as checked-in', () => {
    const html = renderToStaticMarkup(
      <PatientHubCurrentVisitCell
        row={{
          ...emptyRow,
          reasonForVisit: 'Review',
          scheduledAt: '2026-10-08T05:00:00.000Z',
        }}
      />,
    );
    expect(html).toContain('Review');
    expect(html).not.toContain('Checked in');
  });
});

describe('PatientHubNextAppointmentCell Slice B.1A', () => {
  it('does not show a check-in time as an appointment', () => {
    const html = renderToStaticMarkup(
      <PatientHubNextAppointmentCell row={checkedInRow} />,
    );
    expect(html).toContain('No upcoming appointment');
    expect(html).not.toContain('Checked in');
    expect(html).not.toContain('Book appointment');
  });

  it('shows the scheduled time when it is not a check-in', () => {
    const html = renderToStaticMarkup(
      <PatientHubNextAppointmentCell
        row={{
          ...emptyRow,
          scheduledAt: '2026-10-08T05:00:00.000Z',
        }}
      />,
    );
    expect(html).not.toContain('Checked in');
    expect(html).not.toContain('No upcoming appointment');
    expect(html).toContain('Oct');
  });
});
