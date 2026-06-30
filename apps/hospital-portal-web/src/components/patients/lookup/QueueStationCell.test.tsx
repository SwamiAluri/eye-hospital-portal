import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PatientLookupRow } from '@/types/patient-lookup';

import { QueueStationCell } from './QueueStationCell';

function row(overrides: Partial<PatientLookupRow> = {}): PatientLookupRow {
  return {
    id: 'patient-1',
    firstName: 'Jane',
    lastName: 'Doe',
    mrn: 'MRN-100',
    dateOfBirth: '1990-01-01',
    gender: 'F',
    isFavorite: false,
    careProgramCodes: [],
    clinicalAcuity: 'low',
    activeEngagements: [],
    ...overrides,
  };
}

describe('QueueStationCell', () => {
  it('renders em dash when no queue or IP data', () => {
    const html = renderToStaticMarkup(<QueueStationCell row={row()} />);
    expect(html).toContain('—');
    expect(html).not.toContain('patient-hub-queue');
  });

  it('renders wait, station, and room for OPD queue', () => {
    const html = renderToStaticMarkup(
      <QueueStationCell
        row={row({
          waitingMinutes: 12,
          currentStation: 'Optometry',
          roomNumber: '3A',
        })}
      />,
    );
    expect(html).toContain('patient-hub-queue-patient-1');
    expect(html).toContain('12 min');
    expect(html).toContain('Optometry');
    expect(html).toContain('Rm 3A');
  });

  it('prefers IP ward label over OPD queue fields', () => {
    const html = renderToStaticMarkup(
      <QueueStationCell
        row={row({
          waitingMinutes: 5,
          currentStation: 'Optometry',
          ipAdmission: { isAdmitted: true, wardName: 'Ward B' },
        })}
      />,
    );
    expect(html).toContain('Ward B');
    expect(html).toContain('IP');
    expect(html).not.toContain('Optometry');
    expect(html).not.toContain('5 min');
  });
});
